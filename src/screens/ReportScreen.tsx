// src/screens/ReportScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  TextInput,
  Modal,
  Button,
  Alert,
  ScrollView,
  SafeAreaView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api'; // adjust path if needed
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { openCashDrawer } from '../utils/thermalPrinter';

const paymentTypeLabels: Record<string, string> = {
  deposit: 'Abono',
  down_payment: 'Enganche',
  sale: 'Venta',
  settled: 'Liquidó',
  credit_card: 'C/Tarjeta',
  transfer: 'Transferencia',
  online: 'Online',
  cash_deposit: 'Depósito en efectivo',
};

const BRANCHES = ['all', 'aquismon', 'cerroazul', 'tepetzintla', 'tlacolula'];
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

export default function ReportScreen() {
  const navigation = useNavigation();
  // Android draws the picker's text at the user's system font size, but its
  // box had a fixed height, so larger fonts cut off the bottom of the branch
  // name. Grow the box with the font scale (iOS uses its own wheel height).
  const { fontScale } = useWindowDimensions();
  const androidPickerSize =
    Platform.OS === 'android' ? { height: Math.ceil(52 * Math.max(1, fontScale)) } : null;

  // Real role/branch from the signed-in session (set at login from the JWT).
  // Previously hardcoded to 'admin'/'aquismon', which faked the UI gating.
  const [role, setRole] = useState<string | null>(null);
  const [userBranch, setUserBranch] = useState('');

  // Back-office roles may create/edit/delete report rows. `normal` cannot — and
  // the server now enforces this (DELETE /transactions, /sales and /payments all
  // allow admin|superadmin|staff|iT), so this just keeps the UI in sync.
  const canManage =
    role === 'admin' || role === 'superadmin' || role === 'staff' || role === 'iT';

  const [selectedLocation, setSelectedLocation] = useState('aquismon');
  // No data is fetched until the stored role/branch have been read, so a
  // pinned user never sees another branch's numbers flash by first.
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // staff / iT are pinned to their own branch's report.
  const isPinnedToBranch = role === 'staff' || role === 'iT';

  useEffect(() => {
    (async () => {
      const storedRole = await AsyncStorage.getItem('role');
      const storedBranch = (await AsyncStorage.getItem('branch')) || '';
      // Branch is stored as a display name (e.g. "Cerro Azul"); the picker uses
      // slug values ("cerroazul"), so normalize before comparing/selecting.
      const branchSlug = storedBranch.toLowerCase().replace(/\s+/g, '');
      setRole(storedRole);
      setUserBranch(branchSlug);
      if (storedRole === 'staff' || storedRole === 'iT') {
        // If the session has no branch, leave the selection empty — showing
        // nothing beats showing some other branch's report.
        setSelectedLocation(branchSlug);
      }
      setSessionLoaded(true);
    })();
  }, []);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [dailyAccounting, setDailyAccounting] = useState({
    counted_amount: '',
    cash_in_register: '',
    cashier_name: '',
  });

  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState<'income' | 'outcome'>('income');
  const [editingTx, setEditingTx] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    name: '',
    product: '',
    value: '',
    saldo: '',
    por_pagar: '',
    transaction_date: getLocalDateString(),
    payment_type: 'deposit',
    location: selectedLocation,
  });
  const [showAccModal, setShowAccModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchTransactions = useCallback(async () => {
    // A pinned user with no known branch must not fetch: omitting the location
    // param would return every branch's transactions.
    if (!sessionLoaded || (isPinnedToBranch && !selectedLocation)) return;
    try {
      const branchParam = selectedLocation === 'all' ? undefined : selectedLocation;
      // `date` narrows the fetch to the selected day server-side; older
      // servers ignore it and return everything, and filteredTx below trims
      // to the day either way, so behavior is identical on both.
      const res = await api.get('/transactions', {
        params: {
          date: getLocalDateString(selectedDate),
          ...(branchParam ? { location: branchParam } : {})
        }
      });
      setTransactions(res.data || []);
    } catch (e) {
      console.error(e);
    }
  }, [selectedLocation, selectedDate, sessionLoaded, isPinnedToBranch]);

  const fetchDailyAccounting = useCallback(async () => {
    if (!sessionLoaded || (isPinnedToBranch && !selectedLocation)) return;
    try {
      const res = await api.get('/daily-accounting', {
        params: {
          date: getLocalDateString(selectedDate),
          location: selectedLocation
        }
      });
      setDailyAccounting((prev) => res.data || prev);
    } catch (e) {
      console.error(e);
    }
  }, [selectedDate, selectedLocation, sessionLoaded, isPinnedToBranch]);

  // Refetch whenever the screen regains focus (so deletes/edits made on the
  // Sales or Payments screens show up here immediately) and whenever the
  // branch/date filter changes.
  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
      fetchDailyAccounting();
    }, [fetchTransactions, fetchDailyAccounting])
  );

  const filteredTx = transactions.filter(t => {
    const d = t.transaction_date?.split('T')[0];
    if (d !== getLocalDateString(selectedDate)) return false;
    // Belt-and-suspenders: even if the server ignores the location param,
    // never show a row from a branch other than the selected one.
    if (selectedLocation && selectedLocation !== 'all') {
      const loc = (t.location || '').toLowerCase().replace(/\s+/g, '');
      return loc === selectedLocation;
    }
    return true;
  });

  // Same math as the web's Incoms page: the cash totals exclude card/
  // transfer/online/cash-deposit rows; "Total neto" counts every income
  // regardless of payment type, minus the same egresos.
  const excluded = ['credit_card', 'transfer', 'online', 'cash_deposit'];
  const txForTotals = filteredTx.filter(t => !excluded.includes(t.payment_type));
  const incomes = txForTotals.filter(t => t.transaction_type === 'income');
  const outcomes = txForTotals.filter(t => t.transaction_type === 'outcome');
  const totalIn = incomes.reduce((sum, t) => sum + Number(t.value || 0), 0);
  const totalOut = outcomes.reduce((sum, t) => sum + Number(t.value || 0), 0);
  const totalGeneral = totalIn - totalOut;
  const netTotalIncomes = filteredTx
    .filter(t => t.transaction_type === 'income')
    .reduce((sum, t) => sum + Number(t.value || 0), 0);
  const netTotal = netTotalIncomes - totalOut;

  function onChangeDate(_: any, date?: Date) {
    setShowDatePicker(false);
    if (date) setSelectedDate(date);
  }

  function openNew(type: 'income' | 'outcome') {
    // Cash is about to go in (ingreso) or out (egreso) of the drawer.
    openCashDrawer();
    setEditingTx(null);
    setTxType(type);
    setFormData({
      name: '',
      product: '',
      value: '',
      saldo: '',
      por_pagar: '',
      transaction_date: getLocalDateString(selectedDate),
      payment_type: type === 'income' ? 'deposit' : '',
      location: selectedLocation,
    });
    setShowTxModal(true);
  }

  function startEdit(tx: any) {
    setEditingTx(tx);
    setTxType(tx.transaction_type);
    setFormData({
      name: tx.name,
      product: tx.product,
      value: tx.value,
      saldo: tx.saldo,
      por_pagar: tx.por_pagar,
      transaction_date: tx.transaction_date.split('T')[0],
      payment_type: tx.payment_type,
      location: tx.location,
    });
    setShowTxModal(true);
  }

  // Is this transaction the sale's own income row (created when the sale was made)?
  function isSaleRow(tx: any) {
    const ptype = (tx?.payment_type || '').toLowerCase();
    return !!tx?.sale_id && (ptype === 'sale' || ptype === 'down_payment');
  }

  // Is this an abono (payment) row linked to a sale?
  function isLinkedPaymentRow(tx: any) {
    return !!tx?.sale_id && tx?.transaction_type === 'income' && !isSaleRow(tx);
  }

  // "Ver más" / info: jump to the related sale or payment detail.
  function openLinked(tx: any) {
    if (isSaleRow(tx)) {
      (navigation as any).navigate('Sales', { focusSaleId: tx.sale_id });
    } else if (isLinkedPaymentRow(tx)) {
      (navigation as any).navigate('Payments', { saleId: tx.sale_id });
    }
  }

  async function deleteTx(tx: any) {
    Alert.alert('Confirmar', '¿Eliminar transacción?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'OK', onPress: async () => {
          try {
            if (isSaleRow(tx)) {
              // Single call. Deleting the sale cascades to its payments,
              // sale_products and ALL of its daily-report transactions — do NOT
              // delete transactions separately here.
              await api.delete(`/sales/${tx.sale_id}`);
            } else if (isLinkedPaymentRow(tx)) {
              if (tx.payment_id != null) {
                // Delete the abono itself; the DB cascade (payment_id FK) removes
                // this report row automatically.
                await api.delete(`/payments/${tx.payment_id}`);
              } else {
                // Legacy row created before payment_id existed: just remove the
                // report row (we can't safely identify which payment it was).
                await api.delete(`/transactions/${tx.id}`);
              }
            } else {
              // Independent income or outcome: only lives in the daily report.
              await api.delete(`/transactions/${tx.id}`);
            }
            fetchTransactions();
          } catch (e) {
            console.error(e);
            Alert.alert('Error', 'No se pudo eliminar');
          }
        }
      }
    ]);
  }

  async function saveTransaction() {
    setSaving(true);
    try {
      const payload: any = {
        ...formData,
        transaction_type: txType,
      };
      // Keep the link to the sale when editing a linked row, so an edit doesn't
      // orphan it from its sale/payment.
      if (editingTx?.sale_id != null) {
        payload.sale_id = editingTx.sale_id;
      }
      if (editingTx) {
        await api.put(`/transactions/${editingTx.id}`, payload);
      } else {
        await api.post('/transactions', payload);
      }
      setShowTxModal(false);
      fetchTransactions();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function saveAccounting() {
    setSaving(true);
    try {
      await api.put(`/daily-accounting/${getLocalDateString(selectedDate)}`, {
        ...dailyAccounting,
        location: selectedLocation
      });
      setShowAccModal(false);
      fetchDailyAccounting();
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  // Header for the FlatList (non-scrollable content above the list). An
  // element, not an inline component: a component defined here is a new type
  // on every render, so React remounted the whole header (and its native
  // picker) each time the data changed.
  const listHeader = (
    <View>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Image source={require('../../Assets/back.png')} style={styles.back} />
      </TouchableOpacity>

      <View style={styles.filters}>
        <View style={styles.filterCol}>
          <Text style={styles.label}>Sucursal:</Text>
          {/* Rendered only once the session is known, so the picker's items
              never change under it: shrinking the 5-branch list to the
              user's one branch crashed iOS (UIPickerView asked for row 1 of
              a 1-item list) — staff/iT can't switch branch anyway, so they
              just get a label. */}
          {!sessionLoaded ? null : isPinnedToBranch ? (
            <Text style={styles.branchFixed}>
              {BRANCH_LABELS[userBranch] || userBranch || '—'}
            </Text>
          ) : (
            <View style={styles.pickerBox}>
              <Picker
                selectedValue={selectedLocation}
                onValueChange={v => setSelectedLocation(v)}
                enabled={role === 'admin' || role === 'superadmin'}
                style={[styles.picker, androidPickerSize]}
                itemStyle={styles.pickerItem}
                mode="dropdown"
                dropdownIconColor="#333"
              >
                {BRANCHES.map(loc => (
                  <Picker.Item
                    key={loc}
                    label={BRANCH_LABELS[loc]}
                    value={loc}
                    color="#000"
                  />
                ))}
              </Picker>
            </View>
          )}
          <View style={styles.editAccountingBtn}>
            <Button
              title="Editar Contabilidad"
              onPress={() => {
                // Counting the cash — pop the drawer for the cashier.
                openCashDrawer();
                setShowAccModal(true);
              }}
            />
          </View>
        </View>
        <View style={styles.filterCol}>
          <Text style={styles.label}>Fecha:</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateBtn}>
            <Text>{getLocalDateString(selectedDate)}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={onChangeDate}
            />
          )}
          <View style={styles.totals}>
            <Text>Total Ingresos: ${totalIn}</Text>
            <Text>Total Egresos: ${totalOut}</Text>
            <Text style={styles.net}>Total General: ${totalGeneral}</Text>
            <Text>Total neto: ${netTotal}</Text>
          </View>
        </View>
      </View>

      <View style={styles.accounting}>
        <Text>Cantidad Contada: {dailyAccounting.counted_amount || '-'}</Text>
        <Text>Dinero en Caja: {dailyAccounting.cash_in_register || '-'}</Text>
        <Text>Cajero: {dailyAccounting.cashier_name || '-'}</Text>
      </View>

      <View style={styles.actions}>
        <Button title="Agregar Ingreso" onPress={() => openNew('income')} />
        <Button title="Agregar Egreso" onPress={() => openNew('outcome')} />
      </View>

      <Text style={styles.sectionTitle}>
        Transacciones para {getLocalDateString(selectedDate)}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.flex}>
      <FlatList
        data={filteredTx}
        keyExtractor={(t) => (t?.id != null ? String(t.id) : Math.random().toString())}
        renderItem={({ item }) => {
          const linkedToSale = isSaleRow(item) || isLinkedPaymentRow(item);
          return (
            <View style={styles.txItem}>
              <Text>
                {item.transaction_type === 'income' ? 'Ingreso' : 'Egreso'}: ${item.value} – {item.name}
              </Text>
              {item.transaction_type === 'income' && (
                <>
                  <Text>Producto: {item.product}</Text>
                  <Text>Tipo: {paymentTypeLabels[item.payment_type]}</Text>
                  <Text>Sucursal: {item.location}</Text>
                </>
              )}
              {linkedToSale && (
                <TouchableOpacity onPress={() => openLinked(item)}>
                  <Text style={styles.linkText}>
                    ⓘ {isSaleRow(item) ? 'Venta' : 'Abono'} #{item.sale_id} · Ver más
                  </Text>
                </TouchableOpacity>
              )}
              {canManage && (
                <View style={styles.txActions}>
                  <Button title="Editar" onPress={() => startEdit(item)} />
                  <Button title="Eliminar" onPress={() => deleteTx(item)} />
                </View>
              )}
            </View>
          );
        }}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        // optional: small optimization
        initialNumToRender={10}
        removeClippedSubviews={true}
        // show a simple empty component when there are no transactions
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 16 }}>No hay transacciones para esta fecha.</Text>}
      />

      {/* Transaction Modal */}
      {showTxModal && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>
                {editingTx ? 'Editar' : 'Nuevo'} {txType === 'income' ? 'Ingreso' : 'Egreso'}
              </Text>
              <ScrollView keyboardShouldPersistTaps="handled">
                <TextInput
                  placeholder="Nombre"
                  value={formData.name}
                  onChangeText={v => setFormData((f: any) => ({ ...f, name: v }))}
                  style={styles.input}
                />
                {txType === 'income' && (
                  <>
                    <TextInput
                      placeholder="Producto"
                      value={formData.product}
                      onChangeText={v => setFormData((f: any) => ({ ...f, product: v }))}
                      style={styles.input}
                    />
                    <Picker
                      selectedValue={formData.payment_type}
                      onValueChange={v => setFormData((f: any) => ({ ...f, payment_type: v }))}
                    >
                      {Object.entries(paymentTypeLabels).map(([k, label]) => (
                        <Picker.Item key={k} label={label} value={k} />
                      ))}
                    </Picker>
                  </>
                )}
                <TextInput
                  placeholder="Monto"
                  value={String(formData.value)}
                  keyboardType="numeric"
                  onChangeText={v => setFormData((f: any) => ({ ...f, value: v }))}
                  style={styles.input}
                />
                {txType === 'income' && (
                  <>
                    <TextInput
                      placeholder="Saldo"
                      value={String(formData.saldo)}
                      keyboardType="numeric"
                      onChangeText={v => setFormData((f: any) => ({ ...f, saldo: v }))}
                      style={styles.input}
                    />
                    <TextInput
                      placeholder="Por pagar"
                      value={String(formData.por_pagar)}
                      keyboardType="numeric"
                      onChangeText={v => setFormData((f: any) => ({ ...f, por_pagar: v }))}
                      style={styles.input}
                    />
                  </>
                )}
                <View style={styles.modalActions}>
                  <Button
                    title={saving ? 'Guardando...' : editingTx ? 'Actualizar' : 'Guardar'}
                    onPress={saveTransaction}
                  />
                  <Button title="Cerrar" onPress={() => setShowTxModal(false)} />
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Accounting Modal */}
      <Modal visible={showAccModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Editar Contabilidad Diaria</Text>
            <TextInput
              placeholder="Cantidad Contada"
              value={dailyAccounting.counted_amount}
              keyboardType="numeric"
              onChangeText={v => setDailyAccounting(d => ({ ...d, counted_amount: v }))}
              style={styles.input}
            />
            <TextInput
              placeholder="Dinero en Caja"
              value={dailyAccounting.cash_in_register}
              keyboardType="numeric"
              onChangeText={v => setDailyAccounting(d => ({ ...d, cash_in_register: v }))}
              style={styles.input}
            />
            <TextInput
              placeholder="Nombre Cajero"
              value={dailyAccounting.cashier_name}
              onChangeText={v => setDailyAccounting(d => ({ ...d, cashier_name: v }))}
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Button
                title={saving ? 'Guardando...' : 'Guardar'}
                onPress={saveAccounting}
              />
              <Button title="Cerrar" onPress={() => setShowAccModal(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { width: 32, height: 32, marginBottom: 16 },
  filters: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  filterCol: { flex: 1 },
  label: { marginBottom: 4 },
  // The border lives on the wrapper: styling the Picker itself clips the
  // native widget. iOS renders a ~120pt wheel; Android's spinner needs at
  // least ~52pt of height or the selected branch name gets cut off.
  pickerBox: {
    width: '100%',
    maxWidth: 200,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    justifyContent: 'center',
  },
  picker: {
    width: '100%',
    height: Platform.OS === 'ios' ? 120 : 52,
    color: '#000',
  },
  pickerItem: { fontSize: 16, height: 120 },
  branchFixed: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    backgroundColor: '#f5f5f5',
    alignSelf: 'flex-start',
  },
  dateBtn: { padding: 8, borderWidth: 1, borderColor: '#ccc', borderRadius: 4 },
  totals: { marginTop: 8 },
  net: { fontWeight: 'bold', fontSize: 16 },
  editAccountingBtn: { marginTop: 8, alignSelf: 'flex-start' },
  accounting: { marginBottom: 16 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  txItem: { padding: 12, backgroundColor: '#f5f5f5', marginBottom: 8, borderRadius: 4 },
  txActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  linkText: { color: '#007bff', fontWeight: '600', marginTop: 6 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center'
  },
  modal: {
    width: '90%', maxHeight: '90%', backgroundColor: '#fff',
    borderRadius: 6, padding: 16
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 4,
    padding: 8, marginBottom: 12
  },
  modalActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
});
