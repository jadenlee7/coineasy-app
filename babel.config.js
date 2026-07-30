module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          'crypto': 'expo-crypto',
          'stream': 'stream-browserify'
        },
      },
    ],
    ["@babel/plugin-transform-private-methods", { "loose": true }],
  ],
}
