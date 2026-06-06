// src/components/ProductCard.tsx
// Product tile used by the shop home and category grids.
// Tapping the body opens the product detail; the "+" adds to cart immediately.
import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { Product } from '../types';
import { productImageUrl } from '../utils/image';
import { useCart } from '../contexts/CartContext';
import { colors } from '../utils/colors';

type Props = {
  product: Product;
  onPress: (product: Product) => void;
};

export default function ProductCard({ product, onPress }: Props) {
  const { addToCart, isInCart } = useCart();
  const uri = productImageUrl(product.image_url);
  const inCart = isInCart(product.id);

  return (
    <Pressable style={styles.card} onPress={() => onPress(product)}>
      <View style={styles.imageWrap}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderText}>Sin imagen</Text>
          </View>
        )}
        {product.category ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {product.category}
            </Text>
          </View>
        ) : null}
        <Pressable
          style={({ pressed }) => [
            styles.addBtn,
            inCart && styles.addBtnInCart,
            pressed && styles.addBtnPressed,
          ]}
          hitSlop={8}
          onPress={() => addToCart(product)}>
          <Text style={styles.addBtnText}>{inCart ? '✓' : '+'}</Text>
        </Pressable>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {product.title}
      </Text>
      <Text style={styles.price}>${product.price}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    margin: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f3f3f3',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#aaa',
    fontSize: 12,
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '70%',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#333',
  },
  addBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnInCart: {
    backgroundColor: colors.primaryDark,
  },
  addBtnPressed: {
    opacity: 0.7,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  title: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '300',
    color: '#111',
  },
  price: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '500',
    color: colors.primaryDark,
  },
});
