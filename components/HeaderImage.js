import React from "react";
import { Image, Dimensions, Platform, ActivityIndicator } from 'react-native';


import useStatusBarHeight from "../hooks/useStatusBarHeight";

const HeaderImage = (props) => {
    const statusBarHeight = useStatusBarHeight();
   

    return(
        <Image
            style={{ 
                width: Dimensions.get('window').width,
                height: statusBarHeight > 25 ? 65 + statusBarHeight : 80 + statusBarHeight,
                paddingTop: statusBarHeight,
            }}
            source={require('../assets/HeaderBg.png')}
            // resizeMode="stretch"
            defaultSource={require('../assets/HeaderBg.png')}
            height={statusBarHeight > 25 ? 65 + statusBarHeight : 80 + statusBarHeight}
            loadingIndicatorSource={<ActivityIndicator style={{height: statusBarHeight > 25 ? 65 + statusBarHeight : 80 + statusBarHeight, paddingTop: statusBarHeight, width: Dimensions.get('window').width,}}/>}
        />
    )
}

export default HeaderImage
