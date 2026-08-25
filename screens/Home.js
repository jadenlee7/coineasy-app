import React, { useContext, useEffect } from "react";
import { View, TouchableOpacity, Image, BackHandler, Animated, Text, Platform } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import { useFocusEffect } from '@react-navigation/native';

import Feed from "../components/Feed";
import Header from "../components/Header";
import { GlobalContext } from "../contexts/GlobalContext";
import Modal from "../components/Modal";
import { AntDesign } from "@expo/vector-icons";
import Button from "../components/Button";
import useFeed from "../hooks/useFeed";
import DailyRunHomeCard from "../components/DailyRunHomeCard";
import useStatusBarHeight from "../hooks/useStatusBarHeight";


const Home = ({ navigation, route }) => {
    const { currentRoute,
        selectedCategory, 
        setSelectedCategory,selectedNews,setSelectedNews, 
        showPostbox, 
        category, 
        setCategory, 
        setScrollAnim, 
        setOffsetAnim, 
        setCurrentRoute, 
        setEditedPost,
        adAlreadyClaimed,
        setAdAlreadyClaimed
    } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const {
        items: posts,
        loading,
        refreshing,
        loadingMore,
        error,
        backendConfigured,
        refresh,
        loadMore,
    } = useFeed('home', { limit: 20 });
    const statusBarHeight = useStatusBarHeight();
    const homeHeaderHeight = statusBarHeight > 25
        ? 65 + statusBarHeight
        : 60 + statusBarHeight;

    useFocusEffect(
        React.useCallback(() => {
            setCurrentRoute(route.name)
        }, [route.name, setCurrentRoute])
    );

    useEffect(() => {
        const backhandler = BackHandler.addEventListener('hardwareBackPress', function () {
            Haptics.selectionAsync()
            if(currentRoute == 'Categories'){
                if (selectedCategory) {
                    setSelectedCategory(null)
                    return true;
                }else{
                    setScrollAnim(new Animated.Value(0))
                    setOffsetAnim(new Animated.Value(0))
                    navigation.goBack()
                    return true;
                }
            } else if(currentRoute == 'News'){
                if (selectedNews) {
                    setSelectedNews(null)
                    return true;
                }else{
                    setScrollAnim(new Animated.Value(0));
                    setOffsetAnim(new Animated.Value(0));
                    navigation.goBack()
                    return true;
                }
            } else if(currentRoute == 'Home'){
                if (category) {
                    setCategory(null)
                }
                setScrollAnim(new Animated.Value(0));
                setOffsetAnim(new Animated.Value(0));
                navigation.replace('Navigator')
                return true
            }
            return false;
        });

        return () => backhandler.remove();
    }, [category, currentRoute, navigation, selectedCategory, selectedNews, setCategory, setOffsetAnim, setScrollAnim, setSelectedCategory, setSelectedNews])

    return(
        <>
            <Header />
            
            <View style={tailwind('flex flex-col flex-1')}>
                <View style={tailwind('flex flex-1 bg-white')}>
                    <View style={tailwind('flex flex-1')}>
                        <Feed
                            posts={posts}
                            refreshing={loading || refreshing}
                            refreshingBottom={loadingMore}
                            onRefresh={refresh}
                            loadMore={loadMore}
                            error={error}
                            backendConfigured={backendConfigured}
                            header={(
                                <View style={{paddingTop: homeHeaderHeight}}>
                                    <DailyRunHomeCard onPress={() => navigation.navigate('DailyRun')} />
                                </View>
                            )}
                        />
                    </View>

                    {/** Share button */}
                    <TouchableOpacity activeOpacity="0.8" style={[tailwind('absolute'), {elevation: 10, bottom: 15, right: 15} ]} onPress={() => {setEditedPost(null);showPostbox()}}>
                        <Image
                            style={{ height: 70, width: 70 }}
                            source={require('../assets/share_btn.png')} 
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {adAlreadyClaimed && (
                <View style={{
                    zIndex: 9999,
                    position: 'absolute',
                    flex: 1,
                    width: '100%',
                    height:'100%',
                }}>
                    <Modal 
                        hide={() => setAdAlreadyClaimed(false)} 
                        type='oranges' 
                    >         
                        <TouchableOpacity
                            style={{position: 'absolute',top: 15, right: 15}}
                            onPress={() => {Haptics.selectionAsync();setAdAlreadyClaimed(false)}}
                        >
                            <AntDesign name="closecircle" size={24} color="black" />
                        </TouchableOpacity>

                        <View style={[tailwind('flex flex-col items-center justify-center px-3')]}>
                            <Text style={[tailwind(`text-center`), {color: "#000000",fontSize: Platform.OS == 'ios' ? 19 : 16,fontFamily: "GmarketBold",lineHeight: 24,marginTop: Platform.OS == 'ios' ? 10 : 20,}]}>
                                Oops, this basket is empty!
                            </Text>

                            <Text style={{textAlign: 'center',fontFamily: "GmarketMedium",fontSize: Platform.OS == 'ios' ? 16 : 13,marginTop: Platform.OS == 'ios' ? 20 : 10,}}>
                                You've already claimed :)
                            </Text>

                            <Image 
                                source={require('../assets/orange_box_empty.png')} 
                                style={{height: '58%',alignSelf: 'center',marginTop: Platform.OS == 'ios' ? 30 : 20,}} 
                                resizeMode="contain"
                            />
                        </View>

                        <Button 
                            size="md" 
                            color="white" 
                            title="Go to Reward Page" 
                            onPress={() => {Haptics.selectionAsync();setAdAlreadyClaimed(false);navigation.navigate('RewardHistory')}} 
                            style={{width: '85%',alignItems: 'center',alignSelf:'center', height: 50,justifyContent: 'center',position: 'absolute',bottom: 30,zIndex: 2}}
                        />                           
                    </Modal>
                </View>
            )}
        </>
    )
}

export default Home
