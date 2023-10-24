import React, { useContext, useEffect } from "react";
import { Dimensions, Image, Animated, Platform } from 'react-native';
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import useStatusBarHeight from "../hooks/useStatusBarHeight";
import SecondHeader from "./SecondHeader";
import HeaderImage from "./HeaderImage";

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
                height: statusBarHeight > 25 ? 120 + statusBarHeight : 135 + statusBarHeight,
                transform: [{ translateY: navbarTranslate }],
                position: 'absolute',
                left: 0,
                right: 0,
                top: statusBarHeight > 25 ? 0 : -20,
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
        <HeaderImage />

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
