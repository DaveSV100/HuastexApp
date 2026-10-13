// src/screens/ExpensesScreen.tsx
// Expenses ("Gastos" in the UI) per month: totals on top (grand total + per
// branch, branch-scoped for staff/iT by the server), every expense as a table
// row, and an add modal for iT/admin/superadmin. All role rules are enforced
// server-side — this screen just renders what /expenses returns.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import api from '../api';
import { formatMoney, branchSlug } from '../utils/dashboardStats';

const BRANCH_LABELS: Record<string, string> = {
  aquismon: 'Aquismón',
  cerroazul: 'Cerro Azul',
  tepetzintla: 'Tepetzintla',
  tlacolula: 'Tlacolula',
  no_branch: 'Sin sucursal',
};

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface Expense {
  id: number;
  concept: string;
  expense_date: string;
  amount: string | number;
  pending_amount: string | number | null;
  location: string | null;
}

const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthTitle = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES_ES[(m || 1) - 1]} ${y}`;
};

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function ExpensesScreen(): React.JSX.Element {
  const navigation = useNavigation();

  const [role, setRole] = useState<string | null>(null);
  const [userBranch, setUserBranch] = useState('');
  const [month, setMonth] = useState(currentMonthKey());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totals, setTotals] = useState<{ total: number; byBranch: Record<string, number> }>({
    total: 0,
    byBranch: {},
  });
  const [loading, setLoading] = useState(true);

  // Add modal
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [form, setForm] = useState({
    concept: '',
    expense_date: todayIso(),
    amount: '',
    pending_amount: '',
    location: 'aquismon',
  });

  const canAdd = role === 'iT' || role === 'admin' || role === 'superadmin';
  const isAdmin = role === 'admin' || role === 'superadmin';

  useEffect(() => {
    (async () => {
      const storedRole = await AsyncStorage.getItem('role');
      const storedBranch = branchSlug((await AsyncStorage.getItem('branch')) || '');
      setRole(storedRole);
      setUserBranch(storedBranch);
      if (storedRole === 'iT' && storedBranch) {
        setForm(prev => ({ ...prev, location: storedBranch }));
      }
    })();
  }, []);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/expenses', { params: { month } });
      setExpenses(res.data?.expenses || []);
      setTotals(res.data?.totals || { total: 0, byBranch: {} });
    } catch (err) {
      console.error('Error fetching expenses:', err);
      Alert.alert('Error', 'No se pudieron cargar los gastos');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const formatDateForApi = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (date && event.type !== 'dismissed') {
        setForm(prev => ({ ...prev, expense_date: formatDateForApi(date) }));
      }
    } else if (date) {
      setTempDate(date);
    }
  };

  const handleSubmit = async () => {
    const value = parseFloat(form.amount);
    if (!form.concept.trim() || !form.expense_date || isNaN(value) || value < 0) {
      Alert.alert('Error', 'Completa concepto, fecha y cantidad válidos');
      return;
    }
    setIsSaving(true);
    try {
      await api.post('/expenses', {
        concept: form.concept.trim(),
        expense_date: form.expense_date,
        amount: value,
        pending_amount: form.pending_amount === '' ? null : form.pending_amount,
        location: form.location,
      });
      setShowModal(false);
      const savedMonth = form.expense_date.slice(0, 7);
      setForm(prev => ({
        ...prev,
        concept: '',
        amount: '',
        pending_amount: '',
        expense_date: todayIso(),
      }));
      // Jump to the expense's month so the new row is visible right away.
      setMonth(savedMonth);
      fetchExpenses();
      Alert.alert('Éxito', 'Gasto registrado');
    } catch (err) {
      console.error('Error creating expense:', err);
      Alert.alert('Error', 'No se pudo registrar el gasto');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (isoDateStr: string) => {
    if (!isoDateStr) return '';
    const [datePart] = String(isoDateStr).split('T');
    const [y, m, d] = datePart.split('-');
    return `${d}/${m}/${y}`;
  };

  // Branch totals rows: admin sees every branch, staff/iT only get their own
  // branch back from the server.
  const branchRows = Object.entries(totals.byBranch || {});

  return (
    <SafeAreaView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Gastos</Text>

        {/* Month switcher */}
        <View style={styles.monthRow}>
          <TouchableOpacity style={styles.monthArrow} onPress={() => setMonth(m => shiftMonth(m, -1))}>
            <Text style={styles.monthArrowText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{monthTitle(month)}</Text>
          <TouchableOpacity
            style={styles.monthArrow}
            onPress={() => setMonth(m => shiftMonth(m, 1))}
            disabled={month >= currentMonthKey()}
          >
            <Text style={[styles.monthArrowText, month >= currentMonthKey() && styles.monthArrowOff]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Totals on top: grand total (all branches) + per-branch */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total de gastos (todas las sucursales)</Text>
          <Text style={styles.totalValue}>{formatMoney(Number(totals.total) || 0)}</Text>
          {branchRows.map(([branch, value]) => (
            <View key={branch} style={styles.branchTotalRow}>
              <Text style={styles.branchTotalName}>{BRANCH_LABELS[branch] || branch}</Text>
              <Text style={styles.branchTotalValue}>{formatMoney(Number(value) || 0)}</Text>
            </View>
          ))}
          {!isAdmin && (
            <Text style={styles.scopeNote}>
              Ves los gastos de tu sucursal y el total general.
            </Text>
          )}
        </View>

        {canAdd && (
          <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
            <Text style={styles.addButtonText}>Agregar Gasto</Text>
          </TouchableOpacity>
        )}

        {/* Table */}
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.cell, styles.cellConcept, styles.bold]}>Concepto</Text>
            <Text style={[styles.cell, styles.bold]}>Fecha</Text>
            <Text style={[styles.cell, styles.bold]}>Cantidad</Text>
            <Text style={[styles.cell, styles.bold]}>Pendiente</Text>
            <Text style={[styles.cell, styles.bold]}>Sucursal</Text>
          </View>
          {loading ? (
            <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
          ) : expenses.length === 0 ? (
            <Text style={styles.empty}>No hay gastos registrados este mes.</Text>
          ) : (
            expenses.map(e => (
              <View key={e.id} style={styles.tableRow}>
                <Text style={[styles.cell, styles.cellConcept]}>{e.concept}</Text>
                <Text style={styles.cell}>{formatDate(e.expense_date)}</Text>
                <Text style={styles.cell}>{formatMoney(Number(e.amount) || 0)}</Text>
                <Text style={styles.cell}>
                  {e.pending_amount != null ? formatMoney(Number(e.pending_amount) || 0) : '—'}
                </Text>
                <Text style={styles.cell}>{BRANCH_LABELS[e.location || ''] || e.location || '—'}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add modal (iT / admin / superadmin) */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agregar Gasto</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.closeButton}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form}>
              <Text style={styles.label}>Concepto *</Text>
              <TextInput
                style={styles.input}
                value={form.concept}
                onChangeText={v => setForm(prev => ({ ...prev, concept: v }))}
                placeholder="Ej. Renta, luz, mantenimiento…"
              />

              <Text style={styles.label}>Fecha *</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => {
                  setTempDate(form.expense_date ? new Date(form.expense_date) : new Date());
                  setShowDatePicker(true);
                }}
              >
                <Text style={styles.dateText}>{form.expense_date || 'Seleccionar fecha'}</Text>
              </TouchableOpacity>

              {showDatePicker && (
                <View style={styles.datePickerContainer}>
                  <DateTimePicker
                    value={tempDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                    themeVariant="light"
                  />
                  {Platform.OS === 'ios' && (
                    <View style={styles.dateButtonsRow}>
                      <TouchableOpacity
                        style={styles.dateCancelButton}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.dateButtonLabel}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.dateConfirmButton}
                        onPress={() => {
                          setForm(prev => ({ ...prev, expense_date: formatDateForApi(tempDate) }));
                          setShowDatePicker(false);
                        }}
                      >
                        <Text style={styles.dateButtonLabel}>Confirmar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              <Text style={styles.label}>Cantidad *</Text>
              <TextInput
                style={styles.input}
                value={form.amount}
                onChangeText={v => setForm(prev => ({ ...prev, amount: v }))}
                keyboardType="numeric"
                placeholder="0.00"
              />

              <Text style={styles.label}>Cantidad pendiente</Text>
              <TextInput
                style={styles.input}
                value={form.pending_amount}
                onChangeText={v => setForm(prev => ({ ...prev, pending_amount: v }))}
                keyboardType="numeric"
                placeholder="Opcional"
              />

              <Text style={styles.label}>Sucursal *</Text>
              {isAdmin ? (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={form.location}
                    onValueChange={v => setForm(prev => ({ ...prev, location: v }))}
                    itemStyle={styles.pickerItem}
                  >
                    <Picker.Item label="Aquismón" value="aquismon" color="#333" />
                    <Picker.Item label="Cerro Azul" value="cerroazul" color="#333" />
                    <Picker.Item label="Tepetzintla" value="tepetzintla" color="#333" />
                    <Picker.Item label="Tlacolula" value="tlacolula" color="#333" />
                  </Picker>
                </View>
              ) : (
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={BRANCH_LABELS[userBranch] || userBranch}
                  editable={false}
                />
              )}

              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f3f6fb' },
  content: { padding: 16, paddingBottom: 40 },
  backText: { fontSize: 16, color: '#007bff', fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  monthArrow: { paddingHorizontal: 18, paddingVertical: 4 },
  monthArrowText: { fontSize: 26, color: '#007bff', fontWeight: '700' },
  monthArrowOff: { color: '#bbb' },
  monthTitle: { fontSize: 17, fontWeight: '600', minWidth: 150, textAlign: 'center' },
  totalCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e3e8ee',
    padding: 14,
    marginBottom: 12,
  },
  totalLabel: { fontSize: 13, color: '#667' },
  totalValue: { fontSize: 24, fontWeight: 'bold', color: '#dc3545', marginBottom: 8 },
  branchTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e3e8ee',
  },
  branchTotalName: { fontSize: 14, color: '#333' },
  branchTotalValue: { fontSize: 14, fontWeight: '600', color: '#333' },
  scopeNote: { fontSize: 12, color: '#888', marginTop: 8 },
  addButton: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 12,
  },
  addButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  table: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e3e8ee',
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e3e8ee',
  },
  tableHeader: { backgroundColor: '#f4f6f8' },
  cell: { flex: 1, fontSize: 12, color: '#222', textAlign: 'right' },
  cellConcept: { flex: 1.6, textAlign: 'left' },
  bold: { fontWeight: 'bold' },
  loader: { marginVertical: 24 },
  empty: { textAlign: 'center', color: '#888', padding: 20 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  closeButton: { color: '#dc3545', fontSize: 16, fontWeight: '600' },
  form: { padding: 16 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputDisabled: { backgroundColor: '#f0f0f0', color: '#666' },
  dateText: { fontSize: 16, color: '#333' },
  datePickerContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginTop: 8,
    padding: 8,
  },
  dateButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  dateCancelButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginRight: 8,
  },
  dateConfirmButton: {
    flex: 1,
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  dateButtonLabel: { color: '#fff', fontWeight: '600' },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    overflow: 'hidden',
  },
  pickerItem: { color: '#333', fontSize: 16 },
  saveButton: {
    backgroundColor: '#28a745',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  saveButtonDisabled: { backgroundColor: '#6c757d' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
