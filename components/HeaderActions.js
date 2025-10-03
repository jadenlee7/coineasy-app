import React, { useContext } from "react";
import { Image, Dimensions, Platform, ActivityIndicator, TouchableOpacity, Text } from 'react-native';


import useStatusBarHeight from "../hooks/useStatusBarHeight";
import { useNavigation } from "@react-navigation/core";

import * as Haptics from 'expo-haptics';
import { GlobalContext } from "../contexts/GlobalContext";


const HeaderActions = (props) => {
    const statusBarHeight = useStatusBarHeight();

    const navigation = useNavigation()
    const { userData } = useContext(GlobalContext);

    const { actions = () => {} } = props
   
    return(
        <>
            <TouchableOpacity
                style={{position: 'absolute',left: 17, top: Platform.OS == 'ios' && statusBarHeight > 25 ? 70 : Platform.OS == 'ios' ? 80 : statusBarHeight > 25 ? 55 : 60,zIndex: 999999}} 
                onPress={() => {Haptics.selectionAsync();navigation.goBack();actions()}}
            >
                <Image
                    style={{width: 24,height: 24}}
                    resizeMode='contain'
                    source={require('../assets/back_button.png')}
                    defaultSource={require('../assets/back_button.png')}
                />
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => {Haptics.selectionAsync();navigation.navigate('OrangeNavigation', {back: true})}}
                style={{
                    position: 'absolute',
                    top: Platform.OS == 'ios' && statusBarHeight > 25 ? 70 : Platform.OS == 'ios' ? 80 : statusBarHeight > 25 ? 50 : 60,
                    right: 13,
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
        </>
    )
}

export default HeaderActions
