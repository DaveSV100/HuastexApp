// src/components/FormulaModal.tsx
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    id?: number;
    name: string;
    operators: string;
    initialNumber: number | null;
    finalNumber: number | null;
  }) => void;
  initialData?: any | null;
};

const calculateResult = (initial: string | number, opsString: string) => {
  let currentValue = parseFloat(String(initial));
  if (isNaN(currentValue)) return '';

  const cleaned = opsString.replace(/\s+/g, '');
  const regex = /([+\-x\/])(\d+(\.\d+)?%?)/g;
  let match;
  while ((match = regex.exec(cleaned)) !== null) {
    const operator = match[1];
    let operandStr = match[2];
    const isPercent = operandStr.endsWith('%');
    let operand = parseFloat(isPercent ? operandStr.slice(0, -1) : operandStr);
    if (isNaN(operand)) continue;
    if (isPercent) operand = operand / 100;
    if (operator === 'x') {
      currentValue *= operand;
    } else if (operator === '+') {
      currentValue += operand;
    } else if (operator === '-') {
      currentValue -= operand;
    } else if (operator === '/') {
      currentValue /= operand;
    }
  }
  return currentValue;
};

export default function FormulaModal({ visible, onClose, onSave, initialData = null }: Props) {
  const [name, setName] = useState('');
  const [operators, setOperators] = useState('');
  const [initialNumber, setInitialNumber] = useState('');
  const [finalNumber, setFinalNumber] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name ?? '');
      setOperators(initialData.operators ?? '');
      setInitialNumber(initialData.initialNumber != null ? String(initialData.initialNumber) : '');
      setFinalNumber(initialData.finalNumber != null ? String(initialData.finalNumber) : '');
    } else {
      setName('');
      setOperators('');
      setInitialNumber('');
      setFinalNumber('');
    }
  }, [initialData, visible]);

  useEffect(() => {
    if (initialNumber !== '' && operators !== '') {
      const result = calculateResult(initialNumber, operators);
      setFinalNumber(result === '' ? '' : String(result));
    } else {
      setFinalNumber('');
    }
  }, [initialNumber, operators]);

  const addOperator = (op: string) => setOperators((p) => p + op);

  const handleSave = () => {
    const payload = {
      id: initialData?.id,
      name,
      operators,
      initialNumber: initialNumber === '' ? null : Number(initialNumber),
      finalNumber: finalNumber === '' ? null : Number(finalNumber),
    };
    onSave(payload);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Agregar fórmula</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre de fórmula</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Cantidad inicial (ejemplo)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={initialNumber}
                onChangeText={setInitialNumber}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Operadores</Text>
              <TextInput
                style={styles.input}
                value={operators}
                onChangeText={setOperators}
                placeholder="Construye tu fórmula..."
              />
            </View>

            <View style={styles.calculatorRow}>
              {['+', '-', 'x', '/', '%'].map((op) => (
                <TouchableOpacity key={op} style={styles.opButton} onPress={() => addOperator(op)}>
                  <Text style={styles.opText}>{op}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Cantidad final (ejemplo)</Text>
              <TextInput style={[styles.input, styles.readonly]} value={finalNumber} editable={false} />
            </View>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 12 },
  modal: { backgroundColor: '#fff', borderRadius: 8, padding: 12, maxHeight: '90%' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#222' },
  closeButton: { padding: 6 },
  closeText: { fontSize: 20 },
  formGroup: { marginTop: 12 },
  label: { fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8, backgroundColor: '#fff' },
  readonly: { backgroundColor: '#f0f0f0' },
  calculatorRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  opButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, borderWidth: 1, borderColor: '#0070f3' },
  opText: { color: '#0070f3', fontWeight: '700' },
  footer: { marginTop: 16, alignItems: 'flex-end' },
  saveButton: { backgroundColor: '#0070f3', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6 },
  saveText: { color: '#fff', fontWeight: '700' },
});
