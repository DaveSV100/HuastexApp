// src/components/PaymentsModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import api from '../api'

interface PaymentsModalProps {
  visible: boolean;
  sale: any;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

export default function PaymentsModal({
  visible,
  sale,
  onClose,
  onPaymentSuccess,
}: PaymentsModalProps): React.JSX.Element {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    fecha: '',
    cantidad: '',
    cajero: '',
    payment_type: 'deposit',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  const buildPaymentPayload = (saleData: any, paymentData: any) => {
    let productList = '(sin producto)';
    if (Array.isArray(saleData.products) && saleData.products.length) {
      productList = saleData.products
        .map((p: any) => p.title ?? p.producto ?? p.name ?? '(sin nombre)')
        .join(', ');
    }

    const amount = Number(paymentData.cantidad);
    const saldoPromoOrig = Number(saleData.saldo_precio_promocion ?? 0);
    const saldoNormalOrig = Number(saleData.saldo_precio_normal ?? 0);

    const newSaldoPromo = saldoPromoOrig - amount;
    const newSaldoNormal = saldoNormalOrig - amount;

    const method = paymentData.payment_type.toLowerCase();

    return {
      transaction_type: 'income',
      name: saleData.nombre || '',
      product: productList,
      value: amount,
      saldo: newSaldoNormal,
      por_pagar: newSaldoPromo,
      transaction_date: paymentData.fecha,
      payment_type: method,
      location: saleData.sucursal || '',
    };
  };

  const handleSubmit = async () => {
    if (!formData.fecha || !formData.cantidad || !formData.cajero) {
      Alert.alert('Error', 'Por favor completa todos los campos requeridos');
      return;
    }

    setIsSaving(true);

    try {
      // Register payment
      const paymentResponse = await fetch('https://api.huastex.com/payments/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: sale.id,
          ...formData,
        }),
      });

      if (!paymentResponse.ok) {
        throw new Error('Failed to register payment');
      }

      const paymentResult = await paymentResponse.json();
      console.log('✔️ Payment registered:', paymentResult);

      // Register transaction
      const transactionPayload = buildPaymentPayload(sale, formData);
      const txRes = await fetch('https://api.huastex.com/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionPayload),
      });

      if (txRes.ok) {
        const txResult = await txRes.json();
        console.log('✔️ Transaction recorded:', txResult);
      }

      Alert.alert('Éxito', 'Abono registrado correctamente');
      onPaymentSuccess();
    } catch (error) {
      console.error('Error registering payment:', error);
      Alert.alert('Error', 'No se pudo registrar el abono');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Registrar Abono</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>Cerrar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form}>
            <Text style={styles.saleInfo}>
              Venta ID: {sale.id} - {sale.nombre}
            </Text>

            <Text style={styles.label}>Fecha *</Text>
            <TextInput
              style={styles.input}
              value={formData.fecha}
              onChangeText={(value) => handleInputChange('fecha', value)}
              placeholder="YYYY-MM-DD"
            />

            <Text style={styles.label}>Cantidad *</Text>
            <TextInput
              style={styles.input}
              value={formData.cantidad}
              onChangeText={(value) => handleInputChange('cantidad', value)}
              keyboardType="numeric"
              placeholder="0.00"
            />

            <Text style={styles.label}>Método de pago *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.payment_type}
                onValueChange={(value) => handleInputChange('payment_type', value)}
              >
                <Picker.Item label="Efectivo" value="deposit" />
                <Picker.Item label="Liquidó" value="settled" />
                <Picker.Item label="C/Tarjeta" value="credit_card" />
                <Picker.Item label="Transferencia" value="transfer" />
                <Picker.Item label="Online" value="online" />
                <Picker.Item label="Depósito en efectivo" value="cash_deposit" />
              </Picker>
            </View>

            <Text style={styles.label}>Cajero *</Text>
            <TextInput
              style={styles.input}
              value={formData.cajero}
              onChangeText={(value) => handleInputChange('cajero', value)}
              placeholder="Nombre del cajero"
            />

            <TouchableOpacity
              style={[styles.submitButton, isSaving && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Guardar Abono</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    color: '#dc3545',
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    padding: 16,
  },
  saleInfo: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    overflow: 'hidden',
  },
  submitButton: {
    backgroundColor: '#28a745',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});