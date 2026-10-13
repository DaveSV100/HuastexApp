// KPI math for the Dashboard: branch filtering (slug-normalized), today vs
// month windows, income/outcome sums and the receivables (por cobrar) total.
import {
  computeDashboardStats,
  branchSlug,
  formatMoney,
  compactMoney,
  incomeLastDays,
  netoLastMonths,
  incomeLastMonths,
  monthWindowKeys,
  expensesWindow,
  shiftMonthKey,
  monthKeyOf,
  monthTitle,
  DASHBOARD_BRANCHES,
} from '../src/utils/dashboardStats';

const TODAY = '2026-06-11';

const sales = [
  // today, Aquismon, credit with saldo pending
  {
    id: 1,
    sucursal: 'aquismon',
    fecha: '2026-06-11T00:00:00.000Z',
    preciopromocion: '2670.00',
    saldo_precio_promocion: '2445.00',
  },
  // earlier this month, branch stored as display name
  {
    id: 2,
    sucursal: 'Cerro Azul',
    fecha: '2026-06-02',
    preciopromocion: '695.00',
    saldo_precio_promocion: '0.00',
  },
  // last month — must not count toward this month
  {
    id: 3,
    sucursal: 'aquismon',
    fecha: '2026-05-20',
    preciopromocion: '1000.00',
    saldo_precio_promocion: '500.00',
  },
];

const transactions = [
  {
    transaction_type: 'income',
    value: '225.00',
    transaction_date: '2026-06-11T00:00:00.000Z',
    location: 'aquismon',
  },
  {
    transaction_type: 'outcome',
    value: '100.00',
    transaction_date: '2026-06-11',
    location: 'aquismon',
  },
  {
    transaction_type: 'income',
    value: '695.00',
    transaction_date: '2026-06-02',
    location: 'cerroazul',
  },
  {
    transaction_type: 'income',
    value: '50.00',
    transaction_date: '2026-05-31',
    location: 'aquismon',
  },
];

describe('branchSlug', () => {
  it('normalizes display names to slugs', () => {
    expect(branchSlug('Cerro Azul')).toBe('cerroazul');
    expect(branchSlug('aquismon')).toBe('aquismon');
    expect(branchSlug(null)).toBe('');
  });
});

describe('computeDashboardStats', () => {
  it('computes today and month windows across all branches', () => {
    const s = computeDashboardStats(sales, transactions, 'all', TODAY);
    expect(s.ventasHoy).toEqual({ count: 1, total: 2670 });
    expect(s.ventasMes).toEqual({ count: 2, total: 3365 });
    expect(s.ingresosHoy).toBe(225);
    expect(s.egresosHoy).toBe(100);
    expect(s.netoHoy).toBe(125);
    expect(s.ingresosMes).toBe(920); // 225 + 695, May excluded
    expect(s.netoMes).toBe(820);
    expect(s.porCobrar).toEqual({ count: 2, total: 2945 });
  });

  it('filters to a single branch, matching display-name sucursales', () => {
    const s = computeDashboardStats(sales, transactions, 'cerroazul', TODAY);
    expect(s.ventasHoy.count).toBe(0);
    expect(s.ventasMes).toEqual({ count: 1, total: 695 });
    expect(s.ingresosMes).toBe(695);
    expect(s.porCobrar.count).toBe(0);
    expect(s.porSucursal).toEqual([]); // breakdown only for "all"
  });

  it('builds the per-branch month breakdown for "all"', () => {
    const s = computeDashboardStats(sales, transactions, 'all', TODAY);
    const aquismon = s.porSucursal.find(r => r.branch === 'aquismon');
    const cerroazul = s.porSucursal.find(r => r.branch === 'cerroazul');
    expect(aquismon).toEqual({ branch: 'aquismon', ventas: 1, ingresos: 225 });
    expect(cerroazul).toEqual({ branch: 'cerroazul', ventas: 1, ingresos: 695 });
    expect(s.porSucursal).toHaveLength(4);
  });

  it('tolerates empty/garbage input', () => {
    const s = computeDashboardStats(
      [null, { id: 9 }] as any,
      undefined as any,
      'all',
      TODAY,
    );
    expect(s.ventasHoy.count).toBe(0);
    expect(s.ingresosMes).toBe(0);
  });
});

describe('formatMoney', () => {
  it('groups thousands and keeps two decimals', () => {
    expect(formatMoney(12345.6)).toBe('$12,345.60');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(-950)).toBe('-$950.00');
  });
});

