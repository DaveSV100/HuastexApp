// src/contexts/CartContext.tsx
// Global shopping-cart state for the e-commerce screens.
// The cart lives entirely client-side (there is no cart API) and is
// persisted to AsyncStorage so it survives app restarts.
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem, Product } from '../types';

const STORAGE_KEY = 'cart';

type CartContextValue = {
  items: CartItem[];
  count: number; // number of distinct line items (matches the web badge)
  total: number;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (id: number) => void;
  setQuantity: (id: number, quantity: number) => void;
  isInCart: (id: number) => boolean;
  clearCart: () => void;
};

export const CartContext = createContext<CartContextValue>({
  items: [],
  count: 0,
  total: 0,
  addToCart: () => {},
  removeFromCart: () => {},
  setQuantity: () => {},
  isInCart: () => false,
  clearCart: () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted cart on mount.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setItems(parsed);
        }
      } catch (e) {
        console.error('Cart load error:', e);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // Persist on every change (after the initial hydration).
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(e =>
      console.error('Cart save error:', e),
    );
  }, [items, hydrated]);

  const addToCart = (product: Product, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(it => it.id === product.id);
      if (existing) {
        return prev.map(it =>
          it.id === product.id ? { ...it, quantity: it.quantity + quantity } : it,
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          title: product.title,
          price: product.price,
          image_url: product.image_url,
          category: product.category,
          quantity,
        },
      ];
    });
  };

  const removeFromCart = (id: number) =>
    setItems(prev => prev.filter(it => it.id !== id));

  const setQuantity = (id: number, quantity: number) =>
    setItems(prev =>
      quantity <= 0
        ? prev.filter(it => it.id !== id)
        : prev.map(it => (it.id === id ? { ...it, quantity } : it)),
    );

  const isInCart = (id: number) => items.some(it => it.id === id);

  const clearCart = () => setItems([]);

  const total = items.reduce(
    (sum, it) => sum + parseFloat(it.price || '0') * it.quantity,
    0,
  );

  return (
    <CartContext.Provider
      value={{
        items,
        count: items.length,
        total,
        addToCart,
        removeFromCart,
        setQuantity,
        isInCart,
        clearCart,
      }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
