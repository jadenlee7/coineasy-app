import { ActivityIndicator, Alert, Text, View, TouchableOpacity, Image as RNImage } from 'react-native';
import { useTailwind } from 'tailwind-rn';
import * as Haptics from 'expo-haptics';

import useDidToAddress from "../hooks/useDidToAddress";
import useGetUsername from "../hooks/useGetUsername";
import { isAdmin } from "../utils";
import { useContext } from 'react';
import { GlobalContext } from '../contexts/GlobalContext';
import { FollowIcon, UnfollowIcon } from './Icons';
import useFollow from '../hooks/useFollow';
import { getEasyGoUserId } from '../utils/socialPostAdapter';

// import { Image } from 'expo-image';

export default function User({
  height = 40,
  details,
  isFollow,
  subtitle,
  showFollowButton = false,
  initialFollowing = false,
  onFollowChange,
}) {
  const tailwind = useTailwind();
  return(
    <View style={[tailwind('flex flex-row items-center'), {flex: 1}]}>
      <UserPfp height={height} details={details} />
      <View style={{flex: 1}}>
        <Text style={tailwind('text-slate-900 font-medium ml-2 text-sm')}>
            <Username details={details} />
        </Text>
        {subtitle
          ? <Text style={tailwind("text-secondary ml-2")}>{subtitle}</Text>
          : isFollow && <Text style={tailwind("text-secondary ml-2")}>{details.type == 'Followers' ? 'Followed Friend' : 'Following Friend'}</Text>}
      </View>
      {showFollowButton && (
        <UserFollowButton
          details={details}
          initialFollowing={initialFollowing}
          onFollowChange={onFollowChange}
        />
      )}
    </View>
  )
}

function UserFollowButton({details, initialFollowing, onFollowChange}) {
  const { user } = useContext(GlobalContext);
  const targetUserId = getEasyGoUserId(details);
  const ownUserId = getEasyGoUserId(user);
  const enabled = Boolean(targetUserId && ownUserId && targetUserId !== ownUserId);
  const {
    isFollowing,
    loading,
    follow,
    unfollow,
  } = useFollow(targetUserId, {
    enabled,
    initialFollowing,
    loadStatus: false,
  });

  if (!enabled) return null;

  const toggleFollow = async (event) => {
    event?.stopPropagation?.();
    Haptics.selectionAsync();
    const nextFollowing = !isFollowing;
    const succeeded = nextFollowing ? await follow() : await unfollow();
    if (!succeeded) {
      Alert.alert('Could not update follow', 'Check the backend connection and try again.');
      return;
    }
    onFollowChange?.(targetUserId, nextFollowing);
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={isFollowing ? 'Unfollow user' : 'Follow user'}
      disabled={loading}
      onPress={toggleFollow}
      hitSlop={{top: 10, right: 10, bottom: 10, left: 10}}
      style={{width: 42, height: 42, alignItems: 'center', justifyContent: 'center'}}
    >
      {loading
        ? <ActivityIndicator size="small" color="#FF6B17" />
        : isFollowing ? <FollowIcon /> : <UnfollowIcon />}
    </TouchableOpacity>
  );
}

/** Will render the user's pfp or empty state */
export function UserPfp({height = 40, details, style, badge_style, origin}) {
  const tailwind = useTailwind();
//   const { user, listFollowers } = useContext(GlobalContext);

  function getProfilePicture() {
    if(details.profile.pfp.includes("ipfs://")) {
      return details.profile.pfp.replace("ipfs://", "https://ipfs.io/ipfs")
    } else {
      return details.profile.pfp
    }
  }

  if(details && details.profile && details.profile.pfp && details.profile.pfp != '') {
    return(
      <View>
        {/* <Image
          style={[tailwind('rounded-full bg-slate-100'), { height: height, width: height }, style]}
          source={getProfilePicture()}
          placeholder={require("../assets/loader_001.gif")}
          transition={500}
          priority="high"
        /> */}
        <RNImage
          style={[tailwind('rounded-full bg-slate-100'), { height: height, width: height }, style]}
          loadingIndicatorSource={require("../assets/loader_001.gif")}
          source={{
            uri: getProfilePicture(),
            cache: 'force-cache'
          }} />
        {/** Will display admin badge if available */}
        {isAdmin(details.did) &&
          <RNImage
            style={[{width: height / 2, height: height / 2, position: "absolute", right: -4, top: 0}, badge_style]}
            source={require('../assets/admin_badge.png')} />
        }

        {/* {origin == 'feed' && details.did != user.did && listFollowers.findIndex(e => e.details.did == details.did) != -1 ? (
            <FollowIcon style={{position: 'absolute',bottom: -10, right: -6}}/>
        ) : origin == 'feed' && details.did != user.did && (
            <UnfollowIcon style={{position: 'absolute',bottom: -10, right: -6}}/>
        )} */}
      </View>
    )
  } else {
    return(
        <>
            <RNImage
                style={[tailwind('rounded-full'), { height: height, width: height }, style]}
                source={require('../assets/empty_state_user.png')} 
            />
            {/* {origin == 'feed' && details.did != user.did && <UnfollowIcon style={{position: 'absolute',bottom: -10, right: -6, width: height / 2, height: height / 2,}}/>} */}
        </>
    )
  }
}

/** Will render the username or generated username with address */
export function Username({details, fontSize = 13, style}) {
  const tailwind = useTailwind();
  const { address, chain } = useDidToAddress(details?.did);
  const username = useGetUsername(details?.profile, address, details?.did);

  return (<Text style={[tailwind("text-main"), { fontFamily: "GmarketBold", fontSize: fontSize, lineHeight: 19, ...style }]}>{username}</Text>);
}
