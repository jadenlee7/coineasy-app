import React, { useState, useContext, useEffect, useCallback } from "react";
import { GlobalContext } from "../../contexts/GlobalContext";
import Modal from "../Modal";
import Button from "../Button";
import { useTailwind } from 'tailwind-rn';
import { Keyboard, StyleSheet, Text, View, TouchableHighlight, ActivityIndicator, Image } from 'react-native';
import * as Haptics from 'expo-haptics';
import { context } from '../../utils/config.js';
import { sleep } from '../../utils';

export default function PostSettingsModal() {
  const { user, orbis, repost, setRepost, showPostbox, postboxVis, editedPost, setEditedPost } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function hide() {
    setEditedPost(null);
    Keyboard.dismiss()
    Haptics.selectionAsync();
  }

  async function editPost() {
    showPostbox();
  }

  async function deletePost() {
    setLoading(true);
    let res = await orbis.deletePost(editedPost.value.stream_id);
    console.log("res:", res);
    setLoading(false);
    setSuccess(true);
    editedPost.callbackDelete();
    await sleep(1500);
    setEditedPost(null);
  }


  /** We hide the repost modal if the postbox is also visible, (this means that the user is quote posting) */
  if(postboxVis) {
    return null;
  } else {
    return(
      <Modal hide={() => hide()} animateModal={true} bottomDuration={200} bottomStart={-100}>
        <View style={[tailwind('flex flex-col w-full p-5')]}>
          {loading ?
            <>
              <Text style={[tailwind(`text-slate-900 px-8 text-center`), { fontSize: 15, fontFamily: "GmarketBold", lineHeight: 25 }]}>Deleting post:</Text>
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
                    style={{height: 50, width: 50, marginBottom: 40}}
                    source={require('../../assets/check-icon.png')} />
                </View>
              :
                <>
                  {/** Repost CTA */}
                  <Button color="rounded-gray" onPress={() => editPost()} title="Edit" style={{marginBottom: 10}} />
                  <Button color="rounded-red" onPress={() => deletePost()} title="Delete" style={{marginBottom: 20}} />
                </>
              }
            </>
          }
        </View>
      </Modal>
    )
  }
}
