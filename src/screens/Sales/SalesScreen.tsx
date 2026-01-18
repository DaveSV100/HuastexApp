// src/screens/Sales/SalesScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import api from '../../api';
import SaleModal from '../../components/SaleModal';
import PaymentsModal from '../../components/PaymentsModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, CommonActions } from '@react-navigation/native';

interface Sale {
  id: number;
  nombre: string;
  email: string;
  phone: string;
  calleynumero: string;
  ciudad: string;
  estado: string;
  fecha: string;
  formadepago: string;
  sucursal: string;
  products: any[];
  enganche: number;
  preciopromocion: number;
  precionormal: number;
  discount: number;
  saldo_precio_promocion: number;
  saldo_precio_normal: number;
  plazo: any;
  fechavencimiento: string;
  agentedeventas: string;
  aclaraciones: string;
  firmadigital?: string;
}

interface SaleModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: (data: any) => void;
  initialData: any | null;
}

export default function SalesScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isPaymentsModalOpen, setIsPaymentsModalOpen] = useState(false);
  const [selectedSaleForPayment, setSelectedSaleForPayment] = useState<Sale | null>(null);
  const [editingSaleData, setEditingSaleData] = useState<Sale | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState<string | null>(null);

const BackImg = require('../../../Assets/back.png'); 

  const loadRole = async () => {
    const userRole = await AsyncStorage.getItem('role');
    setRole(userRole);
  };

  useEffect(() => {
    fetchSales();
    loadRole();
  }, []);

  const fetchSales = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/sales');
      setSales(response.data);
    } catch (error: any) {
      console.error('Error fetching sales:', error);
      Alert.alert('Error', 'No se pudieron cargar las ventas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewSale = () => {
    setEditingSaleData(null);
    setIsSaleModalOpen(true);
  };

  const handleEditSale = (saleObj: Sale) => {
    setEditingSaleData(saleObj);
    setIsSaleModalOpen(true);
  };

  const handleCloseSaleModal = () => {
    setIsSaleModalOpen(false);
    setEditingSaleData(null);
  };

  const handleSaleSaved = () => {
    fetchSales();
    handleCloseSaleModal();
  };

  const handleDeleteSale = async (saleId: number) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Seguro que quieres eliminar esta venta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/sales/${saleId}`);
              fetchSales();
              Alert.alert('Éxito', 'Venta eliminada');
            } catch (err) {
              console.error('Error deleting sale:', err);
              Alert.alert('Error', 'No se pudo eliminar la venta');
            }
          },
        },
      ]
    );
  };

  const handleRegisterPayment = (sale: Sale) => {
    setSelectedSaleForPayment(sale);
    setIsPaymentsModalOpen(true);
  };

  const handleClosePaymentsModal = () => {
    setIsPaymentsModalOpen(false);
    setSelectedSaleForPayment(null);
  };

  const handlePaymentSuccess = () => {
    fetchSales();
    handleClosePaymentsModal();
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text.toLowerCase());
  };

  const filteredSales = sales.filter((sale) => {
    if (!sale) return false;
    const matchesId = sale.id.toString().includes(searchQuery);
    const matchesName = sale.nombre?.toLowerCase().includes(searchQuery);
    const matchesProduct = sale.products?.some(
      (product) =>
        product?.title && product.title.toLowerCase().includes(searchQuery)
    );
    return matchesId || matchesName || matchesProduct;
  });

  const sortedSales = [...filteredSales].sort((a, b) => b.id - a.id);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { timeZone: 'UTC' });
  };

  const formatProductTitles = (products: any[]) => {
    if (!products) return '';
    return products
      .filter((product) => product !== null)
      .map((product) => product.title || product.producto || 'Sin nombre')
      .join(', ');
  };

  const formatPlazo = (plazo: any) => {
    if (!plazo || !plazo.value || !plazo.unit) return '';
    let rawPlazo = plazo;
    if (typeof rawPlazo.value === 'string' && rawPlazo.value.trim().startsWith('{')) {
      try {
        rawPlazo = JSON.parse(rawPlazo.value);
      } catch {}
    }
    const value = rawPlazo.value != null ? String(rawPlazo.value) : '';
    const unit = ['days', 'weeks', 'months'].includes(rawPlazo.unit) ? rawPlazo.unit : 'weeks';
    const label = unit === 'days' ? 'días' : unit === 'weeks' ? 'semanas' : 'meses';
    return `${value} ${label}`;
  };

  const canEditDelete = role === 'admin' || role === 'superadmin' || role === 'staff' || role === 'iT';

  const renderSaleItem = ({ item: sale }: { item: Sale }) => {
    const discount = isNaN(Number(sale.discount)) ? 0 : Number(sale.discount);
    const creditForms = ['Crédito', 'MSI', 'Apartado'];
    const isCreditSale = creditForms.includes(sale.formadepago);
    
    return (
      <>
        <View style={styles.saleCard}>
        <View style={styles.saleHeader}>
          <Text style={styles.saleId}>ID: {sale.id}</Text>
          <Text style={styles.saleName}>{sale.nombre}</Text>
        </View>

        <View style={styles.saleDetails}>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Productos: </Text>
            {formatProductTitles(sale.products)}
          </Text>

          {sale.products &&
            sale.products.filter((p) => p).map((product, index) => (
              <View key={product.id || `product-${index}`} style={styles.productDetail}>
                <Text style={styles.detailText}>
                  <Text style={styles.detailLabel}>Producto: </Text>
                  {product.title || product.producto || 'Sin nombre'}
                  {product.serial_number ? ` (#Serie: ${product.serial_number})` : ''}
                </Text>
                <Text style={styles.detailText}>
                  <Text style={styles.detailLabel}>Cantidad: </Text>
                  {product.quantity}
                </Text>
                <Text style={styles.detailText}>
                  <Text style={styles.detailLabel}>Precio Unitario: </Text>
                  ${product.unit_price}
                </Text>
              </View>
            ))}

          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Precio Normal: </Text>${sale.precionormal}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Precio Promoción: </Text>${sale.preciopromocion}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Enganche: </Text>${sale.enganche}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Saldo Precio Promoción: </Text>
            ${sale.saldo_precio_promocion}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Saldo Precio Normal: </Text>
            ${sale.saldo_precio_normal}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Fecha de Vencimiento: </Text>
            {formatDate(sale.fechavencimiento)}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Forma de Pago: </Text>
            {sale.formadepago}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Descuento: </Text>
            {discount}%
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Calle y Número: </Text>
            {sale.calleynumero}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Ciudad: </Text>
            {sale.ciudad}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Estado: </Text>
            {sale.estado}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Fecha de compra: </Text>
            {formatDate(sale.fecha)}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Plazo: </Text>
            {formatPlazo(sale.plazo)}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Sucursal: </Text>
            {sale.sucursal}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Agente de Ventas: </Text>
            {sale.agentedeventas}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Email: </Text>
            {sale.email}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Teléfono: </Text>
            {sale.phone}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Aclaraciones: </Text>
            {sale.aclaraciones}
          </Text>
        </View>

        {isCreditSale && (
          <View style={styles.paymentButtonsContainer}>
            {canEditDelete && (
              <TouchableOpacity
                style={styles.paymentButton}
                onPress={() => handleRegisterPayment(sale)}
              >
                <Text style={styles.buttonText}>Registrar Abono</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.viewPaymentsButton}
              onPress={() => {
                (navigation as any).navigate('Payments', { saleId: sale.id });
              }}
            >
              <Text style={styles.buttonText}>Ver Pagos</Text>
            </TouchableOpacity>
          </View>
        )}

        {canEditDelete && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => handleEditSale(sale)}
            >
              <Text style={styles.buttonText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteSale(sale.id)}
            >
              <Text style={styles.buttonText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      </>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header moved OUTSIDE of FlatList to prevent TextInput losing focus */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        })
      )}>
        <Image source={BackImg} style={styles.backIcon} />
      </TouchableOpacity>
        <Text style={styles.title}>Ventas</Text>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por ID, Nombre o Producto"
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
        </View>

        <TouchableOpacity
          style={styles.newSaleButton}
          onPress={handleCreateNewSale}
        >
          <Text style={styles.newSaleButtonText}>Smart Venta</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
      ) : (
        <FlatList
          data={sortedSales}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderSaleItem}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No tienes ningún pedido</Text>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {isSaleModalOpen && (
        <SaleModal
          visible={isSaleModalOpen}
          onClose={handleCloseSaleModal}
          onSaved={handleSaleSaved}
          initialData={editingSaleData}
        />
      )}

      {isPaymentsModalOpen && selectedSaleForPayment && (
        <PaymentsModal
          visible={isPaymentsModalOpen}
          sale={selectedSaleForPayment}
          onClose={handleClosePaymentsModal}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backIcon: { 
    width: 40, height: 40, resizeMode: 'contain'
  },
  container: {
    flex: 1,
    backgroundColor: '#f3f6fb',
  },
  headerContainer: {
    padding: 16,
    paddingBottom: 0,
    backgroundColor: '#f3f6fb',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  newSaleButton: {
    backgroundColor: '#007bff',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  newSaleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saleCard: {
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
  saleHeader: {
    marginBottom: 12,
  },
  saleId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  saleName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  saleDetails: {
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  detailLabel: {
    fontWeight: '600',
  },
  productDetail: {
    marginLeft: 12,
    marginTop: 4,
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#007bff',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  paymentButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
  },
  paymentButton: {
    flex: 1,
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 6,
    marginRight: 8,
    alignItems: 'center',
  },
  viewPaymentsButton: {
    flex: 1,
    backgroundColor: '#17a2b8',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 6,
    marginRight: 8,
    alignItems: 'center',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#dc3545',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  loader: {
    marginTop: 50,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: '#666',
  },
});