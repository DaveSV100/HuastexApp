// What a customer sees about each order in "Mis Pedidos".
import {
  getCustomerBalanceView,
  formatMoney,
  formatDateDMY,
} from '../src/utils/customerBalance';

const NOW = new Date('2026-10-07T12:00:00Z');

const credit = {
  formadepago: 'Crédito',
  preciopromocion: '8500.00',
  precionormal: '9520.00',
  enganche: '1000.00',
  saldo_precio_promocion: '5100.00',
  saldo_precio_normal: '6120.00',
  fecha: '2026-08-20T00:00:00.000Z',
  fechavencimiento: '2027-01-07T00:00:00.000Z',
  plazo: { value: '20', unit: 'weeks' },
  payment_frequency: 'Semanal',
};

describe('getCustomerBalanceView', () => {
  it('shows the promo saldo while the promo applies', () => {
    const v = getCustomerBalanceView(credit, NOW);
    expect(v.mode).toBe('promo');
    expect(v.amountDue).toBe(5100);
    expect(v.saldoNormal).toBe(6120);
    // fecha de vencimiento + 15 days
    expect(formatDateDMY(v.promoDeadline)).toBe('22/01/2027');
  });

  it('switches to the saldo normal (with surcharge) once the promo expired', () => {
    const expired = {
      ...credit,
      saldo_precio_promocion: '1500.00',
      saldo_precio_normal: '1860.00',
      fechavencimiento: '2026-06-29T00:00:00.000Z',
    };
    const v = getCustomerBalanceView(expired, NOW);
    expect(v.mode).toBe('normal');
    // 3 full months past due → +12%
    expect(v.info.surchargePct).toBe(12);
    expect(v.amountDue).toBeCloseTo(2083.2, 2);
  });

  it('keeps the promo when staff re-enabled it ("Habilitar PP")', () => {
    const v = getCustomerBalanceView(
      { ...credit, fechavencimiento: '2026-06-29T00:00:00.000Z', pp_enabled: true },
      NOW,
    );
    expect(v.mode).toBe('promo');
  });

  it('is paid for contado sales and settled credits', () => {
    expect(getCustomerBalanceView({ formadepago: 'Contado' }, NOW).mode).toBe('paid');
    expect(
      getCustomerBalanceView({ ...credit, saldo_precio_promocion: '0.00' }, NOW).mode,
    ).toBe('paid');
  });
});

describe('formatMoney', () => {
  it('adds thousands separators and cents', () => {
    expect(formatMoney(2083.2)).toBe('$2,083.20');
    expect(formatMoney(1234567)).toBe('$1,234,567.00');
    expect(formatMoney(0)).toBe('$0.00');
  });
});
