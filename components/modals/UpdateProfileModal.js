import React, { useState, useRef, useContext, useMemo } from "react";
import { Text, View, TextInput, TouchableHighlight, Platform, ActivityIndicator, TouchableOpacity, Image, Animated, Dimensions, Keyboard, ImageBackground } from 'react-native';

import Modal from "../Modal";
import Button from "../Button";
import { UserPfp } from "../User";
import { CancelIcon, LinkIcon, PlusIcon, SuccessIcon, TelegramIcon, TwitterIcon } from "../Icons";
import { GlobalContext } from "../../contexts/GlobalContext";

import mime from 'mime'
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import * as ImagePicker from 'expo-image-picker';
import { showMessage } from "react-native-flash-message";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import useStatusBarHeight from "../../hooks/useStatusBarHeight";

export default function UpdateProfileModal({callback}) {
    const { user, setUser, orbis, setUpdateProfileVis, modalProfileRef } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const [saving, setSaving] = useState(false);
    const [savingLink, setSavingLink] = useState(false);
    const [pfpLoading, setPfpLoading] = useState(false);
    const [pfp, setPfp] = useState(user?.profile?.pfp ? user.profile.pfp : "");
    const [name, setName] = useState(user?.profile?.username ? user.profile.username : "");
    const [description, setDescription] = useState(user?.profile?.description ? user.profile.description : "");

    const [showLinks, setShowLinks] = useState(false)
    const [showDetailLink, setShowDetailLink] = useState(false)
    const [linkIndex, setLinkIndex] = useState(null)
    const [link, setLink] = useState("")

    const [linkText, setLinkText] = useState("")
    const [titleText, setTitleText] = useState("")

    const statusBarHeight = useStatusBarHeight();

    const snapPointsProfile = useMemo(() => ['100%', '100%'], []);

    const moveAnimation1 = useRef(new Animated.Value(0)).current;
    const moveAnimation2 = useRef(new Animated.Value(Dimensions.get('window').width)).current;
    const moveAnimation3 = useRef(new Animated.Value(Dimensions.get('window').width)).current;

    const [numberLink, setnumberLink] = useState(user?.profile && user?.profile.data && user?.profile.data.list_link ? user.profile.data.list_link.length : 0)

    const onBackSocialLinks = () => {
        Haptics.selectionAsync();

        Animated.parallel([
            Animated.timing(moveAnimation1, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true
            }),
            Animated.timing(moveAnimation2, {
                toValue: Dimensions.get('window').width,
                duration: 300,
                useNativeDriver: true
            })
        ]).start(() => {
            setShowLinks(false)
        });
    }

    const showDetailSocialLink = (index) => {
        Haptics.selectionAsync();
        Keyboard.dismiss()

        Animated.parallel([
            Animated.timing(moveAnimation2, {
                toValue: -Dimensions.get('window').width,
                duration: 300,
                useNativeDriver: true
            }),
            Animated.timing(moveAnimation3, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true
            })
        ]).start(() => {
            setLinkIndex(index !== null ? index : null)
            setLinkText(index !== null && user ? user.profile.data.list_link[index].link : '')
            setTitleText(index !== null && user ? user.profile.data.list_link[index].title : '')
        });
        
        setShowDetailLink(true)
    }

    const onBackDetailSocialLink = () => {
        Haptics.selectionAsync();

        Animated.parallel([
            Animated.timing(moveAnimation2, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true
            }),
            Animated.timing(moveAnimation3, {
                toValue: Dimensions.get('window').width,
                duration: 300,
                useNativeDriver: true
            })
        ]).start(() => {
            setLinkText('')
            setTitleText('')
            setShowDetailLink(false)
        });
    }

    async function saveProfile() {
        if(pfpLoading) {
            alert("Your profile picture is currently being uploaded.");
            return;
        }
        Haptics.selectionAsync();
        setSaving(true);
        let content = {
            username: name,
            description: description,
            pfp: pfp,
            data: user?.profile?.data ? user.profile.data : {}
        };
        const res = await orbis.updateProfile(content);
        
        let _user = {...user};
        _user.profile = content;
        setUser(_user);
        setSaving(false);
        modalProfileRef.current?.close()

        if(callback) {
            callback(_user);
        }
    }

    async function saveLinks() {
        Haptics.selectionAsync();
        setSavingLink(true);

        const temp_link = typeof linkText !== 'undefined' ? linkText : ''
        const temp_title = typeof titleText !== 'undefined' ? titleText : ''
    
        let content = {
            username: name,
            description: description,
            pfp: pfp,
            data: user?.profile?.data ? user?.profile.data : {}
        }

        if(temp_title != '' && temp_link == ''){
            showMessage({
                message: 'URL can not be empty with a title.',
                type: "danger",
                floating: true,
                backgroundColor: "#3D3D3D",
                icon: () => <CancelIcon style={{marginRight: 10,}}/>
            });
            setSavingLink(false);
        }else if(temp_title == '' && temp_link == '' && linkIndex == null ){
            showMessage({
                message: 'URL can not be empty.',
                type: "danger",
                floating: true,
                backgroundColor: "#3D3D3D",
                icon: () => <CancelIcon style={{marginRight: 10,}}/>
            });
            setSavingLink(false);
        }else{
            if(linkIndex == null){
                if(content.data.list_link){
                    content.data.list_link.push({
                        link: temp_link,
                        title: temp_title
                    })
                }else{
                    content.data.list_link = [
                        {
                            link: temp_link,
                            title: temp_title
                        }
                    ]
                }
            }else{
                if(temp_link != ''){
                    content.data.list_link[linkIndex] = {
                        link: temp_link,
                        title: temp_title
                    }
                }else{
                    content.data.list_link.splice(linkIndex, 1)
                }       
            }   


            const res = await orbis.updateProfile(content);

            if(res.status == 300){
                showMessage({
                    message: 'An unexpected error occured. Please try again later.',
                    type: "danger",
                    floating: true,
                });
                setSavingLink(false);
            }else{
                let _user = {...user};
                if(user?.profile){
                    _user.profile.data = content.data;
                }else{
                    _user.profile = {
                        data: content.data
                    }
                }
                setUser(_user);
                setSavingLink(false);
        
                if(callback) {
                    callback(_user);
                }

                showMessage({
                    message: linkText && linkText != '' ? 'Social link added with success' : 'Social link removed with success',
                    type: "success",
                    floating: true,
                    backgroundColor: "#3D3D3D",
                    icon: () => <SuccessIcon style={{marginRight: 10,}}/>
                });

                setLinkIndex(null)
                setTitleText('')
                setLinkText('')
                onBackDetailSocialLink()
            }    
        }
    }

    async function selectPhoto() {
        Haptics.selectionAsync();
        try {
            // No permissions request is necessary for launching the image library
            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: "Images",
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.25,
            });

            if (!result.canceled) {
                /** Handle Image picked */
                let imagePath = result.assets[0].uri;
                setPfpLoading(true);
                setPfp(imagePath);

                const imageType = mime.getType(imagePath)

                /** Create file object */
                let file = {
                    name: "test",
                    type: imageType,
                    uri: Platform.OS === 'ios' ? imagePath.replace('file://', '') : imagePath,
                }

                /** Upload PFP to IPFS */
                const resUpload = await orbis.uploadMedia(file);

                /** Handle result returned by Orbis SDK */
                if(resUpload.status == 200) {
                    let finalUrl = resUpload.result.url.replace("ipfs://", resUpload.result.gateway);
                    setPfp(finalUrl);
                    setPfpLoading(false);
                } else {
                    alert("Error uploading profile picture.");
                    setPfpLoading(false);
                }

            }
        } catch(e) {
            console.log("Error selecting photo:", e);
            setPfpLoading(false);
        }
    }

    return(
        // <Modal hide={() => {Haptics.selectionAsync();setUpdateProfileVis(false)}} animateModal={false}>
        <BottomSheetModalProvider>
            <BottomSheetModal
                ref={modalProfileRef}
                index={1}
                snapPoints={snapPointsProfile}
                enableContentPanningGesture={false}
                handleIndicatorStyle={{backgroundColor: 'black',}}
                handleStyle={{height: 2,justifyContent: 'center',marginTop: 10,}}
                backdropComponent={(backdropProps) => <BottomSheetBackdrop {...backdropProps} enableTouchThrough={true} />}
                topInset={65 + statusBarHeight}
            >
                <Animated.View style={{transform: [{ translateX: moveAnimation1 }],marginTop: -20,}}>
                    <View style={tailwind('flex flex-row px-4 items-center w-full justify-center p-5')}>
                        <Button title="Cancel" color="white" size="sm" onPress={() => {Haptics.selectionAsync();modalProfileRef.current?.close()}} />
                        <View style={tailwind('flex flex-1')} />
                        <Button title="Save" color="orange" size="sm" loading={saving} onPress={saveProfile} />
                    </View>

                    {/** Display profile details */}
                    <View style={tailwind('w-full flex flex-col items-center')}>
                        <TouchableHighlight style={tailwind('rounded-full')} onPress={() => selectPhoto()}>
                            <>
                                {pfpLoading ?
                                <>
                                    <UserPfp details={{ profile: { pfp: pfp }}} height={50} />
                                    <ActivityIndicator size="small" color="#000" style={[tailwind('absolute'), {bottom: 0, right: -5}]} />
                                </>
                                :
                                <>
                                    <UserPfp details={{ profile: { pfp: pfp }}} height={50} />
                                    <PlusIcon />
                                </>
                                }

                            </>
                        </TouchableHighlight>
                        <View style={tailwind('mt-1')}>
                            <Text style={[tailwind("text-slate-900 mt-2 w-2/3 text-center"), { fontSize: 11, lineHeight: 19, fontFamily: "GmarketBold", lineHeight: 15 }]}>Tap to edit your profile picture</Text>
                        </View>
                    </View>

                    {/** Form content */}
                    <View style={tailwind('w-full flex flex-col border-t border-secondary mt-4')}>
                        <InputGroup label="Name" placeholder="Your name" value={name} setValue={setName} autoFocus={true} />
                        <InputGroup label="Bio" placeholder="Enter a short description" value={description} setValue={setDescription} height={60} />
                        <InputGroup label="Social links" placeholder="Add links" height={60} animation1={moveAnimation1} animation2={moveAnimation2} setShowLinks={setShowLinks} numberLink={numberLink}/>
                    </View>
                </Animated.View>

                {showLinks && (
                    <Animated.View style={{transform: [{ translateX: moveAnimation2 }],position: 'absolute',width: '100%',alignSelf: 'center',}}>
                        <TouchableOpacity onPress={() => onBackSocialLinks()} style={{position: 'absolute',top: 0, left: 20,}}>
                            <Image
                                style={{width: 30,height: 30}}
                                resizeMode='contain'
                                source={require('../../assets/back_button.png')}
                                defaultSource={require('../../assets/back_button.png')}
                            />
                        </TouchableOpacity>
                        
                        <View style={[tailwind('w-full flex flex-row border-b border-secondary items-start px-4 py-3'), {marginTop: 20,}]}/>

                        <TouchableOpacity 
                            style={tailwind('w-full flex flex-row border-b border-secondary items-center px-4 py-3')} 
                            onPress={() => showDetailSocialLink(null)}
                        >
                            <Image
                                style={{width: 30,height: 30}}
                                resizeMode='contain'
                                source={require('../../assets/add_icon.png')}
                                defaultSource={require('../../assets/add_icon.png')}
                            />
                            <View style={[{marginLeft: 15,}]}>
                                <Text style={[tailwind("text-slate-900"), { fontSize: 16,fontWeight: 'bold',}]}>Add external link</Text>
                            </View>
                        </TouchableOpacity>

                        {user?.profile?.data?.list_link && user?.profile.data.list_link.length != 0 ? (
                            user?.profile.data.list_link.map((e, index) => {
                                return(
                                    <TouchableOpacity 
                                        style={tailwind('w-full flex flex-row border-b border-secondary items-center px-4 py-3')} 
                                        onPress={() => showDetailSocialLink(index)}
                                        key={Math.random()}
                                    >
                                        {e.link.toLowerCase().includes('twitter.com') ? (
                                            <>
                                                <TwitterIcon style={{marginLeft: 5,}}/>
                                                <View style={[{marginLeft: 7}]}>
                                                    <Text style={[tailwind("text-slate-900"), { fontSize: 16,fontWeight: 'bold',}]}>Twitter</Text>
                                                </View>
                                            </>
                                        ) : e.link.toLowerCase().includes('t.me') ? (
                                            <>
                                                <TelegramIcon style={{marginLeft: 6,}}/>
                                                <View style={[{paddingTop: Platform.OS == 'ios' ? 5 : 3, marginLeft: 10,height: 30}]}>
                                                    <Text style={[tailwind("text-slate-900"), { fontSize: 16,fontWeight: 'bold',}]}>Telegram</Text>
                                                </View>
                                            </>
                                        ) : e.link.toLowerCase().includes('facebook.com') ? (
                                            <>
                                                <Image
                                                    style={{width: 25,height: 25,marginLeft: 4}}
                                                    resizeMode='contain'
                                                    source={require('../../assets/facebook_icon.png')}
                                                    defaultSource={require('../../assets/facebook_icon.png')}
                                                />
                                                <View style={[{paddingTop: Platform.OS == 'ios' ? 5 : 3, marginLeft: 10,height: 30}]}>
                                                    <Text style={[tailwind("text-slate-900"), { fontSize: 16,fontWeight: 'bold',}]}>Facebook</Text>
                                                </View>
                                            </>
                                        ) : e.link.toLowerCase().includes('instagram.com') ? (
                                            <>
                                                <Image
                                                    style={{width: 25,height: 25,marginLeft: 3,}}
                                                    resizeMode='contain'
                                                    source={require('../../assets/instagram_icon.png')}
                                                    defaultSource={require('../../assets/instagram_icon.png')}
                                                />
                                                <View style={[{paddingTop: Platform.OS == 'ios' ? 5 : 3, marginLeft: 10,height: 30}]}>
                                                    <Text style={[tailwind("text-slate-900"), { fontSize: 16,fontWeight: 'bold',}]}>Instagram</Text>
                                                </View>
                                            </>
                                        ) : (
                                            <>
                                                <LinkIcon />
                                                <View style={[{marginLeft: 5}]}>
                                                    <Text style={[tailwind("text-slate-900"), { fontSize: 16,fontWeight: 'bold',}]}>External</Text>
                                                </View>
                                            </>
                                        )}

                                        <Text 
                                            numberOfLines={1} 
                                            style={[tailwind('text-secondary'), {flex: 1,fontSize: 11,marginLeft: 5,marginTop: Platform.OS == 'ios' ? 3 : 5,}]}
                                        >
                                            {e.title ? e.title : e.link}
                                        </Text>

                                    </TouchableOpacity>
                                )
                            })
                        ) : (
                            <Text style={[tailwind('text-secondary'), {textAlign:'center',marginTop: 20,}]}>No social links added.</Text>
                        )}
                    </Animated.View>
                )}

                {showDetailLink && (
                    <Animated.View style={{transform: [{ translateX: moveAnimation3 }],position: 'absolute',width: '100%',alignSelf: 'center',top: -20}}>
                        <View style={tailwind('flex flex-row px-4 items-center w-full justify-center p-5')}>
                            <Button title="Cancel" color="white" size="sm" onPress={() => onBackDetailSocialLink()} />
                            <View style={tailwind('flex flex-1')} />

                            <TouchableOpacity 
                                activeOpacity={0.7}
                                style={[
                                    tailwind(`px-5 rounded-full border ${savingLink ? "bg-main-400" : "bg-main"}`), 
                                    {
                                        borderColor: "transparent",
                                        paddingVertical: savingLink ? 3.2 : 5
                                    }
                                ]}
                                onPress={() => saveLinks()}
                            >
                                {savingLink ?
                                    <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} />
                                :
                                    <Text style={[tailwind('text-white font-semibold'), {fontSize: 12, lineHeight: 16}]}>Save</Text>
                                }
                            </TouchableOpacity>
                        </View>

                        <View style={{flexDirection: 'row',justifyContent: 'center',alignItems: 'center',}}>
                            {linkText.toLowerCase().includes('twitter.com') ? (
                                <>
                                    <TwitterIcon />
                                    <Text style={{textAlign: 'center',fontWeight: 'bold',fontSize: 20,marginLeft: 5,}}>Twitter</Text>
                                </>

                            ) : linkText.toLowerCase().includes('t.me') ? (
                                <>
                                    <TelegramIcon />
                                    <Text style={{textAlign: 'center',fontWeight: 'bold',fontSize: 20,marginLeft: 5,}}>Telegram</Text>
                                </>
                            ) : linkText.toLowerCase().includes('facebook.com') ? (
                                <>
                                    <Image
                                        style={{width: 25,height: 25,marginLeft: 4}}
                                        resizeMode='contain'
                                        source={require('../../assets/facebook_icon.png')}
                                        defaultSource={require('../../assets/facebook_icon.png')}
                                    />
                                    <Text style={{textAlign: 'center',fontWeight: 'bold',fontSize: 20,marginLeft: 5,}}>Facebook</Text>
                                </>
                            ) : linkText.toLowerCase().includes('instagram.com') ? (
                                <>
                                    <Image
                                        style={{width: 25,height: 25,}}
                                        resizeMode='contain'
                                        source={require('../../assets/instagram_icon.png')}
                                        defaultSource={require('../../assets/instagram_icon.png')}
                                    />

                                    <Text style={{textAlign: 'center',fontWeight: 'bold',fontSize: 20,marginLeft: 5,}}>Instagram</Text>
                                </>
                            ) : (
                                <>
                                    <LinkIcon />
                                    <Text style={{textAlign: 'center',fontWeight: 'bold',fontSize: 20,marginLeft: 5,}}>External Link</Text>
                                </>
                            )}
                        </View>

                        <View style={tailwind('w-full flex flex-row border-b border-secondary items-start px-4 py-3')}/>

                        {/* User inform his url */}
                        <View style={tailwind('w-full flex flex-row border-b border-secondary items-start px-4 py-3')}>
                            <View style={[tailwind(''), {width: 50,height: 30,justifyContent: 'center'}]}>
                                <Text style={[tailwind("text-slate-900"), { fontSize: 16,fontWeight: 'bold',}]}>URL</Text>
                            </View>

                            <TextInput
                                value={linkText}
                                onChangeText={setLinkText}
                                style={[tailwind('text-slate-900'), { fontSize: 12,width:'78%',height:30,fontFamily: 'GmarketMedium',}]}
                                placeholder={'Your URL'} 
                            />

                            {linkText != "" && (
                                <TouchableOpacity onPress={() => setLinkText('')} style={{position: 'absolute',right: 10,top: 15}}>
                                    <CancelIcon />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* User inform his title */}
                        <View style={tailwind('w-full flex flex-row border-b border-secondary items-start px-4 py-3')}>
                            <View style={[tailwind(''), {width: 50,height: 30,justifyContent: 'center'}]}>
                                <Text style={[tailwind("text-slate-900"), { fontSize: 16,fontWeight: 'bold',}]}>Title</Text>
                            </View>

                            <TextInput
                                value={titleText}
                                onChangeText={setTitleText}
                                style={[tailwind('text-slate-900'), { fontSize: 12,width:'78%',height:30,fontFamily: 'GmarketMedium',}]}
                                placeholder={'Your title (optionnal)'} 
                            />

                            {titleText != "" && (
                                <TouchableOpacity onPress={() => setTitleText('')} style={{position: 'absolute',right: 10,top: 15}}>
                                    <CancelIcon />
                                </TouchableOpacity>
                            )}
                        </View>
                    </Animated.View>
                )}
            </BottomSheetModal>
        </BottomSheetModalProvider>
        // </Modal>
    )
}


