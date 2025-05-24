import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, FlatList, Alert, Animated, Modal, StatusBar } from 'react-native';
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
// Define constants for layout
const HEADER_HEIGHT = 56; // Standard header height
const CALENDAR_PADDING = 120; // Large padding for calendar top
const CALENDAR_MARGIN = 0; // No margin between header and calendar

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
  
  // Calendar state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [markedDates, setMarkedDates] = useState<any>({});
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [completedWorkoutDays, setCompletedWorkoutDays] = useState<string[]>([]);
  
  // Add state to track paused workout days
  const [pausedWorkoutDays, setPausedWorkoutDays] = useState<string[]>([]);
  
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

  // Helper function to check if a specific date has a paused workout
  const checkIfDateHasPausedWorkout = async (date: Date): Promise<boolean> => {
    if (!user || !plan) return false;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const markedDateInfo = markedDates[dateStr];
    
    if (!markedDateInfo || !markedDateInfo.marked) return false;
    
    const workoutDayIndex = markedDateInfo.workoutDayIndex;
    
    try {
      const { data, error } = await supabase
        .from('user_paused_workouts')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id)
        .eq('workout_day', workoutDayIndex)
        .limit(1);
      
      return !error && data && data.length > 0;
    } catch (error) {
      console.error('Error checking for paused workout on date:', error);
      return false;
    }
  };

  // Helper function to update paused workout days for the calendar
  const updatePausedWorkoutDays = async () => {
    if (!user || !plan || !markedDates) return;
    
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
      
      // Convert workout days to date strings
      const pausedDates: string[] = [];
      Object.entries(markedDates).forEach(([dateStr, value]: [string, any]) => {
        if (value && value.workoutDayIndex !== undefined) {
          const isPaused = data.some(pausedWorkout => pausedWorkout.workout_day === value.workoutDayIndex);
          if (isPaused) {
            pausedDates.push(dateStr);
          }
        }
      });
      
      setPausedWorkoutDays(pausedDates);
    } catch (error) {
      console.error('Error updating paused workout days:', error);
      setPausedWorkoutDays([]);
    }
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
    
    // CRITICAL FIX: Reset paused workout state immediately when changing dates
    // This prevents showing stale paused workout state from previous day
    setHasPausedWorkout(false);
    setPausedWorkout(null);
    
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
          
          // Update paused workout days for calendar indicators
          await updatePausedWorkoutDays();
          
          // Update workout completion state
          setIsWorkoutCompleted(isCompleted);
          if (isCompleted && completedWorkoutData) {
            setCompletedWorkoutData(completedWorkoutData);
            // Clear paused workout state for completed workouts
            setHasPausedWorkout(false);
            setPausedWorkout(null);
          } else {
            setCompletedWorkoutData(null);
            
            // If not completed, check for paused workout for this specific day
            // Check immediately with the new workoutDayIndex
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

  // Function to check for paused workouts (used in specific contexts)
  const checkForPausedWorkout = useCallback(async (workoutDay?: number) => {
    const dayToCheck = workoutDay || activeDay;
    if (!user || !plan || dayToCheck === null) {
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
            
            // Update paused workout days for calendar indicators
            await updatePausedWorkoutDays();
            
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
  }, [plan, user, hasRefreshedCalendar, userWorkoutDays.length, activeDay]);

  // Clear paused workout state when workout is completed or conditions are not met
  useEffect(() => {
    if (isWorkoutCompleted || !user || !plan || activeDay === null) {
      setHasPausedWorkout(false);
      setPausedWorkout(null);
    }
  }, [activeDay, isWorkoutCompleted, user, plan]);

  // Update paused workout days when calendar data changes
  useEffect(() => {
    if (plan && user && markedDates && Object.keys(markedDates).length > 0) {
      updatePausedWorkoutDays();
    }
  }, [plan?.id, user?.id, markedDates]);

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

  // Update the renderExerciseStatus function to match the UI example
  const renderExerciseStatus = (exercise: Exercise, pausedWorkout: any) => {
    if (!pausedWorkout || !pausedWorkout.exercises || !pausedWorkout.exerciseSets) return null;
    
    // Find the matching exercise in the paused workout
    const pausedExerciseIndex = pausedWorkout.exercises.findIndex(
      (e: any) => e.id === exercise.id || e.exercise_id === exercise.exercise_id
    );
    
    // If exercise not found in paused workout, return null
    if (pausedExerciseIndex === -1) return null;
    
    // Check if this is the current exercise in progress
    const isCurrentExercise = pausedExerciseIndex === pausedWorkout.currentExerciseIndex;
    
    // Check if this exercise is completed (all sets are completed)
    const exerciseSets = pausedWorkout.exerciseSets[pausedWorkout.exercises[pausedExerciseIndex].id] || [];
    const isCompleted = exerciseSets.length > 0 && exerciseSets.every((set: any) => set.isCompleted);
    
    // Check if this exercise is upcoming (after current exercise)
    const isUpcoming = pausedExerciseIndex > pausedWorkout.currentExerciseIndex;
    
    if (isCompleted) {
      // Completed exercise - faded overlay with green checkmark
      return (
        <View style={styles.exerciseCompletedOverlay}>
          <View style={styles.checkmarkCircle}>
            <Icon source="check" size={20} color="#FFFFFF" />
          </View>
        </View>
      );
    } else if (isCurrentExercise) {
      // Current exercise - orange overlay with play icon
      return (
        <View style={styles.exerciseInProgressOverlay}>
          <View style={styles.currentExerciseIndicator}>
            <Icon source="play" size={18} color="#FFFFFF" />
          </View>
        </View>
      );
    } else if (isUpcoming) {
      // Upcoming exercise - no overlay (normal appearance)
      return null;
    }
    
    return null;
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
              <Text style={[
                styles.exerciseName,
                (exerciseState === 'completed' || exerciseState === 'ongoing') && styles.exerciseTextGreyed
              ]}>
                {item.name}
              </Text>
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
        
        {/* Custom divider logic */}
        {!isLastExercise && (
          <View style={styles.exerciseDivider} />
        )}
      </View>
    );
  };

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
      <View style={[
        styles.weeklyCalendarContainer,
        { 
          paddingTop: CALENDAR_PADDING,
          paddingBottom: CALENDAR_PADDING / 10,
          marginTop: embedded ? 0 : CALENDAR_MARGIN
        }
      ]}>
        <View style={styles.weekDaysRow}>
          {weekDays.map((day, index) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const hasWorkout = markedDates[dayStr]?.marked;
            const isCompleted = completedWorkoutDays.includes(dayStr);
            const isPaused = pausedWorkoutDays.includes(dayStr);
            const hasIndicator = hasWorkout || isCompleted || isPaused;
            
            return (
              <TouchableOpacity 
                key={index} 
                style={[
                  styles.weekDay, 
                  isSelected(day) && (hasIndicator ? styles.selectedWeekDay : styles.selectedWeekDayCompact)
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
                {hasWorkout && (
                  isCompleted ? (
                    <View style={isSelected(day) ? styles.selectedCheckIconContainer : styles.checkIconContainer}>
                      {isSelected(day) ? (
                        <Icon 
                          source="check-circle" 
                          size={14} 
                          color={COLORS.text} 
                        />
                      ) : (
                        <View style={styles.calendarIconBackground}>
                          <Icon 
                            source="check" 
                            size={10} 
                            color="#FFFFFF" 
                          />
                        </View>
                      )}
                    </View>
                  ) : isPaused ? (
                    <View style={isSelected(day) ? styles.selectedPauseIconContainer : styles.pauseIconContainer}>
                      {isSelected(day) ? (
                        <Icon 
                          source="pause-circle" 
                          size={14} 
                          color={COLORS.text} 
                        />
                      ) : (
                        <View style={styles.calendarPauseIconBackground}>
                          <Icon 
                            source="pause" 
                            size={10} 
                            color="#FFFFFF" 
                          />
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={[
                      styles.dayIndicator,
                      isSelected(day) && styles.selectedDayIndicator
                    ]} />
                  )
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      
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
                {/* Add Progress Line above workout stats if there's a paused workout */}
                {hasPausedWorkout && pausedWorkout && (
                  <WorkoutProgressLine pausedWorkout={pausedWorkout} />
                )}
                
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
    paddingVertical: CALENDAR_PADDING,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.background,

    zIndex: 1,
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
  selectedWeekDayCompact: {
    backgroundColor: COLORS.primary,
    elevation: 5,
    paddingTop: 0,
    height: 68, // Same as regular weekDay height
    justifyContent: 'center', // Center content when no indicators
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
  exerciseCompletedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // More faded overlay
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
  },
  exerciseInProgressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 152, 0, 0.8)', // More opaque orange overlay
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  exercisePartialOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(123, 105, 238, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
  },
  checkmarkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  currentExerciseIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  partialProgressIndicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseUpcomingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
  },
  upcomingIndicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
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
  selectedPauseIconContainer: {
    position: 'absolute',
    bottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseIconContainer: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarIconBackground: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  calendarPauseIconBackground: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
}); 