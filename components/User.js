import { Text, View, TouchableOpacity, Image as RNImage } from 'react-native';
import { useTailwind } from 'tailwind-rn';

import useDidToAddress from "../hooks/useDidToAddress";
import useGetUsername from "../hooks/useGetUsername";
import { isAdmin } from "../utils";
import { useContext } from 'react';
import { GlobalContext } from '../contexts/GlobalContext';
import { FollowIcon, UnfollowIcon } from './Icons';

// import { Image } from 'expo-image';

export default function User({height = 40, details, isFollow}) {
  const tailwind = useTailwind();
  return(
    <View style={tailwind('flex flex-row items-center')}>
      <UserPfp height={height} details={details} />
      <View>
        <Text style={tailwind('text-slate-900 font-medium ml-2 text-sm')}>
            <Username details={details} />
        </Text>
        {isFollow && <Text style={tailwind("text-secondary ml-2")}>{details.type == 'Followers' ? 'Followed Friend' : 'Following Friend'}</Text>}
      </View>
    </View>
  )
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
            source={require('../assets/AdminBadge.png')} />
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
                source={require('../assets/empty-state-user.png')} 
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
