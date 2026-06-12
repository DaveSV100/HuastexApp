// src/screens/Sales/SalesScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Modal,
  ScrollView,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import api from '../../api';
import SaleModal from '../../components/SaleModal';
import PaymentsModal from '../../components/PaymentsModal';
import PrintTicketModal from '../../components/PrintTicketModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, CommonActions, useFocusEffect, useRoute } from '@react-navigation/native';

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

// Lowercase and strip accents so the search matches regardless of tildes:
// "Pérez" is found typing "perez" and "Maria" is found typing "maría".
const normalizeSearchText = (s: string) => {
  try {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  } catch {
    return s.toLowerCase();
  }
};

export default function SalesScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isPaymentsModalOpen, setIsPaymentsModalOpen] = useState(false);
  const [selectedSaleForPayment, setSelectedSaleForPayment] = useState<Sale | null>(null);
  const [editingSaleData, setEditingSaleData] = useState<Sale | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  // Sale shown in the "download as image" preview modal (null = closed).
  const [downloadSale, setDownloadSale] = useState<Sale | null>(null);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const receiptRef = useRef<any>(null);
  // Sale shown in the thermal-print preview modal (null = closed).
  const [printSale, setPrintSale] = useState<Sale | null>(null);
  // Sale opened in the ticket preview with the PDF share auto-triggered.
  const [pdfSale, setPdfSale] = useState<Sale | null>(null);

