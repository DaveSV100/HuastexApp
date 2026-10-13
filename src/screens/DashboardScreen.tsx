// src/screens/DashboardScreen.tsx
// KPI overview for back-office roles: today's and this month's sales and
// cash movement, receivables, and a per-branch month breakdown. Data comes
// from the same endpoints the Sales and Daily Report screens already use
// (/sales and /transactions); all math lives in utils/dashboardStats.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import api from '../api';
import {
  computeDashboardStats,
  incomeLastDays,
  netoLastMonths,
  incomeLastMonths,
  expensesSeries,
  expensesWindow,
  ExpensesMonth,
  branchSlug,
  formatMoney,
  compactMoney,
  monthTitle,
  monthShortName,
  monthKeyOf,
  shiftMonthKey,
  DASHBOARD_BRANCHES,
} from '../utils/dashboardStats';

const BackImg = require('../../Assets/back.png');

const BRANCH_LABELS: Record<string, string> = {
  all: 'Todas',
  aquismon: 'Aquismón',
  cerroazul: 'Cerro Azul',
  tepetzintla: 'Tepetzintla',
  tlacolula: 'Tlacolula',
};

function getLocalDateString(date: Date = new Date()) {
  const y = date.getFullYear();
  const m = ('0' + (date.getMonth() + 1)).slice(-2);
  const d = ('0' + date.getDate()).slice(-2);
  return `${y}-${m}-${d}`;
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
      {sub ? <Text style={styles.cardSub}>{sub}</Text> : null}
    </View>
  );
}

const CHART_MAX_BAR = 90;

/** One column of the pure-View bar chart (no chart library needed). */
function ChartBar({
  label,
  total,
  max,
  red,
}: {
  label: string;
  total: number;
  max: number;
  red?: boolean;
}) {
  const barStyle = {
    height: Math.max(max > 0 ? (total / max) * CHART_MAX_BAR : 0, 2),
  };
  return (
    <View style={styles.chartCol}>
      <Text style={styles.chartValue}>{total > 0 ? compactMoney(total) : ''}</Text>
      <View style={[styles.chartBar, red && styles.chartBarRed, barStyle]} />
      <Text style={styles.chartDay}>{label}</Text>
    </View>
  );
}

/** Inline spinner shown while a section's data is still on its way. */
function SectionLoading() {
  return (
    <View style={styles.sectionLoading}>
      <ActivityIndicator size="small" color="#007bff" />
    </View>
  );
}

/**
 * Column for the monthly neto chart. Unlike ChartBar, values can be negative,
 * so every column carries a positive zone, the zero axis, and (when any month
 * is negative) a zone below it; zone heights are shared so the axis lines up.
 */
function NetoBar({
  label,
  total,
  maxAbs,
  posZoneH,
  negZoneH,
}: {
  label: string;
  total: number;
  maxAbs: number;
  posZoneH: number;
  negZoneH: number;
}) {
  const h = Math.max(maxAbs > 0 ? (Math.abs(total) / maxAbs) * CHART_MAX_BAR : 0, 2);
  const negative = total < 0;
  return (
    <View style={styles.chartCol}>
      <Text style={styles.chartValue}>{total !== 0 ? compactMoney(total) : ''}</Text>
      <View style={[styles.netoZonePos, { height: posZoneH }]}>
        {!negative && <View style={[styles.chartBar, { height: h }]} />}
      </View>
      <View style={styles.netoAxis} />
      {negZoneH > 0 && (
        <View style={[styles.netoZoneNeg, { height: negZoneH }]}>
          {negative && <View style={[styles.chartBar, styles.netoBarNeg, { height: h }]} />}
        </View>
      )}
      <Text style={styles.chartDay}>{label}</Text>
    </View>
  );
}

/**
 * Month/year picker for the historical sections. Collapsed it is a single
 * `‹ Septiembre 2025 ›` row; tapping the label opens a year stepper + month
 * grid so a month a year back is two taps instead of twelve. Months after
 * `maxMonth` are disabled — there is no data ahead of today.
 */
