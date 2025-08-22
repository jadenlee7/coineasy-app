import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Image,
  Platform,
} from 'react-native';
import { MultiplePeopleIcon } from '../../../components/Icons';
import { useNavigation } from '@react-navigation/core';

import { courses } from '../../../data/courses';
import { GlobalContext } from '../../../contexts/GlobalContext';

const TrophieProject = () => {
    const navigation = useNavigation();
    const { userData } = useContext(GlobalContext);

    const [activeTab, setActiveTab] = useState('All');

    const projectCourses = courses
        .filter(course => course.category === 'project')
        .map(course => {
            let userCourse = null
            if(userData && Array.isArray(userData.courses)){
                userCourse = userData.courses.find(c => c.id === course.id);
            }

            const completedSections = userCourse?.sections?.filter(s => s.status === 'completed') ?? [];

            return {
                ...course,
                status: userCourse?.status || 'not-started',
                progress: completedSections.length,
                progressText: completedSections.length == course?.sections?.length ? 'Completed' : userCourse?.sections ? userCourse?.sections?.length+' in progress' : null
            };
        });  

    const tabs = ['All', 'Completed', 'In progress', 'Not started'];

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed':
                return '#10B981';
            case 'in-progress':
                return '#F59E0B';
            case 'not-started':
                return '#6B7280';
            default:
                return '#6B7280';
        }
    };

    const filteredCourses = projectCourses.filter(course => {
        if (activeTab === 'All') return true;
        if (activeTab === 'Completed') return course.status === 'completed';
        if (activeTab === 'In progress') return course.status === 'in-progress';
        if (activeTab === 'Not started') return course.status === 'not-started';
        return true;
    });

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Tabs */}
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabContainer}
                >
                    {tabs.map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            style={[
                                styles.tab,
                                activeTab === tab && styles.activeTab
                            ]}
                            onPress={() => setActiveTab(tab)}
                        >
                            <Text 
                                style={[styles.tabText, activeTab === tab && styles.activeTabText]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                            >
                                {tab}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Course Cards */}
                <View style={styles.courseContainer}>
                    {filteredCourses.map((course) => (
                        <TouchableOpacity 
                            key={course.id} 
                            style={styles.courseCard}
                            onPress={() => navigation.navigate('CourseSelector', { course })}
                        >
                            <View style={styles.cardHeader}>
                                <View style={styles.courseInfo}>
                                    <View style={{backgroundColor: course.title == 'Notcoin' ? '#000' : '#F1F4F9', padding: 18, borderRadius: 50, marginRight: 5}}>
                                        <Image
                                            style={{width: 40,height: 40}}
                                            resizeMode='contain'
                                            source={course.image_icon}
                                            defaultSource={course.image_icon}
                                        />                        
                                    </View>
                                <View style={styles.courseDetails}>
                                    <View style={styles.titleRow}>
                                        <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',}}>
                                            <Text style={styles.courseTitle}>{course.title}</Text>
                                            <Text style={styles.courseProgress}>{course.progress} / {course.sections.length}</Text>
                                        </View>
                                        <View style={{flexDirection:'row', alignItems:'flex-end', justifyContent:'flex-end',}}>
                                            <MultiplePeopleIcon color={'#959595'}/>
                                            <Text style={styles.participants}>{course.participants}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.courseDescription}>
                                        {course.description}
                                    </Text>
                                </View>
                                </View>
                            </View>

                            <View style={styles.cardFooter}>
                                <View style={styles.rewardContainer}>
                                    <Text style={styles.rewardLabel}>Total Reward</Text>
                                    <View style={styles.rewardValue}>
                                        <Image
                                            style={{width: 18,height: 18}}
                                            resizeMode='contain'
                                            source={require('../../../assets/trophy/trophy_icon_project.png')}
                                            defaultSource={require('../../../assets/trophy/trophy_icon_project.png')}
                                        />                        
                                        <Text style={styles.rewardAmount}>{course.reward}</Text>
                                    </View>
                                </View>
                                
                                {course.progressText && (
                                    <View style={styles.progressIndicator}>
                                        <View style={[styles.progressDot, { backgroundColor: getStatusColor(course.status) }]} />
                                        <Text style={[styles.progressText, { color: getStatusColor(course.status) }]}>
                                            {course.progressText}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  tab: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    marginRight: 4,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    flex: 1,
    minWidth: 40,
  },
  activeTab: {
    backgroundColor: '#FF6B17',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  courseContainer: {
    paddingHorizontal: 20,
  },
  courseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 10,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardHeader: {
    marginBottom: 16,
  },
  courseInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  courseIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 4,
  },
  courseDetails: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:'space-between',
    marginBottom: 8,
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  courseProgress: {
    fontSize: 14,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  participants: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 'auto',
  },
  courseDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    // borderTopWidth: 1,
    // borderTopColor: '#F3F4F6',
  },
  rewardContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 5
  },
  rewardLabel: {
    fontSize: Platform.OS == 'ios' ? 12 : 10,
    fontFamily: "GmarketMedium",
    marginTop: 1,
  },
  rewardValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  coinIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  rewardAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default TrophieProject;