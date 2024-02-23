import React from "react";
import { Image, Dimensions, Platform, ActivityIndicator } from 'react-native';


import useStatusBarHeight from "../hooks/useStatusBarHeight";

const HeaderImage = (props) => {
    const statusBarHeight = useStatusBarHeight();
   
    return(
        <Image
            style={[props.style, { 
                width: Dimensions.get('window').width,
                height: statusBarHeight > 25 ? 65 + statusBarHeight : 80 + statusBarHeight,
                paddingTop: statusBarHeight,
            }]}
            source={require('../assets/HeaderBg_correct.png')}
            // resizeMode="stretch"
            defaultSource={require('../assets/HeaderBg_correct.png')}
            height={statusBarHeight > 25 ? 65 + statusBarHeight : 80 + statusBarHeight}
        />
    )
}

export default HeaderImage
