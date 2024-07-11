import React, { useContext } from 'react'
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import HeaderImage from '../../components/HeaderImage';
import { GlobalContext } from '../../contexts/GlobalContext';
import moment from 'moment';

const {width, height} = Dimensions.get('window')


const RewardHistory = ({navigation, route}) => {
    const { orbis, user } = useContext(GlobalContext);

    const tailwind = useTailwind();

    const tempList = user?.profile?.data?.listClaimedOranges
    // const tempList = user?.profile?.data?.listClaimedOranges ?? [
    // {
    //         date: '2024-06-01',
    //         listOranges: [
    //             {
    //                 numberOranges: 10,
    //                 type: 'Daily Check-in'
    //             },
    //         ]
    //     },
    //     {
    //         date: '2024-05-31',
    //         listOranges: [
    //             {
    //                 numberOranges: 20,
    //                 type: '7-Day Streak Bonus'
    //             },
    //         ]
    //     },
    //     {
    //         date: '2024-05-30',
    //         listOranges: [
    //             {
    //                 numberOranges: 5,
    //                 type: 'Daily Check-in'
    //             },
    //         ]
    //     },
    //     {
    //         date: '2024-05-29',
    //         listOranges: [
    //             {
    //                 numberOranges: 10,
    //                 type: 'Daily Check-in'
    //             },
    //             {
    //                 numberOranges: 50,
    //                 type: 'Ad Rewards'
    //             },
    //             {
    //                 numberOranges: 10,
    //                 type: 'Invite Friends'
    //             },
    //         ]
    //     },
    //     {
    //         date: '2024-05-28',
    //         listOranges: [
    //             {
    //                 numberOranges: 10,
    //                 type: 'Daily Check-in'
    //             },
    //             {
    //                 numberOranges: 20,
    //                 type: '14-Day Streak Bonus'
    //             },
    //             {
    //                 numberOranges: 10,
    //                 type: 'Invite Friends'
    //             },
    //         ]
    //     },
    // ]

    return (
        <View style={[tailwind('flex flex-1 flex-col'),{backgroundColor: 'white',}]}>
            <HeaderImage />

            <View style={{backgroundColor: 'white',flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',paddingLeft: 5,paddingRight: 20,paddingTop: 4}}>
                <TouchableOpacity style={{margin: 15,}} onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                    <Image
                        style={{width: 24,height: 24}}
                        resizeMode='contain'
                        source={require('../../assets/back_button.png')}
                        defaultSource={require('../../assets/back_button.png')}
                    />
                </TouchableOpacity>
            </View>

            <ScrollView style={{}}>
                {tempList && tempList.length > 0 ? tempList.map((e, ind) => {
                    return(
                        <View key={Math.random()}>
                            <View style={{paddingHorizontal: 20,marginBottom: 20,marginTop: ind == 0 ? 0 : 10,}} key={Math.random()}>
                                <Text style={{color:'#959595',fontSize: 15,}}>{moment(e.date).format('MMMM Do')}</Text>

                                {e.listOranges.map((elt, index) => {
                                    return(
                                        <View style={{flexDirection:'row',alignItems:'center',gap: 10,marginTop: index == 0 ? 10 : 20,}} key={Math.random()}>
                                            <Image
                                                style={{width: 40, height: 40}}
                                                resizeMode='contain'
                                                source={require('../../assets/orange_icon.png')}
                                            />

                                            {elt.type.includes('Streak Bonus') ? (
                                                <View style={{}}>
                                                    <Text style={{color: '#FF6B17', fontSize: 15,}}>+ {elt.numberOranges} Oranges</Text>
                                                    <Text style={{color:'#FF6B17', fontSize: 15,}}>{elt.type}</Text>
                                                </View>
                                            ) : (
                                                <View style={{}}>
                                                    <Text style={{}}>{elt.numberOranges} Oranges</Text>
                                                    <Text style={{color:'#959595'}}>{elt.type}</Text>
                                                </View>

                                            )}
                                        </View>
                                    )
                                })}

                            </View>
                            <View style={{height: StyleSheet.hairlineWidth, width: width,backgroundColor: '#DCDCDC',}} />
                        </View>
                    )
                }) : (
                    <Text style={{textAlign: 'center',marginTop: 10,color: '#b8b8b8'}}>You don't have any Rewards</Text>
                )}

                <View style={{height: 50}}/>
            </ScrollView>


        </View>
    )
}

export default RewardHistory

const styles = StyleSheet.create({})