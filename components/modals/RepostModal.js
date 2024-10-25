import React, { useState, useContext, useEffect, useCallback } from "react";
import { GlobalContext } from "../../contexts/GlobalContext";
import Modal from "../Modal";
import Button from "../Button";
import { useTailwind } from 'tailwind-rn';
import { Keyboard, Text, View, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { context } from '../../utils/config.js';
import { sleep } from '../../utils';
import { QuoteIcon, RepostIcon, RepostIcon2 } from "../Icons.js";

export default function RepostModal() {
  const { user,setUser,userData,setUserData, orbis, repost, setRepost, showPostbox, postboxVis } = useContext(GlobalContext);
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

    // Orange Reward
    const tempData = userData

    if(tempData.reaction){
        tempData.reaction.number += 1
        tempData.reaction.gained += 5
    }else{
        tempData.reaction = {
            number: 1,
            gained: 5,
            lastReaction: moment().format('YYYY-MM-DD HH:mm')
        }
    }

    setUserData({...tempData})

    var tempProfile = user.profile
    tempProfile.data = tempData
    await orbis.updateProfile(tempProfile);

    setLoading(false);
    setSuccess(true);
    await sleep(1500);
    setRepost(false);
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
      <Modal hide={() => hideRepost()} animateModal={true} bottomDuration={200} bottomStart={-100} type='small'>
        <View style={[tailwind('flex flex-col w-full p-5')]}>
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
                  style={{height: 50, width: 50, marginBottom: 40}}
                    source={require('../../assets/check_icon.png')} />
                </View>
              :
                <>
                    <TouchableOpacity style={[tailwind('bg-slate-100 rounded-full py-4 px-5 flex-row items-center justify-between')]} onPress={() => shareRepost()} underlayColor="#f8fafc">
                        <Text style={[tailwind('text-center'), { fontSize: 14, fontFamily: "GmarketBold", lineHeight: 18 }]}>Repost</Text>
                        <RepostIcon2 />
                    </TouchableOpacity>
                    <TouchableOpacity style={[tailwind('bg-slate-100 rounded-full py-4 px-5 flex-row items-center justify-between'), {marginTop: 10,marginBottom: 50,}]} onPress={() => quote()} underlayColor="#f8fafc">
                        <Text style={[tailwind('text-center'), { fontSize: 14, fontFamily: "GmarketBold", lineHeight: 18 }]}>Quote</Text>
                        <QuoteIcon />
                    </TouchableOpacity>
                </>
              }
            </>
          }
        </View>
      </Modal>
    )
  }
}
