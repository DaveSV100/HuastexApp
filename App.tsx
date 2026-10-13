// App.tsx
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { CartProvider } from './src/contexts/CartContext';
import { DownloadProvider } from './src/contexts/DownloadContext';
import DownloadBanner from './src/components/DownloadBanner';
import AppNavigator from './src/navigation/AppNavigator';

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      {/* Dark status-bar icons over the app's white header: on Android 15+
          (edge-to-edge) the default white icons were invisible, which made
          the top of the screen look like an empty white band. */}
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <AuthProvider>
        <CartProvider>
          <DownloadProvider>
            <AppNavigator />
            {/* Outside the navigator so screen changes never hide an
                in-flight backup download. */}
            <DownloadBanner />
          </DownloadProvider>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}