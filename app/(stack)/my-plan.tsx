import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator, TouchableOpacity, Pressable, Alert, Modal, Dimensions } from 'react-native';
import { Text, Button, IconButton, Menu, Divider, Snackbar } from 'react-native-paper';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { MenuHeader } from '../components/MenuHeader';
import supabase from '../services/supabase';
import { useAuth } from '../store/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import OptimizedImage from '../components/OptimizedImage';
import workoutPlanService from '../services/workoutPlanService';
import { MUSCLE_COLORS } from '../utils/muscleHighlighter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated from 'react-native-reanimated';
import PlanOverviewModal from '../components/PlanOverviewModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ActivePlan {  
  id: string;  
  plan_id: string;  
  name: string;  
  subtitle: string;  
  exercise_count: number;  
  duration: number;  
  calories: number;  
  accent_color: string;  
  is_active: boolean;  
  status: string | null; // 'InProgress', 'Completed', or null
  date_added: string;  
  source_type: 'default_plan' | 'single_workout' | 'custom_plan' | 'ai_plan';  
  section: 'default_plan' | 'single_workout' | 'ai_coaching' | 'custom_plan';  
  source_identifier?: string;  
  ai_prompt?: string;  
  custom_description?: string;  
  workout_frequency?: number; // Number of workout days per week in the plan
}

interface ActivePlanExercise {
  id: string;
  active_plan_id: string;
  exercise_id: string;
  name: string;
  sets: number;
  reps: string;
  rest_time: number | null;
  order_position: number;
  image_url: string | null;
  is_completed: boolean;
  muscle_group?: string;
  primary_muscles?: string[];
  weight?: string | number;
  workout_day?: number; // Which day this exercise belongs to (0 = Day 1, 1 = Day 2, etc.)
}

interface FilterOptions {
  muscles: string;
  duration: string;
  schedule: string;
}

interface MyPlanScreenProps {
  embedded?: boolean;
}

