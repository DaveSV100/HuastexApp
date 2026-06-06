// src/screens/shop/ProductDetailScreen.tsx
// Full product view. Uses the product passed via params when available,
// and falls back to GET /products/item/:id for deep links.
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import api from '../../api';
import { Product } from '../../types';
import { productImageUrl } from '../../utils/image';
import { labelForSlug, normalizeCategory } from '../../utils/categories';
import { useCart } from '../../contexts/CartContext';
import { colors } from '../../utils/colors';
import BackButton from '../../components/BackButton';

type ProductParams = { Product: { id: number; product?: Product } };

export default function ProductDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ProductParams, 'Product'>>();
  const { id, product: passed } = route.params;
  const { addToCart, isInCart } = useCart();

  const [product, setProduct] = useState<Product | null>(passed ?? null);
  const [loading, setLoading] = useState(!passed);

  useEffect(() => {
    if (passed) return;
    (async () => {
      try {
        const res = await api.get(`/products/item/${id}`);
        setProduct(res.data ?? null);
      } catch (e) {
        console.error('Error fetching product:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, passed]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.center}>
        <View style={styles.notFoundBack}>
          <BackButton />
        </View>
        <Text style={styles.notFound}>Producto no encontrado.</Text>
      </View>
    );
  }

  const uri = productImageUrl(product.image_url);
  const inCart = isInCart(product.id);
  const categoryLabel = product.category
    ? labelForSlug(normalizeCategory(product.category))
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.backRow}>
        <BackButton />
      </View>

      <View style={styles.imageWrap}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Text style={styles.placeholderText}>Sin imagen</Text>
          </View>
        )}
      </View>

      {categoryLabel ? (
        <Text style={styles.category}>{categoryLabel}</Text>
      ) : null}
      <Text style={styles.title}>{product.title}</Text>
      <Text style={styles.price}>${product.price}</Text>

      {product.description ? (
        <Text style={styles.description}>{product.description}</Text>
      ) : null}

      {inCart ? (
        <Pressable
          style={[styles.cta, styles.ctaSecondary]}
          onPress={() => navigation.navigate('MyOrders')}>
          <Text style={styles.ctaSecondaryText}>Ver carrito</Text>
        </Pressable>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={() => addToCart(product)}>
          <Text style={styles.ctaText}>Agregar al carrito</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  notFound: { color: colors.textMuted, fontSize: 16 },
  backRow: { marginBottom: 12 },
  notFoundBack: { position: 'absolute', top: 16, left: 16 },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f3f3f3',
    marginBottom: 16,
  },
  image: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: '#aaa' },
  category: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: '300', color: '#111' },
  price: { fontSize: 24, fontWeight: '500', color: colors.primaryDark, marginTop: 6 },
  description: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginTop: 14,
  },
  cta: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaPressed: { opacity: 0.8 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  ctaSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ctaSecondaryText: { color: colors.primary, fontSize: 16, fontWeight: '500' },
});
