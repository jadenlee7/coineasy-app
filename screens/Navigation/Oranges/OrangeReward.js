import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/core';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { listConstants } from '../../../components/Constants';
import moment from 'moment';
import { GlobalContext } from '../../../contexts/GlobalContext';
import Button from '../../../components/Button';
import useCountdown from '../../../hooks/useCountdown';

const {width, height} = Dimensions.get('window')

const OrangeReward = (props) => {
    const {
        userData,
        setShowClaimOranges,
        setTodayOranges,
    } = useContext(GlobalContext);

    const { onClaimDailyCheckin, handleClaimDailyActivity } = props

    const navigation = useNavigation()

    const now = new Date();
    
    // Check in
    const dailyCheckin = userData?.dailyCheckin || {};
    const nextAvailable = dailyCheckin.nextAvailable ? new Date(dailyCheckin.nextAvailable) : null;
    const isDailyCheckinAvailable = !nextAvailable || now >= nextAvailable;

    const timeLeftAdReward = useCountdown(userData?.adReward?.nextReset);
    const timeLeftDailyCheckin = useCountdown(userData?.dailyCheckin?.nextAvailable);
    const timeLeftDailyActivity = useCountdown(userData?.dailyActivity?.nextAvailable);

    const RewardCard = ({logo, title, description, points, buttonText, buttonType = 'primary', onPress, children }) => {
        return (
            <View style={{
                borderWidth: 1.5,
                borderColor: (
                    (title == 'Daily Check-in' && !isDailyCheckinAvailable) 
                    || (title == 'AD Rewards' && timeLeftAdReward) 
                    || (title == 'Daily Activity Reward' && timeLeftDailyActivity)) 
                    ? '#EEE' : '#FF6B17',
                borderRadius: 16,
                marginTop: 20,
            }}>
                <LinearGradient
                    colors={(
                        (title == 'Daily Check-in' && !isDailyCheckinAvailable) 
                        || (title == 'AD Rewards' && timeLeftAdReward)
                        || (title == 'Daily Activity Reward' && timeLeftDailyActivity)) 
                        ? ["#FFFFFF", "#FFF"] : ["#FFFFFF", "#FFE9E3"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }} // from left to right
                    style={styles.card}
                >
                    <View style={styles.cardHeader}>
                        <View style={styles.iconContainer}>
                            <Image
                                style={{width: 48,height: 48}}
                                resizeMode='contain'
                                source={logo}
                                defaultSource={logo}
                            />  
                        </View>
                        <View style={{flex: 1,marginLeft: 5}}>
                            <Text style={{fontSize: Platform.OS == 'ios' ? 18 : 16,fontFamily: 'GmarketMedium',}}>{title}</Text>
                            <Text style={styles.cardDescription}>{description}</Text>
                        </View>
                    </View>
                    
                    {children}
                    
                    <View style={{flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',}}>

                        {/* Points */}
                        <View style={{flexDirection: 'row', justifyContent:'center', gap: 4}}>
                            <Image
                                style={{width: 19,height: 19,}}
                                resizeMode='contain'
                                source={require('../../../assets/trophy/trophy_icon_orange.png')}
                                defaultSource={require('../../../assets/trophy/trophy_icon_orange.png')}
                            />  
                            <Text style={{fontSize: Platform.OS == 'ios' ? 17 : 15, fontFamily:'GmarketBold',height: 19, }}>{points}</Text>
                        </View>

                        {/* BUTTON */}
                        <TouchableOpacity 
                            style={[
                                styles.button, 
                                buttonType === 'secondary' ? styles.buttonSecondary : styles.buttonPrimary,
                                title == "Invite Friends" && {paddingHorizontal: 20}
                            ]}
                            onPress={onPress}
                        >
                            <Text style={[
                                styles.buttonText,
                                buttonType === 'secondary' ? styles.buttonTextSecondary : styles.buttonTextPrimary
                            ]}>
                                {buttonText}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </View>
        );
    };

    const ProgressBar = ({ current, max, label }) => {
        const progress = (current / max) * 100;
        
        return (
            <View style={{marginBottom: 16,}}>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom: 5}}>
                    <Text style={{fontSize: 14,color: '#333333',marginBottom: 0,}}>{label}</Text>
                    <Text style={{fontSize: 12,color: '#232323',}}>{current}/{max}</Text>
                </View>
                <View style={{height: 8,backgroundColor: '#DDD',borderRadius: 3,}}>
                    <View style={{ width: `${progress}%`,  height: '100%',backgroundColor: '#FF6B35',borderRadius: 3 }} />
                </View>
            </View>
        );
    };

    const handleClaimAdReward = () => {
        Haptics.selectionAsync();
        setTodayOranges(10);
        setShowClaimOranges(true)
    }

    return (
        <View>
            {/* Header */}
            <View style={{paddingHorizontal: 20,paddingVertical: 20,flexDirection:'row',justifyContent:'space-between',alignItems:'center',}}>
                <Text style={{fontFamily: 'GmarketBold', fontSize: Platform.OS == 'ios' ? 17 : 15, }}>Orange Rewards</Text>
                <TouchableOpacity 
                    style={{borderWidth: 1, borderColor: '#E3E8EC',borderRadius: 20,padding: 8,paddingHorizontal: 10, alignItems: 'center', justifyContent:'center', backgroundColor: '#FEFBF7',}}
                    onPress={() => {Haptics.selectionAsync();navigation.navigate('RewardHistory')}} 
                >
                    <Text style={{fontFamily: 'GmarketMedium', fontSize: 12,color: '#454545',}}>Track Rewards</Text>    
                </TouchableOpacity>
            </View>

            <ScrollView 
                style={{flex: 1,paddingHorizontal: 16,marginTop: -20,}} 
                showsVerticalScrollIndicator={false}
            >
                {/* Daily Check-in */}
                <RewardCard
                    logo={require('../../../assets/trophy/reward/daily_check_in.png')}
                    title="Daily Check-in"
                    description="Check in daily and earn Orange."
                    points="20"
                    buttonText={isDailyCheckinAvailable ? "Claim" : timeLeftDailyCheckin || "Wait..."}
                    buttonType={isDailyCheckinAvailable ? "primary" : "secondary"}
                    onPress={isDailyCheckinAvailable ? onClaimDailyCheckin : null}
                />

                {/* AD Rewards */}
                <RewardCard
                    logo={require('../../../assets/trophy/reward/ad_reward.png')}
                    title="AD Rewards"
                    description="Watch an ad and earn Orange. Up to 3 times per day."
                    points="10"
                    buttonText={!timeLeftAdReward ? `Claim` : timeLeftAdReward || "Wait..."}
                    buttonType={!timeLeftAdReward ? "primary" : "secondary"}
                    onPress={!timeLeftAdReward ? handleClaimAdReward : null}
                />

                {/* Daily Activity Reward */}
                <RewardCard
                    logo={require('../../../assets/trophy/reward/daily_activity.png')}
                    title="Daily Activity Reward"
                    description="Complete daily tasks and earn Orange. Stay active every day to claim your reward!"
                    points="30"
                    buttonText={!timeLeftDailyActivity ? `Claim` : timeLeftDailyActivity || "Wait..."}
                    buttonType={userData.todayActivities?.posts == 1 && userData.todayActivities?.comments == 2 && userData.todayActivities?.likes == 10 && !timeLeftDailyActivity ? "primary" : "secondary"}
                    // buttonType={userData.todayActivities?.posts == 1 && userData.todayActivities?.comments == 2 && userData.todayActivities?.likes == 10 ? "primary" : "secondary"}
                    onPress={!timeLeftDailyActivity ? handleClaimDailyActivity : null}
                >
                    <ProgressBar current={userData.todayActivities?.posts ?? 0} max={1} label="Post" />
                    <ProgressBar current={userData.todayActivities?.comments ?? 0} max={5} label="Comments" />
                    <ProgressBar current={userData.todayActivities?.likes ?? 0} max={10} label="Likes" />
                </RewardCard>

                {/* Invite Friends */}
                <RewardCard
                    logo={require('../../../assets/trophy/reward/invite_friend.png')}
                    title="Invite Friends"
                    description="Earn up to 100 Orange for every friend you invite!"
                    points="100"
                    buttonText="View Details"
                    buttonType="primary"
                    onPress={() => navigation.navigate('InviteFriendScreen')}
                />

                <View style={{height: 30}} />
            </ScrollView>
        </View>
    );
}

export default OrangeReward

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardDescription: {
    marginTop: 5,
    color: '#555555',
    lineHeight: 15,
    fontSize: Platform.OS == 'ios' ? 12 : 10,
    fontFamily: 'GmarketMedium'
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressLabel: {

  },
  progressTextContainer: {

  },
  progressText: {

  },
  progressBarContainer: {

  },
  progressBar: {

  },
  orangeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B35',
    marginRight: 8,
  },
  points: {

  },
  button: {
    borderRadius: 24,
    minWidth: 112,
    height: 32,
    justifyContent:'center',
    paddingHorizontal: 10
  },
  buttonPrimary: {
    backgroundColor: '#FF6B35',
  },
  buttonSecondary: {
    backgroundColor: '#EEE',
    borderWidth: 0,
  },
  buttonText: {
    fontSize: Platform.OS == 'ios' ? 14 : 12,
    textAlign: 'center',
    fontFamily: 'GmarketMedium'
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    color: '#999999',
  },
});