describe('compactMoney', () => {
  it('keeps small amounts plain and k-abbreviates thousands', () => {
    expect(compactMoney(950)).toBe('$950');
    expect(compactMoney(12345)).toBe('$12.3k');
    expect(compactMoney(123456)).toBe('$123k');
    expect(compactMoney(0)).toBe('$0');
  });
});

describe('incomeLastDays', () => {
  it('returns one entry per day, oldest first, summing branch incomes', () => {
    const days = incomeLastDays(transactions, 'all', TODAY, 7);
    expect(days).toHaveLength(7);
    expect(days[6].day).toBe('2026-06-11'); // today last
    expect(days[6].total).toBe(225); // outcome rows excluded
    expect(days[0].day).toBe('2026-06-05');
    const june2 = days.find(d => d.day === '2026-06-02');
    expect(june2).toBeUndefined(); // outside the 7-day window
    expect(days.every(d => typeof d.label === 'string' && d.label.length >= 3)).toBe(true);
  });

  it('filters by branch and crosses month boundaries', () => {
    const days = incomeLastDays(transactions, 'aquismon', '2026-06-03', 7);
    expect(days[0].day).toBe('2026-05-28'); // window reaches back into May
    const may31 = days.find(d => d.day === '2026-05-31');
    expect(may31?.total).toBe(50);
    const june2 = days.find(d => d.day === '2026-06-02');
    expect(june2?.total).toBe(0); // cerroazul income filtered out
  });
});

describe('netoLastMonths', () => {
  it('returns one entry per month, oldest first, with income − outcome', () => {
    const result = netoLastMonths(transactions, 'all', TODAY);
    expect(result).toHaveLength(6);
    expect(result.map(r => r.month)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
    ]);
    expect(result.map(r => r.label)).toEqual([
      'ene',
      'feb',
      'mar',
      'abr',
      'may',
      'jun',
    ]);
    expect(result[5].total).toBe(820); // 225 + 695 − 100
    expect(result[4].total).toBe(50);
    expect(result[0].total).toBe(0);
  });

  it('crosses year boundaries and marks past-year labels', () => {
    const result = netoLastMonths(transactions, 'all', '2026-02-15');
    expect(result[0].month).toBe('2025-09');
    expect(result[0].label).toBe("sep '25");
    expect(result[5].month).toBe('2026-02');
    expect(result[5].label).toBe('feb');
  });

  it('filters by branch', () => {
    const result = netoLastMonths(transactions, 'cerroazul', TODAY);
    expect(result[5].total).toBe(695); // only the cerroazul income
    expect(result[4].total).toBe(0); // aquismon May income excluded
  });

  it('goes negative when outcomes exceed incomes and ignores other types', () => {
    const tx = [
      {
        transaction_type: 'income',
        value: '100.00',
        transaction_date: '2026-06-05',
        location: 'aquismon',
      },
      {
        transaction_type: 'outcome',
        value: '350.00',
        transaction_date: '2026-06-08',
        location: 'aquismon',
      },
      {
        transaction_type: 'transfer',
        value: '999.00',
        transaction_date: '2026-06-09',
        location: 'aquismon',
      },
    ];
    const result = netoLastMonths(tx, 'all', TODAY);
    expect(result[5].total).toBe(-250);
  });

  it('tolerates empty input', () => {
    const result = netoLastMonths(undefined as any, 'all', TODAY, 3);
    expect(result).toHaveLength(3);
    expect(result.every(r => r.total === 0)).toBe(true);
  });
});

