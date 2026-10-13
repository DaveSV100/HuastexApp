// Cash change helper ("Paga con" → "Cambio a entregar").
import { getCambio, suggestCashAmounts } from '../src/utils/cambio';

describe('getCambio', () => {
  it('returns the change when paying with more', () => {
    expect(getCambio(375, 500)).toEqual({ cambio: 125, faltan: 0 });
  });

  it('is exact to the cent (no float noise)', () => {
    expect(getCambio(0.3, 1)).toEqual({ cambio: 0.7, faltan: 0 });
    expect(getCambio(199.9, 200)).toEqual({ cambio: 0.1, faltan: 0 });
  });

  it('reports what is missing when paying with less', () => {
    expect(getCambio(500, 450)).toEqual({ cambio: 0, faltan: 50 });
  });

  it('is zero change when paying exactly', () => {
    expect(getCambio(250, 250)).toEqual({ cambio: 0, faltan: 0 });
  });

  it('is null until both amounts are known', () => {
    expect(getCambio(0, 500)).toBeNull();
    expect(getCambio(375, NaN)).toBeNull();
    expect(getCambio(375, 0)).toBeNull();
  });
});

describe('suggestCashAmounts', () => {
  it('rounds up to common bills without repeating', () => {
    expect(suggestCashAmounts(375)).toEqual([400, 500, 1000]);
    expect(suggestCashAmounts(1820)).toEqual([1850, 1900, 2000]);
  });

  it('never suggests the exact amount (that is "Exacto")', () => {
    expect(suggestCashAmounts(500)).toEqual([1000]);
    expect(suggestCashAmounts(1000)).toEqual([]);
  });

  it('is empty without an amount', () => {
    expect(suggestCashAmounts(0)).toEqual([]);
  });
});
