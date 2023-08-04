import React, { useContext, useState } from "react";
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import User, { UserPfp } from "./User";
import Button from "./Button";
import { KeyboardAvoidingView, SafeAreaView, StyleSheet, Text, View, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { sleep } from "../utils";
import * as Haptics from 'expo-haptics';
import { context } from '../utils/config.js';

export default function Postbox({callback}) {
  const { user, orbis, showConnectModal, setShowConnectModal } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    Haptics.selectionAsync();
    setLoading(true);
    let content = {
      body: message,
      context: context
    };
    let res = await orbis.createPost(content);

    /** Wait for new post to be indexed */
    await sleep(1000);
    setMessage("");

    let _callbackContent = {
      creator: user.did,
      creator_details: {
        did: user.did,
        profile: user.profile
      },
      temporary_id: "hey-",
      stream_id: res.doc,
      content: content,
      /*master: null,
      reply_to: reply_to ? reply_to.stream_id : null,
      reply_to_details: reply_to ? reply_to.reply_to_details : null,
      reply_to_creator_details: reply_to ? reply_to.creator : null*/
    }

    callback(_callbackContent);
    setLoading(false);
  }

  /** Will show connect modal and return haptic feedback */
  async function showConnect() {
    Haptics.selectionAsync();
    setShowConnectModal(true)
  }

  return(
		<View style={tailwind('items-center w-full pb-5')}>
      {user ?
        <View style={tailwind('flex flex-col items-start w-full')}>
          <View style={tailwind('flex flex-row mb-2')}>
            <User details={user} height={40} />
          </View>
          <TextInput
            onChangeText={loading ? () => console.log("Disbaled.") : setMessage}
            autoFocus
            numberOfLines={1}
            value={message}
            //editable={!loading}
            style={[tailwind('w-full'), { fontSize: 14, fontFamily: "GmarketMedium", minHeight: 30, lineHeight: 17 }]}
            placeholder="What's happening?"
            placeholderTextColor="#64748b"
            multiline={true} />

          <View style={tailwind('flex flex-row w-full justify-end')}>
            {loading ?
              <Button title={<ActivityIndicator size="small" color="#fff" />} color="orange" />
            :
              <Button title="Send" color="orange" onPress={() => send()} />
            }
          </View>
        </View>
      :
        <View style={tailwind('w-full items-center flex flex-col')}>
          <Text style={tailwind('text-gray-600 text-sm text-center mt-1 mb-2')}>
            You need to be connected to share content and receive rewards.
          </Text>
          <Button title="Connect" onPress={() => showConnect()} />
        </View>
      }
		</View>
  )
}
