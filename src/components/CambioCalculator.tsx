// src/components/CambioCalculator.tsx
// "Paga con" → "Cambio a entregar" helper for cash payments: the cashier
// types (or taps) what the customer hands over and sees the change to give
// back in big type. Display-only; nothing is saved.
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { getCambio, suggestCashAmounts } from '../utils/cambio';
import { formatMoney } from '../utils/customerBalance';

interface CambioCalculatorProps {
  /** Amount due in cash right now. */
  amount: number;
  /** Raw text of the "Paga con" input (kept by the parent). */
  pagaCon: string;
  onChangePagaCon: (value: string) => void;
}

export default function CambioCalculator({
  amount,
  pagaCon,
  onChangePagaCon,
}: CambioCalculatorProps): React.JSX.Element {
  const paid = parseFloat(pagaCon);
  const result = getCambio(amount, paid);
  const quick = suggestCashAmounts(amount);

  return (
    <View style={styles.box}>
      <View style={styles.rowBetween}>
        <Text style={styles.title}>Pago en efectivo</Text>
        <Text style={styles.due}>
          A cobrar: {amount > 0 ? formatMoney(amount) : '—'}
        </Text>
      </View>

      <Text style={styles.label}>Paga con</Text>
      <View style={styles.inputWrap}>
        <Text style={styles.currency}>$</Text>
        <TextInput
          style={styles.input}
          value={pagaCon}
          onChangeText={onChangePagaCon}
          keyboardType="numeric"
          placeholder="0.00"
          placeholderTextColor="#9aa5b1"
        />
      </View>

      {amount > 0 && (
        <View style={styles.chips}>
          <TouchableOpacity
            style={styles.chip}
            onPress={() => onChangePagaCon(String(amount))}
          >
            <Text style={styles.chipText}>Exacto</Text>
          </TouchableOpacity>
          {quick.map((v) => (
            <TouchableOpacity
              key={v}
              style={styles.chip}
              onPress={() => onChangePagaCon(String(v))}
            >
              <Text style={styles.chipText}>{formatMoney(v).replace('.00', '')}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {result == null ? (
        <Text style={styles.hint}>
          {amount > 0
            ? 'Escribe con cuánto paga el cliente para ver el cambio.'
            : 'Primero escribe la cantidad a cobrar.'}
        </Text>
      ) : result.faltan > 0 ? (
        <View style={[styles.result, styles.resultShort]}>
          <Text style={[styles.resultLabel, styles.shortColor]}>Faltan</Text>
          <Text style={[styles.resultAmount, styles.shortColor]}>
            {formatMoney(result.faltan)}
          </Text>
        </View>
      ) : (
        <View style={[styles.result, styles.resultOk]}>
          <Text style={[styles.resultLabel, styles.okColor]}>Cambio a entregar</Text>
          <Text style={[styles.resultAmount, styles.okColor]}>
            {formatMoney(result.cambio)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f4f8f4',
    borderWidth: 1,
    borderColor: '#cfe3d2',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2d3d',
  },
  due: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginTop: 10,
    marginBottom: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccd6cf',
    borderRadius: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
  },
  currency: {
    fontSize: 18,
    color: '#5b6878',
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 18,
    paddingVertical: 10,
    color: '#1f2d3d',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#28a745',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e7e34',
  },
  hint: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 10,
  },
  result: {
    marginTop: 10,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultOk: {
    backgroundColor: '#d9f2df',
  },
  resultShort: {
    backgroundColor: '#fbe4e1',
  },
  resultLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  resultAmount: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  okColor: {
    color: '#1e7e34',
  },
  shortColor: {
    color: '#c0392b',
  },
});
