// src/utils/dashboardStats.ts
// Pure KPI math for the Dashboard screen, kept out of the component so it
// can be unit-tested: branch filtering, today/month windows and money sums.
// Sales totals use preciopromocion (the price actually charged); income/
// outcome figures come from the daily-report transactions rows.

export interface DashboardStats {
  ventasHoy: { count: number; total: number };
  ventasMes: { count: number; total: number };
  ingresosHoy: number;
  egresosHoy: number;
  netoHoy: number;
  ingresosMes: number;
  egresosMes: number;
  netoMes: number;
  /** Credit sales still owing money (saldo promo > 0). */
  porCobrar: { count: number; total: number };
  /** Month numbers per branch; only filled when viewing "all". */
  porSucursal: Array<{ branch: string; ventas: number; ingresos: number }>;
}

export const DASHBOARD_BRANCHES = [
  'aquismon',
  'cerroazul',
  'tepetzintla',
  'tlacolula',
];

/** "Cerro Azul" → "cerroazul", matching the report screen's normalization. */
export const branchSlug = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '');

const dayOf = (value: unknown): string => String(value ?? '').slice(0, 10);
const monthOf = (value: unknown): string => String(value ?? '').slice(0, 7);

export function computeDashboardStats(
  sales: any[],
  transactions: any[],
  branch: string, // slug, or 'all'
  todayIso: string, // local YYYY-MM-DD
  branches: string[] = DASHBOARD_BRANCHES,
  // Month the "Este mes" / "Por sucursal" figures cover (YYYY-MM). Defaults to
  // todayIso's month; the dashboard's month picker passes a past month here so
  // those sections can be read historically while the "Hoy" figures above them
  // stay on the real today.
  monthKey?: string,
): DashboardStats {
  const month = monthKey || monthOf(todayIso);
  const inBranch = (slug: string) => branch === 'all' || slug === branch;

  const branchSales = (sales || []).filter(
    s => s && inBranch(branchSlug(s.sucursal)),
  );
  const salesHoy = branchSales.filter(s => dayOf(s.fecha) === todayIso);
  const salesMes = branchSales.filter(s => monthOf(s.fecha) === month);
  const sumPromo = (rows: any[]) =>
    rows.reduce((sum, s) => sum + (Number(s.preciopromocion) || 0), 0);

  const branchTx = (transactions || []).filter(
    t => t && inBranch(branchSlug(t.location)),
  );
  const txHoy = branchTx.filter(t => dayOf(t.transaction_date) === todayIso);
  const txMes = branchTx.filter(t => monthOf(t.transaction_date) === month);
  const sumType = (rows: any[], type: 'income' | 'outcome') =>
    rows
      .filter(t => t.transaction_type === type)
      .reduce((sum, t) => sum + (Number(t.value) || 0), 0);

  const ingresosHoy = sumType(txHoy, 'income');
  const egresosHoy = sumType(txHoy, 'outcome');
  const ingresosMes = sumType(txMes, 'income');
  const egresosMes = sumType(txMes, 'outcome');

  const pendientes = branchSales.filter(
    s => (Number(s.saldo_precio_promocion) || 0) > 0,
  );

  const porSucursal =
    branch === 'all'
      ? branches.map(b => {
          const bSalesMes = (sales || []).filter(
            s => s && branchSlug(s.sucursal) === b && monthOf(s.fecha) === month,
          );
          const bIngresosMes = sumType(
            (transactions || []).filter(
              t =>
                t &&
                branchSlug(t.location) === b &&
                monthOf(t.transaction_date) === month,
            ),
            'income',
          );
          return { branch: b, ventas: bSalesMes.length, ingresos: bIngresosMes };
        })
      : [];

  return {
    ventasHoy: { count: salesHoy.length, total: sumPromo(salesHoy) },
    ventasMes: { count: salesMes.length, total: sumPromo(salesMes) },
    ingresosHoy,
    egresosHoy,
    netoHoy: ingresosHoy - egresosHoy,
    ingresosMes,
    egresosMes,
    netoMes: ingresosMes - egresosMes,
    porCobrar: {
      count: pendientes.length,
      total: pendientes.reduce(
        (sum, s) => sum + (Number(s.saldo_precio_promocion) || 0),
        0,
      ),
    },
    porSucursal,
  };
}

/** 12345.6 → "$12,345.60" (no Intl dependency). */
export function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  const fixed = Math.abs(Math.round(n * 100) / 100).toFixed(2);
  const [int, dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${grouped}.${dec}`;
}

/** Short money for chart labels: 950 → "$950", 12345 → "$12.3k". */
export function compactMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000) {
    const k = abs / 1000;
    return `${sign}$${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}k`;
  }
  return `${sign}$${Math.round(abs)}`;
}

export interface DayIncome {
  /** YYYY-MM-DD */
  day: string;
  /** Short Spanish weekday for the axis ("lun", "mar", …). */
  label: string;
  total: number;
}

const WEEKDAYS_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const MONTHS_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

const MONTHS_ES_LONG = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** "2025-09" → "Septiembre 2025", for the month picker and section titles. */
export function monthTitle(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return `${MONTHS_ES_LONG[(month || 1) - 1] || key} ${year}`;
}

/** Short Spanish month name by 1-based number: 9 → "sep". */
export const monthShortName = (month: number): string =>
  MONTHS_ES[month - 1] || String(month);

/** Local YYYY-MM for a Date (never UTC — matches getLocalDateString). */
export function monthKeyOf(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Step a YYYY-MM key by `delta` months, staying calendar-correct. */
export function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  return monthKeyOf(new Date(y, m - 1 + delta, 1));
}

export interface MonthNeto {
  /** YYYY-MM */
  month: string;
  /** Short Spanish month for the axis ("ene", …); adds 'YY when not this year. */
  label: string;
  /** income − outcome for that month; can be negative. */
  total: number;
}

/**
 * The `count` month keys (YYYY-MM) ending at `anchorMonth` inclusive, oldest
 * first — the shared window definition for every month-over-month chart.
 */
export function monthWindowKeys(anchorMonth: string, count = 6): string[] {
  const [y, m] = anchorMonth.split('-').map(Number);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(y, m - 1 - i, 1);
    keys.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    );
  }
  return keys;
}

/**
 * Neto (ingresos − egresos) per month for the trailing `months` window
 * ending at `anchorIso`'s month (inclusive), oldest first — feeds the
 * dashboard's month-over-month comparison chart.
 *
 * `todayIso` only decides which labels get a `'YY` suffix (months outside the
 * real current year), so a window anchored in the past stays unambiguous.
 */
