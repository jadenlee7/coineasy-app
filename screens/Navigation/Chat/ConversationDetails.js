import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import HeaderImage from '../../../components/HeaderImage';

export default function ConversationDetails({ navigation }) {
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
        <Text style={{ fontFamily: 'GmarketBold', fontSize: 17, color: '#0F172A' }}>Conversation</Text>
      </View>
      <View style={[tailwind('bg-slate-50 items-center rounded-md mx-6'), { padding: 26, marginTop: 22 }]}>
        <Text style={{ fontFamily: 'GmarketBold', color: '#0F172A', textAlign: 'center' }}>
          This conversation is unavailable
        </Text>
        <Text style={{ color: '#64748B', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 9 }}>
          No legacy message was decrypted, uploaded, or sent. Return to the inbox for the EasyGo messaging status.
        </Text>
      </View>
    </View>
  );
}
