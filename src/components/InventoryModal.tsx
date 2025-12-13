// src/components/InventoryModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { compile } from 'mathjs';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (data: any, cb?: () => void) => void;
  initialData?: any;
  formulas?: any[];
};

const safeTrim = (value: any) => (typeof value === 'string' ? value.trim() : value);

export default function InventoryModal({ visible, onClose, onSave, initialData = {}, formulas = [] }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [manualPricing, setManualPricing] = useState(false);

  const [formData, setFormData] = useState<any>({
    product: '',
    price_cost: '',
    model: '',
    serial_number: '',
    cerro_azul_price: '',
    aquismon_price: '',
    tepetzintla_price: '',
    tlacolula_price: '',
    cerro_azul_msiPrice: '',
    cerro_azul_creditPrice: '',
    aquismon_msiPrice: '',
    aquismon_creditPrice: '',
    tepetzintla_msiPrice: '',
    tepetzintla_creditPrice: '',
    tlacolula_msiPrice: '',
    tlacolula_creditPrice: '',
    headquarters_arrival_date: '',
    original_quantity: '',
    all_branches_quantity: '',
    internal_number: '',
    description: '',
    category: '',
    supplier: '',
    supplier_bill: '',
    final_customer_bill: '',
    devolution_bill: '',
    bank_deposit: '',
    comments: '',
    formula_id: '',
    id: undefined,
  });

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData((prev: any) => ({ ...prev, ...initialData }));
    } else {
      // reset when opening empty
      setFormData((prev: any) => ({ ...prev, id: undefined }));
    }
  }, [initialData, visible]);

  const formulaOptions = useMemo(() => {
    return formulas.map((f: any) => ({ value: String(f.id), label: f.name, operators: f.operators }));
  }, [formulas]);

  const handleChange = (name: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const roundToNearest10 = (value: number) => Math.ceil(value / 10) * 10;

  useEffect(() => {
    if (!manualPricing) {
      const basePrice = Number(formData.price_cost);
      if (!isNaN(basePrice) && basePrice !== 0) {
        let computed = roundToNearest10(basePrice);
        if (formData.formula_id) {
          const selected = formulaOptions.find((o: any) => o.value === String(formData.formula_id));
          if (selected && selected.operators) {
            try {
              let opStr = safeTrim(selected.operators);
              opStr = opStr.replace(/x/g, '*');
              if (!/^[+\-*/]/.test(opStr)) {
                opStr = '+' + opStr;
              }
              const expr = compile(`${basePrice}${opStr}`);
              const val = expr.evaluate();
              if (typeof val === 'number' && !isNaN(val)) computed = roundToNearest10(val);
            } catch (err) {
              console.warn('Formula compute error', err);
              computed = roundToNearest10(basePrice);
            }
          }
        }

        const computedAquismon = roundToNearest10(computed * 1.032);
        const computedTepetzintla = roundToNearest10(computed * 1.03);
        const computedTlacolula = roundToNearest10(computed * 1.045);

        const computedCerroAzulMsi = roundToNearest10(computed * 1.1);
        const computedCerroAzulCredit = roundToNearest10(computed * 1.52);
        const computedAquismonMsi = roundToNearest10(computedAquismon * 1.1);
        const computedAquismonCredit = roundToNearest10(computedAquismon * 1.52);
        const computedTepetzintlaMsi = roundToNearest10(computedTepetzintla * 1.1);
        const computedTepetzintlaCredit = roundToNearest10(computedTepetzintla * 1.52);
        const computedTlacolulaMsi = roundToNearest10(computedTlacolula * 1.1);
        const computedTlacolulaCredit = roundToNearest10(computedTlacolula * 1.52);

        setFormData((prev: any) => ({
          ...prev,
          cerro_azul_price: String(computed),
          aquismon_price: String(computedAquismon),
          tepetzintla_price: String(computedTepetzintla),
          tlacolula_price: String(computedTlacolula),
          cerro_azul_msiPrice: String(computedCerroAzulMsi),
          cerro_azul_creditPrice: String(computedCerroAzulCredit),
          aquismon_msiPrice: String(computedAquismonMsi),
          aquismon_creditPrice: String(computedAquismonCredit),
          tepetzintla_msiPrice: String(computedTepetzintlaMsi),
          tepetzintla_creditPrice: String(computedTepetzintlaCredit),
          tlacolula_msiPrice: String(computedTlacolulaMsi),
          tlacolula_creditPrice: String(computedTlacolulaCredit),
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.price_cost, formData.formula_id, manualPricing]);

  const togglePricingMode = () => setManualPricing((p) => !p);

  const handleSubmit = async () => {
    setIsSaving(true);
    const dataToSubmit = { ...formData };

    if (safeTrim(dataToSubmit.headquarters_arrival_date) === '') {
      dataToSubmit.headquarters_arrival_date = null;
    }
    dataToSubmit.price_cost = Number(dataToSubmit.price_cost) || null;
    dataToSubmit.cerro_azul_price = Number(dataToSubmit.cerro_azul_price) || null;
    dataToSubmit.aquismon_price = Number(dataToSubmit.aquismon_price) || null;
    dataToSubmit.tepetzintla_price = Number(dataToSubmit.tepetzintla_price) || null;
    dataToSubmit.tlacolula_price = Number(dataToSubmit.tlacolula_price) || null;

    dataToSubmit.cerro_azul_msiPrice = Number(dataToSubmit.cerro_azul_msiPrice) || null;
    dataToSubmit.cerro_azul_creditPrice = Number(dataToSubmit.cerro_azul_creditPrice) || null;
    dataToSubmit.aquismon_msiPrice = Number(dataToSubmit.aquismon_msiPrice) || null;
    dataToSubmit.aquismon_creditPrice = Number(dataToSubmit.aquismon_creditPrice) || null;
    dataToSubmit.tepetzintla_msiPrice = Number(dataToSubmit.tepetzintla_msiPrice) || null;
    dataToSubmit.tepetzintla_creditPrice = Number(dataToSubmit.tepetzintla_creditPrice) || null;
    dataToSubmit.tlacolula_msiPrice = Number(dataToSubmit.tlacolula_msiPrice) || null;
    dataToSubmit.tlacolula_creditPrice = Number(dataToSubmit.tlacolula_creditPrice) || null;

    dataToSubmit.original_quantity = Number(dataToSubmit.original_quantity) || null;
    dataToSubmit.all_branches_quantity = Number(dataToSubmit.all_branches_quantity) || null;
    dataToSubmit.formula_id = formData.formula_id || null;

    try {
      await onSave(dataToSubmit, () => setIsSaving(false));
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            <TouchableOpacity style={styles.close} onPress={onClose}>
              <Text style={{ fontSize: 20 }}>×</Text>
            </TouchableOpacity>
            <Text style={styles.heading}>{formData.id ? 'Edit Product' : 'Add Product'}</Text>

            <Text style={styles.label}>Product</Text>
            <TextInput style={styles.input} value={formData.product} onChangeText={(t) => handleChange('product', t)} />

            <Text style={styles.label}>Price Cost</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={String(formData.price_cost ?? '')} onChangeText={(t) => handleChange('price_cost', t)} />

            <Text style={styles.label}>Formula por categoría</Text>
            <View style={styles.pickerWrap}>
              <Picker
                enabled={!manualPricing}
                selectedValue={formData.formula_id ? String(formData.formula_id) : ''}
                onValueChange={(val) => handleChange('formula_id', val)}
              >
                <Picker.Item label="-- Select --" value="" />
                {formulaOptions.map((o) => <Picker.Item key={o.value} label={o.label} value={o.value} />)}
              </Picker>
            </View>

            <TouchableOpacity style={[styles.manualBtn, manualPricing ? styles.manualBtnActive : {}]} onPress={togglePricingMode}>
              <Text style={{ color: '#fff' }}>{manualPricing ? 'Usar fórmulas' : 'Agregar precio manualmente'}</Text>
            </TouchableOpacity>

            {/* Price inputs (readOnly when formula mode) */}
            <Text style={styles.label}>Cerro Azul Price</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={String(formData.cerro_azul_price ?? '')} onChangeText={(t) => handleChange('cerro_azul_price', t)} editable={manualPricing} />

            <Text style={styles.label}>Cerro Azul MSI Price</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={String(formData.cerro_azul_msiPrice ?? '')} onChangeText={(t) => handleChange('cerro_azul_msiPrice', t)} editable={manualPricing} />

            <Text style={styles.label}>Cerro Azul Credit Price</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={String(formData.cerro_azul_creditPrice ?? '')} onChangeText={(t) => handleChange('cerro_azul_creditPrice', t)} editable={manualPricing} />

            {/* repeat for all other branch price inputs (Aquismon, Tepetzintla, Tlacolula) */}
            <Text style={styles.label}>Aquismon Price</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={String(formData.aquismon_price ?? '')} onChangeText={(t) => handleChange('aquismon_price', t)} editable={manualPricing} />

            <Text style={styles.label}>Aquismon MSI Price</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={String(formData.aquismon_msiPrice ?? '')} onChangeText={(t) => handleChange('aquismon_msiPrice', t)} editable={manualPricing} />

            <Text style={styles.label}>Aquismon Credit Price</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={String(formData.aquismon_creditPrice ?? '')} onChangeText={(t) => handleChange('aquismon_creditPrice', t)} editable={manualPricing} />

            <Text style={styles.label}>Tepetzintla Price</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={String(formData.tepetzintla_price ?? '')} onChangeText={(t) => handleChange('tepetzintla_price', t)} editable={manualPricing} />

            <Text style={styles.label}>Tepetzintla MSI Price</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={String(formData.tepetzintla_msiPrice ?? '')} onChangeText={(t) => handleChange('tepetzintla_msiPrice', t)} editable={manualPricing} />

            <Text style={styles.label}>Tepetzintla Credit Price</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={String(formData.tepetzintla_creditPrice ?? '')} onChangeText={(t) => handleChange('tepetzintla_creditPrice', t)} editable={manualPricing} />

            <Text style={styles.label}>Tlacolula Price</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={String(formData.tlacolula_price ?? '')} onChangeText={(t) => handleChange('tlacolula_price', t)} editable={manualPricing} />

            <Text style={styles.label}>Tlacolula MSI Price</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={String(formData.tlacolula_msiPrice ?? '')} onChangeText={(t) => handleChange('tlacolula_msiPrice', t)} editable={manualPricing} />

            <Text style={styles.label}>Tlacolula Credit Price</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={String(formData.tlacolula_creditPrice ?? '')} onChangeText={(t) => handleChange('tlacolula_creditPrice', t)} editable={manualPricing} />

            <Text style={styles.label}>Headquarters Arrival Date</Text>
            <TextInput style={styles.input} value={String(formData.headquarters_arrival_date ?? '')} onChangeText={(t) => handleChange('headquarters_arrival_date', t)} placeholder="YYYY-MM-DD or leave empty" />

            <Text style={styles.label}>Original Quantity</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={String(formData.original_quantity ?? '')} onChangeText={(t) => handleChange('original_quantity', t)} />

            <Text style={styles.label}>All Branches Quantity</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={String(formData.all_branches_quantity ?? '')} onChangeText={(t) => handleChange('all_branches_quantity', t)} />

            <Text style={styles.label}>Internal Number</Text>
            <TextInput style={styles.input} value={String(formData.internal_number ?? '')} onChangeText={(t) => handleChange('internal_number', t)} />

            <Text style={styles.label}>Description</Text>
            <TextInput style={styles.input} value={String(formData.description ?? '')} onChangeText={(t) => handleChange('description', t)} />

            <Text style={styles.label}>Supplier</Text>
            <TextInput style={styles.input} value={String(formData.supplier ?? '')} onChangeText={(t) => handleChange('supplier', t)} />

            <Text style={styles.label}>Supplier Bill</Text>
            <TextInput style={styles.input} value={String(formData.supplier_bill ?? '')} onChangeText={(t) => handleChange('supplier_bill', t)} />

            <Text style={styles.label}>Final Customer Bill</Text>
            <TextInput style={styles.input} value={String(formData.final_customer_bill ?? '')} onChangeText={(t) => handleChange('final_customer_bill', t)} />

            <Text style={styles.label}>Devolution Bill</Text>
            <TextInput style={styles.input} value={String(formData.devolution_bill ?? '')} onChangeText={(t) => handleChange('devolution_bill', t)} />

            <Text style={styles.label}>Bank Deposit</Text>
            <TextInput style={styles.input} value={String(formData.bank_deposit ?? '')} onChangeText={(t) => handleChange('bank_deposit', t)} />

            <Text style={styles.label}>Comments</Text>
            <TextInput style={styles.input} value={String(formData.comments ?? '')} onChangeText={(t) => handleChange('comments', t)} />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff' }}>Guardar</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 12 },
  modal: { backgroundColor: '#fff', borderRadius: 8, padding: 12, maxHeight: '90%' },
  close: { position: 'absolute', right: 12, top: 12, zIndex: 10 },
  heading: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  label: { marginTop: 8, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 6, marginTop: 6 },
  pickerWrap: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, marginTop: 6, overflow: 'hidden' },
  manualBtn: { marginTop: 10, padding: 10, backgroundColor: '#1c60d5', borderRadius: 6, alignItems: 'center' },
  manualBtnActive: { backgroundColor: '#0e3e9a' },
  saveBtn: { marginTop: 12, padding: 12, backgroundColor: '#0070f3', borderRadius: 6, alignItems: 'center' },
});
