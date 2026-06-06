// src/components/CartItemRow.tsx
// Single row in the cart: image, title, qty +/- controls, line total, delete.
import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { CartItem } from '../types';
import { productImageUrl } from '../utils/image';
import { useCart } from '../contexts/CartContext';
import { colors } from '../utils/colors';

export default function CartItemRow({ item }: { item: CartItem }) {
  const { setQuantity, removeFromCart } = useCart();
  const uri = productImageUrl(item.image_url);
  const lineTotal = parseFloat(item.price || '0') * item.quantity;

  return (
    <View style={styles.row}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.placeholder]} />
      )}

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.unitPrice}>${item.price} c/u</Text>

        <View style={styles.qtyRow}>
          <Pressable
            style={styles.qtyBtn}
            hitSlop={8}
            onPress={() => setQuantity(item.id, item.quantity - 1)}>
            <Text style={styles.qtyBtnText}>−</Text>
          </Pressable>
          <Text style={styles.qty}>{item.quantity}</Text>
          <Pressable
            style={styles.qtyBtn}
            hitSlop={8}
            onPress={() => setQuantity(item.id, item.quantity + 1)}>
            <Text style={styles.qtyBtnText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.right}>
        <Text style={styles.lineTotal}>${lineTotal.toFixed(2)}</Text>
        <Pressable hitSlop={8} onPress={() => removeFromCart(item.id)}>
          <Text style={styles.delete}>Eliminar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#f3f3f3',
  },
  placeholder: {
    backgroundColor: '#eee',
  },
  info: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 14,
    fontWeight: '300',
    color: '#111',
  },
  unitPrice: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: 18,
    lineHeight: 20,
    color: colors.primary,
  },
  qty: {
    minWidth: 32,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '500',
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: 8,
  },
  lineTotal: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.primaryDark,
  },
  delete: {
    fontSize: 12,
    color: '#d9534f',
    marginTop: 8,
  },
});
