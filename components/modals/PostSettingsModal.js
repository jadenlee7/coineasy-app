import React, { useState, useContext, useRef } from "react";
import { Keyboard, Text, View, ActivityIndicator, Image, TouchableOpacity, Animated, Dimensions, Platform, StyleSheet, TouchableHighlight } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import Modal from "../Modal";
import Button from "../Button";
import { sleep } from '../../utils';
import { GlobalContext } from "../../contexts/GlobalContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { showMessage } from "react-native-flash-message";
import { SuccessIcon } from "../Icons";
import { UserPfp } from "../User";

const list_report = [
    {label: 'It\'s spam'},
    {label: 'Nudity or sexual activity'},
    {label: 'Hate speech or symbols'},
    {label: 'Violence or dangerous'},
    {label: 'Bullying or harassment'},
    {label: 'Scam or fraud'},
    {label: 'False information'},
];

export default function PostSettingsModal() {    
    const { user, orbis, repost, setRepost, showPostbox, postboxVis, editedPost, setEditedPost, listBlockedUser, setListBlockedUser } = useContext(GlobalContext);

    const windowSize = Dimensions.get('window')

    const tailwind = useTailwind();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [checked, setChecked] = React.useState();

    const [showReportBack, setShowReportBack] = useState(false)
    const [showBlockBack, setShowBlockBack] = useState(false)

    const [blockModalVisible, setBlockModalVisible] = useState(false)
    const [blockLoader, setBlockLoader] = useState(false)

    const moveAnimation1 = useRef(new Animated.Value(0)).current;
    const moveAnimation2 = useRef(new Animated.Value(windowSize.width)).current;
    const moveAnimation3 = useRef(new Animated.Value(windowSize.width)).current;

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

    const showConfirmBlock = () => {
        Haptics.selectionAsync();
        setBlockModalVisible(true)
    }

    const blockUser = async () => {

        try {
            setBlockLoader(true)
    
            const userInfo = editedPost.value.creator_details.did
            let temp_list = listBlockedUser
            if(listBlockedUser && !listBlockedUser?.includes(userInfo)){
                temp_list.push(userInfo)
            }else{
                temp_list = [userInfo]
            }

            if(temp_list){
                setListBlockedUser([...temp_list])
                await AsyncStorage.setItem("list_blocked_user", JSON.stringify(temp_list));
            }

            setBlockModalVisible(false)
            setBlockLoader(false)
            hide()
    
            showMessage({
                message: editedPost.value.creator_details.profile.username+" is now blocked !",
                type: "success",
                floating: true,
                backgroundColor: "#3D3D3D",
                icon: () => <SuccessIcon style={{marginRight: 10,}}/>
            });
        } catch (error) {
            Alert(error)            
        }

    }

    const showBlock = () => {
        Haptics.selectionAsync();

        Animated.parallel([
            Animated.timing(moveAnimation1, {
                toValue: -windowSize.width,
                duration: 300,
                useNativeDriver: true
            }),
            Animated.timing(moveAnimation3, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true
            })
        ]).start();

        setShowBlockBack(true)
    }
    
    function onBackBlockPress() {
        Haptics.selectionAsync();

        Animated.parallel([
            Animated.timing(moveAnimation1, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true
            }),
            Animated.timing(moveAnimation3, {
                toValue: windowSize.width,
                duration: 300,
                useNativeDriver: true
            })
        ]).start(() => {
            setShowBlockBack(false)
            setSuccess(false);
        });
    }

    const showReport = () => {
        Haptics.selectionAsync();

        Animated.parallel([
            Animated.timing(moveAnimation1, {
                toValue: -windowSize.width,
                duration: 300,
                useNativeDriver: true
            }),
            Animated.timing(moveAnimation2, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true
            })
        ]).start();

        setShowReportBack(true)
    }
    
    function onBackReportPress() {
        Haptics.selectionAsync();

        Animated.parallel([
            Animated.timing(moveAnimation1, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true
            }),
            Animated.timing(moveAnimation2, {
                toValue: windowSize.width,
                duration: 300,
                useNativeDriver: true
            })
        ]).start(() => {
            setShowReportBack(false)
            setSuccess(false);
        });
    }

    function sendReport () {
        Haptics.selectionAsync();
        setLoading(true);

        setTimeout(() => {
            setLoading(false);

            hide();
            showMessage({
                message: "This post was reported !",
                type: "success",
                floating: true,
                backgroundColor: "#3D3D3D",
                icon: () => <SuccessIcon style={{marginRight: 10,}}/>
            });
        }, 3000)

    }

    /** We hide the repost modal if the postbox is also visible, (this means that the user is quote posting) */
    if(postboxVis) {
        return null;
    } else if(editedPost.type == 'notCreator'){
        return(
            <Modal hide={() => {hide();setSuccess(false);}} animateModal={true} bottomDuration={200} bottomStart={-100} type='postEdit'>
                <View 
                    style={[
                        tailwind('flex flex-col w-full'), 
                        {
                            height: 
                                showReportBack && Platform.OS == 'ios' ? 
                                    windowSize.height - 100 
                                : showReportBack ? 
                                    windowSize.height - 60 
                                : showBlockBack && Platform.OS == 'ios' ?
                                    windowSize.height - 400 
                                : showBlockBack ?
                                    windowSize.height - 250 

                                : 
                                    'auto'
                        }
                    ]}
                >
                    <Animated.View style={[tailwind('flex flex-col'), {transform: [{ translateX: moveAnimation1 }],marginTop: 30,marginBottom: 50,}]}>
                        <Button color="rounded-red-gray" title="Report Post" style={{marginBottom: 10, width: '90%', alignSelf: 'center',borderWidth: 1}} onPress={() => showReport()} />
                        <TouchableHighlight style={[tailwind('bg-slate-100 rounded-full py-4 px-8 flex-row items-center justify-center'), {marginBottom: 10, width: '90%', alignSelf: 'center',borderWidth: 1}]} onPress={() => showBlock()} underlayColor="#f8fafc">
                            <Text style={[tailwind('text-center'), { fontSize: 14, fontFamily: "GmarketBold", lineHeight: 18, color:'red' }]}>Block {editedPost.value.creator_details.profile.username}</Text>
                        </TouchableHighlight>
                        {/* <Button color="rounded-gray" title="Hide" style={{marginBottom: 10, width: '90%', alignSelf: 'center',borderWidth: 1}} onPress={() => openPrivacyPolicy()} />
                        <Button color="rounded-gray" title="Mute" style={{marginBottom: 10, width: '90%', alignSelf: 'center',borderWidth: 1}} onPress={() => openTerms()} /> */}
                    </Animated.View>

                    {showReportBack && (
                        <>
                            <TouchableOpacity onPress={() => {Haptics.selectionAsync();onBackReportPress()}} style={{position: 'absolute',left: 15, top: 15}}>
                                <Image
                                    style={{width: 25,height: 25}}
                                    resizeMode='contain'
                                    source={require('../../assets/back_button.png')}
                                    defaultSource={require('../../assets/back_button.png')}
                                />
                            </TouchableOpacity>
                            
                            <Animated.View style={{transform: [{ translateX: moveAnimation2 }],position: 'absolute',width: '90%',marginTop: 50,alignSelf: 'center',}}>
                                <UserPfp details={editedPost.value.creator_details} style={{alignSelf: 'center',marginTop: -30,}}/>

                                <Text style={{textAlign:'center',fontWeight: 'bold',fontSize: 19,marginTop: 10,}}>Why are you reposting this post ?</Text>
                                <Text style={{color: '#959595',textAlign:'center',margin: 15,fontSize: 12,}}>Your report is anonymous, except if you're reporting an intellectual property infringement</Text>
                                {list_report.map(e => {
                                    return(
                                        <TouchableOpacity 
                                            style={{backgroundColor: '#F6F6F6',borderRadius: 25,height: 50,marginTop: 10,flexDirection:'row', justifyContent: 'space-between',alignItems: 'center',}} 
                                            key={Math.random()}
                                            onPress={() => setChecked(e.label)}
                                        >
                                            <Text style={{fontWeight: 'bold',fontSize: 17,paddingLeft: 20}}>{e.label}</Text>

                                            <View style={{backgroundColor: 'white',width: 26,height: 26,borderWidth: 1,borderColor: '#999',borderRadius: 13,marginRight: 15, justifyContent: 'center',alignItems: 'center',}}>
                                                {checked == e.label && (
                                                    <View style={{backgroundColor: '#FF6E31',width: 24,height: 24,borderRadius: 13,justifyContent: 'center',alignItems: 'center',}}>
                                                        <View style={{backgroundColor: 'white',width: 10,height: 10,borderRadius: 5,}} />
                                                    </View>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    )
                                })}

                                
                                {loading ? (
                                    <View style={[tailwind('rounded-full py-4 px-8 flex-row items-center justify-center'), {alignSelf: 'center',width: '100%',backgroundColor: '#FF6E31',marginTop: 30,}]}>
                                        <ActivityIndicator size="small" color="#020617" />
                                    </View>
                                ) : checked ? (
                                    <Button color="orange" size='centered' onPress={() => sendReport()} title="Send" style={{marginBottom: 0, marginTop: 30,}} />
                                ) : (
                                    <Button color="disabled" title="Send" style={{marginBottom: 0, marginTop: 30,}} />
                                )}
                            </Animated.View>
                        </>
                    )}

                    {showBlockBack && (
                        <>
                            <TouchableOpacity onPress={() => {Haptics.selectionAsync();onBackBlockPress()}} style={{position: 'absolute',left: 15, top: 15}}>
                                <Image
                                    style={{width: 25,height: 25}}
                                    resizeMode='contain'
                                    source={require('../../assets/back_button.png')}
                                    defaultSource={require('../../assets/back_button.png')}
                                />
                            </TouchableOpacity>
                            
                            <Animated.View style={{transform: [{ translateX: moveAnimation3 }],position: 'absolute',width: '90%',marginTop: 50,alignSelf: 'center',}}>
                                <UserPfp details={editedPost.value.creator_details} style={{alignSelf: 'center',marginTop: -30,}}/>

                                <Text style={styles.modalText}>Block {editedPost.value.creator_details.profile.username} ?</Text>
                                <Text style={{marginTop: 10, color: '#959595', fontSize: 14,textAlign:'center'}}>
                                    This will also block any other account that you may create in the future.
                                </Text>
                                <Text style={{marginTop: 10,fontSize: 14,textAlign:'center'}}>
                                    They won’t be able to find your profile or content on CoinEasy App
                                </Text>
                                <Text style={{marginTop: 10,fontSize: 14,textAlign:'center'}}>
                                    They won’t be notified that you blocked them.
                                </Text>
                                <Text style={{marginTop: 10,fontSize: 14,textAlign:'center'}}>
                                    You can unblock them at any time in Settings.
                                </Text>

                                <View style={[tailwind('flex items-center mt-5 flex-col w-full')]}>
                                    {blockLoader ? (
                                        <View style={[tailwind('rounded-full py-4 items-center'), {height:50,alignSelf: 'center',width: '90%',backgroundColor: 'black',marginTop: 14,}]}>
                                            <ActivityIndicator size="small" color="white" />
                                        </View>
                                    ) : (
                                        <Button 
                                            size="md" 
                                            color="black" 
                                            title="Block" 
                                            onPress={blockUser} 
                                            style={{width: '90%',alignItems: 'center',height:50,justifyContent: 'center',marginTop: 14,}}
                                        />
                                    )}
                                    <Button size="md" color="white" title="Cancel" onPress={() => {Haptics.selectionAsync();onBackBlockPress()}} style={{width: '90%',alignItems: 'center',marginTop: 10,height: 50,justifyContent: 'center',}}/>
                                </View>
                            </Animated.View>
                        </>
                    )}
                </View>
            </Modal>
        )
    }else{
        return(
            <Modal hide={() => hide()} animateModal={true} bottomDuration={200} bottomStart={-100} type='postEdit'>
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
                                    source={require('../../assets/check-icon.png')} 
                                />
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

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalView: {
        width:'80%',
        height: 500,
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    button: {
        borderRadius: 20,
        padding: 10,
        elevation: 2,
    },
    buttonOpen: {
        backgroundColor: '#F194FF',
    },
    buttonClose: {
        backgroundColor: '#2196F3',
    },
    textStyle: {
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    modalText: {
        fontWeight: 'bold',
        fontSize: 18,
        textAlign:'center',
        marginTop: 10,
    },
  });