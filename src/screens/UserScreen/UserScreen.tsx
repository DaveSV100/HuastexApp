// @ts-nocheck
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function UserScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text>User screen</Text>
      {/* Logout lives in the Navbar menu; a screen-level button was removed. */}
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
