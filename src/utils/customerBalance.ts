// src/utils/customerBalance.ts
// What a customer sees about one of their orders in "Mis Pedidos": the
// balance that applies to them right now, explained in plain words. Built on
// the same rules staff see (paymentStatus.ts): the promo price stops
// applying 15 days after fecha de vencimiento (unless re-enabled with
// "Habilitar PP"), and from then on only the saldo precio normal — with the
// late surcharge — is owed.
import { getPaymentInfo, PaymentInfo } from './paymentStatus';

export type CustomerBalanceMode = 'paid' | 'promo' | 'normal';

export interface CustomerBalanceView {
  mode: CustomerBalanceMode;
  info: PaymentInfo;
  /** Main amount owed (promo saldo, or normal saldo once the promo is gone). */
  amountDue: number;
  /** Secondary, smaller amount: the saldo precio normal while promo applies. */
  saldoNormal: number;
  /** Last day the promo price can still be paid (fecha de vencimiento + 15). */
  promoDeadline: Date | null;
}

const PROMO_GRACE_DAYS = 15;

const num = (v: unknown): number => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

export function getCustomerBalanceView(sale: any, now: Date = new Date()): CustomerBalanceView {
  const info = getPaymentInfo(sale, now);
  const vencimiento = sale?.fechavencimiento ? new Date(sale.fechavencimiento) : null;
  const promoDeadline =
    vencimiento && !isNaN(vencimiento.getTime())
      ? new Date(vencimiento.getTime() + PROMO_GRACE_DAYS * 24 * 60 * 60 * 1000)
      : null;
  const saldoNormal = num(sale?.saldo_precio_normal);

  let mode: CustomerBalanceMode;
  if (!info.isCredit || info.status === 'pagada') mode = 'paid';
  else if (info.promoActive) mode = 'promo';
  else mode = 'normal';

  const amountDue =
    mode === 'paid'
      ? 0
      : mode === 'promo'
      ? num(sale?.saldo_precio_promocion)
      : info.saldoNormalConRecargo;

  return { mode, info, amountDue, saldoNormal, promoDeadline };
}

/** $12,345.60 — thousands separators without relying on Intl. */
export function formatMoney(n: number): string {
  const [int, dec] = Math.abs(n).toFixed(2).split('.');
  return `${n < 0 ? '-' : ''}$${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`;
}

/** dd/mm/yyyy in UTC (the DB stores plain dates). */
export function formatDateDMY(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getUTCFullYear()}`;
}