function MonthPicker({
  value,
  maxMonth,
  onChange,
}: {
  value: string; // YYYY-MM
  maxMonth: string; // YYYY-MM
  onChange: (month: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(() => Number(value.slice(0, 4)));

  const maxYear = Number(maxMonth.slice(0, 4));
  const maxMonthNum = Number(maxMonth.slice(5, 7));
  const atMax = value === maxMonth;

  const openPicker = () => {
    setDraftYear(Number(value.slice(0, 4)));
    setOpen(true);
  };

  const pick = (monthNum: number) => {
    onChange(`${draftYear}-${String(monthNum).padStart(2, '0')}`);
    setOpen(false);
  };

  return (
    <View style={styles.monthRow}>
      <TouchableOpacity
        style={styles.monthNav}
        onPress={() => onChange(shiftMonthKey(value, -1))}
        accessibilityLabel="Mes anterior"
      >
        <Text style={styles.monthNavText}>‹</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.monthLabelBtn} onPress={openPicker}>
        <Text style={styles.monthLabelText}>{monthTitle(value)}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.monthNav, atMax && styles.monthNavOff]}
        disabled={atMax}
        onPress={() => onChange(shiftMonthKey(value, 1))}
        accessibilityLabel="Mes siguiente"
      >
        <Text style={[styles.monthNavText, atMax && styles.monthNavTextOff]}>
          ›
        </Text>
      </TouchableOpacity>

      {!atMax && (
        <TouchableOpacity
          style={styles.monthReset}
          onPress={() => onChange(maxMonth)}
        >
          <Text style={styles.monthResetText}>Mes actual</Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <TouchableOpacity style={styles.modalCard} activeOpacity={1}>
            <View style={styles.yearRow}>
              <TouchableOpacity
                style={styles.monthNav}
                onPress={() => setDraftYear(y => y - 1)}
                accessibilityLabel="Año anterior"
              >
                <Text style={styles.monthNavText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.yearText}>{draftYear}</Text>
              <TouchableOpacity
                style={[styles.monthNav, draftYear >= maxYear && styles.monthNavOff]}
                disabled={draftYear >= maxYear}
                onPress={() => setDraftYear(y => y + 1)}
                accessibilityLabel="Año siguiente"
              >
                <Text
                  style={[
                    styles.monthNavText,
                    draftYear >= maxYear && styles.monthNavTextOff,
                  ]}
                >
                  ›
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.monthGrid}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                const key = `${draftYear}-${String(m).padStart(2, '0')}`;
                const future = draftYear === maxYear && m > maxMonthNum;
                const selected = key === value;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.monthCell,
                      selected && styles.monthCellActive,
                      future && styles.monthCellOff,
                    ]}
                    disabled={future}
                    onPress={() => pick(m)}
                  >
                    <Text
                      style={[
                        styles.monthCellText,
                        selected && styles.monthCellTextActive,
                        future && styles.monthCellTextOff,
                      ]}
                    >
                      {monthShortName(m)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function DashboardScreen(): React.JSX.Element {
  const navigation = useNavigation();

  const [role, setRole] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState('all');
  // Month the historical sections are anchored to (YYYY-MM). Defaults to the
  // current month, so the dashboard opens exactly as it always has; picking an
  // older month re-reads the same already-downloaded data further back.
  const currentMonth = monthKeyOf();
  const [anchorMonth, setAnchorMonth] = useState(currentMonth);
  const isCurrentMonth = anchorMonth === currentMonth;
  const [sales, setSales] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [expensesMonthly, setExpensesMonthly] = useState<ExpensesMonth[]>([]);
  // Each dataset loads on its own so sections appear as their data arrives
  // (lazy) instead of the whole dashboard waiting for the slowest request.
  const [salesLoading, setSalesLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(true);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Same branch pinning as the daily report: staff/iT only see their own
  // branch, and only the reduced dashboard (Hoy + 7-day income chart);
  // admins/superadmins can pick branches and see every section.
  const isAdmin = role === 'admin' || role === 'superadmin';

  useEffect(() => {
    (async () => {
      const storedRole = await AsyncStorage.getItem('role');
      const storedBranch = (await AsyncStorage.getItem('branch')) || '';
      setRole(storedRole);
      if (storedRole === 'staff' || storedRole === 'iT') {
        // No fallback branch: an empty slug matches nothing in
        // computeDashboardStats, which beats showing another branch's numbers.
        setSelectedLocation(branchSlug(storedBranch));
      }
    })();
  }, []);

  const fetchSales = useCallback(async () => {
    try {
      const res = await api.get('/sales');
      setSales(res.data || []);
    } catch (e) {
      console.error('Error loading sales:', e);
    } finally {
      setSalesLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await api.get('/transactions');
      setTransactions(res.data || []);
    } catch (e) {
      console.error('Error loading transactions:', e);
    } finally {
      setTxLoading(false);
    }
  }, []);

  const fetchExpenses = useCallback(async () => {
    try {
      // 24 is the server's cap. Pulling the full span once (24 tiny rows) means
      // the month picker never has to refetch — expensesWindow slices it.
      const res = await api.get('/expenses/monthly', { params: { months: 24 } });
      setExpensesMonthly(res.data?.months || []);
    } catch (e) {
      console.error('Error loading expenses:', e);
    } finally {
      setExpensesLoading(false);
    }
  }, []);

  const fetchAll = useCallback(() => {
    // Fired without awaiting each other: every section renders as soon as
    // its own data lands.
    const all = Promise.allSettled([
      fetchSales(),
      fetchTransactions(),
      fetchExpenses(),
    ]);
    all.then(() => setRefreshing(false));
    return all;
  }, [fetchSales, fetchTransactions, fetchExpenses]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const today = getLocalDateString();
  // Any day in the anchored month works: the month windows only read its
  // year and month.
  const anchorIso = `${anchorMonth}-01`;

  // "Hoy" and the 7-day chart always mean the real today, whatever month is
  // picked; only the month-level sections follow the anchor.
  const stats = computeDashboardStats(
    sales,
    transactions,
    selectedLocation,
    today,
    DASHBOARD_BRANCHES,
    anchorMonth,
  );
  const weekIncome = incomeLastDays(transactions, selectedLocation, today);
  const weekMax = Math.max(...weekIncome.map(d => d.total), 0);
  const branchMax = Math.max(...stats.porSucursal.map(r => r.ingresos), 0);

  const monthlyNeto = netoLastMonths(
    transactions,
    selectedLocation,
    anchorIso,
    6,
    today,
  );
  const netoMaxPos = Math.max(...monthlyNeto.map(mn => mn.total), 0);
  const netoMaxNeg = Math.max(...monthlyNeto.map(mn => -mn.total), 0);
  const netoMaxAbs = Math.max(netoMaxPos, netoMaxNeg);
  // Shared zone heights so the zero axis is one straight line; each zone is
  // only as tall as its deepest bar (no negatives → no space below the axis).
  const netoPosZone =
    netoMaxAbs > 0 ? Math.max((netoMaxPos / netoMaxAbs) * CHART_MAX_BAR, 4) : 12;
  const netoNegZone =
    netoMaxNeg > 0 ? Math.max((netoMaxNeg / netoMaxAbs) * CHART_MAX_BAR, 4) : 0;

  // Gastos (expenses) per month for the branch selection. The server already
  // scopes byBranch for staff/iT, so projecting on selectedLocation is safe.
  const expensesAnchored = expensesWindow(expensesMonthly, anchorMonth);
  const expensesMonthlySeries = expensesSeries(
    expensesAnchored,
    selectedLocation,
    today,
  );
  const expensesMax = Math.max(...expensesMonthlySeries.map(g => g.total), 0);
  // The card above the chart reports the anchored month itself — the last
  // entry of the window, not whatever the server happened to send last.
  const currentExpensesMonth =
    expensesAnchored[expensesAnchored.length - 1] || null;
  const expensesMonthTotal = Number(currentExpensesMonth?.total) || 0;
  const expensesMonthBranch =
    selectedLocation === 'all'
      ? expensesMonthTotal
      : Number(currentExpensesMonth?.byBranch?.[selectedLocation]) || 0;

  // Ganancias = ingresos − gastos, month by month, same branch selection.
  const monthlyIncomes = incomeLastMonths(
    transactions,
    selectedLocation,
    anchorIso,
    6,
    today,
  );
  const ganancias = monthlyIncomes.map((mi, i) => ({
    month: mi.month,
    label: mi.label,
    total: mi.total - (expensesMonthlySeries[i]?.total || 0),
  }));
  const gainMaxPos = Math.max(...ganancias.map(g => g.total), 0);
  const gainMaxNeg = Math.max(...ganancias.map(g => -g.total), 0);
  const gainMaxAbs = Math.max(gainMaxPos, gainMaxNeg);
  const gainPosZone =
    gainMaxAbs > 0 ? Math.max((gainMaxPos / gainMaxAbs) * CHART_MAX_BAR, 4) : 12;
  const gainNegZone =
    gainMaxNeg > 0 ? Math.max((gainMaxNeg / gainMaxAbs) * CHART_MAX_BAR, 4) : 0;

  // The 6-month charts end at the anchor, so on a past month "últimos" would
  // be a lie — name the end month instead.
  const windowSuffix = isCurrentMonth
    ? '(últimos 6 meses)'
    : `(6 meses hasta ${monthTitle(anchorMonth)})`;

  // /expenses/monthly only reaches 24 months back. Past that, expensesWindow
  // zero-fills — which would quietly overstate "Ganancias" (ingresos − gastos)
  // rather than look broken, so say so instead of showing a confident wrong
  // number. Transactions carry no such limit: /transactions is unfiltered.
  const oldestExpenseMonth = expensesMonthly[0]?.month;
  const expensesOutOfRange =
    !expensesLoading &&
    !!oldestExpenseMonth &&
    expensesAnchored[0].month < oldestExpenseMonth;
  const expensesRangeNote = expensesOutOfRange ? (
    <Text style={styles.chartEmpty}>
      Sin datos de gastos antes de {monthTitle(oldestExpenseMonth)}.
    </Text>
  ) : null;

  return (
    <SafeAreaView style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchAll();
            }}
          />
        }
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image source={BackImg} style={styles.back} />
        </TouchableOpacity>
        <Text style={styles.title}>Dashboard</Text>

        {isAdmin ? (
          <View style={styles.chipsRow}>
            {['all', ...DASHBOARD_BRANCHES].map(loc => (
              <TouchableOpacity
                key={loc}
                style={[styles.chip, selectedLocation === loc && styles.chipActive]}
                onPress={() => setSelectedLocation(loc)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedLocation === loc && styles.chipTextActive,
                  ]}
                >
                  {BRANCH_LABELS[loc] || loc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.pinnedBranch}>
            Sucursal: {BRANCH_LABELS[selectedLocation] || selectedLocation}
          </Text>
        )}

        {/* Month/year anchor for every month-level section below. "Hoy" and
            the 7-day chart ignore it. */}
        <MonthPicker
          value={anchorMonth}
          maxMonth={currentMonth}
          onChange={setAnchorMonth}
        />

        {/* Sections render independently: each shows a small spinner until
            its own dataset arrives (lazy load). */}
        <Text style={styles.sectionTitle}>Hoy</Text>
        {salesLoading || txLoading ? (
          <SectionLoading />
        ) : (
          <View style={styles.cardsRow}>
            <Card
              label="Ventas"
              value={String(stats.ventasHoy.count)}
              sub={formatMoney(stats.ventasHoy.total)}
            />
            <Card label="Ingresos" value={formatMoney(stats.ingresosHoy)} />
            <Card label="Egresos" value={formatMoney(stats.egresosHoy)} />
            <Card label="Neto" value={formatMoney(stats.netoHoy)} />
          </View>
        )}

        {isAdmin && (
          <>
            <Text style={styles.sectionTitle}>
              {isCurrentMonth ? 'Este mes' : monthTitle(anchorMonth)}
            </Text>
            {salesLoading || txLoading ? (
              <SectionLoading />
            ) : (
              <View style={styles.cardsRow}>
                <Card
                  label="Ventas"
                  value={String(stats.ventasMes.count)}
                  sub={formatMoney(stats.ventasMes.total)}
                />
                <Card label="Ingresos" value={formatMoney(stats.ingresosMes)} />
                <Card label="Egresos" value={formatMoney(stats.egresosMes)} />
                <Card label="Neto" value={formatMoney(stats.netoMes)} />
              </View>
            )}
          </>
        )}

        <Text style={styles.sectionTitle}>Ingresos últimos 7 días</Text>
        {txLoading ? (
          <SectionLoading />
        ) : (
          <View style={styles.chartCard}>
            <View style={styles.chartRow}>
              {weekIncome.map(d => (
                <ChartBar
                  key={d.day}
                  label={d.label}
                  total={d.total}
                  max={weekMax}
                />
              ))}
            </View>
            {weekMax === 0 && (
              <Text style={styles.chartEmpty}>
                Sin ingresos en los últimos 7 días.
              </Text>
            )}
          </View>
        )}

        {/* Gastos: staff/iT see their branch figure + the all-branches total;
            admins see whatever branch (or "Todas") is selected above. */}
        <Text style={styles.sectionTitle}>
          {isCurrentMonth
            ? 'Gastos del mes'
            : `Gastos de ${monthTitle(anchorMonth)}`}
        </Text>
        {expensesLoading ? (
          <SectionLoading />
        ) : (
          <View style={styles.cardsRow}>
            {!isAdmin && (
              <Card
                label={`Gastos (${BRANCH_LABELS[selectedLocation] || selectedLocation})`}
                value={formatMoney(expensesMonthBranch)}
              />
            )}
            <Card
              label="Gastos (todas las sucursales)"
              value={formatMoney(expensesMonthTotal)}
            />
          </View>
        )}

        <Text style={styles.sectionTitle}>Gastos por mes {windowSuffix}</Text>
        {expensesLoading ? (
          <SectionLoading />
        ) : (
          <View style={styles.chartCard}>
            <View style={styles.chartRow}>
              {expensesMonthlySeries.map(g => (
                <ChartBar
                  key={g.month}
                  label={g.label}
                  total={g.total}
                  max={expensesMax}
                  red
                />
              ))}
            </View>
            {expensesMax === 0 && !expensesOutOfRange && (
              <Text style={styles.chartEmpty}>
                {isCurrentMonth
                  ? 'Sin gastos en los últimos 6 meses.'
                  : 'Sin gastos registrados en estos 6 meses.'}
              </Text>
            )}
            {expensesRangeNote}
          </View>
        )}

        {isAdmin && (
          <>
            <Text style={styles.sectionTitle}>Neto por mes {windowSuffix}</Text>
            {txLoading ? (
              <SectionLoading />
            ) : (
              <View style={styles.chartCard}>
                <View style={styles.chartRow}>
                  {monthlyNeto.map(mn => (
                    <NetoBar
                      key={mn.month}
                      label={mn.label}
                      total={mn.total}
                      maxAbs={netoMaxAbs}
                      posZoneH={netoPosZone}
                      negZoneH={netoNegZone}
                    />
                  ))}
                </View>
                {netoMaxAbs === 0 && (
                  <Text style={styles.chartEmpty}>
                    {isCurrentMonth
                      ? 'Sin movimientos en los últimos 6 meses.'
                      : 'Sin movimientos en estos 6 meses.'}
                  </Text>
                )}
              </View>
            )}
          </>
        )}

        {isAdmin && stats.porSucursal.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Por sucursal{' '}
              {isCurrentMonth ? '(este mes)' : `(${monthTitle(anchorMonth)})`}
            </Text>
            <View style={styles.branchTable}>
              <View style={[styles.branchRow, styles.branchHeader]}>
                <View style={styles.branchCells}>
                  <Text style={[styles.branchCell, styles.branchName, styles.bold]}>
                    Sucursal
                  </Text>
                  <Text style={[styles.branchCell, styles.bold]}>Ventas</Text>
                  <Text style={[styles.branchCell, styles.bold]}>Ingresos</Text>
                </View>
              </View>
              {stats.porSucursal.map(row => {
                const fillStyle = {
                  width: `${
                    branchMax > 0 ? (row.ingresos / branchMax) * 100 : 0
                  }%` as const,
                };
                return (
                  <View key={row.branch} style={styles.branchRow}>
                    <View style={styles.branchCells}>
                      <Text style={[styles.branchCell, styles.branchName]}>
                        {BRANCH_LABELS[row.branch] || row.branch}
                      </Text>
                      <Text style={styles.branchCell}>{row.ventas}</Text>
                      <Text style={styles.branchCell}>
                        {formatMoney(row.ingresos)}
                      </Text>
                    </View>
                    <View style={styles.branchBarTrack}>
                      <View style={[styles.branchBarFill, fillStyle]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {isAdmin && (
          <>
            <Text style={styles.sectionTitle}>Cartera</Text>
            {salesLoading ? (
              <SectionLoading />
            ) : (
              <View style={styles.cardsRow}>
                <Card
                  label="Por cobrar"
                  value={formatMoney(stats.porCobrar.total)}
                  sub={`${stats.porCobrar.count} ventas con saldo`}
                />
              </View>
            )}
          </>
        )}

        {/* Ganancias = ingresos − gastos; can dip below zero, so it reuses
            the neto-style bars with a zero axis. */}
        {isAdmin && (
          <>
            <Text style={styles.sectionTitle}>
              Ganancias por mes (ingresos − gastos)
            </Text>
            {txLoading || expensesLoading ? (
              <SectionLoading />
            ) : (
              <View style={styles.chartCard}>
                <View style={styles.chartRow}>
                  {ganancias.map(g => (
                    <NetoBar
                      key={g.month}
                      label={g.label}
                      total={g.total}
                      maxAbs={gainMaxAbs}
                      posZoneH={gainPosZone}
                      negZoneH={gainNegZone}
                    />
                  ))}
                </View>
                {gainMaxAbs === 0 && (
                  <Text style={styles.chartEmpty}>
                    {isCurrentMonth
                      ? 'Sin movimientos en los últimos 6 meses.'
                      : 'Sin movimientos en estos 6 meses.'}
                  </Text>
                )}
                {expensesRangeNote}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f3f6fb' },
  content: { padding: 16, paddingBottom: 40 },
  back: { width: 32, height: 32, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  chipActive: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  chipText: { color: '#333', fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  pinnedBranch: { fontSize: 14, color: '#555', marginBottom: 16 },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  monthNav: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavOff: { opacity: 0.35 },
  monthNavText: {
    fontSize: 20,
    lineHeight: 24,
    color: '#333',
    fontWeight: '600',
  },
  monthNavTextOff: { color: '#999' },
  monthLabelBtn: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  monthLabelText: { fontSize: 14, color: '#111', fontWeight: '600' },
  monthReset: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#007bff',
  },
  monthResetText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  yearText: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthCell: {
    width: '22%',
    flexGrow: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f4f6f8',
    borderWidth: 1,
    borderColor: '#e3e8ee',
    alignItems: 'center',
  },
  monthCellActive: { backgroundColor: '#007bff', borderColor: '#007bff' },
  monthCellOff: { opacity: 0.35 },
  monthCellText: { fontSize: 13, color: '#333' },
  monthCellTextActive: { color: '#fff', fontWeight: '600' },
  monthCellTextOff: { color: '#999' },
  loader: { marginTop: 40 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 8,
  },
  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    minWidth: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#e3e8ee',
  },
  cardLabel: { fontSize: 12, color: '#667', marginBottom: 4 },
  cardValue: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  cardSub: { fontSize: 12, color: '#667', marginTop: 2 },
  branchTable: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e3e8ee',
    marginBottom: 8,
  },
  branchRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e3e8ee',
  },
  branchCells: { flexDirection: 'row' },
  branchHeader: { backgroundColor: '#f4f6f8' },
  branchCell: { flex: 1, fontSize: 13, color: '#222', textAlign: 'right' },
  branchName: { flex: 1.4, textAlign: 'left' },
  branchBarTrack: {
    height: 4,
    backgroundColor: '#eef1f4',
    borderRadius: 2,
    marginTop: 6,
  },
  branchBarFill: {
    height: 4,
    backgroundColor: '#007bff',
    borderRadius: 2,
  },
  bold: { fontWeight: 'bold' },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e3e8ee',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
  },
  chartBar: {
    width: '58%',
    backgroundColor: '#007bff',
    borderRadius: 3,
  },
  chartBarRed: {
    backgroundColor: '#dc3545',
  },
  sectionLoading: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  netoZonePos: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  netoZoneNeg: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  netoAxis: {
    width: '100%',
    height: 1,
    backgroundColor: '#c5ccd4',
  },
  netoBarNeg: {
    backgroundColor: '#dc3545',
  },
  chartValue: {
    fontSize: 9,
    color: '#667',
    marginBottom: 3,
    minHeight: 12,
  },
  chartDay: {
    fontSize: 10,
    color: '#667',
    marginTop: 4,
  },
  chartEmpty: {
    textAlign: 'center',
    color: '#888',
    fontSize: 12,
    marginTop: 8,
  },
});
