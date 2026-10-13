// src/components/CustomerSaleCard.tsx
// One order in the customer's "Mis Pedidos": the balance they owe right now
// in big type (saldo precio promoción, or saldo precio normal once the promo
// expired), the other saldo smaller, and their payment plan in plain words.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  getCustomerBalanceView,
  formatMoney,
  formatDateDMY,
} from '../utils/customerBalance';
import { SaleStatus } from '../utils/paymentStatus';

const STATUS_CHIP: Record<SaleStatus, { label: string; color: string; bg: string }> = {
  pagada: { label: 'Pagado', color: '#1e7e34', bg: '#e3f4e8' },
  a_tiempo: { label: 'Al corriente', color: '#1e7e34', bg: '#e3f4e8' },
  atrasada: { label: 'Atrasado', color: '#b45f06', bg: '#fdf0dc' },
  vencida: { label: 'Vencido', color: '#c0392b', bg: '#fbe4e1' },
};

const FREQUENCY_TEXT: Record<string, string> = {
  Semanal: 'cada semana',
  Quincenal: 'cada quincena',
  Mensual: 'cada mes',
};

export default function CustomerSaleCard({ sale }: { sale: any }): React.JSX.Element {
  const view = getCustomerBalanceView(sale);
  const { info } = view;
  const chip = STATUS_CHIP[info.status];
  const products = (sale.products || [])
    .filter((p: any) => p)
    .map((p: any) => {
      const title = p.title || p.producto || 'Producto';
      return Number(p.quantity) > 1 ? `${title} (x${p.quantity})` : title;
    })
    .join(', ');
  const meta = [
    sale.fecha ? `Compra ${formatDateDMY(sale.fecha)}` : '',
    sale.formadepago,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.orderId}>Pedido #{sale.id}</Text>
        <View style={[styles.chip, { backgroundColor: chip.bg }]}>
          <Text style={[styles.chipText, { color: chip.color }]}>{chip.label}</Text>
        </View>
      </View>
      {Boolean(products) && <Text style={styles.products}>{products}</Text>}
      {Boolean(meta) && <Text style={styles.meta}>{meta}</Text>}

      {view.mode === 'paid' ? (
        <View style={[styles.balanceBox, styles.balanceBoxPaid]}>
          <Text style={styles.paidText}>✓ Pagado</Text>
          <Text style={styles.secondary}>
            Total: {formatMoney(Number(sale.preciopromocion || sale.total_price || 0))}
          </Text>
        </View>
      ) : view.mode === 'promo' ? (
        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>SALDO PRECIO PROMOCIÓN</Text>
          <Text style={[styles.balanceAmount, styles.amountPromo]}>
            {formatMoney(view.amountDue)}
          </Text>
          <Text style={styles.secondary}>
            Saldo precio normal: {formatMoney(view.saldoNormal)}
          </Text>
          {view.promoDeadline && (
            <Text style={styles.hint}>
              Liquida antes del {formatDateDMY(view.promoDeadline)} para conservar el
              precio de promoción.
            </Text>
          )}
        </View>
      ) : (
        <View style={[styles.balanceBox, styles.balanceBoxNormal]}>
          <Text style={styles.balanceLabel}>SALDO A PAGAR (PRECIO NORMAL)</Text>
          <Text style={[styles.balanceAmount, styles.amountNormal]}>
            {formatMoney(view.amountDue)}
          </Text>
          <Text style={styles.secondary}>
            Saldo precio promoción:{' '}
            <Text style={styles.struck}>
              {formatMoney(Number(sale.saldo_precio_promocion || 0))}
            </Text>{' '}
            (ya no aplica)
          </Text>
          <Text style={styles.hint}>
            {view.promoDeadline
              ? `Tu precio de promoción venció el ${formatDateDMY(view.promoDeadline)}.`
              : 'Tu precio de promoción ya venció.'}
            {info.surchargePct > 0
              ? ` Incluye interés por atraso (+${info.surchargePct}%).`
              : ''}
          </Text>
        </View>
      )}

      {view.mode !== 'paid' && (
        <View style={styles.planBox}>
          {info.pagosDe != null && info.frequency && (
            <Text style={styles.planText}>
              {info.frequency === 'Al terminar'
                ? `Pago único al terminar el plazo: ${formatMoney(info.pagosDe)}`
                : `Pagos de ${formatMoney(info.pagosDe)} ${
                    FREQUENCY_TEXT[info.frequency] || ''
                  }`}
            </Text>
          )}
          {Boolean(sale.fechavencimiento) && (
            <Text style={styles.planText}>
              Fecha de vencimiento: {formatDateDMY(sale.fechavencimiento)}
            </Text>
          )}
          {/* Past the due date the whole saldo is owed, so an "atrasado"
              amount would understate it. */}
          {info.status === 'vencida' ? (
            <Text style={styles.lateText}>
              Tu plazo terminó: liquida tu saldo lo antes posible.
            </Text>
          ) : (
            info.cantidadAtrasada > 0 && (
              <Text style={styles.lateText}>
                Pago atrasado: {formatMoney(info.cantidadAtrasada)}
              </Text>
            )
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e3e7ee',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2d3d',
  },
  chip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  products: {
    fontSize: 14,
    color: '#333',
    marginTop: 6,
  },
  meta: {
    fontSize: 12,
    color: '#7a8594',
    marginTop: 2,
  },
  balanceBox: {
    marginTop: 10,
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#eef5fc',
  },
  balanceBoxNormal: {
    backgroundColor: '#fdf3ec',
  },
  balanceBoxPaid: {
    backgroundColor: '#e3f4e8',
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5b6878',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 2,
  },
  amountPromo: {
    color: '#0b6fc2',
  },
  amountNormal: {
    color: '#b5470b',
  },
  secondary: {
    fontSize: 13,
    color: '#5b6878',
    marginTop: 4,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  hint: {
    fontSize: 12,
    color: '#5b6878',
    marginTop: 6,
    fontStyle: 'italic',
  },
  paidText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e7e34',
  },
  planBox: {
    marginTop: 8,
  },
  planText: {
    fontSize: 13,
    color: '#333',
    marginTop: 2,
  },
  lateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b45f06',
    marginTop: 4,
  },
});
