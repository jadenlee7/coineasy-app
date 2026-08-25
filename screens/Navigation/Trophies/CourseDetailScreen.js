import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  ScrollView,
  Alert,
  Platform,
  Animated
} from 'react-native';
import HeaderImage from '../../../components/HeaderImage';
import HeaderActions from '../../../components/HeaderActions';
import { GlobalContext } from '../../../contexts/GlobalContext';
import {
    useDeviceAccountData,
    useDeviceAccountOperationLease,
} from '../../../contexts/DeviceAccountDataContext';
import { QuizCheckIcon, QuizErrorIcon } from '../../../components/Icons';

import { useTailwind } from 'tailwind-rn';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Header from '../../../components/Header';
import useStatusBarHeight from '../../../hooks/useStatusBarHeight';
import { api, ApiError } from '../../../utils/api';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ProgressBar = ({ progress }) => {
    const widthInterpolated = progress.interpolate({
        inputRange: [0, 100],
        outputRange: ["0%", "100%"],
    });

    return (
        <View style={styles.progressBarBackground}>
            <Animated.View style={[styles.progressBarFill, { width: widthInterpolated }]} />
        </View>
    );
};

const Page = ({ page, parentCourse, screenWidth, screenHeight, styles }) => (
    <ScrollView
        style={{ width: screenWidth, height: screenHeight }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
    >
        <Text style={[styles.title, { fontSize: Platform.OS == 'ios' ? 18 : 16, fontFamily: "GmarketBold", lineHeight: 20 }]}>
            {page.title}
        </Text>
        
        {page.image && (
            <View style={{}}>
                <Image
                source={page.image}
                style={styles.image_quiz}
                resizeMode='cover'
                />
            </View>
        )}

        <View style={styles.content}>
            <Text style={styles.description}>
                {parentCourse.category === "project" ?
                page.description
                    .split(".")
                    .filter(sentence => sentence.trim() !== "")
                    .map(sentence => sentence.trim() + ".")
                    .join("\n\n")
                : page.description}
            </Text>
        </View>

        <View style={{ height: 100 }} />
    </ScrollView>
);

const Quiz = ({
    question,
    selectedOption,
    wrongAnswer,
    rightAnswer,
    setSelectedOption,
    setWrongAnswer,
    setRightAnswer,
    styles,
    screenWidth,
    screenHeight
}) => (
    <ScrollView
        style={{ width: screenWidth, height: screenHeight }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
    >
        <Text style={[styles.title, { fontSize: Platform.OS == 'ios' ? 18 : 16, fontFamily: "GmarketBold", lineHeight: 20, }]}>
            {question.question}
        </Text>

        <View style={styles.container_choice}>
            {question.options.map((option) => (
                <TouchableOpacity
                    key={option.id}
                    style={[
                        styles.optionButton_choice,
                        selectedOption === option.id && styles.selectedOption_choice,
                        selectedOption === option.id && wrongAnswer && styles.wrongOption_choice,
                        selectedOption === option.id && rightAnswer && styles.rightOption_choice,
                        { fontFamily: "GmarketBold" }
                    ]}
                    onPress={() => { Haptics.selectionAsync(); setWrongAnswer(null); setRightAnswer(null); setSelectedOption(option.id); }}
                    activeOpacity={0.7}
                    disabled={rightAnswer}
                >
                    <Text
                        style={[
                            styles.optionText_choice,
                            selectedOption === option.id && styles.selectedText_choice
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={selectedOption === option.id && rightAnswer ? 0.5 : 0.7}
                    >
                        {option.text}
                    </Text>
                    {selectedOption === option.id && !wrongAnswer && !rightAnswer && <QuizCheckIcon />}
                    {selectedOption === option.id && wrongAnswer && <QuizErrorIcon />}
                    {selectedOption === option.id && rightAnswer && <Text style={{ color: '#32c913' }}>Correct!</Text>}
                </TouchableOpacity>
            ))}
        </View>

        <View style={{ height: 100 }} />
    </ScrollView>
);

const NavigationButtons = ({
    quizTime,
    rightAnswer,
    selectedOption,
    userProgress,
    handleBack,
    handleNext,
    handleSubmitOption,
    setQuizEnded,
    styles,
    course,
    currentPage
}) => {    
    if (quizTime && rightAnswer) {
        return (
            <TouchableOpacity
                style={[styles.nextButton, { width: screenWidth * 0.8, opacity: userProgress?.status == 'completed' ? 0.5 : 1 }]}
                onPress={setQuizEnded}
                disabled={userProgress?.status == 'completed'}
            >
                <Text style={styles.nextButtonText}>{userProgress?.status == 'completed' ? 'Already done' : 'Continue'}</Text>
                {course.progress != course.pages.length && <Ionicons name="chevron-forward" size={16} color="#fff" style={styles.nextIcon} />}
            </TouchableOpacity>
        );
    }

    return (
        <>
            <TouchableOpacity
                style={[styles.backButton, { opacity: currentPage === 1 ? 0.5 : 1}]}
                onPress={handleBack}
                disabled={currentPage === 1}
            >
                <Ionicons name="chevron-back" size={16} color="#555555" style={styles.nextIcon} />
                <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.nextButton, { opacity: quizTime && (!selectedOption && selectedOption != 0) ? 0.5 : 1 }]}
                onPress={quizTime ? handleSubmitOption : handleNext}
                disabled={quizTime && (!selectedOption && selectedOption != 0)}
            >
                <Text style={styles.nextButtonText}>{quizTime ? 'Submit' : 'Next'}</Text>
                <Ionicons name="chevron-forward" size={16} color="#fff" style={styles.nextIcon} />
            </TouchableOpacity>
        </>
    );
};

const CourseDetailScreen = ({ navigation, route }) => {

    const { userData, setUserData } = useContext(GlobalContext);
    const { ownerUserId, saveCourseProgress } = useDeviceAccountData();
    const {
        lease: courseLease,
        isCurrentLease: isCurrentCourseLease,
    } = useDeviceAccountOperationLease();

    const {parentCourse, course, courseId} = route.params
    
    const userProgress = useMemo(() =>
        userData?.courses?.map(course => course.sections?.find(section => section.id === courseId)).find(section => section !== undefined),
        [userData?.courses, courseId]
    );

    const [currentPage, setCurrentPage] = useState(course.progress == course.pages.length ? course.pages.length-1 : course.progress);
    const [courseProgress, setCourseProgress] = useState(course.progress == course.pages.length ? course.pages.length : course.progress == 0 ? 1 : course.progress)
    const [quizTime, setQuizTime] = useState(false)
    const [selectedOption, setSelectedOption] = useState(null);
    const [wrongAnswer, setWrongAnswer] = useState(null)
    const [rightAnswer, setRightAnswer] = useState(null)
    const [quizEnded, setQuizEnded] = useState(false)
    
    const progressAnim = useRef(new Animated.Value(33.33333333)).current;    

    useEffect(() => {
        const progress = (courseProgress / course.pages.length) * 100;
        Animated.timing(progressAnim, {
            toValue: progress,
            duration: 400,
            useNativeDriver: false,
        }).start();
    }, [courseProgress]);

    const persistCourseProgress = useCallback(async (tempData) => {
        try {
            if (!ownerUserId || tempData.courseProgressOwner !== ownerUserId) return false;
            return await saveCourseProgress(tempData.courses || []);
        } catch (error) {
            console.warn('[courses] unable to save local progress', error);
            return false;
        }
    }, [ownerUserId, saveCourseProgress]);

    const updateUserProgress = useCallback((tempData, newProgress) => {
        const userCourse = Array.isArray(tempData.courses) ? tempData.courses.find(c => c.id === parentCourse.id) : null;
        if (!userCourse) {
            const newCourse = {
                id: parentCourse.id,
                status: 'in-progress',
                sections: [{ id: course.id, progress: newProgress, status: 'in-progress' }],
            };
            if (Array.isArray(tempData.courses)) tempData.courses.push(newCourse);
            else tempData.courses = [newCourse];
        } else {
            const userSection = userCourse.sections?.find(s => s.id === course.id);
            if (userSection) {
                userSection.progress = newProgress;
            } else {
                if (!Array.isArray(userCourse.sections)) userCourse.sections = [];
                userCourse.sections.push({ id: course.id, progress: newProgress, status: 'in-progress' });
            }
        }
    }, [parentCourse.id, course.id]);

    const updateOrangesAndProgress = useCallback((tempData, serverBalance) => {
        updateUserProgress(tempData, course.pages.length);
        if (Number.isFinite(serverBalance)) tempData.numberOranges = serverBalance;

        const userCourse = tempData.courses.find(c => c.id === parentCourse.id);
        const userSection = userCourse.sections.find(s => s.id === course.id);
        if (userSection) {
            userSection.status = 'completed';
            userSection.progress = course.pages.length;
        }

        const allSectionsCompleted = parentCourse.sections.every(sec =>
            userCourse.sections?.some(us => us.id === sec.id && us.status === 'completed')
        );
        if (allSectionsCompleted) userCourse.status = 'completed';
    }, [course.id, course.pages.length, parentCourse.id, parentCourse.sections, updateUserProgress]);

    const handleNext = useCallback(async () => {
        const expectedLease = courseLease;
        if (!isCurrentCourseLease(expectedLease)) return;
        Haptics.selectionAsync();
        const tempData = { ...(userData || {}) };
        if (courseProgress < course.pages.length) {
            const newProgress = courseProgress + 1;
            setCurrentPage(newProgress);
            setCourseProgress(newProgress);
            updateUserProgress(tempData, newProgress);
        } else {
            setQuizTime(true);
        }

        if (!await persistCourseProgress(tempData)) return;
        if (!isCurrentCourseLease(expectedLease)) return;
        setUserData(tempData);
    }, [courseLease, courseProgress, course.pages.length, isCurrentCourseLease, persistCourseProgress, updateUserProgress, userData]);

    const handleBack = useCallback(() => {
        Haptics.selectionAsync();
        if (quizTime) {
            setQuizTime(false);
        } else if (courseProgress > 0) {
            setCurrentPage(currentPage - 1);
            setCourseProgress(courseProgress - 1);
        }
    }, [quizTime, courseProgress, currentPage]);

    const handleSubmitOption = useCallback(() => {
        Haptics.selectionAsync();

        const selectedAnswer = course.question.options[selectedOption];
        if (selectedAnswer.isCorrect) {
            setWrongAnswer(null);
            setRightAnswer(true);
        } else {
            setWrongAnswer(true);
            setRightAnswer(null);
        }
    }, [selectedOption, course.question.options]);

    const onValidateQuiz = useCallback(async () => {
        const expectedLease = courseLease;
        if (!isCurrentCourseLease(expectedLease)) return;
        Haptics.selectionAsync();
        const tempData = { ...(userData || {}) };
        let claimResult = null;
        try {
            try {
                claimResult = await api.completeQuest(`course-${course.id}`, {
                    answer: String(selectedOption),
                }, {
                    expectedAuthUserId: ownerUserId,
                });
            } catch (error) {
                if (!isCurrentCourseLease(expectedLease)) return;
                if (!(error instanceof ApiError) || error.status !== 404) throw error;
            }
            if (!isCurrentCourseLease(expectedLease)) return;
            if (!claimResult) {
                claimResult = await api.orangeClaimCourseQuiz({
                    courseId: parentCourse.id,
                    sectionId: course.id,
                    expectedAuthUserId: ownerUserId,
                });
            }
            if (!isCurrentCourseLease(expectedLease)) return;
            if (!claimResult) {
                Alert.alert(
                    'Progress saved on this device',
                    'Connect EXPO_PUBLIC_BACKEND_URL to receive the 60 Orange quiz reward.',
                );
            }
        } catch (error) {
            if (!isCurrentCourseLease(expectedLease)) return;
            Alert.alert(
                'Progress saved on this device',
                'The learning points could not be recorded. You can retry after the backend is available.',
            );
        }
        if (!isCurrentCourseLease(expectedLease)) return;
        updateOrangesAndProgress(tempData, claimResult?.reward?.balance ?? claimResult?.balance);
        if (!await persistCourseProgress(tempData)) return;
        if (!isCurrentCourseLease(expectedLease)) return;
        setUserData(tempData);
        navigation.navigate('CourseSelector', { course: parentCourse });
    }, [course.id, courseLease, isCurrentCourseLease, navigation, ownerUserId, parentCourse, persistCourseProgress, selectedOption, updateOrangesAndProgress, userData]);

    const statusBarHeight = useStatusBarHeight()

    return (
        <View style={{flex: 1, backgroundColor: 'white',}}>
            
            <Header />
            <HeaderActions 
                actions={() => {setCurrentPage(1);setCourseProgress(1)}}
            />

            {quizEnded ? (
                <CompletedView course={course} pages={course.pages} onValidateQuiz={onValidateQuiz} />
            ) : (
                <>
                    <View style={{width:'90%', marginTop: statusBarHeight > 25 ? 80 + statusBarHeight : 95 + statusBarHeight ,flexDirection:'row', alignItems:'center',alignSelf:'center', gap: 10}}>
                        <ProgressBar progress={progressAnim} />

                        <Text style={{textAlign:'center'}}>
                            <Text style={{ fontWeight: 'bold' }}>{courseProgress}</Text>
                            <Text style={{ color: 'grey' }}>/</Text>
                            <Text style={{ color: 'grey' }}>{course.pages.length}</Text>
                        </Text>
                    </View>

                    {quizTime ? (
                        <Quiz
                            question={course.question}
                            selectedOption={selectedOption}
                            wrongAnswer={wrongAnswer}
                            rightAnswer={rightAnswer}
                            setSelectedOption={setSelectedOption}
                            setWrongAnswer={setWrongAnswer}
                            setRightAnswer={setRightAnswer}
                            styles={styles}
                            screenWidth={screenWidth}
                            screenHeight={screenHeight}
                        />
                    ) : (
                        <View style={{ flex: 1 }}>
                            {course.pages.map((page, index) => (
                                <View key={index} style={{ display: index === courseProgress - 1 ? 'flex' : 'none', flex: 1 }}>
                                    <Page 
                                        page={page} 
                                        parentCourse={parentCourse} 
                                        screenWidth={screenWidth} 
                                        screenHeight={screenHeight} 
                                        styles={styles} 
                                    />
                                </View>
                            ))}
                        </View>
                    )}

                    <View style={styles.navigationContainer}>
                        <NavigationButtons
                            quizTime={quizTime}
                            rightAnswer={rightAnswer}
                            selectedOption={selectedOption}
                            userProgress={userProgress}
                            handleBack={handleBack}
                            handleNext={handleNext}
                            handleSubmitOption={handleSubmitOption}
                            setQuizEnded={() => setQuizEnded(true)}
                            styles={styles}
                            course={course}
                            currentPage={currentPage}
                        />
                    </View>
                </>
            )}
        </View>
    );
};

const CompletedView = ({ course, pages, onValidateQuiz }) => {
    const statusBarHeight = useStatusBarHeight()

    return(
        <>
            <View style={{
                marginTop: statusBarHeight > 25 ? 80 + statusBarHeight : 95 + statusBarHeight,
                marginVertical: 20,
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: '#E3E8EC',
                width: screenWidth * 0.8,
                alignSelf: 'center',
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                <Image
                    style={{ width: screenWidth * 0.68, height: 205 }}
                    resizeMode='contain'
                    source={course.image}
                />

                <Text style={{ fontSize: 14, fontFamily: "GmarketMedium", marginTop: 20, width: screenWidth * 0.68 }}>{course.title}</Text>
            </View>

            <Text style={{ fontSize: 20, fontFamily: "GmarketMedium", marginVertical: 10, textAlign: 'center' }}>Completed</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 3, marginTop: 10 }}>
                <Image
                    style={{ width: 35, height: 35 }}
                    resizeMode='contain'
                    source={require('../../../assets/trophy/trophy_icon_orange.png')}
                />
                <Text style={{ color: '#FB5100', fontFamily: 'GmarketBold', fontSize: 20 }}>+{course.points || 60}</Text>
            </View>

            <View style={{ position: 'absolute', bottom: 40, width: screenWidth }}>
                <TouchableOpacity
                    style={[styles.nextButton, { width: '80%', alignSelf: 'center' }]}
                    onPress={onValidateQuiz}
                >
                    <Text style={styles.nextButtonText}>Good!</Text>
                    <Ionicons name="chevron-forward" size={16} color="#fff" style={styles.nextIcon} />
                </TouchableOpacity>
            </View>
        </>
    )
}

const styles = StyleSheet.create({
  progressBarBackground: {
    flex: 1,
    height: 12,
    backgroundColor: '#FFF2E2',
    borderRadius: 10,
  },
  progressBarFill: {
    height: 12,
    backgroundColor: '#FF6B17',
    borderRadius: 10,
  },
  content: {
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 15,
    paddingHorizontal: 20,
  },
  description: {
    fontSize: Platform.OS == 'ios' ? 15 : 13,
    lineHeight: 22,
    color: '#666',
    fontFamily: "GmarketMedium",
  },
  highlight: {
    color: '#ff6b35',
    fontWeight: '500',
  },
  illustrationContainer: {
    alignItems: 'center',
    marginVertical: 40,
  },
  illustration: {
    width: 150,
    height: 150,
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  bottomDescription: {
    fontSize: 16,
    lineHeight: 24,
    color: '#666',
    textAlign: 'left',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 30,
  },
  backButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    height: 56,
    width: '45%',
    borderRadius: 25,
    backgroundColor: '#FFF2E2',
    marginTop: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#555',
    fontWeight: '500',
    marginTop: -2,
  },
  nextButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 56,
    width: '45%',
    borderRadius: 25,
    backgroundColor: '#ff6b35',
    shadowColor: '#ff6b35',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginTop: 10,
  },
  nextButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginTop: -2,
  },
  nextIcon: {
    marginLeft: 2,
  },





  container_quiz: {
    flex: 1,
    marginTop: -30,
  },
  article_quiz: {
    padding: 20,
  },
  contentRow_quiz: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  leftColumn_quiz: {
    marginRight: 15,
  },
  rightColumn_quiz: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  image_quiz: {
    width: '90%',
    height: 180,
    alignSelf:'center',
    borderRadius: 10,
    marginTop: 0,
    marginBottom: 20,
  },
  text_quiz: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666666',
    textAlign: 'justify',
  },
  textFull_quiz: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666666',
    textAlign: 'justify',
  },
  highlightText_quiz: {
    color: '#ff6b35',
    fontWeight: '500',
  },




container_choice: {
    flex: 1,
    padding: 20,
    marginTop: -20,
  },
  optionButton_choice: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e1e5e9',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedOption_choice: {
    borderColor: '#ff6b17',
    backgroundColor: '#fff',
  },
  wrongOption_choice: {
    borderColor: '#ff2d32',
    backgroundColor: '#fff',
  },
  rightOption_choice: {
    borderColor: '#32c913',
    borderWidth: 1.5,
    backgroundColor: '#fff',
  },
  optionText_choice: {
    fontSize: 13,
    color: '#333333',
    fontWeight: '400',
    flex: 1,
    fontFamily: "GmarketMedium",
  },
  selectedText_choice: {
    color: '#333333',
  },
  checkmark_choice: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff6b35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText_choice: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  submitButton_choice: {
    backgroundColor: '#ff6b35',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 20,
    alignItems: 'center',
  },
  submitButtonText_choice: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

});

export default CourseDetailScreen;
