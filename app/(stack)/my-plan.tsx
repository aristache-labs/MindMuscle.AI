import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, FlatList, Alert, Animated, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Appbar, Button, Divider, IconButton, FAB, Icon } from 'react-native-paper';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useAuth } from '../store/AuthContext';
import supabase from '../services/supabase';
import OptimizedImage from '../components/OptimizedImage';
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
  
  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userWorkoutDays, setUserWorkoutDays] = useState<number[]>([]);
  
  // Calendar state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [markedDates, setMarkedDates] = useState<any>({});
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [completedWorkoutDays, setCompletedWorkoutDays] = useState<string[]>([]);
  
  // Use a simple date array for the weekly calendar view
  const [weekDays, setWeekDays] = useState<Date[]>([]);
  
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

  // Helper function to find the workout day object by day number
  const getWorkoutDayByNumber = (dayNumber: number | null): WorkoutDay | null => {
    if (!plan || dayNumber === null) return null;
    return plan.workoutDays.find(workoutDay => workoutDay.day === dayNumber) || null;
  };

  // Fetch user's preferred workout days
  const fetchUserWorkoutDays = useCallback(async () => {
    if (!user) return;
    
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
  }, [user]);
  
  // Fetch the user's active plan
  const fetchActivePlan = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get the current workout days to pass to the service
      const currentWorkoutDays = [...userWorkoutDays];
      
      // Use the service function to fetch the active plan
      const { plan: formattedPlan, markedDates: calendarDates } = await workoutPlanService.fetchActivePlan(
        user.id,
        currentWorkoutDays
      );
      
      if (!formattedPlan) {
        setPlan(null);
        setIsLoading(false);
        return;
      }
      
      setPlan(formattedPlan);
      
      // Setup initial active day based on today's date
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      
      // IMPORTANT: Only setup calendar after we have user workout days
      if (currentWorkoutDays.length > 0 && calendarDates) {
        // Set the marked dates from the service function
        setMarkedDates(calendarDates);
        
        // Check if today is a workout day
        if (calendarDates[todayStr] && calendarDates[todayStr].marked) {
          const workoutDayIndex = calendarDates[todayStr].workoutDayIndex;
          setActiveDay(workoutDayIndex);
        } else {
          // Find the next workout day
          const nextWorkoutDate = Object.keys(calendarDates)
            .filter(date => calendarDates[date].marked && new Date(date) >= today)
            .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
            
          if (nextWorkoutDate) {
            const workoutDayIndex = calendarDates[nextWorkoutDate].workoutDayIndex;
            setActiveDay(workoutDayIndex);
          } else {
            // Default to the first workout day (now using 1-indexed values)
            setActiveDay(1);
          }
        }
      } else {
        // No user workout days available, calendar setup delayed
        // Default to the first workout day if we can't set up the calendar yet (now using 1-indexed values)
        setActiveDay(1);
      }
    } catch (err: any) {
      // Error fetching active plan
      setError('Failed to load your plan.');
      console.error('Error fetching active plan:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, userWorkoutDays]);
  
  // Setup calendar marked dates based on workout frequency and user preferences
  const setupCalendarDates = (startDate: string, totalDays: number) => {
    // Use the service function to set up calendar dates
    const markedDatesObj = workoutPlanService.setupCalendarDates(
      startDate,
      totalDays,
      userWorkoutDays,
      { primary: COLORS.primary }
    );
    
    setMarkedDates(markedDatesObj);
  };
  
  // Check if workout is already completed for the selected day and update the completed days list
  const checkWorkoutCompletion = async (workoutDayIndex = activeDay) => {
    if (!user || !plan || workoutDayIndex === null) return false;
    
    try {
      // Use the service function to check workout completion
      const { isCompleted, completedWorkoutData, completedDates } = await workoutPlanService.checkWorkoutCompletionForPlan(
        user.id,
        plan.id,
        workoutDayIndex,
        markedDates
      );
      
      // Update state with the results
      if (completedDates) {
        setCompletedWorkoutDays(completedDates);
      }
      
      if (isCompleted && completedWorkoutData) {
        // Workout is already completed
        setCompletedWorkoutData(completedWorkoutData);
        setIsWorkoutCompleted(true);
        return true;
      } else {
        // Workout is not completed
        setIsWorkoutCompleted(false);
        setCompletedWorkoutData(null);
        return false;
      }
    } catch (error) {
      // Error in checkWorkoutCompletion
      setIsWorkoutCompleted(false);
      setCompletedWorkoutData(null);
      return false;
    }
  };
  
  // Handle date selection on calendar
  const handleDateSelect = async (day: any) => {
    const selectedDay = new Date(day.timestamp);
    setSelectedDate(selectedDay);
    
    // Set loading state to prevent UI flicker
    setIsLoading(true);
    
    // Find the workout day that corresponds to this date
    if (plan) {
      // Get the marked date info for this date
      const dateStr = format(selectedDay, 'yyyy-MM-dd');
      const markedDateInfo = markedDates[dateStr];
      
      if (markedDateInfo && markedDateInfo.marked) {
        // This is a workout day - get the workout day index from the marked date
        // workoutDayIndex is already 1-indexed (1, 2, 3) as set in setupCalendarDates
        const workoutDayIndex = markedDateInfo.workoutDayIndex;
        
        
        // Set the active day to the workout day index from the marked date
        setActiveDay(workoutDayIndex);
        
        // Check if this workout is already completed and update completedWorkoutDays
        if (user) {
          const { isCompleted, completedWorkoutData, completedDates } = await workoutPlanService.checkWorkoutCompletionForPlan(
            user.id,
            plan.id,
            workoutDayIndex,
            markedDates
          );
          
          // Update the completed workout days state to maintain check icons
          if (completedDates && completedDates.length > 0) {
            setCompletedWorkoutDays(completedDates);
          }
          
          // Update workout completion state
          setIsWorkoutCompleted(isCompleted);
          if (isCompleted && completedWorkoutData) {
            setCompletedWorkoutData(completedWorkoutData);
          } else {
            setCompletedWorkoutData(null);
            
            // If not completed, check for paused workout
            await checkForPausedWorkout();
          }
        }
      } else {
        // Not a workout day - reset everything
        setActiveDay(null);
        setIsWorkoutCompleted(false);
        setCompletedWorkoutData(null);
        setHasPausedWorkout(false);
        setPausedWorkout(null);
      }
    }
    
    // Remove loading state after completion check is done
    setIsLoading(false);
  };
  
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
      const cycleData = await workoutPlanService.getActivePlanWithCycleWeek(user.id, plan.id);
      
      if (!cycleData) {
        throw new Error('Failed to get plan cycle data');
      }
      // Navigate to workout session
      router.push({
        pathname: '/(stack)/workout-session',
        params: { 
          planId: plan.id,
          workoutDay: activeDay, // This is now 1-indexed (1, 2, 3)
          cycleWeek: cycleData.currentWeek,
          weekName: cycleData.weekName
        }
      });
    } catch (err) {
      // Error starting workout
      Alert.alert('Error', 'Failed to start workout');
    }
  };
  
  // Setup weekly calendar days with current day as first
  const setupWeeklyCalendar = useCallback(() => {
    const today = new Date();
    
    // Create array of 7 days starting from today
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(today, i));
    }
    setWeekDays(days);
    setSelectedDate(today);
    
    // If we have a plan, find which workout day corresponds to today
    // This will set the activeDay using the new 1-indexed values (1, 2, 3)
    if (plan) {
      handleDateSelect({ timestamp: today.getTime() });
    }
  }, [plan]);
  
  // Function to get day abbreviation
  const getDayAbbreviation = (date: Date) => {
    // getDay returns 0-6 (0=Sunday), but our mapping is now 1-7 (1=Sunday)
    const dayOfWeek = getDay(date);
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    return days[dayOfWeek];
  };
  
  // Function to check if a date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return isSameDay(date, today);
  };
  
  // Function to check if date is selected
  const isSelected = (date: Date) => {
    return isSameDay(date, selectedDate);
  };
  
  // Function to handle date selection from weekly calendar
  const handleWeekDayPress = async (date: Date) => {
    // Skip processing if the user taps on the already selected date
    if (isSelected(date)) {
      return;
    }
    
    setSelectedDate(date);
    await handleDateSelect({ timestamp: date.getTime() });
    
    // Force refresh paused workout state after date selection
    setTimeout(() => {
      if (activeDay !== null && !isWorkoutCompleted) {
        checkForPausedWorkout();
      }
    }, 300); // Small delay to ensure state updates have completed
  };
  
  // Setup weekly calendar on initial load and when plan changes
  useEffect(() => {
    if (plan) {
      setupWeeklyCalendar();
    }
  }, [plan, setupWeeklyCalendar]);
  
  // CRITICAL FIX: Refresh calendar when component mounts or when user returns to this screen
  // This ensures the calendar always shows the correct workout days
  useEffect(() => {
    if (plan && userWorkoutDays.length > 0) {

      setupCalendarDates(plan.start_date, plan.workoutDays.length);
    }
  }, [userWorkoutDays, plan]);
  
  // First fetch user workout days, then fetch active plan
  useEffect(() => {
    // Only run this effect once when the component mounts
    const initialize = async () => {
      await fetchUserWorkoutDays();
      await fetchActivePlan();
    };
    
    initialize();
    // Remove fetchActivePlan from dependencies to prevent infinite loop
  }, [fetchUserWorkoutDays]);
  
  // Effect to refresh calendar when userWorkoutDays changes
  useEffect(() => {
    if (plan && userWorkoutDays.length > 0) {
      // Re-setup calendar dates with the updated workout days
      setupCalendarDates(plan.start_date, plan.workoutDays.length);
    }
  }, [userWorkoutDays, plan]);
  
  // Track if we've already refreshed the calendar to prevent infinite loops
  const [hasRefreshedCalendar, setHasRefreshedCalendar] = useState(false);
  
  // Reset the refresh flag when the plan or user changes
  useEffect(() => {
    if (plan && user) {
      setHasRefreshedCalendar(false);
    }
  }, [plan?.id, user?.id]);
  
  // Function to check for paused workouts for any day in the current plan
  const checkForAnyPausedWorkout = useCallback(async () => {
    if (!user || !plan) return { hasPaused: false, pausedWorkoutDay: null };
    
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

  // Add a function to check for paused workouts
  const checkForPausedWorkout = useCallback(async () => {
    if (!user || !plan || activeDay === null) return false;
    
    try {
      // Query Supabase directly for any paused workouts for this plan and day
      const { data, error } = await supabase
        .from('user_paused_workouts')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id)
        .eq('workout_day', activeDay) // Only check for the current active day
        .limit(1);
      
      if (error) {
        console.error('Error checking for paused workout:', error);
        setPausedWorkout(null);
        setHasPausedWorkout(false);
        return false;
      }
      
      if (data && data.length > 0) {
        // Format the data for the current component's state
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
        return true;
      } else {
        // No paused workout for this specific day
        setPausedWorkout(null);
        setHasPausedWorkout(false);
        return false;
      }
    } catch (error) {
      console.error('Error checking for paused workout:', error);
      setPausedWorkout(null);
      setHasPausedWorkout(false);
      return false;
    }
  }, [user?.id, plan?.id, activeDay]);

  // Add an effect to refresh the calendar and completed workouts when the component mounts
  // This is critical for updating the calendar after completing a workout
  useEffect(() => {
    // Only refresh if we have a plan, user, and haven't refreshed yet
    if (plan && user && !hasRefreshedCalendar) {
      const refreshCalendarData = async () => {
        try {
          if (!user || !plan) {
            setHasRefreshedCalendar(true);
            return;
          }
          
          // First, refresh the calendar dates with the latest user workout days
          let newMarkedDates;
          if (plan.start_date) {
            newMarkedDates = workoutPlanService.setupCalendarDates(
              plan.start_date, 
              plan.workoutDays.length, 
              userWorkoutDays
            );
            setMarkedDates(newMarkedDates);
          }
          
          // Now check for completed workouts and update the calendar
          if (activeDay !== null) {
            const { isCompleted, completedWorkoutData, completedDates } = await workoutPlanService.checkWorkoutCompletionForPlan(
              user.id,
              plan.id,
              activeDay,
              newMarkedDates || markedDates
            );
            
            // Update the completed workout days state
            if (completedDates && completedDates.length > 0) {
              setCompletedWorkoutDays(completedDates);
            }
            
            // Update workout completion state
            setIsWorkoutCompleted(isCompleted);
            if (isCompleted && completedWorkoutData) {
              setCompletedWorkoutData(completedWorkoutData);
            } else {
              setCompletedWorkoutData(null);
              
              // If workout is not completed, check for a paused workout
              await checkForPausedWorkout();
            }
          } else {
            // If no active day is selected, just get all completed workouts
            const { data: completedWorkouts, error } = await supabase
              .from('user_workout_history')
              .select('*')
              .eq('user_id', user.id)
              .eq('plan_id', plan.id);
              
            if (!error && completedWorkouts && completedWorkouts.length > 0) {
              // Create a set of completed workout days
              const completedWorkoutDays = new Set<number>();
              completedWorkouts.forEach((workout: any) => {
                completedWorkoutDays.add(workout.workout_day);
              });
              
              // Find all dates in the calendar that correspond to completed workout days
              const completedDates: string[] = [];
              Object.entries(newMarkedDates || markedDates).forEach(([dateStr, value]: [string, any]) => {
                if (value && value.workoutDayIndex !== undefined && completedWorkoutDays.has(value.workoutDayIndex)) {
                  completedDates.push(dateStr);
                }
              });
              
              // Update the completed workout days state
              setCompletedWorkoutDays(completedDates);
            }
          }
          
          // Mark that we've refreshed the calendar
          setHasRefreshedCalendar(true);
        } catch (err) {
          // Error refreshing calendar data
          console.error('Error refreshing calendar data:', err);
          // Even if there's an error, mark as refreshed to prevent infinite loops
          setHasRefreshedCalendar(true);
        }
      };
      
      // Refresh immediately
      refreshCalendarData();
    }
  // Remove markedDates from dependencies to prevent infinite loop
  // since setupCalendarDates updates markedDates, which would trigger this effect again
  }, [plan, user, hasRefreshedCalendar, userWorkoutDays.length, activeDay, checkForPausedWorkout]);

  // Add an effect to always refresh the paused workout state when activeDay changes
  useEffect(() => {
    if (user && plan && activeDay !== null && !isWorkoutCompleted) {
      checkForPausedWorkout();
    }
  }, [activeDay, isWorkoutCompleted, checkForPausedWorkout]);

  const renderExerciseItem = ({ item }: { item: Exercise }) => (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseLeftContent}>
        <OptimizedImage
          source={item.image_url ? { uri: item.image_url } : require('../../assets/exercises/placeholder.jpg')}
          style={styles.exerciseImage}
          fallback={require('../../assets/exercises/placeholder.jpg')}
          resizeMode="cover"
          cachePolicy="immutable"
          showLoader={false}
        />
        <View style={styles.exerciseDetails}>
          <Text style={styles.exerciseName}>{item.name}</Text>
          <Text style={styles.exerciseSets}>{item.sets} sets x {item.reps_range} reps</Text>
        </View>
      </View>
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

  // Add function to handle resuming paused workout
  const handleResumeWorkout = async () => {
    if (!user || !plan || !hasPausedWorkout || !pausedWorkout || activeDay === null) {
      Alert.alert('Error', 'No paused workout found for this day');
      return;
    }
    
    try {
      // Get plan data with cycle week information to ensure we have current cycle week
      const cycleData = await workoutPlanService.getActivePlanWithCycleWeek(user.id, plan.id);
      
      if (!cycleData) {
        throw new Error('Failed to get plan cycle data');
      }
      
      // Navigate to workout session with the paused workout flag and explicit day
      router.push({
        pathname: '/(stack)/workout-session',
        params: { 
          planId: plan.id,
          workoutDay: pausedWorkout.workoutDay || activeDay, // Use the day from the paused workout data
          cycleWeek: cycleData.currentWeek,
          weekName: cycleData.weekName,
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
                          
                          // Get plan data with cycle week information
                          const cycleData = await workoutPlanService.getActivePlanWithCycleWeek(user.id, plan.id);
                          
                          if (!cycleData) {
                            throw new Error('Failed to get plan cycle data');
                          }
                          
                          // Navigate directly to resume the workout
                          router.push({
                            pathname: '/(stack)/workout-session',
                            params: { 
                              planId: plan.id,
                              workoutDay: pausedWorkoutData.workout_day,
                              cycleWeek: cycleData.currentWeek,
                              weekName: cycleData.weekName,
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
                      <Icon source="play-circle" size={24} color="#000000" />
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
                          // Get plan data with cycle week information
                          const cycleData = await workoutPlanService.getActivePlanWithCycleWeek(user.id, plan.id);
                          
                          if (!cycleData) {
                            throw new Error('Failed to get plan cycle data');
                          }
                          
                          // Navigate to workout session for the current day
                          router.push({
                            pathname: '/(stack)/workout-session',
                            params: { 
                              planId: plan.id,
                              workoutDay: activeDay,
                              cycleWeek: cycleData.currentWeek,
                              weekName: cycleData.weekName,
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
                      <Icon source="dumbbell" size={24} color="#000000" />
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
      const cycleData = await workoutPlanService.getActivePlanWithCycleWeek(user.id, plan.id);
      
      if (!cycleData) {
        throw new Error('Failed to get plan cycle data');
      }
      
      // Navigate to workout session with a flag to force start
      router.push({
        pathname: '/(stack)/workout-session',
        params: { 
          planId: plan.id,
          workoutDay: activeDay,
          cycleWeek: cycleData.currentWeek,
          weekName: cycleData.weekName,
          forceStart: 'true' // Add this flag to force start even if completed
        }
      });
    } catch (err) {
      // Error restarting workout
      Alert.alert('Error', 'Failed to restart workout');
    }
  };

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
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[
          styles.scrollContent,
          { 
            paddingBottom: insets.bottom + 150,
            paddingTop: embedded ? SPACING.xxl * 2.5 : SPACING.xl
          }
        ]}
      >
        {/* Weekly Calendar */}
        <View style={[
          styles.weeklyCalendarContainer,
          embedded && { marginTop: SPACING.md } // Additional margin when embedded in tabs
        ]}>
          <View style={styles.weekDaysRow}>
            {weekDays.map((day, index) => (
              <TouchableOpacity 
                key={index} 
                style={[
                  styles.weekDay, 
                  isSelected(day) && styles.selectedWeekDay
                ]}
                onPress={() => handleWeekDayPress(day)}
              >
                <View style={styles.weekDayContent}>
                  <Text style={[
                    styles.weekDayText, 
                    isSelected(day) && styles.selectedWeekDayText
                  ]}>
                    {getDayAbbreviation(day)}
                  </Text>
                  <Text style={[
                    styles.weekDayNumber, 
                    isSelected(day) && styles.selectedWeekDayText
                  ]}>
                    {format(day, 'd')}
                  </Text>
                </View>
                {/* Add an indicator for workout days */}
                {markedDates[format(day, 'yyyy-MM-dd')]?.marked && (
                  completedWorkoutDays.includes(format(day, 'yyyy-MM-dd')) ? (
                    <View style={isSelected(day) ? styles.selectedCheckIconContainer : styles.checkIconContainer}>
                      <Icon 
                        source="check-circle" 
                        size={14} 
                        color={isSelected(day) ? COLORS.text : COLORS.primary} 
                      />
                    </View>
                  ) : (
                    <View style={[
                      styles.dayIndicator,
                      isSelected(day) && styles.selectedDayIndicator
                    ]} />
                  )
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Workout Content - Show different UI based on completion status */}
        {activeDay !== null && getWorkoutDayByNumber(activeDay) && markedDates[format(selectedDate, 'yyyy-MM-dd')]?.marked ? (
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
                <Text style={styles.todaysWorkoutTitle}>
                  {isToday(selectedDate) 
                    ? "TODAY'S WORKOUT" 
                    : `${format(selectedDate, 'EEEE').toUpperCase()} WORKOUT`}
                </Text>
                <Text style={styles.workoutName}>{plan.subtitle || "Unknown"}</Text>
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
                    renderItem={({ item, index }) => (
                      <View style={[
                        styles.exerciseCard,
                        index === (getWorkoutDayByNumber(activeDay)?.exercises?.length || 0) - 1 && { borderBottomWidth: 0 }
                      ]}>
                        <View style={styles.exerciseLeftContent}>
                          <OptimizedImage
                            source={item.image_url ? { uri: item.image_url } : require('../../assets/exercises/placeholder.jpg')}
                            style={styles.exerciseImage}
                            fallback={require('../../assets/exercises/placeholder.jpg')}
                            resizeMode="cover"
                            cachePolicy="immutable"
                            showLoader={false}
                          />
                          <View style={styles.exerciseDetails}>
                            <Text style={styles.exerciseName}>{item.name}</Text>
                            <Text style={styles.exerciseSets}>{item.sets} sets × {item.reps_range} reps</Text>
                          </View>
                        </View>
                        {/* Muscle group tag */}
                        {item.primary_muscles && item.primary_muscles.length > 0 && (
                          <View style={[
                            styles.muscleTag, 
                            { backgroundColor: getMuscleTagColor(item.primary_muscles[0]) }
                          ]}>
                            <Text style={styles.muscleTagText}>
                              {getMuscleTagName(item.primary_muscles[0])}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
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
      
      {/* Start/Resume/Redo Workout FAB - Update to show resume button when workout is paused */}
      {activeDay !== null && getWorkoutDayByNumber(activeDay) && markedDates[format(selectedDate, 'yyyy-MM-dd')]?.marked && (
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
            color={COLORS.background}
          />
        ) : (
          <FAB
            style={styles.fab}
            icon="play"
            label="START WORKOUT"
            onPress={handleStartWorkout}
            color={COLORS.background}
          />
        )
      )}
      
      {/* Add the PausedWorkoutModal component here */}
      <PausedWorkoutModal />
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
  weeklyCalendarContainer: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekDay: {
    width: 44,
    height: 68,
    borderRadius: 25,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedWeekDay: {
    backgroundColor: COLORS.primary,
    elevation: 5,
    paddingTop: 8,
    height: 75,
    justifyContent: 'flex-start',
  },
  weekDayContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 4,
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    paddingBottom: 2,
  },
  selectedWeekDayText: {
    color: COLORS.text,
  },
  dayIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    position: 'absolute',
    bottom: 2,
  },
  selectedDayIndicator: {
    backgroundColor: COLORS.text,
    bottom: 8,
  },
  checkIconContainer: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheckIconContainer: {
    position: 'absolute',
    bottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutContainer: {
    backgroundColor: 'rgba(30, 30, 40, 0.6)',
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  todaysWorkoutHeader: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  todaysWorkoutTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textAlign: 'center',
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
  },
  exerciseLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  exerciseImage: {
    width: 70,
    height: 70,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.md,
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
    color: COLORS.background,
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
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 