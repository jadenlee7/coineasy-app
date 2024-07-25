import React, { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View, Animated, Easing } from 'react-native'

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

const { width, height } = Dimensions.get('window')

const ActivityReward = ({navigation, route}) => {

    const { orbis, user, setUser, userData, setUserData } = useContext(GlobalContext);

    const [openHelp, setOpenHelp] = useState(false)
    const [openHelpUnclaimed, setOpenHelpUnclaimed] = useState(false)
    const [openHelpClaimed, setOpenHelpClaimed] = useState(false)

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

            tempData.activityUnclaimed.number = 0
            setUserData({...tempData})
            
            var tempProfile = user.profile
            tempProfile.data = tempData
            const res = await orbis.updateProfile(tempProfile);

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
        outputRange: [0, 400]
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
                    <Text style={{fontWeight: 'bold',fontSize: 18,fontFamily: 'GmarketMedium'}}>Activity Rewards</Text>
                    <TouchableOpacity onPress={() => {Haptics.selectionAsync();setOpenHelp(true);handleModalPress()}}>
                        <Image
                            style={{width: 20, height: 20}}
                            resizeMode='contain'
                            source={require('../../assets/question_icon.png')}
                        />
                    </TouchableOpacity>
                </View>
            </View>


            <ScrollView style={{flex: 1,}}>

                <View style={[styles.elevate, {backgroundColor: 'white', width: width - 30, height: 160,  borderRadius: 10,alignSelf:'center',marginTop: 20}]}>
                    <Text style={{marginTop: 17,marginLeft: 15,fontSize: 12, fontFamily: 'GmarketMedium'}}>Earn Oranges for your daily activities!</Text>

                    {/* UNCLAIMED REWARD */}
                    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginHorizontal: 10,marginTop: 20,}}>
                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 7}}>
                            <Image
                                style={{width: 40, height: 40, alignSelf:'center',}}
                                resizeMode='contain'
                                source={require('../../assets/orange2_icon.png')}
                            />
                            <TouchableOpacity onPress={() => {Haptics.selectionAsync();setOpenHelpUnclaimed(true);handleModalPress()}}>
                                <Image
                                    style={{width: 20, height: 20}}
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
                    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginHorizontal: 10,marginTop: 10,}}>
                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 7}}>
                            <Image
                                style={{width: 40, height: 40, alignSelf:'center',}}
                                resizeMode='contain'
                                source={require('../../assets/orange_icon.png')}
                            />
                            <TouchableOpacity onPress={() => {Haptics.selectionAsync();setOpenHelpClaimed(true);handleModalPress()}}>
                                <Image
                                    style={{width: 20, height: 20}}
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
                                <Text style={{fontFamily: 'GmarketMedium'}}>Hit milestones, earn bonuses!</Text>

                                {/* POSTING */}
                                <View style={{marginTop: 20,}}>
                                    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',}}>
                                        <Text style={{fontSize: 17,fontWeight: 'bold',fontFamily: 'GmarketMedium'}}>Posting</Text>
                                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 8}}>
                                            <Image
                                                style={{width: 30, height: 30, alignSelf:'center',}}
                                                resizeMode='contain'
                                                source={require('../../assets/orange_icon.png')}
                                            />
                                            <Text style={{color:'#FF6E31',fontWeight: 'bold',fontFamily: 'GmarketMedium',fontSize: 16,}}>+50</Text>
                                        </View>
                                    </View>
                                    <Text style={{marginTop: 7,fontSize: 13,fontFamily: 'GmarketMedium'}}>Express yourself!</Text>

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
                                        <Text style={{fontSize: 17,fontWeight: 'bold',fontFamily: 'GmarketMedium'}}>Comments</Text>
                                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 8}}>
                                            <Image
                                                style={{width: 30, height: 30, alignSelf:'center',}}
                                                resizeMode='contain'
                                                source={require('../../assets/orange_icon.png')}
                                            />
                                            <Text style={{color:'#FF6E31',fontWeight: 'bold',fontFamily: 'GmarketMedium',fontSize: 16,}}>+50</Text>
                                        </View>
                                    </View>
                                    <Text style={{marginTop: 7,fontSize: 13,fontFamily: 'GmarketMedium'}}>Interact with others!</Text>

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
                                        <Text style={{fontSize: 17,fontWeight: 'bold',fontFamily: 'GmarketMedium'}}>Reactions</Text>
                                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 8}}>
                                            <Image
                                                style={{width: 30, height: 30, alignSelf:'center',}}
                                                resizeMode='contain'
                                                source={require('../../assets/orange_icon.png')}
                                            />
                                            <Text style={{color:'#FF6E31',fontWeight: 'bold',fontFamily: 'GmarketMedium',fontSize: 16,}}>+50</Text>
                                        </View>
                                    </View>
                                    <Text style={{marginTop: 7,fontSize: 13,fontFamily: 'GmarketMedium'}}>Spread the love!</Text>

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
                        {openHelp ? (
                            <RNScrollView>
                                <View style={[tailwind('flex flex-col items-center justify-center px-1')]}>
                                    <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 5}}>
                                        <Image
                                            style={{width: 20, height: 20}}
                                            resizeMode='contain'
                                            source={require('../../assets/nice_orange.png')}
                                        />
                                        <Text style={{fontWeight: 'bold',fontSize: 18,}}>Activity Rewards System</Text>
                                    </View>
                                    <Text style={{textAlign: 'center',marginTop: 10,}}>"Your engagement counts!</Text>
                                    <Text style={{textAlign: 'center',}}>Earn Oranges for every interaction and</Text>
                                    <Text style={{textAlign: 'center',}}>redeem them for exciting rewards."</Text>
                                </View>

                                <View style={{height: StyleSheet.hairlineWidth, width: 225, marginTop: 15,alignSelf:'center',backgroundColor: '#333',}}/>

                                {/* POSTING */}
                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop: 10,}}>
                                    <Image
                                        style={{width: 20, height: 20}}
                                        resizeMode='contain'
                                        source={require('../../assets/nice_orange.png')}
                                    />
                                    <Text style={{fontSize: 18,fontWeight: 'bold',}}>Posting</Text>
                                </View>

                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3,marginVertical: 5,}}>
                                    <Text style={{color: '#FF6B17', textDecorationLine: 'underline', fontSize: 15,fontWeight: 'bold',}}>15 Oranges</Text>
                                    <Text style={{}}>per post</Text>
                                </View>

                                <Text style={{textAlign: 'center',marginTop: 5, fontSize: 15,fontWeight: 'bold',color:'#555'}}>*Post "Like" Milestones</Text>

                                <View style={{marginTop: 8,alignSelf:'center',}}>
                                    <Text style={{color:'#555',}}>· Extra <Text style={{color:'#FF6B17',fontWeight: 'bold',textDecorationLine:'underline'}}>30 Oranges</Text> when post reaches 50 likes.</Text>
                                    <Text style={{color:'#555',}}>· Extra <Text style={{color:'#FF6B17',fontWeight: 'bold',textDecorationLine:'underline'}}>70 Oranges</Text> when post reaches 100 likes.</Text>
                                </View>

                                {/* COMMENTS */}
                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop: 30,}}>
                                    <Image
                                        style={{width: 20, height: 20}}
                                        resizeMode='contain'
                                        source={require('../../assets/nice_orange.png')}
                                    />
                                    <Text style={{fontSize: 18,fontWeight: 'bold',}}>Comments</Text>
                                </View>

                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3,marginTop: 5,}}>
                                    <Text style={{color: '#FF6B17', textDecorationLine: 'underline', fontSize: 15,fontWeight: 'bold',}}>3 Oranges</Text>
                                    <Text style={{}}>per comment</Text>
                                </View>
                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3,}}>
                                    <Text style={{color: '#FF6B17', textDecorationLine: 'underline', fontSize: 15,fontWeight: 'bold',}}>4 Oranges</Text>
                                    <Text style={{}}>per reply to Another User's Comment</Text>
                                </View>

                                {/* REACTIONS */}
                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop: 30,}}>
                                    <Image
                                        style={{width: 20, height: 20}}
                                        resizeMode='contain'
                                        source={require('../../assets/nice_orange.png')}
                                    />
                                    <Text style={{fontSize: 18,fontWeight: 'bold',}}>Reactions (Like&Repost)</Text>
                                </View>

                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3,marginTop: 5,}}>
                                    <Text style={{color: '#FF6B17', textDecorationLine: 'underline', fontSize: 15,fontWeight: 'bold',}}>2 Oranges</Text>
                                    <Text style={{}}>per like</Text>
                                </View>
                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3,}}>
                                    <Text style={{color: '#FF6B17', textDecorationLine: 'underline', fontSize: 15,fontWeight: 'bold',}}>5 Oranges</Text>
                                    <Text style={{}}>per repost</Text>
                                </View>

                                {/* MILESTONES BONUSES */}
                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',marginTop: 30,}}>
                                    <Image
                                        style={{width: 20, height: 20}}
                                        resizeMode='contain'
                                        source={require('../../assets/nice_orange.png')}
                                    />
                                    <Text style={{fontSize: 18,fontWeight: 'bold',}}>Milestones Bonuses</Text>
                                </View>

                                <Text style={{textAlign: 'center',marginTop: 5,}}>Achieve a milestone and receive</Text>
                                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3}}>
                                    <Text style={{color: '#FF6B17',fontWeight: 'bold',}}>additional Oranges</Text>
                                    <Text style={{}}>for each activity</Text>
                                </View>

                                <View style={{height: 50}}/>
                            </RNScrollView>
                        ) : openHelpClaimed ? (
                            <View style={{}}>
                                <Image
                                    style={{width: 50, height: 50, alignSelf:'center',}}
                                    resizeMode='contain'
                                    source={require('../../assets/orange_icon.png')}
                                />

                                <Text style={{textAlign: 'center',fontWeight: 'bold',fontSize: 18,marginVertical: 10,}}>Claimed Rewards</Text>

                                <Text style={{textAlign: 'center',paddingHorizontal: 5}}>The user has already claimed their Orange rewards.</Text>
                            </View>
                        ) : (
                            <View style={{}}>
                                <Image
                                    style={{width: 50, height: 50, alignSelf:'center',}}
                                    resizeMode='contain'
                                    source={require('../../assets/orange2_icon.png')}
                                />

                                <Text style={{textAlign: 'center',fontWeight: 'bold',fontSize: 18,marginVertical: 10,}}>Unclaimed Oranges</Text>

                                <Text style={{textAlign: 'center',paddingHorizontal: 5}}>The user hasn't claimed their Orange rewards yet.</Text>
                            </View>
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