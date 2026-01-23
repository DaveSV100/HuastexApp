// @ts-nocheck
import React, { useContext } from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../contexts/AuthContext';
import api from '../api';

export default function HomeScreen(): React.JSX.Element {
  const { signOut, user } = useContext(AuthContext);
  const navigation = useNavigation();

  // Check if user has staff/admin roles
  const hasStaffAccess = ['admin', 'superadmin', 'staff', 'iT'].includes(user?.role);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Borrar cuenta',
      '¿Seguro deseas borrar tu cuenta?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/auth/delete-my-account');
              signOut();
            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert('Error', 'No se pudo borrar la cuenta. Intenta de nuevo.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.welcomeText}>Bienvenido, {user?.name}</Text>

      {hasStaffAccess && (
        <View style={styles.buttonsContainer}>
          <Button onPress={() => navigation.navigate('Inventory')} title="Inventario" />
          <Button onPress={() => navigation.navigate('Sales')} title="Ventas" />
          <Button onPress={() => navigation.navigate('Dailyreport')} title="Reporte Diario" />
        </View>
      )}

      <View style={styles.accountButtons}>
        <Button title="Cerrar Sesión" onPress={signOut} />
        <Button title="Borrar" color="red" onPress={handleDeleteAccount} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  buttonsContainer: {
    width: '100%',
    gap: 10,
    marginBottom: 30,
  },
  accountButtons: {
    width: '100%',
    gap: 10,
  },
});