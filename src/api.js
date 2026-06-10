// src/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// API host — also used to build absolute product image URLs.
export const API_BASE = 'https://api.huastex.com';

// create instance
const api = axios.create({
  baseURL: API_BASE,
});

// Logout handler registered by AuthProvider. The axios interceptor lives outside
// React, so we can't call signOut() directly — the provider hands it to us here
// and we invoke it when the server reports the token is missing/expired (401).
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

// attach token before each request
api.interceptors.request.use(
  async config => {
    const token = await AsyncStorage.getItem('token');
    const exp   = await AsyncStorage.getItem('token_exp');
    if (token && exp) {
      const now = Date.now();
      if (now >= parseInt(exp, 10)) {
        // expired → clear storage & show alert
        await AsyncStorage.multiRemove(['token','token_exp','role','branch','userEmail']);
        Alert.alert('Sesión expirada','Por favor inicia sesión de nuevo.');
        // you can also navigate to SignIn via a stored navigator ref
        return Promise.reject(new Error('Token expired'));
      }
      config.headers['x-auth-token'] = token;
    }
    return config;
  },
  err => Promise.reject(err)
);

// Handle auth failures from the server. Now that the backend locks routes behind
// `x-auth-token`, a missing/expired/invalid token comes back as 401 — clear the
// stored session and bounce the user to the sign-in screen via the registered
// handler. (403 means authenticated-but-wrong-role; we surface that as-is.)
api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401) {
      await AsyncStorage.multiRemove(['token','token_exp','role','branch','userEmail']);
      if (onUnauthorized) {
        onUnauthorized();
      } else {
        Alert.alert('Sesión expirada','Por favor inicia sesión de nuevo.');
      }
    }
    return Promise.reject(err);
  }
);

export default api;
