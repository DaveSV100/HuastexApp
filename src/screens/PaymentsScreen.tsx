// src/screens/PaymentsScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ViewShot from 'react-native-view-shot';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import api from '../api';
import PrintTicketModal from '../components/PrintTicketModal';
import ReceiptTicket from '../components/ReceiptTicket';

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
  // Abono shown in the thermal-print preview modal (null = closed).
  const [printPayment, setPrintPayment] = useState<Payment | null>(null);
  // Abono shown in the save-as-image preview modal (null = closed).
  const [downloadPayment, setDownloadPayment] = useState<Payment | null>(null);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const receiptRef = useRef<any>(null);

  const handleSavePaymentImage = async () => {
    if (!receiptRef.current) return;
    setIsSavingImage(true);
    try {
      // Android 9 and below still need the legacy storage permission;
      // Android 10+ saves through MediaStore without asking.
      if (Platform.OS === 'android' && Number(Platform.Version) < 29) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permiso denegado', 'No se puede guardar la imagen sin permiso de almacenamiento.');
          return;
        }
      }
      const uri = await receiptRef.current.capture();
      await CameraRoll.saveAsset(uri, { type: 'photo' });
      Alert.alert('Éxito', 'El abono se guardó como imagen en tu galería.');
      setDownloadPayment(null);
    } catch (err) {
      console.error('Error saving payment image:', err);
      Alert.alert('Error', 'No se pudo guardar la imagen.');
    } finally {
      setIsSavingImage(false);
    }
  };

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

  const handleDelete = async (payment: Payment) => {
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
              // Deleting the payment also removes its daily-report row automatically:
              // transactions.payment_id FK is ON DELETE CASCADE.
              await api.delete(`/payments/${payment.id}`);
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

      <TouchableOpacity
        style={styles.downloadButton}
        onPress={() => setDownloadPayment(item)}
      >
        <Text style={styles.printButtonText}>Descargar Imagen</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.printButton}
        onPress={() => setPrintPayment(item)}
      >
        <Text style={styles.printButtonText}>Imprimir recibo</Text>
      </TouchableOpacity>

      {canDelete && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item)}
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

      {printPayment && (
        <PrintTicketModal
          sale={sale}
          payment={printPayment}
          onClose={() => setPrintPayment(null)}
        />
      )}

      {downloadPayment && (
        <Modal
          visible
          animationType="slide"
          onRequestClose={() => setDownloadPayment(null)}
        >
          <View style={styles.downloadContainer}>
            <View style={styles.downloadHeader}>
              <Text style={styles.downloadHeaderTitle}>
                Abono #{downloadPayment.id}
              </Text>
              <TouchableOpacity onPress={() => setDownloadPayment(null)}>
                <Text style={styles.downloadCloseButton}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.downloadPreview}>
              {/* Everything inside ViewShot is what gets saved. */}
              <ViewShot ref={receiptRef} options={{ format: 'png', quality: 1 }}>
                <ReceiptTicket sale={sale} payment={downloadPayment} />
              </ViewShot>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveImageButton, isSavingImage && styles.saveImageButtonDisabled]}
              onPress={handleSavePaymentImage}
              disabled={isSavingImage}
            >
              {isSavingImage ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveImageButtonText}>Guardar en galería</Text>
              )}
            </TouchableOpacity>
          </View>
        </Modal>
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
  downloadButton: {
    backgroundColor: '#6f42c1',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 8,
  },
  printButton: {
    backgroundColor: '#fd7e14',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  downloadContainer: {
    flex: 1,
    backgroundColor: '#f3f6fb',
  },
  downloadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
  },
  downloadHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  downloadCloseButton: {
    color: '#dc3545',
    fontSize: 16,
    fontWeight: '600',
  },
  downloadPreview: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  saveImageButton: {
    backgroundColor: '#28a745',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveImageButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  saveImageButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  printButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
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