import React from 'react';
import { View } from 'react-native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Home from '../screens/Home';
import Categories from '../screens/Categories';
import News from "../screens/News";
import Profile from '../screens/Profile';
import * as Haptics from 'expo-haptics';

import { NavHomeIcon, NavCategoriesIcon, NavChartIcon, NavProfileIcon } from "../components/Icons";

const Tab = createBottomTabNavigator();

const BottomTabsNavigator = ({ navigation, route }) => {

    const showIcons = (title) => {
        return (
            { 
                tabBarLabel: '',
                tabBarIcon: ({ focused, color, size }) => (
                    title == 'home' ? 
                        <View style={{marginTop: '20%',marginLeft: 24,}}>
                            <NavHomeIcon color={focused ? "#FF6E31" : "#959595" } /> 
                        </View>
                    : title == 'cat' ? 
                        <View style={{marginTop: '20%',marginLeft: 10,}}>
                            <NavCategoriesIcon color={focused ? "#FF6E31" : "#959595" }/> 
                        </View>
                    : title == 'news' ? 
                        <View style={{marginTop: '20%',marginRight: 10,}}>
                            <NavChartIcon color={focused ? "#FF6E31" : "#959595" }/> 
                        </View>
                    : 
                        <View style={{marginTop: '20%',marginRight: 24,}}>
                            <NavProfileIcon color={focused ? "#FF6E31" : "#959595" }/>
                        </View>
                ),
                tabBarStyle: {
                    minHeight: 60,
                    borderTopWidth: 0,
                    elevation: 0,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0,
                },
                tabBarActiveTintColor: "#FF6E31",
                tabBarInactiveTintColor: "#959595",
                lazy: 'false'
            }
        )
    }

    // useEffect(() => {
    //     navigation.addListener('tabPress', (e) => {
    //         Haptics.selectionAsync();
    //     });
    // }, [])
    

    return (
        <Tab.Navigator screenOptions={{ headerShown: false }} style={{minHeight: 150}}>
            <Tab.Screen name="Home" component={Home} options={showIcons('home')}
                listeners={{
                    tabPress: (e) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    },
                }}
            />
            <Tab.Screen name="Categories" component={Categories} options={showIcons('cat')}
                listeners={{
                    tabPress: (e) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    },
                }}                />
            <Tab.Screen name="News" component={News} options={showIcons('news')}
                listeners={{
                    tabPress: (e) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    },
                }}                />
            <Tab.Screen name="Profile" component={Profile} options={showIcons('profile')}
                listeners={{
                    tabPress: (e) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    },
                }}                />
        </Tab.Navigator>
    )
};

export default BottomTabsNavigator
