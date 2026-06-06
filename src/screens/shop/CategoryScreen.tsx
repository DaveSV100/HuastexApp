// src/screens/shop/CategoryScreen.tsx
// Product grid filtered to a single category. Receives { slug, label } params.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import api from '../../api';
import { Product } from '../../types';
import { normalizeCategory } from '../../utils/categories';
import ProductGrid from '../../components/ProductGrid';
import { colors } from '../../utils/colors';
import BackButton from '../../components/BackButton';

type CategoryParams = { Category: { slug: string; label: string } };

export default function CategoryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<CategoryParams, 'Category'>>();
  const { slug, label } = route.params;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/products/category/${slug}`);
        let list: Product[] = Array.isArray(res.data) ? res.data : [];
        // Safety net: the DB category values are inconsistent, so confirm each
        // product really maps onto this slug before showing it.
        list = list.filter(p => normalizeCategory(p.category ?? '') === slug);
        if (active) setProducts(list);
      } catch (e) {
        console.error('Error fetching category products:', e);
        if (active) setProducts([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  const openProduct = (product: Product) =>
    navigation.navigate('Product', { id: product.id, product });

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <BackButton />
      </View>
      <Text style={styles.title}>{label}</Text>
      <ProductGrid
        products={products}
        loading={loading}
        onSelect={openProduct}
        emptyText="No hay productos en esta categoría."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topBar: { paddingHorizontal: 12, paddingTop: 12 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 12,
    color: colors.primaryDark,
  },
});
