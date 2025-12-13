// @ts-nocheck
import React, { useContext } from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { AuthContext } from '../../contexts/AuthContext';

export default function UserScreen(): React.JSX.Element {
  const { signOut } = useContext(AuthContext);
  return (
    <View style={styles.container}>
      <Text>User screen</Text>
      {/* <Button title="Cerrar Sesión" onPress={signOut}/> */}
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
