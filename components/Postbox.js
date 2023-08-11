import React, { useContext, useState, useEffect } from "react";
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import User, { UserPfp, Username } from "./User";
import Button from "./Button";
import Post from "./Post";
import { KeyboardAvoidingView, SafeAreaView, StyleSheet, Text, View, TouchableOpacity, TouchableHighlight, TextInput, ActivityIndicator, Platform, Image } from 'react-native';
import { sleep, getTimestamp } from "../utils";
import * as Haptics from 'expo-haptics';
import { context } from '../utils/config.js';
import Svg, { Circle, Rect, Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';

export default function Postbox({isReply = false}) {
  const { user, orbis, showConnectModal, setShowConnectModal, hidePostbox, replyTo, repost, callbackPostShared } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);

  async function send() {
    Haptics.selectionAsync();
    setLoading(true);
    let content = {
      body: message,
      context: context,
      media: media ? media : null,
      repost: repost ? repost.stream_id : null,
      reply_to: replyTo ? replyTo.stream_id : null,
      master: replyTo ? replyTo.stream_id : null
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
      stream_id: res.doc,
      content: content,
      count_likes: 0,
      count_reposts: 0,
      timestamp: getTimestamp()
      /*master: null,
      reply_to: reply_to ? reply_to.stream_id : null,
      reply_to_details: reply_to ? reply_to.reply_to_details : null,
      reply_to_creator_details: reply_to ? reply_to.creator : null*/
    }

    /** If any trigger callback after the post is shared */
    if(callbackPostShared) {
      callbackPostShared(_callbackContent);
    }

    setLoading(false);
  }

  /** Will show connect modal and return haptic feedback */
  async function showConnect() {
    Haptics.selectionAsync();
    setShowConnectModal(true)
  }

  /** Will open the media library and allow user to select a photo */
  async function selectPhoto() {
    try {
      // No permissions request is necessary for launching the image library
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "Images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.25,
      });

      console.log(result);

      if (!result.canceled) {
        /** Handle Image picked */
        let imagePath = result.assets[0].uri;
        setImageLoading(true);

        /** Create file object */
        let file = {
          name: "test",
          type: "image",
          uri: Platform.OS === 'ios' ? imagePath.replace('file://', '') : imagePath,
        }

        /** Upload Image to IPFS */
        const resUpload = await orbis.uploadMedia(file);


        /** Handle result returned by Orbis SDK */
        if(resUpload.status == 200) {
          let finalUrl = resUpload.result.url.replace("ipfs://", resUpload.result.gateway);
          let media = [{
            gateway: resUpload.result.gateway,
            url: finalUrl
          }]
          console.log("res image upload:", resUpload);
          console.log("finalUrl:", finalUrl);
          setMedia(media);
          setImageLoading(false);
        } else {
          alert("Error uploading image.");
          setImageLoading(false);
        }

      }
    } catch(e) {
      console.log("Error selecting photo:", e);
      setImageLoading(false);
    }
  }

  return(
		<View style={tailwind('items-center w-full pt-2')}>
      <View style={tailwind('flex flex-col items-start w-full')}>
        {/** Top bar with user details and cancel button */}
        <View style={tailwind('flex flex-row mb-2 w-full items-center')}>
          <View style={tailwind('flex-1')}>
            {replyTo ?
              <View style={tailwind('flex flex-row items-center')}>
                <UserPfp details={user} height={40} />
                <Text style={[{fontFamily: "GmarketMedium", fontSize: 13, lineHeight: 18, color: "#959595", marginLeft: 8, marginRight: 4}]}>Replying to:</Text>
                <Username details={replyTo.creator_details} style={{fontSize: 13}} />
              </View>
            :
              <User details={user} height={40} />
            }

          </View>
          {!replyTo &&
            <Button title="Cancel" color="white" size="sm" onPress={() => hidePostbox()} />
          }
        </View>

        {/** Show input container */}
        <TextInput
          onChangeText={loading ? () => console.log("Disbaled.") : setMessage}
          autoFocus
          numberOfLines={1}
          value={message}
          //editable={!loading}
          style={[tailwind('w-full'), { fontSize: 14, fontFamily: "GmarketMedium", minHeight: 35, lineHeight: 17, paddingBottom: 10 }]}
          placeholder={replyTo ? "Post your reply" : "What's happening?" }
          placeholderTextColor="#64748b"
          multiline={true} />

        {/** Display media attached if any */}
        <Media media={media} deleteMedia={() => setMedia(null)} />

        {/** Show repost details if user is replying to a post */}
        {(repost != false && repost != null) &&
          <Post post={repost} style={tailwind('rounded-md border border-secondary p-4')} />
        }

        <View style={tailwind('flex flex-row w-full pt-1' )}>
          <View style={tailwind('flex flex-1 justify-end items-start' )}>
            {imageLoading ?
              <ActivityIndicator size="small" color="#FF6B17" />
            :
              <TouchableOpacity onPress={() => selectPhoto()}>
                <Svg width="19" height="17" viewBox="0 0 22 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <Path d="M0 2.71429C0 1.21719 1.2332 0 2.75 0H19.25C20.7668 0 22 1.21719 22 2.71429V16.2857C22 17.7828 20.7668 19 19.25 19H2.75C1.2332 19 0 17.7828 0 16.2857V2.71429ZM13.9133 7.23103C13.7199 6.95112 13.402 6.78571 13.0625 6.78571C12.723 6.78571 12.4008 6.95112 12.2117 7.23103L8.47344 12.6426L7.33477 11.2388C7.13711 10.9971 6.84062 10.8571 6.53125 10.8571C6.22188 10.8571 5.92109 10.9971 5.72773 11.2388L2.97773 14.6317C2.72852 14.9371 2.68125 15.3569 2.85313 15.7089C3.025 16.0609 3.38594 16.2857 3.78125 16.2857H7.90625H9.28125H18.2188C18.6012 16.2857 18.9535 16.0779 19.1297 15.7429C19.3059 15.4078 19.2844 15.0049 19.0695 14.6953L13.9133 7.23103ZM4.8125 6.78571C5.35951 6.78571 5.88411 6.57124 6.27091 6.18947C6.6577 5.8077 6.875 5.2899 6.875 4.75C6.875 4.21009 6.6577 3.6923 6.27091 3.31053C5.88411 2.92876 5.35951 2.71429 4.8125 2.71429C4.26549 2.71429 3.74089 2.92876 3.35409 3.31053C2.9673 3.6923 2.75 4.21009 2.75 4.75C2.75 5.2899 2.9673 5.8077 3.35409 6.18947C3.74089 6.57124 4.26549 6.78571 4.8125 6.78571Z" fill="#FF6E31"/>
                </Svg>
              </TouchableOpacity>
            }

          </View>

          {loading ?
            <Button title={<ActivityIndicator size="small" color="#fff" />} color="orange" size="sm" />
          :
            <Button title="Post" color="orange" size="sm" onPress={() => send()} />
          }
        </View>
      </View>
		</View>
  )
}