export function netoLastMonths(
  transactions: any[],
  branch: string,
  anchorIso: string,
  months = 6,
  todayIso: string = anchorIso,
): MonthNeto[] {
  const inBranch = (slug: string) => branch === 'all' || slug === branch;
  const rows = (transactions || []).filter(
    t => t && inBranch(branchSlug(t.location)),
  );

  return monthWindowKeys(monthOf(anchorIso), months).map(key => ({
    month: key,
    label: monthLabelFromKey(key, todayIso),
    total: rows
      .filter(t => monthOf(t.transaction_date) === key)
      .reduce((sum, t) => {
        const value = Number(t.value) || 0;
        if (t.transaction_type === 'income') return sum + value;
        if (t.transaction_type === 'outcome') return sum - value;
        return sum;
      }, 0),
  }));
}

/** "2026-07" → "jul" (adds 'YY when the month isn't in todayIso's year). */
export function monthLabelFromKey(key: string, todayIso: string): string {
  const [year, month] = key.split('-').map(Number);
  const currentYear = Number(todayIso.slice(0, 4));
  const short = MONTHS_ES[(month || 1) - 1] || key;
  return year === currentYear ? short : `${short} '${String(year).slice(-2)}`;
}

/**
 * Income (only) per month for the trailing `months` window ending at
 * `anchorIso`'s month, oldest first — combined with the /expenses endpoint it
 * feeds the "Ganancias por mes" chart (ganancias = ingresos − gastos).
 */
export function incomeLastMonths(
  transactions: any[],
  branch: string,
  anchorIso: string,
  months = 6,
  todayIso: string = anchorIso,
): MonthNeto[] {
  const inBranch = (slug: string) => branch === 'all' || slug === branch;
  const incomes = (transactions || []).filter(
    t =>
      t &&
      t.transaction_type === 'income' &&
      inBranch(branchSlug(t.location)),
  );

  return monthWindowKeys(monthOf(anchorIso), months).map(key => ({
    month: key,
    label: monthLabelFromKey(key, todayIso),
    total: incomes
      .filter(t => monthOf(t.transaction_date) === key)
      .reduce((sum, t) => sum + (Number(t.value) || 0), 0),
  }));
}

/** Server /expenses/monthly row shape. */
export interface ExpensesMonth {
  month: string;
  total: number;
  byBranch: Record<string, number>;
}

/**
 * Slice the (dense, oldest-first) /expenses/monthly response down to the
 * `count` months ending at `anchorMonth`. The endpoint only ever returns a
 * window trailing *today*, so months the server didn't cover — and any gap —
 * come back as zeros rather than shifting the series out of alignment with
 * the transaction-derived charts beside it.
 */
export function expensesWindow(
  months: ExpensesMonth[],
  anchorMonth: string,
  count = 6,
): ExpensesMonth[] {
  const byMonth = new Map((months || []).map(m => [m.month, m]));
  return monthWindowKeys(anchorMonth, count).map(
    key => byMonth.get(key) || { month: key, total: 0, byBranch: {} },
  );
}

/**
 * Project the /expenses/monthly response onto a branch selection:
 * 'all' → grand total per month, otherwise that branch's figure.
 */
export function expensesSeries(
  months: ExpensesMonth[],
  branch: string,
  todayIso: string,
): MonthNeto[] {
  return (months || []).map(m => ({
    month: m.month,
    label: monthLabelFromKey(m.month, todayIso),
    total:
      branch === 'all'
        ? Number(m.total) || 0
        : Number(m.byBranch?.[branch]) || 0,
  }));
}

/**
 * Income totals per day for the trailing `days` window ending at `todayIso`
 * (inclusive), oldest first — feeds the dashboard's bar chart.
 */
export function incomeLastDays(
  transactions: any[],
  branch: string,
  todayIso: string,
  days = 7,
): DayIncome[] {
  const [y, m, d] = todayIso.split('-').map(Number);
  const inBranch = (slug: string) => branch === 'all' || slug === branch;
  const incomes = (transactions || []).filter(
    t =>
      t &&
      t.transaction_type === 'income' &&
      inBranch(branchSlug(t.location)),
  );

  const result: DayIncome[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(y, m - 1, d - i);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const key = `${date.getFullYear()}-${mm}-${dd}`;
    const total = incomes
      .filter(t => dayOf(t.transaction_date) === key)
      .reduce((sum, t) => sum + (Number(t.value) || 0), 0);
    result.push({ day: key, label: WEEKDAYS_ES[date.getDay()], total });
  }
  return result;
}
