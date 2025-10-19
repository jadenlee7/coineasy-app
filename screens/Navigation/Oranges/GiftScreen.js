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
  Dimensions,
  Platform,
} from 'react-native';

import { GlobalContext } from '../../../contexts/GlobalContext';
import moment from 'moment';

const {width, height} = Dimensions.get('window')

const GiftScreen = ({ goToShop }) => {
    const { userData } = useContext(GlobalContext);

    const RewardItem = ({ item, index }) => (
        <View style={[styles.rewardItem, {marginTop: index == 0 ? 10 : 0,}]}>
            <View style={{flex: 1, flexDirection: 'column', justifyContent: 'space-between',}}>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start', gap: 10}}>
                    {item.image && (
                        <Image
                            style={{width: 90, height: 90}}
                            resizeMode='contain'
                            source={item.image}
                        /> 
                    )}
                    
                    <View style={{flexShrink: 1, marginTop: 5,}}>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.subtitle}>{item.subtitle}</Text>
                    </View>
                </View>

                
                <View style={{marginTop: 20,flexDirection:'row',justifyContent:'space-between',alignItems:'center',}}>
                    <Text style={{fontFamily: 'GmarketMedium',fontFamily: 'GmarketMedium', fontSize: Platform.OS == 'ios' ? 12 : 10, color: '#959595'}}>
                        {item.date}
                    </Text>

                    <Text style={{fontFamily: 'GmarketMedium',fontFamily: 'GmarketMedium', fontSize: Platform.OS == 'ios' ? 12 : 10, color: '#959595'}}>
                        {item.status}
                    </Text>
                </View>
            </View>
        </View>
    );

    const sortedGifts = userData?.gifts ? [...userData?.gifts].sort((a, b) => moment(b.date, "MM.DD.YYYY h:mm A") - moment(a.date, "MM.DD.YYYY h:mm A")) : null

    return (
        <SafeAreaView style={{flex: 1, backgroundColor: 'white'}}>
            {sortedGifts ? (
                <ScrollView style={styles.scrollView}>
                    {sortedGifts.map((item, index) => {
                        return(
                            <RewardItem 
                                key={item.id+'-gift'} 
                                item={item} 
                                index={index}
                            />
                        )
                    })}
                    <View style={{height: 50}}/>
                </ScrollView>
            ) : (
                <>
                    <View style={[styles.rewardItem, {marginTop: 10,}]}>
                        <View style={{flex: 1, flexDirection: 'column', justifyContent: 'space-between',}}>
                            <Text style={{alignSelf:'center', marginVertical: 40, fontSize: Platform.OS == 'ios' ? 15 : 13,fontFamily: 'GmarketMedium',color: '#959595',}}>
                                No gift claimed
                            </Text>

                        </View>
                    </View>
                    
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
                            marginTop: 20,
                        }}
                        onPress={goToShop}
                    >
                        <Text style={{textAlign: 'center', fontFamily: 'GmarketBold', fontSize: 12,}}>Go to Shop Box</Text>
                    </TouchableOpacity>
                </>
            )}
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
    fontSize: Platform.OS == 'ios' ? 16 : 14,
    fontFamily: 'GmarketBold',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: Platform.OS == 'ios' ? 13 : 11,
    fontFamily: 'GmarketMedium',
    color: '#959595',
    marginBottom: 2,
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