import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MyOrdersScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text>Ventas</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
