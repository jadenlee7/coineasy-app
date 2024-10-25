module.exports = {
  presets: [
    [
      'module:metro-react-native-babel-preset', {
        unstable_disableES6Transforms: true
      }
    ]
  ],
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
    'react-native-reanimated/plugin',
  ],
}
