module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          'crypto': 'expo-crypto',
          'stream': 'stream-browserify',
          'buffer': '@craftzdog/react-native-buffer'
        },
      },
    ],
    ["@babel/plugin-transform-private-methods", { "loose": true }],
  ],
}