export default function MyPlanScreen({ embedded = false }: MyPlanScreenProps) {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [activePlan, setActivePlan] = useState<ActivePlan | null>(null);
  const [planExercises, setPlanExercises] = useState<ActivePlanExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [weekNumber, setWeekNumber] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(5);
  const [isStartingWorkout, setIsStartingWorkout] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [workoutDays, setWorkoutDays] = useState<string[]>([]);
  const [daysWithExercises, setDaysWithExercises] = useState<number[]>([]);
  const [planWorkoutFrequency, setPlanWorkoutFrequency] = useState(3); // Default to 3 days per week
  const [workoutDistribution, setWorkoutDistribution] = useState<{ [key: number]: number }>({});
  const [planOverviewVisible, setPlanOverviewVisible] = useState(false);
  const [weekChangeVisible, setWeekChangeVisible] = useState(false);
  const [weekProgressionData, setWeekProgressionData] = useState<{[key: string]: string}>({
    "1": "Adaptation",
    "2": "Accumulation",
    "3": "Intensification",
    "4": "Realization",
    "5": "Recovery"
  });
  const [isUpdatingWeek, setIsUpdatingWeek] = useState(false);
  
  // Updated to 5 weeks with specific phase names
  const weekPhases = [
    'Adaptation',
    'Accumulation',
    'Intensification',
    'Realization',
    'Recovery'
  ];
  
  // Filter menus state
  const [filters, setFilters] = useState<FilterOptions>({
    muscles: 'Muscles (16)',
    duration: '75-90 Min',
    schedule: 'Schedule'
  });
  const [musclesMenuVisible, setMusclesMenuVisible] = useState(false);
  const [durationMenuVisible, setDurationMenuVisible] = useState(false);
  const [scheduleMenuVisible, setScheduleMenuVisible] = useState(false);
  
  // Get the current date info for the calendar strip
  const days = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const dayMap: {[key: string]: number} = {
    'Monday': 0,
    'Tuesday': 1,
    'Wednesday': 2,
    'Thursday': 3,
    'Friday': 4,
    'Saturday': 5,
    'Sunday': 6
  };
  const today = new Date();
  const currentDay = today.getDay() === 0 ? 6 : today.getDay() - 1; // Convert to Mon=0, Sun=6
  const currentDate = today.getDate();
  
  // Load workout days from user profile details
  useEffect(() => {
    async function loadWorkoutDays() {
      if (!user) return;
      try {
        // First try to get from Supabase (source of truth)
        const { data, error } = await supabase
          .from('user_profile_details')
          .select('workout_days')
          .eq('user_id', user.id)
          .single();

        if (!error && data?.workout_days) {
          const savedDays = Array.isArray(data.workout_days) ? data.workout_days : [];
          setWorkoutDays(savedDays);
          
          // Convert workout day names to indices (0-6)
          const dayIndices = savedDays.map((day: string) => dayMap[day]).filter((index: number) => index !== undefined);
          setDaysWithExercises(dayIndices);
          
          // Update AsyncStorage to keep in sync
          await AsyncStorage.setItem('workout-days', JSON.stringify(savedDays));
          return;
        }

        // Fallback to AsyncStorage if Supabase fails or user is not logged in
        const savedDays = await AsyncStorage.getItem('workout-days');
        if (savedDays) {
          const parsedDays = JSON.parse(savedDays);
          setWorkoutDays(parsedDays);
          
          // Convert workout day names to indices (0-6)
          const dayIndices = parsedDays.map((day: string) => dayMap[day]).filter((index: number) => index !== undefined);
          setDaysWithExercises(dayIndices);
        } else {
          // Default to some days if no data found
          setDaysWithExercises([1, 3, 5]); // Tue, Thu, Sat
        }
      } catch (error) {
        console.error('Failed to load workout days:', error);
        setDaysWithExercises([1, 3, 5]); // Default to Tue, Thu, Sat on error
      }
    }
    
    loadWorkoutDays();
  }, [user]);
  
  // Initialize selectedDayIndex to currentDay
  useEffect(() => {
    // Initialize to first day with exercises, or current day if none
    if (daysWithExercises.length > 0) {
      const initialDay = daysWithExercises.includes(currentDay) 
        ? currentDay 
        : daysWithExercises[0];
      setSelectedDayIndex(initialDay);
    } else {
      setSelectedDayIndex(currentDay);
    }
  }, [daysWithExercises, currentDay]);
  
  // Calculate dates for the week
  const dates = days.map((_, index) => {
    const date = new Date(today);
    const diff = index - currentDay;
    date.setDate(currentDate + diff);
    return date.getDate();
  });

  // Check for completed workout parameter
  useEffect(() => {
    if (params.workoutCompleted === 'true') {
      setSnackbarMessage('Great job! Workout completed successfully.');
      setSnackbarVisible(true);
    }
  }, [params.workoutCompleted]);

  // Fetch active plan from Supabase
  useEffect(() => {
    async function fetchActivePlan() {
      if (!user) return;
      
      try {
        setIsLoading(true);
        setLoadError(null);
        
        // Fetch the active plan - use status='InProgress' instead of is_active=true
        const { data: plans, error } = await supabase
          .from('user_active_plans')
          .select('*, current_week, week_started_at, week_progression')
          .eq('user_id', user.id)
          .eq('status', 'InProgress')
          .limit(1)
          .single();
          
        if (error) {
          if (error.code === 'PGRST116') {
            // No active plan found (not an error)
            setActivePlan(null);
            setPlanExercises([]);
          } else {
            console.error('Error fetching active plan:', error);
            setLoadError('Failed to load your plan');
          }
          setIsLoading(false);
          return;
        }
        
        if (plans) {
          setActivePlan(plans);
          
          // Load current week from database
          if (plans.current_week) {
            setWeekNumber(plans.current_week);
          }
          
          // Load week progression data if available
          if (plans.week_progression) {
            setWeekProgressionData(plans.week_progression);
          }
          
          // Determine frequency from plan or default to 1 for testing
          const frequency = plans.workout_frequency || 1;
          console.log('Setting plan frequency to:', frequency);
          setPlanWorkoutFrequency(frequency);
          
          // Fetch exercises for this plan
          const { data: exercises, error: exercisesError } = await supabase
            .from('user_active_plan_exercises')
            .select(`
              *,
              exercises(*)
            `)
            .eq('active_plan_id', plans.id)
            .order('order_position', { ascending: true });
            
          if (exercisesError) {
            console.error('Error fetching plan exercises:', exercisesError);
            setLoadError('Failed to load exercises');
          } else {
            // Map and transform exercise data to include details from related exercise
            const formattedExercises = exercises?.map((ex, index) => {
              const exerciseDetails = ex.exercises || {};
              
              // Assign workout_day based on index and frequency
              // For a 2-day split, exercises are alternated: day 1, day 2, day 1, day 2, etc.
              const workout_day = index % frequency;
              
              return {
                ...ex,
                name: ex.name || exerciseDetails.name || 'Unknown Exercise',
                muscle_group: exerciseDetails.muscle_group || 'General',
                primary_muscles: exerciseDetails.primary_muscles || [],
                weight: ex.weight || '',
                workout_day: workout_day // Add workout_day field
              };
            }) || [];
            
            setPlanExercises(formattedExercises);
          }
        }
      } catch (error) {
        console.error('Error in fetchActivePlan:', error);
        setLoadError('An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchActivePlan();
    
    // Also refetch when planAdded param changes or workout is completed
    if (params.planAdded === 'true' || params.workoutCompleted === 'true') {
      fetchActivePlan();
    }
  }, [user, params.planAdded, params.workoutCompleted]);

  // Distribute workouts across selected days
  useEffect(() => {
    // Skip if no workout days or no plan frequency
    if (daysWithExercises.length === 0 || !activePlan) {
      return;
    }
    
    // Sort days in order (Monday = 0 to Sunday = 6)
    const sortedDays = [...daysWithExercises].sort((a, b) => a - b);
    
    // Get workout frequency (default to 1 if not specified)
    const frequency = planWorkoutFrequency;
    console.log('Current workout frequency:', frequency);
    console.log('User workout days:', sortedDays);
    
    // Create distribution mapping
    const distribution: { [key: number]: number } = {};
    
    // FIXED LOGIC: Assign only to the first N days where N is the plan frequency
    const assignDays = Math.min(frequency, sortedDays.length);
    for (let i = 0; i < assignDays; i++) {
      distribution[sortedDays[i]] = i % frequency;
    }
    
    console.log('New workout distribution:', distribution);
    setWorkoutDistribution(distribution);
    
  }, [daysWithExercises, activePlan, planWorkoutFrequency]);

  // Function to determine if a day has a workout assigned
  const hasWorkoutAssigned = (dayIndex: number): boolean => {
    return dayIndex in workoutDistribution;
  };
  
  // Function to get workout name for a specific day
  const getWorkoutNameForDay = (dayIndex: number): string => {
    if (dayIndex in workoutDistribution) {
      const workoutIndex = workoutDistribution[dayIndex];
      switch (workoutIndex) {
        case 0:
          return "Workout A";
        case 1:
          return "Workout B";
        case 2: 
          return "Workout C";
        default:
          return `Workout ${workoutIndex + 1}`;
      }
    }
    return "Rest Day";
  };

  const handleStartWorkout = async () => {
    if (!activePlan || !user || isStartingWorkout) return;
    
    try {
      setIsStartingWorkout(true);
      
      // Start a new workout session
      const session = await workoutPlanService.startWorkout(activePlan.id, user.id);
      
      if (!session) {
        Alert.alert('Error', 'Failed to start workout. Please try again.');
        setIsStartingWorkout(false);
        return;
      }
      
      // Navigate to workout screen with session data
      router.push({
        pathname: '/(stack)/workout-session',
        params: { 
          sessionId: session.id,
          planId: activePlan.id,
          planName: activePlan.name
        }
      });
    } catch (error) {
      console.error('Error starting workout:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsStartingWorkout(false);
    }
  };
  
  const handleBrowsePlans = () => {
    router.push('/discover');
  };

  const handleOpenWorkoutDaysSettings = () => {
    router.push('/(stack)/settings');
  };

  // Helper function to get plan type label for display
  const getPlanTypeLabel = (planType: string): string => {
    switch (planType) {
      case 'default_plan':
        return 'Default';
      case 'single_workout':
        return 'Single';
      case 'custom_plan':
        return 'Custom';
      case 'ai_plan':
        return 'AI Plan';
      default:
        return 'Plan';
    }
  };

  // Helper function to get badge style based on plan type
  const getPlanTypeBadgeStyle = (planType: string) => {
    switch (planType) {
      case 'default_plan':
        return { backgroundColor: COLORS.primary };
      case 'single_workout':
        return { backgroundColor: '#FF9500' };
      case 'custom_plan':
        return { backgroundColor: '#5856D6' };
      case 'ai_plan':
        return { backgroundColor: '#34C759' };
      default:
        return { backgroundColor: COLORS.primary };
    }
  };

  const renderFilterButton = (
    label: string, 
    isOpen: boolean, 
    onPress: () => void
  ) => (
    <TouchableOpacity 
      style={styles.filterButton} 
      onPress={onPress}
    >
      <Text style={styles.filterText}>{label}</Text>
      <MaterialIcons
        name={isOpen ? "arrow-drop-up" : "arrow-drop-down"}
        size={20}
        color={COLORS.text}
      />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="dumbbell" size={60} color={COLORS.primary} style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>No Active Plan</Text>
      <Text style={styles.emptyText}>
        You don't have an active workout plan yet. Browse our plans to find one that fits your goals.
      </Text>
      <Button
        mode="contained"
        style={styles.browseButton}
        onPress={handleBrowsePlans}
      >
        BROWSE PLANS
      </Button>
    </View>
  );

  // Helper function to render the REST DAY section
  const renderRestDaySection = () => (
    <View style={styles.restDayContainer}>
      <MaterialCommunityIcons 
        name="sleep" 
        size={60} 
        color={COLORS.primary} 
        style={styles.restDayIcon} 
      />
      <Text style={styles.restDayTitle}>REST DAY</Text>
      <Text style={styles.restDayText}>
        Today is your rest day. Recovery is an essential part of your fitness journey. 
        Take this time to let your muscles heal and grow stronger.
      </Text>
      <View style={styles.restDayTipsContainer}>
        <Text style={styles.restDayTipsTitle}>Rest Day Tips:</Text>
        <View style={styles.restDayTip}>
          <MaterialCommunityIcons name="water" size={16} color={COLORS.primary} />
          <Text style={styles.restDayTipText}>Stay hydrated</Text>
        </View>
        <View style={styles.restDayTip}>
          <MaterialCommunityIcons name="food-apple" size={16} color={COLORS.primary} />
          <Text style={styles.restDayTipText}>Focus on nutrition</Text>
        </View>
        <View style={styles.restDayTip}>
          <MaterialCommunityIcons name="yoga" size={16} color={COLORS.primary} />
          <Text style={styles.restDayTipText}>Light stretching can help recovery</Text>
        </View>
      </View>
    </View>
  );

  // Helper function to update current week
  const updateCurrentWeek = async (newWeekNumber: number) => {
    if (!user || !activePlan) return;
    
    try {
      setIsUpdatingWeek(true);
      
      const { error } = await supabase
        .from('user_active_plans')
        .update({
          current_week: newWeekNumber,
          week_started_at: new Date().toISOString()
        })
        .eq('id', activePlan.id);
        
      if (error) {
        console.error('Error updating week:', error);
        Alert.alert('Error', 'Failed to update week');
      } else {
        setWeekNumber(newWeekNumber);
      }
    } catch (error) {
      console.error('Error in updateCurrentWeek:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsUpdatingWeek(false);
    }
  };
  
  // Helper function to get description of week progression
  const getWeekProgressionDescription = (weekNum: number): string => {
    switch(weekNum) {
      case 1:
        return "Focus on proper form and technique. Use lighter weights to prepare your body for the upcoming weeks.";
      case 2:
        return "Increase weight or reps slightly. Focus on building volume and endurance.";
      case 3:
        return "Higher intensity with heavier weights. Focus on progressive overload.";
      case 4:
        return "Maximum effort week. Push yourself to achieve new personal records.";
      case 5:
        return "Recovery week with lighter weights but higher reps. Let your body recover for the next cycle.";
      default:
        return "Focus on consistent progress each workout.";
    }
  };
  
  // Plan overview modal
  const renderPlanOverviewModal = () => {
    const weekColors = {
      1: '#3498db', // Blue
      2: '#f1c40f', // Yellow
      3: '#e67e22', // Orange
      4: '#e74c3c', // Red
      5: '#2ecc71', // Green
    };
    
    // Create the weeks data for the modal
    const weeksData = weekPhases.map((name, index) => {
      const weekNum = index + 1;
      return {
        number: weekNum,
        name: name,
        color: weekColors[weekNum as keyof typeof weekColors] || COLORS.primary,
        description: getWeekProgressionDescription(weekNum),
        days: 2, // Assuming all weeks have 2 days
        isActive: weekNum === weekNumber
      };
    });
    
    // Handle switching to a different week
    const handleWeekPress = async (weekNum: number) => {
      if (weekNum === weekNumber) return;
      await updateCurrentWeek(weekNum);
      setPlanOverviewVisible(false);
    };
    
    return (
      <PlanOverviewModal
        visible={planOverviewVisible}
        onClose={() => setPlanOverviewVisible(false)}
        planTitle={`${activePlan?.workout_frequency || 2} Days, ${activePlan?.subtitle || 'Full Body Split'}`}
        weeks={weeksData}
        currentWeek={weekNumber}
        onWeekPress={handleWeekPress}
      />
    );
  };
  
  // Helper to get color for week indicator
  const getWeekColor = (weekNum: number): string => {
    switch (weekNum) {
      case 1: return '#3498db'; // Blue
      case 2: return '#f1c40f'; // Yellow
      case 3: return '#e67e22'; // Orange
      case 4: return '#e74c3c'; // Red
      case 5: return '#2ecc71'; // Green
      default: return COLORS.primary;
    }
  };

  return (
    <View style={styles.container}>
      {!embedded && (
        <View style={styles.headerContainer}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>My Plan</Text>
            <MaterialIcons name="arrow-drop-down" size={24} color={COLORS.text} />
            <View style={styles.headerIconsContainer}>
              <IconButton
                icon="calendar-month"
                size={24}
                iconColor={COLORS.text}
                onPress={handleOpenWorkoutDaysSettings}
              />
              {activePlan && (
                <IconButton
                  icon="information-outline"
                  size={24}
                  iconColor={COLORS.text}
                  onPress={() => setPlanOverviewVisible(true)}
                />
              )}
              <IconButton
                icon="dots-vertical"
                size={24}
                iconColor={COLORS.text}
                onPress={() => console.log('Menu pressed')}
              />
            </View>
          </View>
          
          {/* Filter buttons */}
          <View style={styles.filtersContainer}>
            {renderFilterButton(
              filters.muscles,
              musclesMenuVisible,
              () => setMusclesMenuVisible(true)
            )}
            {renderFilterButton(
              filters.duration,
              durationMenuVisible,
              () => setDurationMenuVisible(true)
            )}
            {renderFilterButton(
              filters.schedule,
              scheduleMenuVisible,
              () => setScheduleMenuVisible(true)
            )}
          </View>
        </View>
      )}
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading your plan...</Text>
        </View>
      ) : loadError ? (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={40} color={COLORS.error} />
          <Text style={styles.errorText}>{loadError}</Text>
          <Button mode="contained" onPress={() => router.push('/(tabs)/plans')}>
            BROWSE PLANS
          </Button>
        </View>
      ) : !activePlan ? (
        renderEmptyState()
      ) : (
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* Calendar Strip */}
          <View style={styles.calendarStrip}>
            {days.map((day, index) => {
              const isCurrentDay = index === currentDay;
              const isSelected = index === selectedDayIndex;
              const hasExercises = daysWithExercises.includes(index);
              const isWorkoutAssigned = hasWorkoutAssigned(index);
              
              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayItem,
                    isSelected && styles.selectedDayItem
                  ]}
                  onPress={() => setSelectedDayIndex(index)}
                >
                  <Text style={[
                    styles.dayText,
                    isSelected && styles.selectedDayText
                  ]}>
                    {day}
                  </Text>
                  <View style={styles.dateSpacing} />
                  <Text style={[
                    styles.dateText,
                    isSelected && styles.selectedDateText
                  ]}>
                    {dates[index]}
                  </Text>
                  {isWorkoutAssigned && (
                    <View style={[
                      styles.exerciseDayIndicator,
                      isSelected && styles.selectedDayIndicator,
                    ]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Check if selected day is a workout day and has a workout assigned */}
          {selectedDayIndex !== null && daysWithExercises.includes(selectedDayIndex) && hasWorkoutAssigned(selectedDayIndex) ? (
            <>
              {/* Workout Header */}
              <View style={styles.workoutHeader}>
                <View style={styles.titleRow}>
                  <Text style={styles.workoutTitle}>TODAY'S WORKOUT</Text>
                  <View style={styles.headerButtonsRow}>
                    <IconButton
                      icon="information-outline"
                      size={22}
                      style={styles.planInfoButton}
                      iconColor="#fff"
                      onPress={() => setPlanOverviewVisible(true)}
                    />
                    <IconButton
                      icon="pencil"
                      size={18}
                      style={styles.editButton}
                      iconColor="#fff"
                      onPress={() => console.log('Edit workout')}
                    />
                  </View>
                </View>
                <Text style={styles.subtitleText}>
                  {activePlan.subtitle || 'Full Body'}
                </Text>
                <Text style={styles.weekPhaseText}>
                  Week {weekNumber} - {weekPhases[weekNumber-1]}
                </Text>
              </View>

              {/* Unified workout container for stats and exercises */}
              <View style={styles.workoutContainer}>
                {/* Workout Stats - Updated to show current day stats only */}
                {(() => {
                  // Get the workout index for the selected day
                  const workoutIndex = workoutDistribution[selectedDayIndex!];
                  
                  // Filter exercises for this specific workout day
                  const dayExercises = planExercises.filter(ex => ex.workout_day === workoutIndex);
                  
                  // Calculate stats for the current day's exercises
                  const exerciseCount = dayExercises.length;
                  
                  // Calculate estimated duration: (sets * 45 seconds + (sets-1) * rest time) for each exercise
                  let totalDuration = 0;
                  let totalCalories = 0;
                  
                  dayExercises.forEach(exercise => {
                    const setsTime = exercise.sets * 45; // 45 seconds per set
                    const restTime = (exercise.sets - 1) * (exercise.rest_time || 60); // Rest time between sets
                    const exerciseDuration = setsTime + restTime;
                    
                    totalDuration += exerciseDuration;
                    // Rough calorie estimate: 10 calories per minute of exercise
                    totalCalories += Math.floor(exerciseDuration / 60 * 10);
                  });
                  
                  // Convert to minutes
                  totalDuration = Math.ceil(totalDuration / 60);
                  
                  return (
                    <View style={styles.workoutStats}>
                      <View style={styles.statItem}>
                        <MaterialCommunityIcons name="lightning-bolt" size={20} color={COLORS.primary} />
                        <Text style={styles.statText}>{exerciseCount} Exercises</Text>
                      </View>
                      <View style={styles.statItem}>
                        <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.primary} />
                        <Text style={styles.statText}>{totalDuration} Min</Text>
                      </View>
                      <View style={styles.statItem}>
                        <MaterialCommunityIcons name="fire" size={20} color={COLORS.primary} />
                        <Text style={styles.statText}>{totalCalories} Cal</Text>
                      </View>
                    </View>
                  );
                })()}
                
                {/* Exercise List */}
                <View style={styles.exercisesContainer}>
                  {planExercises.length === 0 ? (
                    <Text style={styles.noExercisesText}>No exercises in this plan</Text>
                  ) : (
                    (() => {
                      // Get the workout index for the selected day
                      const workoutIndex = workoutDistribution[selectedDayIndex!];
                      
                      // Filter exercises for this specific workout day
                      const dayExercises = planExercises.filter(ex => ex.workout_day === workoutIndex);
                      
                      if (dayExercises.length === 0) {
                        return <Text style={styles.noExercisesText}>No exercises scheduled for this day</Text>;
                      }
                      
                      return dayExercises.map((exercise, index) => (
                        <View key={exercise.id} style={styles.exerciseItem}>
                          <View style={styles.exerciseLeft}>
                            <OptimizedImage
                              source={exercise.image_url ? { uri: exercise.image_url } : require('../../assets/exercises/placeholder.jpg')}
                              style={styles.exerciseImage}
                              fallback={require('../../assets/exercises/placeholder.jpg')}
                            />
                          </View>
                          <View style={styles.exerciseMiddle}>
                            <Text style={styles.exerciseName}>{exercise.name}</Text>
                            <Text style={styles.exerciseDetails}>
                              {exercise.sets} sets × {exercise.reps} reps {exercise.weight ? `× ${exercise.weight} kg` : ''}
                            </Text>
                          </View>
                          <View style={styles.exerciseRight}>
                            <View style={[
                              styles.muscleTag, 
                              { 
                                backgroundColor: MUSCLE_COLORS[exercise.muscle_group?.toLowerCase() as keyof typeof MUSCLE_COLORS] || '#8E8E93' 
                              }
                            ]}>
                              <Text style={styles.muscleTagText}>{exercise.muscle_group || 'General'}</Text>
                            </View>
                          </View>
                        </View>
                      ));
                    })()
                  )}
                </View>
              </View>
              
              {/* Start Workout Button - Update to show loading state */}
              <TouchableOpacity
                style={styles.startButton}
                onPress={handleStartWorkout}
                disabled={isStartingWorkout}
              >
                {isStartingWorkout ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={styles.startButtonText}>START WORKOUT</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            // Rest Day Content - for both non-workout days and workout days without assigned workout
            renderRestDaySection()
          )}
        </ScrollView>
      )}

      {/* Plan Overview Modal */}
      {renderPlanOverviewModal()}
      
      {/* Filter Menus */}
      <Menu
        visible={musclesMenuVisible}
        onDismiss={() => setMusclesMenuVisible(false)}
        anchor={{ x: 0, y: 120 }}
        contentStyle={styles.menuContent}
      >
        <Menu.Item onPress={() => {
          setFilters({...filters, muscles: 'All Muscles'});
          setMusclesMenuVisible(false);
        }} title="All Muscles" />
        <Menu.Item onPress={() => {
          setFilters({...filters, muscles: 'Chest (4)'});
          setMusclesMenuVisible(false);
        }} title="Chest (4)" />
        <Menu.Item onPress={() => {
          setFilters({...filters, muscles: 'Back (5)'});
          setMusclesMenuVisible(false);
        }} title="Back (5)" />
        <Menu.Item onPress={() => {
          setFilters({...filters, muscles: 'Legs (7)'});
          setMusclesMenuVisible(false);
        }} title="Legs (7)" />
      </Menu>

      <Menu
        visible={durationMenuVisible}
        onDismiss={() => setDurationMenuVisible(false)}
        anchor={{ x: 120, y: 120 }}
        contentStyle={styles.menuContent}
      >
        <Menu.Item onPress={() => {
          setFilters({...filters, duration: '30-45 Min'});
          setDurationMenuVisible(false);
        }} title="30-45 Min" />
        <Menu.Item onPress={() => {
          setFilters({...filters, duration: '45-60 Min'});
          setDurationMenuVisible(false);
        }} title="45-60 Min" />
        <Menu.Item onPress={() => {
          setFilters({...filters, duration: '60-75 Min'});
          setDurationMenuVisible(false);
        }} title="60-75 Min" />
        <Menu.Item onPress={() => {
          setFilters({...filters, duration: '75-90 Min'});
          setDurationMenuVisible(false);
        }} title="75-90 Min" />
      </Menu>

      <Menu
        visible={scheduleMenuVisible}
        onDismiss={() => setScheduleMenuVisible(false)}
        anchor={{ x: 240, y: 120 }}
        contentStyle={styles.menuContent}
      >
        <Menu.Item onPress={() => {
          setFilters({...filters, schedule: 'Daily'});
          setScheduleMenuVisible(false);
        }} title="Daily" />
        <Menu.Item onPress={() => {
          setFilters({...filters, schedule: 'Weekly'});
          setScheduleMenuVisible(false);
        }} title="Weekly" />
        <Menu.Item onPress={() => {
          setFilters({...filters, schedule: 'Monthly'});
          setScheduleMenuVisible(false);
        }} title="Monthly" />
      </Menu>

      {/* Snackbar notification */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => setSnackbarVisible(false),
        }}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,

  },
  headerContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 0.5,
    borderBottomColor: `${COLORS.primary}40`,
    marginBottom: SPACING.md,
    zIndex: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerIconsContainer: {
    flexDirection: 'row',
    marginLeft: 'auto',
  },
  filtersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1D232F',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
  },
  filterText: {
    fontSize: 12,
    color: COLORS.text,
    marginRight: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  errorText: {
    color: COLORS.text,
    textAlign: 'center',
    marginVertical: SPACING.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  emptyIcon: {
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  browseButton: {
    marginTop: SPACING.md,
  },
  scrollView: {
    flex: 1,
    marginTop: SPACING.md,
  },
  scrollViewContent: {
    padding: SPACING.md,
    paddingTop: SPACING.sm, // Adjusted to account for removal of week indicator
    paddingBottom: SPACING.xl,
  },
  calendarStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    paddingTop: SPACING.xxl * 2.5, // Added significant padding to push below header
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    backgroundColor: 'transparent',
  },
  dayItem: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xs,
    minWidth: 40,
    position: 'relative',
    height: 70,
    borderRadius: 25,
  },
  selectedDayItem: {
    backgroundColor: COLORS.primary,
    borderRadius: 25,
    width: 40,
    height: 70,
  },
  dateSpacing: {
    height: 4, // Space between day text and date text
  },
  activeDayIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginTop: 4,
  },
  exerciseDayIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginTop: 4,
  },
  selectedDayIndicator: {
    backgroundColor: '#FFFFFF',
  },
  dayText: {
    color: COLORS.text,
    fontSize: 13,
  },
  selectedDayText: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  dateText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: 'bold',
  },
  selectedDateText: {
    color: COLORS.text,
  },
  workoutHeader: {
    marginBottom: SPACING.md,
    padding: SPACING.sm,

  },
  weekText: {
    color: COLORS.primary,
    fontSize: 13,
    marginBottom: 2,
    textAlign: 'center',
  },
  workoutTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitleText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  workoutContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 0.5,
    borderColor: `${COLORS.primary}30`,
    marginBottom: SPACING.md,
  },
  
  exercisesSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  workoutStats: {
    flexDirection: 'row',
    backgroundColor: `${COLORS.background}40`,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    width: '82%',
    alignSelf: 'center',
  },
  exercisesContainer: {
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.lg,
  },
  statText: {
    color: COLORS.text,
    marginLeft: 4,
    fontSize: 13,
  },
  exerciseItem: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    height: 80,
  },
  exerciseLeft: {
    width: 80,
    height: 80,
  },
  exerciseImage: {
    width: 80,
    height: 80,
  },
  exerciseMiddle: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
  },
  exerciseDetails: {
    color: COLORS.secondary,
    fontSize: 13,
    marginTop: 2,
  },
  exerciseRight: {
    width: 110,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: SPACING.md,
  },
  muscleTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  muscleTagText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  startButton: {
    backgroundColor: '#FFD700',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  startButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuContent: {
    backgroundColor: '#1D232F',
  },
  titleRow: {    flexDirection: 'row',    alignItems: 'center',    justifyContent: 'center',    paddingHorizontal: 0,    position: 'relative',  },  headerButtonsRow: {    flexDirection: 'row',    position: 'absolute',    right: 0,    alignItems: 'center',  },  planInfoButton: {    backgroundColor: COLORS.primary,    margin: 0,    width: 32,    height: 32,    marginRight: 6,  },  editButton: {    backgroundColor: COLORS.primary,    margin: 0,    width: 30,    height: 30,  },
  noExercisesText: {
    color: COLORS.secondary,
    textAlign: 'center',
    padding: SPACING.lg,
  },
  snackbar: {
    backgroundColor: '#34C759',
  },
  restDayContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 0.5,
    borderColor: `${COLORS.primary}30`,
    marginVertical: SPACING.lg,
    alignItems: 'center',
  },
  restDayIcon: {
    marginBottom: SPACING.md,
  },
  restDayTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  restDayText: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  restDayTipsContainer: {
    width: '100%',
    backgroundColor: `${COLORS.background}50`,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
  },
  restDayTipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  restDayTip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  restDayTipText: {
    color: COLORS.text,
    fontSize: 14,
    marginLeft: SPACING.xs,
  },
  // Week indicator styles
  weekIndicatorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: `${COLORS.surface}40`,
    borderRadius: BORDER_RADIUS.md,
  },
  weekDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  weekIndicatorText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Progression tip styles
  progressionTip: {
    backgroundColor: `${COLORS.surface}60`,
    borderLeftWidth: 3,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  progressionTipTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  progressionTipText: {
    color: `${COLORS.text}CC`,
    fontSize: 12,
  },
  
  // Week adjustment styles
  weekAdjustment: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  weekAdjustmentText: {
    fontSize: 11,
    marginLeft: 2,
  },
  
  // Plan Overview Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  planOverviewContainer: {
    width: '90%',
    maxHeight: '85%',
    backgroundColor: '#1A1E29',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: `${COLORS.primary}40`,
  },
  planOverviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: SPACING.md,
  },
  planOverviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: -SPACING.sm,
    top: -SPACING.sm,
  },
  planOverviewSubtitle: {
    fontSize: 15,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  weeksList: {
    maxHeight: 400,
    marginVertical: SPACING.sm,
  },
  weekContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: '#242936',
    borderRadius: BORDER_RADIUS.md,
  },
  activeWeekContainer: {
    backgroundColor: '#24293E',
    borderWidth: 1,
    borderColor: `${COLORS.primary}80`,
  },
  weekIndicatorColumn: {
    width: 20,
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  weekIndicator: {
    width: 4,
    height: '100%',
    borderRadius: 2,
  },
  weekContent: {
    flex: 1,
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  weekDescription: {
    fontSize: 13,
    color: '#CCC',
    marginBottom: SPACING.sm,
  },
  daysList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayPill: {
    backgroundColor: '#333845',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  planOverviewFooter: {
    fontSize: 12,
    color: '#AAA',
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    fontStyle: 'italic',
  },
  weekSwitchButton: {
    backgroundColor: `${COLORS.primary}80`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs / 2,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'center',
  },
  weekSwitchButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Week Selection Modal styles
  weekSelectionContainer: {
    width: '80%',
    backgroundColor: '#1A1E29',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: `${COLORS.primary}40`,
  },
  weekSelectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  weekSelectionOptions: {
    marginBottom: SPACING.md,
  },
  weekSelectionOption: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.xs,
    backgroundColor: '#242936',
  },
  weekSelectionOptionActive: {
    backgroundColor: `${COLORS.primary}40`,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  weekSelectionOptionText: {
    color: COLORS.text,
    fontSize: 16,
  },
  weekSelectionOptionTextActive: {
    fontWeight: 'bold',
  },
  weekSelectionCancelButton: {
    marginTop: SPACING.sm,
  },
  weekPhaseText: {
    color: COLORS.text,
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
}); 