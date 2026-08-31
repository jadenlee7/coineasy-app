import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Alert, Image, Modal, Platform, Text, TouchableOpacity, View } from 'react-native'

import { GlobalContext } from '../../contexts/GlobalContext';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import useStatusBarHeight from '../../hooks/useStatusBarHeight';
import OrangeReward from './Oranges/OrangeReward';
import Header from '../../components/Header';
import { api } from '../../utils/api';
import { useOrange } from '../../hooks/useOrange';
import { useDeviceAccountOperationLease } from '../../contexts/DeviceAccountDataContext';


const OrangeNavigation = ({navigation, route}) => {
    const { 
        user,
        setUserData,
    } = useContext(GlobalContext);
    const { lease, isCurrentLease } = useDeviceAccountOperationLease();
    const tailwind = useTailwind();      
    const statusBarHeight = useStatusBarHeight();

    const showBack = route.params?.back
    const { balance, history, ready: orangeReady, refresh: refreshOrange } = useOrange(user?.id);
    
    const [openDailyCheckinModal, setOpenDailyCheckinModal] = useState(false)
    const rewardStatusRequestIdRef = useRef(0);
    const claimRequestIdRef = useRef(0);
    const claimQueueRef = useRef(Promise.resolve());

    const rewardTypeLabel = useCallback((reason) => ({
        DAILY_CHECKIN: 'Check-in points',
        DAILY_ACTIVITY: 'Daily activity points',
        AD_REWARD: 'Legacy promotion points',
        COURSE_QUIZ: 'Learning points',
        FIRST_REWARD: 'First progress bonus',
        WELCOME: 'Welcome progress bonus',
        SWAP: 'Legacy activity points',
        SWAP_REWARD: 'Legacy activity points',
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
        const expectedLease = lease;
        if (!orangeReady || !expectedLease || !isCurrentLease(expectedLease)) return;
        setUserData((current) => (
            isCurrentLease(expectedLease)
                ? {
                    ...(current || {}),
                    numberOranges: balance,
                    listClaimedOranges: groupedHistory(history),
                }
                : current
        ));
    }, [balance, groupedHistory, history, isCurrentLease, lease, orangeReady, setUserData]);

    const loadRewardStatus = useCallback(async (operationLease = lease) => {
        const expectedLease = operationLease;
        if (!expectedLease || !isCurrentLease(expectedLease)) return null;
        const requestId = ++rewardStatusRequestIdRef.current;
        const isCurrentRequest = () => (
            requestId === rewardStatusRequestIdRef.current
            && isCurrentLease(expectedLease)
        );
        try {
            const status = await api.orangeRewardStatus({
                expectedAuthUserId: expectedLease.ownerUserId,
            });
            if (!status || !isCurrentRequest()) return null;
            setUserData((current) => (
                isCurrentRequest()
                    ? {
                        ...(current || {}),
                        numberOranges: status.balance,
                        dailyCheckin: status.dailyCheckin,
                    }
                    : current
            ));
            return status;
        } catch (error) {
            if (!isCurrentRequest()) return null;
            console.warn('[orange] unable to load reward status', error);
            return null;
        }
    }, [isCurrentLease, lease, setUserData]);

    useEffect(() => {
        const expectedLease = lease;
        if (user?.id && expectedLease) void loadRewardStatus(expectedLease);
        return () => { rewardStatusRequestIdRef.current += 1; };
    }, [lease, loadRewardStatus, user?.id]);

    const syncClaim = useCallback((claim, stateKey, expectedLease) => {
        const runClaim = async () => {
            if (!expectedLease || !isCurrentLease(expectedLease)) return null;
            const requestId = ++claimRequestIdRef.current;
            const isCurrentRequest = () => (
                requestId === claimRequestIdRef.current
                && isCurrentLease(expectedLease)
            );
            try {
                const result = await claim({
                    expectedAuthUserId: expectedLease.ownerUserId,
                });
                if (!isCurrentRequest()) return null;
                if (!result) {
                    Alert.alert('Backend not connected', 'Set EXPO_PUBLIC_BACKEND_URL to update Orange progress.');
                    return null;
                }
                setUserData((current) => (
                    isCurrentRequest()
                        ? {
                            ...(current || {}),
                            numberOranges: result.balance,
                            ...(stateKey ? {
                                [stateKey]: { claimed: true, nextAvailable: result.nextAvailable },
                            } : {}),
                        }
                        : current
                ));
                await Promise.all([refreshOrange(), loadRewardStatus(expectedLease)]);
                if (!isCurrentRequest()) return null;
                return result;
            } catch (error) {
                if (!isCurrentRequest()) return null;
                throw error;
            }
        };

        // Reward mutations are serialized so every committed claim is followed by
        // its own balance/status refresh before another claim can start.
        const operation = claimQueueRef.current.then(runClaim);
        claimQueueRef.current = operation.catch(() => null);
        return operation;
    }, [isCurrentLease, loadRewardStatus, refreshOrange, setUserData]);

    useEffect(() => () => {
        claimRequestIdRef.current += 1;
        rewardStatusRequestIdRef.current += 1;
    }, [lease]);

    const onClaimDailyCheckin = async () => {
        const expectedLease = lease;
        if (!expectedLease || !isCurrentLease(expectedLease)) return;
        Haptics.selectionAsync();
        try {
            const result = await syncClaim(api.orangeClaimDailyCheckin, 'dailyCheckin', expectedLease);
            if (!isCurrentLease(expectedLease)) return;
            if (result?.claimed) setOpenDailyCheckinModal(true);
            else if (result) Alert.alert('Already claimed', 'Daily check-in will reset at the next UTC day.');
        } catch (error) {
            if (!isCurrentLease(expectedLease)) return;
            Alert.alert('Claim failed', 'Please try again in a moment.');
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
                <OrangeReward
                    onClaimDailyCheckin={onClaimDailyCheckin}
                />
            </View>

            <Modal 
                animationType="slide"
                transparent={true}
                visible={openDailyCheckinModal}
                onRequestClose={() => {setOpenDailyCheckinModal(false)}}
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
                        <Text style={{fontFamily:'GmarketBold', textAlign:'center',}}>Orange Progress Updated</Text>

                        <View style={{alignItems:'center',padding: 20}}>
                            <Image
                                style={{width: 60,height: 60,}}
                                resizeMode='contain'
                                source={require('../../assets/trophy/reward/daily_check_in_orange.png')}
                                defaultSource={require('../../assets/trophy/reward/daily_check_in_orange.png')}
                            />  
                            <Text style={{fontFamily:'GmarketMedium',marginTop: 10,fontSize: 18,}}>+20 points</Text>
                        </View>

                        <TouchableOpacity
                            style={{backgroundColor: '#FF6B35', width:'90%', height: 50, borderRadius: 25,justifyContent:'center',alignItems:'center',}}
                            onPress={() => {setOpenDailyCheckinModal(false)}}
                        >
                            <Text style={{color:'white',fontSize: Platform.OS == 'ios' ? 17 : 15,fontFamily:'GmarketBold'}}>GOOD</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    )
}

export default OrangeNavigation
