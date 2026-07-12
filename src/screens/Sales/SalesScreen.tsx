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
  AppState,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import api from '../../api';
import SaleModal from '../../components/SaleModal';
import PaymentsModal from '../../components/PaymentsModal';
import PrintTicketModal from '../../components/PrintTicketModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, CommonActions, useFocusEffect, useRoute } from '@react-navigation/native';
import { getPaymentInfo, SaleStatus } from '../../utils/paymentStatus';
import {
  normalizePhoneMx,
  buildPaymentReminder,
  openWhatsAppText,
  shareImageToWhatsApp,
} from '../../utils/whatsapp';

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
  payment_frequency?: string | null;
  pp_enabled?: boolean | null;
}

const STATUS_META: Record<SaleStatus, { label: string; icon: any }> = {
  vencida: { label: 'Vencidas', icon: require('../../../Assets/overdue.png') },
  atrasada: { label: 'Atrasadas', icon: require('../../../Assets/late.png') },
  a_tiempo: { label: 'A tiempo', icon: require('../../../Assets/ontime.png') },
  pagada: { label: 'Pagadas', icon: require('../../../Assets/paid.png') },
};
const STATUS_KEYS = Object.keys(STATUS_META) as SaleStatus[];

// Extra orderings offered while an estado filter (except pagadas) is active;
// 'id' = the default "newest sale first" used everywhere else.
type SortMode = 'id' | 'cantidad' | 'tiempo' | 'vencimiento';
const SORT_LABELS: Record<SortMode, string> = {
  id: 'Más reciente',
  cantidad: 'Cantidad atrasada',
  tiempo: 'Tiempo atrasado',
  vencimiento: 'Vencimiento próximo',
};

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
  const [userBranch, setUserBranch] = useState('');
  // Sale shown in the "download as image" preview modal (null = closed).
  const [downloadSale, setDownloadSale] = useState<Sale | null>(null);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const receiptRef = useRef<any>(null);
  // Sale shown in the thermal-print preview modal (null = closed).
  const [printSale, setPrintSale] = useState<Sale | null>(null);
  // Sale opened in the ticket preview with the PDF share auto-triggered.
  const [pdfSale, setPdfSale] = useState<Sale | null>(null);
  // Estado filter driven by the notebook menu (null = show every sale).
  const [statusFilter, setStatusFilter] = useState<SaleStatus | null>(null);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  // Only applied while an eligible estado filter is active; resets to the
  // default whenever the filter changes so lists always start predictable.
  const [sortMode, setSortMode] = useState<SortMode>('id');
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  // Bulk WhatsApp reminders: pending sales + whether we're waiting for the
  // user to come back from WhatsApp before offering the next one.
  const reminderQueueRef = useRef<Sale[]>([]);
  const awaitingWhatsAppReturnRef = useRef(false);

