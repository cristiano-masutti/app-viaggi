module.exports = function (api) {
  api.cache(true);
  return {
    // `jsxImportSource: 'nativewind'` abilita la prop `className` su ogni componente RN.
    // Il plugin di react-native-worklets (richiesto da Reanimated 4) viene aggiunto
    // automaticamente da babel-preset-expo: non va ripetuto qui.
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
