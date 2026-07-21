import React, { useCallback, useContext, useEffect, useState } from 'react'
import { Alert, Dimensions, Image, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { ScrollView } from 'react-native-gesture-handler';


import { GlobalContext } from '../../contexts/GlobalContext';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import { TabBar, TabView } from 'react-native-tab-view';
import useStatusBarHeight from '../../hooks/useStatusBarHeight';
import OrangeReward from './Oranges/OrangeReward';
import ShopScreen from './Oranges/ShopScreen';
import GiftScreen from './Oranges/GiftScreen';
import ClaimOrangesModal from '../../components/modals/ClaimOrangesModal';
import Header from '../../components/Header';
import { api, ApiError } from '../../utils/api';
import { useOrange } from '../../hooks/useOrange';


const TabBarHeight = 50;
const IndicatorWidth = 50

const windowSize = Dimensions.get('window')

const OrangeNavigation = ({navigation, route}) => {
    const { 
        user,
        userData,
        setUserData,
        tabViewHeight,
        showClaimOranges,
        newGiftsCount, setNewGiftsCount
    } = useContext(GlobalContext);
    const tailwind = useTailwind();      
    const statusBarHeight = useStatusBarHeight();

    const showBack = route.params?.back
    const { balance, history, ready: orangeReady, refresh: refreshOrange } = useOrange(user?.id);
    
    const [openDailyCheckinModal, setOpenDailyCheckinModal] = useState(false)
    const [openDailyActivityModal, setOpenDailyActivityModal] = useState(false)

    const [tabIndex, setIndex] = useState(0);
    const routes = [
        {key:0, title: 'Reward'},
        {key:1, title: 'Shop'},
        {key:2, title: 'Gift'},
    ];

    
    const renderLabel = ({route, focused}) => { 
        const showDot = route.title === 'Gift' && newGiftsCount;

        return ( 
            // <Text style={[styles.label, {opacity: focused ? 1 : 0.5}]}>{route.title}</Text>
            <View style={{alignItems: 'center', justifyContent: 'center'}}>
                <Text style={[styles.label, {opacity: focused ? 1 : 0.5}]}>
                    {route.title}
                </Text>
                {showDot && (
                    <View style={styles.orangeDot} />
                )}
            </View>

        );
    };

    const rewardTypeLabel = useCallback((reason) => ({
        DAILY_CHECKIN: 'Check-in reward',
        DAILY_ACTIVITY: 'Daily activity reward',
        AD_REWARD: 'AD reward',
        COURSE_QUIZ: 'Quiz completed',
        FIRST_REWARD: 'First reward bonus',
        WELCOME: 'Welcome bonus',
        SWAP: 'Swap reward',
    }[reason] || reason.replaceAll('_', ' ')), []);

    const groupedHistory = useCallback((rows) => {
        const grouped = new Map();
        rows.forEach((row) => {
            const date = new Date(row.createdAt).toISOString().slice(0, 10);
            if (!grouped.has(date)) grouped.set(date, []);
            grouped.get(date).push({
                numberOranges: row.delta,
                type: rewardTypeLabel(row.reason),
            });
        });
        return [...grouped.entries()].map(([date, listOranges]) => ({ date, listOranges }));
    }, [rewardTypeLabel]);

    useEffect(() => {
        if (!orangeReady) return;
        setUserData((current) => ({
            ...(current || {}),
            numberOranges: balance,
            listClaimedOranges: groupedHistory(history),
        }));
    }, [balance, groupedHistory, history, orangeReady, setUserData]);

    const loadRewardStatus = useCallback(async () => {
        try {
            const status = await api.orangeRewardStatus();
            if (!status) return;
            setUserData((current) => ({
                ...(current || {}),
                numberOranges: status.balance,
                todayActivities: status.todayActivities,
                dailyCheckin: status.dailyCheckin,
                dailyActivity: status.dailyActivity,
                adReward: { nextReset: status.adReward?.nextAvailable || null },
            }));
        } catch (error) {
            console.warn('[orange] unable to load reward status', error);
        }
    }, [setUserData]);

    useEffect(() => {
        if (user?.id) loadRewardStatus();
    }, [loadRewardStatus, user?.id]);

    const syncClaim = useCallback(async (claim, stateKey) => {
        const result = await claim();
        if (!result) {
            Alert.alert('Backend not connected', 'Set EXPO_PUBLIC_BACKEND_URL to claim Orange rewards.');
            return null;
        }
        setUserData((current) => ({
            ...(current || {}),
            numberOranges: result.balance,
            ...(stateKey ? {
                [stateKey]: stateKey === 'adReward'
                    ? { nextReset: result.nextAvailable }
                    : { claimed: true, nextAvailable: result.nextAvailable },
            } : {}),
        }));
        await Promise.all([refreshOrange(), loadRewardStatus()]);
        return result;
    }, [loadRewardStatus, refreshOrange, setUserData]);

    const onClaimDailyCheckin = async () => {
        Haptics.selectionAsync();
        try {
            const result = await syncClaim(api.orangeClaimDailyCheckin, 'dailyCheckin');
            if (result?.claimed) setOpenDailyCheckinModal(true);
            else if (result) Alert.alert('Already claimed', 'Daily check-in will reset at the next UTC day.');
        } catch (error) {
            Alert.alert('Claim failed', 'Please try again in a moment.');
        }
    };

    const handleClaimDailyActivity = async () => {
        Haptics.selectionAsync();
        try {
            const result = await syncClaim(api.orangeClaimDailyActivity, 'dailyActivity');
            if (result?.claimed) setOpenDailyActivityModal(true);
            else if (result) Alert.alert('Already claimed', 'The daily activity reward has already been collected.');
        } catch (error) {
            if (error instanceof ApiError && error.status === 409) {
                const progress = error.body?.progress || {};
                const targets = error.body?.targets || {};
                setUserData((current) => ({ ...(current || {}), todayActivities: progress }));
                Alert.alert(
                    'Tasks not complete',
                    `Post ${progress.posts || 0}/${targets.posts || 1} · Comments ${progress.comments || 0}/${targets.comments || 2} · Likes ${progress.likes || 0}/${targets.likes || 10}`,
                );
                return;
            }
            Alert.alert('Claim failed', 'Please try again in a moment.');
        }
    };

    const onClaimAdReward = async () => {
        Haptics.selectionAsync();
        try {
            const result = await syncClaim(api.orangeClaimAdReward, 'adReward');
            if (!result?.claimed && result) {
                Alert.alert('Already claimed', 'The next ad reward will unlock in the next reward slot.');
            }
            return Boolean(result?.claimed);
        } catch (error) {
            Alert.alert('Claim failed', 'Please try again in a moment.');
            return false;
        }
    };


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
                <ShopScreen />
            </ScrollView>
        )
        if(route.key == 2 ) return (
            <ScrollView>
                <GiftScreen goToShop={() => setIndex(1)}/>
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

    const onIndexChange = (index) => {
        setIndex(index);

        // Si l'utilisateur ouvre Gift (route key = 2)
        if (routes[index].key == 2) {
            setNewGiftsCount(false);
        }
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

            <View style={[tailwind('flex flex-1 flex-col'),{backgroundColor: 'white',marginTop: statusBarHeight > 25 ? 65 + statusBarHeight : 80 + statusBarHeight}]}>
                <TabView
                    navigationState={{index: tabIndex, routes}}
                    renderScene={renderScene}
                    renderTabBar={renderTabBar}
                    onIndexChange={onIndexChange}
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
    orangeDot: {
        position: 'absolute',
        top: 2,
        right: -8,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF6B17',
    },
})
