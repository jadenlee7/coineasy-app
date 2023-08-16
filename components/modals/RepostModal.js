import React, { useState, useContext, useEffect, useCallback } from "react";
import { GlobalContext } from "../../contexts/GlobalContext";
import Modal from "../Modal";
import Button from "../Button";
import { useTailwind } from 'tailwind-rn';
import { Keyboard, StyleSheet, Text, View, TouchableHighlight, ActivityIndicator, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { context } from '../../utils/config.js';
import { sleep } from '../../utils';

export default function RepostModal() {
  const { user, orbis, repost, setRepost, showPostbox, postboxVis } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function hideRepost() {
    setRepost(false);
    Keyboard.dismiss()
    Haptics.selectionAsync();
  }

  /** Will reshare the post on the feed without any content */
  async function shareRepost() {
    Haptics.selectionAsync();
    setLoading(true);
    let content = {
      body: " ",
      context: repost.context,
      repost: repost.stream_id
    };
    let res = await orbis.createPost(content);
    setLoading(false);
    setSuccess(true);
    await sleep(1500);
    setRepost(null);
  }

  /** Will open the postbox with the quoted tweet visible */
  function quote() {
    showPostbox();
  }

  /** We hide the repost modal if the postbox is also visible, (this means that the user is quote posting) */
  if(postboxVis) {
    return null;
  } else {
    return(
      <Modal hide={() => hideRepost()} animateModal={true} bottomDuration={200} bottomStart={-100}>
        <View style={[tailwind('flex flex-col w-full p-4')]}>
          {loading ?
            <>
              <Text style={[tailwind(`text-slate-900 px-8 text-center`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 25 }]}>Sharing post:</Text>
              <View style={[tailwind('flex w-full justify-center'), {marginBottom: 25}]}>
                <ActivityIndicator style={{marginTop: 15}} size="small" color="#020617" />
              </View>
            </>
          :
            <>
              {success ?
                <View style={[tailwind('flex w-full items-center')]}>
                <Text style={[tailwind(`text-slate-900 px-8 text-center`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 25, marginBottom: 8 }]}>Success!</Text>
                  <Image
                    style={{height: 50, width: 50}}
                    source={require('../../assets/check-icon.png')} />
                </View>
              :
                <>
                  {/** Repost CTA */}
                  <Button color="rounded-gray" onPress={() => shareRepost()} title="Repost" style={{marginBottom: 10}} />
                  <Button color="rounded-gray" onPress={() => quote()} title="Quote" />
                </>
              }
            </>
          }
        </View>
      </Modal>
    )
  }
}
