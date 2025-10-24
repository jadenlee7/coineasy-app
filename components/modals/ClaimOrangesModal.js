import React, { useContext, useEffect, useState } from 'react'
import { Alert, Animated, Dimensions, Easing, Image, Linking, StyleSheet, Text, TouchableOpacity, View, Modal as RNModal } from 'react-native'

import Modal from '../Modal';
import Button from '../Button';
import { GlobalContext } from '../../contexts/GlobalContext';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import { AntDesign } from '@expo/vector-icons';
import { CountdownCircleTimer } from 'react-native-countdown-circle-timer';
import { useNavigation } from '@react-navigation/core';

const ClaimOrangesModal = (props) => {

    const { setShowClaimOranges, adAlreadyClaimed } = useContext(GlobalContext);
    const { onClaimAdReward } = props
    const tailwind = useTailwind();
    let navigation;
    try {
        navigation = useNavigation()
    } catch (error) {
        console.log(error);
    }
    
    const [showAds, setShowAds] = useState(!adAlreadyClaimed)
    const [completeAds, setCompleteAds] = useState(false)
    const [showClose, setShowClose] = useState(false)

    const openUrl = async () => {
        let url = 'https://youtu.be/EPLZlxe07Eg'
        const supported = await Linking.canOpenURL(url);

        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert(`Don't know how to open this URL: ${url}`);
        }
    }

    const onHideModal = async () => {
        Haptics.selectionAsync()

        setShowClaimOranges(false);
        setShowAds(false);
        setCompleteAds(false);
        setShowClose(false);
    }

    return (
        <>
            {completeAds ? (
                <RNModal 
                    animationType="slide"
                    transparent={true}
                    visible={completeAds}
                    onRequestClose={() => onHideModal()}
                >
                    <View style={{flex: 1, justifyContent:'center',alignItems:'center',backgroundColor: "rgba(0,0,0,0.5)",}}>
                        <View style={{    
                            width:'90%',
                            backgroundColor: 'white',
                            borderRadius: 20,
                            paddingVertical: 35,
                            alignItems: 'center',
                            shadowColor: '#000',
                            shadowOffset: {
                                width: 0,
                                height: 2,
                            },
                            shadowOpacity: 0.25,
                            shadowRadius: 4,
                            elevation: 5,
                        }}>
                            <Text style={{fontFamily:'GmarketBold', textAlign:'center',}}>Orange Collected!</Text>
    
                            <View style={{alignItems:'center',padding: 20}}>
                                <Image
                                    style={{width: 60,height: 60,}}
                                    resizeMode='contain'
                                    source={require('../../assets/trophy/reward/daily_check_in_orange.png')}
                                    defaultSource={require('../../assets/trophy/reward/daily_check_in_orange.png')}
                                />  
                                <Text style={{fontFamily:'GmarketMedium',marginTop: 10,fontSize: 18,}}>+10</Text>
                            </View>
    
                            <TouchableOpacity
                                style={{backgroundColor: '#FF6B35', width:'90%', height: 50, borderRadius: 25,justifyContent:'center',alignItems:'center',}}
                                onPress={() => onHideModal()}
                            >
                                <Text style={{color:'white',fontSize: Platform.OS == 'ios' ? 17 : 15,fontFamily:'GmarketBold'}}>GOOD</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </RNModal>
            ) : (
                <Modal 
                    hide={() => onHideModal()} 
                    type='oranges' 
                    isAds={showAds}
                >
                    { adAlreadyClaimed ? (
                        <>
                            <TouchableOpacity
                                style={{position: 'absolute',top: 15, right: 15, zIndex: 999999999}}
                                onPress={() => {Haptics.selectionAsync();setShowClaimOranges(false)}}
                            >
                                <AntDesign name="closecircle" size={24} color="black" />
                            </TouchableOpacity>

                            <View style={[tailwind('flex flex-col items-center justify-center px-3')]}>
                                <Text style={[tailwind(`text-center`), {color: "#000000",fontSize: 16,fontFamily: "GmarketBold",lineHeight: 24,marginTop: 20,}]}>
                                    Oops, this basket is empty!
                                </Text>

                                <Text style={{textAlign: 'center',}}>You've already claimed :)</Text>

                                <Image 
                                    source={require('../../assets/orange_box.png')} 
                                    style={{height: '60%',alignSelf: 'center',marginTop: 20,}} 
                                    resizeMode="contain"
                                />
                            </View>

                            <Button 
                                size="md" 
                                color="white" 
                                title="GOOD" 
                                onPress={() => {Haptics.selectionAsync();setShowClaimOranges(false);}} 
                                style={{width: '85%',alignItems: 'center',alignSelf:'center', height: 50,justifyContent: 'center',position: 'absolute',bottom: 20}}
                            />
                        </>
                    ) : showAds && (
                        <TouchableOpacity 
                            style={[tailwind('flex flex-col items-center justify-center px-3')]}
                            onPress={openUrl}
                        >
                            <Text style={{position: 'absolute',top: 25, left: 20, color: 'white', fontSize: 15,fontFamily: 'GmarketMedium'}}>Click!</Text>
                            <View style={{position: 'absolute',top: 10, right: 10}}>
                                {showClose ? (
                                    <TouchableOpacity
                                        style={{position: 'absolute',top: 10, right: 5}}
                                        onPress={() => {Haptics.selectionAsync();setShowAds(false);onClaimAdReward();setCompleteAds(true)}}
                                    >
                                        <AntDesign name="closecircle" size={24} color="white" />
                                    </TouchableOpacity>
                                ) : (
                                    <CountdownCircleTimer
                                        isPlaying
                                        duration={10}
                                        colors={['#fff',]}
                                        onComplete={() => setShowClose(true)}
                                        size={35}
                                        strokeWidth={3}
                                        trailColor="rgba(0,0,0,0)"
                                    >
                                        {({ remainingTime }) => <Text style={{color:'#fff'}}>{remainingTime}</Text>}
                                    </CountdownCircleTimer>
                                )}
                            </View>
                        </TouchableOpacity>
                    )}
                </Modal>
            )}
        </>
    )
}

export default ClaimOrangesModal

const styles = StyleSheet.create({
    boxContainer: {
        zIndex: 2,
        alignSelf:'center',
        // top: 20, 
        // left: 20,
    },
    box: {
        marginTop: 0,
        backgroundColor: 'rgba(0,0,0,0)',
    },
})