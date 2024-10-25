import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Image, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, PermissionsAndroid, Animated, KeyboardAvoidingView, ScrollView, Dimensions } from 'react-native'

import mime from 'mime';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { UserPfp } from '../../../components/User';
import { TelegramIcon } from '../../../components/Icons';
import HeaderImage from '../../../components/HeaderImage';
import Conversation from '../../../components/Conversation';
import { GlobalContext } from '../../../contexts/GlobalContext';
import { AttachmentsMenu } from '../../../components/modals/AttachmentMenu';



const ConversationDetail = ({navigation, route}) => {
    const { orbis, user, setShowImageSender, listMessages, setListMessages } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const { conversation } = route.params

    const [profile, setProfile] = useState(conversation.recipients_details ? conversation.recipients_details[0] : null)
    
    const [message, setMessage] = useState('')

    const [loadMessage, setLoadMessage] = useState(false)
    const [cameraLoading, setCameraLoading] = useState(false)

    const [attachmentsMenuVisible, setAttachmentsMenuVisible] = useState(false)

    useEffect(() => {
        conversation.messages.length > 0 && decryptMessages()

        async function decryptMessages() {
            setLoadMessage(true)

            const list_messages = []
            conversation.messages.map(async (e, index) => {
                const decryptedMessage = await orbis.decryptMessage(e.content)
                list_messages.push({'message': decryptedMessage.result, 'creator': e.creator})

                if(index == conversation.messages.length -1){
                    setListMessages([...list_messages])
                    setLoadMessage(false)
                }

            })
        }
    }, [])

    
    const onOpenSettingsPress = () => {        
        setAttachmentsMenuVisible(true)
    }

    const onSendPress = async () => {
        console.log('ici');
        const content = {
            conversation_id: conversation.stream_id,
            body: message
        }

        const new_message = {
            'message': message,
            'creator': user.did
        }

        const data = {}
        if(listAttachment.length != 0){

            listAttachment.map(async (e, index) => {
                /** Handle Image picked */
                let imagePath = e.item;
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
                    data[index] = finalUrl
                } else {
                    alert("Error uploading image.");
                }

                if(index == listAttachment.length-1){
                    console.log('oui');
                    console.log(data);
                    const res = await orbis.sendMessage(content, data);

                    console.log(res);
    
                    setListMessages([...listMessages, new_message])
                    setMessage('') 
                    setListAttachment([])
                }

            })
        }else{
            const res = await orbis.sendMessage(content, data);
    
            setListMessages([...listMessages, new_message])
            setMessage('')
        }

    }

    const toggleAttachmentsMenu = () => {
        setAttachmentsMenuVisible(!attachmentsMenuVisible);
    };

    const renderAttachmentsMenu = () => (
        <AttachmentsMenu
            setVisible={setAttachmentsMenuVisible}
            onSelectPhoto={onSelectPhoto}
            onSelectFile={onSelectFile}
            onSelectLocation={toggleAttachmentsMenu}
            onSelectContact={toggleAttachmentsMenu}
            onAttachmentSelect={onAttachmentSelect}
            onCameraPress={onCameraPress}
            onDismiss={toggleAttachmentsMenu}
            isCameraLoading={cameraLoading}
        />
    );

    const onAttachmentSelect = (info) => {
        Haptics.selectionAsync()
        setListAttachment([...listAttachment, info])
    }

    const onCameraPress = async () => {
        Haptics.selectionAsync()

        try {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

            console.log(permissionResult);

            if (permissionResult.granted === false) {
                alert("You have refused to allow this app to access your camera.");
            } else {
                let result = await ImagePicker.launchCameraAsync({
                    allowsEditing: false
                });
    
                if(!result.canceled){
                    setCameraLoading(true)
                    /** Handle Image picked */

                    let imagePath = result.assets[0].uri;
        
                    const imageType = mime.getType(imagePath)
        
                    /** Create file object */
                    let file = {
                        name: "test",
                        type: imageType,
                        uri: Platform.OS === 'ios' ? imagePath.replace('file://', '') : imagePath,
                    }
        
                    /** Upload Image to IPFS */
                    const resUpload = await orbis.uploadMedia(file);
        
                    /** Handle result returned by Orbis SDK */
                    if(resUpload.status == 200) {
                        let finalUrl = resUpload.result.url.replace("ipfs://", resUpload.result.gateway);
                        let media = [{
                            gateway: resUpload.result.gateway,
                            item: finalUrl,
                            width: result.assets[0].width,
                            height: result.assets[0].height,
                            conversation: conversation
                        }]
    
                        setCameraLoading(false)
                        setShowImageSender(media)
                        toggleAttachmentsMenu()
                    } else {
                        alert("Error uploading image.");
                    }
                }
            }
        } catch (error) {
            console.log('ICI');
            console.log(error);
        }
    }

    const onSelectPhoto = async () => {
        try {
            /** Open Image library to allow user to select a picture */
            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: "Images",
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.25,
            });

            if (!result.canceled) {
                /** Handle Image picked */
                let imagePath = result.assets[0].uri;

                const imageType = mime.getType(imagePath)

                /** Create file object */
                let file = {
                    name: "test",
                    type: imageType,
                    uri: Platform.OS === 'ios' ? imagePath.replace('file://', '') : imagePath,
                }

                /** Upload Image to IPFS */
                const resUpload = await orbis.uploadMedia(file);

                /** Handle result returned by Orbis SDK */
                if(resUpload.status == 200) {
                    let finalUrl = resUpload.result.url.replace("ipfs://", resUpload.result.gateway);
                    let media = [{
                        type: 'image',
                        gateway: resUpload.result.gateway,
                        item: finalUrl
                    }]

                    setListAttachment([...listAttachment, media]);
                    toggleAttachmentsMenu()
                } else {
                    alert("Error uploading image.");
                }
            }
        } catch(e) {
            console.log("Error selecting photo:", e);
        }
    }

    const onSelectFile = async () => {
        try {
            /** Open Image library to allow user to select a picture */
            let result = await DocumentPicker.getDocumentAsync();

            if (!result.canceled) {
                /** Handle Image picked */
                let imagePath = result.assets[0].uri;

                const imageType = mime.getType(imagePath)

                /** Create file object */
                let file = {
                    name: "test",
                    type: imageType,
                    uri: Platform.OS === 'ios' ? imagePath.replace('file://', '') : imagePath,
                }

                /** Upload Image to IPFS */
                const resUpload = await orbis.uploadMedia(file);

                /** Handle result returned by Orbis SDK */
                if(resUpload.status == 200) {
                    let finalUrl = resUpload.result.url.replace("ipfs://", resUpload.result.gateway);
                    let media = [{
                        type: 'document',
                        gateway: resUpload.result.gateway,
                        item: finalUrl
                    }]

                    setListAttachment([...listAttachment, media]);
                    toggleAttachmentsMenu()
                } else {
                    alert("Error uploading file.");
                }
            }
        } catch(e) {
            console.log("Error selecting photo:", e);
        }
    }

    const keyboardOffset = (height) => Platform.select({
        android: 0,
        ios: height,
    });

    const removeItemFromAttachments = (index) => {
        Haptics.selectionAsync()
        listAttachment.splice(index, 1)
        setListAttachment([...listAttachment])
    }

    return (
        <View style={[tailwind('flex flex-1 flex-col'),{backgroundColor: 'white',}]}>
            {/* Header Part */}
            <HeaderImage />

            <View style={{backgroundColor: 'white',flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',paddingLeft: 5,paddingRight: 20,paddingTop: 4,borderBottomWidth: 1,borderBottomColor:'#DCDCDC'}}>
                <TouchableOpacity style={{margin: 15,}} onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                    <Image
                        style={{width: 24,height: 24}}
                        resizeMode='contain'
                        source={require('../../../assets/back_button.png')}
                        defaultSource={require('../../../assets/back_button.png')}
                    />
                </TouchableOpacity>

                {profile && <Text style={{fontWeight: 'bold',fontSize: 18,}}>{profile.profile.username}</Text>}

                <TouchableOpacity onPress={() => {Haptics.selectionAsync();navigation.navigate('ProfileSelected', { did: profile.did })}}>
                    {profile && <UserPfp details={profile} />}
                </TouchableOpacity>
            </View>
            {/* End Header Part */}


            {/* Conversation Content Part */}
            {loadMessage ? (
                <View>
                    <ActivityIndicator style={{marginTop: 50}} size="small" color="#020617" />
                </View>
            ) : listMessages.length > 0 ? (
                <Conversation listMessages={listMessages}/>
            ) : (
                <View style={{backgroundColor: '#cccccc',width:'80%',height: 60,borderRadius: 8,alignItems: 'center',justifyContent: 'center',alignSelf: 'center',marginTop: 30,}}>
                    <Text>Send your first message to {profile.profile.username} !</Text>
                </View>
            )}
            {/* End Conversation Content Part */}



            {/* Bottom Part */}

            <KeyboardAvoidingView
                style={{flexDirection:'row',alignItems: 'center',}}
                offset={keyboardOffset}
            >
                <TouchableOpacity 
                    style={{width:'15%',justifyContent: 'center',alignItems: 'center',backgroundColor: '#F6F6F6',marginBottom: 20,height: 50,borderTopLeftRadius: 30,borderBottomLeftRadius: 30,marginLeft: 10,}}
                    onPress={() => {Haptics.selectionAsync();onOpenSettingsPress()}}
                >
                    <Image
                        style={{width: 28,height: 28}}
                        resizeMode='contain'
                        source={require('../../../assets/add_user_icon.png')}
                        defaultSource={require('../../../assets/add_user_icon.png')}
                    />
                    {/* <AddIcon style={{width: 60}}/> */}
                </TouchableOpacity>

                <TextInput
                    style={{padding: 5,height:50,backgroundColor: '#F6F6F6',width: '68%',marginBottom: 20,borderTopRightRadius: 30,borderBottomRightRadius: 30}}
                    onChangeText={setMessage}
                    value={message}
                    placeholder='Message...'
                />

                <TouchableOpacity 
                    style={{justifyContent: 'center',alignItems: 'center',marginBottom: 20,marginLeft: 15,}}
                    onPress={() => {(message != '' || listAttachment.length != 0) ? onSendPress() : null}}
                >
                    <TelegramIcon />
                </TouchableOpacity>
            </KeyboardAvoidingView>

            {attachmentsMenuVisible && renderAttachmentsMenu()}
            {/* End Bottom Part */}

        </View>
    )
}

export default ConversationDetail

const styles = StyleSheet.create({
})