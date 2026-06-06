// src/screens/shop/ShopHomeScreen.tsx
// E-commerce home: grid of all products with a search bar.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../../api';
import { Product } from '../../types';
import ProductGrid from '../../components/ProductGrid';
import { colors } from '../../utils/colors';

export default function ShopHomeScreen() {
  const navigation = useNavigation<any>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/products/all-products');
        setProducts(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error('Error fetching products:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const normalize = (s: string) =>
    (s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();

  const filtered = useMemo(() => {
    const keywords = normalize(search).split(' ').filter(Boolean);
    if (!keywords.length) return products;
    return products.filter(p => {
      const haystack = normalize(`${p.title} ${p.category ?? ''}`);
      return keywords.every(k => haystack.includes(k));
    });
  }, [products, search]);

  const openProduct = (product: Product) =>
    navigation.navigate('Product', { id: product.id, product });

  return (
    <View style={styles.container}>
      <ProductGrid
        products={filtered}
        loading={loading}
        onSelect={openProduct}
        emptyText="No se encontraron productos."
        ListHeaderComponent={
          <View style={styles.header}>
            <Pressable
              style={styles.categoriesBtn}
              onPress={() => navigation.navigate('Categories')}>
              <Text style={styles.categoriesBtnText}>Ver categorías</Text>
            </Pressable>
            <TextInput
              style={styles.search}
              placeholder="Buscar productos..."
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 12, paddingTop: 12 },
  categoriesBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  categoriesBtnText: { color: '#fff', fontWeight: '500' },
  search: {
    backgroundColor: '#f3f3f3',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
});
