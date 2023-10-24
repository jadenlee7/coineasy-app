import React, { useContext, useEffect } from "react";
import { View, TouchableOpacity, Image, BackHandler, Animated } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import { useFocusEffect } from '@react-navigation/native';

import Feed from "../components/Feed";
import Header from "../components/Header";
import { GlobalContext } from "../contexts/GlobalContext";


const Home = ({ navigation, route }) => {
    const { posts, currentRoute, selectedCategory, setSelectedCategory,selectedNews,setSelectedNews, refreshing, refreshingBottom, onRefresh, showPostbox, loadMorePosts, category, setCategory, setScrollAnim, setOffsetAnim, setCurrentRoute } = useContext(GlobalContext);
    const tailwind = useTailwind();

    useFocusEffect(
        React.useCallback(() => {
            setCurrentRoute(route.name)
        }, [])
    );
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
    });

    useEffect(() => {
        return () => backhandler.remove();
    }, [navigation])

    return(
        <>
            <Header />
            <View style={tailwind('flex flex-col flex-1')}>
                <View style={tailwind('flex flex-1 bg-white')}>
                    <Feed posts={posts} refreshing={refreshing} refreshingBottom={refreshingBottom} onRefresh={onRefresh} loadMore={loadMorePosts}/>

                    {/** Share button */}
                    <TouchableOpacity activeOpacity="0.8" style={[tailwind('absolute'), {elevation: 10, bottom: 15, right: 15} ]} onPress={() => showPostbox()}>
                        <Image
                            style={{ height: 70, width: 70 }}
                            source={require('../assets/share_btn.png')} 
                        />
                    </TouchableOpacity>
                </View>
            </View>
        </>
    )
}

export default Home
