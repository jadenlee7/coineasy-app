import React, { useState, useEffect, useRef, useContext, useCallback } from "react";
import { StyleSheet, Text, View, TextInput } from 'react-native';
import Modal from "../Modal";
import Button from "../Button";
import { UserPfp, Username } from "../User";
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../../contexts/GlobalContext";
import * as Haptics from 'expo-haptics';

export default function UpdateProfileModal({callback}) {
  const { user, setUser, orbis, setUpdateProfileVis } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(user.profile?.username ? user.profile.username : "");
  const [description, setDescription] = useState(user.profile?.description ? user.profile.description : "");

  async function saveProfile() {
    Haptics.selectionAsync();
    setSaving(true);
    let content = {
      username: name,
      description: description
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

  return(
    <Modal hide={() => setUpdateProfileVis(false)}>
      <View style={tailwind('flex flex-row px-4 mt-3 items-center w-full justify-center')}>
          <Button title="Cancel" color="sm-white" onPress={() => setUpdateProfileVis(false)} />
          <View style={tailwind('flex flex-1')} />
          <Button title="Save" color="orange" size="sm" loading={saving} onPress={saveProfile} />
        </View>

      {/** Display profile details */}
      <View style={tailwind('w-full flex flex-col items-center')}>
        <UserPfp details={user} height={50} />
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
