// Payment-plan math for credit sales: installment size ("Pagos de"), how far
// behind the customer is, vencida/atrasada/a tiempo/pagada status, the 15-day
// promo window ("Habilitar PP" override) and the 6%-per-month late surcharge.
import {
  getPaymentInfo,
  getFrequency,
  getNumberOfPayments,
  parsePlazo,
  roundUpToFive,
} from '../src/utils/paymentStatus';

// Fixed "today" so results never drift: July 6, 2026.
const NOW = new Date('2026-07-06T12:00:00Z');

// Credit sale: $10,000 promo, $2,000 enganche, 40 weeks, bought Jan 5 2026,
// due Oct 12 2026 (40 weeks later). Installments: 8000 / 40 = $200/week.
const baseSale = {
  formadepago: 'Crédito',
  preciopromocion: '10000.00',
  precionormal: '11200.00',
  enganche: '2000.00',
  saldo_precio_promocion: '8000.00',
  saldo_precio_normal: '9200.00',
  fecha: '2026-01-05T00:00:00.000Z',
  fechavencimiento: '2026-10-12T00:00:00.000Z',
  plazo: { value: '40', unit: 'weeks' },
  payment_frequency: 'Semanal',
};

describe('parsePlazo', () => {
  it('handles every shape the API has returned', () => {
    expect(parsePlazo({ value: '40', unit: 'weeks' })).toEqual({ value: 40, unit: 'weeks' });
    expect(parsePlazo('40 weeks')).toEqual({ value: 40, unit: 'weeks' });
    expect(parsePlazo('{"value":"15","unit":"months"}')).toEqual({ value: 15, unit: 'months' });
    expect(
      parsePlazo({ value: '{"value":"12","unit":"months"}', unit: 'weeks' }),
    ).toEqual({ value: 12, unit: 'months' });
    expect(parsePlazo(null)).toBeNull();
    expect(parsePlazo({ value: '', unit: 'weeks' })).toBeNull();
  });
});

describe('frequency and number of payments', () => {
  it('uses the saved frequency and converts the plazo', () => {
    expect(getNumberOfPayments(baseSale)).toBe(40); // semanal
    expect(getNumberOfPayments({ ...baseSale, payment_frequency: 'Quincenal' })).toBe(20);
    expect(getNumberOfPayments({ ...baseSale, payment_frequency: 'Mensual' })).toBe(10);
  });

  it('derives a frequency from the plazo unit for older sales', () => {
    expect(getFrequency({ ...baseSale, payment_frequency: null })).toBe('Semanal');
    expect(
      getFrequency({ ...baseSale, payment_frequency: null, plazo: { value: '10', unit: 'months' } }),
    ).toBe('Mensual');
  });
});

describe('pagos de', () => {
  it('divides the financed promo price by the installment count', () => {
    // (10000 - 2000) / 40 semanas
    expect(getPaymentInfo(baseSale, NOW).pagosDe).toBe(200);
    // (10000 - 2000) / 10 meses
    expect(getPaymentInfo({ ...baseSale, payment_frequency: 'Mensual' }, NOW).pagosDe).toBe(800);
    // (10000 - 2000) / 20 quincenas
    expect(getPaymentInfo({ ...baseSale, payment_frequency: 'Quincenal' }, NOW).pagosDe).toBe(400);
  });

  it('rounds installments UP to the next multiple of 5 (end in 0 or 5)', () => {
    // Owner's examples: $204.09 → $205, $183 → $185 (never down to $180).
    expect(roundUpToFive(204.09)).toBe(205);
    expect(roundUpToFive(183)).toBe(185);
    // Exact multiples stay put, float noise doesn't bump them up.
    expect(roundUpToFive(200)).toBe(200);
    expect(roundUpToFive(200.0000000003)).toBe(200);
    // Real sale shape: (4890 - 400) / 22 semanas = 204.09... → 205.
    const sale = {
      ...baseSale,
      preciopromocion: '4890.00',
      enganche: '400.00',
      saldo_precio_promocion: '4490.00',
      plazo: { value: '22', unit: 'weeks' },
    };
    expect(getPaymentInfo(sale, NOW).pagosDe).toBe(205);
  });

  it('"Al terminar" shows the remaining promo saldo', () => {
    const info = getPaymentInfo(
      { ...baseSale, payment_frequency: 'Al terminar', saldo_precio_promocion: '5500.00' },
      NOW,
    );
    expect(info.pagosDe).toBe(5500);
    expect(info.periodLabel).toBeNull();
  });
});

