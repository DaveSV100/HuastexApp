// src/components/SaleModal.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  StyleProp,
  TextStyle,
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SignatureScreen from 'react-native-signature-canvas';
import DateTimePicker from '@react-native-community/datetimepicker';
import { buildIncomePayload } from '../utils/Incoms';
import { matchesAllKeywords } from '../utils/smartSearch';
import { roundUpToFive, getPaymentInfo } from '../utils/paymentStatus';
import { openCashDrawer } from '../utils/thermalPrinter';
import CambioCalculator from './CambioCalculator';
import { getCambio } from '../utils/cambio';
import type { CashChange } from './PaymentsModal';
import api from '../api';

interface Product {
  producto: string;
  inventory_id: number | null;
  product_id?: number | null;
  serial_number: string;
  quantity: number;
  unitPrice: number;
  totalProductPrice: number;
}

interface SaleData {
  nombre: string;
  email: string;
  phone: string;
  calleYNumero: string;
  ciudad: string;
  estado: string;
  fecha: string;
  formaDePago: string;
  sucursal: string;
  products: Product[];
  enganche: string;
  precioNormal: string;
  precioPromocion: string;
  discount: string;
  saldoPrecioPromocion: string;
  saldoPrecioNormal: string;
  plazo: { value: string; unit: string };
  fechaVencimiento: string;
  paymentFrequency: string;
  /** '' = use the calculated installment; otherwise the amount typed by hand. */
  pagosDe: string;
  agenteDeVentas: string;
  aclaraciones: string;
  /** '' = normal cash flow; otherwise the reporte-diario payment_type
      (credit_card / transfer / cash_deposit) so the venta/enganche is NOT
      counted as cash in the cashier's daily count. */
  electronicPayment: string;
}

const ELECTRONIC_PAYMENT_OPTIONS = [
  { label: 'C/Tarjeta', value: 'credit_card' },
  { label: 'Transferencia', value: 'transfer' },
  { label: 'Depósito en efectivo', value: 'cash_deposit' },
];

const FREQUENCY_OPTIONS = ['Semanal', 'Quincenal', 'Mensual', 'Al terminar'];

// Inventory price-column prefix per normalized sucursal key.
const BRANCH_PRICE_PREFIX: Record<string, string> = {
  cerroazul: 'cerro_azul',
  aquismon: 'aquismon',
  tepetzintla: 'tepetzintla',
  tlacolula: 'tlacolula',
};

const EditImg = require('../../Assets/edit.png');
const RobotImg = require('../../Assets/robot.png');

// Values the form calculates on its own. Each can be taken over by hand with
// the ✏️ button and handed back to the calculation with 🤖.
type AutoFieldKey =
  | 'precioPromocion'
  | 'precioNormal'
  | 'saldoPrecioPromocion'
  | 'saldoPrecioNormal'
  | 'pagosDe';

// Editing starts from the stored prices/saldos (the saldos already reflect
// abonos), so nothing is recalculated until a field is handed back with 🤖.
// Pagos de doesn't depend on the pricing mode; it starts manual only when the
// sale was saved with a hand-typed amount (see the manualFields initializer).
const defaultManualFields = (isEditing: boolean): Record<AutoFieldKey, boolean> => ({
  precioPromocion: isEditing,
  precioNormal: isEditing,
  saldoPrecioPromocion: isEditing,
  saldoPrecioNormal: isEditing,
  pagosDe: false,
});

// Task-7 quick-fill: the salesperson's branch decides ciudad/estado; the
// street is always the generic "Domicilio conocido".
const BRANCH_ADDRESS: Record<string, { ciudad: string; estado: string }> = {
  aquismon: { ciudad: 'Aquismón', estado: 'San Luis Potosí' },
  cerroazul: { ciudad: 'Cerro Azul', estado: 'Veracruz' },
  tepetzintla: { ciudad: 'Tepetzintla', estado: 'Veracruz' },
  tlacolula: { ciudad: 'Tlacolula', estado: 'Veracruz' },
};

interface SaleModalProps {
  visible: boolean;
  onClose: () => void;
  /** Server response ({ id, ... }) and the cash change, if it was calculated. */
  onSaved: (data: any, cash: CashChange | null) => void;
  initialData: any | null;
}

