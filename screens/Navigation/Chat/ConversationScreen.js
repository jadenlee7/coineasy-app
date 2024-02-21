import React, { useContext, useState, useEffect } from "react";
import { View, ActivityIndicator, ScrollView, Text, TouchableHighlight, Dimensions, Image, TouchableOpacity, RefreshControl, Animated, TextInput, StyleSheet } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import TimeAgo from "../../../components/TimeAgo";
import User, { UserPfp, Username } from "../../../components/User";
import { GlobalContext } from "../../../contexts/GlobalContext";
import { CloseIcon, InterpunctIcon, SmallSearchIcon } from "../../../components/Icons";
import HeaderImage from "../../../components/HeaderImage";
import Modal from "../../../components/Modal";


const ConversationScreen = ({navigation, route}) => {
    const { orbis, user } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const [ conversations, setConversations ] = useState([]);
    const [ conversationsLoading, setConversationsLoading ] = useState(false);
    const [refreshing, setRefreshing] = useState(false)

    const [showSearchUser, setShowSearchUser] = useState(false)
    const [users, setUsers] = useState([])
    const [usersLoading, setUsersLoading] = useState(false)
    const [searchPhrase, setSearchPhrase] = useState("")

    /** Check if user has conversations */
    useEffect(() => {
        getConversations();

        /** Will load main post details */
        async function getConversations() {
            setConversationsLoading(true);
            const { data, error } = await orbis.getConversations({
                did: user.did
            });

            if(data.length > 0){

                const indexItem = data.findIndex(e => e.stream_id == 'kjzl6cwe1jw1473avjammp2bk485695fffrkdnwe78kcfs79de11a8o2cszizhy')
                data.splice(indexItem, 1)

                data.map(async (e, index) => {
                    const resultMessages = await orbis.getMessages(e.stream_id);
                    if(resultMessages.data.length > 0){
                        const decryptedMessage = await orbis.decryptMessage(resultMessages.data[resultMessages.data.length -1].content)
    
                        e.last_message = decryptedMessage.result
                        e.messages = resultMessages.data
    
                        if(index == data.length -1){
                            setConversations(data);
                            setConversationsLoading(false);
                        }
                    }else{
                        e.last_message = "Send your first message !"
                        e.messages = []

                        if(index == data.length -1){
                            setConversations(data);
                            setConversationsLoading(false);
                        }
                    }
                })
            }else{
                setConversationsLoading(false);
            }
        }
    }, []);

    const Conversation = ({conversation}) => {
        const tailwind = useTailwind();
      
        function selectConv() {
            Haptics.selectionAsync();
            navigation.navigate('ConversationDetails', {conversation})
        }

        return(
            <TouchableHighlight 
                style={tailwind("items-center flex flex-row border-b border-secondary py-3 px-6 ")} 
                underlayColor="#f1f5f9" onPress={() => selectConv()}
            >
                <>
                    <UserPfp details={conversation.recipients_details[0]} />
                    <View style={{marginLeft: 13}}>
                        <View style={tailwind("flex flex-row items-center mb-1")}>
                            <Text style={tailwind("text-secondary")}>
                                <Username details={conversation.recipients_details[0]} />
                            </Text>
                
                            <View style={[tailwind('ml-2 mr-2')]}>
                                <InterpunctIcon />
                            </View>
                
                            <Text style={[tailwind('text-secondary'), { marginRight: 6 }]}>
                                <TimeAgo timestamp={conversation.last_message_timestamp} />
                            </Text>
                        </View>
                        <Text style={tailwind("text-secondary")}>{conversation.last_message ? conversation.last_message : 'Error decrypting message.'}</Text>
                    </View>
                </>
            </TouchableHighlight>
        )
    }
    
    const ConversationAction = ({notification}) => {
        const tailwind = useTailwind();
        switch (notification.family) {
        case "reaction":
            return(
                <Text style={tailwind("text-secondary")}>Reacted to your post</Text>
            );
        case "reply_to":
            return(
                <Text style={tailwind("text-secondary")}>Replied to your post</Text>
            );
        }
    }

    async function updateConversations() {
        setRefreshing(true)
        const { data, error } = await orbis.getConversations({
            did: user.did
        });

        if(data) {
            setConversations(data);
        }

        setRefreshing(false)
    }


    async function searchUsers (term) {
        setUsersLoading(true);
        setSearchPhrase(term)

        const {data, error} = await orbis.getProfilesByUsername(term);

        setUsers(data);
        setUsersLoading(false);
    }

    const showConversation = async (client) => {
        const indexConversation = conversations.findIndex(e => e.content.recipients.includes(client.details.did))
        if(indexConversation != -1){
            navigation.navigate('ConversationDetails', {conversation: conversations[indexConversation]})
        }else{
            const options = {
                recipients: [client.details.did, user.did]
            }
            const res = await orbis.createConversation(options);
            navigation.navigate('ConversationDetails', {conversation: res.doc})
        }
    } 

    return(
        <View style={[tailwind('flex flex-1 flex-col'),{backgroundColor: 'white',}]}>
            <HeaderImage />

            <View style={{backgroundColor: 'white',flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',paddingLeft: 5,paddingRight: 20,paddingTop: 4}}>
                <TouchableOpacity style={{margin: 15,}} onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                    <Image
                        style={{width: 24,height: 24}}
                        resizeMode='contain'
                        source={require('../../../assets/back_button.png')}
                        defaultSource={require('../../../assets/back_button.png')}
                    />
                </TouchableOpacity>
            </View>

            {conversationsLoading ?
                <ActivityIndicator style={{marginTop: 50}} size="small" color="#020617" />
            : conversations && conversations.length > 0 ?
                <ScrollView
                    refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={updateConversations} /> }
                >
                    {conversations.map((conversation, key) => {
                        return (
                            <Conversation conversation={conversation} key={key} />
                        );
                    })}
                </ScrollView>
            :
                <View style={tailwind('bg-slate-50 px-2 py-4 items-center mt-4 mx-6 rounded-md')} >
                    <Text style={tailwind('text-secondary items-center ml-1')}>You don't have any conversation.</Text>
                </View>
            }


            {/** Add Conversation button */}
            <TouchableOpacity activeOpacity="0.8" style={[tailwind('absolute'), {elevation: 10, bottom: 20, right: 20} ]} onPress={() => {Haptics.selectionAsync();setShowSearchUser(true)}}>
                <Image
                    style={{ height: 50, width: 50 }}
                    source={require('../../../assets/addUser_icon.png')} 
                />
            </TouchableOpacity>

            {showSearchUser && (
                <Modal hide={() => {Haptics.selectionAsync();setShowSearchUser(false)}} animateModal={true} bottomDuration={200} bottomStart={-100} type='post'>
                    <View style={{
                            height:90,
                            width: Dimensions.get('window').width,
                            borderBottomWidth : 1,
                            borderBottomColor: '#DCDCDC',
                        }}
                    >
                        <View style={[styles.container, {justifyContent: 'center',borderWidth: 1, borderColor: '#DCDCDC',height: 60, borderRadius: 10}]}>

                                <SmallSearchIcon color={"#959595"} style={{marginLeft: 8,}}/>

                                <TextInput
                                    style={styles.input}
                                    placeholder="Search"
                                    placeholderTextColor="#959595" 
                                    value={searchPhrase}
                                    onChangeText={new_term => searchUsers(new_term)}
                                    // onFocus={() => setClicked(true)}
                                />

                                {searchPhrase != '' && (
                                    <TouchableOpacity onPress={() => setSearchPhrase("")} style={{position: 'absolute',right: 10}}>
                                        <CloseIcon />
                                    </TouchableOpacity>
                                )}
                        </View>
                    </View>

                    {searchPhrase != '' && usersLoading ? (
                        <View style={{backgroundColor: 'white',height: Dimensions.get('window').height, marginTop: 30,}}>
                            <ActivityIndicator size="small" color="#FF6B17" />
                        </View>
                    ) : searchPhrase != ''  ? (
                        <ScrollView keyboardShouldPersistTaps='handled' style={{backgroundColor: 'white',height: Dimensions.get('window').height}}>
                            {/** Loop through users */}
                            {users.map((_user, key) => {
                                return (
                                    <TouchableOpacity 
                                        style={tailwind("p-2 px-4")} 
                                        activeOpacity={0.6} 
                                        onPress={() => showConversation(_user)}
                                        key={key}
                                    >
                                        <User details={_user.details} isFollow={false}/>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    ) : (
                        <View style={{marginTop: 30,}}>
                            <Text style={[tailwind('text-secondary'), {textAlign:'center'}]}>Search a user to start a conversation</Text>
                        </View>
                    )}
                </Modal>
            )}
        </View>
    )
}

export default ConversationScreen


const styles = StyleSheet.create({
    container: {
        margin: 20,
        alignSelf: 'center',
        alignItems: "center",
        flexDirection: "row",
        width: "95%",
    },
    input: {
        fontSize: 17,
        marginLeft: 10,
        width: "90%",
    },
})