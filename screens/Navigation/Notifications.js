import React, { useContext, useState, useEffect } from "react";
import { View, ActivityIndicator, ScrollView, Text, TouchableHighlight, Dimensions, Image, TouchableOpacity, RefreshControl } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import { context } from "../../utils/config";
import TimeAgo from "../../components/TimeAgo";
import { UserPfp, Username } from "../../components/User";
import { GlobalContext } from "../../contexts/GlobalContext";
import useStatusBarHeight from "../../hooks/useStatusBarHeight";
import { BackIcon, FilterIcon, InterpunctIcon, NotificationsIcon } from "../../components/Icons";
import HeaderImage from "../../components/HeaderImage";
import Modal from "../../components/Modal";


const Notifications = ({navigation, route}) => {
    const { orbis } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const [ notifications, setNotifications ] = useState([]);
    const [ notificationsLoading, setNotificationsLoading ] = useState(false);
    const [refreshing, setRefreshing] = useState(false)
    const [showFilter, setShowFilter] = useState(false)
    const [checked, setChecked] = useState([]);
    const [loading, setLoading] = useState(false);

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
                    Haptics.selectionAsync();
                    setPostDetailsVis(notification?.post_details?.stream_id)
                    navigation.navigate('PostDetails')
                    break;
        
                /** Open post details */
                case "reply_to":
                    Haptics.selectionAsync();
                    setPostDetailsVis(notification?.post_details?.stream_id)
                    navigation.navigate('PostDetails')
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

    async function updateNotifications() {
        setRefreshing(true)
        let { data, error } = await orbis.getNotifications({
            type: 'social',
            context: context,
            include_child_contexts: true
        });

        if(data) {
            setNotifications(data);
        }

        setRefreshing(false)
    }

    const list_filters = [
        {label: 'Reactions'},
        {label: 'Replies'},
    ];
    // const list_filters = [
    //     {label: 'Follows'},
    //     {label: 'Likes'},
    //     {label: 'Replies'},
    //     {label: 'Mentions'},
    //     {label: 'Reposts'},
    //     {label: 'Quotes'},
    //     {label: 'News'},
    // ];

    const onFilterPress = (filter) => {
        const filterType = filter.label == 'Reactions' ? 'reaction' : 'reply_to'
        const indexItem = checked.findIndex(e => e == filterType)
        if(indexItem != -1){
            checked.splice(indexItem, 1)
        }else{
            checked.push(filterType)
        }

        console.log(checked);

        setChecked([...checked])
    }

    return(
        <View style={[tailwind('flex flex-1 flex-col'),{backgroundColor: 'white',}]}>
            <HeaderImage />

            <View style={{backgroundColor: 'white',flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',paddingLeft: 5,paddingRight: 20,paddingTop: 4}}>
                {/* <TouchableOpacity onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                    <View style={{zIndex:100000, justifyContent: 'center',alignItems: 'center',margin: 15, backgroundColor: 'white',flexDirection:'row',}}>
                        <BackIcon />
                        <Text style={[tailwind('text-slate-900 ml-3'), { fontFamily: "GmarketMedium" }]}>Back</Text>
                    </View>
                </TouchableOpacity> */}

                <TouchableOpacity style={{margin: 15,}} onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                    <Image
                        style={{width: 24,height: 24}}
                        resizeMode='contain'
                        source={require('../../assets/back_button.png')}
                        defaultSource={require('../../assets/back_button.png')}
                    />
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.7} onPress={() => {Haptics.selectionAsync();setShowFilter(true)}}>
                    <FilterIcon />
                </TouchableOpacity>
            </View>

            {notificationsLoading ?
                <ActivityIndicator style={{marginTop: 50}} size="small" color="#020617" />
            : notifications && notifications.length > 0 ?
                <ScrollView
                    refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={updateNotifications} /> }
                >
                    {notifications.map((notification, key) => {
                        if(checked.length != 0){
                            if(checked.includes(notification.family)){
                                return (
                                    <Notification notification={notification} key={key} />
                                );
                            }
                        }else{
                            return (
                                <Notification notification={notification} key={key} />
                            );
                        }
                    })}
                </ScrollView>
            :
                <View style={tailwind('bg-slate-50 px-2 py-4 items-center mt-4 mx-6 rounded-md')} >
                    <Text style={tailwind('text-secondary items-center ml-1')}>You don't have any notifications.</Text>
                </View>
            }

            {showFilter && (
                <Modal hide={() => {Haptics.selectionAsync();setShowFilter(false)}} animateModal={true} bottomDuration={200} bottomStart={-100} type='small'>
                    <View 
                        style={[
                            tailwind('flex flex-col'), 
                            {paddingHorizontal: 20}
                        ]}
                    >

                    {/* <View style={{position: 'absolute',width: '90%',marginTop:60,alignSelf: 'center',}}> */}


                        <Text style={{fontWeight: 'bold',fontSize: 17,marginTop: 14,marginBottom: 5,marginLeft: 2,fontFamily: 'GmarketMedium',}}>Notification Filters</Text>
                        {list_filters.map(e => {
                            return(
                                <TouchableOpacity 
                                    style={{backgroundColor: '#F6F6F6',borderRadius: 25,height: 50,marginTop: 10,flexDirection:'row', justifyContent: 'space-between',alignItems: 'center',}} 
                                    key={Math.random()}
                                    onPress={() => onFilterPress(e)}
                                >
                                    <Text style={{fontWeight: 'bold',fontSize: 17,paddingLeft: 20}}>{e.label}</Text>

                                    <View style={{backgroundColor: 'white',width: 26,height: 26,borderWidth: 1,borderColor: '#999',borderRadius: 13,marginRight: 15, justifyContent: 'center',alignItems: 'center',}}>
                                        {checked.includes(e.label == 'Reactions' ? 'reaction' : 'reply_to') && (
                                            <View style={{backgroundColor: '#FF6E31',width: 24,height: 24,borderRadius: 13,justifyContent: 'center',alignItems: 'center',}}>
                                                <View style={{backgroundColor: 'white',width: 10,height: 10,borderRadius: 5,}} />
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            )
                        })}
                    </View>
                </Modal>
            )}

        </View>
    )
}

export default Notifications
