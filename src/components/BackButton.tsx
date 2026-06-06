// src/components/BackButton.tsx
// "← Volver" affordance for shop screens. Useful in the authenticated flow,
// where the Navbar header has no back arrow. Renders nothing when there's
// nowhere to go back to.
import React from 'react';
import { Text, Image, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../utils/colors';

const BackImg = require('../../Assets/back.png');

export default function BackButton({ label = 'Volver' }: { label?: string }) {
  const navigation = useNavigation<any>();
  if (!navigation.canGoBack?.()) return null;

  return (
    <Pressable style={styles.btn} onPress={() => navigation.goBack()} hitSlop={8}>
      <Image source={BackImg} style={styles.icon} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 26, height: 26, resizeMode: 'contain' },
  text: { fontSize: 16, color: colors.primary, marginLeft: 4, fontWeight: '500' },
});
