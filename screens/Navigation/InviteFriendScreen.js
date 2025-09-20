import React, { useContext, useState } from 'react'
import { Dimensions, Image, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import * as Haptics from 'expo-haptics';

import HeaderImage from '../../components/HeaderImage';
import { GlobalContext } from '../../contexts/GlobalContext';
import moment from 'moment';
import { CheckStepIcon, CopyIcon2, NotCheckStepIcon, PeopleIcon } from '../../components/Icons';
import { Username } from '../../components/User';

const { width, height } = Dimensions.get('screen')

const InviteFriendScreen = ({navigation, route}) => {
    const { userData, setAddressCopied } = useContext(GlobalContext);

    const delay = ms => new Promise(res => setTimeout(res, ms));
    const onCopyPress = async () => {
        setAddressCopied(true)
        await delay(1000);
        setAddressCopied(false)
    }

    const tempList = [
        {
            invited_user: {
                did: "Ox91_123456789_5412"
            },
            first_step: true,
            second_step: false,
            invitation_date: "07.08.2025"
        },
        {
            invited_user: {
                did: "Ox91_123456789_5412"
            },
            first_step: true,
            second_step: true,
            invitation_date: "07.08.2025"
        },
        {
            invited_user: {
                did: "Ox91_123456789_5412"
            },
            first_step: true,
            second_step: true,
            invitation_date: "07.08.2025"
        },
        {
            invited_user: {
                did: "Ox91_123456789_5412"
            },
            first_step: false,
            second_step: false,
            invitation_date: "07.08.2025"
        },
    ]

    return (
        <View style={[{flex: 1, backgroundColor: 'white',}]}>
            <HeaderImage />

            <View style={{flexDirection: 'row',justifyContent: 'flex-start',alignItems: 'center',paddingLeft: 5,paddingTop: 4,}}>
                <TouchableOpacity style={{margin: 15,}} onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                    <Image
                        style={{width: 24,height: 24}}
                        resizeMode='contain'
                        source={require('../../assets/back_button.png')}
                        defaultSource={require('../../assets/back_button.png')}
                    />
                </TouchableOpacity>
                <Text style={{fontFamily: 'GmarketBold', fontSize: Platform.OS == 'ios' ? 18 : 16,}}>Invite Friends</Text>
            </View>

            <SafeAreaView style={{flex: 1}}>
                <ScrollView showsVerticalScrollIndicator={false}>

                    <Text style={{fontFamily:'GmarketMedium', fontSize: Platform.OS == 'ios' ? 14 : 12,marginHorizontal: 15}}>
                        Invite friends as much as you and earn together!
                    </Text>

                    <TouchableOpacity 
                        style={{height: 50, marginHorizontal: 15, justifyContent: 'center',alignItems: 'center', marginVertical: 20,borderWidth: 1,borderRadius: 25,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}
                        onPress={onCopyPress}
                    >
                        <Text style={{fontWeight: 'bold',fontSize: 16,paddingLeft: 20}}>https://coineasy.xyz</Text>
                        <CopyIcon2 style={{marginRight: 15}}/>
                    </TouchableOpacity>

                    <Text style={{fontFamily:'GmarketBold', fontSize: Platform.OS == 'ios' ? 17 : 15,marginTop: 10,marginHorizontal: 15}}>
                        Your friend must
                    </Text>

                    <View style={{marginLeft: 15, paddingRight: 5}}>
                        <View style={{marginTop: 20,width: '100%'}}>
                            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',}}>

                                <View style={{flexDirection:'row',alignItems:'center',gap: 8, flex: 1}}>
                                    <View style={{backgroundColor: '#FF6B17',width: 20,height: 20, borderRadius: 10,alignItems:'center', justifyContent:'center',}}>
                                        <Text style={{color:'white',fontFamily:'GmarketBold', fontSize: 10,}}>1</Text>
                                    </View>

                                    <Text style={{fontFamily:'GmarketMedium', fontSize: Platform.OS == 'ios' ? 15 : 13, flexShrink: 1,lineHeight: 17}}>
                                        Sign up and connect their wallet
                                    </Text>
                                </View>

                                <View style={{flexDirection:'row',alignItems:'center',gap: 2,}}>
                                    <Text style={{color: '#FF8F3D', fontFamily:'GmarketBold'}}>+30</Text>
                                    <Image
                                        style={{width: 19,height: 19,}}
                                        resizeMode='contain'
                                        source={require('../../assets/trophy/trophy_icon_orange.png')}
                                        defaultSource={require('../../assets/trophy/trophy_icon_orange.png')}
                                    />  
                                </View>
                            </View>
                        </View>

                        <View style={{marginTop: 10,width: '100%'}}>
                            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',}}>

                                <View style={{flexDirection:'row',alignItems:'center',gap: 8, flex: 1,}}>
                                    <View style={{backgroundColor: '#FF6B17',width: 20,height: 20, borderRadius: 10,alignItems:'center', justifyContent:'center',}}>
                                        <Text style={{color:'white',fontFamily:'GmarketBold', fontSize: 10,}}>2</Text>
                                    </View>

                                    <Text style={{fontFamily:'GmarketMedium', fontSize: Platform.OS == 'ios' ? 15 : 13, flexShrink: 1,lineHeight: 17}}>
                                        Complete one education course or make an on-chain action
                                    </Text>
                                </View>

                                <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center', gap: 2 }}>
                                    <Text style={{color: '#FF8F3D', fontFamily:'GmarketBold'}}>+70</Text>
                                    <Image
                                        style={{width: 19,height: 19,}}
                                        resizeMode='contain'
                                        source={require('../../assets/trophy/trophy_icon_orange.png')}
                                        defaultSource={require('../../assets/trophy/trophy_icon_orange.png')}
                                    />  
                                </View>
                            </View>
                        </View>

                        <View style={{width: '100%'}}>
                            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',}}>

                                <View style={{flexDirection:'row',alignItems:'center',gap: 5, flex: 1,}}>
                                    <View style={{backgroundColor: 'transparent',width: 20,height: 20, borderRadius: 10,alignItems:'center', justifyContent:'center',}}>
                                        <Text style={{color:'white',fontFamily:'GmarketBold', fontSize: 10,}}>2</Text>
                                    </View>

                                    <Text style={{fontFamily:'GmarketMedium',marginTop: 15,fontSize: Platform.OS == 'ios' ? 15 : 13,}}>
                                        Max 5 rewards/day.
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <View style={{backgroundColor: '#FEF5F3',borderRadius: 5,paddingHorizontal: 10,marginHorizontal: 15, padding: 20, marginTop: 20,}}>
                        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',}}>
                            <Text style={{fontFamily:'GmarketMedium', fontSize: Platform.OS == 'ios' ? 15 : 13,paddingLeft: 10}}>
                                Friends You've Invited
                            </Text>

                            <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 5}}>
                                <PeopleIcon />
                                <Text style={{fontFamily:'GmarketBold', fontSize: Platform.OS == 'ios' ? 17 : 15,marginTop: 1,}}>
                                    {userData.friendsInvited ?? 0}
                                </Text>
                            </View>
                        </View>

                        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop: 20,}}>
                            <Text style={{fontFamily:'GmarketMedium', fontSize: Platform.OS == 'ios' ? 15 : 13,paddingLeft: 10}}>
                                Oranges You've Earned
                            </Text>

                            <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 3}}>
                                <Image
                                    style={{width: 19,height: 19,}}
                                    resizeMode='contain'
                                    source={require('../../assets/trophy/trophy_icon_orange.png')}
                                    defaultSource={require('../../assets/trophy/trophy_icon_orange.png')}
                                />  
                                <Text style={{fontFamily:'GmarketBold', fontSize: Platform.OS == 'ios' ? 17 : 15,}}>
                                    {userData.friendsInvited ?? 0}
                                </Text>
                            </View>
                        </View>
                        
                    </View>

                    <Text style={{fontFamily:'GmarketBold', fontSize: Platform.OS == 'ios' ? 17 : 15,marginTop: 20,marginBottom: 10, marginHorizontal: 15}}>
                        Invited friend
                    </Text>

                    {tempList.map((friend, index) => {
                        if(friend.first_step){
                            return(
                                <View 
                                    key={"invited_friend_"+index}
                                    style={{
                                        backgroundColor: friend.second_step ? '#FFF0E2' : '#F4F3F2',
                                        marginHorizontal: 15,
                                        borderRadius: 5,
                                        marginVertical: 5,
                                        padding: 15 
                                    }}
                                >
                                    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',}}>
                                        <Username details={friend.invited_user} fontSize={15} style={{fontFamily: 'GmarketMedium'}}/>
                                        <View style={{flexDirection:'row',alignItems:'center',gap: 5}}>
                                            <Image
                                                style={{width: 19,height: 19,}}
                                                resizeMode='contain'
                                                source={require('../../assets/trophy/trophy_icon_orange.png')}
                                                defaultSource={require('../../assets/trophy/trophy_icon_orange.png')}
                                            />
                                            <Text style={{fontFamily:'GmarketBold',marginTop: 1,fontSize: Platform.OS == 'ios' ? 17 : 15,}}>
                                                {friend.second_step ? '100' : friend.first_step ? '30' : '0'}
                                            </Text>
                                        </View>
                                    </View>
    
                                    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop: 15,}}>
                                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 15}}>
                                            <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 5}}>
                                                <Text style={{
                                                    color: friend.first_step ? '#454545' : '#999',
                                                    fontFamily:'GmarketMedium',
                                                    fontSize: Platform.OS == 'ios' ? 14 : 12,
                                                    marginTop: 1
                                                }}>
                                                    Step 1
                                                </Text>
                                                {friend.first_step ? <CheckStepIcon /> : <NotCheckStepIcon />}
                                            </View>
                                            <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 5}}>
                                                <Text style={{
                                                    color: friend.second_step ? '#454545' : '#999',
                                                    fontFamily:'GmarketMedium',
                                                    fontSize: Platform.OS == 'ios' ? 14 : 12,
                                                    marginTop: 1
                                                }}>
                                                    Step 2
                                                </Text>
                                                {friend.second_step ? <CheckStepIcon /> : <NotCheckStepIcon />}
                                            </View>
                                        </View>
                                        
                                        <Text style={{color:'#999', fontFamily:'GmarketMedium',fontSize: Platform.OS == 'ios' ? 15 : 13,}}>
                                            {friend.invitation_date}
                                        </Text>
                                    </View>
                                </View>
                            )
                        }
                    })}

                    {/* {userData.listInvitedFriend ? userData.listInvitedFriend.map(friend => {
                        return(
                            <View style={{backgroundColor: 'red',marginHorizontal: 15, height: 30}}>
                                
                            </View>
                        )
                    }) : (
                        <View style={{marginTop: 20,backgroundColor: '#F4F3F2',marginHorizontal: 15,borderRadius: 5,height: 70, justifyContent:'center',}}>
                            <Text style={{textAlign: 'center',color:'#999'}}>No friend has been invited</Text>
                        </View>
                    )} */}

                    <View style={{height: 100}} />
                </ScrollView>
            </SafeAreaView>
        </View>
    )
}

export default InviteFriendScreen

const styles = StyleSheet.create({
  tabContainer: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F6F7FC",
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: "#f97316",
  },
  categoryText: {
    fontSize: 14,
    color: "#454545",
  },
  categoryTextActive: {
    color: "#ffffff",
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FEF5F3",
    padding: 16,
    paddingVertical: 20,
    borderRadius: 16,
    marginVertical: 5,
    marginHorizontal: 10,
  },
  title: {
    fontFamily: 'GmarketMedium',
    fontSize: Platform.OS == 'ios' ? 17 : 15,
    color: "#1f2937",
  },
  subtitle: {
    fontFamily:'GmarketMedium',
    fontSize: Platform.OS == 'ios' ? 13 : 11,
    color: "#999",
  },
  date: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  orangeCount: {
    fontFamily: 'GmarketBold',
    fontSize: Platform.OS == 'ios' ? 18 : 16,
    color: "#000",
  },
});