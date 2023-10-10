import React, { useContext, useEffect } from "react";
import { ScrollView, RefreshControl, Text, View, TouchableOpacity, Image, TouchableHighlight, Animated, Dimensions } from 'react-native';

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import { NotificationsIcon } from "../components/Icons";
import { GlobalContext } from "../contexts/GlobalContext";
import useStatusBarHeight from "../hooks/useStatusBarHeight";

const Categories = ({ navigation, route }) => {
    const { categories, loadContexts } = useContext(GlobalContext);
    const tailwind = useTailwind();
    const statusBarHeight = useStatusBarHeight();


    useEffect(() => {
        navigation.addListener('tabPress', (e) => {
            Haptics.selectionAsync();
        });
    }, [])


    const Category = ({category}) => {
        const { setCategory, setScreen, setPreviousScreen } = useContext(GlobalContext);
        const tailwind = useTailwind();

        function selectCat() {
            console.log("Selecting category.");
            setCategory(category);
            navigation.replace('Navigator')
        }
    
        return(
            <TouchableHighlight 
                style={[tailwind('flex flex-col border border-slate-200 rounded-md mb-4 items-center'), {width: "29%", aspectRatio: 1, marginRight: "4%"}]}
                underlayColor="#f8fafc" 
                onPress={() => selectCat()}
            >
                <View style={[tailwind("bg-slate-950 rounded-md mb-2 justify-center overflow-hidden"), { width: "100%", height: "100%", opacity: 1 }]} >
                    {/** Category image */}
                    {category.content.imageUrl &&
                        <Image
                            style={[tailwind("absolute"), { width: "100%", height: "100%" }]}
                            source={{
                                uri: category.content.imageUrl,
                                cache: 'force-cache'
                            }}
                        />
                    }
            
                    {/** Dark background */}
                    <View style={[tailwind("absolute bg-slate-950"), { width: "100%", height: "100%", opacity: 0.35 }]} />
            
                    {/** Category name */}
                    <Text style={[tailwind("text-center w-full mt-7 mb-2"), { fontSize: 12, lineHeight: 16, fontFamily: "GmarketBold", color: "#FFF" }]}>{category.content.displayName}</Text>
                </View>
            </TouchableHighlight>
        )
    }

    return(
        <View style={tailwind('flex flex-1 bg-white')}>
            <Image
                style={{ 
                    width: Dimensions.get('window').width,
                    height: 40 + statusBarHeight,
                    paddingTop: statusBarHeight,
                }}
                source={require('../assets/HeaderBg.png')} 
            />

            <View style={{flexDirection: 'row',justifyContent: 'space-between',alignItems: 'center',marginTop: 20,marginBottom: 10,}}>
                <Text style={[tailwind('text-slate-900 px-2'), { fontSize: 16, fontFamily: "GmarketBold", lineHeight: 20,marginLeft: 10, }]}>Categories</Text>

                <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('Notifications')} style={{marginRight: 30,}}>
                    <NotificationsIcon />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={tailwind('flex flex-row flex-1 items-start px-5 py-2 w-full flex-wrap')}
                refreshControl={
                    <RefreshControl refreshing={false} onRefresh={loadContexts} />
                }
            >
                {/** Loop and display categories */}
                {categories.map((category, key) => {
                    return (
                        <Category key={key} category={category} />
                    );
                })}
            </ScrollView>
        </View>
    )
}

export default Categories
