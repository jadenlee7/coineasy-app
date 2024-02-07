import React from 'react'
import { StyleSheet } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';

import BottomTabsNavigator from './BottomTabsNavigator';
import ProfileSelected from '../screens/Navigation/Profile/ProfileSelected';
import Notifications from '../screens/Navigation/Notifications';
import PostDetails from '../screens/Navigation/PostDetails';
import FollowNavigation from '../screens/Navigation/Follow/FollowNavigation';
import FlashMessage from 'react-native-flash-message';
import ConversationScreen from '../screens/Navigation/Chat/ConversationScreen';
import ConversationDetails from '../screens/Navigation/Chat/ConversationDetails';

const Stack = createNativeStackNavigator();

const AppNavigator = (props) => {
    return (
        <>
            <NavigationContainer>
                <Stack.Navigator>
                    <Stack.Screen name="Navigator" component={BottomTabsNavigator} options={{ headerShown: false,animation: 'none' }} />
                    <Stack.Screen name="ProfileSelected" component={ProfileSelected} options={{ headerShown: false,animation: 'none' }} />
                    <Stack.Screen name="Notifications" component={Notifications} options={{ headerShown: false,animation: 'none' }} />
                    <Stack.Screen name="PostDetails" component={PostDetails} options={{ headerShown: false,animation: 'none' }} />
                    <Stack.Screen name="FollowNavigation" component={FollowNavigation} options={{ headerShown: false,animation: 'none' }} />
                    <Stack.Screen name="ConversationScreen" component={ConversationScreen} options={{ headerShown: false,animation: 'none' }} />
                    <Stack.Screen name="ConversationDetails" component={ConversationDetails} options={{ headerShown: false,animation: 'none' }} />
                </Stack.Navigator>
            </NavigationContainer>

            <FlashMessage position="top" statusBarHeight={40}/>
        </>
    )
}

export default AppNavigator

const styles = StyleSheet.create({

})
