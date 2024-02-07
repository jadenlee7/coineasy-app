import React, { useContext, useEffect, useState } from 'react'
import { ActivityIndicator, Button, Image, Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import HeaderImage from '../../../components/HeaderImage';
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from '../../../contexts/GlobalContext';

import * as Haptics from 'expo-haptics';
import { UserPfp } from '../../../components/User';
import { AddIcon, PlusIcon, TelegramIcon } from '../../../components/Icons';


const ConversationDetail = ({navigation, route}) => {
    const { orbis, user } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const { conversation } = route.params
    // console.log('ici');
    // console.log(conversation);

    const [profile, setProfile] = useState(conversation.recipients_details ? conversation.recipients_details[0] : null)
    const [message, setMessage] = useState('')
    const [listMessages, setListMessages] = useState([])
    const [loadMessage, setLoadMessage] = useState(false)

    useEffect(() => {
        conversation.messages.length > 0 && decryptMessages()

        !conversation.recipients_details && getUser()

        async function decryptMessages() {
            setLoadMessage(true)

            const list_messages = []
            conversation.messages.map(async (e, index) => {
                console.log(e.content);
                const decryptedMessage = await orbis.decryptMessage(e.content)
                console.log(decryptedMessage.result)
                list_messages.push(decryptedMessage.result)

                if(index == conversation.messages.length -1){
                    setListMessages([...list_messages])
                    setLoadMessage(false)
                }

            })
        }

        async function getUser() {
            setLoadMessage(true)

            const list_messages = []
            conversation.messages.map(async (e, index) => {
                const decryptedMessage = await orbis.decryptMessage(data[data.length -1].content)
                console.log(decryptedMessage.result)
                list_messages.push(decryptMessages.result)

                if(index == conversation.messages.length -1){
                    setListMessages([...list_messages])
                    setLoadMessage(false)
                }

            })
        }
    }, [])
    
    const onOpenSettingsPress = () => {
        console.log('open settings');
    }

    const onSendPress = async () => {
        const content = {
            conversation_id: conversation.stream_id,
            body: message
        }
        const res = await orbis.sendMessage(content, {});

        setListMessages([...listMessages, message])
        setMessage('')
        console.log('send pressed');
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

                <TouchableOpacity onPress={() => {Haptics.selectionAsync();navigation.navigate('ProfileSelected', { did: conversation?.details.did })}}>
                    {profile && <UserPfp details={profile} />}
                </TouchableOpacity>
            </View>
            {/* End Header Part */}


            {/* Conversation Content Part */}
            {loadMessage ? (
                <View>
                    <ActivityIndicator style={{marginTop: 50}} size="small" color="#020617" />
                </View>
            ) : (
                <ScrollView>
                    {listMessages.length > 0 ? listMessages.map(e => {
                        return(
                            <View style={{borderRadius: 8, height: 50, width: '50%', backgroundColor: '#ccc',justifyContent: 'center'}} key={Math.random()}>
                                <Text>{e}</Text>
                            </View>
                        )
                    }) : (
                        <View style={{backgroundColor: '#cccccc',width:'80%',height: 60,borderRadius: 8,alignItems: 'center',justifyContent: 'center',alignSelf: 'center',marginTop: 30,}}>
                            <Text>Send your first message to {profile.profile.username} !</Text>
                        </View>
                    )}
                </ScrollView>
            )}
            {/* End Conversation Content Part */}




            {/* Bottom Part */}
            <View style={{position: 'absolute',bottom: 0,height:80,width:'100%',borderTopWidth: 1,borderTopColor: '#DCDCDC',flexDirection:'row',alignItems: 'center',justifyContent: 'center',}}>
                <TouchableOpacity 
                    style={{width:'15%',height:'100%',justifyContent: 'center',alignItems: 'center',}}
                    onPress={() => onOpenSettingsPress()}
                >
                    <AddIcon />
                </TouchableOpacity>

                <TextInput
                    style={{width:'70%',borderWidth: 1,borderColor: '#DCDCDC',borderRadius: 8,height:'65%'}}
                    onChangeText={setMessage}
                    value={message}
                    placeholder='Message...'
                />

                <TouchableOpacity 
                    style={{width:'15%',justifyContent: 'center',alignItems: 'center',}}
                    onPress={() => onSendPress()}
                >
                    <TelegramIcon />
                </TouchableOpacity>
            </View>
            {/* End Bottom Part */}

        </View>
    )
}

export default ConversationDetail

const styles = StyleSheet.create({
})