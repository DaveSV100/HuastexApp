// src/contexts/AuthContext.js
import { parseJwt } from '../utils/jwt';
import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setUnauthorizedHandler } from '../api';

export const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // False until the stored session has been read, so the app doesn't first
  // draw the logged-out store and then rebuild everything for the user.
  const [ready, setReady] = useState(false);

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
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Persist a full session (password or passkey login) and update context.
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

  // Email + password signs you in directly; a passkey is optional.
  const signIn = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      return await persistSession(response.data, email);
    } catch (err) {
      console.error('AuthContext signIn error:', err);
      const message =
        err.response?.data?.msg
          || err.response?.data?.message
          || err.message
          || 'Ocurrió un error de autenticación';
      // Keep the HTTP response so SignInScreen can show its 404/401 messages.
      const error = new Error(message);
      error.response = err.response;
      throw error;
    }
  };

  // Optional passkey login — same persisted session as signIn.
  const signInWithPasskey = async (email) => {
    const { passkeyLogin } = require('../utils/passkey');
    const result = await passkeyLogin(email || undefined);
    return await persistSession(result, email);
  };

  const signOut = async () => {
    await AsyncStorage.multiRemove(['token','token_exp','role','branch','userEmail']);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, ready, signIn, signInWithPasskey, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
