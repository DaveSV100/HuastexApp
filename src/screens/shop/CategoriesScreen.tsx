// src/screens/shop/CategoriesScreen.tsx
// Static landing of the 7 canonical categories — no API call.
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CATEGORIES } from '../../utils/categories';
import { colors } from '../../utils/colors';
import BackButton from '../../components/BackButton';

export default function CategoriesScreen() {
  const navigation = useNavigation<any>();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}>
      <BackButton />
      <Text style={styles.title}>Categorías</Text>
      <View style={styles.grid}>
        {CATEGORIES.map(cat => (
          <Pressable
            key={cat.slug}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            onPress={() =>
              navigation.navigate('Category', {
                slug: cat.slug,
                label: cat.label,
              })
            }>
            <Text style={styles.tileLabel}>{cat.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 12 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    width: '48%',
    minHeight: 120,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginBottom: 12,
  },
  tilePressed: { opacity: 0.8 },
  tileLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});