const Media = ({media, deleteMedia}) => {
  const tailwind = useTailwind();
  if(media && media.length > 0) {
    return(
      <View>
        <Image
          style={[tailwind('rounded-md shadow-md border border-secondary'), { height: 150, width: 150 }]}
          source={{
            uri: media[0].url,
          }} />
        <TouchableHighlight onPress={deleteMedia} style={{ position: "absolute", right: -5, top: -5}} underlayColor="transparent">
          <Svg width="27" height="27" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <Circle cx="12" cy="12.001" r="10" fill="white"/>
            <Path d="M12 1C5.939 1 1 5.939 1 12C1 18.061 5.939 23 12 23C18.061 23 23 18.061 23 12C23 5.939 18.061 1 12 1ZM15.696 14.53C16.015 14.849 16.015 15.377 15.696 15.696C15.531 15.861 15.322 15.938 15.113 15.938C14.904 15.938 14.695 15.861 14.53 15.696L12 13.166L9.47 15.696C9.305 15.861 9.096 15.938 8.887 15.938C8.678 15.938 8.469 15.861 8.304 15.696C8.15057 15.5407 8.06453 15.3313 8.06453 15.113C8.06453 14.8947 8.15057 14.6853 8.304 14.53L10.834 12L8.304 9.47C8.15057 9.31475 8.06453 9.10527 8.06453 8.887C8.06453 8.66873 8.15057 8.45925 8.304 8.304C8.623 7.985 9.151 7.985 9.47 8.304L12 10.834L14.53 8.304C14.849 7.985 15.377 7.985 15.696 8.304C16.015 8.623 16.015 9.151 15.696 9.47L13.166 12L15.696 14.53Z" fill="black"/>
          </Svg>
        </TouchableHighlight>
      </View>
    )
  } else {
    return null
  }
}
