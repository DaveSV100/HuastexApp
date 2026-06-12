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
  default: { open: jest.fn() },
}));
