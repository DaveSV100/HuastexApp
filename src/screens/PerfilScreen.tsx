// @ts-nocheck
import React, { useContext } from 'react';
import { View, Text, StyleSheet, Button, Alert, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../contexts/AuthContext';
import api from '../api';

export default function PerfilScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { signOut } = useContext(AuthContext);

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
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Image source={require('../../Assets/back.png')} style={styles.back} />
      </TouchableOpacity>

      <Text style={styles.title}>Perfil</Text>

      <View style={styles.accountButtons}>
        <Button title="Cerrar Sesión" onPress={signOut} />
        <Button title="Borrar Cuenta" color="red" onPress={handleDeleteAccount} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  back: {
    width: 32,
    height: 32,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  accountButtons: {
    width: '100%',
    gap: 10,
  },
});