export default function SaleModal({
  visible,
  onClose,
  onSaved,
  initialData,
}: SaleModalProps): React.JSX.Element {
  const isEditing = Boolean(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userBranch, setUserBranch] = useState<string>('');
  const [manualPricing, setManualPricing] = useState(false);
  const [manualFields, setManualFields] = useState(() => ({
    ...defaultManualFields(isEditing),
    pagosDe: Number(initialData?.pagos_de) > 0,
  }));
  const [signature, setSignature] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const signatureRef = useRef<any>(null);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  // Set when saving without a fecha: scrolls back to it and flags it in red.
  const [fechaMissing, setFechaMissing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const fechaOffsetY = useRef(0);

  const [formData, setFormData] = useState<SaleData>({
    nombre: '',
    email: 'default@correo.com',
    phone: '',
    calleYNumero: '',
    ciudad: '',
    estado: '',
    fecha: '',
    formaDePago: 'Contado',
    sucursal: '',
    products: [
      {
        producto: '',
        inventory_id: null,
        serial_number: '',
        quantity: 1,
        unitPrice: 0,
        totalProductPrice: 0,
      },
    ],
    enganche: '',
    precioNormal: '',
    precioPromocion: '',
    discount: '',
    saldoPrecioPromocion: '',
    saldoPrecioNormal: '',
    plazo: { value: '', unit: 'weeks' },
    fechaVencimiento: '',
    paymentFrequency: '',
    pagosDe: '',
    agenteDeVentas: '',
    aclaraciones: '',
    electronicPayment: '',
  });
  const [showFrequencyOptions, setShowFrequencyOptions] = useState(false);
  const [showElectronicPayment, setShowElectronicPayment] = useState(false);
  // "Calcular cambio" helper (screen only, never saved).
  const [showCambio, setShowCambio] = useState(false);
  const [pagaCon, setPagaCon] = useState('');

  const [availableInventory, setAvailableInventory] = useState<any[]>([]);
  const [searchTerms, setSearchTerms] = useState<string[]>(['']);

  useEffect(() => {
    loadUserData();
    fetchInventory();
  }, []);

  const loadUserData = async () => {
    const role = await AsyncStorage.getItem('role');
    const branch = await AsyncStorage.getItem('branch');
    setUserRole(role);
    setUserBranch(branch || '');
    
    if (role !== 'admin' && role !== 'superadmin') {
      setFormData(prev => ({ ...prev, sucursal: branch || '' }));
    }
  };

  const fetchInventory = async () => {
    try {
      // /inventory is locked — go through the axios instance so x-auth-token is sent.
      const response = await api.get('/inventory');
      setAvailableInventory(response.data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  useEffect(() => {
    if (!initialData) return;

    let normalizedFecha = '';
    if (initialData.fecha) {
      normalizedFecha =
        typeof initialData.fecha === 'string' && initialData.fecha.includes('T')
          ? initialData.fecha.split('T')[0]
          : new Date(initialData.fecha).toISOString().split('T')[0];
      
      // Set the temp date for the picker
      setTempDate(new Date(normalizedFecha));
    }

    let rawPlazo = initialData.plazo;
    if (typeof rawPlazo === 'string') {
      try {
        rawPlazo = JSON.parse(rawPlazo);
      } catch {
        rawPlazo = {};
      }
    }
    if (
      rawPlazo.value &&
      typeof rawPlazo.value === 'string' &&
      rawPlazo.value.trim().startsWith('{')
    ) {
      try {
        rawPlazo = JSON.parse(rawPlazo.value);
      } catch {
        /* ignore */
      }
    }
    const plazoValue = rawPlazo.value != null ? String(rawPlazo.value) : '';
    const plazoUnit = ['days', 'weeks', 'months'].includes(rawPlazo.unit)
      ? rawPlazo.unit
      : 'weeks';

    const mappedProducts = (initialData.products || []).map((p: any) => ({
      producto: p.title || p.producto || '',
      inventory_id: p.source === 'inventory' ? p.id : null,
      product_id: p.source === 'product' ? p.id : null,
      serial_number: p.serial_number ?? p.serial ?? '',
      quantity: p.quantity || 1,
      unitPrice: p.unit_price || 0,
      totalProductPrice: (p.unit_price || 0) * (p.quantity || 1),
    }));

    setFormData({
      nombre: initialData.nombre || '',
      email: initialData.email || 'default@correo.com',
      phone: initialData.phone || '',
      calleYNumero: initialData.calleynumero || '',
      ciudad: initialData.ciudad || '',
      estado: initialData.estado || '',
      fecha: normalizedFecha,
      formaDePago: initialData.formadepago || 'Contado',
      sucursal: initialData.sucursal || userBranch,
      enganche: initialData.enganche != null ? String(initialData.enganche) : '',
      precioPromocion:
        initialData.preciopromocion != null ? String(initialData.preciopromocion) : '',
      precioNormal:
        initialData.precionormal != null ? String(initialData.precionormal) : '',
      saldoPrecioPromocion:
        initialData.saldo_precio_promocion != null
          ? String(initialData.saldo_precio_promocion)
          : '',
      saldoPrecioNormal:
        initialData.saldo_precio_normal != null
          ? String(initialData.saldo_precio_normal)
          : '',
      discount: initialData.discount != null ? String(initialData.discount) : '',
      plazo: {
        value: plazoValue,
        unit: plazoUnit,
      },
      fechaVencimiento: initialData.fechavencimiento
        ? initialData.fechavencimiento.split('T')[0]
        : '',
      paymentFrequency: initialData.payment_frequency || '',
      pagosDe:
        Number(initialData.pagos_de) > 0 ? String(initialData.pagos_de) : '',
      agenteDeVentas: initialData.agentedeventas || '',
      aclaraciones: initialData.aclaraciones || '',
      // Stored on the transaction row, not the sale — editing starts blank
      // and only overrides the reporte-diario type if re-selected here.
      electronicPayment: '',
      products: mappedProducts,
    });

    if (initialData.firmadigital) {
      setSignature(initialData.firmadigital);
    }
  }, [initialData, userBranch]);

  // Date picker functions
  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (date && event.type !== 'dismissed') {
        setFormData(prev => ({
          ...prev,
          fecha: formatDateString(date),
        }));
      }
    } else {
      // iOS: just update temp date, don't save yet
      if (date) {
        setTempDate(date);
      }
    }
  };

  const showDatepicker = () => {
    setTempDate(formData.fecha ? new Date(formData.fecha) : new Date());
    setShowDatePicker(true);
  };

  const confirmDateSelection = () => {
    // Save the temp date to formData
    setFormData(prev => ({
      ...prev,
      fecha: formatDateString(tempDate),
    }));
    setShowDatePicker(false);
  };

  const cancelDateSelection = () => {
    setShowDatePicker(false);
  };

  const toggleMode = () => {
    setManualPricing((prev) => !prev);
    // Switching pricing mode drops the per-field ✏️ overrides so the
    // inventory flow is fully automatic again (Pagos de is independent).
    setManualFields((prev) => ({
      ...defaultManualFields(isEditing),
      pagosDe: prev.pagosDe,
    }));
  };

  const handleFormaDePagoChange = (value: string) => {
    const forma = value.toLowerCase();
    const isCash = forma === 'contado';
    const locksNormal = isCash || forma === 'apartado';
    // Fields the new forma de pago locks at 0 go back to automatic so a
    // hand-typed value isn't left behind a disabled input.
    setManualFields((prev) => ({
      ...prev,
      precioNormal: locksNormal ? false : prev.precioNormal,
      saldoPrecioNormal: locksNormal ? false : prev.saldoPrecioNormal,
      saldoPrecioPromocion: isCash ? false : prev.saldoPrecioPromocion,
      pagosDe: isCash ? false : prev.pagosDe,
    }));
    setFormData((prev) => ({
      ...prev,
      formaDePago: value,
      pagosDe: isCash ? '' : prev.pagosDe,
    }));
  };

  const handleInputChange = (field: string, value: any, index?: number) => {
    if (index !== undefined) {
      const updatedProducts = [...formData.products];
      if (field === 'quantity') {
        updatedProducts[index].quantity = parseInt(value, 10) || 1;
        updatedProducts[index].totalProductPrice =
          updatedProducts[index].unitPrice * updatedProducts[index].quantity;
      } else if (field === 'serial_number') {
        updatedProducts[index].serial_number = value;
      } else if (field === 'producto') {
        updatedProducts[index].producto = value;
      } else if (field === 'unitPrice') {
        updatedProducts[index].unitPrice = parseFloat(value) || 0;
        updatedProducts[index].totalProductPrice =
          updatedProducts[index].unitPrice * updatedProducts[index].quantity;
      } else if (field === 'totalProductPrice') {
        updatedProducts[index].totalProductPrice = parseFloat(value) || 0;
      }
      setFormData({ ...formData, products: updatedProducts });
    } else {
      setFormData({ ...formData, [field]: value });
    }
  };

  const handleFillDefaultAddress = () => {
    const branchKey = (formData.sucursal || userBranch || '')
      .toLowerCase()
      .replace(/\s+/g, '');
    const address = BRANCH_ADDRESS[branchKey];
    if (!address) {
      Alert.alert('Sucursal', 'Selecciona una sucursal primero para llenar el domicilio.');
      return;
    }
    setFormData(prev => ({
      ...prev,
      calleYNumero: 'Domicilio conocido',
      ciudad: address.ciudad,
      estado: address.estado,
    }));
  };

  const handlePlazoChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      plazo: {
        ...formData.plazo,
        [field]: value,
      },
    });
  };

  const calculateDueDate = useCallback(() => {
    if (!formData.fecha || !formData.plazo.value) {
      return '';
    }

    const date = new Date(formData.fecha);
    if (isNaN(date.getTime())) {
      return '';
    }

    const value = parseInt(formData.plazo.value, 10);
    switch (formData.plazo.unit) {
      case 'days':
        date.setDate(date.getDate() + value);
        break;
      case 'weeks':
        date.setDate(date.getDate() + value * 7);
        break;
      case 'months':
        date.setMonth(date.getMonth() + value);
        break;
      default:
        break;
    }

    try {
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }, [formData.fecha, formData.plazo.value, formData.plazo.unit]);

  useEffect(() => {
    const due = calculateDueDate();
    if (due) {
      setFormData((prev) =>
        prev.fechaVencimiento === due ? prev : { ...prev, fechaVencimiento: due },
      );
    }
  }, [calculateDueDate]);

  const getUnitPriceForItem = (inventoryItem: any) => {
    const rawBranch = formData.sucursal && formData.sucursal.trim()
      ? formData.sucursal
      : userBranch;
    // Sucursal comes as 'cerroazul' (picker) or 'Cerro Azul' (user branch),
    // but the inventory columns are cerro_azul_* — normalize to the prefix.
    const branchKey = rawBranch
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z]/g, '');
    const branch = BRANCH_PRICE_PREFIX[branchKey] || branchKey;
    const paymentType = formData.formaDePago.toLowerCase();
    let priceField = '';
    
    if (paymentType === 'msi') {
      priceField = `${branch}_msiprice`;
    } else if (paymentType === 'crédito' || paymentType === 'credit') {
      priceField = `${branch}_creditprice`;
    } else {
      priceField = `${branch}_price`;
    }
    
    return Number(inventoryItem[priceField]) || 0;
  };

  const handleInventorySelect = (inventoryItem: any, index: number) => {
    const updatedProducts = [...formData.products];
    const unitPrice = getUnitPriceForItem(inventoryItem);
    updatedProducts[index] = {
      ...updatedProducts[index],
      producto: inventoryItem.product,
      inventory_id: inventoryItem.id,
      // inventory no longer carries a serial; keep whatever the seller typed
      serial_number: updatedProducts[index].serial_number || '',
      unitPrice: unitPrice,
      totalProductPrice: unitPrice * updatedProducts[index].quantity,
    };
    setFormData({
      ...formData,
      products: updatedProducts,
      precioPromocion: unitPrice.toFixed(2),
    });
    
    const newSearchTerms = [...searchTerms];
    newSearchTerms[index] = '';
    setSearchTerms(newSearchTerms);
  };

  const addProductField = () => {
    setFormData((prev) => ({
      ...prev,
      products: [
        ...prev.products,
        {
          producto: '',
          inventory_id: null,
          serial_number: '',
          quantity: 1,
          unitPrice: 0,
          totalProductPrice: 0,
        },
      ],
    }));
    setSearchTerms((prev) => [...prev, '']);
  };

  const removeProductField = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index),
    }));
    setSearchTerms((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateTotalPrice = useCallback(() => {
    const sum = formData.products.reduce((total, product) => {
      const val = parseFloat(String(product.totalProductPrice));
      return total + (isNaN(val) ? 0 : val);
    }, 0);
    return sum.toFixed(2);
  }, [formData.products]);

  // Runs in both pricing modes: with "Agregar precio manualmente" the
  // hand-typed unit prices feed the same math as the inventory prices.
  useEffect(() => {
    const totalPrice = Number(calculateTotalPrice());
    let discountedPrice = totalPrice;

    if (formData.discount) {
      discountedPrice = totalPrice * (1 - Number(formData.discount) / 100);
    }

    const formaLower = formData.formaDePago.toLowerCase();
    // Contado has no normal price (it's paid in full); Apartado only tracks
    // the promo price, so its normal price/saldo stay at 0 as well.
    const skipNormalPrice = formaLower === 'contado' || formaLower === 'apartado';

    // Fields taken over by hand keep their value, and the fields derived
    // from them build on it: a hand-typed promo price still drives the
    // automatic precio normal and saldos.
    setFormData((prev) => {
      const promo = manualFields.precioPromocion
        ? Number(prev.precioPromocion) || 0
        : discountedPrice;
      // Rounded up to end in 0 or 5, same rule as the installments.
      const normal = manualFields.precioNormal
        ? Number(prev.precioNormal) || 0
        : skipNormalPrice
        ? 0
        : roundUpToFive(promo * 1.12);
      const enganche = Number(prev.enganche) || 0;

      const next = {
        precioPromocion: manualFields.precioPromocion
          ? prev.precioPromocion
          : promo.toFixed(2),
        precioNormal: manualFields.precioNormal
          ? prev.precioNormal
          : normal.toFixed(2),
        saldoPrecioPromocion: manualFields.saldoPrecioPromocion
          ? prev.saldoPrecioPromocion
          : formaLower === 'contado'
          ? '0.00'
          : (promo - enganche).toFixed(2),
        saldoPrecioNormal: manualFields.saldoPrecioNormal
          ? prev.saldoPrecioNormal
          : skipNormalPrice
          ? '0.00'
          : (normal - enganche).toFixed(2),
      };
      const unchanged = (Object.keys(next) as (keyof typeof next)[]).every(
        (key) => next[key] === prev[key],
      );
      return unchanged ? prev : { ...prev, ...next };
    });
  }, [
    calculateTotalPrice,
    formData.discount,
    formData.formaDePago,
    formData.enganche,
    formData.precioPromocion,
    formData.precioNormal,
    manualFields,
  ]);

  const handleSubmit = async () => {
    if (!formData.nombre || !formData.email || !formData.phone) {
      Alert.alert('Error', 'Por favor completa los campos requeridos');
      return;
    }

    if (!formData.fecha) {
      setFechaMissing(true);
      scrollRef.current?.scrollTo({
        y: Math.max(0, fechaOffsetY.current - 12),
        animated: true,
      });
      return;
    }

    setIsSaving(true);

    const dataToSubmit = {
      ...formData,
      firmadigital: signature,
      saldoPrecioPromocion: formData.saldoPrecioPromocion,
      saldoPrecioNormal: formData.saldoPrecioNormal,
    };

    // Edits (PUT /sales/:id) are locked and need x-auth-token; creates
    // (POST /sales/add) are the public online-checkout route. Both go through
    // `api` so the token is attached when present — the public create endpoint
    // simply ignores it. axios rejects on a non-2xx status, so a real server
    // rejection lands in the catch below rather than being silently ignored.
    try {
      const saleRes = isEditing
        ? await api.put(`/sales/${initialData.id}`, dataToSubmit)
        : await api.post('/sales/add', dataToSubmit);

      // The sale already succeeded above, so an empty body must NOT bubble up as
      // a "sale failed" error — default to {}.
      const saved: any = saleRes.data || {};
      const saleId = saved?.id ?? (isEditing ? initialData?.id : null);
      console.log('✔️ Sale saved:', saved);

      // Best-effort: mirror the sale into the daily report (transactions table).
      // A transaction problem must never look like a failed sale.
      if (saleId != null) {
        const fullSale = { ...dataToSubmit, id: saleId };
        const incomePayload: any = buildIncomePayload(fullSale);
        incomePayload.sale_id = saleId;

        try {
          if (!isEditing) {
            await api.post('/transactions', incomePayload);
            console.log('✔️ Income recorded for new sale');
          } else {
            const txRes = await api.get('/transactions', { params: { sale_id: saleId } });
            const existingTx =
              Array.isArray(txRes.data) && txRes.data.length ? txRes.data[0] : null;
            if (existingTx) {
              // Editing a sale must not wipe an electronic payment_type that
              // was set here or in the daily report — keep it unless the
              // seller re-selected one in this form.
              const electronicTypes = ['credit_card', 'transfer', 'cash_deposit', 'online'];
              if (
                !formData.electronicPayment &&
                electronicTypes.includes(existingTx.payment_type)
              ) {
                incomePayload.payment_type = existingTx.payment_type;
              }
              await api.put(`/transactions/${existingTx.id}`, incomePayload);
              console.log(`✔️ Updated transaction ${existingTx.id}`);
            } else {
              await api.post('/transactions', incomePayload);
              console.log('✔️ Transaction created for edited sale');
            }
          }
        } catch (err: any) {
          console.error(
            '❌ Transaction sync failed (sale still saved):',
            err.response?.data || err.message
          );
        }
      }

      setIsSaving(false);
      // Pop the cash drawer for the cashier (best-effort; skipped silently
      // when no printer is paired). Never blocks the save. Card/transfer/
      // deposit money never enters the drawer, so it stays closed then.
      if (!formData.electronicPayment) {
        openCashDrawer();
      }
      const change = showCambio ? getCambio(cashDue, parseFloat(pagaCon)) : null;
      // The caller shows the confirmation with print/send buttons.
      onSaved(
        saved,
        change && change.faltan === 0
          ? { pagaCon: parseFloat(pagaCon), cambio: change.cambio }
          : null,
      );
    } catch (err) {
      console.error('❌ Sale error:', err);
      setIsSaving(false);
      Alert.alert('Error', 'No se pudo guardar la venta');
    }
  };

  const handleSignatureEnd = (sig: string) => {
    setSignature(sig);
    setShowSignature(false);
  };

  const clearSignature = () => {
    setSignature(null);
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
    }
  };

  const isContado = formData.formaDePago.toLowerCase() === 'contado';
  // Apartado only tracks the promo price: the normal-price fields are
  // disabled (and zeroed by the auto-calculation) so the sale and its
  // daily-report row don't carry a saldo normal.
  const isApartado = formData.formaDePago.toLowerCase() === 'apartado';
  const normalPriceLocked = isContado || isApartado;
  // Cash collected right now: the whole promo price for Contado, otherwise
  // the enganche.
  const cashDue = isContado
    ? Number(formData.precioPromocion) || 0
    : Number(formData.enganche) || 0;

  // A hand-typed promo total may be an on-the-spot discount, but flag it in
  // case it's a typo: it no longer matches the products × units (− descuento).
  const productsPromo =
    Number(calculateTotalPrice()) * (1 - (Number(formData.discount) || 0) / 100);
  const promoMismatch =
    manualFields.precioPromocion &&
    Math.abs((Number(formData.precioPromocion) || 0) - productsPromo) >= 0.005;

  // Same installment math the sales list shows, live as the form is filled,
  // so the seller can quote the payment on the spot.
  const autoPagosDe = getPaymentInfo({
    formadepago: formData.formaDePago,
    preciopromocion: formData.precioPromocion,
    enganche: formData.enganche,
    saldo_precio_promocion: formData.saldoPrecioPromocion,
    plazo: formData.plazo,
    payment_frequency: formData.paymentFrequency,
    fecha: formData.fecha,
    fechavencimiento: formData.fechaVencimiento,
  }).pagosDe;
  const showPagosDe =
    !isContado &&
    formData.paymentFrequency !== '' &&
    (autoPagosDe != null || manualFields.pagosDe);

  const toggleManualField = (field: AutoFieldKey) => {
    const enabling = !manualFields[field];
    setManualFields((prev) => ({ ...prev, [field]: enabling }));
    // The price fields are recalculated by the effect above; Pagos de starts
    // the hand-typed amount from the current installment instead.
    if (field === 'pagosDe') {
      setFormData((prev) => ({
        ...prev,
        pagosDe: enabling && autoPagosDe != null ? autoPagosDe.toFixed(2) : '',
      }));
    }
  };

  const webStyle = `
    .m-signature-pad {
      position: absolute;
      font-size: 10px;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      background-color: white;
    }
    .m-signature-pad--body {
      border: 1px solid #e8e8e8;
      width: 100%;
      height: 100%;
    }
  `;

  if (showSignature) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.signatureContainer}>
          <View style={styles.signatureHeader}>
            <TouchableOpacity onPress={() => setShowSignature(false)}>
              <Text style={styles.signatureHeaderButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearSignature}>
              <Text style={styles.signatureHeaderButtonText}>Limpiar</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.signatureCanvasWrap}>
            <View style={styles.signatureCanvas}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignatureEnd}
                webStyle={webStyle}
              />
            </View>
          </View>
          <TouchableOpacity
            style={styles.signatureSaveButton}
            onPress={() => {
              if (signatureRef.current) {
                signatureRef.current.readSignature();
              }
            }}
          >
            <Text style={styles.signatureSaveButtonText}>Guardar Firma</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {isEditing ? 'Editar Venta' : 'Nueva Venta'}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>Cerrar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} style={styles.form}>
          <Text style={styles.label}>Forma de pago *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.formaDePago}
              onValueChange={handleFormaDePagoChange}
              itemStyle={styles.pickerItem}
            >
              <Picker.Item label="Contado" value="Contado" color="#333" />
              <Picker.Item label="Apartado" value="Apartado" color="#333" />
              <Picker.Item label="Crédito" value="Crédito" color="#333" />
              <Picker.Item label="MSI" value="MSI" color="#333" />
            </Picker>
          </View>

          {/* Electronic money (card/transfer/deposit) never goes through the
              cashier's drawer, so the daily-report row must carry that type
              instead of the cash "Venta"/"Enganche" defaults. */}
          <TouchableOpacity
            style={[
              styles.electronicButton,
              showElectronicPayment && styles.electronicButtonActive,
            ]}
            onPress={() => {
              const enabling = !showElectronicPayment;
              setShowElectronicPayment(enabling);
              handleInputChange(
                'electronicPayment',
                enabling ? ELECTRONIC_PAYMENT_OPTIONS[0].value : '',
              );
            }}
          >
            <Text
              style={[
                styles.electronicButtonText,
                showElectronicPayment && styles.electronicButtonTextActive,
              ]}
            >
              Pago electrónico{showElectronicPayment ? ' ✓' : ''}
            </Text>
          </TouchableOpacity>
          {showElectronicPayment && (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.electronicPayment}
                onValueChange={(value) =>
                  handleInputChange('electronicPayment', value)
                }
                itemStyle={styles.pickerItem}
              >
                {ELECTRONIC_PAYMENT_OPTIONS.map((opt) => (
                  <Picker.Item
                    key={opt.value}
                    label={opt.label}
                    value={opt.value}
                    color="#333"
                  />
                ))}
              </Picker>
            </View>
          )}

          <Text style={styles.label}>Sucursal *</Text>
          {userRole === 'admin' || userRole === 'superadmin' ? (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.sucursal}
                onValueChange={(value) => handleInputChange('sucursal', value)}
                itemStyle={styles.pickerItem}
              >
                <Picker.Item label="Seleccione..." value="" color="#333" />
                <Picker.Item label="Cerro Azul" value="cerroazul" color="#333" />
                <Picker.Item label="Aquismon" value="aquismon" color="#333" />
                <Picker.Item label="Tepetzintla" value="tepetzintla" color="#333" />
                <Picker.Item label="Tlacolula" value="tlacolula" color="#333" />
              </Picker>
            </View>
          ) : (
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={formData.sucursal}
              editable={false}
            />
          )}

          <Text style={styles.label}>Nombre *</Text>
          <TextInput
            style={styles.input}
            value={formData.nombre}
            onChangeText={(value) => handleInputChange('nombre', value)}
          />

          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            value={formData.email}
            onChangeText={(value) => handleInputChange('email', value)}
            keyboardType="email-address"
          />

          <Text style={styles.label}>Teléfono *</Text>
          <TextInput
            style={styles.input}
            value={formData.phone}
            onChangeText={(value) => handleInputChange('phone', value)}
            keyboardType="phone-pad"
          />

          <TouchableOpacity
            style={styles.defaultAddressButton}
            onPress={handleFillDefaultAddress}
          >
            <Text style={styles.defaultAddressButtonText}>
              Llenar domicilio conocido
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>Calle y número *</Text>
          <TextInput
            style={styles.input}
            value={formData.calleYNumero}
            onChangeText={(value) => handleInputChange('calleYNumero', value)}
          />

          <Text style={styles.label}>Ciudad *</Text>
          <TextInput
            style={styles.input}
            value={formData.ciudad}
            onChangeText={(value) => handleInputChange('ciudad', value)}
          />

          <Text style={styles.label}>Estado *</Text>
          <TextInput
            style={styles.input}
            value={formData.estado}
            onChangeText={(value) => handleInputChange('estado', value)}
          />

          <View
            onLayout={(e) => {
              fechaOffsetY.current = e.nativeEvent.layout.y;
            }}
          >
            {fechaMissing && !formData.fecha && (
              <Text style={styles.fieldErrorText}>Agregar fecha</Text>
            )}
            <Text
              style={[
                styles.label,
                fechaMissing && !formData.fecha && styles.labelAfterError,
              ]}
            >
              Fecha *
            </Text>
            <TouchableOpacity
              style={[
                styles.dateButton,
                fechaMissing && !formData.fecha && styles.dateButtonError,
              ]}
              onPress={showDatepicker}
            >
              <Text style={[styles.dateButtonText, !formData.fecha && styles.placeholderText]}>
                {formData.fecha || 'Seleccionar fecha'}
              </Text>
            </TouchableOpacity>
          </View>

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
                  <TouchableOpacity style={styles.dateCancelButton} onPress={cancelDateSelection}>
                    <Text style={styles.dateCancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dateConfirmButton} onPress={confirmDateSelection}>
                    <Text style={styles.dateConfirmButtonText}>Confirmar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <Text style={styles.sectionTitle}>Productos</Text>
          {/* Grey on purpose: searching the inventory is the preferred path —
              manual products don't auto-discount branch units. */}
          <View style={styles.toggleBlock}>
            <TouchableOpacity style={styles.toggleButton} onPress={toggleMode}>
              <Text style={styles.toggleButtonText}>
                {manualPricing ? 'Buscar en inventario' : 'Agregar precio manualmente'}
              </Text>
            </TouchableOpacity>
            {!manualPricing && (
              <Text style={styles.toggleHint}>
                Con precio manual no se descuentan unidades del inventario.
              </Text>
            )}
          </View>
          {formData.products.map((product, index) => (
            <View key={index} style={styles.productContainer}>
              {manualPricing ? (
                <>
                  <Text style={styles.label}>Producto manual</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Escriba el nombre del producto"
                    value={product.producto}
                    onChangeText={(value) => handleInputChange('producto', value, index)}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.label}>Buscar producto *</Text>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="🔍 Escriba aquí para buscar..."
                    placeholderTextColor="#0a58ca"
                    value={searchTerms[index]}
                    onChangeText={(value) => {
                      const newTerms = [...searchTerms];
                      newTerms[index] = value;
                      setSearchTerms(newTerms);
                    }}
                  />
                  {searchTerms[index] && (
                    <ScrollView style={styles.searchResults}>
                      {availableInventory
                        .filter((item) =>
                          // Accent/case-insensitive and word-order-free, same
                          // as the web inventory search.
                          matchesAllKeywords(item.product, searchTerms[index])
                        )
                        .map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            style={styles.searchResultItem}
                            onPress={() => handleInventorySelect(item, index)}
                          >
                            <Text>{item.product} - Seleccionar</Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  )}

                  <Text style={styles.label}>Producto seleccionado</Text>
                  <View style={styles.selectedProductBox}>
                    <Text
                      style={
                        product.producto
                          ? styles.selectedProductText
                          : styles.selectedProductPlaceholder
                      }
                    >
                      {product.producto ||
                        'Ninguno — use "Buscar producto" arriba'}
                    </Text>
                  </View>
                </>
              )}

              <Text style={styles.label}>Cantidad</Text>
              <TextInput
                style={styles.input}
                value={String(product.quantity)}
                onChangeText={(value) => handleInputChange('quantity', value, index)}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Número de serie</Text>
              <TextInput
                style={styles.input}
                value={product.serial_number}
                onChangeText={(value) => handleInputChange('serial_number', value, index)}
              />

              <Text style={styles.label}>Precio unitario</Text>
              <TextInput
                style={[styles.input, !manualPricing && styles.inputDisabled]}
                value={String(product.unitPrice)}
                onChangeText={(value) => handleInputChange('unitPrice', value, index)}
                keyboardType="numeric"
                editable={manualPricing}
              />

              <Text style={styles.label}>Precio total</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={String(product.totalProductPrice)}
                editable={false}
              />

              {formData.products.length > 1 && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeProductField(index)}
                >
                  <Text style={styles.removeButtonText}>Eliminar</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          <TouchableOpacity style={styles.addButton} onPress={addProductField}>
            <Text style={styles.addButtonText}>Agregar Producto</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Enganche</Text>
          <TextInput
            style={[styles.input, isContado && styles.inputDisabled]}
            value={formData.enganche}
            onChangeText={(value) => handleInputChange('enganche', value)}
            keyboardType="numeric"
            editable={!isContado}
          />

          {/* The ✏️/🤖 toggles only show with "Agregar precio manualmente";
              the inventory flow stays fully automatic. */}
          <AutoField
            label="Precio de promoción"
            value={formData.precioPromocion}
            onChangeText={(value) => handleInputChange('precioPromocion', value)}
            isManual={manualFields.precioPromocion}
            onToggle={() => toggleManualField('precioPromocion')}
            showToggle={manualPricing}
            editable={manualPricing && manualFields.precioPromocion}
            warning={promoMismatch ? 'Checar Precio Total' : undefined}
          />

          <AutoField
            label="Precio normal"
            value={formData.precioNormal}
            onChangeText={(value) => handleInputChange('precioNormal', value)}
            isManual={manualFields.precioNormal}
            onToggle={() => toggleManualField('precioNormal')}
            showToggle={manualPricing && !normalPriceLocked}
            editable={
              manualPricing && manualFields.precioNormal && !normalPriceLocked
            }
          />

          <Text style={styles.label}>Descuento (%)</Text>
          <TextInput
            style={styles.input}
            value={formData.discount}
            onChangeText={(value) => handleInputChange('discount', value)}
            keyboardType="numeric"
          />

          {/* When editing, the saldos start as the stored values (manual),
              so they stay editable even in inventory mode. */}
          <AutoField
            label="Saldo Precio Promoción"
            value={formData.saldoPrecioPromocion}
            onChangeText={(value) => handleInputChange('saldoPrecioPromocion', value)}
            isManual={manualFields.saldoPrecioPromocion}
            onToggle={() => toggleManualField('saldoPrecioPromocion')}
            showToggle={manualPricing && !isContado}
            editable={manualFields.saldoPrecioPromocion && !isContado}
          />

          <AutoField
            label="Saldo Precio Normal"
            value={formData.saldoPrecioNormal}
            onChangeText={(value) => handleInputChange('saldoPrecioNormal', value)}
            isManual={manualFields.saldoPrecioNormal}
            onToggle={() => toggleManualField('saldoPrecioNormal')}
            showToggle={manualPricing && !normalPriceLocked}
            editable={manualFields.saldoPrecioNormal && !normalPriceLocked}
          />

          <Text style={styles.label}>Plazo</Text>
          <TextInput
            style={[styles.input, isContado && styles.inputDisabled]}
            value={formData.plazo.value}
            onChangeText={(value) => handlePlazoChange('value', value)}
            keyboardType="numeric"
            editable={!isContado}
          />
          <View style={[styles.pickerContainer, isContado && styles.inputDisabled]}>
            <Picker
              selectedValue={formData.plazo.unit}
              onValueChange={(value) => handlePlazoChange('unit', value)}
              enabled={!isContado}
              itemStyle={styles.pickerItem}
            >
              <Picker.Item label="Días" value="days" color="#333" />
              <Picker.Item label="Semanas" value="weeks" color="#333" />
              <Picker.Item label="Meses" value="months" color="#333" />
            </Picker>
          </View>

          <Text style={styles.label}>Fecha de vencimiento</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={formData.fechaVencimiento}
            editable={false}
          />

          {/* Collapsed dropdown on purpose (not a Picker wheel): it only
              expands the 4 options when tapped. */}
          <Text style={styles.label}>Frecuencia de pago</Text>
          <TouchableOpacity
            style={[styles.input, isContado && styles.inputDisabled]}
            disabled={isContado}
            onPress={() => setShowFrequencyOptions((prev) => !prev)}
          >
            <Text
              style={
                formData.paymentFrequency
                  ? styles.dropdownValueText
                  : styles.placeholderText
              }
            >
              {formData.paymentFrequency || 'Seleccionar frecuencia'}
            </Text>
          </TouchableOpacity>
          {showFrequencyOptions && !isContado && (
            <View style={styles.dropdownOptions}>
              {FREQUENCY_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.dropdownOption,
                    formData.paymentFrequency === option &&
                      styles.dropdownOptionSelected,
                  ]}
                  onPress={() => {
                    handleInputChange('paymentFrequency', option);
                    setShowFrequencyOptions(false);
                  }}
                >
                  <Text style={styles.dropdownOptionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {showPagosDe && (
            <AutoField
              label={
                formData.paymentFrequency === 'Al terminar'
                  ? 'Pagos de (al terminar el plazo)'
                  : 'Pagos de'
              }
              value={
                manualFields.pagosDe
                  ? formData.pagosDe
                  : autoPagosDe?.toFixed(2) ?? ''
              }
              onChangeText={(value) => handleInputChange('pagosDe', value)}
              isManual={manualFields.pagosDe}
              onToggle={() => toggleManualField('pagosDe')}
              showToggle
              editable={manualFields.pagosDe}
              prefix="$"
              inputStyle={styles.pagosDeInput}
              editLabel="Modificar pagos"
            />
          )}

          <Text style={styles.label}>Agente de ventas *</Text>
          <TextInput
            style={styles.input}
            value={formData.agenteDeVentas}
            onChangeText={(value) => handleInputChange('agenteDeVentas', value)}
          />

          <Text style={styles.label}>Aclaraciones</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.aclaraciones}
            onChangeText={(value) => handleInputChange('aclaraciones', value)}
            multiline
            numberOfLines={4}
          />

          <Text style={styles.label}>Firma Digital</Text>
          <TouchableOpacity
            style={styles.signatureButton}
            onPress={() => setShowSignature(true)}
          >
            <Text style={styles.signatureButtonText}>
              {signature ? 'Editar Firma' : 'Agregar Firma'}
            </Text>
          </TouchableOpacity>
          {signature && (
            <TouchableOpacity style={styles.clearSignatureButton} onPress={clearSignature}>
              <Text style={styles.clearSignatureButtonText}>Limpiar Firma</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.cambioButton, showCambio && styles.cambioButtonActive]}
            onPress={() => setShowCambio((prev) => !prev)}
          >
            <Text
              style={[
                styles.cambioButtonText,
                showCambio && styles.cambioButtonTextActive,
              ]}
            >
              {showCambio ? 'Ocultar cambio' : 'Calcular cambio'}
            </Text>
          </TouchableOpacity>
          {showCambio && (
            <CambioCalculator
              amount={cashDue}
              pagaCon={pagaCon}
              onChangePagaCon={setPagaCon}
            />
          )}

          <TouchableOpacity
            style={[styles.submitButton, isSaving && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Guardar</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

interface AutoFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** True while the seller is typing this value by hand. */
  isManual: boolean;
  onToggle: () => void;
  showToggle: boolean;
  editable: boolean;
  prefix?: string;
  inputStyle?: StyleProp<TextStyle>;
  /** Accessibility label for the edit (pencil) button. */
  editLabel?: string;
  /** Red text shown above the label. */
  warning?: string;
}

// A calculated value with a pencil button (edit.png) inside the input on the
// right to type it by hand; while manual it shows robot.png to go back to the
// calculation.
function AutoField({
  label,
  value,
  onChangeText,
  isManual,
  onToggle,
  showToggle,
  editable,
  prefix,
  inputStyle,
  editLabel = 'Editar manualmente',
  warning,
}: AutoFieldProps): React.JSX.Element {
  return (
    <>
      {warning ? <Text style={styles.fieldErrorText}>{warning}</Text> : null}
      <Text style={[styles.label, warning ? styles.labelAfterError : null]}>
        {label}
      </Text>
      <View>
        <TextInput
          style={[
            styles.input,
            !editable && styles.inputDisabled,
            inputStyle,
            prefix ? styles.autoFieldInputWithPrefix : null,
            showToggle ? styles.autoFieldInputWithToggle : null,
          ]}
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
          editable={editable}
        />
        {prefix ? (
          <View pointerEvents="none" style={styles.autoFieldPrefix}>
            <Text style={[styles.autoFieldPrefixText, inputStyle]}>{prefix}</Text>
          </View>
        ) : null}
        {showToggle && (
          <TouchableOpacity
            style={styles.autoFieldToggle}
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={isManual ? 'Calcular automáticamente' : editLabel}
          >
            <Image
              source={isManual ? RobotImg : EditImg}
              style={styles.autoFieldToggleIcon}
            />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    // iOS: clear the notch. Android: modals already start below the status
    // bar, so 50 left a blank band there.
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
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
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
    color: '#333',
  },
  electronicButton: {
    backgroundColor: '#e9ecef',
    borderWidth: 1,
    borderColor: '#ced4da',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  electronicButtonActive: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  electronicButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  electronicButtonTextActive: {
    color: '#fff',
  },
  pagosDeInput: {
    fontWeight: 'bold',
    color: '#007bff',
  },
  autoFieldInputWithPrefix: {
    paddingLeft: 24,
  },
  autoFieldInputWithToggle: {
    paddingRight: 48,
  },
  autoFieldPrefix: {
    position: 'absolute',
    left: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  autoFieldPrefixText: {
    fontSize: 16,
    color: '#666',
  },
  autoFieldToggle: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  autoFieldToggleIcon: {
    width: 24,
    height: 24,
  },
  fieldErrorText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  labelAfterError: {
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputDisabled: {
    backgroundColor: '#f0f0f0',
    color: '#666',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    overflow: 'hidden',
  },
  // Explicit dark text so the iOS wheel stays readable when the phone is in
  // dark mode (the modal background is always white).
  pickerItem: {
    color: '#333',
    fontSize: 16,
  },
  defaultAddressButton: {
    backgroundColor: '#e7f1ff',
    borderWidth: 1,
    borderColor: '#007bff',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  defaultAddressButtonText: {
    color: '#007bff',
    fontWeight: '600',
  },
  dropdownValueText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownOptions: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    marginTop: 4,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  dropdownOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dropdownOptionSelected: {
    backgroundColor: '#e7f1ff',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    backgroundColor: '#fff',
  },
  dateButtonError: {
    borderColor: '#dc3545',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
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
  dateCancelButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  dateConfirmButton: {
    flex: 1,
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  dateConfirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  toggleBlock: {
    marginBottom: 12,
  },
  toggleButton: {
    backgroundColor: '#6c757d',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  toggleButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  toggleHint: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
    textAlign: 'center',
  },
  searchInput: {
    borderWidth: 2,
    borderColor: '#007bff',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    fontWeight: '600',
  },
  selectedProductBox: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    padding: 10,
    backgroundColor: '#f0f0f0',
  },
  selectedProductText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  selectedProductPlaceholder: {
    fontSize: 15,
    color: '#999',
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  productContainer: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  searchResults: {
    maxHeight: 150,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    marginTop: 4,
  },
  searchResultItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  removeButton: {
    backgroundColor: '#f8d7da',
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#721c24',
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginVertical: 12,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  signatureButton: {
    backgroundColor: '#6c757d',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  signatureButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  clearSignatureButton: {
    backgroundColor: '#dc3545',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  clearSignatureButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  cambioButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#28a745',
    backgroundColor: '#fff',
  },
  cambioButtonActive: {
    backgroundColor: '#28a745',
  },
  cambioButtonText: {
    color: '#1e7e34',
    fontSize: 15,
    fontWeight: '700',
  },
  cambioButtonTextActive: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#007bff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  signatureContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  signatureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    // iOS: clear the notch. Android: modals already start below the status
    // bar, so 50 left a blank band there.
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  signatureHeaderButtonText: {
    color: '#007bff',
    fontSize: 16,
    fontWeight: '600',
  },
  signatureCanvasWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  signatureCanvas: {
    height: 320,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  signatureSaveButton: {
    backgroundColor: '#28a745',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  signatureSaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});