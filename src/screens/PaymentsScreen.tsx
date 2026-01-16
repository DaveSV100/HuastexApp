// src/screens/PaymentsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

type PaymentsScreenRouteProp = RouteProp<
  { Payments: { saleId: number } },
  'Payments'
>;

interface Payment {
  id: number;
  fecha: string;
  cantidad: number;
  cajero: string;
  saldo_precio_normal: number;
  saldo_precio_promocion: number;
  payment_type?: string;
}

interface Sale {
  id: number;
  nombre: string;
  products: any[];
}

export default function PaymentsScreen(): React.JSX.Element {
  const route = useRoute<PaymentsScreenRouteProp>();
  const navigation = useNavigation();
  const { saleId } = route.params;

  const [payments, setPayments] = useState<Payment[]>([]);
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    loadRole();
    fetchPayments();
    fetchSale();
  }, []);

  const loadRole = async () => {
    const userRole = await AsyncStorage.getItem('role');
    setRole(userRole);
  };

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`https://api.huastex.com/payments/${saleId}`);
      const result = await response.json();
      setPayments(result);
    } catch (error) {
      console.error('Error fetching payments:', error);
      Alert.alert('Error', 'No se pudieron cargar los pagos');
    } finally {
      setLoading(false);
    }
  };

  const fetchSale = async () => {
    try {
      const resp = await api.get(`/sales/${saleId}`);
      setSale(resp.data || null);
    } catch (err) {
      console.error('Error fetching sale:', err);
    }
  };

  const handleDelete = async (paymentId: number) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Eliminar este abono?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/payments/${paymentId}`);
              fetchPayments();
              Alert.alert('Éxito', 'Abono eliminado');
            } catch (err) {
              console.error('Error deleting payment:', err);
              Alert.alert('Error', 'No se pudo eliminar el abono');
            }
          },
        },
      ]
    );
  };

  const formatDate = (isoDateStr: string) => {
    if (!isoDateStr) return '';
    const [datePart] = isoDateStr.split('T');
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
  };

  const canDelete = role === 'admin' || role === 'superadmin' || role === 'staff' || role === 'iT';

  const renderPaymentItem = ({ item }: { item: Payment }) => (
    <View style={styles.paymentCard}>
      <View style={styles.paymentHeader}>
        <Text style={styles.paymentId}>Abono #{item.id}</Text>
        <Text style={styles.paymentDate}>{formatDate(item.fecha)}</Text>
      </View>

      <View style={styles.paymentDetails}>
        <Text style={styles.detailRow}>
          <Text style={styles.detailLabel}>Cantidad: </Text>
          <Text style={styles.detailValue}>${item.cantidad}</Text>
        </Text>
        <Text style={styles.detailRow}>
          <Text style={styles.detailLabel}>Cajero: </Text>
          <Text style={styles.detailValue}>{item.cajero}</Text>
        </Text>
        <Text style={styles.detailRow}>
          <Text style={styles.detailLabel}>Saldo Precio Normal: </Text>
          <Text style={styles.detailValue}>${item.saldo_precio_normal}</Text>
        </Text>
        <Text style={styles.detailRow}>
          <Text style={styles.detailLabel}>Saldo Precio Promo.: </Text>
          <Text style={styles.detailValue}>${item.saldo_precio_promocion}</Text>
        </Text>
      </View>

      {canDelete && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.id)}
        >
          <Text style={styles.deleteButtonText}>Eliminar</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.title}>Abonos para Venta ID: {saleId}</Text>
      {sale && (
        <Text style={styles.subtitle}>Cliente: {sale.nombre}</Text>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        No hay abonos registrados para esta venta.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>← Volver</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPaymentItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f6fb',
  },
  backButton: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  backButtonText: {
    fontSize: 16,
    color: '#007bff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  headerContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  paymentId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  paymentDate: {
    fontSize: 14,
    color: '#666',
  },
  paymentDetails: {
    marginBottom: 12,
  },
  detailRow: {
    fontSize: 15,
    marginBottom: 6,
  },
  detailLabel: {
    fontWeight: '600',
    color: '#333',
  },
  detailValue: {
    color: '#555',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  loader: {
    marginTop: 50,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});