const BackImg = require('../../../Assets/back.png');
const LogoImg = require('../../../Assets/logo.png');
const NotebookImg = require('../../../Assets/notebook.png');
const DownloadImg = require('../../../Assets/download.png');
const EditImg = require('../../../Assets/edit.png');
const TrashImg = require('../../../Assets/trash.png');

  const loadRole = async () => {
    const userRole = await AsyncStorage.getItem('role');
    const storedBranch = (await AsyncStorage.getItem('branch')) || '';
    setRole(userRole);
    setUserBranch(storedBranch);
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

  // "Habilitar PP": manually restore the promo price after the 15-day window.
  const handleEnablePP = (sale: Sale) => {
    Alert.alert(
      'Habilitar Precio Promoción',
      `¿Restaurar el precio de promoción de la venta #${sale.id}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Habilitar',
          onPress: async () => {
            try {
              await api.patch(`/sales/${sale.id}/pp`, { enabled: true });
              fetchSales();
              Alert.alert('Éxito', 'Precio de promoción habilitado');
            } catch (err) {
              console.error('Error enabling PP:', err);
              Alert.alert('Error', 'No se pudo habilitar el precio de promoción');
            }
          },
        },
      ]
    );
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

  // ── WhatsApp ──────────────────────────────────────────────────────────
  const handleSendReminder = (sale: Sale) => {
    const phone = normalizePhoneMx(sale.phone);
    if (!phone) {
      Alert.alert('Sin teléfono', 'Esta venta no tiene un número de teléfono válido.');
      return;
    }
    openWhatsAppText(phone, buildPaymentReminder(sale, getPaymentInfo(sale)));
  };

  const handleSendSaleImageWhatsApp = async () => {
    if (!receiptRef.current || !downloadSale) return;
    setIsSendingWhatsApp(true);
    try {
      const uri = await receiptRef.current.capture();
      await shareImageToWhatsApp(normalizePhoneMx(downloadSale.phone), uri);
    } catch (err) {
      console.error('Error sharing sale image:', err);
      Alert.alert('Error', 'No se pudo compartir la imagen.');
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // Bulk reminders walk the filtered list one WhatsApp chat at a time: the
  // OS can't send messages unattended, so each customer needs one tap on
  // WhatsApp's send button. When the user returns to the app we offer the
  // next customer automatically.
  const offerNextReminder = useCallback(() => {
    const next = reminderQueueRef.current[0];
    if (!next) {
      Alert.alert('Listo', 'No quedan más recordatorios por enviar.');
      return;
    }
    const remaining = reminderQueueRef.current.length;
    const info = getPaymentInfo(next);
    Alert.alert(
      `Recordatorio — quedan ${remaining}`,
      `${next.nombre} (venta #${next.id})`,
      [
        {
          text: 'Detener',
          style: 'cancel',
          onPress: () => {
            reminderQueueRef.current = [];
          },
        },
        {
          text: 'Omitir',
          onPress: () => {
            reminderQueueRef.current = reminderQueueRef.current.slice(1);
            offerNextReminder();
          },
        },
        {
          text: 'Enviar',
          onPress: () => {
            reminderQueueRef.current = reminderQueueRef.current.slice(1);
            awaitingWhatsAppReturnRef.current = true;
            const phone = normalizePhoneMx(next.phone);
            if (phone) {
              openWhatsAppText(phone, buildPaymentReminder(next, info));
            }
          },
        },
      ],
    );
  }, []);

  // Coming back from WhatsApp re-activates the app → offer the next one.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && awaitingWhatsAppReturnRef.current) {
        awaitingWhatsAppReturnRef.current = false;
        setTimeout(offerNextReminder, 600);
      }
    });
    return () => sub.remove();
  }, [offerNextReminder]);

  const startBulkReminders = (targets: Sale[]) => {
    const withPhone = targets.filter((s) => normalizePhoneMx(s.phone));
    const skipped = targets.length - withPhone.length;
    if (!withPhone.length) {
      Alert.alert('Sin teléfonos', 'Ninguna de estas ventas tiene un número válido.');
      return;
    }
    Alert.alert(
      'Recordatorios por WhatsApp',
      `Se abrirá WhatsApp para ${withPhone.length} cliente(s), uno por uno.` +
        (skipped ? ` ${skipped} venta(s) sin teléfono se omitirán.` : ''),
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Comenzar',
          onPress: () => {
            reminderQueueRef.current = withPhone;
            offerNextReminder();
          },
        },
      ],
    );
  };

  // staff/iT only ever see their own branch's sales; admin/superadmin see all.
  // The branch may be stored as a display name ("Cerro Azul") while sales carry
  // slugs ("cerroazul"), so normalize both sides before comparing. While the
  // role is still loading nothing is shown, so other branches never flash by.
  const toBranchSlug = (s: string) => (s || '').toLowerCase().replace(/\s+/g, '');
  const branchScopedSales =
    role === null
      ? []
      : role === 'staff' || role === 'iT'
      ? sales.filter((sale) => sale && toBranchSlug(sale.sucursal) === toBranchSlug(userBranch))
      : sales;

  // Both sides are accent-stripped so "Pérez" matches "perez" and vice versa.
  const normalizedQuery = normalizeSearchText(searchQuery);
  const filteredSales = branchScopedSales.filter((sale) => {
    if (!sale) return false;
    const matchesId = sale.id.toString().includes(normalizedQuery);
    const matchesName = normalizeSearchText(sale.nombre || '').includes(normalizedQuery);
    const matchesProduct = sale.products?.some(
      (product) =>
        product?.title && normalizeSearchText(product.title).includes(normalizedQuery)
    );
    return matchesId || matchesName || matchesProduct;
  });

  // Counts shown in the notebook menu (over the search results, before the
  // estado filter is applied, so the numbers always add up to what's listed).
  const statusCounts = filteredSales.reduce(
    (acc, sale) => {
      acc[getPaymentInfo(sale).status] += 1;
      return acc;
    },
    { vencida: 0, atrasada: 0, a_tiempo: 0, pagada: 0 } as Record<SaleStatus, number>
  );

  const statusFilteredSales = statusFilter
    ? filteredSales.filter((sale) => getPaymentInfo(sale).status === statusFilter)
    : filteredSales;

  // Default order everywhere: newest sale first. While an estado filter
  // (except pagadas) is active, the "Ordenar" button can switch to a
  // collection-priority order; getPaymentInfo is computed once per sale
  // (not per comparison) before sorting.
  const sortableFilter =
    statusFilter === 'atrasada' ||
    statusFilter === 'vencida' ||
    statusFilter === 'a_tiempo';
  let sortedSales: Sale[];
  if (sortableFilter && sortMode !== 'id') {
    const decorated = statusFilteredSales.map((s) => ({ s, info: getPaymentInfo(s) }));
    decorated.sort((a, b) => {
      if (sortMode === 'cantidad') {
        // Biggest debt first.
        if (b.info.cantidadAtrasada !== a.info.cantidadAtrasada) {
          return b.info.cantidadAtrasada - a.info.cantidadAtrasada;
        }
      } else if (sortMode === 'tiempo') {
        // Most overdue first: periods behind, then days past due.
        if (b.info.tiempoAtrasado !== a.info.tiempoAtrasado) {
          return b.info.tiempoAtrasado - a.info.tiempoAtrasado;
        }
        const dA = a.info.daysPastDue ?? -Infinity;
        const dB = b.info.daysPastDue ?? -Infinity;
        if (dB !== dA) return dB - dA;
      } else {
        // Soonest fecha de vencimiento first; sales without a (valid) date
        // go last.
        const rawA = new Date(a.s.fechavencimiento || '').getTime();
        const rawB = new Date(b.s.fechavencimiento || '').getTime();
        const tA = Number.isNaN(rawA) ? Infinity : rawA;
        const tB = Number.isNaN(rawB) ? Infinity : rawB;
        if (tA !== tB) return tA - tB;
      }
      return b.s.id - a.s.id;
    });
    sortedSales = decorated.map((d) => d.s);
  } else {
    sortedSales = [...statusFilteredSales].sort((a, b) => b.id - a.id);
  }

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
    // Payment-plan math: estado, installment, atrasos, promo window, recargo.
    const info = getPaymentInfo(sale);

    return (
      <>
        <View style={styles.saleCard}>
        <View style={styles.saleHeader}>
          <View style={styles.saleHeaderLeft}>
            <Text style={styles.saleId}>ID: {sale.id}</Text>
            <Text style={styles.saleName}>{sale.nombre}</Text>
          </View>
          <View style={styles.estadoBadge}>
            <Text style={styles.estadoLabel}>Estado:</Text>
            <Image
              source={STATUS_META[info.status].icon}
              style={styles.estadoIcon}
              resizeMode="contain"
            />
          </View>
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
          {/* Grayed out >15 days past due: only precio normal applies then,
              unless staff pressed "Habilitar PP". */}
          <Text
            style={[styles.detailText, !info.promoActive && styles.detailTextInactive]}
          >
            <Text style={styles.detailLabel}>Saldo Precio Promoción: </Text>
            ${sale.saldo_precio_promocion}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.detailLabel}>Saldo Precio Normal: </Text>
            ${sale.saldo_precio_normal}
          </Text>
          {info.surchargePct > 0 && (
            <Text style={[styles.detailText, styles.surchargeText]}>
              <Text style={styles.detailLabel}>
                Saldo Precio Normal (recargo +{info.surchargePct}%):{' '}
              </Text>
              ${info.saldoNormalConRecargo.toFixed(2)}
            </Text>
          )}
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
          {info.isCredit && (
            <>
              {info.frequency && (
                <Text style={styles.detailText}>
                  <Text style={styles.detailLabel}>Frecuencia de pago: </Text>
                  {info.frequency}
                </Text>
              )}
              {info.pagosDe != null && (
                <Text style={styles.detailText}>
                  <Text style={styles.detailLabel}>Pagos de: </Text>
                  ${info.pagosDe.toFixed(2)}
                  {info.frequency === 'Al terminar' ? ' (al terminar el plazo)' : ''}
                </Text>
              )}
              {info.status !== 'pagada' && (
                <>
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Tiempo atrasado: </Text>
                    {info.periodLabel
                      ? `${info.tiempoAtrasado} ${info.periodLabel}`
                      : info.daysPastDue != null && info.daysPastDue > 0
                        ? `${info.daysPastDue} día(s)`
                        : '0'}
                  </Text>
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Cantidad atrasada: </Text>
                    ${info.cantidadAtrasada.toFixed(2)}
                  </Text>
                </>
              )}
            </>
          )}
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

          {info.isCredit && info.status === 'pagada' && (
            <Text style={styles.paidBadge}>PAGADO</Text>
          )}

          {canEditDelete && info.isCredit && !info.promoActive && (
            <TouchableOpacity
              style={styles.enablePpButton}
              onPress={() => handleEnablePP(sale)}
            >
              <Text style={styles.enablePpButtonText}>Habilitar PP</Text>
            </TouchableOpacity>
          )}
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

        <View style={styles.iconActionsRow}>
          <TouchableOpacity
            style={styles.iconActionButton}
            onPress={() =>
              Alert.alert('Descargar', 'Elige el formato', [
                { text: 'Imagen', onPress: () => setDownloadSale(sale) },
                { text: 'PDF', onPress: () => setPdfSale(sale) },
                { text: 'Cancelar', style: 'cancel' },
              ])
            }
          >
            <Image source={DownloadImg} style={styles.actionIcon} resizeMode="contain" />
          </TouchableOpacity>

          {canEditDelete && (
            <>
              <TouchableOpacity
                style={styles.iconActionButton}
                onPress={() => handleEditSale(sale)}
              >
                <Image source={EditImg} style={styles.actionIcon} resizeMode="contain" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconActionButton}
                onPress={() => handleDeleteSale(sale.id)}
              >
                <Image source={TrashImg} style={styles.actionIcon} resizeMode="contain" />
              </TouchableOpacity>
            </>
          )}
        </View>

        {Boolean(normalizePhoneMx(sale.phone)) && (
          <View style={styles.downloadRow}>
            {info.isCredit && info.status !== 'pagada' && (
              <TouchableOpacity
                style={styles.whatsappButton}
                onPress={() => handleSendReminder(sale)}
              >
                <Text style={styles.buttonText}>Recordar pago</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.whatsappButton}
              onPress={() => setDownloadSale(sale)}
            >
              <Text style={styles.buttonText}>Enviar recibo</Text>
            </TouchableOpacity>
          </View>
        )}

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
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            })
          )}>
            <Image source={BackImg} style={styles.backIcon} />
          </TouchableOpacity>
          <Text style={styles.title}>Ventas</Text>
          <TouchableOpacity onPress={() => setIsStatusMenuOpen(true)}>
            <Image source={NotebookImg} style={styles.notebookIcon} resizeMode="contain" />
          </TouchableOpacity>
        </View>

        {statusFilter && (
          <TouchableOpacity
            style={styles.activeFilterChip}
            onPress={() => {
              setStatusFilter(null);
              setSortMode('id');
            }}
          >
            <Image
              source={STATUS_META[statusFilter].icon}
              style={styles.activeFilterIcon}
              resizeMode="contain"
            />
            <Text style={styles.activeFilterText}>
              {STATUS_META[statusFilter].label} — tocar para mostrar todas
            </Text>
          </TouchableOpacity>
        )}

        {sortableFilter && (
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() =>
              Alert.alert('Ordenar por', undefined, [
                {
                  text: 'Cantidad atrasada (mayor primero)',
                  onPress: () => setSortMode('cantidad'),
                },
                {
                  text: 'Tiempo atrasado (más atrasado primero)',
                  onPress: () => setSortMode('tiempo'),
                },
                {
                  text: 'Vencimiento (más próximo primero)',
                  onPress: () => setSortMode('vencimiento'),
                },
                {
                  text: 'Más reciente (por defecto)',
                  onPress: () => setSortMode('id'),
                },
                { text: 'Cancelar', style: 'cancel' },
              ])
            }
          >
            <Text style={styles.sortButtonText}>
              Ordenar: {SORT_LABELS[sortMode]} ▾
            </Text>
          </TouchableOpacity>
        )}

        {(statusFilter === 'atrasada' || statusFilter === 'vencida') &&
          sortedSales.length > 0 && (
            <TouchableOpacity
              style={styles.bulkReminderButton}
              onPress={() => startBulkReminders(sortedSales)}
            >
              <Text style={styles.buttonText}>
                Recordar pago a todos ({sortedSales.length})
              </Text>
            </TouchableOpacity>
          )}

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

      {/* Notebook menu: filter the list by estado. */}
      <Modal
        visible={isStatusMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsStatusMenuOpen(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setIsStatusMenuOpen(false)}
        >
          <View style={styles.statusMenu}>
            {STATUS_KEYS.map((key) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.statusMenuItem,
                  statusFilter === key && styles.statusMenuItemActive,
                ]}
                onPress={() => {
                  setStatusFilter((prev) => (prev === key ? null : key));
                  setSortMode('id');
                  setIsStatusMenuOpen(false);
                }}
              >
                <Image
                  source={STATUS_META[key].icon}
                  style={styles.statusMenuIcon}
                  resizeMode="contain"
                />
                <Text style={styles.statusMenuLabel}>
                  {STATUS_META[key].label} ({statusCounts[key]})
                </Text>
              </TouchableOpacity>
            ))}
            {statusFilter && (
              <TouchableOpacity
                style={styles.statusMenuItem}
                onPress={() => {
                  setStatusFilter(null);
                  setSortMode('id');
                  setIsStatusMenuOpen(false);
                }}
              >
                <Text style={styles.statusMenuClear}>Mostrar todas</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

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
                {(() => {
                  // Promo rule: once the promo window is gone the customer
                  // only sees normal pricing with the surcharge included.
                  const dlInfo = getPaymentInfo(downloadSale);
                  const promoGone = dlInfo.isCredit && !dlInfo.promoActive;
                  const factor = 1 + dlInfo.surchargePct / 100;
                  const normalShown = promoGone
                    ? (Number(downloadSale.precionormal) * factor).toFixed(2)
                    : downloadSale.precionormal;
                  const saldoNormalShown = promoGone
                    ? dlInfo.saldoNormalConRecargo.toFixed(2)
                    : downloadSale.saldo_precio_normal;
                  return (
                    <>
                      <Text style={styles.receiptText}>
                        <Text style={styles.detailLabel}>
                          Precio Normal{promoGone && dlInfo.surchargePct ? ' (con interés)' : ''}:{' '}
                        </Text>
                        ${normalShown}
                      </Text>
                      {!promoGone && (
                        <Text style={styles.receiptText}>
                          <Text style={styles.detailLabel}>Precio Promoción: </Text>
                          ${downloadSale.preciopromocion}
                        </Text>
                      )}
                      <Text style={styles.receiptText}>
                        <Text style={styles.detailLabel}>Enganche: </Text>
                        ${downloadSale.enganche}
                      </Text>
                      {!promoGone && (
                        <Text style={styles.receiptText}>
                          <Text style={styles.detailLabel}>Saldo Precio Promoción: </Text>
                          ${downloadSale.saldo_precio_promocion}
                        </Text>
                      )}
                      <Text style={styles.receiptText}>
                        <Text style={styles.detailLabel}>
                          Saldo Precio Normal{promoGone && dlInfo.surchargePct ? ' (con interés)' : ''}:{' '}
                        </Text>
                        ${saldoNormalShown}
                      </Text>
                    </>
                  );
                })()}
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

                {(() => {
                  const dlInfo = getPaymentInfo(downloadSale);
                  return dlInfo.isCredit && dlInfo.status === 'pagada' ? (
                    <Text style={styles.receiptPaidStamp}>PAGADO</Text>
                  ) : null;
                })()}

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

            {Boolean(normalizePhoneMx(downloadSale.phone)) && (
              <TouchableOpacity
                style={[
                  styles.receiptWhatsAppButton,
                  isSendingWhatsApp && styles.receiptSaveButtonDisabled,
                ]}
                onPress={handleSendSaleImageWhatsApp}
                disabled={isSendingWhatsApp}
              >
                {isSendingWhatsApp ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.receiptSaveButtonText}>
                    Enviar por WhatsApp
                  </Text>
                )}
              </TouchableOpacity>
            )}
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
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  notebookIcon: {
    width: 36,
    height: 36,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#e7f1ff',
    borderWidth: 1,
    borderColor: '#007bff',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  activeFilterIcon: {
    width: 18,
    height: 18,
    marginRight: 6,
  },
  activeFilterText: {
    color: '#007bff',
    fontSize: 13,
    fontWeight: '600',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  saleHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  estadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  estadoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginRight: 4,
  },
  estadoIcon: {
    width: 24,
    height: 24,
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
  // Promo saldo once the 15-day window passed: visibly out of play.
  detailTextInactive: {
    color: '#aaa',
    textDecorationLine: 'line-through',
  },
  surchargeText: {
    color: '#dc3545',
  },
  paidBadge: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 3,
    color: '#28a745',
  },
  receiptPaidStamp: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 5,
    textAlign: 'center',
    color: '#28a745',
  },
  enablePpButton: {
    backgroundColor: '#ffc107',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
  },
  enablePpButtonText: {
    color: '#333',
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
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  downloadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  whatsappButton: {
    flex: 1,
    backgroundColor: '#25D366',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginRight: 8,
  },
  iconActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  iconActionButton: {
    padding: 8,
  },
  actionIcon: {
    width: 32,
    height: 32,
  },
  bulkReminderButton: {
    backgroundColor: '#25D366',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  sortButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007bff',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  sortButtonText: {
    color: '#007bff',
    fontSize: 14,
    fontWeight: '600',
  },
  printButton: {
    backgroundColor: '#fd7e14',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 12,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 90,
    paddingRight: 16,
  },
  statusMenu: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 6,
    minWidth: 200,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  statusMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  statusMenuItemActive: {
    backgroundColor: '#e7f1ff',
  },
  statusMenuIcon: {
    width: 26,
    height: 26,
    marginRight: 10,
  },
  statusMenuLabel: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  statusMenuClear: {
    fontSize: 14,
    color: '#007bff',
    fontWeight: '600',
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
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  receiptWhatsAppButton: {
    backgroundColor: '#25D366',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
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