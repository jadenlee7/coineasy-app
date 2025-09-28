import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  Dimensions,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTailwind } from 'tailwind-rn';
import Carousel from 'react-native-reanimated-carousel';

import HeaderImage from '../../../components/HeaderImage';
import { GlobalContext } from '../../../contexts/GlobalContext';
import { MultiplePeopleIcon } from '../../../components/Icons';
import HeaderActions from '../../../components/HeaderActions';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function CourseSelectorScreen({ navigation, route }) {
    const { userData } = useContext(GlobalContext);
    const tailwind = useTailwind();

    const { course } = route.params
    const sections = course.sections

    const userCourse = Array.isArray(userData?.courses) ? userData.courses.find(c => c.id === course.id) : null;

    const sectionsWithProgress = sections.map(section => {
        const userSection = userCourse?.sections?.find(s => s.id === section.id);

        return {
            ...section,
            progress: userSection?.progress ?? 0,
            status: userSection?.status ?? 'not-started'
        };
    });

    const handleConfirm = () => {
        Haptics.selectionAsync();
        const selectedCourse = sectionsWithProgress[currentIndex];
        navigation.navigate('CourseDetail', { 
            parentCourse: course, 
            course: selectedCourse, 
            courseId: selectedCourse.id
        });
    };

    const handleCardPress = (item) => {
        Haptics.selectionAsync();
        navigation.navigate('CourseDetail', { 
            parentCourse: course,
            course: item,
            courseId: item.id
        });
    };

    const renderItem = ({ item }) => {
        return(
            <TouchableOpacity 
                onPress={() => handleCardPress(item)} 
                activeOpacity={0.8}
                style={{flex: 1}}
                disabled={item.status === 'completed'}
            >
                <View style={[styles.card]}>
                    <View style={styles.imageWrapper}>
                        <Image 
                            source={item.image} 
                            style={[styles.image, {opacity: item.status === 'completed' ? 0.6 : 1}]} 
                            resizeMode="cover"
                        />
                        <View style={[styles.overlay, {flexDirection:'row', alignItems:'center', justifyContent:'center',opacity: item.status === 'completed' ? 0.6 : 1}]}>
                            <MultiplePeopleIcon color={'white'}/>
                            <Text style={styles.overlayText}>{item.enrolled.toLocaleString()}</Text>
                        </View>
                    </View>

                    <View style={{flex: 1, justifyContent: "space-between",}}>
                        <View style={{flex: 1}}>
                            <Text style={{
                                opacity: item.status === 'completed' ? 0.5 : 1, 
                                fontFamily: "GmarketMedium",
                                fontSize: Platform.OS == 'ios' ? 20 : 18,
                                marginVertical: 4,
                            }}>
                                {item.title}
                            </Text>
                            <Text style={{
                                opacity: item.status === 'completed' ? 0.5 : 1, 
                                fontSize: Platform.OS == 'ios' ? 17 : 15,
                                lineHeight: Platform.OS == 'ios' ? 22 : 20, 
                                fontFamily: "GmarketMedium", 
                                color: '#555',
                                marginVertical: 10,
                            }}>
                                {item.description}
                            </Text>
                        </View>
                        
                        <View style={{}}>

                            {item.status != 'completed' ? (
                                <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-evenly',gap: 10}}>
                                    <View style={{flexDirection:'row', alignItems:'center',justifyContent:'center',}}>
                                        <Image
                                            style={{width: 20, height: 20, marginRight: 5}}
                                            resizeMode='contain'
                                            source={require('../../../assets/trophy/trophy_icon_orange.png')}
                                        /> 
                                        <Text style={styles.progressText}>{item.pages.length * 5}</Text>
                                    </View>

                                    <View style={[styles.progressBarBackground, {backgroundColor: item.progress > 0 ? '#eee' : ''}]}>
                                        <View style={[styles.progressBarFill, { width: `${(item.progress / item.pages.length) * 100}%` },]}/>
                                    </View>
                                </View>
                            ) : (
                                <>
                                    <Text style={{color:'#FF6B17',fontFamily:'GmarketMedium', opacity: 0.5}}>Completed!</Text>
                                    <View style={{flexDirection:'row', alignItems:'center',justifyContent:'flex-start',opacity: 0.5}}>
                                        <Image
                                            style={{width: 20, height: 20, marginRight: 5}}
                                            resizeMode='contain'
                                            source={require('../../../assets/trophy/trophy_icon_orange.png')}
                                        /> 
                                        <Text style={styles.progressText}>{item.pages.length * 5}</Text>
                                    </View>
                                </>
                            )}

                            
                        </View>
                    </View>

                </View>
            </TouchableOpacity>
        )
    }

    const PaginationDots = ({ length, activeIndex }) => {
        return (
            <View style={styles.pagination}>
                {Array.from({ length }).map((_, i) => (
                    <View
                    key={i}
                    style={[
                        styles.dot,
                        i === activeIndex ? styles.dotActive : styles.dotInactive,
                    ]}
                    />
                ))}
            </View>
        );
    };

    const getInitialIndex = (sections) => {
        // 1. Check if a course in in-progress status
        const inProgressIndex = sections.findIndex(s => s.progress > 0 && s.progress < s.pages.length);
        if (inProgressIndex !== -1) return inProgressIndex;

        // 2. get the indexes
        const completedIndices = sections
            .map((s, idx) => (s.progress === s.pages.length ? idx : -1))
            .filter(idx => idx !== -1);

        if (completedIndices.length > 0) {
            for (let i = 0; i < completedIndices.length - 1; i++) {
                if (completedIndices[i + 1] > completedIndices[i] + 1) {
                    return completedIndices[i] + 1;
                }
            }

            const last = completedIndices[completedIndices.length - 1];
            if (last + 1 < sections.length) return last + 1;

            return last;
        }

        // 4. Else -> first course
        return 0;
    };

    const initialIndex = getInitialIndex(sectionsWithProgress);

    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    return (
        <View style={tailwind('flex flex-1 bg-white')}>

            <HeaderImage />
            <HeaderActions />

            <Text style={[
                tailwind('text-slate-900 p-5'), 
                { 
                    fontSize: 16,
                    fontFamily: "GmarketBold",
                    lineHeight: 20,
                }]}
            >
                What Course do you want?
            </Text>

            <Carousel
                loop={false}
                width={screenWidth}
                height={screenHeight/1.6}
                autoPlay={false}
                data={sectionsWithProgress}
                scrollAnimationDuration={500}
                onSnapToItem={index => setCurrentIndex(index)}
                renderItem={renderItem}
                style={{ alignSelf: 'center',marginTop: -40,}}
                mode="parallax"
                defaultIndex={initialIndex}
            />

            <PaginationDots length={sectionsWithProgress.length} activeIndex={currentIndex} />

            <TouchableOpacity 
                style={{
                    backgroundColor: '#FF6E31', 
                    paddingVertical: 14, 
                    borderRadius: 50,
                    position: 'absolute',
                    bottom: 40, 
                    width: '90%',
                    alignSelf:'center',
                    opacity: sectionsWithProgress[currentIndex].status === 'completed' ? 0.6 : 1
                }} 
                onPress={handleConfirm}
                disabled={sectionsWithProgress[currentIndex].status == 'completed'}
            >
                <Text style={{color: 'white',fontWeight: 'bold',fontSize: 16,textAlign:'center'}}>Ok, Let’s do this.</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  heading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  card: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    height: '105%'
  },
  imageWrapper: {
    borderRadius: 12,
    marginBottom: 12,
  },
  image: {
    width: '100%',
    height: 230,
    borderRadius: 12
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#FF6A00',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 0
  },
  overlayText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressBarBackground: {
    height: 6,
    borderRadius: 3,
    width: '80%'
  },
  progressBarFill: {
    height: 6,
    backgroundColor: '#FF6A00',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#555',
  },
  pagination: {
  flexDirection: 'row',
  justifyContent: 'center',
  marginTop: 25,
  gap: 8,
},
dot: {
  width: 8,
  height: 8,
  borderRadius: 4,
},
dotInactive: {
  backgroundColor: '#ccc',
},
dotActive: {
  backgroundColor: '#FF6A00',
  width: 10,
  height: 10,
  borderRadius: 5,
},
});
