import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, FlatList, Alert, Animated, Modal, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Appbar, Button, Divider, IconButton, FAB, Icon } from 'react-native-paper';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useAuth } from '../store/AuthContext';
import supabase from '../services/supabase';
import OptimizedImage from '../components/OptimizedImage';
import MyPlanCalendar from '../components/myplanCalendar';
import ExerciseDetailsModal from '../components/ExerciseDetailsModal';
import PlanOverviewModal from '../components/PlanOverviewModal';
import { format, addDays, isSameDay, startOfWeek, getDay, addWeeks, parseISO } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import workoutPlanService from '../services/workoutPlanService';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps_range: string;
  image_url?: string;
  primary_muscles?: string[];
  exercise_name?: string;
  workout_day: number;
  exercise_id?: string;
}

interface WorkoutDay {
  day: number;
  exercises: Exercise[];
  total_exercises: number;
  estimated_duration: number;
  total_calories: number;
}

interface Plan {
  id: string;
  title: string;
  difficulty_level?: string;
  subtitle?: string;
  category_name?: string;
  workoutDays: WorkoutDay[];
  current_day: number;
  start_date: string;
}

interface MyPlanScreenProps {
  embedded?: boolean;
}

export default function MyPlanScreen({ embedded = false }: MyPlanScreenProps) {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const statusBarHeight = StatusBar.currentHeight || 0;
  
  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userWorkoutDays, setUserWorkoutDays] = useState<number[]>([]);
  
  // Add a flag to prevent effect from overriding manual date selection
  const [isManualDateSelection, setIsManualDateSelection] = useState(false);
  
  // Calendar state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [completedWorkoutDays, setCompletedWorkoutDays] = useState<string[]>([]);
  
  // Add state to track paused workout days
  const [pausedWorkoutDays, setPausedWorkoutDays] = useState<string[]>([]);
  
  // Workout completion state
  const [isWorkoutCompleted, setIsWorkoutCompleted] = useState(false);
  const [completedWorkoutData, setCompletedWorkoutData] = useState<{
    completedExercises: number;
    duration: string; // Changed from number to string for hh:mm:ss format
    caloriesBurned: number;
    totalVolume: number;
    totalReps: number;
    completedAt: string;
    weekName: string;
    cycleWeek: number;
  } | null>(null);

  // Add state for paused workout
  const [pausedWorkout, setPausedWorkout] = useState<any>(null);
  const [hasPausedWorkout, setHasPausedWorkout] = useState(false);
  
  // Add state for the custom paused workout modal
  const [showPausedWorkoutModal, setShowPausedWorkoutModal] = useState(false);
  const [pausedWorkoutInfo, setPausedWorkoutInfo] = useState<{ 
    pausedDay: number | null,
    currentDay: number | null,
    mode: 'start' | 'redo'
  }>({
    pausedDay: null,
    currentDay: null,
    mode: 'start'
  });

  // Add state for cycle progress information
  const [cycleProgress, setCycleProgress] = useState<{
    currentWeek: number;
    weekName: string;
    completedWorkouts: number;
    totalWorkoutsInCycle: number;
    progressPercentage: number;
    weekDescription: string;
    recommendationTemplate: string;
  } | null>(null);

  // Add state to track if user is viewing a locked/future week
  const [isViewingLockedWeek, setIsViewingLockedWeek] = useState(false);
  const [lockedWeekInfo, setLockedWeekInfo] = useState<{
    selectedWeek: number;
    selectedWeekName: string;
    currentWeek: number;
    currentWeekName: string;
  } | null>(null);

  // Add loading state for date selection to prevent flash
  const [isDateSelectionLoading, setIsDateSelectionLoading] = useState(false);

  // Exercise Details Modal state
  const [exerciseDetailsModalVisible, setExerciseDetailsModalVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<{
    id: string;
    name: string;
    image_url?: string;
    primary_muscles?: string[];
    secondary_muscles?: string[];
    exercise_id?: string;
  } | null>(null);

  // Plan Overview Modal state
  const [planOverviewModalVisible, setPlanOverviewModalVisible] = useState(false);

  // Loading component for date selection
  const DateSelectionLoadingComponent = () => (
    <View style={styles.dateSelectionLoadingContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.dateSelectionLoadingText}>Loading workout...</Text>
    </View>
  );

  // Helper function to format duration as H:mm (hours without leading zero)
  const formatDurationAsHMM = (duration: string): string => {
    if (!duration) return '0:00';
    
    const parts = duration.split(':');
    if (parts.length < 2) return '0:00';
    
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    
    return `${hours}:${minutes}`;
  };

  // Handle exercise name click to show details modal
  const handleExerciseNamePress = (exercise: Exercise) => {
    setSelectedExercise({
      id: exercise.exercise_id || exercise.id,
      name: exercise.name,
      image_url: exercise.image_url,
      primary_muscles: exercise.primary_muscles,
      secondary_muscles: [], // We'll fetch this from the modal if needed
      exercise_id: exercise.exercise_id || exercise.id
    });
    setExerciseDetailsModalVisible(true);
  };

  // Handle closing the exercise details modal
  const handleExerciseDetailsModalClose = () => {
    setExerciseDetailsModalVisible(false);
    setSelectedExercise(null);
  };

  // Handle plan overview modal
  const handlePlanOverviewPress = () => {
    setPlanOverviewModalVisible(true);
  };

  const handlePlanOverviewModalClose = () => {
    setPlanOverviewModalVisible(false);
  };

  // Handle edit plan press
  const handleEditPlanPress = () => {
    // TODO: Implement edit plan functionality
    console.log('Edit plan pressed');
    // This could navigate to a plan editing screen or show an edit modal
  };

  // Add a new component for the progress line
  const WorkoutProgressLine = ({ pausedWorkout }: { pausedWorkout: any }) => {
    if (!pausedWorkout || !pausedWorkout.exercises) return null;
    
    const totalExercises = pausedWorkout.exercises.length;
    const currentIndex = pausedWorkout.currentExerciseIndex;
    const progressPercentage = ((currentIndex) / totalExercises) * 100;
    
    return (
      <View style={styles.progressLineContainer}>
        <View style={styles.progressLineTrack}>
          <View 
            style={[
              styles.progressLineFill, 
              { width: `${Math.max(0, Math.min(100, progressPercentage))}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressLineText}>
          {currentIndex} of {totalExercises} exercises completed
        </Text>
      </View>
    );
  };

  // Update the renderExerciseItem function inside the component
  const renderExerciseItem = ({ item, index }: { item: Exercise; index: number }) => {
    // Get the total number of exercises for this workout day
    const totalExercises = getWorkoutDayByNumber(activeDay)?.exercises?.length || 0;
    const isLastExercise = index === totalExercises - 1;
    
    // Determine the exercise state if there's a paused workout
    let exerciseState = 'normal'; // 'completed', 'ongoing', 'normal'
    
    if (hasPausedWorkout && pausedWorkout && pausedWorkout.exercises) {
      const pausedExerciseIndex = pausedWorkout.exercises.findIndex(
        (e: any) => e.id === item.id || e.exercise_id === item.exercise_id
      );
      
      if (pausedExerciseIndex !== -1) {
        const isCurrentExercise = pausedExerciseIndex === pausedWorkout.currentExerciseIndex;
        const exerciseSets = pausedWorkout.exerciseSets[pausedWorkout.exercises[pausedExerciseIndex].id] || [];
        const isCompleted = exerciseSets.length > 0 && exerciseSets.every((set: any) => set.isCompleted);
        
        if (isCompleted) {
          exerciseState = 'completed';
        } else if (isCurrentExercise) {
          exerciseState = 'ongoing';
        }
      }
    }
    
    return (
      <View>
        <View style={[
          styles.exerciseCard,
          // Remove the special styling since we'll use overlay instead
          { borderBottomWidth: 0, position: 'relative' }
        ]}>
          <View style={styles.exerciseLeftContent}>
            <View style={styles.exerciseImageContainer}>
              <OptimizedImage
                source={item.image_url ? { uri: item.image_url } : require('../../assets/exercises/placeholder.jpg')}
                style={styles.exerciseImage}
                fallback={require('../../assets/exercises/placeholder.jpg')}
                resizeMode="cover"
                cachePolicy="immutable"
                showLoader={false}
              />
            </View>
            <View style={styles.exerciseDetails}>
              <TouchableOpacity 
                onPress={() => handleExerciseNamePress(item)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.exerciseName,
                  styles.exerciseNameClickable,
                  (exerciseState === 'completed' || exerciseState === 'ongoing') && styles.exerciseTextGreyed
                ]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
              <Text style={[
                styles.exerciseSets,
                (exerciseState === 'completed' || exerciseState === 'ongoing') && styles.exerciseTextGreyed
              ]}>
                {item.sets} sets × {item.reps_range} reps
              </Text>
            </View>
          </View>
          {/* Muscle group tag */}
          {item.primary_muscles && item.primary_muscles.length > 0 && (
            <View style={[
              styles.muscleTag, 
              { backgroundColor: getMuscleTagColor(item.primary_muscles[0]) },
              (exerciseState === 'completed' || exerciseState === 'ongoing') && styles.muscleTagGreyed
            ]}>
              <Text style={[
                styles.muscleTagText,
                (exerciseState === 'completed' || exerciseState === 'ongoing') && styles.muscleTagTextGreyed
              ]}>
                {getMuscleTagName(item.primary_muscles[0])}
              </Text>
            </View>
          )}
          
          {/* Overlay for completed exercise */}
          {exerciseState === 'completed' && (
            <View style={styles.exerciseOverlay}>
              <View style={styles.completedIconContainer}>
                <View style={{ opacity: 1 }}>
                  <Icon source="check" size={24} color="#fff" />
                </View>
              </View>
            </View>
          )}
          
          {/* Overlay for ongoing exercise */}
          {exerciseState === 'ongoing' && (
            <View style={styles.exerciseOverlay}>
              <View style={styles.ongoingIconContainer}>
                <View style={{ opacity: 1 }}>
                  <Icon source="pause" size={22} color="#FFFFFF" />
                </View>
              </View>
            </View>
          )}
        </View>
        
        {/* Progress bar for paused exercise */}
        {exerciseState === 'ongoing' && hasPausedWorkout && pausedWorkout && (
          <View style={styles.exerciseProgressContainer}>
            <View style={styles.exerciseProgressTrack}>
              <View 
                style={[
                  styles.exerciseProgressFill, 
                  { width: `${Math.max(0, Math.min(100, ((pausedWorkout.currentExerciseIndex) / pausedWorkout.exercises.length) * 100))}%` }
                ]} 
              />
            </View>
            <Text style={styles.exerciseProgressText}>
              {pausedWorkout.currentExerciseIndex} of {pausedWorkout.exercises.length} exercises completed
            </Text>
          </View>
        )}
        
        {/* Custom divider logic - only show for normal exercises */}
        {!isLastExercise && exerciseState === 'normal' && (
          <View style={styles.exerciseDivider} />
        )}
      </View>
    );
  };

  // Animated Rest Day Component
  const RestDayComponent = () => {
    // Array of rest day messages
    const restDayVariations = [
      {
        icon: 'walk',
        title: 'ACTIVE RECOVERY',
        message: 'Perfect day for light movement! Consider a gentle bike ride, leisurely walk, or some dynamic stretching to keep your body active while recovering.',
        color: '#4CAF50'
      },
      {
        icon: 'meditation',
        title: 'REST & RESTORE',
        message: 'Your muscles are rebuilding stronger today. Take time for peaceful meditation, gentle yoga, or mindful breathing to support your recovery process.',
        color: '#9C27B0'
      },
      {
        icon: 'sleep',
        title: 'RECOVERY DAY',
        message: 'Rest is when the magic happens! Allow your body to repair and adapt. Focus on quality sleep and gentle stretching to optimize recovery.',
        color: '#2196F3'
      },
      {
        icon: 'spa',
        title: 'WELLNESS FOCUS',
        message: 'Treat yourself to some self-care today! Consider a relaxing bath, foam rolling session, or gentle massage to help your muscles recover.',
        color: '#FF9800'
      },
      {
        icon: 'nature',
        title: 'MINDFUL MOVEMENT',
        message: 'Connect with nature and move mindfully. A peaceful outdoor walk, light gardening, or gentle stretching in fresh air can boost recovery.',
        color: '#4CAF50'
      }
    ];
    
    // Generate a consistent random index based on the selected date
    // Convert the date to a string in format 'YYYY-MM-DD' to use as a seed
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    
    // Use the dateString to create a deterministic index
    // Sum the character codes of all characters in the dateString
    let dateSum = 0;
    for (let i = 0; i < dateString.length; i++) {
      dateSum += dateString.charCodeAt(i);
    }
    
    // Use modulo to get an index within the array bounds
    const determinedIndex = dateSum % restDayVariations.length;
    
    // Get the rest day variation for this specific date
    const currentVariation = restDayVariations[determinedIndex];
    
    return (
      <View style={styles.restDayContainer}>
        <Text style={styles.restDayTitle}>{currentVariation.title}</Text>
        
        <View style={styles.restDayIconContainer}>
          <Icon source={currentVariation.icon} size={60} color={currentVariation.color} />
        </View>
        
        <Text style={styles.restDayMessage}>
          {currentVariation.message}
        </Text>
        
        <View style={styles.restDayTips}>
          <Text style={styles.restDayTipsTitle}>Recovery Activities:</Text>
          <Text style={styles.restDayTip}>• 10-20 minute gentle walk or nature stroll</Text>
          <Text style={styles.restDayTip}>• Light stretching, yoga, or mobility work</Text>
          <Text style={styles.restDayTip}>• Foam rolling or self-massage therapy</Text>
          <Text style={styles.restDayTip}>• Meditation, breathing exercises, or mindfulness</Text>
          <Text style={styles.restDayTip}>• Relaxing bath or spa-like self-care</Text>
          <Text style={styles.restDayTip}>• Quality sleep and proper hydration</Text>
        </View>
      </View>
    );
  };

  // Locked Week Component
  const LockedWeekComponent = () => {
    if (!lockedWeekInfo) return null;
    
    return (
      <View style={styles.lockedWeekContainer}>
        <View style={styles.lockedWeekHeader}>
                  <View style={styles.lockedIconContainer}>
          <Icon source="lock" size={40} color={COLORS.primary} />
        </View>
          <Text style={styles.lockedWeekTitle}>Week {lockedWeekInfo.selectedWeek} Locked</Text>
          <Text style={styles.lockedWeekSubtitle}>{lockedWeekInfo.selectedWeekName} Phase</Text>
        </View>
        
        <View style={styles.lockedWeekContent}>
          <Text style={styles.lockedWeekMessage}>
            Complete Week {lockedWeekInfo.currentWeek} - {lockedWeekInfo.currentWeekName} before accessing this week's workouts.
          </Text>
          
          <View style={styles.lockedWeekProgress}>
            <Text style={styles.lockedProgressTitle}>Current Progress</Text>
            <View style={styles.lockedProgressInfo}>
              <View style={styles.currentWeekBadge}>
                <Text style={styles.currentWeekBadgeText}>W{lockedWeekInfo.currentWeek}</Text>
              </View>
              <Text style={styles.lockedProgressText}>
                {lockedWeekInfo.currentWeekName} Phase
              </Text>
            </View>
          </View>
          
          <View style={styles.lockedWeekTips}>
            <Text style={styles.lockedTipsTitle}>To unlock Week {lockedWeekInfo.selectedWeek}:</Text>
            <Text style={styles.lockedTip}>• Complete all workouts in Week {lockedWeekInfo.currentWeek}</Text>
            <Text style={styles.lockedTip}>• Follow the progressive training plan</Text>
            <Text style={styles.lockedTip}>• Maintain consistency with your schedule</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.backToCurrentWeekButton}
            onPress={() => {
              // Navigate back to current week
              const today = new Date();
              setSelectedDate(today);
              setIsViewingLockedWeek(false);
              setLockedWeekInfo(null);
              
              // Properly determine if today is a workout day
              if (plan && userWorkoutDays.length > 0) {
                const todayStr = format(today, 'yyyy-MM-dd');
                const markedDatesObj = workoutPlanService.setupCalendarDatesProgressive(
                  plan.start_date,
                  plan.workoutDays.length,
                  userWorkoutDays,
                  { primary: COLORS.primary }
                );
                
                const todayMarkedInfo = markedDatesObj[todayStr];
                if (todayMarkedInfo && todayMarkedInfo.marked && todayMarkedInfo.workoutDayIndex) {
                  // Today is a workout day
                  handleCalendarDateSelect(today, todayMarkedInfo.workoutDayIndex, true);
                } else {
                  // Today is not a workout day
                  handleCalendarDateSelect(today, null, false);
                }
              } else {
                // Fallback if no plan data
                handleCalendarDateSelect(today, null, false);
              }
            }}
          >
            <Icon source="arrow-left" size={20} color={COLORS.text} />
            <Text style={styles.backToCurrentWeekText}>Back to Week {lockedWeekInfo.currentWeek}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Add function to handle resuming paused workout
  const handleResumeWorkout = async () => {
    if (!user || !plan || !hasPausedWorkout || !pausedWorkout || activeDay === null) {
      Alert.alert('Error', 'No paused workout found for this day');
      return;
    }
    
    try {
      // Get the cycle week from the selected date instead of database stored week
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      const markedDatesObj = workoutPlanService.setupCalendarDatesProgressive(
        plan.start_date,
        plan.workoutDays.length,
        userWorkoutDays,
        { primary: COLORS.primary }
      );
      
      const selectedDateInfo = markedDatesObj[selectedDateStr];
      const selectedCycleWeek = selectedDateInfo?.cycleWeek || 1;
      const selectedWeekName = selectedDateInfo?.weekName || 'Adaptation';
      
      // Navigate to workout session with the paused workout flag and explicit day
      router.push({
        pathname: '/(stack)/workout-session',
        params: { 
          planId: plan.id,
          workoutDay: pausedWorkout.workoutDay || activeDay, // Use the day from the paused workout data
          cycleWeek: selectedCycleWeek,
          weekName: selectedWeekName,
          forceResume: 'true' // Add a flag to force resume
        }
      });
    } catch (err) {
      // Error resuming workout
      Alert.alert('Error', 'Failed to resume workout');
    }
  };

  // Pulsing Icon Container Component
  const PulsingIconContainer = () => {
    const pulseAnimation = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, []);

    return (
      <Animated.View
        style={[
          styles.noPlanIconContainer,
          {
            transform: [{ scale: pulseAnimation }],
          },
        ]}
      >
        <Icon source="weight-lifter" size={90} color={COLORS.primary} />
      </Animated.View>
    );
  };

  // Modal component for paused workout alert
  const PausedWorkoutModal = () => {
    // Only render if needed
    if (!showPausedWorkoutModal || !pausedWorkoutInfo.pausedDay) return null;
    
    return (
      <Modal
        visible={showPausedWorkoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPausedWorkoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pausedModalContainer}>
            <LinearGradient
              colors={['#121418', '#0A0C10']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.pausedModalContent}>
                <Text style={styles.pausedModalTitle}>Workout In Progress</Text>
                
                <View style={styles.pausedModalIcon}>
                  <Icon source="pause-circle" size={50} color="#FF9800" />
                </View>
                
                <Text style={styles.pausedModalMessage}>
                  You have a paused workout for day {pausedWorkoutInfo.pausedDay}. Would you like to resume it or {pausedWorkoutInfo.mode === 'start' ? 'start today\'s' : 'redo this'} workout?
                </Text>
                
                <View style={styles.pausedModalActions}>
                  {/* Resume button */}
                  <TouchableOpacity 
                    style={styles.pausedModalResumeButton}
                    onPress={async () => {
                      setShowPausedWorkoutModal(false);
                      // Direct resume for the paused workout
                      if (pausedWorkoutInfo.pausedDay && user && plan) {
                        try {
                          // Get the paused workout data directly
                          const { data, error } = await supabase
                            .from('user_paused_workouts')
                            .select('*')
                            .eq('user_id', user.id)
                            .eq('plan_id', plan.id)
                            .eq('workout_day', pausedWorkoutInfo.pausedDay)
                            .limit(1);
                            
                          if (error || !data || data.length === 0) {
                            Alert.alert('Error', 'Could not find the paused workout');
                            return;
                          }
                          
                          // Set up the pausedWorkout state with the retrieved data
                          const pausedWorkoutData = data[0];
                          const formattedPausedWorkout = {
                            userId: pausedWorkoutData.user_id,
                            planId: pausedWorkoutData.plan_id,
                            workoutDay: pausedWorkoutData.workout_day,
                            cycleWeek: pausedWorkoutData.cycle_week,
                            weekName: pausedWorkoutData.week_name,
                            exercises: pausedWorkoutData.exercises,
                            exerciseSets: pausedWorkoutData.exercise_sets,
                            workoutDuration: pausedWorkoutData.workout_duration,
                            totalVolume: pausedWorkoutData.total_volume,
                            totalReps: pausedWorkoutData.total_reps,
                            currentExerciseIndex: pausedWorkoutData.current_exercise_index,
                            originalCycleWeek: pausedWorkoutData.original_cycle_week,
                            pausedAt: pausedWorkoutData.paused_at
                          };
                          
                          // Temporarily update the state to enable resuming
                          setPausedWorkout(formattedPausedWorkout);
                          setHasPausedWorkout(true);
                          
                          // Get the cycle week from the selected date instead of database stored week
                          const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
                          const markedDatesObj = workoutPlanService.setupCalendarDatesProgressive(
                            plan.start_date,
                            plan.workoutDays.length,
                            userWorkoutDays,
                            { primary: COLORS.primary }
                          );
                          
                          const selectedDateInfo = markedDatesObj[selectedDateStr];
                          const selectedCycleWeek = selectedDateInfo?.cycleWeek || 1;
                          const selectedWeekName = selectedDateInfo?.weekName || 'Adaptation';
                          
                          // Navigate directly to resume the workout
                          router.push({
                            pathname: '/(stack)/workout-session',
                            params: { 
                              planId: plan.id,
                              workoutDay: pausedWorkoutData.workout_day,
                              cycleWeek: selectedCycleWeek,
                              weekName: selectedWeekName,
                              forceResume: 'true'
                            }
                          });
                        } catch (err) {
                          Alert.alert('Error', 'Failed to resume workout');
                        }
                      }
                    }}
                  >
                    <View style={styles.buttonContent}>
                      <Icon source="play-circle" size={24} color={COLORS.text} />
                      <Text style={styles.pausedModalButtonText}>Resume Workout</Text>
                    </View>
                  </TouchableOpacity>
                  
                  {/* Start New/Redo button */}
                  <TouchableOpacity 
                    style={styles.pausedModalStartButton}
                    onPress={async () => {
                      setShowPausedWorkoutModal(false);
                      
                      // Start loading state
                      setIsLoading(true);
                      
                      try {
                        if (pausedWorkoutInfo.pausedDay && user && plan) {
                          // Clear the existing paused workout first
                          await workoutPlanService.clearPausedWorkout(user.id, plan.id, pausedWorkoutInfo.pausedDay);
                          
                          // Reset paused workout state
                          setHasPausedWorkout(false);
                          setPausedWorkout(null);
                        }
                        
                        // Continue with starting the current day workout
                        if (activeDay !== null && user && plan) {
                          // Get the cycle week from the selected date instead of database stored week
                          const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
                          const markedDatesObj = workoutPlanService.setupCalendarDatesProgressive(
                            plan.start_date,
                            plan.workoutDays.length,
                            userWorkoutDays,
                            { primary: COLORS.primary }
                          );
                          
                          const selectedDateInfo = markedDatesObj[selectedDateStr];
                          const selectedCycleWeek = selectedDateInfo?.cycleWeek || 1;
                          const selectedWeekName = selectedDateInfo?.weekName || 'Adaptation';
                          
                          // Navigate to workout session for the current day
                          router.push({
                            pathname: '/(stack)/workout-session',
                            params: { 
                              planId: plan.id,
                              workoutDay: activeDay,
                              cycleWeek: selectedCycleWeek,
                              weekName: selectedWeekName,
                              // Add forceStart flag for redo mode
                              ...(pausedWorkoutInfo.mode === 'redo' ? { forceStart: 'true' } : {})
                            }
                          });
                        }
                      } catch (err) {
                        Alert.alert('Error', 'Failed to start workout');
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                  >
                    <View style={styles.buttonContent}>
                      <Icon source="dumbbell" size={24} color={COLORS.text} />
                      <Text style={styles.pausedModalButtonText}>
                        {pausedWorkoutInfo.mode === 'start' ? 'Start This Workout' : 'Redo This Workout'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  
                  {/* Cancel button */}
                  <TouchableOpacity 
                    style={styles.pausedModalCancelButton}
                    onPress={() => setShowPausedWorkoutModal(false)}
                  >
                    <Text style={styles.pausedModalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    );
  };

  // Add the Function to restart a completed workout
  const handleRedoWorkout = async () => {
    if (!plan || activeDay === null || !user) return;
    
    try {
      // Check for any paused workouts in the plan
      const { hasPaused, pausedWorkoutDay } = await checkForAnyPausedWorkout();
      
      // If there's a paused workout, show our custom modal instead of Alert
      if (hasPaused && pausedWorkoutDay !== null) {
        // Set the modal info and show it with 'redo' mode
        setPausedWorkoutInfo({
          pausedDay: pausedWorkoutDay,
          currentDay: activeDay,
          mode: 'redo'
        });
        setShowPausedWorkoutModal(true);
        return;
      }

      // No paused workout, proceed with restarting the workout
      // Get the cycle week from the selected date instead of database stored week
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      const markedDatesObj = workoutPlanService.setupCalendarDatesProgressive(
        plan.start_date,
        plan.workoutDays.length,
        userWorkoutDays,
        { primary: COLORS.primary }
      );
      
      const selectedDateInfo = markedDatesObj[selectedDateStr];
      const selectedCycleWeek = selectedDateInfo?.cycleWeek || 1;
      const selectedWeekName = selectedDateInfo?.weekName || 'Adaptation';
      
      // Navigate to workout session with a flag to force start
      router.push({
        pathname: '/(stack)/workout-session',
        params: { 
          planId: plan.id,
          workoutDay: activeDay,
          cycleWeek: selectedCycleWeek,
          weekName: selectedWeekName,
          forceStart: 'true' // Add this flag to force start even if completed
        }
      });
    } catch (err) {
      // Error restarting workout
      Alert.alert('Error', 'Failed to restart workout');
    }
  };

  // Helper function to find the workout day object by day number
  const getWorkoutDayByNumber = (dayNumber: number | null): WorkoutDay | null => {
    if (!plan || dayNumber === null) return null;
    return plan.workoutDays.find(workoutDay => workoutDay.day === dayNumber) || null;
  };

  // Helper function to update paused workout days for the calendar
  const updatePausedWorkoutDays = useCallback(async () => {
    if (!user?.id || !plan?.id) return;
    
    try {
      // Get all paused workouts for this plan
      const { data, error } = await supabase
        .from('user_paused_workouts')
        .select('workout_day')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id);
      
      if (error) {
        console.error('Error fetching paused workouts:', error);
        return;
      }
      
      if (!data || data.length === 0) {
        setPausedWorkoutDays([]);
        return;
      }
    } catch (error) {
      console.error('Error updating paused workout days:', error);
      // setPausedWorkoutDays([]); // COMMENTED OUT: This was overriding the correct data from updateCalendarWorkoutStatus
    }
  }, [user?.id, plan?.id]);

  // New function to properly update completed and paused workout days for calendar
  const updateCalendarWorkoutStatus = useCallback(async () => {
    if (!user?.id || !plan?.id || !plan?.start_date || userWorkoutDays.length === 0) {
      setCompletedWorkoutDays([]);
      setPausedWorkoutDays([]);
      return;
    }
    
    try {
      // Get the marked dates (workout days mapped to calendar dates) - USE PROGRESSIVE METHOD
      const markedDatesObj = workoutPlanService.setupCalendarDatesProgressive(
        plan.start_date,
        plan.workoutDays.length,
        userWorkoutDays,
        { primary: COLORS.primary }
      );
      
      // Get all completed workouts for this plan with completion dates
      const { data: completedWorkouts, error: completedError } = await supabase
        .from('user_workout_history')
        .select('workout_day, completed_at, cycle_week, week_name')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id);
      
      // Get all paused workouts for this plan
      const { data: pausedWorkouts, error: pausedError } = await supabase
        .from('user_paused_workouts')
        .select('workout_day')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id);
      
      if (completedError) {
        console.error('Error fetching completed workouts:', completedError);
      }
      
      if (pausedError) {
        console.error('Error fetching paused workouts:', pausedError);
      }
      

      
      // Map workout days to calendar dates
      const completedDates: string[] = [];
      const pausedDates: string[] = [];
      
      // FIXED LOGIC: Match completions by actual date, not just workout day index
      Object.entries(markedDatesObj).forEach(([dateStr, dateInfo]: [string, any]) => {
        if (dateInfo && dateInfo.workoutDayIndex !== undefined && dateInfo.cycleWeek !== undefined) {
          const workoutDayIndex = dateInfo.workoutDayIndex;
          const cycleWeek = dateInfo.cycleWeek;
          const calendarDate = new Date(dateStr);
          
          // Check if this specific date has a completed workout
          // We need to match by workout day, cycle week, and completion date proximity
          const hasCompletedWorkout = completedWorkouts && completedWorkouts.length > 0 && completedWorkouts.some((w: any) => {
            if (w.workout_day !== workoutDayIndex) return false;
            
            // Parse the completion date
            const completionDate = new Date(w.completed_at);
            const completionDateStr = format(completionDate, 'yyyy-MM-dd');
            
            // Check if the completion date matches this calendar date
            // OR if it's the same workout day in the same cycle week
            return completionDateStr === dateStr || 
                   (w.workout_day === workoutDayIndex && w.cycle_week === cycleWeek);
          });
          
          if (hasCompletedWorkout) {
            completedDates.push(dateStr);
          }
          
          // Check if this workout day is paused (keep existing logic for paused workouts)
          if (pausedWorkouts && pausedWorkouts.length > 0 && pausedWorkouts.some((w: any) => w.workout_day === workoutDayIndex)) {
            pausedDates.push(dateStr);
          }
        }
      });
      

      
      setCompletedWorkoutDays(completedDates);
      setPausedWorkoutDays(pausedDates);
      
    } catch (error) {
      console.error('Error updating calendar workout status:', error);
      setCompletedWorkoutDays([]);
      setPausedWorkoutDays([]);
    }
  }, [user?.id, plan?.id, plan?.start_date, userWorkoutDays.length, plan?.workoutDays?.length]);

  // Fetch user's preferred workout days
  const fetchUserWorkoutDays = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const workoutDays = await workoutPlanService.getUserWorkoutDays(user.id);
      setUserWorkoutDays(workoutDays);
      
      // If user has no workout days set, we should prompt them to set preferences
      if (workoutDays.length === 0) {
        // User has no workout days set, should prompt to set preferences
        // We'll show a prompt in the UI to set workout preferences
      }
    } catch (err) {
      // Error fetching user workout days
      // Don't set default days anymore - we'll prompt the user to set their preferences
      setUserWorkoutDays([]);
    }
  }, [user?.id]);
  
  // Fetch cycle progress information
  const fetchCycleProgress = useCallback(async () => {
    if (!user?.id || !plan?.id) return;
    
    try {
      const progress = await workoutPlanService.getCurrentCycleProgress(user.id, plan.id);
      setCycleProgress(progress);
    } catch (error) {
      console.error('Error fetching cycle progress:', error);
      setCycleProgress(null);
    }
  }, [user?.id, plan?.id]);

  // Fetch the user's active plan
  const fetchActivePlan = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get the current workout days to pass to the service
      const currentWorkoutDays = [...userWorkoutDays];
      
      // Use the service function to fetch the active plan
      const { plan: formattedPlan } = await workoutPlanService.fetchActivePlan(
        user.id,
        currentWorkoutDays
      );
      
      if (!formattedPlan) {
        setPlan(null);
        setCycleProgress(null);
        setIsLoading(false);
        return;
      }
      
      setPlan(formattedPlan);
      
      // Fetch cycle progress information
      const progress = await workoutPlanService.getCurrentCycleProgress(user.id, formattedPlan.id);
      setCycleProgress(progress);
      
      // Setup initial active day based on today's date and whether it's a workout day
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      
      // IMPORTANT: Only setup calendar after we have user workout days
      if (currentWorkoutDays.length > 0) {
        // Use the progressive calendar setup
        const markedDatesObj = workoutPlanService.setupCalendarDatesProgressive(
          formattedPlan.start_date,
          formattedPlan.workoutDays.length,
          currentWorkoutDays,
          { primary: COLORS.primary }
        );
        
        // Check if today is a workout day
        const todayMarkedInfo = markedDatesObj[todayStr];
        if (todayMarkedInfo && todayMarkedInfo.marked && todayMarkedInfo.workoutDayIndex) {
          // Today is a workout day - set it as the active day
          setActiveDay(todayMarkedInfo.workoutDayIndex);

        } else {
          // Today is not a workout day - don't set an active day (will show rest day)
          setActiveDay(null);
        }
      } else {
        // No user workout days available, calendar setup delayed
        // Don't set an active day until we have proper workout days
        setActiveDay(null);
      }
    } catch (err: any) {
      // Error fetching active plan
      setError('Failed to load your plan.');
      console.error('Error fetching active plan:', err);
      setCycleProgress(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userWorkoutDays]);
  
  // Check if workout is already completed for the selected day and update the completed days list
  const checkWorkoutCompletion = async (workoutDayIndex = activeDay) => {
    if (!user || !plan || workoutDayIndex === null) return false;
    
    try {
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Get the marked dates to understand the cycle week context
      const markedDatesObj = workoutPlanService.setupCalendarDatesProgressive(
        plan.start_date,
        plan.workoutDays.length,
        userWorkoutDays,
        { primary: COLORS.primary }
      );
      
      // Get the cycle week info for the selected date
      const selectedDateInfo = markedDatesObj[selectedDateStr];
      const cycleWeek = selectedDateInfo?.cycleWeek;
      
      // Check for completed workouts on this specific date and cycle week
      const { data: completedWorkouts, error: completedError } = await supabase
        .from('user_workout_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id)
        .eq('workout_day', workoutDayIndex);
      
      if (completedError) {
        console.error('Error fetching completed workouts:', completedError);
        return false;
      }
      
      // Check if there's a completion for this specific date/cycle week
      if (completedWorkouts && completedWorkouts.length > 0) {
        // Look for a completion that matches this specific date or cycle week
        const matchingCompletion = completedWorkouts.find((w: any) => {
          const completionDate = new Date(w.completed_at);
          const completionDateStr = format(completionDate, 'yyyy-MM-dd');
          
          // Match by exact date OR by cycle week (for same workout day in same week)
          return completionDateStr === selectedDateStr || 
                 (w.cycle_week === cycleWeek && w.workout_day === workoutDayIndex);
        });
        
        if (matchingCompletion) {
          // Workout is completed for this specific date
          const completedWorkoutData = {
            completedExercises: matchingCompletion.completed_exercises || 0,
            duration: matchingCompletion.workout_duration || '00:00:00',
            caloriesBurned: matchingCompletion.calories_burned || 0,
            totalVolume: matchingCompletion.total_volume || 0,
            totalReps: matchingCompletion.total_reps || 0,
            completedAt: matchingCompletion.completed_at,
            weekName: matchingCompletion.week_name || '',
            cycleWeek: matchingCompletion.cycle_week || 1
          };
          
          setCompletedWorkoutData(completedWorkoutData);
          setIsWorkoutCompleted(true);
          return true;
        }
      }
      
      // Workout is not completed for this specific date
      setIsWorkoutCompleted(false);
      setCompletedWorkoutData(null);
      return false;
    } catch (error) {
      console.error('Error in checkWorkoutCompletion:', error);
      setIsWorkoutCompleted(false);
      setCompletedWorkoutData(null);
      return false;
    }
  };
  
  // Handle date selection from calendar component
  const handleCalendarDateSelect = useCallback(async (date: Date, workoutDayIndex: number | null, isWorkoutDay: boolean) => {
    setSelectedDate(date);
    
    // Set flag to prevent effect from overriding this manual selection
    setIsManualDateSelection(true);
    
    // CRITICAL FIX: Reset paused workout state immediately when changing dates
    // This prevents showing stale paused workout state from previous day
    setHasPausedWorkout(false);
    setPausedWorkout(null);
    
    if (isWorkoutDay && workoutDayIndex !== null) {
      // Start loading state to prevent flash
      setIsDateSelectionLoading(true);
      
      // Reset states immediately to prevent flash
      setIsWorkoutCompleted(false);
      setCompletedWorkoutData(null);
      setActiveDay(null); // Don't set active day yet
      
      // Check if this specific date has a completed workout
      if (user?.id && plan?.id) {
        try {
          const selectedDateStr = format(date, 'yyyy-MM-dd');
          
          // Get the marked dates to understand the cycle week context
          const markedDatesObj = workoutPlanService.setupCalendarDatesProgressive(
            plan.start_date,
            plan.workoutDays.length,
            userWorkoutDays,
            { primary: COLORS.primary }
          );
          
          // Get the cycle week info for the selected date
          const selectedDateInfo = markedDatesObj[selectedDateStr];
          const selectedCycleWeek = selectedDateInfo?.cycleWeek;
          const selectedWeekName = selectedDateInfo?.weekName;
          
          // Check if user is viewing a future week they haven't unlocked
          if (cycleProgress && selectedCycleWeek && selectedCycleWeek > cycleProgress.currentWeek) {
            // User is viewing a locked/future week
            setIsViewingLockedWeek(true);
            setLockedWeekInfo({
              selectedWeek: selectedCycleWeek,
              selectedWeekName: selectedWeekName || 'Unknown',
              currentWeek: cycleProgress.currentWeek,
              currentWeekName: cycleProgress.weekName
            });
            
            // Reset workout states since this is a locked week
            setIsWorkoutCompleted(false);
            setCompletedWorkoutData(null);
            setHasPausedWorkout(false);
            setPausedWorkout(null);
            
            // Clear the flag after a short delay
            setTimeout(() => {
              setIsManualDateSelection(false);
            }, 500);
            setIsDateSelectionLoading(false);
            return;
          } else {
            // User is viewing current or past week - reset locked week state
            setIsViewingLockedWeek(false);
            setLockedWeekInfo(null);
          }
          
          // ... existing completion check logic ...
          const cycleWeek = selectedDateInfo?.cycleWeek;
          
          // Check for completed workouts on this specific date and cycle week
          const { data: completedWorkouts, error: completedError } = await supabase
            .from('user_workout_history')
            .select('*')
            .eq('user_id', user.id)
            .eq('plan_id', plan.id)
            .eq('workout_day', workoutDayIndex);
          
          if (completedError) {
            console.error('Error fetching completed workouts:', completedError);
          }
          
          // Check if there's a completion for this specific date/cycle week
          let isCompletedForThisDate = false;
          let completedWorkoutData = null;
          
          if (completedWorkouts && completedWorkouts.length > 0) {
            // Look for a completion that matches this specific date or cycle week
            const matchingCompletion = completedWorkouts.find((w: any) => {
              const completionDate = new Date(w.completed_at);
              const completionDateStr = format(completionDate, 'yyyy-MM-dd');
              
              // Match by exact date OR by cycle week (for same workout day in same week)
              return completionDateStr === selectedDateStr || 
                     (w.cycle_week === cycleWeek && w.workout_day === workoutDayIndex);
            });
            
            if (matchingCompletion) {
              isCompletedForThisDate = true;
              completedWorkoutData = {
                completedExercises: matchingCompletion.completed_exercises || 0,
                duration: matchingCompletion.workout_duration || '00:00:00',
                caloriesBurned: matchingCompletion.calories_burned || 0,
                totalVolume: matchingCompletion.total_volume || 0,
                totalReps: matchingCompletion.total_reps || 0,
                completedAt: matchingCompletion.completed_at,
                weekName: matchingCompletion.week_name || '',
                cycleWeek: matchingCompletion.cycle_week || 1
              };
            }
          }
          
          // Update workout completion state based on specific date check
          setIsWorkoutCompleted(isCompletedForThisDate);
          if (isCompletedForThisDate && completedWorkoutData) {
            setCompletedWorkoutData(completedWorkoutData);
            // Clear paused workout state for completed workouts
            setHasPausedWorkout(false);
            setPausedWorkout(null);
          } else {
            setCompletedWorkoutData(null);
            
            // If not completed, check for paused workout for this specific day
            try {
              const { data, error } = await supabase
                .from('user_paused_workouts')
                .select('*')
                .eq('user_id', user.id)
                .eq('plan_id', plan.id)
                .eq('workout_day', workoutDayIndex)
                .limit(1);
              
              if (!error && data && data.length > 0) {
                const formattedPausedWorkout = {
                  userId: data[0].user_id,
                  planId: data[0].plan_id,
                  workoutDay: data[0].workout_day,
                  cycleWeek: data[0].cycle_week,
                  weekName: data[0].week_name,
                  exercises: data[0].exercises,
                  exerciseSets: data[0].exercise_sets,
                  workoutDuration: data[0].workout_duration,
                  totalVolume: data[0].total_volume,
                  totalReps: data[0].total_reps,
                  currentExerciseIndex: data[0].current_exercise_index,
                  originalCycleWeek: data[0].original_cycle_week,
                  pausedAt: data[0].paused_at
                };
                
                setPausedWorkout(formattedPausedWorkout);
                setHasPausedWorkout(true);
              } else {
                setPausedWorkout(null);
                setHasPausedWorkout(false);
              }
            } catch (error) {
              console.error('Error checking for paused workout:', error);
              setPausedWorkout(null);
              setHasPausedWorkout(false);
            }
          }
        } catch (error) {
          console.error('Error checking workout completion for selected date:', error);
          setIsWorkoutCompleted(false);
          setCompletedWorkoutData(null);
          setHasPausedWorkout(false);
          setPausedWorkout(null);
        } finally {
          // Set the active day after completion check is done
          setActiveDay(workoutDayIndex);
          setIsDateSelectionLoading(false);
        }
      }
    } else {
      // Not a workout day - reset everything
      setActiveDay(null);
      setIsWorkoutCompleted(false);
      setCompletedWorkoutData(null);
      setHasPausedWorkout(false);
      setPausedWorkout(null);
      setIsViewingLockedWeek(false);
      setLockedWeekInfo(null);
      setIsDateSelectionLoading(false);
    }
    
    // Clear the flag after a short delay to allow effects to run normally again
    setTimeout(() => {
      setIsManualDateSelection(false);
    }, 500);
  }, [user?.id, plan?.id, userWorkoutDays, plan?.start_date, plan?.workoutDays?.length, cycleProgress]);
  
  const handleStartWorkout = async () => {
    if (!plan || activeDay === null || !user) return;
    
    try {
      // First check if workout is already completed
      const isCompleted = await checkWorkoutCompletion();
      
      if (isCompleted) {
        return; // Don't navigate, show completion info in the current screen
      }
      
      // Check for any paused workouts in the plan
      const { hasPaused, pausedWorkoutDay } = await checkForAnyPausedWorkout();
      
      // If there's a paused workout, show our custom modal instead of Alert
      if (hasPaused && pausedWorkoutDay !== null) {
        // Set the modal info and show it with 'start' mode
        setPausedWorkoutInfo({
          pausedDay: pausedWorkoutDay,
          currentDay: activeDay,
          mode: 'start'
        });
        setShowPausedWorkoutModal(true);
        return;
      }
      
      // No paused workout, proceed with starting a new workout
      // Get the current cycle week from the database (user's actual progress)
      
      // Fetch the user's current cycle week from the database
      const { data: activePlanData, error: activePlanError } = await supabase
        .from('user_active_plans')
        .select('current_week, completed_workouts')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id)
        .eq('is_active', true)
        .single();
      
      if (activePlanError) {
        console.error('Error fetching active plan data:', activePlanError);
        Alert.alert('Error', 'Failed to fetch plan data');
        return;
      }
      
      const currentWeek = activePlanData?.current_week || 1;
      const completedWorkouts = activePlanData?.completed_workouts || 0;
      
      // Get the week name from the database
      const { data: weekData, error: weekError } = await supabase
        .from('workout_cycle_weeks')
        .select('name')
        .eq('week_number', currentWeek)
        .single();
      
      const weekName = weekData?.name || 'Adaptation';
      
      // Navigate to workout session using the database's current cycle week
      router.push({
        pathname: '/(stack)/workout-session',
        params: { 
          planId: plan.id,
          workoutDay: activeDay, // This is now 1-indexed (1, 2, 3)
          cycleWeek: currentWeek,
          weekName: weekName
        }
      });
    } catch (err) {
      // Error starting workout
      Alert.alert('Error', 'Failed to start workout');
    }
  };
  
  // Function to check for paused workouts for any day in the current plan
  const checkForAnyPausedWorkout = useCallback(async () => {
    if (!user?.id || !plan?.id) return { hasPaused: false, pausedWorkoutDay: null };
    
    try {
      // Query Supabase directly for any paused workouts for this plan
      const { data, error } = await supabase
        .from('user_paused_workouts')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id)
        .order('paused_at', { ascending: false });
      
      if (error) {
        console.error('Error checking for any paused workouts:', error);
        return { hasPaused: false, pausedWorkoutDay: null };
      }
      
      if (data && data.length > 0) {
        // Found a paused workout for this plan
        return { 
          hasPaused: true, 
          pausedWorkoutDay: data[0].workout_day, 
          pausedWorkoutData: data[0] 
        };
      }
      
      return { hasPaused: false, pausedWorkoutDay: null };
    } catch (error) {
      console.error('Error in checkForAnyPausedWorkout:', error);
      return { hasPaused: false, pausedWorkoutDay: null };
    }
  }, [user?.id, plan?.id]);

  // Function to check for paused workouts (used in specific contexts)
  const checkForPausedWorkout = useCallback(async (workoutDay?: number) => {
    const dayToCheck = workoutDay || activeDay;
    if (!user?.id || !plan?.id || dayToCheck === null) {
      return false;
    }
    
    try {
      const { data, error } = await supabase
        .from('user_paused_workouts')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id)
        .eq('workout_day', dayToCheck)
        .limit(1);
      
      if (error) {
        console.error('Error checking for paused workout:', error);
        return false;
      }
      
      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking for paused workout:', error);
      return false;
    }
  }, [user?.id, plan?.id, activeDay]);

  // CONSOLIDATED INITIALIZATION EFFECT
  useEffect(() => {
    const initializeData = async () => {
      if (!user?.id) return;
      
      // First fetch user workout days
      await fetchUserWorkoutDays();
    };
    
    initializeData();
  }, [user?.id]); // Only depend on user ID
  
  // CONSOLIDATED PLAN FETCH EFFECT
  useEffect(() => {
    if (user?.id && userWorkoutDays.length >= 0) {
      fetchActivePlan();
    }
  }, [user?.id, userWorkoutDays.length]); // Removed fetchActivePlan to prevent infinite loop
  
  // CONSOLIDATED CALENDAR UPDATE EFFECT
  useEffect(() => {
    const updateCalendarData = async () => {
      if (!plan?.id || !user?.id || userWorkoutDays.length === 0) return;
      
      // Skip if user just manually selected a date to prevent overriding the date-specific check
      if (isManualDateSelection) return;
      
      try {
        // Update calendar workout status (completed and paused workouts)
        await updateCalendarWorkoutStatus();
        
        // If we have an active day, check its completion status using the same date-specific logic
        if (activeDay !== null) {
          const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
          
          // Get the marked dates to understand the cycle week context
          const markedDatesObj = workoutPlanService.setupCalendarDatesProgressive(
            plan.start_date,
            plan.workoutDays.length,
            userWorkoutDays,
            { primary: COLORS.primary }
          );
          
          // Get the cycle week info for the selected date
          const selectedDateInfo = markedDatesObj[selectedDateStr];
          const cycleWeek = selectedDateInfo?.cycleWeek;
          
          // Check for completed workouts on this specific date and cycle week
          const { data: completedWorkouts, error: completedError } = await supabase
            .from('user_workout_history')
            .select('*')
            .eq('user_id', user.id)
            .eq('plan_id', plan.id)
            .eq('workout_day', activeDay);
          
          if (completedError) {
            console.error('Error fetching completed workouts in effect:', completedError);
          }
          
          // Check if there's a completion for this specific date/cycle week
          let isCompletedForThisDate = false;
          let completedWorkoutData = null;
          
          if (completedWorkouts && completedWorkouts.length > 0) {
            // Look for a completion that matches this specific date or cycle week
            const matchingCompletion = completedWorkouts.find((w: any) => {
              const completionDate = new Date(w.completed_at);
              const completionDateStr = format(completionDate, 'yyyy-MM-dd');
              
              // Match by exact date OR by cycle week (for same workout day in same week)
              return completionDateStr === selectedDateStr || 
                     (w.cycle_week === cycleWeek && w.workout_day === activeDay);
            });
            
            if (matchingCompletion) {
              isCompletedForThisDate = true;
              completedWorkoutData = {
                completedExercises: matchingCompletion.completed_exercises || 0,
                duration: matchingCompletion.workout_duration || '00:00:00',
                caloriesBurned: matchingCompletion.calories_burned || 0,
                totalVolume: matchingCompletion.total_volume || 0,
                totalReps: matchingCompletion.total_reps || 0,
                completedAt: matchingCompletion.completed_at,
                weekName: matchingCompletion.week_name || '',
                cycleWeek: matchingCompletion.cycle_week || 1
              };
            }
          }
          
          setIsWorkoutCompleted(isCompletedForThisDate);
          if (isCompletedForThisDate && completedWorkoutData) {
            setCompletedWorkoutData(completedWorkoutData);
            setHasPausedWorkout(false);
            setPausedWorkout(null);
          } else {
            setCompletedWorkoutData(null);
            // Check for paused workout for this specific day
            const hasPaused = await checkForPausedWorkout(activeDay);
            if (hasPaused) {
              // Fetch the paused workout data
              const { data } = await supabase
                .from('user_paused_workouts')
                .select('*')
                .eq('user_id', user.id)
                .eq('plan_id', plan.id)
                .eq('workout_day', activeDay)
                .limit(1);
              
              if (data && data.length > 0) {
                const formattedPausedWorkout = {
                  userId: data[0].user_id,
                  planId: data[0].plan_id,
                  workoutDay: data[0].workout_day,
                  cycleWeek: data[0].cycle_week,
                  weekName: data[0].week_name,
                  exercises: data[0].exercises,
                  exerciseSets: data[0].exercise_sets,
                  workoutDuration: data[0].workout_duration,
                  totalVolume: data[0].total_volume,
                  totalReps: data[0].total_reps,
                  currentExerciseIndex: data[0].current_exercise_index,
                  originalCycleWeek: data[0].original_cycle_week,
                  pausedAt: data[0].paused_at
                };
                
                setPausedWorkout(formattedPausedWorkout);
                setHasPausedWorkout(true);
              } else {
                setHasPausedWorkout(false);
                setPausedWorkout(null);
              }
            } else {
              setHasPausedWorkout(false);
              setPausedWorkout(null);
            }
          }
        }
      } catch (err) {
        console.error('Error updating calendar data:', err);
      }
    };
    
    // Only run this effect when we have all required data
    if (plan?.id && user?.id && userWorkoutDays.length > 0) {
      updateCalendarData();
    }
  }, [plan?.id, user?.id, userWorkoutDays.length, activeDay, selectedDate, isManualDateSelection]); // Added isManualDateSelection to dependencies
  
  // Clear paused workout state when workout is completed or conditions are not met
  useEffect(() => {
    if (isWorkoutCompleted || !user?.id || !plan?.id || activeDay === null) {
      setHasPausedWorkout(false);
      setPausedWorkout(null);
    }
  }, [activeDay, isWorkoutCompleted, user?.id, plan?.id]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        {!embedded && (
          <Appbar.Header>
            <Appbar.BackAction onPress={() => router.push('/(tabs)')} />
            <Appbar.Content title="My Plan" />
          </Appbar.Header>
        )}
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.container}>
        {!embedded && (
          <Appbar.Header>
            <Appbar.BackAction onPress={() => router.push('/(tabs)')} />
            <Appbar.Content title="My Plan" />
          </Appbar.Header>
        )}
        
        <View style={styles.noPlanContainer}>
          <View style={styles.noPlanCardWrapper}>
            <LinearGradient
              colors={['rgba(31, 31, 48, 0.9)', 'rgba(18, 20, 24, 0.95)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.noPlanCard}
            >
              <PulsingIconContainer />
              
              <Text style={styles.noPlanTitle}>Ready to Begin?</Text>
              
              <View style={styles.noPlanDivider} />
              
              <Text style={styles.noPlanText}>
                Your fitness journey awaits! Choose a workout plan tailored to your goals and transform your body.
              </Text>
              
              <View style={styles.noPlanInfoBox}>
                <View style={styles.infoIconContainer}>
                  <Icon source="information-outline" size={24} color={COLORS.text} />
                </View>
                <Text style={styles.noPlanInfoText}>
                  Browse our expertly designed workout plans in the <Text style={styles.highlightText}>Discover</Text> section to get started.
                </Text>
              </View>
              
              <Button 
                mode="contained" 
                style={styles.browseButton}
                labelStyle={styles.browseButtonText}
                icon="compass"
                onPress={() => router.push('/discover')}
              >
                FIND YOUR PLAN
              </Button>
            </LinearGradient>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: embedded ? 0 : insets.top }]}>
      {/* Header */}
      {!embedded && (
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.push('/(tabs)')} />
          <Appbar.Content title="My Plan" />
          <IconButton
            icon="crown"
            iconColor="#FFD700"
            size={24}
            onPress={() => console.log('Premium feature')}
          />
        </Appbar.Header>
      )}
      
      {/* Fixed Weekly Calendar */}
      <MyPlanCalendar
        plan={plan}
        user={user}
        userWorkoutDays={userWorkoutDays}
        onDateSelect={handleCalendarDateSelect}
        completedWorkoutDays={completedWorkoutDays}
        pausedWorkoutDays={pausedWorkoutDays}
        embedded={embedded}
        initialSelectedDate={selectedDate}
        cycleProgress={cycleProgress}
      />
      
      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[
          styles.scrollContent,
          { 
            paddingBottom: insets.bottom + 150,
            paddingTop: SPACING.xs // Minimal padding at the top of content
          }
        ]}
      >
        {/* Workout Content - Show different UI based on completion status */}
        {isDateSelectionLoading ? (
          /* Loading State */
          <DateSelectionLoadingComponent />
        ) : isViewingLockedWeek ? (
          /* Locked Week View */
          <LockedWeekComponent />
        ) : activeDay !== null && getWorkoutDayByNumber(activeDay) ? (
          isWorkoutCompleted ? (
            /* Workout Completed View */
            <View style={styles.completedWorkoutContainer}>
              {/* Workout Week/Cycle Info - Centered */}
              <View style={styles.completedWorkoutHeader}>
                <Text style={styles.completedWorkoutTitle}>
                  Week {completedWorkoutData?.cycleWeek || 1}/5 - {completedWorkoutData?.weekName || 'Adaptation'}
                </Text>
              </View>
              
              {/* Modern Completed Banner */}
              <View style={styles.completionBanner}>
                <Text style={styles.completionBannerText}>WORKOUT COMPLETED</Text>
              </View>
              
              {/* Workout Stats */}
              <View style={styles.completionStatsRow}>
                <View style={[styles.completionStatItem, styles.leftStatItem]}>
                  <Text style={styles.completionStatValue}>{getWorkoutDayByNumber(activeDay)?.total_exercises || 0}</Text>
                  <Text style={styles.completionStatLabel}>EXERCISES DONE</Text>
                </View>
                
                {/* Vertical Divider */}
                <View style={styles.statDivider} />
                
                <View style={[styles.completionStatItem, styles.centerStatItem]}>
                  <Text style={[styles.completionStatValue, styles.timeValue]} numberOfLines={1}>
                    {formatDurationAsHMM(completedWorkoutData?.duration || '0:00:00')}
                  </Text>
                  <Text style={styles.completionStatLabel}>WORKOUT TIME</Text>
                </View>
                
                {/* Vertical Divider */}
                <View style={styles.statDivider} />
                
                <View style={[styles.completionStatItem, styles.rightStatItem]}>
                  <Text style={styles.completionStatValue}>{completedWorkoutData?.caloriesBurned || 0}</Text>
                  <Text style={styles.completionStatLabel}>CALORIES BURNED</Text>
                </View>
              </View>
              
              {/* Muscle Groups Worked Section */}
              <View style={styles.muscleGroupsSection}>
                <Text style={styles.muscleGroupsTitle}>MUSCLE GROUPS WORKED IN THIS WORKOUT</Text>
                
                <View style={styles.muscleGroupsLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
                    <Text style={styles.legendText}>Primary</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#CCCCCC' }]} />
                    <Text style={styles.legendText}>Secondary</Text>
                  </View>
                </View>
                
                {/* This would be replaced with your actual muscle visualization component */}
                <View style={styles.muscleVisualizationPlaceholder}>
                  <Text style={styles.placeholderText}>Muscle visualization would go here</Text>
                </View>
              </View>
              
              {/* Redo Workout Button */}
              <Button
                mode="contained"
                style={styles.redoButton}
                labelStyle={styles.redoButtonText}
                onPress={handleRedoWorkout}
              >
                REDO WORKOUT
              </Button>
            </View>
          ) : (
            /* Regular Workout View */
            <>
              <View style={styles.todaysWorkoutHeader}>
                <View style={styles.workoutTitleRow}>
                  <Text style={styles.todaysWorkoutTitle}>
                    {isSameDay(selectedDate, new Date()) 
                      ? "TODAY'S WORKOUT" 
                      : `${format(selectedDate, 'EEEE').toUpperCase()} WORKOUT`}
                  </Text>
                  <View style={styles.workoutHeaderIcons}>
                    <IconButton
                      icon="chart-timeline-variant"
                      iconColor={COLORS.primary}
                      size={24}
                      onPress={handlePlanOverviewPress}
                      style={styles.headerIconButton}
                    />
                    <IconButton
                      icon="pencil"
                      iconColor={COLORS.primary}
                      size={24}
                      onPress={handleEditPlanPress}
                      style={styles.headerIconButton}
                    />
                  </View>
                </View>
                <Text style={styles.workoutName}>{plan.subtitle || "Unknown"}</Text>
                
                {/* Cycle Week Information */}
                {cycleProgress && (
                  <View style={styles.cycleWeekContainer}>
                    <View style={styles.cycleWeekCard}>
                      {/* Header with Week Badge and Title */}
                      <View style={styles.cycleCardHeader}>
                        <View style={styles.cycleWeekBadge}>
                          <Text style={styles.cycleWeekBadgeText}>W{cycleProgress.currentWeek}</Text>
                          <Text style={styles.cycleWeekSubtext}>of 5</Text>
                        </View>
                        <View style={styles.cycleTitleSection}>
                          <Text style={styles.cycleWeekName}>{cycleProgress.weekName}</Text>
                          <Text style={styles.cyclePhaseLabel}>Training Phase</Text>
                        </View>
                      </View>
                      
                      {/* Description */}
                      <Text style={styles.cycleWeekDescription}>
                        {cycleProgress.weekDescription}
                      </Text>
                      
                      {/* Progress Section */}
                      <View style={styles.cycleProgressSection}>
                        <View style={styles.progressHeader}>
                          <Text style={styles.progressTitle}>Week Progress</Text>
                          <View style={styles.progressStats}>
                            <Text style={styles.progressNumber}>
                              {cycleProgress.completedWorkouts}
                            </Text>
                            <Text style={styles.progressDivider}>/</Text>
                            <Text style={styles.progressTotal}>
                              {cycleProgress.totalWorkoutsInCycle}
                            </Text>
                            <Text style={styles.progressLabel}>workouts</Text>
                          </View>
                        </View>
                        
                        {/* Progress Bar */}
                        <View style={styles.cycleProgressBarContainer}>
                          <View style={styles.cycleProgressBarTrack}>
                            <View 
                              style={[
                                styles.cycleProgressBarFill, 
                                { width: `${Math.min(100, cycleProgress.progressPercentage)}%` }
                              ]} 
                            />
                          </View>
                          <Text style={styles.cycleProgressPercentage}>
                            {Math.round(cycleProgress.progressPercentage)}%
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}
              </View>
              
              {/* Workout Stats and Exercises Container */}
              <View style={styles.workoutContainer}>
                {/* Workout Stats */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <IconButton icon="flash" size={16} iconColor={COLORS.primary} style={styles.statIcon} />
                    <Text style={styles.statLabel}>{getWorkoutDayByNumber(activeDay)?.total_exercises || 0} Exercises</Text>
                  </View>
                  <View style={styles.statItem}>
                    <IconButton icon="clock-outline" size={16} iconColor={COLORS.primary} style={styles.statIcon} />
                    <Text style={styles.statLabel}>{getWorkoutDayByNumber(activeDay)?.estimated_duration || 0} Min</Text>
                  </View>
                  <View style={styles.statItem}>
                    <IconButton icon="fire" size={16} iconColor={COLORS.primary} style={styles.statIcon} />
                    <Text style={styles.statLabel}>{getWorkoutDayByNumber(activeDay)?.total_calories || 0} Cal</Text>
                  </View>
                </View>
                
                {/* Exercise List */}
                <View style={styles.exercisesContainer}>
                  <FlatList
                    data={getWorkoutDayByNumber(activeDay)?.exercises || []}
                    keyExtractor={(item) => item.id}
                    renderItem={renderExerciseItem}
                    scrollEnabled={false}
                  />
                </View>
              </View>
            </>
          )
        ) : (
          <RestDayComponent />
        )}
      </ScrollView>
      
      {/* Start/Resume/Redo Workout FAB */}
      {activeDay !== null && getWorkoutDayByNumber(activeDay) && !isViewingLockedWeek && (
        isWorkoutCompleted ? (
          <Button
            mode="contained"
            style={styles.redoButton}
            labelStyle={styles.redoButtonText}
            onPress={handleRedoWorkout}
            icon="refresh"
          >
            REDO WORKOUT
          </Button>
        ) : hasPausedWorkout && pausedWorkout && pausedWorkout.workoutDay === activeDay ? (
          <FAB
            style={[styles.fab, { backgroundColor: '#FF9800' }]} // Orange color for resume button
            icon="play-pause"
            label="RESUME WORKOUT"
            onPress={handleResumeWorkout}
            color={COLORS.text}
          />
        ) : (
          <FAB
            style={styles.fab}
            icon="play"
            label="START WORKOUT"
            onPress={handleStartWorkout}
            color={COLORS.text}
          />
        )
      )}
      
      {/* Add the PausedWorkoutModal component here */}
      <PausedWorkoutModal />
      
      {/* Exercise Details Modal */}
      {selectedExercise && (
        <ExerciseDetailsModal
          visible={exerciseDetailsModalVisible}
          onClose={handleExerciseDetailsModalClose}
          exerciseId={selectedExercise.exercise_id || selectedExercise.id}
          exerciseName={selectedExercise.name}
          exerciseImage={selectedExercise.image_url}
          primary_muscles={selectedExercise.primary_muscles}
          secondary_muscles={selectedExercise.secondary_muscles}
        />
      )}

      {/* Plan Overview Modal */}
      {plan && cycleProgress && (
        <PlanOverviewModal
          visible={planOverviewModalVisible}
          onClose={handlePlanOverviewModalClose}
          planTitle={plan.title}
          planSubtitle={plan.subtitle}
          weeks={[
            { number: 1, name: 'Adaptation', color: '#4CAF50', description: 'Building foundation and proper form', days: plan.workoutDays.length },
            { number: 2, name: 'Accumulation', color: '#2196F3', description: 'Increasing training volume and intensity', days: plan.workoutDays.length },
            { number: 3, name: 'Intensification', color: '#FF9800', description: 'Peak intensity and strength focus', days: plan.workoutDays.length },
            { number: 4, name: 'Realization', color: '#9C27B0', description: 'Testing limits and achieving PRs', days: plan.workoutDays.length },
            { number: 5, name: 'Recovery', color: '#607D8B', description: 'Active recovery and preparation for next cycle', days: plan.workoutDays.length }
          ]}
          currentWeek={cycleProgress.currentWeek}
          activePlanId={plan.id}
          planWorkoutFrequency={plan.workoutDays.length}
        />
      )}
    </View>
  );
}

// Helper function to get muscle tag color
const getMuscleTagColor = (muscle: string) => {
  const colors: { [key: string]: string } = {
    chest: '#00CCFF',
    back: '#FF6666',
    biceps: '#FF66CC',
    triceps: '#CC99FF',
    shoulders: '#99CCFF',
    legs: '#FFCC66',
    glutes: '#FFCC66',
    abs: '#66FF99',
    default: '#AAAAAA'
  };
  
  const key = muscle.toLowerCase();
  return colors[key] || colors.default;
};

// Helper function to get muscle tag display name
const getMuscleTagName = (muscle: string) => {
  const muscleNames: { [key: string]: string } = {
    chest: 'Chest',
    back: 'Back',
    biceps: 'Biceps',
    triceps: 'Triceps',
    shoulders: 'Shoulders',
    legs: 'Legs',
    quads: 'Legs',
    hamstrings: 'Legs',
    calves: 'Legs',
    glutes: 'Glutes',
    abs: 'Abs',
    core: 'Abs'
  };
  
  const key = muscle.toLowerCase();
  return muscleNames[key] || muscle;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPlanContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  noPlanCardWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPlanCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    margin: SPACING.md,
    marginBottom: SPACING.lg,
    alignItems: 'center',
    width: '98%',
    maxWidth: 450,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  noPlanIconContainer: {
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
    backgroundColor: 'rgba(123, 105, 238, 0.15)',
    padding: SPACING.xl,
    borderRadius: 80,
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  noPlanTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
    letterSpacing: 0.5,
  },
  noPlanText: {
    fontSize: 16,
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  noPlanDivider: {
    height: 2,
    backgroundColor: COLORS.primary,
    width: '30%',
    marginBottom: SPACING.lg,
    borderRadius: 2,
  },
  noPlanInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    width: '100%',
  },
  infoIconContainer: {
    marginRight: SPACING.md,
  },
  noPlanInfoText: {
    color: COLORS.text,
    fontSize: 15,
    flex: 1,
    lineHeight: 22,
  },
  highlightText: {
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  browseButton: {
    marginTop: SPACING.md,
    paddingVertical: 8,
    width: '100%',
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primary,
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  browseButtonText: {
    color: COLORS.background,
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Space for FAB
  },
  workoutContainer: {
    backgroundColor: 'rgba(30, 30, 40, 0.6)',
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingTop: 0,
    paddingBottom: SPACING.xs,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  todaysWorkoutHeader: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  workoutTitleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    position: 'relative',
  },
  todaysWorkoutTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  workoutHeaderIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    right: 0,
  },
  headerIconButton: {
    margin: 0,
    marginLeft: SPACING.xs / 2,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
  },
  statIcon: {
    margin: 0,
    padding: 0,
  },
  statLabel: {
    color: COLORS.text,
    fontSize: 14,
  },
  exercisesContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BORDER_RADIUS.md,
  },
  exerciseLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  exerciseImageContainer: {
    position: 'relative',
    width: 70,
    height: 70,
    marginRight: SPACING.md,
  },
  exerciseImage: {
    width: 70,
    height: 70,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  exerciseDetails: {
    flex: 1,
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  exerciseNameClickable: {
    // Remove underline but keep the style for potential future use
  },
  exerciseSets: {
    color: COLORS.secondary,
    fontSize: 14,
  },
  muscleTag: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: SPACING.xs,
    minWidth: 65,
    alignItems: 'center',
  },
  muscleTagText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    bottom: 130,
    alignSelf: 'center',
    backgroundColor: '#7B69EE',
    elevation: 8,
    borderRadius: 30,
    width: 200,
  },
  completedBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  completedText: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  statValue: {
    color: COLORS.primary,
    fontSize: 32,
    fontWeight: 'bold',
  },
  summaryContainer: {
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
  },
  summaryTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  summaryLabel: {
    color: COLORS.text,
    fontSize: 16,
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  noWorkoutContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  noWorkoutText: {
    fontSize: 16,
    color: COLORS.secondary,
    textAlign: 'center',
  },
  // Workout completion styles
  completedWorkoutContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  completedWorkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'center', // Center the title
    alignItems: 'center',
    paddingHorizontal: SPACING.md,

  },
  completedWorkoutTitle: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  completionBanner: {
    paddingVertical: SPACING.sm, // Reduced vertical padding
    alignItems: 'center',
    marginBottom: SPACING.sm, // Reduced bottom margin
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  completionBannerText: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 1,
  },
  completionStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0, // Remove horizontal padding to allow items to move to edges
    paddingTop: SPACING.sm, // Reduced top padding
    paddingBottom: SPACING.xs, // Reduced bottom padding
    marginBottom: SPACING.xs, // Reduced bottom margin
  },
  statDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.primary,
    opacity: 0.3,
    borderRadius: 1,
  },
  completionStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  // Position the stat items
  leftStatItem: {
    paddingLeft: SPACING.md, // Add padding on the left edge
  },
  centerStatItem: {
    // Center item stays as is
  },
  rightStatItem: {
    paddingRight: SPACING.md, // Add padding on the right edge
  },
  completionStatValue: {
    color: COLORS.primary,
    fontSize: 36, // Larger font size for stat values
    fontWeight: '800',

  },
  timeValue: {
    minWidth: 120, // Increased width to ensure enough space for the time
    textAlign: 'center',
    paddingHorizontal: SPACING.xs, // Add horizontal padding
    fontVariant: ['tabular-nums'], // Use monospace numbers for better alignment
  },
  completionStatLabel: {
    color: COLORS.text,
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8, // Slightly dimmed for contrast with the values
  },
  muscleGroupsSection: {
    padding: SPACING.md,

  },
  muscleGroupsTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  muscleGroupsLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: SPACING.xs,
  },
  legendText: {
    color: COLORS.text,
    fontSize: 14,
  },
  muscleVisualizationPlaceholder: {
    height: 250,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm, // Reduced top margin
    marginBottom: SPACING.xs, // Reduced bottom margin
  },
  placeholderText: {
    color: COLORS.text,
    opacity: 0.5,
  },
  redoButton: {
    width: '50%',
    alignSelf: 'center',
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redoButtonText: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  restDayContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restDayTitle: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
  },
  restDayIconContainer: {
    marginBottom: SPACING.md,
  },
  restDayMessage: {
    color: COLORS.text,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  restDayTips: {
    alignItems: 'center',
  },
  restDayTipsTitle: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
  },
  restDayTip: {
    color: COLORS.text,
    fontSize: 14,
    marginBottom: SPACING.xs,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  pausedModalContainer: {
    width: '90%',
    maxWidth: 350,
    overflow: 'hidden',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalGradient: {
    borderRadius: BORDER_RADIUS.md,
  },
  pausedModalContent: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  pausedModalTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  pausedModalIcon: {
    alignItems: 'center',
    marginVertical: SPACING.md,
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    padding: SPACING.md,
    borderRadius: 50,
  },
  pausedModalMessage: {
    color: COLORS.text,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  pausedModalActions: {
    width: '100%',
    alignItems: 'stretch',
    gap: SPACING.md,
  },
  pausedModalResumeButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#FF9800',
    alignItems: 'center',
    elevation: 2,
  },
  pausedModalStartButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    elevation: 2,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  pausedModalCancelButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  pausedModalCancelText: {
    color: COLORS.text,
    fontWeight: '500',
    fontSize: 14,
  },
  pausedModalButtonText: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
  progressLineContainer: {
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  progressLineTrack: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressLineFill: {
    height: '100%',
    backgroundColor: '#FF9800',
    borderRadius: 4,
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 2,
  },
  progressLineText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
    marginTop: SPACING.xs,
    opacity: 0.9,
  },
  exerciseDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: SPACING.xs,
  },
  exerciseProgressContainer: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    width: '100%',
  },
  exerciseProgressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  exerciseProgressFill: {
    height: '100%',
    backgroundColor: '#FF9800',
    borderRadius: 3,
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 2,
  },
  exerciseProgressText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '500',
    marginTop: SPACING.xs,
    opacity: 0.9,
    textAlign: 'center',
  },
  exerciseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Darker overlay with opacity
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
  },
  completedIconContainer: {
    backgroundColor: 'rgba(76, 175, 79, 0.6)', // Green with opacity
    borderRadius: 30,
    padding: SPACING.md,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, // Reduced shadow opacity
    shadowRadius: 8,
    elevation: 6, // Reduced elevation
    borderWidth: 0.5, // Reduced border width
    borderColor: 'rgba(255, 255, 255, 0.2)', // More transparent border
    opacity: 0.95, // Overall opacity for the container
  },
  ongoingIconContainer: {
    backgroundColor: 'rgba(255, 152, 0, 0.6)', // Orange with opacity
    borderRadius: 30,
    padding: SPACING.md,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, // Reduced shadow opacity
    shadowRadius: 8,
    elevation: 6, // Reduced elevation
    borderWidth: 0.5, // Reduced border width
    borderColor: 'rgba(255, 255, 255, 0.2)', // More transparent border
    opacity: 0.95, // Overall opacity for the container
  },
  exerciseTextGreyed: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  muscleTagGreyed: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  muscleTagTextGreyed: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  cycleWeekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    width: '100%',
  },
  cycleWeekBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 1 }, // Reduced shadow
    shadowOpacity: 0.2, // Reduced shadow opacity
    shadowRadius: 2, // Reduced shadow radius
    elevation: 2, // Reduced elevation
    minWidth: 45, // Slightly smaller
    alignItems: 'center',
  },
  cycleWeekBadgeText: {
    color: '#FFFFFF',
    fontSize: 13, // Reduced from 14
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cycleWeekSubtext: {
    color: '#FFFFFF',
    fontSize: 9, // Reduced from 10
    fontWeight: '400',
    opacity: 0.8,
    marginTop: -2,
  },
  cycleTitleSection: {
    marginLeft: SPACING.sm, // Reduced from SPACING.md
    marginRight: 0, // Remove right margin since we're centering
  },
  cycleWeekName: {
    color: COLORS.text,
    fontSize: 16, // Reduced from 18
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 1, // Reduced from 2
  },
  cyclePhaseLabel: {
    color: COLORS.text,
    fontSize: 10, // Reduced from 11
    fontWeight: '500',
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cycleWeekDescription: {
    color: COLORS.text,
    fontSize: 12, // Reduced from 13
    fontWeight: '400',
    opacity: 0.8,
    lineHeight: 16, // Reduced from 18
    textAlign: 'center',
    marginBottom: SPACING.sm, // Reduced from SPACING.md
    paddingHorizontal: SPACING.xs,
  },
  cycleProgressSection: {
    width: '100%',
    marginTop: 0, // Reduced from SPACING.xs
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs, // Reduced from SPACING.sm
    width: '100%',
  },
  progressTitle: {
    color: COLORS.text,
    fontSize: 13, // Reduced from 14
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  progressStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  progressNumber: {
    color: COLORS.primary,
    fontSize: 15, // Reduced from 16
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  progressDivider: {
    color: COLORS.text,
    fontSize: 13, // Reduced from 14
    fontWeight: '400',
    opacity: 0.6,
    marginHorizontal: 2,
  },
  progressTotal: {
    color: COLORS.text,
    fontSize: 15, // Reduced from 16
    fontWeight: '500',
    opacity: 0.8,
  },
  progressLabel: {
    color: COLORS.text,
    fontSize: 10, // Reduced from 11
    fontWeight: '500',
    opacity: 0.7,
    marginLeft: SPACING.xs,
  },
  cycleProgressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: SPACING.xs,
  },
  cycleProgressBarTrack: {
    flex: 1,
    height: 5, // Reduced from 6
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2.5, // Adjusted for new height
    overflow: 'hidden',
  },
  cycleProgressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2.5, // Adjusted for new height
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3, // Reduced shadow opacity
    shadowRadius: 1, // Reduced shadow radius
  },
  cycleProgressPercentage: {
    color: COLORS.primary,
    fontSize: 11, // Reduced from 12
    fontWeight: '600',
    marginLeft: SPACING.sm,
    minWidth: 30, // Reduced from 35
    textAlign: 'right',
  },
  cycleWeekContainer: {
    marginBottom: -20, // Removed margin for tightest spacing
  },
  cycleWeekCard: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, // Reduced from SPACING.lg
    marginHorizontal: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, // Reduced shadow
    shadowOpacity: 0.2, // Reduced shadow opacity
    shadowRadius: 4, // Reduced shadow radius
    elevation: 3, // Reduced elevation
    overflow: 'hidden', // Match workoutContainer overflow
  },
  cycleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Changed from default to center
    marginBottom: SPACING.sm, // Reduced from SPACING.md
    width: '100%',
  },
  // Locked Week Styles
  lockedWeekContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`, // 30 is hex for ~18% opacity
  },
  lockedWeekHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  lockedIconContainer: {
    backgroundColor: `${COLORS.primary}26`, // 26 is hex for ~15% opacity
    padding: SPACING.md,
    borderRadius: 50,
    marginBottom: SPACING.md,
  },
  lockedWeekTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  lockedWeekSubtitle: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  lockedWeekContent: {
    width: '100%',
    alignItems: 'center',
  },
  lockedWeekMessage: {
    color: COLORS.text,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  lockedWeekProgress: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    width: '100%',
    alignItems: 'center',
  },
  lockedProgressTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  lockedProgressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentWeekBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    marginRight: SPACING.sm,
  },
  currentWeekBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  lockedProgressText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  lockedWeekTips: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    width: '100%',
  },
  lockedTipsTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  lockedTip: {
    color: COLORS.text,
    fontSize: 14,
    marginBottom: SPACING.xs,
    textAlign: 'center',
    lineHeight: 20,
  },
  backToCurrentWeekButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.xs,
  },
  backToCurrentWeekText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  dateSelectionLoadingContainer: {
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  dateSelectionLoadingText: {
    color: COLORS.text,
    fontSize: 16,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
}); 