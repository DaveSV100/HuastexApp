// src/components/ProductGrid.tsx
// 2-column product grid shared by the shop home and category screens.
import React from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Product } from '../types';
import ProductCard from './ProductCard';
import { colors } from '../utils/colors';

type Props = {
  products: Product[];
  loading?: boolean;
  onSelect: (product: Product) => void;
  ListHeaderComponent?: React.ComponentProps<typeof FlatList>['ListHeaderComponent'];
  emptyText?: string;
};

export default function ProductGrid({
  products,
  loading,
  onSelect,
  ListHeaderComponent,
  emptyText = 'No hay productos.',
}: Props) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={products}
      keyExtractor={item => String(item.id)}
      numColumns={2}
      renderItem={({ item }) => (
        <ProductCard product={item} onPress={onSelect} />
      )}
      ListHeaderComponent={ListHeaderComponent}
      columnWrapperStyle={styles.column}
      contentContainerStyle={styles.content}
      ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  column: { paddingHorizontal: 6 },
  content: { paddingVertical: 8, paddingBottom: 24 },
  empty: { textAlign: 'center', marginTop: 40, color: '#666' },
});
