import React, { useContext, useEffect } from "react";
import { Dimensions, Image, Animated } from 'react-native';
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import useStatusBarHeight from "../hooks/useStatusBarHeight";
import SecondHeader from "./SecondHeader";

export default function Header(props) {
  const { screen, setCategory, category, scrollAnim,offsetAnim, setClampedScroll, navbarTranslate } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const { width } = Dimensions.get('window');
  const statusBarHeight = useStatusBarHeight();

  if(screen == "qr") {
    return;
  }

  return(
    <Animated.View 
        style={[
            tailwind('w-full'), 
            { 
                height: screen == 'home' ? 100 + statusBarHeight : 40 + statusBarHeight,
                transform: [{ translateY: navbarTranslate }],
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                zIndex: 1000,
                overflow: 'hidden'
            },
        ]}
        onLayout={(event) => {
            let {height} = event.nativeEvent.layout;
            setClampedScroll(Animated.diffClamp(
              Animated.add(
                scrollAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                  extrapolateLeft: 'clamp'
                }),
                offsetAnim
              ), 0, height)
            );
        }}
    >
        <Image
            style={[{ width: width, height: 40 + statusBarHeight, paddingTop: statusBarHeight }]}
            source={require('../assets/HeaderBg.png')} 
        />
      
        {screen == 'home' && props.route != 'Categories' && props.route != 'News'? (
            <SecondHeader label={"GM! CoinEasy Frens!"} back={category ? () => setCategory(null) : null} />
         ) : props.route == 'Categories' ? (
            <SecondHeader back={props.backCategory}/>
        ) : props.route == 'News' ? (
            <SecondHeader back={props.backNews}/>
        ) : null}
    </Animated.View>
  )
}
