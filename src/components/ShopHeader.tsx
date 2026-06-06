// src/components/ShopHeader.tsx
// Lightweight header for the public (unauthenticated) shop flow: back button,
// brand, and a cart icon with a live item-count badge. Used as the navigation
// `header` for shop screens that render outside the authenticated Navbar.
import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useCart } from '../contexts/CartContext';
import { colors } from '../utils/colors';

const BackImg = require('../../Assets/back.png');
const CartImg = require('../../Assets/cart.png');

type Props = {
  navigation: any;
  options?: { title?: string };
};

export default function ShopHeader({ navigation, options }: Props) {
  const { count } = useCart();
  const canGoBack = navigation.canGoBack?.();

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {canGoBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
            <Image source={BackImg} style={styles.backIcon} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backIcon} />
        )}
      </View>

      <TouchableOpacity
        style={styles.brandWrap}
        onPress={() => navigation.navigate('Shop')}>
        <Text style={styles.brand}>{options?.title || 'Huastex'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cartIcon}
        hitSlop={8}
        onPress={() => navigation.navigate('MyOrders')}>
        <Image source={CartImg} style={styles.cart} />
        {count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingTop: 60,
    paddingBottom: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  left: { width: 40 },
  backIcon: { width: 32, height: 32, resizeMode: 'contain' },
  brandWrap: { flex: 1, alignItems: 'center' },
  brand: { fontSize: 22, fontWeight: 'bold', color: colors.primary },
  cartIcon: { width: 40, alignItems: 'flex-end' },
  cart: { width: 36, height: 36, resizeMode: 'contain' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
});
