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

  const signIn = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      console.log('Login response.data:', response.data);
      
      // ← destructure exactly what your backend returns:
      const { token, token_exp } = response.data;
      if (!token) throw new Error('No token in response');

      // decode **here**, where `token` exists
      const decoded = parseJwt(token);
      if (!decoded) throw new Error('Invalid token received');

      // persist
      await AsyncStorage.multiSet([
        ['token',       token],
        ['token_exp',   token_exp.toString()],
        ['role',        decoded.role],
        ['branch',      decoded.branch ?? ''],
        ['userEmail',   email],
      ]);

      // update context
      const newUser = { name: decoded.name, email, role: decoded.role, branch: decoded.branch };
      setUser(newUser);
      return newUser;

    } catch (err) {
      console.error('AuthContext signIn error:', err);
      const message =
        err.response?.data?.message
          || err.message
          || 'Ocurrió un error de autenticación';
      throw new Error(message);
    }
  };

  // Passkey login — same persisted session shape as signIn.
  const signInWithPasskey = async (email) => {
    const { passkeyLogin } = require('../utils/passkey');
    const result = await passkeyLogin(email || undefined);

    const { token, token_exp } = result;
    if (!token) throw new Error('No token in response');
    const decoded = parseJwt(token);
    if (!decoded) throw new Error('Invalid token received');

    const userEmail = result.email || '';
    await AsyncStorage.multiSet([
      ['token',     token],
      ['token_exp', token_exp.toString()],
      ['role',      decoded.role],
      ['branch',    decoded.branch ?? ''],
      ['userEmail', userEmail],
    ]);

    const newUser = { name: decoded.name, email: userEmail, role: decoded.role, branch: decoded.branch };
    setUser(newUser);
    return newUser;
  };

  const signOut = async () => {
    await AsyncStorage.multiRemove(['token','token_exp','role','branch','userEmail']);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, signIn, signInWithPasskey, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
