// src/utils/paymentStatus.ts
// Pure payment-plan math for credit sales, kept out of the components so it
// can be unit-tested: installment size ("Pagos de"), how far behind the
// customer is, the vencida/atrasada/a tiempo/pagada status, the 15-day promo
// window and the 6%-per-month late surcharge on saldo precio normal.
//
// Business rules (confirmed with the owner):
// - 1 month = 4 weeks, 1 quincena = 2 weeks when converting the plazo.
// - Installments round UP to the next multiple of 5 so they end in 0 or 5
//   ($204.09 → $205, $183 → $185); the last payment simply comes out smaller.
// - "Al terminar" has no installments: the customer pays the remaining promo
//   saldo by the due date.
// - Promo price stops applying 15 days after fecha de vencimiento unless the
//   sale has pp_enabled = true ("Habilitar PP").
// - Surcharge: 2 full months past due adds 6% to saldo precio normal, and
//   every further full month adds another 6% (simple, display-only — the DB
//   saldo is never mutated).

export type SaleStatus = 'pagada' | 'vencida' | 'atrasada' | 'a_tiempo';

export type PaymentFrequency = 'Semanal' | 'Quincenal' | 'Mensual' | 'Al terminar';

export interface PaymentInfo {
  /** Whether this sale carries a payment plan at all (Crédito/MSI/Apartado). */
  isCredit: boolean;
  status: SaleStatus;
  frequency: PaymentFrequency | null;
  /** Money per installment; for "Al terminar" it's the remaining promo saldo. */
  pagosDe: number | null;
  /** "semana(s)" / "quincena(s)" / "mes(es)" — null for "Al terminar". */
  periodLabel: string | null;
  /** Whole periods the customer is behind. */
  tiempoAtrasado: number;
  /** Money needed to catch back up with the plan. */
  cantidadAtrasada: number;
  /** False once the sale is >15 days past due (and not manually re-enabled). */
  promoActive: boolean;
  /** Days past fecha de vencimiento (negative = not due yet, null = no date). */
  daysPastDue: number | null;
  /** 6% steps applied to saldo precio normal (0 when not applicable). */
  surchargePct: number;
  /** saldo_precio_normal with the surcharge applied. */
  saldoNormalConRecargo: number;
}

const CREDIT_FORMS = ['crédito', 'credito', 'msi', 'apartado'];

const num = (v: unknown): number => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

/**
 * Round up to the next multiple of 5 so amounts end in 0 or 5.
 * Rounds to cents first (and allows a float-noise epsilon) so an exact
 * multiple like 200.000000003 stays 200 instead of jumping to 205.
 */
export const roundUpToFive = (n: number): number => {
  const cents = Math.round(n * 100) / 100;
  return Math.ceil(cents / 5 - 1e-9) * 5;
};

/** Deep-parse the plazo shapes the API has returned over time. */
export const parsePlazo = (
  plazo: any,
): { value: number; unit: 'days' | 'weeks' | 'months' } | null => {
  let raw = plazo;
  for (let i = 0; i < 3; i++) {
    if (typeof raw === 'string' && raw.trim().startsWith('{')) {
      try {
        raw = JSON.parse(raw);
        continue;
      } catch {
        return null;
      }
    }
    if (
      raw &&
      typeof raw === 'object' &&
      typeof raw.value === 'string' &&
      raw.value.trim().startsWith('{')
    ) {
      try {
        const inner = JSON.parse(raw.value);
        raw = { value: inner.value, unit: inner.unit ?? raw.unit };
        continue;
      } catch {
        return null;
      }
    }
    break;
  }
  if (typeof raw === 'string') {
    const [v, u] = raw.split(' ');
    raw = { value: v, unit: u };
  }
  if (!raw || typeof raw !== 'object') return null;
  const value = parseFloat(String(raw.value));
  if (!value || value <= 0) return null;
  const unit = ['days', 'weeks', 'months'].includes(raw.unit) ? raw.unit : 'weeks';
  return { value, unit };
};

const plazoToWeeks = (plazo: { value: number; unit: string }): number => {
  switch (plazo.unit) {
    case 'days':
      return plazo.value / 7;
    case 'months':
      return plazo.value * 4;
    default:
      return plazo.value;
  }
};

const FREQUENCIES: PaymentFrequency[] = ['Semanal', 'Quincenal', 'Mensual', 'Al terminar'];

/** Saved frequency, or one derived from the plazo unit for older sales. */
export const getFrequency = (sale: any): PaymentFrequency | null => {
  if (FREQUENCIES.includes(sale?.payment_frequency)) return sale.payment_frequency;
  const plazo = parsePlazo(sale?.plazo);
  if (!plazo) return null;
  return plazo.unit === 'months' ? 'Mensual' : 'Semanal';
};

const PERIOD_DAYS: Record<string, number> = {
  Semanal: 7,
  Quincenal: 14,
  Mensual: 30,
};

const PERIOD_LABEL: Record<string, string> = {
  Semanal: 'semana(s)',
  Quincenal: 'quincena(s)',
  Mensual: 'mes(es)',
};

