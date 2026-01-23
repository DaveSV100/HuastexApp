// src/contexts/AuthContext.js
import { parseJwt } from '../utils/jwt';
import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

export const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

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

  const signOut = async () => {
    await AsyncStorage.multiRemove(['token','token_exp','role','branch','userEmail']);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
