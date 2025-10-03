import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Dimensions, Easing, Image, ImageBackground, Modal, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { ScrollView } from 'react-native-gesture-handler';


import HeaderImage from '../../components/HeaderImage';
import { GlobalContext } from '../../contexts/GlobalContext';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import { TabBar, TabView } from 'react-native-tab-view';
import useStatusBarHeight from '../../hooks/useStatusBarHeight';
import OrangeReward from './Oranges/OrangeReward';
import ShopScreen from './Oranges/ShopScreen';
import GiftScreen from './Oranges/GiftScreen';
import moment from 'moment';
import ClaimOrangesModal from '../../components/modals/ClaimOrangesModal';
import Header from '../../components/Header';


const TabBarHeight = 50;
const IndicatorWidth = 50

const windowSize = Dimensions.get('window')

const OrangeNavigation = ({navigation, route}) => {
    const { 
        orbis,
        user,
        userData,
        setUserData,
        tabViewHeight,
        showClaimOranges
    } = useContext(GlobalContext);
    const tailwind = useTailwind();      
    const statusBarHeight = useStatusBarHeight();

    const showBack = route.params?.back
    
    const [openDailyCheckinModal, setOpenDailyCheckinModal] = useState(false)
    const [openDailyActivityModal, setOpenDailyActivityModal] = useState(false)

    const [tabIndex, setIndex] = useState(0);
    const routes = [
        {key:0, title: 'Reward'},
        {key:1, title: 'Shop'},
        {key:2, title: 'Gift'},
    ];
    
    const renderLabel = ({route, focused}) => { 
        return ( 
            <Text style={[styles.label, {opacity: focused ? 1 : 0.5}]}>{route.title}</Text>
        );
    };

    const onClaimDailyCheckin = async () => {
        Haptics.selectionAsync();
        const tempData = userData ?? {}
        
        if(tempData){
            let addNumber = 20
            tempData.numberOranges ? tempData.numberOranges += addNumber : tempData.numberOranges = addNumber

            if(tempData.listClaimedOranges){
                const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
                if(index != -1){
                    tempData.listClaimedOranges[index].listOranges.push({
                        numberOranges: addNumber,
                        type: 'Check-in reward'
                    })
                }else{
                    tempData.listClaimedOranges.push({
                        date: moment().format('YYYY-MM-DD'),
                        listOranges: [
                            {
                                numberOranges: addNumber,
                                type: 'Check-in reward'
                            },
                        ]
                    })
                }
            }else{
                tempData.listClaimedOranges = [{
                    date: moment().format('YYYY-MM-DD'),
                    listOranges: [
                            {
                                numberOranges: addNumber,
                                type: 'Check-in reward'
                            },
                    ]
                }]
            }

            const now = new Date();
            const tomorrow = new Date();
            tomorrow.setHours(24, 0, 0, 0); // reset to midnight

            var currentData = {
                ...tempData,
                dailyCheckin: {
                    lastClaim: now.toISOString(),
                    nextAvailable: tomorrow.toISOString(),
                },
            }

            var tempProfile = user.profile
            tempProfile.data = currentData
            orbis.updateProfile(tempProfile)
            .then(res => {
                setOpenDailyCheckinModal(true)

                setUserData({
                    ...tempData,
                    dailyCheckin: {
                        lastClaim: now.toISOString(),
                        nextAvailable: tomorrow.toISOString(),
                    },
                });
            })
        }
        
    }

    const handleClaimDailyActivity = async () => {
        Haptics.selectionAsync();
        const tempData = userData ?? {}
        
        if(tempData){
            let addNumber = 30
            tempData.numberOranges ? tempData.numberOranges += addNumber : tempData.numberOranges = addNumber

            if(tempData.listClaimedOranges){
                const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
                if(index != -1){
                    tempData.listClaimedOranges[index].listOranges.push({
                        numberOranges: addNumber,
                        type: 'Complete daily task'
                    })
                }else{
                    tempData.listClaimedOranges.push({
                        date: moment().format('YYYY-MM-DD'),
                        listOranges: [
                            {
                                numberOranges: addNumber,
                                type: 'Complete daily task'
                            },
                        ]
                    })
                }
            }else{
                tempData.listClaimedOranges = [{
                    date: moment().format('YYYY-MM-DD'),
                    listOranges: [
                            {
                                numberOranges: addNumber,
                                type: 'Complete daily task'
                            },
                    ]
                }]
            }

            const now = new Date();
            const tomorrow = new Date();
            tomorrow.setHours(24, 0, 0, 0); // reset to midnight

            var currentData = {
                ...tempData,
                dailyActivity: {
                    lastClaim: now.toISOString(),
                    nextAvailable: tomorrow.toISOString(),
                },
            }

            var tempProfile = user.profile
            tempProfile.data = currentData
            orbis.updateProfile(tempProfile)
            .then(res => {
                setOpenDailyActivityModal(true)

                setUserData({
                    ...tempData,
                    dailyActivity: {
                        lastClaim: now.toISOString(),
                        nextAvailable: tomorrow.toISOString(),
                    },
                });
            })
        }
        
    }

    const getNextSlotDate = () => {
        const now = new Date();
        const next = new Date(now);

        const currentHour = now.getHours();

        if (currentHour < 8) {
            next.setHours(8, 0, 0, 0);     // Prochain = 08h
        } else if (currentHour < 16) {
            next.setHours(16, 0, 0, 0);    // Prochain = 16h
        } else {
            next.setDate(next.getDate() + 1);
            next.setHours(0, 0, 0, 0);     // Prochain = minuit
        }

        return next;
    };

    const getCurrentSlot = () => {
        const hour = new Date().getHours();
        if (hour < 8) return "slot_0_8";
        if (hour < 16) return "slot_8_16";
        return "slot_16_0";
    };

    const onClaimAdReward = async () => {
        Haptics.selectionAsync();
        const tempData = userData ?? {}
        const currentSlot = getCurrentSlot();
        const nextReset = getNextSlotDate();

        let claims = tempData?.adReward?.claims ?? {};
        
        if(tempData){
            let addNumber = 10
            tempData.numberOranges ? tempData.numberOranges += addNumber : tempData.numberOranges = addNumber

            if(tempData.listClaimedOranges){
                const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
                if(index != -1){
                    tempData.listClaimedOranges[index].listOranges.push({
                        numberOranges: addNumber,
                        type: 'Watch AD'
                    })
                }else{
                    tempData.listClaimedOranges.push({
                        date: moment().format('YYYY-MM-DD'),
                        listOranges: [
                            {
                                numberOranges: addNumber,
                                type: 'Watch AD'
                            },
                        ]
                    })
                }
            }else{
                tempData.listClaimedOranges = [{
                    date: moment().format('YYYY-MM-DD'),
                    listOranges: [
                            {
                                numberOranges: addNumber,
                                type: 'Watch AD'
                            },
                    ]
                }]
            }

            const updatedReward = {
                claims: { ...claims, [currentSlot]: true },
                nextReset: nextReset.toISOString(),
            };

            setUserData({
                ...tempData,
                adReward: updatedReward,
            });

            const tempProfile = user.profile;
            tempProfile.data = { ...tempData, adReward: updatedReward };

            await orbis.updateProfile(tempProfile);
        }
        
    }

    const renderScene = ({route}) => {
        if(route.key == 0 ) return (
            <ScrollView>
                <OrangeReward 
                    onClaimDailyCheckin={onClaimDailyCheckin}
                    handleClaimDailyActivity={handleClaimDailyActivity}
                />
            </ScrollView>
        )
        if(route.key == 1 ) return (
            <ScrollView>
                <ShopScreen goToGift={() => setIndex(2)}/>
            </ScrollView>
        )
        if(route.key == 2 ) return (
            <ScrollView>
                <GiftScreen />
            </ScrollView>
        )
    }
 
    const renderTabBar = (props) => {
        return (
            <TabBar
                {...props}
                style={styles.tab}
                renderLabel={renderLabel}
                indicatorStyle={[styles.indicator, { width: IndicatorWidth, left: (windowSize.width / 3 - IndicatorWidth) / 2 }]}
            />
        );
    };

    return (
        <View style={[tailwind('flex flex-1')]}>
            <Header />

            {showBack && (
                <TouchableOpacity style={{position: 'absolute',left: 20, top: Platform.OS == 'ios' && statusBarHeight > 25 ? 70 : Platform.OS == 'ios' ? 80 : statusBarHeight > 25 ? 55 : 60}} onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                    <Image
                        style={{width: 24,height: 24}}
                        resizeMode='contain'
                        source={require('../../assets/back_button.png')}
                        defaultSource={require('../../assets/back_button.png')}
                    />
                </TouchableOpacity>
            )}

            {/* <TouchableOpacity 
                onPress={() => {Haptics.selectionAsync();navigation.navigate('OrangeNavigation')}}
                style={{
                    position: 'absolute',
                    top: Platform.OS == 'ios' && statusBarHeight > 25 ? 70 : Platform.OS == 'ios' ? 80 : statusBarHeight > 25 ? 50 : 60,
                    right: 10,
                    borderRadius: 30,
                    backgroundColor: '#FFF2E2',
                    flexDirection:'row',
                    gap: 6,
                    alignSelf:'flex-end',
                    marginRight: 5,
                    paddingVertical: 5,
                    paddingHorizontal:10,
                    alignItems:'center',
                    justifyContent:'center'
                }}
            >
                <Image
                    style={{width: 15, height: 15}}
                    resizeMode='contain'
                    source={require('../../assets/trophy/trophy_icon_orange.png')}
                />
                <Text style={{fontWeight: 'bold',textAlign: 'center',color:'#FB5100'}}>
                    {userData?.numberOranges && userData?.numberOranges.toString().length <= 3 ? userData?.numberOranges
                        : userData?.numberOranges && userData?.numberOranges.toString().length == 4 ? userData?.numberOranges.toString().slice(0,1)+','+userData?.numberOranges.toString().slice(1,4)
                        : userData?.numberOranges && userData?.numberOranges.toString().length == 5 ? userData?.numberOranges.toString().slice(0,2)+','+userData?.numberOranges.toString().slice(2,5)
                        : userData?.numberOranges && userData?.numberOranges.toString().length == 6 ? userData?.numberOranges.toString().slice(0,3)+','+userData?.numberOranges.toString().slice(3,6)
                        : userData?.numberOranges && userData?.numberOranges.toString().length == 7 ? userData?.numberOranges.toString().slice(0,1)+','+userData?.numberOranges.toString().slice(1,4)+','+userData?.numberOranges.toString().slice(4,7)
                        : userData?.numberOranges && userData?.numberOranges.toString().length == 8 ? userData?.numberOranges.toString().slice(0,2)+','+userData?.numberOranges.toString().slice(2,5)+','+userData?.numberOranges.toString().slice(5,8)
                        : userData?.numberOranges && userData?.numberOranges.toString().length == 9 ? userData?.numberOranges.toString().slice(0,3)+','+userData?.numberOranges.toString().slice(3,6)+','+userData?.numberOranges.toString().slice(6,9)
                        : 0
                    }
                </Text>
            </TouchableOpacity> */}


            <View style={[tailwind('flex flex-1 flex-col'),{backgroundColor: 'white',marginTop: statusBarHeight > 25 ? 65 + statusBarHeight : 80 + statusBarHeight}]}>
                <TabView
                    navigationState={{index: tabIndex, routes}}
                    renderScene={renderScene}
                    renderTabBar={renderTabBar}
                    onIndexChange={setIndex}
                    initialLayout={{width: windowSize.width}}
                    style={{height: tabViewHeight,}}
                />
            </View>

            <Modal 
                animationType="slide"
                transparent={true}
                visible={openDailyCheckinModal || openDailyActivityModal}
                onRequestClose={() => {setOpenDailyCheckinModal(false);setOpenDailyActivityModal(false)}}
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
                            <Text style={{fontFamily:'GmarketMedium',marginTop: 10,fontSize: 18,}}>{openDailyCheckinModal ? "+20" : "+30"}</Text>
                        </View>

                        <TouchableOpacity
                            style={{backgroundColor: '#FF6B35', width:'90%', height: 50, borderRadius: 25,justifyContent:'center',alignItems:'center',}}
                            onPress={() => {setOpenDailyCheckinModal(false);setOpenDailyActivityModal(false)}}
                        >
                            <Text style={{color:'white',fontSize: Platform.OS == 'ios' ? 17 : 15,fontFamily:'GmarketBold'}}>GOOD</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/** Display claim oranges pane */}
            {showClaimOranges &&
                <ClaimOrangesModal 
                    onClaimAdReward={onClaimAdReward}
                />
            }
        </View>
    )
}

export default OrangeNavigation

const styles = StyleSheet.create({
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 5,
    },
    tab: {
        elevation: 0,
        shadowOpacity: 0,
        backgroundColor: 'white',
        height: TabBarHeight,
        borderBottomWidth: 1,
        borderBottomColor: '#ebebeb'
    },
    indicator: {
        height: 4, 
        borderRadius: 10,
        width: '20%',
        backgroundColor: '#FF6B17',
    },
})