import React from 'react'
import { StyleSheet } from 'react-native'
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';

import BottomTabsNavigator from './BottomTabsNavigator';
import ProfileSelected from '../screens/Navigation/Profile/ProfileSelected';
import Notifications from '../screens/Navigation/Notifications';
import PostDetails from '../screens/Navigation/PostDetails';
import FollowNavigation from '../screens/Navigation/Follow/FollowNavigation';
import FlashMessage from 'react-native-flash-message';
import ConversationScreen from '../screens/Navigation/Chat/ConversationScreen';
import ConversationDetails from '../screens/Navigation/Chat/ConversationDetails';
import OrangeReward from '../screens/Navigation/OrangeReward';
import RewardHistory from '../screens/Navigation/RewardHistory';
import ActivityReward from '../screens/Navigation/ActivityReward';

// const Stack = createNativeStackNavigator();

const Stack = createStackNavigator();

const AppNavigator = (props) => {
    return (
        <>
            <NavigationContainer>
                <Stack.Navigator>
                    <Stack.Screen name="Navigator" component={BottomTabsNavigator} options={{ headerShown: false, gestureEnabled: true }} />
                    <Stack.Screen name="ProfileSelected" component={ProfileSelected} options={{ headerShown: false, gestureEnabled: true }} />
                    <Stack.Screen name="Notifications" component={Notifications} options={{ headerShown: false, gestureEnabled: true }} />
                    <Stack.Screen name="PostDetails" component={PostDetails} options={{ headerShown: false, gestureEnabled: true }} />
                    <Stack.Screen name="FollowNavigation" component={FollowNavigation} options={{ headerShown: false, gestureEnabled: true }} />
                    <Stack.Screen name="ConversationScreen" component={ConversationScreen} options={{ headerShown: false, gestureEnabled: true }} />
                    <Stack.Screen name="ConversationDetails" component={ConversationDetails} options={{ headerShown: false, gestureEnabled: true }} />
                    <Stack.Screen name="OrangeReward" component={OrangeReward} options={{ headerShown: false, gestureEnabled: true }} />
                    <Stack.Screen name="RewardHistory" component={RewardHistory} options={{ headerShown: false, gestureEnabled: true }} />
                    <Stack.Screen name="ActivityReward" component={ActivityReward} options={{ headerShown: false, gestureEnabled: true }} />
                </Stack.Navigator>
            </NavigationContainer>

            <FlashMessage position="top" statusBarHeight={40} style={{position: 'absolute',zIndex: 9999999999}}/>
        </>
    )
}

export default AppNavigator

const styles = StyleSheet.create({

})
