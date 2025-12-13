// src/components/SaleModal.tsx
import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SignatureScreen from 'react-native-signature-canvas';
import { buildIncomePayload } from '../utils/incoms';
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
  agenteDeVentas: string;
  aclaraciones: string;
}

interface SaleModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: (data: any) => void;
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
  const [signature, setSignature] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const signatureRef = useRef<any>(null);

  const [formData, setFormData] = useState<SaleData>({
    nombre: '',
    email: '',
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
    agenteDeVentas: '',
    aclaraciones: '',
  });

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
      const response = await fetch('https://api.huastex.com/inventory');
      const data = await response.json();
      setAvailableInventory(data);
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
      email: initialData.email || '',
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
      agenteDeVentas: initialData.agentedeventas || '',
      aclaraciones: initialData.aclaraciones || '',
      products: mappedProducts,
    });

    if (initialData.firmadigital) {
      setSignature(initialData.firmadigital);
    }
  }, [initialData, userBranch]);

  const toggleMode = () => {
    setManualPricing((prev) => !prev);
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

  const handlePlazoChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      plazo: {
        ...formData.plazo,
        [field]: value,
      },
    });
  };

  const calculateDueDate = () => {
    const { fecha, plazo } = formData;
    if (!fecha || !plazo.value) {
      return '';
    }

    const date = new Date(fecha);
    if (isNaN(date.getTime())) {
      return '';
    }

    const value = parseInt(plazo.value, 10);
    switch (plazo.unit) {
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
    } catch (err) {
      return '';
    }
  };

  useEffect(() => {
    const due = calculateDueDate();
    if (due && due !== formData.fechaVencimiento) {
      setFormData((prev) => ({
        ...prev,
        fechaVencimiento: due,
      }));
    }
  }, [formData.fecha, formData.plazo.value, formData.plazo.unit]);

  const getUnitPriceForItem = (inventoryItem: any) => {
    const branch = formData.sucursal && formData.sucursal.trim()
      ? formData.sucursal.toLowerCase()
      : userBranch.toLowerCase();
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
      serial_number: inventoryItem.serial_number || '',
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

// Continuation of SaleModal.tsx...

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

  const calculateTotalPrice = () => {
    const sum = formData.products.reduce((total, product) => {
      const val = parseFloat(String(product.totalProductPrice));
      return total + (isNaN(val) ? 0 : val);
    }, 0);
    return sum.toFixed(2);
  };

  useEffect(() => {
    if (isEditing || manualPricing) return;
    
    const totalPrice = Number(calculateTotalPrice());
    let discountedPrice = totalPrice;
    
    if (formData.discount) {
      discountedPrice = totalPrice * (1 - Number(formData.discount) / 100);
    }
    
    const calculatedPrecioNormal =
      formData.formaDePago.toLowerCase() === 'contado'
        ? 0
        : (discountedPrice * 1.12).toFixed(2);
    
    setFormData((prevData) => ({
      ...prevData,
      precioPromocion: discountedPrice.toFixed(2),
      precioNormal: String(calculatedPrecioNormal),
      saldoPrecioPromocion:
        formData.formaDePago.toLowerCase() === 'contado'
          ? '0.00'
          : (discountedPrice - Number(formData.enganche)).toFixed(2),
      saldoPrecioNormal:
        formData.formaDePago.toLowerCase() === 'contado'
          ? '0.00'
          : (Number(calculatedPrecioNormal) - Number(formData.enganche)).toFixed(2),
    }));
  }, [
    formData.products,
    formData.discount,
    formData.formaDePago,
    formData.enganche,
    manualPricing,
    isEditing,
  ]);

  const handleSubmit = async () => {
    if (!formData.nombre || !formData.email || !formData.phone) {
      Alert.alert('Error', 'Por favor completa los campos requeridos');
      return;
    }

    setIsSaving(true);

    const dataToSubmit = {
      ...formData,
      firmadigital: signature,
      saldoPrecioPromocion: formData.saldoPrecioPromocion,
      saldoPrecioNormal: formData.saldoPrecioNormal,
    };

    const endpoint = isEditing
      ? `https://api.huastex.com/sales/${initialData.id}`
      : 'https://api.huastex.com/sales/add';
    const verb = isEditing ? 'PUT' : 'POST';

    try {
      const saleRes = await fetch(endpoint, {
        method: verb,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSubmit),
      });

      if (!saleRes.ok) {
        const text = await saleRes.text().catch(() => '');
        throw new Error(`Server ${verb} failed: ${saleRes.status} ${text}`);
      }

      const saved = await saleRes.json();
      console.log('✔️ Sale saved:', saved);

      const fullSale = { ...dataToSubmit, id: saved.id };
      const incomePayload = buildIncomePayload(fullSale);
      incomePayload.sale_id = saved.id;

      if (!isEditing) {
        try {
          const txRes = await api.post('/transactions', incomePayload);
          console.log('✔️ Income recorded:', txRes.data);
        } catch (err: any) {
          console.error('❌ Failed to create income for new sale:', err.response?.data || err.message);
        }
      } else {
        try {
          const txRes = await api.get('/transactions', { params: { sale_id: saved.id } });
          const existingTx = Array.isArray(txRes.data) && txRes.data.length ? txRes.data[0] : null;

          if (existingTx) {
            await api.put(`/transactions/${existingTx.id}`, incomePayload);
            console.log(`✔️ Updated transaction ${existingTx.id}`);
          } else {
            const created = await api.post('/transactions', incomePayload);
            console.log('✔️ Transaction created for edited sale:', created.data);
          }
        } catch (err: any) {
          console.error('❌ Failed to find/update/create transaction on edit:', err.response?.data || err.message);
        }
      }

      setIsSaving(false);
      Alert.alert('Éxito', 'Venta guardada correctamente');
      onSaved(saved);
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
      height: 300px;
    }
  `;

  if (showSignature) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.signatureContainer}>
          <View style={styles.signatureHeader}>
            <TouchableOpacity onPress={() => setShowSignature(false)}>
              <Text style={styles.signatureButton}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearSignature}>
              <Text style={styles.signatureButton}>Limpiar</Text>
            </TouchableOpacity>
          </View>
          <SignatureScreen
            ref={signatureRef}
            onOK={handleSignatureEnd}
            webStyle={webStyle}
          />
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

        <ScrollView style={styles.form}>
          <Text style={styles.label}>Forma de pago *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.formaDePago}
              onValueChange={(value) => handleInputChange('formaDePago', value)}
            >
              <Picker.Item label="Contado" value="Contado" />
              <Picker.Item label="Apartado" value="Apartado" />
              <Picker.Item label="Crédito" value="Crédito" />
              <Picker.Item label="MSI" value="MSI" />
            </Picker>
          </View>

          <Text style={styles.label}>Sucursal *</Text>
          {userRole === 'admin' || userRole === 'superadmin' ? (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.sucursal}
                onValueChange={(value) => handleInputChange('sucursal', value)}
              >
                <Picker.Item label="Seleccione..." value="" />
                <Picker.Item label="Cerro Azul" value="cerroazul" />
                <Picker.Item label="Aquismon" value="aquismon" />
                <Picker.Item label="Tepetzintla" value="tepetzintla" />
                <Picker.Item label="Tlacolula" value="tlacolula" />
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

          <Text style={styles.label}>Fecha *</Text>
          <TextInput
            style={styles.input}
            value={formData.fecha}
            onChangeText={(value) => handleInputChange('fecha', value)}
            placeholder="YYYY-MM-DD"
          />

          <TouchableOpacity style={styles.toggleButton} onPress={toggleMode}>
            <Text style={styles.toggleButtonText}>
              {manualPricing ? 'Buscar en inventario' : 'Agregar precio manualmente'}
            </Text>
          </TouchableOpacity>

          {/* Products section - see next artifact for rendering */}
          
          <Text style={styles.sectionTitle}>Productos</Text>
          {formData.products.map((product, index) => (
            <View key={index} style={styles.productContainer}>
              <TextInput
                style={styles.input}
                placeholder={manualPricing ? "Producto manual" : "Seleccione desde búsqueda"}
                value={product.producto}
                onChangeText={(value) => handleInputChange('producto', value, index)}
                editable={manualPricing}
              />

              {!manualPricing && (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Buscar producto..."
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
                          item.product.toLowerCase().includes(searchTerms[index].toLowerCase())
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

          <Text style={styles.label}>Precio de promoción</Text>
          <TextInput
            style={[styles.input, !manualPricing && styles.inputDisabled]}
            value={formData.precioPromocion}
            onChangeText={(value) => handleInputChange('precioPromocion', value)}
            keyboardType="numeric"
            editable={manualPricing}
          />

          <Text style={styles.label}>Precio normal</Text>
          <TextInput
            style={[styles.input, !manualPricing && styles.inputDisabled]}
            value={formData.precioNormal}
            onChangeText={(value) => handleInputChange('precioNormal', value)}
            keyboardType="numeric"
            editable={manualPricing}
          />

          <Text style={styles.label}>Descuento (%)</Text>
          <TextInput
            style={styles.input}
            value={formData.discount}
            onChangeText={(value) => handleInputChange('discount', value)}
            keyboardType="numeric"
          />

          {(manualPricing || isEditing) && (
            <>
              <Text style={styles.label}>Saldo Precio Promoción</Text>
              <TextInput
                style={[styles.input, isContado && styles.inputDisabled]}
                value={formData.saldoPrecioPromocion}
                onChangeText={(value) => handleInputChange('saldoPrecioPromocion', value)}
                keyboardType="numeric"
                editable={!isContado}
              />
              <Text style={styles.label}>Saldo Precio Normal</Text>
              <TextInput
                style={[styles.input, isContado && styles.inputDisabled]}
                value={formData.saldoPrecioNormal}
                onChangeText={(value) => handleInputChange('saldoPrecioNormal', value)}
                keyboardType="numeric"
                editable={!isContado}
              />
            </>
          )}

          {!manualPricing && !isEditing && (
            <>
              <Text style={styles.label}>Saldo Precio Promoción</Text>
              <Text style={styles.displayText}>{formData.saldoPrecioPromocion}</Text>
              <Text style={styles.label}>Saldo Precio Normal</Text>
              <Text style={styles.displayText}>{formData.saldoPrecioNormal}</Text>
            </>
          )}

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
            >
              <Picker.Item label="Días" value="days" />
              <Picker.Item label="Semanas" value="weeks" />
              <Picker.Item label="Meses" value="months" />
            </Picker>
          </View>

          <Text style={styles.label}>Fecha de vencimiento</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={formData.fechaVencimiento}
            editable={false}
          />

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

// Styles for SaleModal...
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
    paddingTop: 50,
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  toggleButton: {
    backgroundColor: '#1c60d5',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginVertical: 12,
  },
  toggleButtonText: {
    color: '#fff',
    fontWeight: '600',
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
  displayText: {
    fontSize: 16,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    color: '#333',
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
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
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