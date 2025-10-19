import React, { useContext } from 'react';
import { View } from 'react-native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Home from '../screens/Home';
import Categories from '../screens/Categories';
import News from "../screens/News";
import Profile from '../screens/Profile';
import * as Haptics from 'expo-haptics';

import { NavHomeIcon, NavCategoriesIcon, NavChartIcon, NavProfileIcon, NavSearchIcon, NavCourseIcon, NavOrangeIcon, NewsIcon } from "../components/Icons";
import Search from '../screens/Search';
import { GlobalContext } from '../contexts/GlobalContext';
import NewFeatureModal from '../components/modals/NewFeatureModal';
import Trophies from '../screens/Trophies';
// import OrangeReward from '../screens/Navigation/OrangeReward';
import OrangeNavigation from '../screens/Navigation/OrangeNavigation';

const Tab = createBottomTabNavigator();

const BottomTabsNavigator = ({ navigation, route }) => {
    const { newFeatureVis } = useContext(GlobalContext);

    const showIcons = (title) => {
        return (
            { 
                tabBarLabel: '',
                tabBarIcon: ({ focused, color, size }) => (
                    title == 'home' ? 
                        <View style={{marginTop: '20%',marginLeft: 35,width: 60,alignItems: 'center',}}>
                            <NavHomeIcon color={focused ? "#FF6E31" : "#959595" } /> 
                        </View>
                    : title == 'cat' ? 
                        <View style={{marginTop: '20%',marginLeft: 20,width: 60,alignItems: 'center',}}>
                            {/* <NavCategoriesIcon color={focused ? "#FF6E31" : "#959595" }/>  */}
                            <NavCourseIcon color={focused ? "#FF6E31" : "#959595" }/> 
                        </View>
                    : title == 'trophies' ? 
                        <View style={{marginTop: '20%',marginLeft: 20,width: 60,alignItems: 'center',}}>
                            <NavCourseIcon color={focused ? "#FF6E31" : "#959595" }/> 
                        </View>
                    : title == 'news' ? 
                        <View style={{marginTop: '20%',width: 60,alignItems: 'center',}}>
                            <NewsIcon color={focused ? "#FF6E31" : "#959595" }/> 
                        </View>
                    : title == 'search' ? 
                        <View style={{marginTop: '20%',marginRight: 20,width: 60,alignItems: 'center',}}>
                            <NavSearchIcon color={focused ? "#FF6E31" : "#959595" }/> 
                        </View>
                    : title == 'orange' ? 
                        <View style={{marginTop: '20%',marginRight: 20,width: 60,alignItems: 'center',}}>
                            <NavOrangeIcon color={focused ? "#FF6E31" : "#959595" }/> 
                        </View>
                    : 
                        <View style={{marginTop: '20%',marginRight: 35,width: 60,alignItems: 'center',}}>
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
                lazy: false
            }
        )
    }
    

    return (
        <>
            <Tab.Navigator screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }} style={{minHeight: 150}}>
                <Tab.Screen name="Home" component={Home} options={showIcons('home')}
                    listeners={{
                        tabPress: (e) => {
                            Haptics.selectionAsync();
                        },
                    }}
                />
                <Tab.Screen name="Trophies" component={Trophies} options={showIcons('trophies')}
                    listeners={{
                        tabPress: (e) => {
                            Haptics.selectionAsync();
                        },
                    }}                
                />
                {/* <Tab.Screen name="Categories" component={Categories} options={showIcons('cat')}
                    listeners={{
                        tabPress: (e) => {
                            Haptics.selectionAsync();
                        },
                    }}                
                /> */}
                <Tab.Screen name="News" component={News} options={showIcons('news')}
                    listeners={{
                        tabPress: (e) => {
                            Haptics.selectionAsync();
                        },
                    }}                
                />
                <Tab.Screen name="Orange" component={OrangeNavigation} options={showIcons('orange')}
                    listeners={{
                        tabPress: (e) => {
                            Haptics.selectionAsync();
                        },
                    }}                
                />
                <Tab.Screen name="Profile" component={Profile} options={showIcons('profile')}
                    listeners={{
                        tabPress: (e) => {
                            Haptics.selectionAsync();
                        },
                    }}                
                />
            </Tab.Navigator>


            {newFeatureVis && (
                <View style={{
                    zIndex: 9999,
                    position: 'absolute',
                    flex: 1,
                    width: '100%',
                    height:'100%',
                }}>
                    <NewFeatureModal />
                </View>
            )}
        </>
    )
};

export default BottomTabsNavigator