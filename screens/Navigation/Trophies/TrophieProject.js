import React, { useContext, useMemo, useState } from 'react';
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
    const tabs = ['All', 'Completed', 'In progress', 'Not started'];

    const projectCourses = useMemo(() => {
        const statusPriority = { 'in-progress': 1, 'not-started': 2, 'completed': 3 };
        const levelPriority = { Beginner: 1, Intermediate: 2, Advanced: 3 };

        return courses
        .filter(course => course.category === 'project')
        .map(course => {
            const userCourse = userData?.courses?.find(c => c.id === course.id);
            const completedSections = userCourse?.sections?.filter(s => s.status === 'completed') ?? [];

            return {
            ...course,
            status: userCourse?.status || 'not-started',
            progress: completedSections.length,
            progressText:
                completedSections.length === course?.sections?.length
                ? 'Completed'
                : userCourse?.sections
                ? `${userCourse.sections.length} in progress`
                : null,
            };
        })
        .sort((a, b) => {
            const statusDiff = statusPriority[a.status] - statusPriority[b.status];
            if (statusDiff !== 0) return statusDiff;
            return (levelPriority[a.title] ?? 99) - (levelPriority[b.title] ?? 99);
        });
    }, [userData]);

    const filteredCourses = useMemo(() => {
        switch (activeTab) {
        case 'Completed':
            return projectCourses.filter(c => c.status === 'completed');
        case 'In progress':
            return projectCourses.filter(c => c.status === 'in-progress');
        case 'Not started':
            return projectCourses.filter(c => c.status === 'not-started');
        default:
            return projectCourses;
        }
    }, [activeTab, projectCourses]);


    const getStatusColor = status => {
        const colors = {
            completed: '#10B981',
            'in-progress': '#F59E0B',
            'not-started': '#6B7280',
        };
        return colors[status] || '#6B7280';
    };

    const getIconStyle = title => {
        if (title === 'Notcoin') {
            return { wrapper: { backgroundColor: '#000', padding: 0 }, size: 76 };
        }
        if (title === 'Vana' || title === '1inch') {
            return { wrapper: { backgroundColor: '#F1F4F9', padding: 18 }, size: 40 };
        }

        return { wrapper: { backgroundColor: '#F1F4F9', padding: 0 }, size: 76 };
    };
   
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
                    {filteredCourses.map((course) => {
                        const { wrapper, size } = getIconStyle(course.title);

                        const totalReward = course.sections.reduce((acc, section) => {
                            return acc + (section.pages?.length * 5 || 0);
                        }, 0);

                        return(
                            <TouchableOpacity 
                                key={course.id} 
                                style={styles.courseCard}
                                onPress={() => navigation.navigate('CourseSelector', { course })}
                            >
                                <View style={styles.cardHeader}>
                                    <View style={styles.courseInfo}>
                                        <View style={[
                                            {backgroundColor: course.title == 'Notcoin' ? '#000' : '#F1F4F9', padding: (course.title == 'Vana' || course.title == '1inch') ? 18 : 0, borderRadius: 50, marginRight: 10},
                                            wrapper
                                        ]}>
                                            <Image
                                                style={{ width: size, height: size }}
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
                                            <Text style={styles.rewardAmount}>{totalReward}</Text>
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
                        )
                    })}
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
    fontSize: Platform.OS == 'ios' ? 16 : 14,
    color: '#111827',
    marginRight: 8,
    fontFamily: "GmarketBold",
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