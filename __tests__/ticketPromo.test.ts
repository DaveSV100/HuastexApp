// Promo rule on receipts: once the promo window is gone (>15 days past due,
// no pp_enabled) the ticket model must drop every promo price and show the
// normal price with the late surcharge baked in.
import { deriveTicketModel } from '../src/utils/ticketFormat';

const NOW = new Date('2026-07-06T12:00:00Z');

const sale = {
  id: 900,
  nombre: 'Cliente Moroso',
  fecha: '2025-11-01T00:00:00.000Z',
  formadepago: 'Crédito',
  enganche: '400.00',
  precionormal: '5480.00',
  preciopromocion: '4890.00',
  saldo_precio_normal: '5080.00',
  saldo_precio_promocion: '4490.00',
  // 4 full months past NOW → surcharge 6% × (4-1) = 18%.
  fechavencimiento: '2026-03-06T00:00:00.000Z',
  plazo: { value: '18', unit: 'weeks' },
  payment_frequency: 'Semanal',
  products: [{ title: 'Celular', quantity: 1, unit_price: 4890 }],
};

describe('deriveTicketModel promo window', () => {
  it('keeps promo pricing while the promo is active', () => {
    const m = deriveTicketModel({ ...sale, pp_enabled: true }, null, NOW);
    expect(m.promoActive).toBe(true);
    expect(m.surchargePct).toBe(0);
    expect(m.total).toBe('4890.00');
    expect(m.saldoNormal).toBe('5080.00');
    expect(m.saldoPromo).toBe('4490.00');
  });

  it('switches to normal price + interest when the promo is gone', () => {
    const m = deriveTicketModel(sale, null, NOW);
    expect(m.promoActive).toBe(false);
    expect(m.surchargePct).toBe(18);
    // Total = precio normal with the surcharge, not the promo price.
    expect(m.total).toBe((5480 * 1.18).toFixed(2));
    expect(m.saldoNormal).toBe((5080 * 1.18).toFixed(2));
  });

  it('a paid account keeps promo pricing and stamps PAGADO', () => {
    // Same overdue sale but liquidated: no surcharge, promo prices stay,
    // and every ticket variant carries the PAGADO stamp.
    const m = deriveTicketModel(
      { ...sale, saldo_precio_promocion: '0.00' },
      null,
      NOW,
    );
    expect(m.paid).toBe(true);
    expect(m.promoActive).toBe(true);
    expect(m.surchargePct).toBe(0);
    expect(m.total).toBe('4890.00');
  });

  it('an unpaid overdue account is not stamped PAGADO', () => {
    expect(deriveTicketModel(sale, null, NOW).paid).toBe(false);
  });

  it('never applies the rule to non-credit sales', () => {
    const m = deriveTicketModel(
      { ...sale, formadepago: 'Contado', fechavencimiento: null },
      null,
      NOW,
    );
    expect(m.promoActive).toBe(true);
    expect(m.total).toBe('4890.00');
  });
});
