import React, { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View, Animated, Easing, Platform } from 'react-native'

import Button from '../../components/Button';
import HeaderImage from '../../components/HeaderImage';
import { ArrowAccordionIcon, CancelIcon, SuccessIcon } from '../../components/Icons';
import { GlobalContext } from '../../contexts/GlobalContext';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ScrollView as RNScrollView } from 'react-native-gesture-handler';
import { showMessage } from 'react-native-flash-message';
import Modal from '../../components/Modal';
import { AntDesign } from '@expo/vector-icons';
import ModalAugmented from '../../components/ModalAugmented';
import ModalSmall from '../../components/ModalSmall';

const { width, height } = Dimensions.get('window')

const ActivityReward = ({navigation, route}) => {

    const { orbis, user, setUser, userData, setUserData } = useContext(GlobalContext);

    const [openHelp, setOpenHelp] = useState(false)
    const [openHelpUnclaimed, setOpenHelpUnclaimed] = useState(false)
    const [openHelpClaimed, setOpenHelpClaimed] = useState(false)
    const [openHelpActivity, setOpenHelpActivity] = useState(false)

    const tailwind = useTailwind();


    const modalRef = useRef(null); 
    const snapPoints = useMemo(() => ['75%','75%'], []);
    const snapPoints2 = useMemo(() => ['30%','30%'], []);
    const handleModalPress = useCallback(() => modalRef.current?.present(), []);


    const onClaimReward = async () => {
        const tempData = userData
        if(!tempData.activityUnclaimed?.number){
            showMessage({
                message: "No oranges to claim",
                type: "info",
                floating: true,
                backgroundColor: "#3D3D3D",
                icon: () => <CancelIcon style={{marginRight: 10,}}/>
            });
        }else{
            if(tempData.activityClaimed){
                tempData.activityClaimed.number += tempData.activityUnclaimed.number
            }else{
                tempData.activityClaimed = {
                    number: tempData.activityUnclaimed.number
                }
            }

            tempData.numberOranges ? tempData.numberOranges += tempData.activityUnclaimed.number : tempData.numberOranges = tempData.activityUnclaimed.number
            tempData.activityUnclaimed.number = 0

            setUserData({...tempData})
            
            var tempProfile = user.profile
            tempProfile.data = tempData
            await orbis.updateProfile(tempProfile);

            showMessage({
                message: "Your oranges have been claimed !",
                type: "success",
                floating: true,
                backgroundColor: "#3D3D3D",
                icon: () => <SuccessIcon style={{marginRight: 10,}}/>
            });
        }
    }

    const [collapsed, setCollapsed] = useState(true);
    const [animation] = useState(new Animated.Value(0));
  
    const toggleCollapse = () => {
        if (collapsed) {
            Animated.parallel([
                Animated.timing(spinValue,{
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: false 
                }),
                Animated.timing(animation, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: false
                }),
            ]).start(() => setCollapsed(!collapsed))
        } else {
            Animated.parallel([
                Animated.timing(spinValue,{
                    toValue: 0,
                    duration: 300,
                    easing: Easing.linear,
                    useNativeDriver: false 
                }),
                Animated.timing(animation, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: false
                }),
            ]).start(() => setCollapsed(!collapsed))
        }
    };
  
    const heightInterpolate = animation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 380]
    });

    const spinValue = new Animated.Value(0);
    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ["180deg", "0deg"]
    })

    return (
        <View style={[tailwind('flex flex-1 flex-col'),{backgroundColor: 'white',}]}>
            <HeaderImage />

            <View style={{backgroundColor: 'white',flexDirection: 'row',justifyContent:'center', alignItems: 'center',paddingLeft: 5,paddingRight: 20,paddingTop: 4}}>
                <TouchableOpacity style={{margin: 15,position: 'absolute',left: 0, top: 0}} onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                    <Image
                        style={{width: 24,height: 24}}
                        resizeMode='contain'
                        source={require('../../assets/back_button.png')}
                        defaultSource={require('../../assets/back_button.png')}
                    />
                </TouchableOpacity>

                <View style={{flexDirection:'row',justifyContent: 'center', alignItems:'center',gap: 10,marginVertical: 10,marginLeft: 20}}>
                    <Text style={{fontWeight: 'bold',fontSize: Platform.OS == 'ios' ? 20 : 18,fontFamily: 'GmarketBold'}}>Activity Rewards</Text>
                    <TouchableOpacity onPress={() => {Haptics.selectionAsync();setOpenHelpActivity(true);}}>
                        <Image
                            style={{width: Platform.OS == 'ios' ? 25 : 20, height: Platform.OS == 'ios' ? 25 : 20}}
                            resizeMode='contain'
                            source={require('../../assets/question_icon.png')}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={{flex: 1,}}>

                <View style={[styles.elevate, {backgroundColor: 'white', width: width - 30, height: 160,  borderRadius: 10,alignSelf:'center',marginTop: 20}]}>
                    <Text style={{marginTop: 17,marginLeft: 20,fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 12}}>Earn Oranges for your daily activities!</Text>

                    {/* UNCLAIMED REWARD */}
                    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginHorizontal: 10,marginTop: Platform.OS == 'ios' ? 10 : 20,marginLeft: 20}}>
                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 7}}>
                            <Image
                                style={{width: Platform.OS == 'ios' ? 45 : 40, height: Platform.OS == 'ios' ? 45 : 40, alignSelf:'center',}}
                                resizeMode='contain'
                                source={require('../../assets/orange2_icon.png')}
                            />
                            <TouchableOpacity onPress={() => {Haptics.selectionAsync();setOpenHelpUnclaimed(true);}}>
                                <Image
                                    style={{width: Platform.OS == 'ios' ? 23 : 20, height: Platform.OS == 'ios' ? 23 : 20,marginLeft: 5}}
                                    resizeMode='contain'
                                    source={require('../../assets/question_icon.png')}
                                />
                            </TouchableOpacity>
                        </View>

                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 20}}>
                            <Text style={{color: '#FF6E31',fontSize: 18,fontWeight: 'bold',}}>+{userData.activityUnclaimed?.number ?? 0}</Text>
                            <Button
                                title='Claim'
                                color='orange'
                                size="sm"
                                onPress={() => onClaimReward()}
                                style={{height: 40, justifyContent: 'center',alignItems: 'center'}}
                            />
                        </View>
                    </View> 


                    {/* CLAIMED REWARD */}
                    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginHorizontal: 10,marginTop: 10,marginLeft: 20}}>
                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 7}}>
                            <Image
                                style={{width: Platform.OS == 'ios' ? 45 : 40, height: Platform.OS == 'ios' ? 45 : 40, alignSelf:'center',}}
                                resizeMode='contain'
                                source={require('../../assets/orange_icon.png')}
                            />
                            <TouchableOpacity onPress={() => {Haptics.selectionAsync();setOpenHelpClaimed(true);}}>
                                <Image
                                    style={{width: Platform.OS == 'ios' ? 23 : 20, height: Platform.OS == 'ios' ? 23 : 20, marginLeft: 5}}
                                    resizeMode='contain'
                                    source={require('../../assets/question_icon.png')}
                                />
                            </TouchableOpacity>
                        </View>

                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 20, marginRight: -3}}>
                            <Text style={{color: '#FF6E31',fontSize: 18,fontWeight: 'bold',}}>{userData.activityClaimed?.number ?? 0}</Text>
                            {/* opacity 0 to have same margin right with unclaimed */}
                            <Button
                                title='Claim'
                                color='orange'
                                size="sm"
                                style={{height: 40, justifyContent: 'center',alignItems: 'center', opacity: 0,}}
                            />
                        </View>
                    </View>
                </View>

                <View style={[styles.elevate, {backgroundColor: 'white', width: width - 30, borderRadius: 10,alignSelf:'center',marginTop: 20}]}>
                    <View>
                        <TouchableWithoutFeedback onPress={toggleCollapse}>
                            <Animated.View style={{height: 40, justifyContent:'center',alignItems:'center', transform: [{ rotate: spin}]}}>
                                <ArrowAccordionIcon />
                            </Animated.View>
                        </TouchableWithoutFeedback>
                        <Animated.View style={{ height: heightInterpolate, overflow: 'hidden', paddingHorizontal: 10}}>
                            <View style={{}}>
                                <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 12,}}>Hit milestones, earn bonuses!</Text>

                                {/* POSTING */}
                                <View style={{marginTop: 20,}}>
                                    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',}}>
                                        <Text style={{fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 19 : 15,}}>Posting</Text>
                                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 8}}>
                                            <Image
                                                style={{width: 30, height: 30, alignSelf:'center',}}
                                                resizeMode='contain'
                                                source={require('../../assets/orange_icon.png')}
                                            />
                                            <Text style={{color:'#FF6E31',fontWeight: 'bold',fontFamily: 'GmarketMedium',fontSize: 16,}}>+50</Text>
                                        </View>
                                    </View>
                                    <Text style={{marginTop: 3,fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 11,marginLeft: 2}}>Express yourself!</Text>

                                    <Text style={{textAlign: 'right',fontFamily: 'GmarketMedium'}}>{userData.post?.number ?? 0}/10</Text>
                                    <View style={{backgroundColor: '#F6F6F6',height: 15, borderRadius: 6,marginTop: 3,}}>
                                        {/* Background Linear Gradient */}
                                        <LinearGradient
                                            colors={['#FFEACA', '#FF823B']}
                                            start={{x: 0, y:0.5}}
                                            style={{width: userData.post ? userData.post.number+'0%' : '0%', height: 15,borderRadius: 6}}
                                        />
                                    </View>
                                </View>

                                {/* COMMENTS */}
                                <View style={{marginTop: 20,}}>
                                    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',}}>
                                        <Text style={{fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 21 : 17,fontWeight: 'bold'}}>Comments</Text>
                                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 8}}>
                                            <Image
                                                style={{width: 30, height: 30, alignSelf:'center',}}
                                                resizeMode='contain'
                                                source={require('../../assets/orange_icon.png')}
                                            />
                                            <Text style={{color:'#FF6E31',fontWeight: 'bold',fontFamily: 'GmarketMedium',fontSize: 16,}}>+50</Text>
                                        </View>
                                    </View>
                                    <Text style={{marginTop: 3,fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 11,marginLeft: 2}}>Interact with others!</Text>

                                    <Text style={{textAlign: 'right',fontFamily: 'GmarketMedium'}}>{userData.comment?.number ?? 0}/20</Text>
                                    <View style={{backgroundColor: '#F6F6F6',height: 15, borderRadius: 6,marginTop: 3,}}>
                                        {/* Background Linear Gradient */}
                                        <LinearGradient
                                            colors={['#FFEACA', '#FF823B']}
                                            start={{x: 0, y:0.5}}
                                            style={{
                                                width: 
                                                    userData.comment && userData.comment.number%2 == 1 ? userData.comment.number*5+'%' 
                                                    : userData.comment && userData.comment.number%2 == 0 ? userData.comment.number/2+'0%' 
                                                    : '0%', 
                                                height: 15,
                                                borderRadius: 6
                                            }}
                                        />
                                    </View>
                                </View>

                                {/* REACTIONS */}
                                <View style={{marginTop: 20,}}>
                                    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',}}>
                                        <Text style={{fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 19 : 15,}}>Reactions</Text>
                                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 8}}>
                                            <Image
                                                style={{width: 30, height: 30, alignSelf:'center',}}
                                                resizeMode='contain'
                                                source={require('../../assets/orange_icon.png')}
                                            />
                                            <Text style={{color:'#FF6E31',fontWeight: 'bold',fontFamily: 'GmarketMedium',fontSize: 16,}}>+50</Text>
                                        </View>
                                    </View>
                                    <Text style={{marginTop: 3,fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 11,marginLeft: 2}}>Spread the love!</Text>

                                    <Text style={{textAlign: 'right',fontFamily: 'GmarketMedium'}}>{userData.reaction?.number ?? 0}/30</Text>
                                    <View style={{backgroundColor: '#F6F6F6',height: 15, borderRadius: 6,marginTop: 3,}}>
                                        {/* Background Linear Gradient */}
                                        <LinearGradient
                                            colors={['#FFEACA', '#FF823B']}
                                            start={{x: 0, y:0.5}}
                                            style={{
                                                // width: userData.reaction ? userData.reaction.number+'0%' : '0%', 
                                                width: 
                                                    userData.reaction && userData.reaction.number%2 == 1 ? userData.reaction.number*10/3+'%' 
                                                    : userData.reaction && userData.reaction.number%2 == 0 ? userData.reaction.number*3+'%' 
                                                    : '0%', 
                                                height: 15,
                                                borderRadius: 6
                                            }}
                                        />
                                    </View>
                                </View>
                                
                            </View>
                        </Animated.View>
                    </View>

                </View>

                <View style={{height: 100}}/>
            </ScrollView>


            {openHelpUnclaimed && (
                <ModalSmall 
                    hide={() => {Haptics.selectionAsync();setOpenHelpUnclaimed(false)}} 
                >
                    <TouchableOpacity
                        style={{position: 'absolute',top: 15, right: 15}}
                        onPress={() => {Haptics.selectionAsync();setOpenHelpUnclaimed(false)}}
                    >
                        <AntDesign name="closecircle" size={24} color="black" />
                    </TouchableOpacity>

                    <View style={{paddingVertical: 40}}>
                        <Image
                            style={{width: 50, height: 50, alignSelf:'center',}}
                            resizeMode='contain'
                            source={require('../../assets/orange2_icon.png')}
                        />

                        <Text style={{textAlign: 'center',fontFamily: 'GmarketBold', fontSize: Platform.OS == 'ios' ? 20 : 16,marginVertical: 10,}}>Unclaimed Oranges</Text>

                        <Text style={{fontFamily: 'GmarketMedium', fontSize: Platform.OS == 'ios' ? 14 : 12,textAlign: 'center',paddingHorizontal: 5}}>The user hasn't claimed their Orange rewards yet.</Text>
                    </View>
                </ModalSmall>
            )}

            {openHelpClaimed && (
                <ModalSmall 
                    hide={() => {Haptics.selectionAsync();setOpenHelpClaimed(false)}} 
                >

                    <TouchableOpacity
                        style={{position: 'absolute',top: 15, right: 15}}
                        onPress={() => {Haptics.selectionAsync();setOpenHelpClaimed(false)}}
                    >
                        <AntDesign name="closecircle" size={24} color="black" />
                    </TouchableOpacity>

                    <View style={{paddingVertical: 40}}>
                        <Image
                            style={{width: 50, height: 50, alignSelf:'center',}}
                            resizeMode='contain'
                            source={require('../../assets/orange_icon.png')}
                        />

                        <Text style={{textAlign: 'center',fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 20 : 16,marginVertical: 10,}}>Claimed Rewards</Text>

                        <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 12,textAlign: 'center',paddingHorizontal: 5}}>The user has already claimed their Orange rewards.</Text>
                    </View>
                </ModalSmall>
            )}

            {openHelpActivity && (
                <ModalAugmented
                    hide={() => {Haptics.selectionAsync();setOpenHelpActivity(false)}} 
                >

                    <TouchableOpacity
                        style={{position: 'absolute',top: 10, right: 10,zIndex: 2}}
                        onPress={() => {Haptics.selectionAsync();setOpenHelpActivity(false)}}
                    >
                        <AntDesign name="closecircle" size={24} color="black" />
                    </TouchableOpacity>

                    <View style={{paddingTop: 30,}}>
                        <View style={[tailwind('flex flex-col items-center justify-center')]}>
                            <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 5}}>
                                <Image
                                    style={{width: 20, height: 20}}
                                    resizeMode='contain'
                                    source={require('../../assets/nice_orange.png')}
                                />
                                <Text style={{fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 20 : 16,marginTop: 3,}}>Activity Rewards System</Text>
                            </View>
                            <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 12, textAlign: 'center',marginTop: 10,}}>"Your engagement counts!</Text>
                            <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 12, textAlign: 'center',}}>Earn Oranges for every interaction and</Text>
                            <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 12, textAlign: 'center',}}>redeem them for exciting rewards."</Text>
                        </View>

                        <View style={{height: StyleSheet.hairlineWidth, width: 225, marginTop: 15,alignSelf:'center',backgroundColor: '#333',}}/>

                        {/* POSTING */}
                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop: 10,}}>
                            <Image
                                style={{width: 20, height: 20}}
                                resizeMode='contain'
                                source={require('../../assets/nice_orange.png')}
                            />
                            <Text style={{fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 20 : 16,}}>Posting</Text>
                        </View>

                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3,marginVertical: 5,}}>
                            <Text style={{color: '#FF6B17', textDecorationLine: 'underline',fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 14 : 12,}}>
                                15 Oranges
                            </Text>
                            <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 12,}}>per post</Text>
                        </View>

                        <Text style={{textAlign: 'center',marginTop: 10, fontSize: 12,fontFamily: 'GmarketBold',color:'#555'}}>*Post "Like" Milestones</Text>

                        <View style={{marginTop: 8,alignSelf:'center',}}>
                            <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 13 : 11,color:'#555',}}>· Extra <Text style={{color:'#FF6B17',fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 13 : 11,textDecorationLine:'underline'}}>30 Oranges</Text> when post reaches 50 likes.</Text>
                            <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 13 : 11,color:'#555',}}>· Extra <Text style={{color:'#FF6B17',fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 13 : 11,textDecorationLine:'underline'}}>70 Oranges</Text> when post reaches 100 likes.</Text>
                        </View>

                        {/* COMMENTS */}
                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop: 30,}}>
                            <Image
                                style={{width: 20, height: 20}}
                                resizeMode='contain'
                                source={require('../../assets/nice_orange.png')}
                            />
                            <Text style={{fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 20 : 16,}}>Comments</Text>
                        </View>

                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3,marginTop: 5,}}>
                            <Text style={{color: '#FF6B17', textDecorationLine: 'underline', fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 13 : 11,}}>
                                3 Oranges
                            </Text>
                            <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 13 : 11,}}>per comment</Text>
                        </View>
                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3,}}>
                            <Text style={{color: '#FF6B17', textDecorationLine: 'underline', fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 13 : 11,}}>4 Oranges</Text>
                            <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 13 : 11,}}>per reply to Another User's Comment</Text>
                        </View>

                        {/* REACTIONS */}
                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop: 30,}}>
                            <Image
                                style={{width: 20, height: 20}}
                                resizeMode='contain'
                                source={require('../../assets/nice_orange.png')}
                            />
                            <Text style={{fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 20 : 16,}}>Reactions (Like&Repost)</Text>
                        </View>

                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3,marginTop: 5,}}>
                            <Text style={{color: '#FF6B17', textDecorationLine: 'underline', fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 13 : 11,}}>2 Oranges</Text>
                            <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 13 : 11,}}>per like</Text>
                        </View>
                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3,}}>
                            <Text style={{color: '#FF6B17', textDecorationLine: 'underline', fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 13 : 11,}}>5 Oranges</Text>
                            <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 13 : 11,}}>per repost</Text>
                        </View>

                        {/* MILESTONES BONUSES */}
                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop: 30,}}>
                            <Image
                                style={{width: 20, height: 20}}
                                resizeMode='contain'
                                source={require('../../assets/nice_orange.png')}
                            />
                            <Text style={{fontSize: Platform.OS == 'ios' ? 22 : 18,fontWeight: 'bold',}}>Milestones Bonuses</Text>
                        </View>

                        <Text style={{textAlign: 'center',marginTop: 5,fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 13 : 11,}}>Achieve a milestone and receive</Text>
                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3}}>
                            <Text style={{color: '#FF6B17',fontWeight: 'bold',fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 15 : 13,marginTop: -2,}}>additional Oranges</Text>
                            <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 13 : 11,}}>for each activity</Text>
                        </View>

                        <View style={{height: 50}}/>
                    </View>
                </ModalAugmented>
            )}

            <BottomSheetModalProvider>
                <BottomSheetModal
                    ref={modalRef}
                    snapPoints={openHelp ? snapPoints : snapPoints2}
                    handleIndicatorStyle={{backgroundColor: 'black',}}
                    handleStyle={{height: 40,justifyContent: 'center',backgroundColor: '#FFF7E8',borderRadius: 10,}}
                    backdropComponent={(backdropProps) => <BottomSheetBackdrop {...backdropProps} enableTouchThrough={true} />}
                    onDismiss={() => {setOpenHelp(false);setOpenHelpClaimed(false);setOpenHelpUnclaimed(false)}}
                >
                    <LinearGradient
                        // Background Linear Gradient
                        colors={['#FFF7E8', '#FFEDEC']}
                        style={[{height: '100%',}]} 
                    >
                        {openHelp && (
                            <RNScrollView>
                                <View style={[tailwind('flex flex-col items-center justify-center px-1')]}>
                                    <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 5}}>
                                        <Image
                                            style={{width: 20, height: 20}}
                                            resizeMode='contain'
                                            source={require('../../assets/nice_orange.png')}
                                        />
                                        <Text style={{fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 20 : 16,marginTop: 10,}}>Activity Rewards System</Text>
                                    </View>
                                    <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 12, textAlign: 'center',marginTop: 10,}}>"Your engagement counts!</Text>
                                    <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 12, textAlign: 'center',}}>Earn Oranges for every interaction and</Text>
                                    <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 12, textAlign: 'center',}}>redeem them for exciting rewards."</Text>
                                </View>

                                <View style={{height: StyleSheet.hairlineWidth, width: 225, marginTop: 15,alignSelf:'center',backgroundColor: '#333',}}/>

                                {/* POSTING */}
                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop: 10,}}>
                                    <Image
                                        style={{width: 20, height: 20}}
                                        resizeMode='contain'
                                        source={require('../../assets/nice_orange.png')}
                                    />
                                    <Text style={{fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 20 : 16,marginTop: 10,}}>Posting</Text>
                                </View>

                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3,marginVertical: 5,}}>
                                    <Text style={{color: '#FF6B17', textDecorationLine: 'underline',fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 14 : 12,}}>
                                        15 Oranges
                                    </Text>
                                    <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 12,}}>per post</Text>
                                </View>

                                <Text style={{textAlign: 'center',marginTop: 10, fontSize: 12,fontFamily: 'GmarketBold',color:'#555'}}>*Post "Like" Milestones</Text>

                                <View style={{marginTop: 8,alignSelf:'center',}}>
                                    <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 13 : 11,color:'#555',}}>· Extra <Text style={{color:'#FF6B17',fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 14 : 12,textDecorationLine:'underline'}}>30 Oranges</Text> when post reaches 50 likes.</Text>
                                    <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 13 : 11,color:'#555',}}>· Extra <Text style={{color:'#FF6B17',fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 14 : 12,textDecorationLine:'underline'}}>70 Oranges</Text> when post reaches 100 likes.</Text>
                                </View>

                                {/* COMMENTS */}
                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop: 30,}}>
                                    <Image
                                        style={{width: 20, height: 20}}
                                        resizeMode='contain'
                                        source={require('../../assets/nice_orange.png')}
                                    />
                                    <Text style={{fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 20 : 16,}}>Comments</Text>
                                </View>

                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3,marginTop: 5,}}>
                                    <Text style={{color: '#FF6B17', textDecorationLine: 'underline', fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 14 : 12,}}>
                                        3 Oranges
                                    </Text>
                                    <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 12,}}>per comment</Text>
                                </View>
                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3,}}>
                                    <Text style={{color: '#FF6B17', textDecorationLine: 'underline', fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 14 : 12,}}>4 Oranges</Text>
                                    <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 12,}}>per reply to Another User's Comment</Text>
                                </View>

                                {/* REACTIONS */}
                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop: 30,}}>
                                    <Image
                                        style={{width: 20, height: 20}}
                                        resizeMode='contain'
                                        source={require('../../assets/nice_orange.png')}
                                    />
                                    <Text style={{fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 20 : 16,}}>Reactions (Like&Repost)</Text>
                                </View>

                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3,marginTop: 5,}}>
                                    <Text style={{color: '#FF6B17', textDecorationLine: 'underline', fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 14 : 12,}}>2 Oranges</Text>
                                    <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 12,}}>per like</Text>
                                </View>
                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3,}}>
                                    <Text style={{color: '#FF6B17', textDecorationLine: 'underline', fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 14 : 12,}}>5 Oranges</Text>
                                    <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 12,}}>per repost</Text>
                                </View>

                                {/* MILESTONES BONUSES */}
                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop: 30,}}>
                                    <Image
                                        style={{width: 20, height: 20}}
                                        resizeMode='contain'
                                        source={require('../../assets/nice_orange.png')}
                                    />
                                    <Text style={{fontSize: Platform.OS == 'ios' ? 22 : 18,fontWeight: 'bold',}}>Milestones Bonuses</Text>
                                </View>

                                <Text style={{textAlign: 'center',marginTop: 5,fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 12,}}>Achieve a milestone and receive</Text>
                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3}}>
                                    <Text style={{color: '#FF6B17',fontWeight: 'bold',fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 16 : 14,}}>additional Oranges</Text>
                                    <Text style={{fontFamily: 'GmarketMedium',fontSize: Platform.OS == 'ios' ? 14 : 12,}}>for each activity</Text>
                                </View>

                                <View style={{height: 50}}/>
                            </RNScrollView>
                        )}

                    </LinearGradient>
                </BottomSheetModal>
            </BottomSheetModalProvider>


        </View>
    )
}

export default ActivityReward

const styles = StyleSheet.create({
    elevate: {
        elevation: 5,
        shadowRadius: 4,
        shadowOpacity: 0.1,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 3,
        },
    },
})