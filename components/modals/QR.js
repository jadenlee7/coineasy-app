import React, { useContext, useEffect } from "react";
import { Alert, Text, View, Image, TouchableHighlight, Dimensions, Share, BackHandler } from 'react-native';

import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import * as Clipboard from 'expo-clipboard';
import SvgQRCode from 'react-native-qrcode-svg';
import { showMessage } from "react-native-flash-message";

import { CloseIcon, ShareIcon, CopyIcon, SuccessIcon } from "../Icons";
import { GlobalContext } from "../../contexts/GlobalContext";
import useStatusBarHeight from "../../hooks/useStatusBarHeight";
import useGetUsername from "../../hooks/useGetUsername";
import useDidToAddress from "../../hooks/useDidToAddress";
import { normalizeEasyGoRouteId } from '../../utils/navigationIntent.mjs';

export default function QR({hide}) {
    const { user, setShareProfileVis } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const { width } = Dimensions.get('window');
    const statusBarHeight = useStatusBarHeight();

    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            Haptics.selectionAsync();
            setShareProfileVis(false);
            return true;
        });
        return () => subscription.remove();
    }, [setShareProfileVis]);

    /** Share only the public EasyGo database id, never the private Privy subject. */
    const easyGoUserId = normalizeEasyGoRouteId(user?.profile?.data?.easygoUserId);
    const link = easyGoUserId
        ? Linking.createURL('user', {
            isTripleSlashed: true,
            queryParams: { userId: easyGoUserId },
        })
        : null;

    /** Will open the native sharing modal */
    const shareProfile = async () => {
        if (!link) {
            Alert.alert('Profile link unavailable', 'Refresh your EasyGo profile and try again.');
            return;
        }
        try {
            const result = await Share.share({ 
                message: link, 
                url: link, 
                title: "My CoinEasy Profile" 
            });
        } catch (error) {
            Alert.alert(error.message);
        }
    };

    /** Will copy link in Clipboard */
    async function copyLink() {
        if (!link) {
            Alert.alert('Profile link unavailable', 'Refresh your EasyGo profile and try again.');
            return;
        }
        await Clipboard.setStringAsync(link);
        showMessage({
            message: "Profile link copied!",
            type: "success",
            floating: true,
            backgroundColor: "#3D3D3D",
            icon: () => <SuccessIcon style={{marginRight: 10,}}/>
        });
    }

    const { address, chain } = useDidToAddress(user.did);
    const username = useGetUsername(user.profile, address, user.did);

    return(
        <View style={[tailwind('absolute w-full h-full'), {elevation: 50}]}>
            <Image
                resizeMode="cover"
                style={[tailwind('w-full h-full')]}
                source={require('../../assets/qr_code_bg.png')} 
            />

            <View style={[tailwind('absolute w-full flex flex-col'), { paddingTop: statusBarHeight }]}>
                <View style={[tailwind('flex items-start')]}>
                    <TouchableHighlight onPress={() => {Haptics.selectionAsync();hide()}} style={{left: 20, top: 10}} underlayColor="transparent">
                        <CloseIcon />
                    </TouchableHighlight>
                </View>

                <View style={[tailwind('items-center justify-center'), {marginTop: 100}]}>
                    <View style={[tailwind('bg-white rounded-lg shadow-lg overflow-hidden items-center justify-center'), {width: width -90, height: width / 1.14}]}>
                        <View style={tailwind("rounded-lg overflow-hidden")}>
                            {link ? (
                                <SvgQRCode
                                    value={link}
                                    logoSize={65}
                                    size={width / 1.4 - 50}
                                    color="#FF6B17"
                                    // logo={logo}
                                />
                            ) : (
                                <Text style={{color: '#64748B', textAlign: 'center'}}>
                                    Profile link unavailable
                                </Text>
                            )}

                            <Text style={{color: '#FF6B17',fontWeight: 'bold',textAlign:'center',fontSize: 18,marginTop: 30,}}>@{username.toUpperCase()}</Text>
                        </View>
                    </View>
                    <View style={[tailwind('flex flex-row'), {width: width -90, marginTop: 15}]}>
                        <WhiteAction style={{marginRight: 10}} label="Share profile" icon={<ShareIcon />} onPress={() => shareProfile()} />
                        <WhiteAction label="Copy link" icon={<CopyIcon />} onPress={() => copyLink()} />
                    </View>
                </View>
            </View>

        </View>
    )
}

const WhiteAction = ({style, label, icon, onPress}) => {
    const tailwind = useTailwind();
    return(
        <TouchableHighlight style={[tailwind('bg-white rounded-lg shadow-md flex-1 p-1'), style, {paddingTop: 16, paddingBottom: 16,}]} underlayColor="#f1f5f9" onPress={onPress}>
            <>
                <View style={tailwind("w-full items-center")}>
                    {icon}
                </View>
                <Text style={[tailwind("text-primary font-normal text-center"), {fontSize: 13,marginTop: 3,}]}>{label}</Text>
            </>
        </TouchableHighlight>
    )
}
