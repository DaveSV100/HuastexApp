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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import api from '../api';
import {
  computeDashboardStats,
  incomeLastDays,
  branchSlug,
  formatMoney,
  compactMoney,
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
function ChartBar({ label, total, max }: { label: string; total: number; max: number }) {
  const barStyle = {
    height: Math.max(max > 0 ? (total / max) * CHART_MAX_BAR : 0, 2),
  };
  return (
    <View style={styles.chartCol}>
      <Text style={styles.chartValue}>{total > 0 ? compactMoney(total) : ''}</Text>
      <View style={[styles.chartBar, barStyle]} />
      <Text style={styles.chartDay}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen(): React.JSX.Element {
  const navigation = useNavigation();

  const [role, setRole] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [sales, setSales] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Same branch pinning as the daily report: staff/iT only see their own.
  const canPickBranch = role === 'admin' || role === 'superadmin';

  useEffect(() => {
    (async () => {
      const storedRole = await AsyncStorage.getItem('role');
      const storedBranch = (await AsyncStorage.getItem('branch')) || '';
      setRole(storedRole);
      if (storedRole === 'staff' || storedRole === 'iT') {
        setSelectedLocation(branchSlug(storedBranch) || 'aquismon');
      }
    })();
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [salesRes, txRes] = await Promise.all([
        api.get('/sales'),
        api.get('/transactions'),
      ]);
      setSales(salesRes.data || []);
      setTransactions(txRes.data || []);
    } catch (e) {
      console.error('Error loading dashboard data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const stats = computeDashboardStats(
    sales,
    transactions,
    selectedLocation,
    getLocalDateString(),
  );
  const weekIncome = incomeLastDays(
    transactions,
    selectedLocation,
    getLocalDateString(),
  );
  const weekMax = Math.max(...weekIncome.map(d => d.total), 0);
  const branchMax = Math.max(...stats.porSucursal.map(r => r.ingresos), 0);

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

        {canPickBranch ? (
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

        {loading ? (
          <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
        ) : (
          <>
            <Text style={styles.sectionTitle}>Hoy</Text>
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

            <Text style={styles.sectionTitle}>Este mes</Text>
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

            <Text style={styles.sectionTitle}>Ingresos últimos 7 días</Text>
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

            <Text style={styles.sectionTitle}>Cartera</Text>
            <View style={styles.cardsRow}>
              <Card
                label="Por cobrar"
                value={formatMoney(stats.porCobrar.total)}
                sub={`${stats.porCobrar.count} ventas con saldo`}
              />
            </View>

            {stats.porSucursal.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Por sucursal (este mes)</Text>
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
