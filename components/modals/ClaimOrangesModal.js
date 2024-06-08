import React, { useContext, useState } from 'react'
import { Alert, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import moment from 'moment';
import Modal from '../Modal';
import Button from '../Button';
import { GlobalContext } from '../../contexts/GlobalContext';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import { AntDesign } from '@expo/vector-icons';
import { CountdownCircleTimer } from 'react-native-countdown-circle-timer';


const ClaimOrangesModal = () => {

    const { user, setUser, orbis, setShowClaimOranges, todayOranges } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const [showAds, setShowAds] = useState(false)
    const [completeAds, setCompleteAds] = useState(false)
    const [showClose, setShowClose] = useState(false)

    const onAdCompleted = async () => {
        Haptics.selectionAsync();
        let tempOranges = user?.profile?.data?.oranges?.count ?? 0
        tempOranges += todayOranges

        if(user.profile.data){
            user.profile.data.oranges = {
                count: tempOranges,
                updated: moment().format('YYYY-MM-DD')
            }
        }else{
            user.profile.data = {
                oranges: {
                    count: tempOranges,
                    updated: moment().format('YYYY-MM-DD')
                }
            }
        }
        setUser({...user})

        const res = await orbis.updateProfile(user.profile);

        setCompleteAds(true)
        setShowAds(false)
        setShowClose(false)
    }


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

        if(showAds && showClose){
            onAdCompleted()
        }

        setShowAds(false)
        setCompleteAds(false)
        setShowClose(false)
        setShowClaimOranges(false)
    }

    return (
        <Modal 
            hide={onHideModal} 
            type='oranges' 
            isAds={showAds}
        >
            {!showAds && !completeAds ? (
                <>
                    <View style={[tailwind('flex flex-col items-center justify-center px-3')]}>
                        <Text style={[tailwind(`text-center`), {color: "#000000",fontSize: 18,fontFamily: "GmarketBold",lineHeight: 24,marginTop: 20,}]}>
                            You've got {todayOranges} Oranges!
                        </Text>

                        <Image 
                            source={require('../../assets/orange_box.png')} 
                            style={{height: '55%',alignSelf: 'center',marginTop: 40,}} 
                            resizeMode="contain"
                        />

                    </View>

                    <Button 
                        size="md" 
                        color="white" 
                        title="Claim" 
                        onPress={() => {Haptics.selectionAsync();setShowAds(true)}} 
                        style={{width: '85%',alignItems: 'center',alignSelf:'center', height: 50,justifyContent: 'center',position: 'absolute',bottom: 20}}
                    />
                </>
            ) : showAds ? (
                <TouchableOpacity 
                    style={[tailwind('flex flex-col items-center justify-center px-3')]}
                    onPress={openUrl}
                >

                    <Text style={{position: 'absolute',top: 25, left: 20, color: 'white', fontSize: 15,fontFamily: 'GmarketMedium'}}>Click!</Text>
                    <View style={{position: 'absolute',top: 10, right: 10}}>

                        {showClose ? (
                            <TouchableOpacity
                                style={{position: 'absolute',top: 10, right: 5}}
                                onPress={onAdCompleted}
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
            ) : completeAds && (
                <>
                    <View style={[tailwind('flex flex-col items-center justify-center px-3')]}>
                        <Text style={[tailwind(`text-center`), {color: "#000000",fontSize: 18,fontFamily: "GmarketBold",lineHeight: 24,marginTop: 20,}]}>
                            Now you have Oranges!
                        </Text>

                        <Image 
                            source={require('../../assets/orange_box.png')} 
                            style={{height: '55%',alignSelf: 'center',marginTop: 40,}} 
                            resizeMode="contain"
                        />
                    </View>

                    <Button 
                        size="md" 
                        color="white" 
                        title="Go to profile" 
                        onPress={() => {Haptics.selectionAsync();setShowAds(false);setCompleteAds(false);setShowClose(false);setShowClaimOranges(false)}} 
                        style={{width: '85%',alignItems: 'center',alignSelf:'center', height: 50,justifyContent: 'center',position: 'absolute',bottom: 20}}
                    />
                </>
            )}
        </Modal>
    )
}

export default ClaimOrangesModal

const styles = StyleSheet.create({})