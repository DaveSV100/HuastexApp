// src/utils/cambio.ts
// Cash change math for the cashier: how much to hand back when the customer
// pays with more than the amount due. Display-only — nothing is stored.

export interface CambioResult {
  /** Change to hand back (0 when paying exactly). */
  cambio: number;
  /** Still missing when the customer hands over less than the amount. */
  faltan: number;
}

const toCents = (n: number) => Math.round(n * 100);

/** null until both amounts are known (amount > 0 and a "paga con" typed). */
export function getCambio(amount: number, pagaCon: number): CambioResult | null {
  if (!(amount > 0) || !(pagaCon > 0)) return null;
  const diff = toCents(pagaCon) - toCents(amount);
  return {
    cambio: diff > 0 ? diff / 100 : 0,
    faltan: diff < 0 ? -diff / 100 : 0,
  };
}

/**
 * Quick-pick amounts a customer is likely to hand over: the amount rounded
 * up to the next $50 / $100 / $500 / $1,000 (no duplicates, never the
 * exact amount — that's the separate "Exacto" button), at most `max` of them.
 */
export function suggestCashAmounts(amount: number, max = 4): number[] {
  if (!(amount > 0)) return [];
  const out: number[] = [];
  // No $200 step: it suggests odd amounts (e.g. $600 for a $500 charge).
  for (const step of [50, 100, 500, 1000]) {
    const v = Math.ceil(toCents(amount) / (step * 100)) * step;
    if (toCents(v) > toCents(amount) && !out.includes(v)) out.push(v);
  }
  return out.sort((a, b) => a - b).slice(0, max);
}
