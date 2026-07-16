// src/screens/SignInScreen.js
import React, { useState, useContext } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator
} from 'react-native';
import { AuthContext } from '../../contexts/AuthContext';
import { isPasskeySupported, isPasskeyCancelledError } from '../../utils/passkey';

// PASSKEY-REQUIRED login. Password alone never signs you in: after a correct
// password the screen switches to a mandatory passkey step — VERIFY an existing
// passkey, or ENROLL one on the spot. Direct passkey login is also available.
export default function SignInScreen({ navigation }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [phase,    setPhase]    = useState('form'); // 'form' | 'verify' | 'enroll'
  const [busy,     setBusy]     = useState(false);
  const { signIn, signInWithPasskey, enrollPasskeyAndFinish, clearPreAuth } = useContext(AuthContext);

  const handleSubmit = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await signIn(email, password);
      if (res && res.preAuth) {
        setPhase(res.hasPasskey ? 'verify' : 'enroll');
      }
      // fallback clients get a full session and AppNavigator swaps screens
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) setError('Correo no encontrado, por favor regístrate.');
      else if (status === 401) setError('Contraseña incorrecta.');
      else setError(err.message || 'Ocurrió un error.');
      console.error('SignIn error:', err);
    } finally {
      setBusy(false);
    }
  };

  const handlePasskey = async () => {
    setError('');
    setBusy(true);
    try {
      await signInWithPasskey(email || undefined);
    } catch (err) {
      if (isPasskeyCancelledError(err)) setError('Inicio con passkey cancelado.');
      else if (err.response?.status === 401) setError('No se reconoció la passkey. Usa tu contraseña.');
      else setError('No se encontró una passkey en este dispositivo. Entra con tu contraseña y crea una.');
      console.error('Passkey signIn error:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleMandatoryVerify = async () => {
    setError('');
    setBusy(true);
    try {
      await signInWithPasskey(email);
    } catch (err) {
      if (isPasskeyCancelledError(err)) setError('No se completó. Confirma con Face ID o tu huella.');
      else setError('No se pudo verificar la passkey. Intenta de nuevo.');
      console.error('Verify passkey error:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleMandatoryEnroll = async () => {
    setError('');
    setBusy(true);
    try {
      const done = await enrollPasskeyAndFinish();
      if (!done) {
        setError('Passkey creada. Inicia con tu passkey para continuar.');
        await backToForm();
      }
    } catch (err) {
      if (isPasskeyCancelledError(err)) setError('No se completó. Intenta de nuevo y confirma con Face ID.');
      else setError('No se pudo crear la passkey. Intenta de nuevo.');
      console.error('Enroll passkey error:', err);
    } finally {
      setBusy(false);
    }
  };

  const backToForm = async () => {
    await clearPreAuth();
    setError('');
    setPhase('form');
  };

  if (phase === 'verify' || phase === 'enroll') {
    const enrolling = phase === 'enroll';
    return (
      <View style={styles.container}>
        <Text style={styles.keyIcon}>🔑</Text>
        <Text style={styles.title}>{enrolling ? 'Protege tu cuenta' : 'Confirma que eres tú'}</Text>
        <Text style={styles.subtitle}>
          {enrolling
            ? 'Para terminar de entrar, crea tu passkey. Es obligatoria: con ella entrarás con Face ID o tu huella, sin contraseña.'
            : 'Tu cuenta está protegida con passkey. Confirma con Face ID, tu huella o el dispositivo donde la guardaste.'}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={styles.signinButton}
          onPress={enrolling ? handleMandatoryEnroll : handleMandatoryVerify}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.buttonText}>{enrolling ? 'Crear passkey' : 'Usar mi passkey'}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={backToForm} disabled={busy}>
          <Text style={styles.linkText}>Volver al inicio de sesión</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
      <TouchableOpacity style={styles.signinButton} onPress={handleSubmit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Iniciar sesión</Text>}
      </TouchableOpacity>
      {isPasskeySupported() && (
        <TouchableOpacity style={styles.passkeyButton} onPress={handlePasskey} disabled={busy}>
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
  keyIcon:   { fontSize:40, marginBottom:8 },
  title:     { fontSize:24, marginBottom:12, fontWeight:'600', textAlign:'center' },
  subtitle:  { fontSize:15, color:'#555', textAlign:'center', marginBottom:16, lineHeight:21 },
  error:     { color:'red', marginBottom:8, textAlign:'center' },
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
  linkButton: { paddingVertical:14, width:'100%', alignItems:'center', marginTop:8 },
  linkText:   { color:'rgb(98,124,141)', fontSize:15, textDecorationLine:'underline' },
  shopButton: {
    borderColor:'#1486AC', borderWidth:1.5, paddingVertical:14,
    borderRadius:4, width:'100%', alignItems:'center', marginTop:16
  },
  shopButtonText: { color:'#1486AC', fontSize:16, fontWeight:'500' },
  buttonText: { color:'#fff', fontSize:16 }
});
