// src/screens/shop/CartScreen.tsx
// Cart review + payment handoff.
//
// The OpenPay card form relies on the browser-side OpenPay JS SDK, which can't
// run safely inside a WebView. So we serialize the cart, base64-encode it, and
// open the web payment page in the system browser. The web page reads the cart
// from the URL, charges via OpenPay, and saves the sale on /success. This is the
// only integration point with the web — no /sales/add call is made from mobile.
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Linking,
  Alert,
} from 'react-native';
import { Buffer } from 'buffer';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { useNavigation } from '@react-navigation/native';
import { useCart } from '../../contexts/CartContext';
import CartItemRow from '../../components/CartItemRow';
import { colors } from '../../utils/colors';

const WEB_BASE = 'https://www.huastex.com';

// Encode the cart so the web's `JSON.parse(atob(param))` can read it even when
// product titles contain accents. JSON.stringify keeps non-ASCII chars verbatim,
// which `atob` (a Latin1 decoder) would corrupt — so we escape every non-ASCII
// char to its \uXXXX form, making the JSON pure ASCII before base64-encoding.
function encodeCart(items: unknown): string {
  const json = JSON.stringify(items).replace(
    /[\u0080-\uffff]/g,
    ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'),
  );
  return Buffer.from(json, 'ascii').toString('base64');
}

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const { items, total, clearCart } = useCart();

  const handleCheckout = async () => {
    if (!items.length) return;
    try {
      const cartBase64 = encodeCart(items);
      const url = `${WEB_BASE}/card-payment?cart=${encodeURIComponent(
        cartBase64,
      )}`;

      // Prefer an in-app browser (SFSafariViewController / Chrome Custom Tab):
      // it returns a real "close" result we can act on. Fall back to the system
      // browser if the native module isn't available.
      if (await InAppBrowser.isAvailable()) {
        await InAppBrowser.open(url, {
          dismissButtonStyle: 'close',
          preferredBarTintColor: colors.primary,
          preferredControlTintColor: colors.white,
          toolbarColor: colors.primary,
          navigationBarColor: colors.primary,
          showTitle: true,
          enableUrlBarHiding: true,
          enableDefaultShare: false,
        });
        // The browser was dismissed — the web flow handled the charge/save on
        // /success, so treat the handoff as complete and clear the local cart.
        clearCart();
      } else {
        await Linking.openURL(url);
        clearCart();
      }
    } catch (e) {
      console.error('Checkout error:', e);
      Alert.alert('Error', 'No se pudo iniciar el pago. Intenta de nuevo.');
    }
  };

  if (!items.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Tu carrito está vacío.</Text>
        <Pressable
          style={styles.shopBtn}
          onPress={() => navigation.navigate('Shop')}>
          <Text style={styles.shopBtnText}>Ir a la tienda</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => <CartItemRow item={item} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.title}>Mi carrito</Text>}
      />

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.payBtn, pressed && styles.payBtnPressed]}
          onPress={handleCheckout}>
          <Text style={styles.payBtnText}>Pagar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { padding: 12, paddingBottom: 24 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 16,
    backgroundColor: '#fff',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: { fontSize: 16, color: '#333' },
  totalValue: { fontSize: 20, fontWeight: '500', color: colors.primaryDark },
  payBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  payBtnPressed: { opacity: 0.8 },
  payBtnText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 16 },
  shopBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  shopBtnText: { color: '#fff', fontWeight: '500' },
});
