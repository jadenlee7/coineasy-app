import React, { useContext, useEffect } from "react";
import { Dimensions, Image, Animated, Platform, TouchableOpacity, Text, View } from 'react-native';
import { useTailwind } from 'tailwind-rn';
import { GlobalContext } from "../contexts/GlobalContext";
import useStatusBarHeight from "../hooks/useStatusBarHeight";
import SecondHeader from "./SecondHeader";
import HeaderImage from "./HeaderImage";
import { useNavigation } from "@react-navigation/core";

import * as Haptics from 'expo-haptics';
import { NotificationsIcon } from "./Icons";


export default function Header(props) {
  const { userData, screen, setCategory, category, scrollAnim,offsetAnim, setClampedScroll, navbarTranslate } = useContext(GlobalContext);
  const tailwind = useTailwind();
  const { width } = Dimensions.get('window');
  const statusBarHeight = useStatusBarHeight();
  const navigation = useNavigation()

  if(screen == "qr") {
    return;
  }

  return(
    <Animated.View 
        style={[
            tailwind('w-full'), 
            { 
                height: statusBarHeight > 25 ? 65 + statusBarHeight : 80 + statusBarHeight,
                transform: [{ translateY: navbarTranslate }],
                position: 'absolute',
                left: 0,
                right: 0,
                top: statusBarHeight > 25 ? 0 : -20,
                // zIndex: 1000,
                overflow: 'hidden',
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
            <View style={{
                    position: 'absolute',
                    top: Platform.OS == 'ios' && statusBarHeight > 25 ? 70 : Platform.OS == 'ios' ? 80 : statusBarHeight > 25 ? 50 : 60,
                    right: 20,
                    flexDirection:'row',
                    justifyContent:'center',
                    alignItems:'center',
                    gap: 10,
                }}
            >
                <TouchableOpacity 
                    onPress={() => {Haptics.selectionAsync();navigation.navigate('OrangeNavigation', {back: true})}}
                    style={{
                        borderRadius: 30,
                        backgroundColor: '#FFF2E2',
                        flexDirection:'row',
                        gap: 6,
                        alignSelf:'flex-end',
                        marginRight: 5,
                        paddingVertical: 5,
                        paddingHorizontal:10,
                        alignItems:'center',
                        justifyContent:'center'
                    }}
                >
                    <Image
                        style={{width: 15, height: 15}}
                        resizeMode='contain'
                        source={require('../assets/trophy/trophy_icon_orange.png')}
                    />
                    <Text style={{fontWeight: 'bold',textAlign: 'center',color:'#FB5100',}}>
                        {userData?.numberOranges && userData?.numberOranges.toString().length <= 3 ? userData?.numberOranges
                            : userData?.numberOranges && userData?.numberOranges.toString().length == 4 ? userData?.numberOranges.toString().slice(0,1)+','+userData?.numberOranges.toString().slice(1,4)
                            : userData?.numberOranges && userData?.numberOranges.toString().length == 5 ? userData?.numberOranges.toString().slice(0,2)+','+userData?.numberOranges.toString().slice(2,5)
                            : userData?.numberOranges && userData?.numberOranges.toString().length == 6 ? userData?.numberOranges.toString().slice(0,3)+','+userData?.numberOranges.toString().slice(3,6)
                            : userData?.numberOranges && userData?.numberOranges.toString().length == 7 ? userData?.numberOranges.toString().slice(0,1)+','+userData?.numberOranges.toString().slice(1,4)+','+userData?.numberOranges.toString().slice(4,7)
                            : userData?.numberOranges && userData?.numberOranges.toString().length == 8 ? userData?.numberOranges.toString().slice(0,2)+','+userData?.numberOranges.toString().slice(2,5)+','+userData?.numberOranges.toString().slice(5,8)
                            : userData?.numberOranges && userData?.numberOranges.toString().length == 9 ? userData?.numberOranges.toString().slice(0,3)+','+userData?.numberOranges.toString().slice(3,6)+','+userData?.numberOranges.toString().slice(6,9)
                            : 0
                        }
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    activeOpacity={0.7} 
                    onPress={() => {Haptics.selectionAsync();navigation.navigate('Notifications')}}
                >
                    <NotificationsIcon />
                </TouchableOpacity>
            </View>


            // <SecondHeader label={""} back={category ? () => setCategory(null) : null} />
         ) : props.route == 'Categories' ? (
            <SecondHeader back={props.backCategory}/>
        ) : props.route == 'News' ? (
            <SecondHeader back={props.backNews}/>
        ) : null}
    </Animated.View>
  )
}
