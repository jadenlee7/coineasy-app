import React, { useContext, useState, useEffect } from "react";
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import User, { UserPfp, Username } from "./User";
import Button from "./Button";
import Post from "./Post";
import { Text, View, TouchableOpacity, TouchableHighlight, TextInput, ActivityIndicator, Platform, Image } from 'react-native';
import { sleep, getTimestamp } from "../utils";
import * as Haptics from 'expo-haptics';
import { context } from '../utils/config.js';
import { checkContextAccess } from "../utils";
import * as ImagePicker from 'expo-image-picker';
import { BackIcon, ImagePickerIcon, CaretDownIcon, CloseIcon, LockIcon, UnlockIcon } from "./Icons";

export default function Postbox({isReply = false}) {
  const { user, orbis, showConnectModal, setShowConnectModal, hidePostbox, replyTo, repost, callbackPostShared, category, setCategory, categories } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [categoriesVis, setCategoriesVis] = useState(false);
  const [categorySelected, setCategorySelected] = useState(false);
  const [hasAccess, setHasAccess] = useState(true);

  /** Pre-select category if one already selected in the feed */
  useEffect(() => {
    if(category) {
      setCategorySelected(category);
      checkAccess();

      async function checkAccess() {
        if(category.content.accessRules && category.content.accessRules.length > 0) {
          let _hasAccess = await checkContextAccess(user, category.content.accessRules);
          setHasAccess(_hasAccess);
        } else {
          setHasAccess(true);
        }
      }
    }
  }, [category])

  /** Will share message with Orbis */
  async function send() {
    Haptics.selectionAsync();
    let _context = context;
    if(replyTo) {
      _context = replyTo.context;
    }
    else if(repost) {
      _context = repost.context;
    } else if(categorySelected) {
      _context = categorySelected.stream_id;
    }
    setLoading(true);
    let content = {
      body: message,
      context: _context,
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

  function openCategory() {
    setCategoriesVis(true)
  }

  return(
		<View style={tailwind('items-center w-full pt-2')}>
      <View style={tailwind('flex flex-col items-start w-full')}>
        {categoriesVis ?
          <>
            <View style={tailwind('flex flex-row w-full mb-1')}>
              <TouchableHighlight style={[tailwind('flex flex-row items-center rounded-md py-1 px-2')]} underlayColor="#f1f5f9" onPress={() => setCategoriesVis(false)}>
                <>
                  <BackIcon />
                  <Text style={[tailwind('text-slate-900 ml-3'), { fontFamily: "GmarketMedium" }]}>Back</Text>
                </>
              </TouchableHighlight>
            </View>
            <View style={tailwind('flex flex-row w-full mb-6 flex-wrap')}>
            {/** Loop and display categories */}
            {categories.map((category, key) => {
              return (
                <Category key={key} category={category} setCategoriesVis={setCategoriesVis} setCategorySelected={setCategorySelected} />
              );
            })}
            </View>
          </>
        :
          <>
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
                <Button title={categorySelected ? categorySelected.content.displayName : "Category"} iconRight={<CaretDownIcon />} color="white" size="sm" onPress={() => openCategory()} />
              }
            </View>

            {(categorySelected?.content?.accessRules && categorySelected?.content?.accessRules.length > 0) &&
              <View style={tailwind('bg-slate-50 px-2 py-3 items-center mb-1 rounded-md w-full flex-row justify-center')} >
                {hasAccess ?
                  <UnlockIcon color="#959595" style={{marginRight: 2}} />
                :
                  <LockIcon color="#959595" style={{marginRight: 2}} />
                }

                <Text style={tailwind('text-secondary items-center ml-1')}>This category is gated.</Text>
              </View>
            }

            {/** Show input container */}
            {hasAccess &&
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
            }


            {/** Display media attached if any */}
            <Media media={media} deleteMedia={() => setMedia(null)} />

            {/** Show repost details if user is replying to a post */}
            {(repost != false && repost != null) &&
              <Post post={repost} style={tailwind('rounded-md border border-secondary p-4')} />
            }

            <View style={tailwind('flex flex-row w-full pt-1' )}>

              {/** Image picker icon */}
              <View style={tailwind('flex flex-1 justify-end items-start' )}>
                {imageLoading ?
                  <ActivityIndicator size="small" color="#FF6B17" />
                :
                  <TouchableOpacity onPress={() => selectPhoto()}>
                    <ImagePickerIcon />
                  </TouchableOpacity>
                }
              </View>

              {/** Post button */}
              {loading ?
                <Button title={<ActivityIndicator size="small" color="#fff" />} color="orange" size="sm" />
              :
                <Button title="Post" color="orange" size="sm" onPress={() => send()} />
              }
            </View>
          </>
        }

      </View>
		</View>
  )
}

const Category = ({category, setCategoriesVis, setCategorySelected}) => {
  const { setCategory } = useContext(GlobalContext);

  function select() {
    setCategorySelected(category);
    setCategoriesVis(false);
  }

  return(
    <Button title={category.content.displayName} style={{width: "48%", marginRight: "2%"}} color="rounded-gray" onPress={() => select()} />
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
          <CloseIcon />
        </TouchableHighlight>
      </View>
    )
  } else {
    return null
  }
}
