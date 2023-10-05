import React from 'react'
import { StyleSheet } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';

import BottomTabsNavigator from './BottomTabsNavigator';
import ProfileSelected from '../screens/Navigation/ProfileSelected';
import Notifications from '../screens/Navigation/Notifications';
import PostDetails from '../screens/Navigation/PostDetails';

const Stack = createNativeStackNavigator();

const AppNavigator = (props) => {
    return (
        <NavigationContainer>
            <Stack.Navigator>
                <Stack.Screen name="Navigator" component={BottomTabsNavigator} options={{ headerShown: false }} />
                <Stack.Screen name="ProfileSelected" component={ProfileSelected} options={{ headerShown: false }} />
                <Stack.Screen name="Notifications" component={Notifications} options={{ headerShown: false }} />
                <Stack.Screen name="PostDetails" component={PostDetails} options={{ headerShown: false }} />
            </Stack.Navigator>
        </NavigationContainer>
    )
}

export default AppNavigator

const styles = StyleSheet.create({

})
