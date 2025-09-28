import React, { useContext, useMemo, useState } from 'react'
import { Image, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import * as Haptics from 'expo-haptics';

import HeaderImage from '../../components/HeaderImage';
import { GlobalContext } from '../../contexts/GlobalContext';
import moment from 'moment';

const RewardHistory = ({navigation, route}) => {
    const { userData } = useContext(GlobalContext);

    const categories = ["All", "Check-in", "AD", "Activity", "Invite", "Bonus"];
    const [selectedCategory, setSelectedCategory] = useState("All");

    const tempList = userData?.listClaimedOranges ?? []
    if(tempList){
        tempList.sort((a, b) => (moment(a.date).format('YYYY-MM-DD') < moment(b.date).format('YYYY-MM-DD')) ? 1 : -1)
    }
    // const tempList = userData?.listClaimedOranges ?? [
    // {
    //         date: '2024-06-01',
    //         listOranges: [
    //             {
    //                 numberOranges: 10,
    //                 type: 'Daily Check-in'
    //             },
    //         ]
    //     },
    //     {
    //         date: '2024-05-31',
    //         listOranges: [
    //             {
    //                 numberOranges: 20,
    //                 type: '7-Day Streak Bonus'
    //             },
    //         ]
    //     },
    //     {
    //         date: '2024-05-30',
    //         listOranges: [
    //             {
    //                 numberOranges: 5,
    //                 type: 'Daily Check-in'
    //             },
    //         ]
    //     },
    //     {
    //         date: '2024-05-29',
    //         listOranges: [
    //             {
    //                 numberOranges: 10,
    //                 type: 'Daily Check-in'
    //             },
    //             {
    //                 numberOranges: 50,
    //                 type: 'Ad Rewards'
    //             },
    //             {
    //                 numberOranges: 10,
    //                 type: 'Invite Friends'
    //             },
    //         ]
    //     },
    //     {
    //         date: '2024-05-28',
    //         listOranges: [
    //             {
    //                 numberOranges: 10,
    //                 type: 'Daily Check-in'
    //             },
    //             {
    //                 numberOranges: 20,
    //                 type: '14-Day Streak Bonus'
    //             },
    //             {
    //                 numberOranges: 10,
    //                 type: 'Invite Friends'
    //             },
    //         ]
    //     },
    // ]

    const filteredList = useMemo(() => {
        if (!tempList) return [];

        const sortedList = [...tempList].sort(
            (a, b) => moment(b.date).valueOf() - moment(a.date).valueOf()
        );

        if (selectedCategory === "All") return sortedList;

        return sortedList.map((entry) => ({
            ...entry,
            listOranges: entry.listOranges.filter((orange) =>
                orange.type.toLowerCase().includes(selectedCategory.toLowerCase())
            ),
        }));
    }, [userData, selectedCategory]);

    const renderOrangeItem = (item, date) => {
        return(
            <View
                key={`${date}-${item.type}-${item.numberOranges}`}
                style={styles.card}
            >
                <View style={{gap: 10}}>
                    <Text style={styles.title}>{item.type}</Text>

                    <Text style={styles.subtitle}>
                        {
                            item.type.toLowerCase().includes("check-in") ? "Check-in reward"
                            : item.type.toLowerCase().includes("ad") ? "Watch AD"
                            : item.type.toLowerCase().includes("activity") ? "Complete daily task"
                            : item.type.toLowerCase().includes("invite") ? "Invite reward"
                            : item.type.toLowerCase().includes("bonus") ? "Bonus"
                            : "Other"
                        }
                    </Text>
                </View>

                <View style={{flex: 1, gap: 5,alignItems:'flex-end',}}>
                    <View style={{flexDirection: 'row', justifyContent:'center', gap: 4}}>
                        <Image
                            style={{width: 19,height: 19,}}
                            resizeMode='contain'
                            source={require('../../assets/trophy/trophy_icon_orange.png')}
                            defaultSource={require('../../assets/trophy/trophy_icon_orange.png')}
                        />  
                        <Text style={{fontSize: Platform.OS == 'ios' ? 17 : 15, fontFamily:'GmarketBold',height: 19, }}>{item.numberOranges}</Text>
                    </View>

                    <Text style={styles.date}>
                        {new Date(date).toLocaleDateString("fr-FR").replace(/\//g, ".")}
                    </Text>
                </View>
            </View>
        )
    };

    return (
        <View style={[{flex: 1, backgroundColor: 'white',}]}>
            <HeaderImage />

            <View style={{flexDirection: 'row',justifyContent: 'flex-start',alignItems: 'center',paddingLeft: 5,paddingTop: 4,}}>
                <TouchableOpacity style={{margin: 15,}} onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                    <Image
                        style={{width: 24,height: 24}}
                        resizeMode='contain'
                        source={require('../../assets/back_button.png')}
                        defaultSource={require('../../assets/back_button.png')}
                    />
                </TouchableOpacity>
                <Text style={{fontFamily: 'GmarketBold', fontSize: Platform.OS == 'ios' ? 18 : 16,}}>Reward History</Text>
            </View>

            <SafeAreaView style={{flex: 1}}>
                <ScrollView showsVerticalScrollIndicator={false}>

                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.tabContainer}
                    >
                        {categories.map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                style={[
                                    styles.categoryButton,
                                    selectedCategory === cat && styles.categoryButtonActive,
                                ]}
                                onPress={() => setSelectedCategory(cat)}
                            >
                                <Text
                                    style={[
                                        styles.categoryText,
                                        selectedCategory === cat && styles.categoryTextActive,
                                        {alignSelf:'center',}
                                    ]}
                                >
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <View style={{paddingHorizontal: 7,}}>
                        {filteredList.length > 0 ? (
                            filteredList.map((entry) =>
                                entry.listOranges.map((orange, idx) =>
                                    renderOrangeItem(orange, entry.date, idx)
                                )
                            )
                        ) : (
                            <Text style={{textAlign:'center', marginTop: 20, color:'#999'}}>
                                No oranges claimed
                            </Text>
                        )}
                    </View>

                    <View style={{height: 100}} />
                </ScrollView>
            </SafeAreaView>
        </View>
    )
}

export default RewardHistory

const styles = StyleSheet.create({
  tabContainer: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F6F7FC",
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: "#f97316",
  },
  categoryText: {
    fontSize: 14,
    color: "#454545",
  },
  categoryTextActive: {
    color: "#ffffff",
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FEF5F3",
    padding: 16,
    paddingVertical: 20,
    borderRadius: 16,
    marginVertical: 5,
    marginHorizontal: 10,
  },
  title: {
    fontFamily: 'GmarketMedium',
    fontSize: Platform.OS == 'ios' ? 17 : 15,
    color: "#1f2937",
  },
  subtitle: {
    fontFamily:'GmarketMedium',
    fontSize: Platform.OS == 'ios' ? 13 : 11,
    color: "#999",
  },
  date: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  orangeCount: {
    fontFamily: 'GmarketBold',
    fontSize: Platform.OS == 'ios' ? 18 : 16,
    color: "#000",
  },
});