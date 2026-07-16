// src/contexts/AuthContext.js
import { parseJwt } from '../utils/jwt';
import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setUnauthorizedHandler } from '../api';

export const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // When the API layer sees a 401 (token missing/expired/invalid) it has
    // already cleared storage — here we just drop the user so AppNavigator
    // re-renders the SignIn stack.
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    // Bootstrap: load token from storage
    (async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const exp   = await AsyncStorage.getItem('token_exp');
        if (token && exp && Date.now() < Number(exp)) {
          const decoded = parseJwt(token);
          if (decoded) {
             setUser({
               name:   decoded.name,
               email:  decoded.email,
               role:   decoded.role,
               branch: decoded.branch,
             });
           }
        }
      } catch (e) {
        console.error('Bootstrap error:', e);
      }
    })();
  }, []);

  // Persist a full session (from passkey verify / enroll) and update context.
  const persistSession = async (result, fallbackEmail) => {
    const { token, token_exp } = result;
    if (!token) throw new Error('No token in response');
    const decoded = parseJwt(token);
    if (!decoded) throw new Error('Invalid token received');
    const userEmail = result.email || fallbackEmail || '';
    await AsyncStorage.multiSet([
      ['token',     token],
      ['token_exp', token_exp.toString()],
      ['role',      decoded.role ?? ''],
      ['branch',    decoded.branch ?? ''],
      ['userEmail', userEmail],
    ]);
    const newUser = { name: decoded.name, email: userEmail, role: decoded.role, branch: decoded.branch };
    setUser(newUser);
    return newUser;
  };

  // PASSKEY-REQUIRED step 1: password. A correct password does NOT sign you in;
  // it returns a pre-auth token (stored so the passkey endpoints work) and tells
  // the screen whether to VERIFY an existing passkey or ENROLL a new one.
  // Clients without WebAuthn get the classic full session (fallback).
  const signIn = async (email, password) => {
    try {
      const { isPasskeySupported } = require('../utils/passkey');
      const supported = isPasskeySupported();
      const response = await api.post('/auth/login', { email, password, passkeySupported: supported });
      const data = response.data;

      if (data.preAuth) {
        await AsyncStorage.multiSet([
          ['token', data.token],
          ['token_exp', String(Date.now() + 10 * 60 * 1000)],
        ]);
        return { preAuth: true, hasPasskey: data.hasPasskey, email: data.email || email };
      }

      // Fallback: no WebAuthn → classic session.
      return await persistSession(data, email);
    } catch (err) {
      console.error('AuthContext signIn error:', err);
      const message =
        err.response?.data?.msg
          || err.response?.data?.message
          || err.message
          || 'Ocurrió un error de autenticación';
      throw new Error(message);
    }
  };

  // Passkey login — direct or the mandatory VERIFY step. Persists full session.
  const signInWithPasskey = async (email) => {
    const { passkeyLogin } = require('../utils/passkey');
    const result = await passkeyLogin(email || undefined);
    return await persistSession(result, email);
  };

  // Mandatory ENROLL step: create a passkey using the pre-auth token; the server
  // returns the full session with the successful enrollment.
  const enrollPasskeyAndFinish = async () => {
    const { registerPasskey } = require('../utils/passkey');
    const result = await registerPasskey();
    if (result && result.session) {
      return await persistSession(result.session);
    }
    return null; // caller falls back to asking the user to sign in with the passkey
  };

  // Drop a pre-auth token when the user backs out of the passkey step.
  const clearPreAuth = async () => {
    await AsyncStorage.multiRemove(['token', 'token_exp']);
  };

  const signOut = async () => {
    await AsyncStorage.multiRemove(['token','token_exp','role','branch','userEmail']);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, signIn, signInWithPasskey, enrollPasskeyAndFinish, clearPreAuth, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
