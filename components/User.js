import { Text, View, TouchableOpacity, Image } from 'react-native';
import { useTailwind } from 'tailwind-rn';

import useDidToAddress from "../hooks/useDidToAddress";
import useGetUsername from "../hooks/useGetUsername";
import { isAdmin } from "../utils";

export default function User({height = 40, details}) {
  const tailwind = useTailwind();
  return(
    <View style={tailwind('flex flex-row items-center')}>
      <UserPfp height={height} details={details} />
      <Text style={tailwind('text-slate-900 font-medium ml-2 text-sm')}>
        <Username details={details} />
      </Text>
    </View>
  )
}

/** Will render the user's pfp or empty state */
export function UserPfp({height = 40, details, style}) {
  const tailwind = useTailwind();

  function getProfilePicture() {
    if(details.profile.pfp.includes("ipfs://")) {
      return details.profile.pfp.replace("ipfs://", "https://ipfs.io/ipfs")
    } else {
      return details.profile.pfp
    }
  }

  if(details && details.profile && details.profile.pfp) {
    return(
      <View>
        <Image
          style={[tailwind('rounded-full bg-slate-100'), { height: height, width: height }, style]}
          loadingIndicatorSource={require("../assets/loader_001.gif")}
          source={{
            uri: getProfilePicture(),
            cache: 'force-cache'
          }} />
        {/** Will display admin badge if available */}
        {isAdmin(details.did) &&
          <Image
            style={{width: height / 2, height: height / 2, position: "absolute", right: -4, top: 0}}
            source={require('../assets/AdminBadge.png')} />
        }
      </View>
    )
  } else {
    return(
      <Image
        style={[tailwind('rounded-full'), { height: height, width: height }, style]}
        source={require('../assets/empty-state-user.png')} />
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
