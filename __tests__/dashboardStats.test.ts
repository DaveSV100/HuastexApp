// KPI math for the Dashboard: branch filtering (slug-normalized), today vs
// month windows, income/outcome sums and the receivables (por cobrar) total.
import {
  computeDashboardStats,
  branchSlug,
  formatMoney,
  compactMoney,
  incomeLastDays,
  netoLastMonths,
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
