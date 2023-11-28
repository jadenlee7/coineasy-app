import React, { useContext, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Animated, Dimensions, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';

import useStatusBarHeight from '../hooks/useStatusBarHeight'
import { CloseIcon, SmallSearchIcon } from '../components/Icons'
import { GlobalContext } from '../contexts/GlobalContext'
import User from '../components/User'
import AsyncStorage from '@react-native-async-storage/async-storage';

const Search = ({ navigation, route }) => {
    const { user, orbis, categories, setSelectedCategory } = useContext(GlobalContext);
    const tailwind = useTailwind()

    const windowSize = Dimensions.get('window')

    const [clicked, setClicked] = useState(false);
    const [searchPhrase, setSearchPhrase] = useState("");

    const [marginTop] = useState(new Animated.Value(-60))
    const [searchWidth] = useState(new Animated.Value(windowSize.width * 0.92))

    const [listFollow, setListFollow] = useState([])
    const [users, setUsers] = useState([])
    const [followUsers, setFollowUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false)

    const [listTopCategories, setListTopCategories] = useState([])
    const [listRecentSearches, setListRecentSearches] = useState([])

    const textInputRef = useRef()

    const list_top_categories = [
        '#EASYDAO', 
        '#INSIGHT',
        '#DAILY',
        '#FOOD',
        '#TRAVEL',
    ]

    useEffect(() => {
        getListFollow()
        getTopCategories()
        getRecentSearch()
    }, [])

    useEffect(() => {
        if(clicked){
            Animated.parallel([
                Animated.timing(marginTop, {
                    toValue: Platform.OS =='ios' ? -230 : -220,
                    duration: 500,
                    useNativeDriver: false,
                }),
                Animated.timing(searchWidth, {
                    toValue: windowSize.width * 0.85,
                    duration: 400,
                    useNativeDriver: false,
                })
            ]).start()
        }else{
            Animated.parallel([
                Animated.timing(marginTop, {
                    toValue: -60,
                    duration: 500,
                    useNativeDriver: false,
                }),
                Animated.timing(searchWidth, {
                    toValue: windowSize.width * 0.92,
                    duration: 400,
                    useNativeDriver: false,
                })
            ]).start()
        }
    }, [clicked])
    
    async function getListFollow() {
        const result_followers = await orbis.getProfileFollowers(user.did);
        const result_following = await orbis.getProfileFollowing(user.did);

        result_followers.data.forEach(e => e.details.type = 'Followers');
        result_following.data.forEach(e => e.details.type = 'Following');

        const list_follow = [...result_followers.data, ...result_following.data];
        setListFollow([...list_follow])
    }

    async function getTopCategories() {

        // TODO: design a algorythm to establish top categories

    }

    async function getRecentSearch(){
        let temp_list = await AsyncStorage.getItem("list_recent_search");

        const new_list = JSON.parse(temp_list)
        if(new_list){
            new_list.sort((a, b) => (a.date < b.date) ? 1 : -1)
            setListRecentSearches(new_list)
        }
    }

    async function searchUsers (term) {
        setUsersLoading(true);
        setSearchPhrase(term)

        const {data, error} = await orbis.getProfilesByUsername(term);

        let result = term != '' ? listFollow.filter(e => e.details?.profile?.username?.startsWith(term)) : listFollow

        let seenObjects = {};
        let listWithoutDuplicates = result.filter(objet => {
            if (!seenObjects.hasOwnProperty(objet.details.did)) {
                seenObjects[objet.details.did] = true;
                return true;
            }
            return false;
        });

        let listWithoutCommon = data.filter(elt1 => !result.some(elt2 => elt2.details.did === elt1.did));

        setUsers(listWithoutCommon);
        setFollowUsers(listWithoutDuplicates)
        setUsersLoading(false);
    }

    async function showUser (user) {
        Haptics.selectionAsync();

        if(user.details) {
            var utc = new Date().toJSON();
            const new_search = {'details': user.details, 'date': utc}

            let indexItem = listRecentSearches.findIndex( e => e.details.did === new_search.details.did );

            if(indexItem == -1){
                listRecentSearches.push(new_search)
            }else{
                listRecentSearches[indexItem].date = utc
            }

            listRecentSearches.sort((a, b) => (a.date < b.date) ? 1 : -1)
            setListRecentSearches([...listRecentSearches])

            await AsyncStorage.setItem("list_recent_search", JSON.stringify(listRecentSearches));             
            navigation.navigate('ProfileSelected', { did: user.details.did, 'back': 'search'})
        }
    }

    async function deleteRecentSearch(index){
        Haptics.selectionAsync();

        listRecentSearches.splice(index, 1)
        setListRecentSearches([...listRecentSearches])
        await AsyncStorage.setItem("list_recent_search", JSON.stringify(listRecentSearches));
    }

    async function showCategory(category) {
        navigation.navigate('Categories', {'loadPosts': true, 'category': category})
    }

    return (
        <View style={{backgroundColor: 'white',}}>
            <Pressable onPress={() => {setClicked(false);setSearchPhrase("");textInputRef?.current?.blur()}}>
                <Image
                    style={{ 
                        width: windowSize.width,
                        // width: 200,
                        height: 330,
                        marginTop: Platform.OS == 'ios' ? 10 : -20,
                    }}
                    resizeMode='contain'
                    source={require('../assets/search_top_image.png')}
                    defaultSource={require('../assets/search_top_image.png')}
                />
            </Pressable>

            <Animated.View style={{
                    backgroundColor: 'white',
                    height:90,
                    width: windowSize.width,
                    borderTopLeftRadius: 40,
                    borderTopRightRadius: 40,
                    marginTop: marginTop,
                }}
            >
                <View style={[styles.container, {justifyContent: clicked ? 'flex-end' : 'center',}]}>

                    {/* cancel button, depending on whether the search bar is clicked or not */}
                    {clicked && (
                        <TouchableOpacity style={{marginRight: 5,}} onPress={() => {setClicked(false);setSearchPhrase("");textInputRef?.current?.blur()}}>
                            <Image
                                style={{width: 30,height: 30}}
                                resizeMode='contain'
                                source={require('../assets/back_button.png')}
                                defaultSource={require('../assets/back_button.png')}
                            />
                        </TouchableOpacity>
                    )}

                    <Animated.View style={[clicked ? styles.searchBar__clicked: styles.searchBar__unclicked, {width: searchWidth}]}>
                        <SmallSearchIcon color={"#959595"} style={{marginLeft: 8,}}/>

                        <TextInput
                            ref={textInputRef}
                            style={styles.input}
                            placeholder="Search"
                            placeholderTextColor="#959595" 
                            value={searchPhrase}
                            onChangeText={new_term => searchUsers(new_term)}
                            onFocus={() => setClicked(true)}
                        />

                        {searchPhrase != '' && (
                            <TouchableOpacity onPress={() => setSearchPhrase("")} style={{position: 'absolute',right: 10}}>
                                <CloseIcon />
                            </TouchableOpacity>
                        )}
                    </Animated.View>
                </View>
            </Animated.View>


            {searchPhrase != '' && usersLoading ? (
                <View style={{backgroundColor: 'white',height: windowSize.height}}>
                    <ActivityIndicator size="small" color="#FF6B17" />
                </View>
            ) : searchPhrase != '' ?(
                <ScrollView keyboardShouldPersistTaps='handled' style={{backgroundColor: 'white',height: windowSize.height}}>
                    {/** Loop through follow users */}
                    {followUsers.map((_user, key) => {
                        return (
                            <TouchableOpacity 
                                style={tailwind("p-2 px-4")} 
                                activeOpacity={0.6} 
                                onPress={() => showUser(_user)}
                                key={key}
                            >
                                <User details={_user.details} isFollow={true}/>
                            </TouchableOpacity>
                        );
                    })}

                    {/** Loop through users */}
                    {users.map((_user, key) => {
                        return (
                            <TouchableOpacity 
                                style={tailwind("p-2 px-4")} 
                                activeOpacity={0.6} 
                                onPress={() => showUser(_user)}
                                key={key}
                            >
                                <User details={_user.details} isFollow={false}/>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            ) : (
                <View style={{backgroundColor: 'white',height: windowSize.height}}>
                    <View>
                        <Text style={{fontWeight: 'bold',fontSize: 14,marginLeft: 20,fontFamily: "GmarketBold",height: Platform.OS == 'ios' ? 20 : 'auto'}}>Top Categories</Text>
                    </View>

                    <View style={{flexDirection: 'row',justifyContent: 'center',alignItems: 'center',paddingLeft: 20,paddingTop: 17}}>
                        <TouchableOpacity activeOpacity={0.7} style={{backgroundColor: 'black',width: 40,height: 40,borderRadius: 25,justifyContent: 'center',alignItems: 'center',}}>
                            <Image
                                style={{width: 23,height: 23}}
                                resizeMode='contain'
                                source={require('../assets/fire_category.png')}
                                defaultSource={require('../assets/fire_category.png')}
                            />
                        </TouchableOpacity>
                        <ScrollView horizontal={true} keyboardShouldPersistTaps='always' showsHorizontalScrollIndicator={false}>
                            {categories.filter(e => list_top_categories.includes(e.content.displayName)).map((e, index) => {
                                return(
                                    <TouchableOpacity 
                                        key={Math.random()}
                                        style={{height:40,borderWidth: 2,borderRadius:20, justifyContent: 'center',paddingLeft:15,paddingRight:15,marginLeft: 10,marginRight: index == categories.filter(e => list_top_categories.includes(e.content.displayName)).length -1 ? 10 : 0,}}
                                        onPress={() => showCategory(e)}
                                    >
                                        <Text style={{fontWeight: 'bold',}}>{e.content.displayName}</Text>
                                    </TouchableOpacity>
                                )
                            })}
                        </ScrollView>
                    </View>


                    <View>
                        <Text style={{fontWeight: 'bold',fontSize: 14,marginLeft: 20,marginTop: 20,marginBottom: 10,fontFamily: "GmarketBold",}}>Recent Searches</Text>
                    </View>

                    { listRecentSearches && listRecentSearches?.length != 0 ? (
                        <ScrollView keyboardShouldPersistTaps='always' showsVerticalScrollIndicator={false}>
                            {listRecentSearches.map((e, index) => {
                                return(
                                    <View key={Math.random()} style={{justifyContent: 'center',}}>
                                        <TouchableOpacity style={tailwind("p-2 px-5")} activeOpacity={0.6} onPress={() => showUser(e)}>
                                            <User details={e.details} isFollow={e.details.type ? true : false}/>
                                        </TouchableOpacity>

                                        <TouchableOpacity onPress={() => deleteRecentSearch(index)} style={{position: 'absolute',right: 10}}>
                                            <CloseIcon />
                                        </TouchableOpacity>
                                    </View>
                                )
                            })}
                        </ScrollView>
                    ) : (
                        <View style={tailwind('bg-slate-50 px-2 py-4 items-center mt-4 mx-6 rounded-md')} >
                            <Text style={tailwind('text-secondary items-center ml-1')}>You don't have any search yet.</Text>
                        </View>
                    )}
                </View>
            )}

        </View>
    )
}

export default Search

const styles = StyleSheet.create({
    container: {
        margin: 20,
        alignSelf: 'center',
        alignItems: "center",
        flexDirection: "row",
        width: "95%",
    },
    searchBar__unclicked: {
        flexDirection: "row",
        alignItems: "center",
        padding: 10,
        width: "95%",
        borderWidth: 1,
        borderRadius: 30,
        height: 50,
    },
    searchBar__clicked: {
        flexDirection: "row",
        justifyContent: "space-evenly",
        alignItems: "center",
        padding: 10,
        width: "90%",
        borderWidth: 1,
        borderRadius: 30,
        height: 50,
    },
    input: {
        fontSize: 17,
        marginLeft: 10,
        width: "90%",
    },
})