import React, { useCallback, useContext, useEffect, useState } from "react";
import { ScrollView, RefreshControl, Text, View, TouchableOpacity, Image as RNImage, TouchableHighlight, Animated, Dimensions, BackHandler, ActivityIndicator, StyleSheet, Image, Platform } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import { useFocusEffect } from '@react-navigation/native';

import { GlobalContext } from "../contexts/GlobalContext";
import HeaderImage from "../components/HeaderImage";
import TrophieCoineasy from "./Navigation/Trophies/TrophieCoineasy";
import TrophieProject from "./Navigation/Trophies/TrophieProject";
import { TabBar, TabView } from "react-native-tab-view";
import useStatusBarHeight from "../hooks/useStatusBarHeight";
import Header from "../components/Header";

const TabBarHeight = 50;
const IndicatorWidth = 50

const windowSize = Dimensions.get('window')

const Trophies = ({ navigation, route }) => {
    const { orbis, 
        userData,
        currentRoute, 
        selectedNews,setSelectedNews, 
        category, 
        setCategory, 
        setScrollAnim, 
        setOffsetAnim, 
        selectedCategory, 
        setSelectedCategory, 
        setCurrentRoute,
        tabViewHeight
    } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const statusBarHeight = useStatusBarHeight();
    

    useFocusEffect(
        React.useCallback(() => {
            setCurrentRoute(route.name)
        }, [])
    );

    const backhandler = BackHandler.addEventListener('hardwareBackPress', function () {
        Haptics.selectionAsync()
        if(currentRoute == 'Categories'){
            if (selectedCategory) {
                setSelectedCategory(null)
                return true;
            }else{
                setScrollAnim(new Animated.Value(0))
                setOffsetAnim(new Animated.Value(0))
                navigation.goBack()
                return true;
            }
        } else if(currentRoute == 'News'){
            if (selectedNews) {
                setSelectedNews(null)
                return true;
            }else{
                setScrollAnim(new Animated.Value(0));
                setOffsetAnim(new Animated.Value(0));
                navigation.goBack()
                return true;
            }
        } else if(currentRoute == 'Home'){
            if (category) {
                setCategory(null)
            }
            setScrollAnim(new Animated.Value(0));
            setOffsetAnim(new Animated.Value(0));
            navigation.replace('Navigator')
            return true
        }
    });

    useEffect(() => {
        return () => backhandler.remove();
    }, [navigation])


    const [tabIndex, setIndex] = useState(0);
    const routes = [
        {key:0, title: 'EASYEDU'},
        {key:1, title: 'Project'},
    ];
    
    const renderLabel = ({route, focused}) => { 
        return ( 
            <Text style={[styles.label, {opacity: focused ? 1 : 0.5}]}>{route.title}</Text>
        );
    };

    const renderScene = ({route}) => {
        if(route.key == 0 ) return (
            <ScrollView>
                <TrophieCoineasy />
            </ScrollView>
        )
        if(route.key == 1 ) return (
            <ScrollView>
                <TrophieProject />
            </ScrollView>
        )
    }
 
    const renderTabBar = (props) => {
        return (
            <TabBar
                {...props}
                style={styles.tab}
                renderLabel={renderLabel}
                indicatorStyle={[styles.indicator, { width: IndicatorWidth, left: (windowSize.width / 2 - IndicatorWidth) / 2, }]}
            />
        );
    };


    return(
        <View style={tailwind('flex flex-1 bg-white')}>
            <Header />

            <Text style={[
                tailwind('text-slate-900 p-5'), 
                { 
                    fontSize: 16,
                    fontFamily: "GmarketBold",
                    lineHeight: 20,
                    marginTop: statusBarHeight > 25 ? 65 + statusBarHeight : 80 + statusBarHeight
                }]}
            >
                What Section do you want?
            </Text>

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

const styles = StyleSheet.create({
    label: {
        fontSize: Platform.OS == 'ios' ? 16 : 14,
        marginTop: 8,
        fontFamily: "GmarketBold",
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

export default Trophies
