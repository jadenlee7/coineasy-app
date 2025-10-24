import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';

import * as Haptics from 'expo-haptics';
import { GlobalContext } from '../../../contexts/GlobalContext';
import moment from 'moment';

const ShopScreen = ({ setSelectedShopItem, handleModalPress }) => {
    const { 
        orbis,
        user,
        userData,
        setUserData,
        setNewGiftsCount
    } = useContext(GlobalContext);


    const onClaimProduct = async (item) => {
        Haptics.selectionAsync()
        setSelectedShopItem(item)

        let removeNumber = item.oranges
        const tempData = userData

        if(tempData && tempData.numberOranges < removeNumber){
            Alert.alert("You don't have enough oranges.")
        }else{
            tempData.numberOranges > removeNumber ? tempData.numberOranges -= removeNumber : tempData.numberOranges = 0
    
            if(tempData.listClaimedOranges){
                const index = tempData.listClaimedOranges.findIndex(e => e.date == moment().format('YYYY-MM-DD'))
                if(index != -1){
                    tempData.listClaimedOranges[index].listOranges.push({
                        numberOranges: removeNumber,
                        type: item.title
                    })
                }else{
                    tempData.listClaimedOranges.push({
                        date: moment().format('YYYY-MM-DD'),
                        listOranges: [
                            {
                                numberOranges: removeNumber,
                                type: item.title
                            },
                        ]
                    })
                }
            }else{
                tempData.listClaimedOranges = [{
                    date: moment().format('YYYY-MM-DD'),
                    listOranges: [
                            {
                                numberOranges: removeNumber,
                                type: item.title
                            },
                    ]
                }]
            }


            const giftItem = {
                id: Math.random(),
                title: item.title,
                subtitle: item.subtitle,
                image: item.image,
                date: moment().format("MM.DD.YYYY h:mm A"),
                status: 'Not available yet'
            }
            if(tempData.gifts){
                tempData.gifts.push(giftItem)
            }else{
                tempData.gifts = [giftItem]
            }

            setUserData({...tempData})
            var tempProfile = user.profile
            tempProfile.data = tempData

            setNewGiftsCount(true)

            setShopData(prev =>
                prev.map(p =>
                    p.id === item.id
                    ? { ...p, remainer: Math.max(p.remainer - 1, 0) } // évite les valeurs négatives
                    : p
                )
            );
            
            await orbis.updateProfile(tempProfile);

            handleModalPress()
        }

    }

    const RewardItem = ({ item, index }) => (
        <View style={[styles.rewardItem, {marginTop: index == 0 ? 10 : 0,}]}>
            <View style={{flex: 1, flexDirection: 'column', justifyContent: 'space-between',}}>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start', gap: 10}}>
                    <Image
                        style={{width: 90, height: 90}}
                        resizeMode='contain'
                        source={item.image}
                    /> 
                    
                    <View style={{flexShrink: 1, marginTop: 5,}}>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.subtitle}>{item.subtitle}</Text>
                    </View>
                </View>

                
                <View style={{marginTop: 10,flexDirection:'row',justifyContent:'space-between',alignItems:'center',}}>

                    <View style={{flexDirection:'row',justifyContent:'flex-start',alignItems:'center',fontFamily: 'GmarketMedium', marginTop: 5}}>
                        <Text style={{fontSize: 11,fontFamily: 'GmarketMedium',}}>{item.remainer}</Text>
                        <Text style={{fontSize: 11, color: '#959595',fontFamily: 'GmarketMedium'}}>/{item.total} Remain</Text>
                    </View>

                    <TouchableOpacity 
                        style={[styles.button, { backgroundColor: item.remainer == 0 ? '#F1F4F9' : '#FF6B17' }]}
                        onPress={() => onClaimProduct(item)}
                    >
                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 7}}>
                            <Text style={{color: item.remainer == 0 ? '#959595' : 'white',fontSize: 10,fontFamily: 'GmarketMedium'}}>
                                {item.remainer > 0 ? 'Apply' : 'Closed'}
                            </Text>
                            <View style={{width: 20, height: 20, borderRadius: 20,backgroundColor: '#FFF2E2', justifyContent:'center',alignItems:'center',}}>
                                <Image
                                    style={{width: 15, height: 15}}
                                    resizeMode='contain'
                                    source={require('../../../assets/trophy/trophy_icon_orange.png')}
                                />                                 
                            </View>
                            <Text style={{color: item.remainer == 0 ? '#959595' : 'white',fontSize: 11,fontFamily: 'GmarketBold'}}>{item.oranges}</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
            
        </View>
    );

    const addOrange = async () => {
        const tempData = userData
    
        tempData.numberOranges = 2000
                
        setUserData({...tempData})
    }

    const [shopData, setShopData] = useState([
        {
            id: 1,
            title: 'Seed Box',
            subtitle: 'This box will later be convertible into assets such as NFT whitelists, NFTs, tokens, and points.',
            remainer: 1000,
            total: 1000,
            oranges: 200,
            image: require('../../../assets/shop/seed_box.png'),
            successText: "You've received a Seed Box",
        },
        {
            id: 2,
            title: 'Sprout Box',
            subtitle: 'This box will later be convertible into assets such as NFT whitelists, NFTs, tokens, and points.',
            remainer: 200,
            total: 200,
            oranges: 500,
            image: require('../../../assets/shop/sprout_box.png'),
            successText: "You've received a Sprout Box",
        },
        {
            id: 3,
            title: 'Orange Box',
            subtitle: 'This box will later be convertible into assets such as NFT whitelists, NFTs, tokens, and points.',
            remainer: 100,
            total: 100,
            oranges: 1000,
            image: require('../../../assets/shop/orange_box.png'),
            successText: "You've received an Orange Box",
        },
    ])

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView}>
                {/* <TouchableOpacity
                    onPress={() => addOrange()}
                >
                    <Text style={{}}>orange</Text>
                </TouchableOpacity> */}
                {shopData.map((item, index) => (
                    <RewardItem 
                        key={item.id+'-shop'} 
                        item={item} 
                        index={index}
                    />
                ))}
                <View style={{height: 50}}/>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  rewardItem: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 10,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: Platform.OS == 'ios' ? 16 : 14,
    fontFamily: 'GmarketBold',
    flexWrap: 'wrap',
    marginBottom: Platform.OS == 'ios' ? 10 : 8,
  },
  subtitle: {
    fontSize: Platform.OS == 'ios' ? 13 : 11,
    fontFamily: 'GmarketMedium',
    color: '#959595',
    marginBottom: 2,
    lineHeight: 14
  },
  points: {
    fontSize: 12,
    fontFamily: 'GmarketBold'
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
    paddingHorizontal: 20
  },
  buttonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyButton: {
    width: 70,
    height: 32,
  },
});

export default ShopScreen;