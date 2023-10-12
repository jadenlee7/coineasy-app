import React, { useContext, useState, useEffect } from "react";
import { View, ActivityIndicator, ScrollView, Text, TouchableHighlight, Dimensions, Image, TouchableOpacity } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import { context } from "../../utils/config";
import TimeAgo from "../../components/TimeAgo";
import { UserPfp, Username } from "../../components/User";
import { GlobalContext } from "../../contexts/GlobalContext";
import useStatusBarHeight from "../../hooks/useStatusBarHeight";
import { BackIcon, InterpunctIcon, NotificationsIcon } from "../../components/Icons";

const Notifications = ({navigation, route}) => {
    const { orbis } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const [ notifications, setNotifications ] = useState([]);
    const [ notificationsLoading, setNotificationsLoading ] = useState(false);

    const statusBarHeight = useStatusBarHeight();

    /** Check if user liked this post */
    useEffect(() => {
        getNotifications();

        /** Will load main post details */
        async function getNotifications() {
        setNotificationsLoading(true);
        let { data, error } = await orbis.getNotifications({
            type: 'social',
            context: context,
            include_child_contexts: true
        });

        if(data) {
            setNotifications(data);
            setNotificationsLoading(false);
        }
        }
    }, []);

    const Notification = ({notification}) => {
        const { setPostDetailsVis, setNotificationsVis} = useContext(GlobalContext);
        const tailwind = useTailwind();
      
        function selectNotif() {
            switch (notification.family) {
                /** Open post details */
                case "reaction":
                    setNotificationsVis(false);
                    setPostDetailsVis(notification?.post_details?.stream_id);
                    break;
        
                /** Open post details */
                case "reply_to":
                    setNotificationsVis(false);
                    setPostDetailsVis(notification?.post_details?.stream_id);
                    break;
            }
        }
      
        return(
            <TouchableHighlight style={tailwind("items-center flex flex-row border-b border-secondary py-3 px-6 ")} underlayColor="#f1f5f9" onPress={() => selectNotif()}>
                <>
                    <UserPfp details={notification.user_notifiying_details} />
                    <View style={{marginLeft: 13}}>
                        <View style={tailwind("flex flex-row items-center mb-1")}>
                            <Text style={tailwind("text-secondary")}>
                                <Username details={notification.user_notifiying_details} />
                            </Text>
                
                            <View style={[tailwind('ml-2 mr-2')]}>
                                <InterpunctIcon />
                            </View>
                
                            <Text style={[tailwind('text-secondary'), { marginRight: 6 }]}>
                                <TimeAgo timestamp={notification.notification_timestamp} />
                            </Text>
                        </View>
                        <NotificationAction notification={notification} />
                    </View>
                </>
            </TouchableHighlight>
        )
    }
    
    const NotificationAction = ({notification}) => {
        const tailwind = useTailwind();
        switch (notification.family) {
        case "reaction":
            return(
                <Text style={tailwind("text-secondary")}>Reacted to your post</Text>
            );
        case "reply_to":
            return(
                <Text style={tailwind("text-secondary")}>Replied to your post</Text>
            );
        }
    }


    return(
        <View style={[tailwind('flex flex-1 flex-col'),{backgroundColor: 'white',}]}>
            <Image
                style={{ 
                    width: Dimensions.get('window').width,
                    height: 40 + statusBarHeight,
                    paddingTop: statusBarHeight,
                }}
                source={require('../../assets/HeaderBg.png')} 
            />

            <View style={{backgroundColor: 'white',flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',paddingLeft: 5,paddingRight: 20,paddingTop: 5}}>
                <TouchableOpacity onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                    <View style={{zIndex:100000, justifyContent: 'center',alignItems: 'center',margin: 15, backgroundColor: 'white',flexDirection:'row',}}>
                        <BackIcon />
                        <Text style={[tailwind('text-slate-900 ml-3'), { fontFamily: "GmarketMedium" }]}>Back</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.7} onPress={() => {Haptics.selectionAsync();navigation.navigate('Notifications')}}>
                    <NotificationsIcon />
                </TouchableOpacity>
            </View>

            {notificationsLoading ?
                <ActivityIndicator style={{marginTop: 50}} size="small" color="#020617" />
            : notifications && notifications.length > 0 ?
                <ScrollView>
                    {notifications.map((notification, key) => {
                        return (
                            <Notification notification={notification} key={key} />
                        );
                    })}
                </ScrollView>
            :
                <View style={tailwind('bg-slate-50 px-2 py-4 items-center mt-4 mx-6 rounded-md')} >
                    <Text style={tailwind('text-secondary items-center ml-1')}>You don't have any notifications.</Text>
                </View>
            }
        </View>
    )
}

export default Notifications
