import React from 'react';
import { Image, View } from 'react-native';

// Original local assets; no runtime downloads, tinting, or provider connection.
const MARKS = {
  Base: require('../assets/brands/Base_square_blue.png'),
  USDC: require('../assets/brands/USDC Token @192w.png'),
  Ethereum: require('../assets/brands/ethereum-diamond-black.png'),
  ETH: require('../assets/brands/ethereum-diamond-black.png'),
  EasyGo: require('../assets/logo_easygo_ios_1024.png'),
};

export default function PracticeBrand({ name, size = 24 }) {
  const source = MARKS[name];
  if (!source) return null;
  return (
    <View accessible={false} style={{ width: size, height: size, padding: name === 'Base' ? size * 0.2 : 2, backgroundColor: '#FFF', borderRadius: 5 }}>
      <Image accessible={false} source={source} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
