import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/core';
import { GlobalContext } from '../../../contexts/GlobalContext';
import useCountdown from '../../../hooks/useCountdown';

const OrangeReward = (props) => {
    const { userData } = useContext(GlobalContext);

    const { onClaimDailyCheckin } = props

    const navigation = useNavigation()

    const now = new Date();
    
    // Check in
    const dailyCheckin = userData?.dailyCheckin || {};
    const nextAvailable = dailyCheckin.nextAvailable ? new Date(dailyCheckin.nextAvailable) : null;
    const isDailyCheckinAvailable = !nextAvailable || now >= nextAvailable;

    const timeLeftDailyCheckin = useCountdown(userData?.dailyCheckin?.nextAvailable);

    const RewardCard = ({logo, title, description, points, buttonText, buttonType = 'primary', disabled = false, onPress, children }) => {
        return (
            <View style={{
                borderWidth: 1.5,
                borderColor: disabled ? '#EEE' : '#FF6B17',
                borderRadius: 16,
                marginTop: 20,
            }}>
                <LinearGradient
                    colors={disabled ? ["#FFFFFF", "#FFF"] : ["#FFFFFF", "#FFE9E3"]}
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
                            accessibilityRole="button"
                            accessibilityState={{disabled}}
                            disabled={disabled}
                            style={[
                                styles.button, 
                                buttonType === 'secondary' ? styles.buttonSecondary : styles.buttonPrimary,
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

    return (
        <View style={{flex: 1}}>
            {/* Header */}
            <View style={{paddingHorizontal: 20,paddingVertical: 20,flexDirection:'row',justifyContent:'space-between',alignItems:'center',}}>
                <Text style={{fontFamily: 'GmarketBold', fontSize: Platform.OS == 'ios' ? 17 : 15, }}>Orange Progress</Text>
                <TouchableOpacity 
                    style={{borderWidth: 1, borderColor: '#E3E8EC',borderRadius: 20,padding: 8,paddingHorizontal: 10, alignItems: 'center', justifyContent:'center', backgroundColor: '#FEFBF7',}}
                    onPress={() => {Haptics.selectionAsync();navigation.navigate('RewardHistory')}} 
                >
                    <Text style={{fontFamily: 'GmarketMedium', fontSize: 12,color: '#454545',}}>Progress history</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.pointsNotice}>
                <Text style={styles.pointsNoticeText}>
                    Orange points track in-app learning and participation only. They cannot be bought, sold, transferred, redeemed, or converted into cash, crypto, tokens, NFTs, or gifts.
                </Text>
            </View>

            <ScrollView 
                style={{flex: 1,paddingHorizontal: 16,}}
                showsVerticalScrollIndicator={false}
            >
                {/* Daily Check-in */}
                <RewardCard
                    logo={require('../../../assets/trophy/reward/daily_check_in.png')}
                    title="Daily Check-in"
                    description="Record a daily check-in and build non-transferable in-app progress."
                    points="20"
                    buttonText={isDailyCheckinAvailable ? "Add progress" : timeLeftDailyCheckin || "Wait..."}
                    buttonType={isDailyCheckinAvailable ? "primary" : "secondary"}
                    disabled={!isDailyCheckinAvailable}
                    onPress={isDailyCheckinAvailable ? onClaimDailyCheckin : null}
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
  pointsNotice: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
    marginHorizontal: 20,
    padding: 12,
  },
  pointsNoticeText: {
    color: '#9A3412',
    fontFamily: 'GmarketMedium',
    fontSize: Platform.OS == 'ios' ? 11 : 10,
    lineHeight: 16,
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
