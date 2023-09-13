import React, { useContext, useState, useEffect } from "react";
import { View, ActivityIndicator, ScrollView, Text, TouchableHighlight } from 'react-native';
import Pane from "../Pane";
import Post from "../Post";
import SecondHeader from "../SecondHeader";
import TimeAgo from "../TimeAgo";
import { context } from "../../utils/config";
import { InterpunctIcon } from "../Icons";
import User, { UserPfp, Username } from "../User";
import { GlobalContext } from "../../contexts/GlobalContext";
import { useTailwind } from 'tailwind-rn';

export default function NotificationsPane() {
  const { user, orbis, setNotificationsVis} = useContext(GlobalContext);
  const tailwind = useTailwind();
  const [ post, setPost ] = useState();
  const [ notifications, setNotifications ] = useState([]);
  const [ notificationsLoading, setNotificationsLoading ] = useState(false);

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
      console.log("error:", error);
      if(data) {
        setNotifications(data);
        setNotificationsLoading(false);
      }
    }
  }, []);

  return(
    <Pane>
      <SecondHeader label="" showBack={true} back={() => setNotificationsVis(false)} />
      <View style={tailwind('flex flex-1 flex-col')}>
        {notificationsLoading ?
          <ActivityIndicator style={{marginTop: 10}} size="small" color="#020617" />
        :
          <>
            {(notifications && notifications.length > 0) ?
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
          </>
        }
      </View>
    </Pane>
  )
}

const Notification = ({notification}) => {
  const { user, orbis, setPostDetailsVis, setNotificationsVis} = useContext(GlobalContext);
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
