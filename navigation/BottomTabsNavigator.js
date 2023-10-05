import React from 'react';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Home from '../screens/Home';
import Categories from '../screens/Categories';
import News from "../screens/News";
import Profile from '../screens/Profile';

import { NavHomeIcon, NavCategoriesIcon, NavChartIcon, NavProfileIcon } from "../components/Icons";

const Tab = createBottomTabNavigator();

const BottomTabsNavigator = ({ navigation, route }) => {

    const showIcons = (title) => {
        return (
            { 
                tabBarLabel: '',
                tabBarIcon: ({ focused, color, size }) => (
                    title == 'home' ? 
                        <NavHomeIcon color={focused ? "#FF6E31" : "#959595" }/> 
                    : title == 'cat' ? 
                        <NavCategoriesIcon color={focused ? "#FF6E31" : "#959595" }/> 
                    : title == 'news' ? 
                        <NavChartIcon color={focused ? "#FF6E31" : "#959595" }/> 
                    : 
                        <NavProfileIcon color={focused ? "#FF6E31" : "#959595" }/>
                ),
                tabBarStyle: {minHeight: 60},
                tabBarActiveTintColor: "#FF6E31",
                tabBarInactiveTintColor: "#959595"
            }
        )
    }

    return (
        <Tab.Navigator screenOptions={{ headerShown: false }} style={{minHeight: 150}}>
            <Tab.Screen name="Home" component={Home} options={showIcons('home')}/>
            <Tab.Screen name="Categories" component={Categories} options={showIcons('cat')}/>
            <Tab.Screen name="News" component={News} options={showIcons('news')}/>
            <Tab.Screen name="Profile" component={Profile} options={showIcons('profile')}/>
        </Tab.Navigator>
    )
};

export default BottomTabsNavigator
