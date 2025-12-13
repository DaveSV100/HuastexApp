// src/screens/ReportScreen.tsx
import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import api from '../api'; // adjust path if needed
import { useNavigation } from '@react-navigation/native';

const paymentTypeLabels: Record<string, string> = {
  deposit: 'Abono',
  down_payment: 'Enganche',
  sale: 'Venta',
  settled: 'Liquidó',
  credit_card: 'C/Tarjeta',
  transfer: 'Transferencia',
  online: 'Online',
};

function getLocalDateString(date: Date = new Date()) {
  const y = date.getFullYear();
  const m = ('0' + (date.getMonth() + 1)).slice(-2);
  const d = ('0' + date.getDate()).slice(-2);
  return `${y}-${m}-${d}`;
}

export default function ReportScreen() {
  const navigation = useNavigation();

  const userRole = 'admin';
  const userBranch = 'aquismon';

  const [selectedLocation, setSelectedLocation] = useState(
    userRole === 'staff' || userRole === 'iT' ? userBranch : 'aquismon'
  );
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

  useEffect(() => {
    fetchTransactions();
    fetchDailyAccounting();
  }, [selectedLocation, selectedDate]);

  async function fetchTransactions() {
    try {
      const branchParam = selectedLocation === 'all' ? undefined : selectedLocation;
      const res = await api.get('/transactions', {
        params: branchParam ? { location: branchParam } : {}
      });
      setTransactions(res.data || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchDailyAccounting() {
    try {
      const res = await api.get('/daily-accounting', {
        params: {
          date: getLocalDateString(selectedDate),
          location: selectedLocation
        }
      });
      setDailyAccounting(res.data || dailyAccounting);
    } catch (e) {
      console.error(e);
    }
  }

  const filteredTx = transactions.filter(t => {
    const d = t.transaction_date?.split('T')[0];
    return d === getLocalDateString(selectedDate);
  });

  const excluded = ['credit_card', 'transfer', 'online'];
  const txForTotals = filteredTx.filter(t => !excluded.includes(t.payment_type));
  const incomes = txForTotals.filter(t => t.transaction_type === 'income');
  const outcomes = txForTotals.filter(t => t.transaction_type === 'outcome');
  const totalIn = incomes.reduce((sum, t) => sum + Number(t.value || 0), 0);
  const totalOut = outcomes.reduce((sum, t) => sum + Number(t.value || 0), 0);
  const netTotal = totalIn - totalOut;

  function onChangeDate(_: any, date?: Date) {
    setShowDatePicker(false);
    if (date) setSelectedDate(date);
  }

  function openNew(type: 'income' | 'outcome') {
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

  async function deleteTx(id: number) {
    Alert.alert('Confirmar', '¿Eliminar transacción?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'OK', onPress: async () => {
          await api.delete(`/transactions/${id}`);
          fetchTransactions();
        }
      }
    ]);
  }

  async function saveTransaction() {
    setSaving(true);
    try {
      const payload = {
        ...formData,
        transaction_type: txType,
      };
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

  // Header component for the FlatList (non-scrollable content above the list)
  const ListHeader = () => (
    <View>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Image source={require('../../Assets/back.png')} style={styles.back} />
      </TouchableOpacity>

      <View style={styles.filters}>
        <View>
          <Text style={styles.label}>Sucursal:</Text>
          <Picker
            selectedValue={selectedLocation}
            onValueChange={v => setSelectedLocation(v)}
            style={styles.picker}
          >
            {['all', 'aquismon', 'cerroazul', 'tepetzintla', 'tlacolula'].map(loc => (
              <Picker.Item key={loc} label={loc} value={loc} />
            ))}
          </Picker>
        </View>
        <View>
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
        </View>
      </View>

      <View style={styles.totals}>
        <Text>Total Ingresos: ${totalIn}</Text>
        <Text>Total Egresos: ${totalOut}</Text>
        <Text style={styles.net}>Total Neto: ${netTotal}</Text>
      </View>

      <View style={styles.accounting}>
        <Text>Cantidad Contada: {dailyAccounting.counted_amount || '-'}</Text>
        <Text>Dinero en Caja: {dailyAccounting.cash_in_register || '-'}</Text>
        <Text>Cajero: {dailyAccounting.cashier_name || '-'}</Text>
        <Button title="Editar Contabilidad" onPress={() => setShowAccModal(true)} />
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
        renderItem={({ item }) => (
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
            <View style={styles.txActions}>
              <Button title="Editar" onPress={() => startEdit(item)} />
              <Button title="Eliminar" onPress={() => deleteTx(item.id)} />
            </View>
          </View>
        )}
        ListHeaderComponent={<ListHeader />}
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
                  onChangeText={v => setFormData(f => ({ ...f, name: v }))}
                  style={styles.input}
                />
                {txType === 'income' && (
                  <>
                    <TextInput
                      placeholder="Producto"
                      value={formData.product}
                      onChangeText={v => setFormData(f => ({ ...f, product: v }))}
                      style={styles.input}
                    />
                    <Picker
                      selectedValue={formData.payment_type}
                      onValueChange={v => setFormData(f => ({ ...f, payment_type: v }))}
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
                  onChangeText={v => setFormData(f => ({ ...f, value: v }))}
                  style={styles.input}
                />
                {txType === 'income' && (
                  <>
                    <TextInput
                      placeholder="Saldo"
                      value={String(formData.saldo)}
                      keyboardType="numeric"
                      onChangeText={v => setFormData(f => ({ ...f, saldo: v }))}
                      style={styles.input}
                    />
                    <TextInput
                      placeholder="Por pagar"
                      value={String(formData.por_pagar)}
                      keyboardType="numeric"
                      onChangeText={v => setFormData(f => ({ ...f, por_pagar: v }))}
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
  label: { marginBottom: 4 },
  picker: { width: 150, height: 44, borderWidth: 1, borderColor: '#ccc' },
  dateBtn: { padding: 8, borderWidth: 1, borderColor: '#ccc', borderRadius: 4 },
  totals: { marginBottom: 16, marginLeft: 200 },
  net: { fontWeight: 'bold', fontSize: 16 },
  accounting: { marginBottom: 30, marginLeft: 200 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  txItem: { padding: 12, backgroundColor: '#f5f5f5', marginBottom: 8, borderRadius: 4 },
  txActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
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