describe('estado', () => {
  it('contado sales are pagadas', () => {
    const info = getPaymentInfo(
      { formadepago: 'Contado', saldo_precio_promocion: '0.00', saldo_precio_normal: '0.00' },
      NOW,
    );
    expect(info.status).toBe('pagada');
    expect(info.isCredit).toBe(false);
  });

  it('a liquidated account past its due date is pagada, never vencida', () => {
    // Owner rule: saldo promo ≤ 0 = paid, even months past the due date and
    // with a leftover saldo normal in the DB. No surcharge, promo stays.
    const info = getPaymentInfo(
      {
        ...baseSale,
        saldo_precio_promocion: '0.00',
        saldo_precio_normal: '1200.00',
        fechavencimiento: '2026-03-01T00:00:00.000Z',
      },
      NOW,
    );
    expect(info.status).toBe('pagada');
    expect(info.promoActive).toBe(true);
    expect(info.surchargePct).toBe(0);
  });

  it('credit sale with promo saldo liquidated is pagada', () => {
    const info = getPaymentInfo({ ...baseSale, saldo_precio_promocion: '0.00' }, NOW);
    expect(info.status).toBe('pagada');
  });

  it('past the due date is vencida', () => {
    const info = getPaymentInfo(
      { ...baseSale, fechavencimiento: '2026-06-20T00:00:00.000Z' },
      NOW,
    );
    expect(info.status).toBe('vencida');
  });

  it('behind on installments but not past due is atrasada', () => {
    // 26 weeks elapsed (Jan 5 → Jul 6) → expected 2000 + 26*200 = 7200.
    // Paid only the enganche (saldo still 8000) → 5200 behind, 26 weeks late.
    const info = getPaymentInfo(baseSale, NOW);
    expect(info.status).toBe('atrasada');
    expect(info.tiempoAtrasado).toBe(26);
    expect(info.cantidadAtrasada).toBe(5200);
  });

  it('behind by LESS than one full payment keeps the a_tiempo icon but still reports the amount', () => {
    // Owner's rule: if the payment is $200 and the customer is only $180
    // behind, don't flag atrasada (no late icon yet) — but the cantidad
    // atrasada amount must still be there for the UI to show.
    // 26 weeks elapsed → expected 2000 + 26*200 = 7200; paid 7020 → 180 short.
    const info = getPaymentInfo(
      { ...baseSale, saldo_precio_promocion: '2980.00' },
      NOW,
    );
    expect(info.status).toBe('a_tiempo');
    expect(info.tiempoAtrasado).toBe(0);
    expect(info.cantidadAtrasada).toBe(180);
  });

  it('keeping up with the plan is a_tiempo', () => {
    // Paid enganche + 26 installments: saldo = 8000 - 5200 = 2800.
    const info = getPaymentInfo({ ...baseSale, saldo_precio_promocion: '2800.00' }, NOW);
    expect(info.status).toBe('a_tiempo');
    expect(info.tiempoAtrasado).toBe(0);
    expect(info.cantidadAtrasada).toBe(0);
  });
});

describe('promo window (Habilitar PP)', () => {
  it('promo stays active up to 15 days past due', () => {
    const info = getPaymentInfo(
      { ...baseSale, fechavencimiento: '2026-06-25T00:00:00.000Z' }, // 11 days late
      NOW,
    );
    expect(info.promoActive).toBe(true);
  });

  it('promo drops after 15 days past due', () => {
    const info = getPaymentInfo(
      { ...baseSale, fechavencimiento: '2026-06-01T00:00:00.000Z' }, // 35 days late
      NOW,
    );
    expect(info.promoActive).toBe(false);
  });

  it('pp_enabled=true restores the promo manually', () => {
    const info = getPaymentInfo(
      { ...baseSale, fechavencimiento: '2026-06-01T00:00:00.000Z', pp_enabled: true },
      NOW,
    );
    expect(info.promoActive).toBe(true);
  });
});

describe('6% monthly surcharge on saldo normal', () => {
  it('no surcharge under two full months past due', () => {
    const info = getPaymentInfo(
      { ...baseSale, fechavencimiento: '2026-05-20T00:00:00.000Z' }, // 1.5 months
      NOW,
    );
    expect(info.surchargePct).toBe(0);
    expect(info.saldoNormalConRecargo).toBe(9200);
  });

  it('adds 6% at two full months and 6% per extra month', () => {
    const twoMonths = getPaymentInfo(
      { ...baseSale, fechavencimiento: '2026-05-01T00:00:00.000Z' },
      NOW,
    );
    expect(twoMonths.surchargePct).toBe(6);
    expect(twoMonths.saldoNormalConRecargo).toBe(9752); // 9200 * 1.06

    const fourMonths = getPaymentInfo(
      { ...baseSale, fechavencimiento: '2026-03-01T00:00:00.000Z' },
      NOW,
    );
    expect(fourMonths.surchargePct).toBe(18); // months 2,3,4 → 3 × 6%
    expect(fourMonths.saldoNormalConRecargo).toBe(10856); // 9200 * 1.18
  });
});
