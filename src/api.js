// src/api.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// create instance
const api = axios.create({
  baseURL: 'https://api.huastex.com',
});

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

export default api;
