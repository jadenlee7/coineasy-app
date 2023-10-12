import React, { useContext, useEffect } from "react";
import { View, TouchableOpacity, Image } from 'react-native';

import Feed from "../components/Feed";
import { GlobalContext } from "../contexts/GlobalContext";
import { useTailwind } from 'tailwind-rn';
import Header from "../components/Header";
import * as Haptics from 'expo-haptics';


const Home = ({ navigation, route }) => {
    const { posts, refreshing, refreshingBottom, onRefresh, showPostbox, loadMorePosts } = useContext(GlobalContext);
    const tailwind = useTailwind();

    useEffect(() => {
        navigation.addListener('tabPress', (e) => {
            Haptics.selectionAsync();
        });
    }, [])

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
                    source={require('../assets/share_btn.png')} />
                </TouchableOpacity>
                </View>
            </View>
        </>
    )
}

export default Home
