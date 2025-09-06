//import liraries
import React, { Component, useContext, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, Dimensions, Platform } from 'react-native';
import HeaderImage from '../../../components/HeaderImage';
import * as Haptics from 'expo-haptics';
import useStatusBarHeight from '../../../hooks/useStatusBarHeight';
import { GlobalContext } from '../../../contexts/GlobalContext';
import Svg, { Circle } from 'react-native-svg';
import Modal from '../../../components/Modal';
import { AntDesign } from '@expo/vector-icons';

const {width, height} = Dimensions.get('window')

const TrophiePresentation = ({ navigation, route }) => {

    const { data } = route.params
    const { userData } = useContext(GlobalContext);
    const statusBarHeight = useStatusBarHeight();

    const [openAchievement, setOpenAchievement] = useState(null)

    // const achievements = [
    //     {
    //         id: 1,
    //         title: 'Starter',
    //         description: 'Start Coineasy',
    //         image: require('../../../assets/trophy/trophy_bitcoin.png'),
    //         progress: 7,
    //         total: 12
    //     },
    //     {
    //         id: 2,
    //         title: 'Professor',
    //         description: 'Complete professional education',
    //         image: require('../../../assets/trophy/trophy_education.png'),
    //         progress: 3,
    //         total: 3
    //     },
    //     {
    //         id: 3,
    //         title: 'Student',
    //         description: 'Complete Basic education',
    //         image: require('../../../assets/trophy/trophy_book_gray.png'),
    //         progress: 3,
    //         total: 4
    //     },
    //     {
    //         id: 4,
    //         title: 'Orange Collector',
    //         description: 'get 1000 oranges',
    //         image: require('../../../assets/trophy/trophy_orange_gray.png'),
    //         progress: 1,
    //         total: 4
    //     },
    //     {
    //         id: 5,
    //         title: 'Student',
    //         description: 'Complete Basic education',
    //         image: require('../../../assets/trophy/trophy_book_gray.png'),
    //         progress: 2,
    //         total: 4
    //     },
    //     {
    //         id: 6,
    //         title: 'Orange Collector',
    //         description: 'get 1000 oranges',
    //         image: require('../../../assets/trophy/trophy_orange_gray.png'),
    //         progress: 3,
    //         total: 5
    //     },
    // ];

    const mapping = {
        'First Stepper': 'Complete the Beginner course section.',
        'Level Climber': 'Complete the Intermediate course section.',
        'Web3 Scholar': 'Complete the Advanced course section.',
        'Course Finisher': 'Complete any single course in EASYEDU.',
        'Project Explorer': 'Complete 3 or more Web3 projects.',
        'Project Master': 'Complete 6 or more Web3 projects.',
        'Orange Spark': 'Earn a total of 100 Orange Points.',
        'Orange Collector': 'Earn a total of 500 Orange Points.',
        'Orange Tycoon': 'Earn a total of 2000 Orange Points.',
    };

    const AchievementItem = (trophy) => {
        const current = trophy.progress
        const total = trophy.totalSections
        const percent = (current / total) * 100;

        const isCompleted = percent === 100;

        return(
            <TouchableOpacity 
                style={[styles.achievementContainer, {borderColor: isCompleted ? '#FF9500' : '#d9d9d9',}]}
                onPress={() => {Haptics.selectionAsync();setOpenAchievement(trophy)}}
            >
                {renderTrophy(trophy)}

                <Text style={styles.description}>{mapping[trophy.name]}</Text>
                <Text style={styles.progress}>{trophy.progress}/{trophy.totalSections}</Text>
            </TouchableOpacity>
        )
    }

    const renderTrophy = (trophy) => {
        const current = trophy.progress
        const total = trophy.totalSections
        const percent = (current / total) * 100;

        const hasProgress = percent > 0;

        const radius = 30;
        const strokeWidth = 3;
        const circumference = 2 * Math.PI * radius;
        const strokeDasharray = circumference;
        const strokeDashoffset = circumference - (percent / 100) * circumference;

        return (
            <TouchableOpacity
                style={styles.trophyContainer}
                activeOpacity={0.7}
            >
                <View style={styles.iconWrapper}>
                    <View style={styles.iconContainer}>
                        <View style={styles.iconBackground} />
                        
                        {hasProgress && (
                            <View style={styles.svgContainer}>
                                <Svg width="64" height="64" style={styles.svgProgress}>
                                <Circle
                                    cx="32"
                                    cy="32"
                                    r={radius}
                                    stroke="#FF6B35"
                                    strokeWidth={strokeWidth}
                                    fill="transparent"
                                    strokeDasharray={strokeDasharray}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="round"
                                    transform="rotate(-90 32 32)"
                                />
                                </Svg>
                            </View>
                        )}
                        
                        {/* Icône au centre */}
                        <View style={styles.iconInner}>
                            <Image
                                style={{width: 40,height: 40}}
                                resizeMode='contain'
                                source={trophy.image_icon}
                                defaultSource={trophy.image_icon}
                            />  
                        </View>
                    </View>
                </View>

                <Text style={[styles.trophyName]}>
                    {trophy.title}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={{flex: 1, backgroundColor: 'white',}}>
            <HeaderImage />
            
            <TouchableOpacity style={{position: 'absolute',left: 20, top: statusBarHeight > 25 ? 55 : 60}} onPress={() => {Haptics.selectionAsync();navigation.goBack()}}>
                <Image
                    style={{width: 24,height: 24}}
                    resizeMode='contain'
                    source={require('../../../assets/back_button.png')}
                    defaultSource={require('../../../assets/back_button.png')}
                />
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => {Haptics.selectionAsync();navigation.navigate('OrangeNavigation')}}
                style={{
                    position: 'absolute',
                    top: statusBarHeight > 25 ? 50 : 60,
                    right: 10,
                    borderRadius: 30,
                    backgroundColor: '#FFF2E2',
                    flexDirection:'row',
                    gap: 6,
                    alignSelf:'flex-end',
                    marginRight: 5,
                    paddingVertical: 5,
                    paddingHorizontal:10,
                    alignItems:'center'
                }}
            >
                <Image
                    style={{width: 15, height: 15}}
                    resizeMode='contain'
                    source={require('../../../assets/trophy/trophy_icon_orange.png')}
                />
                <Text style={{fontWeight: 'bold',textAlign: 'center',color:'#FB5100', marginTop: Platform.OS == 'ios' ? 2 : 0,}}>
                    {userData?.numberOranges && userData?.numberOranges.toString().length <= 3 ? userData?.numberOranges
                        : userData?.numberOranges && userData?.numberOranges.toString().length == 4 ? userData?.numberOranges.toString().slice(0,1)+','+userData?.numberOranges.toString().slice(1,4)
                        : userData?.numberOranges && userData?.numberOranges.toString().length == 5 ? userData?.numberOranges.toString().slice(0,2)+','+userData?.numberOranges.toString().slice(2,5)
                        : userData?.numberOranges && userData?.numberOranges.toString().length == 6 ? userData?.numberOranges.toString().slice(0,3)+','+userData?.numberOranges.toString().slice(3,6)
                        : userData?.numberOranges && userData?.numberOranges.toString().length == 7 ? userData?.numberOranges.toString().slice(0,1)+','+userData?.numberOranges.toString().slice(1,4)+','+userData?.numberOranges.toString().slice(4,7)
                        : userData?.numberOranges && userData?.numberOranges.toString().length == 8 ? userData?.numberOranges.toString().slice(0,2)+','+userData?.numberOranges.toString().slice(2,5)+','+userData?.numberOranges.toString().slice(5,8)
                        : userData?.numberOranges && userData?.numberOranges.toString().length == 9 ? userData?.numberOranges.toString().slice(0,3)+','+userData?.numberOranges.toString().slice(3,6)+','+userData?.numberOranges.toString().slice(6,9)
                        : 0
                    }
                </Text>
            </TouchableOpacity>

            <View style={styles.container}>
                <View style={styles.countContainer}>
                    <Text style={[styles.title, {fontFamily: "GmarketBold",}]}>Trophies</Text>
                    <Text style={{marginLeft: -5}}>
                        <Text style={{color: '#FF6B17'}}>{data.filter(t => t.progress === t.totalSections).length}</Text>
                        <Text style={{color: 'gray'}}>/{data.length}</Text>
                    </Text>
                </View>

                <FlatList
                    data={data}
                    renderItem={({ item }) => <AchievementItem {...item} />}
                    keyExtractor={item => item.name}
                    numColumns={2}
                    style={{paddingHorizontal: 5}}
                    ListFooterComponent={() => <View style={{height: 100}} />}
                />
            </View>

            {openAchievement && (
                <Modal
                    hide={() => {Haptics.selectionAsync();setOpenAchievement(null)}} 
                    type='trophy' 
                >
                    <TouchableOpacity
                        style={{position: 'absolute',top: 10, right: 10,zIndex: 2}}
                        onPress={() => {Haptics.selectionAsync();setOpenAchievement(null)}}
                    >
                        <AntDesign name="closecircle" size={24} color="black" />
                    </TouchableOpacity>

                    <View style={{flexDirection: 'column', alignItems: 'center', justifyContent:'space-between',paddingBottom: 30, paddingTop: 30, height:'100%'}}>
                        <Text style={{fontFamily: 'GmarketBold',fontSize: Platform.OS == 'ios' ? 17 : 14}}>
                            {openAchievement.progress == openAchievement.totalSections ? 'You won the trophy!' : 'Trophy pending'}
                        </Text>

                        {renderTrophy(openAchievement)}

                        <Text style={{fontSize: 11, color: '#959595',fontFamily: 'GmarketMedium'}}>{mapping[openAchievement.name]}</Text>
                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',}}>
                            <Text style={{fontSize: 11, color: '#FF6B17',fontFamily: 'GmarketMedium'}}>{openAchievement.progress}</Text>
                            <Text style={{fontSize: 11, color: '#959595',fontFamily: 'GmarketMedium'}}>/{openAchievement.totalSections}</Text>
                        </View>
                        
                        <TouchableOpacity
                            style={{
                                backgroundColor: '#FF6B17',
                                alignSelf:'center',
                                width: width*0.7,
                                paddingVertical: 17,
                                justifyContent:'center',
                                alignItems:'center',
                                borderRadius: 30
                            }}
                            onPress={() => {Haptics.selectionAsync();setOpenAchievement(null)}}
                        >
                            <Text style={{textAlign: 'center', color:'white', fontFamily: 'GmarketBold', fontSize: 12,}}>GOOD</Text>
                        </TouchableOpacity>
                    </View>
                </Modal>
            )}

        </View>
    );
};

const styles = StyleSheet.create({
    container: {
    flex: 1,
    // padding: 16,
    backgroundColor: '#fff',
  },
  achievementContainer: {
    flex: 1,
    margin: 8,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    height: 210,
  },
  image: {
    width: 50,
    height: 50,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 10,
    textAlign: 'center',
    color:'gray',
    fontFamily: 'GmarketMedium',
    lineHeight: 13
  },
  progress: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    position: 'absolute',
    bottom: 10,
    textAlign:'center'
  },
countContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    paddingBottom: 0,
    paddingLeft: 10
  },




  trophyContainer: {
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    minWidth: 80,
  },
  iconWrapper: {
    marginBottom: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 32,
    backgroundColor: '#F1F4F9',
  },
  progressCircle: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 32,
    borderWidth: 3,
  },
  iconInner: {
    width: 50,
    height: 50,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  trophyName: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    flexWrap: 'wrap',
    maxWidth: 80,
    fontFamily: 'GmarketMedium'

  },
  svgContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  svgProgress: {
    position: 'absolute',
  },
});

export default TrophiePresentation;
