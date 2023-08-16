import React, { useState, useEffect, useRef, useContext, useCallback } from "react";
import { StyleSheet, Text, View, TextInput, TouchableHighlight, Platform, ActivityIndicator } from 'react-native';
import Modal from "../Modal";
import Button from "../Button";
import { UserPfp, Username } from "../User";
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../../contexts/GlobalContext";
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { PlusIcon } from "../Icons";

export default function UpdateProfileModal({callback}) {
  const { user, setUser, orbis, setUpdateProfileVis } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [saving, setSaving] = useState(false);
  const [pfpLoading, setPfpLoading] = useState(false);
  const [pfp, setPfp] = useState(user.profile?.pfp ? user.profile.pfp : "");
  const [name, setName] = useState(user.profile?.username ? user.profile.username : "");
  const [description, setDescription] = useState(user.profile?.description ? user.profile.description : "");

  async function saveProfile() {
    if(pfpLoading) {
      alert("Your profile picture is currently being uploaded.");
      return;
    }
    Haptics.selectionAsync();
    setSaving(true);
    let content = {
      username: name,
      description: description,
      pfp: pfp
    };
    const res = await orbis.updateProfile(content);
    console.log("res:", res);
    let _user = {...user};
    _user.profile = content;
    setUser(_user);
    setSaving(false);
    setUpdateProfileVis(false);

    if(callback) {
      callback(_user);
    }
  }

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
        setPfpLoading(true);
        setPfp(imagePath);

        /** Create file object */
        let file = {
          name: "test",
          type: "image",
          uri: Platform.OS === 'ios' ? imagePath.replace('file://', '') : imagePath,
        }

        /** Upload PFP to IPFS */
        const resUpload = await orbis.uploadMedia(file);
        console.log("res image upload:", resUpload);

        /** Handle result returned by Orbis SDK */
        if(resUpload.status == 200) {
          let finalUrl = resUpload.result.url.replace("ipfs://", resUpload.result.gateway);
          console.log("finalUrl:", finalUrl);
          setPfp(finalUrl);
          setPfpLoading(false);
        } else {
          alert("Error uploading profile picture.");
          setPfpLoading(false);
        }

      }
    } catch(e) {
      console.log("Error selecting photo:", e);
      setPfpLoading(false);
    }
  }

  return(
    <Modal hide={() => setUpdateProfileVis(false)} animateModal={false}>
      <View style={tailwind('flex flex-row px-4 mt-3 items-center w-full justify-center')}>
          <Button title="Cancel" color="white" size="sm" onPress={() => setUpdateProfileVis(false)} />
          <View style={tailwind('flex flex-1')} />
          <Button title="Save" color="orange" size="sm" loading={saving} onPress={saveProfile} />
        </View>

      {/** Display profile details */}
      <View style={tailwind('w-full flex flex-col items-center')}>
        <TouchableHighlight style={tailwind('rounded-full')} onPress={() => selectPhoto()}>
          <>
            {pfpLoading ?
              <>
                <UserPfp details={{ profile: { pfp: pfp }}} height={50} />
                <ActivityIndicator size="small" color="#000" style={[tailwind('absolute'), {bottom: 0, right: -5}]} />
              </>
            :
              <>
                <UserPfp details={{ profile: { pfp: pfp }}} height={50} />
                <PlusIcon />
              </>
            }

          </>
        </TouchableHighlight>
        <View style={tailwind('mt-1')}>
          <Text style={[tailwind("text-slate-900 mt-2 w-2/3 text-center"), { fontSize: 11, lineHeight: 19, fontFamily: "GmarketBold", lineHeight: 15 }]}>Tap to edit your profile picture</Text>
        </View>
      </View>

      {/** Form content */}
      <View style={tailwind('w-full flex flex-col border-t border-secondary mt-4')}>
        <InputGroup label="Name" placeholder="Your name" value={name} setValue={setName} autoFocus={true} />
        <InputGroup label="Bio" placeholder="Enter a short description" value={description} setValue={setDescription} height={60} />
      </View>
    </Modal>
  )
}

const InputGroup = ({label, height = 20, placeholder, value, setValue, autoFocus = false}) => {
  const tailwind = useTailwind();

  return(
    <View style={tailwind('w-full flex flex-row border-b border-secondary items-start px-4 py-3')}>

      {/** Label */}
      <View style={[tailwind(''), {width: 80, paddingTop: 5}]}>
        <Text style={[tailwind("text-slate-900"), { fontSize: 12,fontFamily: "GmarketBold" }]}>{label}</Text>
      </View>

      {/** Input */}
      <View style={tailwind('flex flex-row pb-1 flex-1')}>
        <TextInput
          autoFocus={autoFocus}
          editable
          value={value}
          onChangeText={setValue}
          multiline={height > 20 ? true : false}
          style={[tailwind('text-slate-900 w-full'), { fontSize: 12, fontFamily: "GmarketMedium", paddingTop: height > 20 ? 2 : 4 }]}
          placeholder={placeholder} />
      </View>
    </View>
  )
}
