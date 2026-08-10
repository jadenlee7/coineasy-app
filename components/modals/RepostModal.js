import React, { useContext } from 'react';
import { Alert, Keyboard, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import { GlobalContext } from '../../contexts/GlobalContext';
import Modal from '../Modal';
import { QuoteIcon, RepostIcon2 } from '../Icons';

export default function RepostModal() {
  const { setRepost, postboxVis } = useContext(GlobalContext);
  const tailwind = useTailwind();

  const hideRepost = () => {
    setRepost(false);
    Keyboard.dismiss();
    Haptics.selectionAsync();
  };

  const showUnavailable = (kind) => {
    Haptics.selectionAsync();
    Alert.alert(
      `${kind} is coming next`,
      'EasyGo needs a repost relationship in the backend before this can publish safely. No post was created.'
    );
  };

  if (postboxVis) return null;

  return (
    <Modal hide={hideRepost} animateModal={true} bottomDuration={200} bottomStart={-100} type="small">
      <View style={tailwind('flex flex-col w-full p-5')}>
        <Text style={{ fontFamily: 'GmarketBold', fontSize: 15, color: '#0F172A', marginBottom: 14 }}>
          Share this post
        </Text>
        <TouchableOpacity
          style={tailwind('bg-slate-100 rounded-full py-4 px-5 flex-row items-center justify-between')}
          onPress={() => showUnavailable('Repost')}
        >
          <Text style={{ fontSize: 14, fontFamily: 'GmarketBold', lineHeight: 18 }}>Repost</Text>
          <RepostIcon2 />
        </TouchableOpacity>
        <TouchableOpacity
          style={[tailwind('bg-slate-100 rounded-full py-4 px-5 flex-row items-center justify-between'), { marginTop: 10, marginBottom: 35 }]}
          onPress={() => showUnavailable('Quote post')}
        >
          <Text style={{ fontSize: 14, fontFamily: 'GmarketBold', lineHeight: 18 }}>Quote</Text>
          <QuoteIcon />
        </TouchableOpacity>
        <Text style={{ color: '#64748B', fontSize: 11, lineHeight: 17, textAlign: 'center' }}>
          Repost and quote support will arrive with the next social schema update.
        </Text>
      </View>
    </Modal>
  );
}
