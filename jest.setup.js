/* eslint-env jest */
// Official mock required by @react-native-async-storage in Jest:
// https://react-native-async-storage.github.io/async-storage/docs/advanced/jest
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Native-only TurboModules that throw at import time inside Jest.
jest.mock('@react-native-camera-roll/camera-roll', () => ({
  CameraRoll: { saveAsset: jest.fn(), save: jest.fn() },
}));
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return { WebView: View, default: View };
});
jest.mock('react-native-signature-canvas', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View };
});
jest.mock('react-native-share', () => ({
  __esModule: true,
  Social: { Whatsapp: 'whatsapp' },
  default: {
    open: jest.fn(),
    shareSingle: jest.fn(),
    Social: { WHATSAPP: 'whatsapp' },
  },
}));

// Official mock: hooks fall back to zero insets when no SafeAreaProvider is
// mounted, so components using useSafeAreaInsets render in bare Jest trees.
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return { __esModule: true, ...mock.default, default: mock.default };
});
