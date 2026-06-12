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
): DashboardStats {
  const month = monthOf(todayIso);
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
