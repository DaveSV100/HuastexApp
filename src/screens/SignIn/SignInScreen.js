// src/screens/SignInScreen.js
import React, { useState, useContext } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert
} from 'react-native';
import { AuthContext } from '../../contexts/AuthContext';
import { isPasskeySupported, isPasskeyCancelledError } from '../../utils/passkey';

export default function SignInScreen({ navigation, route }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const { signIn, signInWithPasskey } = useContext(AuthContext);

  const handlePasskey = async () => {
    setError('');
    try {
      await signInWithPasskey(email || undefined);
    } catch (err) {
      if (isPasskeyCancelledError(err)) {
        setError('Inicio con passkey cancelado.');
      } else if (err.response?.status === 401) {
        setError('No se reconoció la passkey. Usa tu contraseña.');
      } else {
        setError('No se pudo iniciar con passkey. Usa tu contraseña.');
        console.error('Passkey signIn error:', err);
      }
    }
  };

  const handleSubmit = async () => {
    try {
      await signIn(email, password);
      // after success, go to home/custom route
      // navigation.replace(route.params?.from || 'Home');
    } catch (err) {
      // map axios errors
      if (err.response?.status === 404) {
        setError('Correo no encontrado, por favor regístrate.');
      } else if (err.response?.status === 401) {
        setError('Contraseña incorrecta.');
      } else if (err.message === 'Token expired') {
        setError('Sesión expirada, por favor intenta de nuevo.');
      } else {
        setError(err.message);  
        console.error('SignIn error:', err);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar sesión</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="Correo"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity style={styles.signinButton} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Iniciar sesión</Text>
      </TouchableOpacity>
      {isPasskeySupported() && (
        <TouchableOpacity style={styles.passkeyButton} onPress={handlePasskey}>
          <Text style={styles.buttonText}>🔑 Iniciar con passkey</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.signupButton}
        onPress={() => navigation.navigate('SignUp')}>
        <Text style={styles.buttonText}>Crear cuenta</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.shopButton}
        onPress={() => navigation.navigate('Shop')}>
        <Text style={styles.shopButtonText}>Explorar productos</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, justifyContent:'center', alignItems:'center', padding:16 },
  title:     { fontSize:24, marginBottom:16 },
  error:     { color:'red', marginBottom:8 },
  input:     {
    width:'100%', height:50, borderColor:'#ccc', borderWidth:1,
    borderRadius:4, marginVertical:8, paddingHorizontal:12
  },
  signinButton: {
    backgroundColor:'rgb(122,149,172)', paddingVertical:14,
    borderRadius:4, width:'100%', alignItems:'center', marginTop:16
  },
  signupButton: {
    backgroundColor:'rgb(116,131,143)', paddingVertical:14,
    borderRadius:4, width:'100%', alignItems:'center', marginTop:8
  },
  passkeyButton: {
    backgroundColor:'rgb(76,110,90)', paddingVertical:14,
    borderRadius:4, width:'100%', alignItems:'center', marginTop:8
  },
  shopButton: {
    borderColor:'#1486AC', borderWidth:1.5, paddingVertical:14,
    borderRadius:4, width:'100%', alignItems:'center', marginTop:16
  },
  shopButtonText: { color:'#1486AC', fontSize:16, fontWeight:'500' },
  buttonText: { color:'#fff', fontSize:16 }
});
