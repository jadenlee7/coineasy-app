import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Dimensions, Easing, Image, ImageBackground, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { ScrollView } from 'react-native-gesture-handler';


import HeaderImage from '../../components/HeaderImage';
import { GlobalContext } from '../../contexts/GlobalContext';

import moment from 'moment-timezone';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import { TabBar, TabView } from 'react-native-tab-view';
import useStatusBarHeight from '../../hooks/useStatusBarHeight';
import OrangeReward from './Oranges/OrangeReward';
import ShopScreen from './Oranges/ShopScreen';
import GiftScreen from './Oranges/GiftScreen';


const TabBarHeight = 50;
const IndicatorWidth = 50

const windowSize = Dimensions.get('window')

const OrangeNavigation = ({navigation, route}) => {
    const { 
        userData,
        tabViewHeight
    } = useContext(GlobalContext);
    const tailwind = useTailwind();      
    const statusBarHeight = useStatusBarHeight();

    const showBack = route.params?.back
    

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

    const renderScene = ({route}) => {
        if(route.key == 0 ) return (
            <ScrollView>
                <OrangeReward />
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
            <HeaderImage />

            {showBack && (
                <TouchableOpacity style={{position: 'absolute',left: 20, top: Platform.OS == 'ios' && statusBarHeight > 25 ? 60 : Platform.OS == 'ios' ? 70 : statusBarHeight > 25 ? 55 : 60}} onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                    <Image
                        style={{width: 24,height: 24}}
                        resizeMode='contain'
                        source={require('../../assets/back_button.png')}
                        defaultSource={require('../../assets/back_button.png')}
                    />
                </TouchableOpacity>
            )}

            <TouchableOpacity 
                onPress={() => {Haptics.selectionAsync();navigation.navigate('OrangeNavigation')}}
                style={{
                    position: 'absolute',
                    top: statusBarHeight > 25 ? 50 : 60,
                    right: 10,
                    borderRadius: 30,
                    backgroundColor: '#FFF2E2',
                    flexDirection:'row',
                    gap: 6,
                    alignSelf:'flex-end',
                    marginRight: 5,
                    paddingVertical: 5,
                    paddingHorizontal:10,
                    alignItems:'center'
                }}
            >
                <Image
                    style={{width: 15, height: 15}}
                    resizeMode='contain'
                    source={require('../../assets/trophy/trophy_icon_orange.png')}
                />
                <Text style={{fontWeight: 'bold',textAlign: 'center',color:'#FB5100', marginTop: Platform.OS == 'ios' ? 2 : 0,}}>
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
            </TouchableOpacity>


            <View style={[tailwind('flex flex-1 flex-col'),{backgroundColor: 'white',}]}>
                <TabView
                    navigationState={{index: tabIndex, routes}}
                    renderScene={renderScene}
                    renderTabBar={renderTabBar}
                    onIndexChange={setIndex}
                    initialLayout={{width: windowSize.width}}
                    style={{height: tabViewHeight,}}
                />
            </View>
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