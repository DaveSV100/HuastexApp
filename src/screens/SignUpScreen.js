// src/screens/SignUpScreen.js
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert
} from 'react-native';
import api from '../api'; // Adjust path as needed

export default function SignUpScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [emailMatchError, setEmailMatchError] = useState(false);
  const [passwordMatchError, setPasswordMatchError] = useState(false);

  const handleConfirmEmailChange = (val) => {
    setConfirmEmail(val);
    setEmailMatchError(email !== val);
  };

  const handleConfirmPasswordChange = (val) => {
    setConfirmPassword(val);
    setPasswordMatchError(password !== val);
  };

  const handleSubmit = async () => {
    // Final validation before submit
    if (email !== confirmEmail) {
      setEmailMatchError(true);
      return;
    }
    if (password !== confirmPassword) {
      setPasswordMatchError(true);
      return;
    }

    try {
      await api.post('/auth/register', { name, email, password });
      Alert.alert('Éxito', 'Cuenta creada exitosamente', [
        { text: 'OK', onPress: () => navigation.navigate('SignIn') }
      ]);
    } catch (err) {
      if (err.response?.status === 400) {
        setError(err.response.data.msg || 'El usuario ya existe.');
      } else {
        console.error('Error signing up:', err);
        setError('Ocurrió un error inesperado. Intenta de nuevo.');
      }
    }
  };

  const isSubmitDisabled = emailMatchError || passwordMatchError || !name || !email || !confirmEmail || !password || !confirmPassword;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear cuenta</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Nombre"
        autoCapitalize="words"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="Correo"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={(val) => {
          setEmail(val);
          if (confirmEmail) setEmailMatchError(val !== confirmEmail);
        }}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirmar correo"
        keyboardType="email-address"
        autoCapitalize="none"
        value={confirmEmail}
        onChangeText={handleConfirmEmailChange}
      />
      {emailMatchError && (
        <Text style={styles.validationError}>Los correos no coinciden.</Text>
      )}

      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={(val) => {
          setPassword(val);
          if (confirmPassword) setPasswordMatchError(val !== confirmPassword);
        }}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirmar contraseña"
        secureTextEntry
        value={confirmPassword}
        onChangeText={handleConfirmPasswordChange}
      />
      {passwordMatchError && (
        <Text style={styles.validationError}>Las contraseñas no coinciden.</Text>
      )}

      <TouchableOpacity
        style={[styles.signupButton, isSubmitDisabled && styles.disabledButton]}
        onPress={handleSubmit}
        disabled={isSubmitDisabled}
      >
        <Text style={styles.buttonText}>Crear cuenta</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.signinButton}
        onPress={() => navigation.navigate('SignIn')}
      >
        <Text style={styles.buttonText}>Ya tengo cuenta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    marginBottom: 16,
  },
  error: {
    color: 'red',
    marginBottom: 8,
  },
  validationError: {
    color: 'red',
    fontSize: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 4,
    marginVertical: 8,
    paddingHorizontal: 12,
  },
  signupButton: {
    backgroundColor: 'rgb(122,149,172)',
    paddingVertical: 14,
    borderRadius: 4,
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
  },
  signinButton: {
    backgroundColor: 'rgb(116,131,143)',
    paddingVertical: 14,
    borderRadius: 4,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: '#aaa',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
});