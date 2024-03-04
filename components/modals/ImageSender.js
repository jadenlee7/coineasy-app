import React, { useState, useContext, useEffect } from "react";
import { View, Image, TouchableHighlight, Dimensions, BackHandler, TouchableOpacity, TextInput, KeyboardAvoidingView } from 'react-native';

import mime from 'mime';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import { CloseIcon, SendIcon } from "../Icons";
import { GlobalContext } from "../../contexts/GlobalContext";

export default function ImageSender(props) {

    const { hide, media, updateListMessage } = props

    const { user, orbis, setShowImageSender, listMessages } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const [message, setMessage] = useState('')

    const { width } = Dimensions.get('window');

    const backhandler = BackHandler.addEventListener('hardwareBackPress', function () {
        Haptics.selectionAsync()
        setShowImageSender(null)
        return true
    });

    useEffect(() => {
        return () => backhandler.remove();
    }, [])


    const ratioWidth = (width-25)/media[0].width
    const newHeight = media[0].height*ratioWidth

    const onSendPress = async () => {
        console.log('ici');
        const content = {
            conversation_id: media[0].conversation.stream_id,
            body: message
        }

        const new_message = {
            'message': message,
            'creator': user.did
        }

        const data = {}

        /** Handle Image picked */
        let imagePath = media[0].item;
        const imageType = mime.getType(imagePath)

        /** Create file object */
        let file = {
            name: "test",
            type: imageType,
            uri: Platform.OS === 'ios' ? imagePath.replace('file://', '') : imagePath,
        }

        /** Upload image to IPFS */
        const resUpload = await orbis.uploadMedia(file);

        /** Handle result returned by Orbis SDK */
        if(resUpload.status == 200) {
            let finalUrl = resUpload.result.url.replace("ipfs://", resUpload.result.gateway);
            data = {'media': finalUrl}
        } else {
            alert("Error uploading image.");
        }

        const res = await orbis.sendMessage(content, data);
        console.log(res);

        updateListMessage([...listMessages, new_message])
        hide()
    }

    return(
        <View style={[{backgroundColor: 'black',height: '100%'}]}>

            <KeyboardAvoidingView style={[{justifyContent: 'center',alignItems: 'center',height: '100%',}]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={[tailwind('items-center justify-center'), {backgroundColor: '#D9D9D9',height: newHeight,width: width-25, borderRadius: 20,marginBottom: 20,}]}>
                    <View style={{position: 'absolute',zIndex: 2,top: 10,right: 35}}>
                        <TouchableHighlight onPress={() => {Haptics.selectionAsync();hide()}} style={{left: 20, top: 10}} underlayColor="transparent">
                            <CloseIcon />
                        </TouchableHighlight>
                    </View>

                    <Image
                        resizeMode="center"
                        style={[tailwind('w-full h-full'), {borderRadius: 20}]}
                        source={{uri: media[0].item}}
                        defaultSource={require("../../assets/loader_001.gif")}
                    />
                </View>

                <View style={{width: width-25,}} >
                    <TextInput
                        style={{padding: 15,height:50,backgroundColor: '#858585',borderRadius: 30,}}
                        onChangeText={setMessage}
                        value={message}
                        placeholder='Add a message...'
                    />
                </View>

                <TouchableOpacity
                    style={{width:60,height: 60,borderRadius: 30,backgroundColor: '#FF6E31',justifyContent: 'center',alignItems: 'center',position: 'absolute',top: newHeight + 220,}}
                    onPress={onSendPress}
                >
                    <SendIcon />
                </TouchableOpacity>
            </KeyboardAvoidingView>

        </View>
    )
}