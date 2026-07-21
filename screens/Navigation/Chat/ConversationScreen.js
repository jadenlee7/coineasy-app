import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import HeaderImage from '../../../components/HeaderImage';

export default function ConversationScreen({ navigation }) {
  const tailwind = useTailwind();

  return (
    <View style={[tailwind('flex flex-1'), { backgroundColor: 'white' }]}>
      <HeaderImage />
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 5, paddingTop: 4 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{ margin: 15 }}
          onPress={() => { Haptics.selectionAsync(); navigation.goBack(); }}
        >
          <Image
            style={{ width: 24, height: 24 }}
            resizeMode="contain"
            source={require('../../../assets/back_button.png')}
          />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'GmarketBold', fontSize: 17, color: '#0F172A' }}>Messages</Text>
      </View>

      <View style={[tailwind('bg-slate-50 items-center rounded-md mx-6'), { paddingHorizontal: 24, paddingVertical: 30, marginTop: 22 }]}>
        <Text style={{ fontFamily: 'GmarketBold', fontSize: 16, color: '#0F172A', textAlign: 'center' }}>
          Private messaging is being rebuilt
        </Text>
        <Text style={{ color: '#64748B', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 10 }}>
          The old inbox depended on Orbis encryption and storage. EasyGo will enable messages again after its own encrypted messaging backend and moderation controls are ready.
        </Text>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); navigation.navigate('Search'); }}
          style={{ backgroundColor: '#FF6B17', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12, marginTop: 20 }}
        >
          <Text style={{ color: 'white', fontFamily: 'GmarketBold', fontSize: 12 }}>Explore people</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