// The month picker: every month-level section is anchored to a chosen
// YYYY-MM instead of "now", so a figure from a year back is readable without
// the "Hoy"/7-day sections leaving today.
describe('month anchoring', () => {
  describe('monthWindowKeys', () => {
    it('returns the count months ending at the anchor, oldest first', () => {
      expect(monthWindowKeys('2025-09', 6)).toEqual([
        '2025-04',
        '2025-05',
        '2025-06',
        '2025-07',
        '2025-08',
        '2025-09',
      ]);
    });

    it('crosses the year boundary backwards', () => {
      expect(monthWindowKeys('2026-02', 4)).toEqual([
        '2025-11',
        '2025-12',
        '2026-01',
        '2026-02',
      ]);
    });
  });

  describe('shiftMonthKey', () => {
    it('steps across year boundaries in both directions', () => {
      expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
      expect(shiftMonthKey('2025-12', 1)).toBe('2026-01');
      expect(shiftMonthKey('2026-09', -12)).toBe('2025-09');
    });
  });

  it('monthKeyOf reads local time, not UTC', () => {
    // 1 Jan 00:30 local is still 2026-01 even where UTC has rolled back a day.
    expect(monthKeyOf(new Date(2026, 0, 1, 0, 30))).toBe('2026-01');
    expect(monthKeyOf(new Date(2025, 8, 15))).toBe('2025-09');
  });

  it('monthTitle spells the month out for the picker', () => {
    expect(monthTitle('2025-09')).toBe('Septiembre 2025');
  });

  describe('computeDashboardStats with an explicit monthKey', () => {
    it('moves the month figures while leaving today alone', () => {
      const stats = computeDashboardStats(
        sales,
        transactions,
        'all',
        TODAY,
        DASHBOARD_BRANCHES,
        '2026-05',
      );
      // Sale 3 is the only May row; today's numbers still come from TODAY.
      expect(stats.ventasMes.count).toBe(1);
      expect(stats.ventasMes.total).toBe(1000);
      expect(stats.ventasHoy.count).toBe(1);
    });

    it('defaults to todayIso month when omitted', () => {
      const withKey = computeDashboardStats(
        sales,
        transactions,
        'all',
        TODAY,
        DASHBOARD_BRANCHES,
        '2026-06',
      );
      const without = computeDashboardStats(sales, transactions, 'all', TODAY);
      expect(withKey.ventasMes).toEqual(without.ventasMes);
      expect(withKey.porSucursal).toEqual(without.porSucursal);
    });
  });

  describe('netoLastMonths / incomeLastMonths anchored in the past', () => {
    const tx = [
      {
        transaction_type: 'income',
        value: '800.00',
        transaction_date: '2025-09-04',
        location: 'aquismon',
      },
      {
        transaction_type: 'outcome',
        value: '300.00',
        transaction_date: '2025-09-20',
        location: 'aquismon',
      },
      {
        transaction_type: 'income',
        value: '999.00',
        transaction_date: '2026-06-01',
        location: 'aquismon',
      },
    ];

    it('ends the window at the anchor month, not today', () => {
      const result = netoLastMonths(tx, 'all', '2025-09-01', 6, TODAY);
      expect(result).toHaveLength(6);
      expect(result[5].month).toBe('2025-09');
      expect(result[5].total).toBe(500);
      // June 2026 is outside the window even though it has data.
      expect(result.some(r => r.month === '2026-06')).toBe(false);
    });

    it("labels by the real current year, so a past window keeps its 'YY", () => {
      const result = netoLastMonths(tx, 'all', '2025-09-01', 6, TODAY);
      expect(result[5].label).toBe("sep '25");
    });

    it('incomeLastMonths anchors the same way and ignores outcomes', () => {
      const result = incomeLastMonths(tx, 'all', '2025-09-01', 6, TODAY);
      expect(result[5].month).toBe('2025-09');
      expect(result[5].total).toBe(800);
    });

    it('stays backward compatible when no anchor is passed', () => {
      const anchored = netoLastMonths(tx, 'all', TODAY, 6, TODAY);
      const legacy = netoLastMonths(tx, 'all', TODAY);
      expect(anchored).toEqual(legacy);
    });
  });

  describe('expensesWindow', () => {
    // The server only ever sends a window trailing today, oldest first.
    const serverMonths = [
      { month: '2025-08', total: 10, byBranch: { aquismon: 10 } },
      { month: '2025-09', total: 20, byBranch: { aquismon: 20 } },
      { month: '2025-10', total: 30, byBranch: { aquismon: 30 } },
    ];

    it('slices to the months ending at the anchor', () => {
      const result = expensesWindow(serverMonths, '2025-09', 2);
      expect(result.map(m => m.month)).toEqual(['2025-08', '2025-09']);
      expect(result[1].total).toBe(20);
    });

    it('zero-fills months the server did not cover', () => {
      const result = expensesWindow(serverMonths, '2025-09', 4);
      expect(result.map(m => m.month)).toEqual([
        '2025-06',
        '2025-07',
        '2025-08',
        '2025-09',
      ]);
      expect(result[0]).toEqual({ month: '2025-06', total: 0, byBranch: {} });
    });

    it('tolerates an empty response', () => {
      const result = expensesWindow([], '2025-09', 3);
      expect(result).toHaveLength(3);
      expect(result.every(m => m.total === 0)).toBe(true);
    });
  });
});
