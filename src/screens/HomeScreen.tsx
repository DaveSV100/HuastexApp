// @ts-nocheck
import React, { useContext } from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../contexts/AuthContext';

export default function HomeScreen(): React.JSX.Element {
  const { signOut } = useContext(AuthContext);
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      {/* <Text>Usuario:</Text> */}
      <Button onPress={()=> navigation.navigate('Inventory')} title="Inventario"/>
      <Button onPress={()=> navigation.navigate('Sales')} title="Ventas"/>
      <Button onPress={()=> navigation.navigate('Dailyreport')} title="Reporte Diario"/>
      {/* <Button title="Productos"/>
      <Button title="Usuarios"/> */}
      <Button title="Cerrar Sesión" onPress={signOut}/>
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