const BackImg = require('../../../Assets/back.png');
const LogoImg = require('../../../Assets/logo.png');

  const loadRole = async () => {
    const userRole = await AsyncStorage.getItem('role');
    setRole(userRole);
  };

  useEffect(() => {
    loadRole();
  }, []);

  // Refetch every time the screen regains focus (after create/edit/delete, or
  // when returning from Payments / Daily report) so the list is always fresh.
  useFocusEffect(
    useCallback(() => {
      fetchSales();
    }, [])
  );

  // Deep link from the daily report: pre-filter to the sale we were sent to.
  useEffect(() => {
    const focusId = route.params?.focusSaleId;
    if (focusId != null) {
      setSearchQuery(String(focusId).toLowerCase());
    }
  }, [route.params]);

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
              // Single call. The DB cascades remove this sale's payments,
              // sale_products and daily-report transactions automatically — do
              // NOT delete transactions separately here.
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

  const handleSaveSaleImage = async () => {
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
      Alert.alert('Éxito', 'La venta se guardó como imagen en tu galería.');
      setDownloadSale(null);
    } catch (err) {
      console.error('Error saving sale image:', err);
      Alert.alert('Error', 'No se pudo guardar la imagen.');
    } finally {
      setIsSavingImage(false);
    }
  };

  // Both sides are accent-stripped so "Pérez" matches "perez" and vice versa.
  const normalizedQuery = normalizeSearchText(searchQuery);
  const filteredSales = sales.filter((sale) => {
    if (!sale) return false;
    const matchesId = sale.id.toString().includes(normalizedQuery);
    const matchesName = normalizeSearchText(sale.nombre || '').includes(normalizedQuery);
    const matchesProduct = sale.products?.some(
      (product) =>
        product?.title && normalizeSearchText(product.title).includes(normalizedQuery)
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
    // The DB stores plazo in several shapes: an object, a JSON string, or an
    // object whose .value is itself a JSON string (the web's SalesGrid
    // deep-parses these layers BEFORE validating — checking plazo.unit up
    // front discards rows whose unit only exists inside the nested JSON).
    let rawPlazo = plazo;
    if (typeof rawPlazo === 'string') {
      try {
        rawPlazo = JSON.parse(rawPlazo);
      } catch {
        return '';
      }
    }
    if (!rawPlazo) return '';
    if (typeof rawPlazo.value === 'string' && rawPlazo.value.trim().startsWith('{')) {
      try {
        const inner = JSON.parse(rawPlazo.value);
        rawPlazo = { value: inner.value ?? '', unit: inner.unit ?? rawPlazo.unit };
      } catch {}
    }
    const value = rawPlazo.value != null && rawPlazo.value !== '' ? String(rawPlazo.value) : '';
    if (!value) return '';
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

        <TouchableOpacity
          style={styles.downloadButton}
          onPress={() => setDownloadSale(sale)}
        >
          <Text style={styles.buttonText}>Descargar Imagen</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pdfButton}
          onPress={() => setPdfSale(sale)}
        >
          <Text style={styles.buttonText}>Descargar PDF</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.printButton}
          onPress={() => setPrintSale(sale)}
        >
          <Text style={styles.buttonText}>Imprimir recibo</Text>
        </TouchableOpacity>
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

      {printSale && (
        <PrintTicketModal
          sale={printSale}
          onClose={() => setPrintSale(null)}
        />
      )}

      {/* Ticket preview that auto-opens the share sheet with the PDF. */}
      {pdfSale && (
        <PrintTicketModal
          sale={pdfSale}
          autoPdf
          onClose={() => setPdfSale(null)}
        />
      )}

      {downloadSale && (
        <Modal
          visible
          animationType="slide"
          onRequestClose={() => setDownloadSale(null)}
        >
          <View style={styles.receiptContainer}>
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptHeaderTitle}>Venta #{downloadSale.id}</Text>
              <TouchableOpacity onPress={() => setDownloadSale(null)}>
                <Text style={styles.receiptCloseButton}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              {/* Everything inside ViewShot is what ends up in the saved image. */}
              <ViewShot
                ref={receiptRef}
                options={{ format: 'png', quality: 1 }}
                style={styles.receipt}
              >
                <Image
                  source={LogoImg}
                  style={styles.receiptLogo}
                  resizeMode="contain"
                />
                <Text style={styles.receiptBrand}>Huastex</Text>
                <Text style={styles.receiptWebsite}>Compra en huastex.com</Text>
                <Text style={styles.receiptTitle}>
                  Comprobante de Venta #{downloadSale.id}
                </Text>

                <Text style={styles.receiptText}>
                  <Text style={styles.detailLabel}>Cliente: </Text>
                  {downloadSale.nombre}
                </Text>
                <Text style={styles.receiptText}>
                  <Text style={styles.detailLabel}>Dirección: </Text>
                  {downloadSale.calleynumero}, {downloadSale.ciudad}, {downloadSale.estado}
                </Text>
                <Text style={styles.receiptText}>
                  <Text style={styles.detailLabel}>Fecha de compra: </Text>
                  {formatDate(downloadSale.fecha)}
                </Text>
                <Text style={styles.receiptText}>
                  <Text style={styles.detailLabel}>Sucursal: </Text>
                  {downloadSale.sucursal}
                </Text>
                <Text style={styles.receiptText}>
                  <Text style={styles.detailLabel}>Forma de pago: </Text>
                  {downloadSale.formadepago}
                </Text>

                <Text style={styles.receiptSection}>Productos</Text>
                {(downloadSale.products || [])
                  .filter((p) => p)
                  .map((product, index) => (
                    <View key={product.id || `product-${index}`} style={styles.productDetail}>
                      <Text style={styles.receiptText}>
                        {product.title || product.producto || 'Sin nombre'}
                        {product.serial_number ? ` (#Serie: ${product.serial_number})` : ''}
                      </Text>
                      <Text style={styles.receiptText}>
                        Cantidad: {product.quantity} — Precio unitario: ${product.unit_price}
                      </Text>
                    </View>
                  ))}

                <Text style={styles.receiptSection}>Importes</Text>
                <Text style={styles.receiptText}>
                  <Text style={styles.detailLabel}>Precio Normal: </Text>
                  ${downloadSale.precionormal}
                </Text>
                <Text style={styles.receiptText}>
                  <Text style={styles.detailLabel}>Precio Promoción: </Text>
                  ${downloadSale.preciopromocion}
                </Text>
                <Text style={styles.receiptText}>
                  <Text style={styles.detailLabel}>Enganche: </Text>
                  ${downloadSale.enganche}
                </Text>
                <Text style={styles.receiptText}>
                  <Text style={styles.detailLabel}>Saldo Precio Promoción: </Text>
                  ${downloadSale.saldo_precio_promocion}
                </Text>
                <Text style={styles.receiptText}>
                  <Text style={styles.detailLabel}>Saldo Precio Normal: </Text>
                  ${downloadSale.saldo_precio_normal}
                </Text>
                <Text style={styles.receiptText}>
                  <Text style={styles.detailLabel}>Plazo: </Text>
                  {formatPlazo(downloadSale.plazo)}
                </Text>
                <Text style={styles.receiptText}>
                  <Text style={styles.detailLabel}>Fecha de vencimiento: </Text>
                  {formatDate(downloadSale.fechavencimiento)}
                </Text>
                <Text style={styles.receiptText}>
                  <Text style={styles.detailLabel}>Agente de ventas: </Text>
                  {downloadSale.agentedeventas}
                </Text>
                {Boolean(downloadSale.aclaraciones) && (
                  <Text style={styles.receiptText}>
                    <Text style={styles.detailLabel}>Aclaraciones: </Text>
                    {downloadSale.aclaraciones}
                  </Text>
                )}

                {/* Only when the customer actually signed — otherwise the
                    image would carry an empty signature box. */}
                {Boolean(downloadSale.firmadigital) && (
                  <>
                    <Text style={styles.receiptSection}>Firma del cliente</Text>
                    <Image
                      source={{ uri: downloadSale.firmadigital }}
                      style={styles.receiptSignature}
                      resizeMode="contain"
                    />
                  </>
                )}
              </ViewShot>
            </ScrollView>

            <TouchableOpacity
              style={[styles.receiptSaveButton, isSavingImage && styles.receiptSaveButtonDisabled]}
              onPress={handleSaveSaleImage}
              disabled={isSavingImage}
            >
              {isSavingImage ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.receiptSaveButtonText}>Guardar en galería</Text>
              )}
            </TouchableOpacity>
          </View>
        </Modal>
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
  downloadButton: {
    backgroundColor: '#6f42c1',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 12,
  },
  printButton: {
    backgroundColor: '#fd7e14',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 12,
  },
  pdfButton: {
    backgroundColor: '#17a2b8',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 12,
  },
  receiptContainer: {
    flex: 1,
    backgroundColor: '#f3f6fb',
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
  },
  receiptHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  receiptCloseButton: {
    color: '#dc3545',
    fontSize: 16,
    fontWeight: '600',
  },
  receipt: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 8,
  },
  receiptLogo: {
    width: 160,
    height: 90,
    alignSelf: 'center',
    marginBottom: 6,
  },
  receiptBrand: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#007bff',
  },
  receiptWebsite: {
    fontSize: 14,
    textAlign: 'center',
    alignSelf: 'center',
    width: '100%',
    color: '#333',
    marginBottom: 4,
  },
  receiptTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  receiptSection: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 14,
    marginBottom: 6,
    color: '#007bff',
  },
  receiptText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  receiptSignature: {
    height: 140,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  receiptSaveButton: {
    backgroundColor: '#28a745',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  receiptSaveButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  receiptSaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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