const InputGroup = ({label, height = 20, placeholder, value, setValue, autoFocus = false, animation1, animation2, setShowLinks, numberLink}) => {
    const { user } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const showSocialLinks = () => {
        Haptics.selectionAsync();
        Keyboard.dismiss()

        Animated.parallel([
            Animated.timing(animation1, {
                toValue: -Dimensions.get('window').width,
                duration: 300,
                useNativeDriver: true
            }),
            Animated.timing(animation2, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true
            })
        ]).start();

        setShowLinks(true)
    }

    return(
        <View style={tailwind('w-full flex flex-row border-b border-secondary items-start px-4 py-3')}>

            {/** Label */}
            <View style={[tailwind(''), {width: 95,height:30,justifyContent: 'center'}]}>
                <Text style={[tailwind("text-slate-900"), { fontSize: 12,fontFamily: "GmarketBold" }]}>{label}</Text>
            </View>

            {label == 'Social links' ? (
                <TouchableOpacity 
                    onPress={() => showSocialLinks()} 
                    style={[tailwind('flex flex-row flex-1'), {alignItems: 'center',justifyContent: 'space-between',height: 30}]}
                >

                    {numberLink != 0 ? (
                        <Text style={{fontSize: 12,fontFamily: "GmarketMedium",color: '#959595'}}>
                            {numberLink}
                        </Text>
                    ) : (
                        <Text style={{fontSize: 12,fontFamily: "GmarketMedium",color: Platform.OS == 'ios' ? '#C5C5C7' : '#676767',}}>
                            {user?.profile?.data?.list_link && user?.profile.data.list_link.length > 0 ? user?.profile.data.list_link.length : 'Add links'}
                        </Text>
                    )}

                    <TouchableOpacity onPress={() => showSocialLinks()}>
                        <Image
                            style={{width: 25,height: 25,}}
                            resizeMode='contain'
                            source={require('../../assets/continue_button.png')}
                            defaultSource={require('../../assets/continue_button.png')}
                        />
                    </TouchableOpacity>
                </TouchableOpacity>
            ) : (
                <View style={[tailwind('flex flex-row flex-1'), {alignItems: 'center',height: 30}]}>
                    <TextInput
                        autoFocus={autoFocus}
                        value={value}
                        onChangeText={new_text => setValue(new_text)}
                        multiline={height > 20 ? true : false}
                        style={[tailwind('text-slate-900 w-full'), {fontSize: 12, fontFamily: "GmarketMedium", textAlignVertical:'center'}]}
                        placeholder={placeholder}
                    />
                </View>
            )}

        </View>
    )
}