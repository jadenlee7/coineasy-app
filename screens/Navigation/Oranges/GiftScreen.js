import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { giftData } from '../../../data/courses';

import * as Haptics from 'expo-haptics';
import { GlobalContext } from '../../../contexts/GlobalContext';


const GiftScreen = () => {

    const { userData } = useContext(GlobalContext);

    const giftList = [...(userData?.gifts || []), ...giftData];

    const [selectedGift, setSelectedGift] = useState(null)

    const handleCopy = async () => {
        await Clipboard.setStringAsync(selectedGift.barCodeText);
        console.log("Texte copié !");
    };

    const RewardItem = ({ item, index }) => (
        <View style={[styles.rewardItem, {marginTop: index == 0 ? 10 : 0,}]}>
            <Image
                style={{width: 90, height: 90}}
                resizeMode='contain'
                source={item.status == 'Used' ? require('../../../assets/starbucks_coffee_gray.png') : require('../../../assets/starbucks_coffee.png') }
            /> 

            <View style={{flex: 1, flexDirection: 'column', justifyContent: 'space-between',marginLeft: 5}}>
                <View style={{flexShrink: 1}}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.subtitle}>{item.subtitle}</Text>
                    <Text style={styles.subtitle}>{item.date}</Text>
                </View>
                
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center', minWidth: 80,marginTop: 10,}}>
                    <Text style={{fontFamily: 'GmarketMedium', fontSize: 11, color: item.status == 'Used' ? '#959595' : '#FF6B17'}}>{item.status}</Text>
                    <TouchableOpacity 
                        style={[styles.button, { backgroundColor: item.status == 'Used' ? '#F1F4F9' : '#FF6B17' }]}
                        disabled={item.status == 'Used'}
                        onPress={() => setSelectedGift(item)}
                    >
                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap: 0}}>
                            <Text style={{color: item.status == 'Used' ? "#999999" : "#fff",fontSize: 10,fontFamily: 'GmarketMedium'}}>View Details</Text>
                            <Ionicons name="chevron-forward" size={16} color={item.status == 'Used' ? "#ACADAE" : "#fff"} style={{marginLeft: 2}} />
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
            
        </View>
    );

    return (
        <SafeAreaView style={{flex: 1, backgroundColor: 'white'}}>
            <ScrollView style={styles.scrollView}>
                {!selectedGift ? giftList.map((item, index) => (
                    <RewardItem key={item.id+'-gift'} item={item} index={index}/>
                )) : (
                    <View style={{backgroundColor: 'white',}}>

                        <TouchableOpacity onPress={() => {Haptics.selectionAsync();setSelectedGift(null)}} style={{marginBottom: 10,}}>
                            <Image
                                style={{width: 24,height: 24}}
                                resizeMode='contain'
                                source={require('../../../assets/back_button.png')}
                                defaultSource={require('../../../assets/back_button.png')}
                            />
                        </TouchableOpacity>

                        <View style={styles.rewardItem}>
                            <Image
                                style={{width: 90, height: 90}}
                                resizeMode='contain'
                                source={require('../../../assets/starbucks_coffee.png')}
                            /> 

                            <View style={{flex: 1, flexDirection: 'column', justifyContent: 'space-between',marginLeft: 5}}>
                                <View style={{flexShrink: 1}}>
                                    <Text style={styles.title}>{selectedGift.title}</Text>
                                    <Text style={styles.subtitle}>{selectedGift.subtitle}</Text>
                                    <Text style={styles.subtitle}>{selectedGift.date}</Text>
                                </View>                            
                            </View>
                        </View>
                        
                        <View style={{backgroundColor: 'white',justifyContent:'center',alignItems:'center',marginTop: 20,}}>
                            <Image
                                style={{width: '100%',}}
                                resizeMode='contain'
                                source={require('../../../assets/starbucks_barcode.png')}
                            />
                            <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',}}>
                                <Text style={{fontFamily: 'GmarketBold',fontSize: 10,}}>{selectedGift.barCodeText?.replace(/(.{4})/g, '$1 ')}</Text>
                                <TouchableOpacity
                                    onPress={handleCopy}
                                >
                                    <FontAwesome5 name="copy" size={14} color="#b8b8b8" style={{marginLeft: 10}}/>
                                </TouchableOpacity>
                            </View>
                        </View>

                    </View>
                )}
                <View style={{height: 50}}/>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
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
    fontSize: 14,
    fontFamily: 'GmarketBold',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#959595',
    marginVertical: 4,
    fontFamily: 'GmarketMedium'
  },
  points: {
    fontSize: 12,
    fontFamily: 'GmarketBold'
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
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

export default GiftScreen;