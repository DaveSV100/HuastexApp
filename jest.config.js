module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  // These packages ship untranspiled ESM; Jest must run them through Babel.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*|@react-native-.*)/)',
  ],
};