/** How many installments the plazo yields at the chosen frequency. */
export const getNumberOfPayments = (sale: any): number | null => {
  const plazo = parsePlazo(sale?.plazo);
  const frequency = getFrequency(sale);
  if (!plazo || !frequency || frequency === 'Al terminar') return null;
  const weeks = plazoToWeeks(plazo);
  let periods: number;
  if (frequency === 'Semanal') periods = weeks;
  else if (frequency === 'Quincenal') periods = weeks / 2;
  else periods = plazo.unit === 'months' ? plazo.value : weeks / 4;
  return Math.max(1, Math.ceil(periods));
};

const daysBetween = (from: Date, to: Date): number =>
  Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));

/** Full calendar months elapsed since `from` (0 if `to` is before it). */
const fullMonthsSince = (from: Date, to: Date): number => {
  let months = 0;
  const probe = new Date(from.getTime());
  probe.setMonth(probe.getMonth() + 1);
  while (probe.getTime() <= to.getTime()) {
    months += 1;
    probe.setMonth(probe.getMonth() + 1);
  }
  return months;
};

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
};

export function getPaymentInfo(sale: any, now: Date = new Date()): PaymentInfo {
  const isCredit = CREDIT_FORMS.includes(String(sale?.formadepago ?? '').toLowerCase());
  const saldoPromo = num(sale?.saldo_precio_promocion);
  const saldoNormal = num(sale?.saldo_precio_normal);
  const precioPromo = num(sale?.preciopromocion);
  const enganche = num(sale?.enganche);
  const vencimiento = parseDate(sale?.fechavencimiento);
  const fechaCompra = parseDate(sale?.fecha);
  const frequency = isCredit ? getFrequency(sale) : null;

  const daysPastDue = vencimiento ? daysBetween(vencimiento, now) : null;

  // Owner rule: the account is paid the moment the promo saldo hits zero —
  // being past the due date can never turn a paid sale into "vencida", and a
  // settled sale keeps its promo pricing and accrues no surcharge.
  const settled = saldoPromo <= 0;

  const promoActive =
    settled ||
    sale?.pp_enabled === true ||
    daysPastDue === null ||
    daysPastDue <= 15;

  // Surcharge on saldo normal: +6% at 2 full months past due, +6% per extra month.
  const monthsPastDue = vencimiento ? fullMonthsSince(vencimiento, now) : 0;
  const surchargePct =
    !settled && monthsPastDue >= 2 ? 6 * (monthsPastDue - 1) : 0;
  const saldoNormalConRecargo =
    Math.round(saldoNormal * (1 + surchargePct / 100) * 100) / 100;

  // Installment ("Pagos de"). An amount typed by hand in the sale form is
  // saved as pagos_de and wins over the calculation.
  const storedPagosDe = num(sale?.pagos_de);
  let pagosDe: number | null = null;
  let periodLabel: string | null = null;
  if (isCredit && frequency === 'Al terminar') {
    pagosDe = storedPagosDe > 0 ? storedPagosDe : saldoPromo;
  } else if (isCredit && frequency) {
    const numPayments = getNumberOfPayments(sale);
    const financed = precioPromo - enganche;
    if (storedPagosDe > 0) {
      pagosDe = storedPagosDe;
      periodLabel = PERIOD_LABEL[frequency];
    } else if (numPayments && financed > 0) {
      pagosDe = roundUpToFive(financed / numPayments);
      periodLabel = PERIOD_LABEL[frequency];
    }
  }

  // How far behind the plan the customer is. paid = enganche + abonos, since
  // saldo promo starts at preciopromocion - enganche and each abono lowers it.
  let tiempoAtrasado = 0;
  let cantidadAtrasada = 0;
  if (isCredit && !settled) {
    const paid = Math.max(0, precioPromo - saldoPromo);
    if (frequency === 'Al terminar') {
      // No installments: the whole remaining saldo is late once past due.
      if (daysPastDue !== null && daysPastDue > 0) {
        cantidadAtrasada = saldoPromo;
      }
    } else if (pagosDe && pagosDe > 0 && fechaCompra) {
      const numPayments = getNumberOfPayments(sale) || 0;
      const periodDays = PERIOD_DAYS[frequency || 'Semanal'];
      const periodsElapsed = Math.min(
        Math.max(0, Math.floor(daysBetween(fechaCompra, now) / periodDays)),
        numPayments,
      );
      const expected = Math.min(enganche + periodsElapsed * pagosDe, precioPromo);
      cantidadAtrasada =
        Math.round(Math.min(Math.max(0, expected - paid), saldoPromo) * 100) / 100;
      tiempoAtrasado = Math.floor(cantidadAtrasada / pagosDe);
    }
  }

  // Status
  let status: SaleStatus;
  if (!isCredit || settled) {
    status = 'pagada';
  } else if (daysPastDue !== null && daysPastDue > 0) {
    status = 'vencida';
  } else if (tiempoAtrasado >= 1) {
    status = 'atrasada';
  } else {
    status = 'a_tiempo';
  }

  return {
    isCredit,
    status,
    frequency,
    pagosDe,
    periodLabel,
    tiempoAtrasado,
    cantidadAtrasada,
    promoActive,
    daysPastDue,
    surchargePct,
    saldoNormalConRecargo,
  };
}
