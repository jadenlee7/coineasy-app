import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Alert,
} from 'react-native';
import { shopData } from '../../../data/courses';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import * as Haptics from 'expo-haptics';
import { GlobalContext } from '../../../contexts/GlobalContext';
import moment from 'moment';

const {width, height} = Dimensions.get('window')

const ShopScreen = ({ goToGift }) => {
    const { 
        orbis,
        user,
        userData,
        setUserData,
    } = useContext(GlobalContext);

    const [isSuccess, setIsSuccess] = useState(false)
    const [selectedShopItem, setSelectedShopItem] = useState(null)

    const modalRef = useRef(null); 
    const snapPoints = useMemo(() => ['80%','80%'], []);
    const handleModalPress = useCallback(() => modalRef.current?.present(), []);

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

            let barCodeText = '';
            for (let i = 0; i < 16; i++) {
                barCodeText += Math.floor(Math.random() * 10); // chiffre entre 0 et 9
            }

            if(item.buttonText == 'Join'){
                const random = Math.random();
                setIsSuccess(random < 0.02)
                if(random < 0.02){
                    const giftItem = {
                        id: item.id,
                        title: item.title,
                        subtitle: item.subtitle,
                        date: moment().format("YYYY-MM-DD HH:mm"),
                        barCodeText: barCodeText,
                        status: 'Available'
                    }
                    if(tempData.gifts){
                        tempData.gifts.push(giftItem)
                    }else{
                        tempData.gifts = [giftItem]
                    }
                }
            }else{
                setIsSuccess(true)

                const giftItem = {
                    id: Math.random(),
                    title: item.title,
                    subtitle: item.subtitle,
                    date: moment().format("YYYY-MM-DD HH:mm"),
                    barCodeText: barCodeText,
                    status: 'Available'
                }
                if(tempData.gifts){
                    tempData.gifts.push(giftItem)
                }else{
                    tempData.gifts = [giftItem]
                }
            }

            setUserData({...tempData})
            var tempProfile = user.profile
            tempProfile.data = tempData
            await orbis.updateProfile(tempProfile);
    
            handleModalPress()
        }

    }

    const RewardItem = ({ item }) => (
        <View style={styles.rewardItem}>
            <Image
                style={{width: 90, height: 90}}
                resizeMode='contain'
                source={item.image}
            /> 

            <View style={{flex: 1, flexDirection: 'column', justifyContent: 'space-between',marginLeft: 10}}>
                <View style={{flexShrink: 1}}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.subtitle}>{item.subtitle}</Text>

                    <View style={{flexDirection:'row',justifyContent:'flex-start',alignItems:'center',fontFamily: 'GmarketMedium', marginTop: 5}}>
                        <Text style={{fontSize: 11,fontFamily: 'GmarketMedium',}}>{item.remainer}</Text>
                        <Text style={{fontSize: 11, color: '#959595',fontFamily: 'GmarketMedium'}}>/{item.total} Remain</Text>
                    </View>
                </View>
                
                <View style={{minWidth: 80,alignItems: 'flex-end',marginTop: 10,}}>
                    <TouchableOpacity 
                        style={[styles.button, { backgroundColor: item.buttonText == 'Closed' ? '#F1F4F9' : '#FF6B17' }]}
                        onPress={() => onClaimProduct(item)}
                    >
                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 7}}>
                            <Text style={{color: item.buttonText == 'Closed' ? '#959595' : 'white',fontSize: 10,fontFamily: 'GmarketMedium'}}>{item.buttonText}</Text>
                            <View style={{width: 20, height: 20, borderRadius: 20,backgroundColor: '#FFF2E2', justifyContent:'center',alignItems:'center',}}>
                                <Image
                                    style={{width: 15, height: 15}}
                                    resizeMode='contain'
                                    source={require('../../../assets/trophie_icon_orange.png')}
                                />                                 
                            </View>
                            <Text style={{color: item.buttonText == 'Closed' ? '#959595' : 'white',fontSize: 11,fontFamily: 'GmarketBold'}}>{item.oranges}</Text>
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

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView}>
                {/* <TouchableOpacity
                    onPress={() => addOrange()}
                >
                    <Text style={{}}>orange</Text>
                </TouchableOpacity> */}
                {shopData.map((item) => (
                    <RewardItem key={item.id+'-shop'} item={item} />
                ))}
                <View style={{height: 50}}/>
            </ScrollView>

            {selectedShopItem && (
                <BottomSheetModalProvider>
                    <BottomSheetModal
                        ref={modalRef}
                        index={1}
                        snapPoints={snapPoints}
                        handleIndicatorStyle={{backgroundColor: 'black',}}
                        handleStyle={{height: 30,justifyContent: 'center',}}
                        backdropComponent={(backdropProps) => <BottomSheetBackdrop {...backdropProps} enableTouchThrough={true} />}
                        onDismiss={() => {setIsSuccess(false)}}
                    >
                        <View style={{justifyContent: 'space-between',}}>
                            <View style={{}}>
                                <Text style={{textAlign: 'center',fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 20 : 16}}>
                                    {isSuccess ? 'Congratulations' : 'So Close!'}
                                </Text>
                                <Text style={{
                                    textAlign: 'center',
                                    fontFamily: 'GmarketMedium',
                                    fontSize: Platform.OS == 'ios' ? 14 : 11,
                                    marginTop: Platform.OS == 'ios' ? 10 : 10,
                                    color: isSuccess ? '#FF6B17' : 'black'
                                }}>
                                    {isSuccess ? selectedShopItem.successText : selectedShopItem.loseText}
                                </Text>

                                <Image
                                    style={{width: 140, height: 140, alignSelf:'center', margin: 40, marginTop: 15,}}
                                    resizeMode='contain'
                                    source={selectedShopItem.image}
                                /> 
                            </View>

                            <View style={{}}>
                                {isSuccess && (
                                    <TouchableOpacity
                                        style={{
                                            backgroundColor: 'white',
                                            borderWidth: 1,
                                            borderColor: 'black',
                                            alignSelf:'center',
                                            width: width*0.9,
                                            paddingVertical: 17,
                                            justifyContent:'center',
                                            alignItems:'center',
                                            borderRadius: 30,
                                            marginBottom: 20
                                        }}
                                        onPress={() => {goToGift();setIsSuccess(false);modalRef.current?.close();}}
                                    >
                                        <Text style={{textAlign: 'center', fontFamily: 'GmarketBold', fontSize: 12,}}>Go to Gift Box</Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={{
                                        backgroundColor: '#FF6B17',
                                        alignSelf:'center',
                                        width: width*0.9,
                                        paddingVertical: 17,
                                        justifyContent:'center',
                                        alignItems:'center',
                                        borderRadius: 30
                                    }}
                                    onPress={() => {setIsSuccess(false);modalRef.current?.close();}}
                                >
                                    <Text style={{textAlign: 'center', color:'white', fontFamily: 'GmarketBold', fontSize: 12,}}>Ok</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                    </BottomSheetModal>
                </BottomSheetModalProvider>
            )}

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  rewardItem: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
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
    fontSize: 14,
    fontFamily: 'GmarketBold',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#959595',
    marginBottom: 2,
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