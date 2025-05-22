import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, FlatList, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Appbar, Button, Divider, IconButton, FAB, Icon } from 'react-native-paper';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useAuth } from '../store/AuthContext';
import supabase from '../services/supabase';
import OptimizedImage from '../components/OptimizedImage';
import { format, addDays, isSameDay, startOfWeek, getDay, addWeeks, parseISO } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import workoutPlanService from '../services/workoutPlanService';

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

// Map day strings to numeric values (0-based to match JavaScript Date.getDay)
const dayToNumberMap: { [key: string]: number } = {
  'Sunday': 0,
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6
};

// Map numeric values back to day strings
const numberToDayMap: { [key: number]: string } = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday'
};

export default function MyPlanScreen({ embedded = false }: MyPlanScreenProps) {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userWorkoutDays, setUserWorkoutDays] = useState<string[]>([]);
  
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
      // Get the user's active plan
      const { data: activePlanData, error: activePlanError } = await supabase
        .from('user_active_plans')
        .select(`
          *,
          workout_plans(
            id, 
            title, 
            difficulty_level, 
            workout_subcategories!workout_plans_subcategory_id_fkey(
              subtitle,
              title
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();
      
      if (activePlanError) {
        if (activePlanError.code === 'PGRST116') {
          // No active plan found
          setPlan(null);
          setIsLoading(false);
          return;
        }
        throw activePlanError;
      }
      
      if (!activePlanData) {
        setPlan(null);
        setIsLoading(false);
        return;
      }
      
      // Fetch the exercises for this plan
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('workout_plan_exercises')
        .select(`
          id,
          sets,
          reps_range,
          exercise_id,
          workout_day,
          exercise_name,
          exercises:exercise_id (
            id,
            name,
            image_url,
            primary_muscles
          )
        `)
        .eq('plan_id', activePlanData.plan_id)
        .order('workout_day', { ascending: true })
        .order('order', { ascending: true });
        
      if (exercisesError) throw exercisesError;
      
      // Group exercises by workout day
      const exercisesByDay: { [key: number]: Exercise[] } = {};
      exercisesData.forEach((item: any) => {
        const day = item.workout_day || 0;
        if (!exercisesByDay[day]) {
          exercisesByDay[day] = [];
        }
        
        exercisesByDay[day].push({
          id: item.id,
          name: item.exercise_name || item.exercises?.name,
          sets: item.sets,
          reps_range: item.reps_range,
          image_url: item.exercises?.image_url,
          primary_muscles: item.exercises?.primary_muscles,
          workout_day: day,
          exercise_id: item.exercises?.id
        });
      });
      
      // Convert to array of workout days with per-day statistics
      const workoutDays = Object.keys(exercisesByDay).map(dayKey => {
        const dayNum = parseInt(dayKey, 10);
        const dayExercises = exercisesByDay[dayNum];
        
        // Calculate per-day statistics based on actual exercise data
        const exerciseCount = dayExercises.length;
        
        // Calculate estimated duration based on sets, reps, and rest time
        let totalDuration = 0;
        dayExercises.forEach(exercise => {
          const sets = exercise.sets || 3;
          const repRange = exercise.reps_range || '8-12';
          
          // Parse rep range to get average reps (e.g., "8-12" -> 10)
          let avgReps = 10; // Default
          if (repRange.includes('-')) {
            const [min, max] = repRange.split('-').map(num => parseInt(num, 10));
            if (!isNaN(min) && !isNaN(max)) {
              avgReps = Math.floor((min + max) / 2);
            }
          } else if (!isNaN(parseInt(repRange, 10))) {
            avgReps = parseInt(repRange, 10);
          }
          
          // Estimate time per rep at ~2-3 seconds
          const timePerSet = avgReps * 2.5; // seconds
          
          // Rest time between sets (typically 60-90 seconds)
          const restTime = 75; // seconds
          
          // Total time for this exercise (all sets + rest between sets)
          const exerciseTime = (sets * timePerSet) + (restTime * (sets - 1));
          
          // Add to total duration (convert to minutes)
          totalDuration += exerciseTime / 60;
        });
        
        // Round up to nearest minute
        const estimatedDuration = Math.ceil(totalDuration);
        
        // Calculate calories based on duration with a more realistic formula
        // Moderate exercise burns approximately 7-10 calories per minute depending on intensity
        const calorieRate = 8.5; // calories per minute for moderate-high intensity workout
        const estimatedCalories = Math.round(estimatedDuration * calorieRate);
        
        return {
          day: dayNum,
          exercises: dayExercises,
          total_exercises: exerciseCount,
          estimated_duration: estimatedDuration,
          total_calories: estimatedCalories
        };
      }).sort((a, b) => a.day - b.day);
      
      // Format the data
      const formattedPlan: Plan = {
        id: activePlanData.workout_plans.id,
        title: activePlanData.workout_plans.title,
        difficulty_level: activePlanData.workout_plans.difficulty_level,
        subtitle: activePlanData.workout_plans.workout_subcategories?.subtitle || "Total Body Circuit",
        category_name: activePlanData.workout_plans.workout_subcategories?.title,
        workoutDays: workoutDays,
        current_day: activePlanData.current_day,
        start_date: activePlanData.start_date
      };
      
      setPlan(formattedPlan);
      
      // CRITICAL FIX: Ensure we have user workout days before setting up the calendar
      // This prevents the calendar from showing incorrect workout days initially
      if (userWorkoutDays.length === 0) {

        await fetchUserWorkoutDays();
      }
      
      // Log the user's preferred workout days to verify

      
      // Setup initial active day based on today's date
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      
      // IMPORTANT: Only setup calendar after we have user workout days
      // This ensures the calendar always shows the correct workout days
      if (userWorkoutDays.length > 0) {

        setupCalendarDates(activePlanData.start_date, workoutDays.length);
        
        // After setupCalendarDates is called, we need to wait for the state to update
        setTimeout(() => {
          // Check if today is a workout day
          if (markedDates[todayStr] && markedDates[todayStr].marked) {
            const workoutDayIndex = markedDates[todayStr].workoutDayIndex;
            setActiveDay(workoutDayIndex);

          } else {
            // Find the next workout day
            const nextWorkoutDate = Object.keys(markedDates)
              .filter(date => markedDates[date].marked && new Date(date) >= today)
              .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
              
            if (nextWorkoutDate) {
              const workoutDayIndex = markedDates[nextWorkoutDate].workoutDayIndex;
              setActiveDay(workoutDayIndex);

            } else {
              // Default to the first workout day
              setActiveDay(0);

            }
          }
        }, 100); // Increased timeout to ensure state updates
      } else {
        // No user workout days available, calendar setup delayed
        // Default to the first workout day if we can't set up the calendar yet
        setActiveDay(0);
      }
    } catch (err: any) {
      // Error fetching active plan
      setError('Failed to load your plan.');
    } finally {
      setIsLoading(false);
    }
  }, [user, userWorkoutDays.length, fetchUserWorkoutDays]);
  
  // Setup calendar marked dates based on workout frequency and user preferences
  const setupCalendarDates = (startDate: string, totalDays: number) => {
    const start = new Date(startDate);
    const markedDatesObj: any = {};
    
    // Mark today's date
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    markedDatesObj[todayStr] = {
      selected: true,
      selectedColor: COLORS.primary,
    };
    
    // If user has no workout day preferences or the array is empty, default to consecutive days
    if (!userWorkoutDays || userWorkoutDays.length === 0) {
      // Original logic for consecutive days
      for (let i = 0; i < totalDays; i++) {
        const date = format(addDays(start, i), 'yyyy-MM-dd');
        markedDatesObj[date] = {
          ...markedDatesObj[date],
          marked: true,
          dotColor: COLORS.primary,
          workoutDayIndex: i % totalDays
        };
        
        // If this is today, merge with today's style
        if (date === todayStr) {
          markedDatesObj[date] = {
            ...markedDatesObj[date],
            selected: true,
            selectedColor: COLORS.primary,
          };
        }
      }
    } else {
      // CRITICAL FIX: Completely new approach for workout day mapping

      
      // Convert user workout days to day numbers (0-6, where 0 is Sunday)
      const preferredDays = userWorkoutDays
        .map(day => dayToNumberMap[day])
        .filter(day => day !== undefined);
      
      if (preferredDays.length === 0) {
        // No valid workout days found in user preferences
        return;
      }
      

      
      // Get today's day of week (0-6, Sunday-Saturday)
      const todayDayOfWeek = today.getDay();

      
      // Check if today is a preferred workout day
      const isTodayWorkoutDay = preferredDays.includes(todayDayOfWeek);

      
      // Create a reordered list of preferred days starting with today if today is a workout day
      // or starting with the next workout day if today is not a workout day
      let orderedWorkoutDays: number[] = [];
      
      if (isTodayWorkoutDay) {
        // Start with today's workout day
        const todayIndex = preferredDays.indexOf(todayDayOfWeek);
        
        // Reorder the workout days to start with today
        orderedWorkoutDays = [
          ...preferredDays.slice(todayIndex),
          ...preferredDays.slice(0, todayIndex)
        ];
      } else {
        // Find the next workout day after today
        const nextWorkoutDayIndex = preferredDays.findIndex(day => day > todayDayOfWeek);
        
        if (nextWorkoutDayIndex !== -1) {
          // Reorder starting with the next workout day
          orderedWorkoutDays = [
            ...preferredDays.slice(nextWorkoutDayIndex),
            ...preferredDays.slice(0, nextWorkoutDayIndex)
          ];
        } else {
          // If no workout day is after today, start with the first workout day next week
          orderedWorkoutDays = [...preferredDays];
        }
      }
      

      
      // Create a direct mapping from workout_day indices to day numbers
      const workoutDayToDayNumber: Record<number, number> = {};
      orderedWorkoutDays.forEach((dayNumber, index) => {
        workoutDayToDayNumber[index] = dayNumber;
      });
      

      
      // Mark workout days on the calendar for the next several weeks
      const weeksToShow = 4;
      
      for (let weekOffset = 0; weekOffset < weeksToShow; weekOffset++) {
        // For each workout day in the plan
        for (let workoutDay = 0; workoutDay < totalDays; workoutDay++) {
          // Get the day of week for this workout day
          const dayOfWeek = workoutDayToDayNumber[workoutDay % orderedWorkoutDays.length];
          
          // Calculate the date for this workout day
          let targetDate = new Date(today);
          
          // Calculate days to add to reach this day of week
          let daysToAdd = dayOfWeek - todayDayOfWeek;
          
          // If the day is earlier in the week than today, move to next week
          if (daysToAdd < 0) daysToAdd += 7;
          
          // Add weeks offset
          daysToAdd += weekOffset * 7;
          
          // Calculate the final date
          targetDate = addDays(targetDate, daysToAdd);
          
          // Only include dates on or after the start date
          if (targetDate >= start) {
            const dateStr = format(targetDate, 'yyyy-MM-dd');
            
            markedDatesObj[dateStr] = {
              ...markedDatesObj[dateStr],
              marked: true,
              dotColor: COLORS.primary,
              // This is the critical mapping - use the workout day directly
              workoutDayIndex: workoutDay % totalDays
            };
            
            // Log for debugging

            
            // If this is today, merge with today's style
            if (dateStr === todayStr) {
              markedDatesObj[dateStr] = {
                ...markedDatesObj[dateStr],
                selected: true,
                selectedColor: COLORS.primary,
              };
            }
          }
        }
      }
    }
    
    setMarkedDates(markedDatesObj);
  };
  
  // Check if workout is already completed for the selected day and update the completed days list
  const checkWorkoutCompletion = async (workoutDayIndex = activeDay) => {
    if (!user || !plan || workoutDayIndex === null) return false;
    
    try {

      
      // First, try to directly query the database to see all records for this plan and user
      const { data: allWorkouts, error: allWorkoutsError } = await supabase
        .from('user_workout_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id);
        

      
      // Now check if there's a completed workout for this specific day
      // The workout_day in the database is stored as the same index as in the markedDates
      // This is a 0-based index (0, 1, 2) that corresponds to workout days (Day 1, Day 2, Day 3)
      
      // Fetch all completed workouts for this plan to update the completedWorkoutDays list
      const { data: allCompletedWorkouts, error: allCompletedError } = await supabase
        .from('user_workout_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id);
        
      if (!allCompletedError && allCompletedWorkouts) {
        // Map of workout day indices to their corresponding dates in the calendar
        const workoutDayMap: Record<number, string[]> = {};
        
        // Build a map of workout day indices to their dates
        Object.entries(markedDates).forEach(([dateStr, value]: [string, any]) => {
          if (value.workoutDayIndex !== undefined) {
            if (!workoutDayMap[value.workoutDayIndex]) {
              workoutDayMap[value.workoutDayIndex] = [];
            }
            workoutDayMap[value.workoutDayIndex].push(dateStr);
          }
        });
        

        
        // Get today's date
        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');
        
        // Create a list of dates that have completed workouts
        const completedDates: string[] = [];
        
        allCompletedWorkouts.forEach(workout => {
          const workoutDay = workout.workout_day;
          const dates = workoutDayMap[workoutDay] || [];
          
          // If today is one of the dates for this workout day, prioritize it
          if (dates.includes(todayStr)) {
            completedDates.push(todayStr);
          } 
          // Otherwise use the closest date to today
          else if (dates.length > 0) {
            // Sort dates by proximity to today
            const sortedDates = [...dates].sort((a, b) => {
              const diffA = Math.abs(new Date(a).getTime() - today.getTime());
              const diffB = Math.abs(new Date(b).getTime() - today.getTime());
              return diffA - diffB;
            });
            
            completedDates.push(sortedDates[0]);
          }
        });
        
        setCompletedWorkoutDays(completedDates);

      }
      

      
      const { data, error } = await supabase
        .from('user_workout_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id)
        .eq('workout_day', workoutDayIndex);


      
      if (error) {
        // Error checking workout completion
        return false;
      }
      
      if (data && data.length > 0) {
        // Workout is already completed, get the most recent one
        const mostRecentWorkout = data.sort((a, b) => 
          new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
        )[0];
        

        
        // Get the count of exercises from the user_exercise_records table
        const { data: exerciseData, error: exerciseError } = await supabase
          .from('user_exercise_records')
          .select('exercise_id')
          .eq('workout_history_id', mostRecentWorkout.id)
          .limit(1000);
        
        if (exerciseError) {
          // Error fetching exercise records
        }
        

        
        // Get workout duration from the database
        const workoutDuration = mostRecentWorkout.workout_duration || '00:00';
        
        // Get the count of exercises from the workout history record or fall back to the plan data
        const exercisesCount = mostRecentWorkout.exercises_count;
        const currentWorkoutDay = plan.workoutDays.find(day => day.day === workoutDayIndex);
        const totalExercisesInDay = currentWorkoutDay ? currentWorkoutDay.total_exercises : 0;
        


        
        // Set completed workout data - prioritize the exercises_count field if available
        setCompletedWorkoutData({
          completedExercises: exercisesCount || totalExercisesInDay || (exerciseData ? new Set(exerciseData.map(item => item.exercise_id)).size : 0),
          duration: workoutDuration,
          caloriesBurned: mostRecentWorkout.calories_burned || 0,
          totalVolume: mostRecentWorkout.total_volume || 0,
          totalReps: mostRecentWorkout.total_reps || 0,
          completedAt: mostRecentWorkout.completed_at,
          weekName: mostRecentWorkout.week_name,
          cycleWeek: mostRecentWorkout.cycle_week
        });
        
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
        const workoutDayIndex = markedDateInfo.workoutDayIndex;
        
        // Set the active day to the workout day index from the marked date
        setActiveDay(workoutDayIndex);
        // Selected workout day: workoutDayIndex + 1 (1-based)
        
        // Check if this workout is already completed
        await checkWorkoutCompletion(workoutDayIndex);
      } else {
        setActiveDay(null);
        setIsWorkoutCompleted(false);
        setCompletedWorkoutData(null);

      }
    }
    
    // Remove loading state after completion check is done
    setIsLoading(false);
  };
  
  const handleStartWorkout = async () => {
    if (!plan || activeDay === null || !user) return;
    
    try {
      // Check if workout is already completed
      const isCompleted = await checkWorkoutCompletion();
      
      if (isCompleted) {

        return; // Don't navigate, show completion info in the current screen
      }
      
      // Get plan data with cycle week information
      const cycleData = await workoutPlanService.getActivePlanWithCycleWeek(user.id, plan.id);
      
      if (!cycleData) {
        throw new Error('Failed to get plan cycle data');
      }
      
      // Navigate to workout session
      router.push({
        pathname: '/(stack)/workout-session',
        params: { 
          planId: plan.id,
          workoutDay: activeDay,
          cycleWeek: cycleData.currentWeek,
          weekName: cycleData.weekName
        }
      });
    } catch (err) {
      // Error starting workout
      Alert.alert('Error', 'Failed to start workout');
    }
  };
  
  // Function to restart a completed workout
  const handleRedoWorkout = async () => {
    if (!plan || activeDay === null || !user) return;
    
    try {
      // Get plan data with cycle week information
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
    if (plan) {
      handleDateSelect({ timestamp: today.getTime() });
    }
  }, [plan]);
  
  // Function to get day abbreviation
  const getDayAbbreviation = (date: Date) => {
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
    fetchUserWorkoutDays().then(() => {
      fetchActivePlan();
    });
  }, [fetchUserWorkoutDays, fetchActivePlan]);
  
  // Track if we've already refreshed the calendar to prevent infinite loops
  const [hasRefreshedCalendar, setHasRefreshedCalendar] = useState(false);
  
  // Add an effect to refresh the calendar and completed workouts when the component mounts
  // This is critical for updating the calendar after completing a workout
  useEffect(() => {
    // Only refresh if we have a plan, user, and haven't refreshed yet
    if (plan && user && !hasRefreshedCalendar) {
      const refreshCalendarData = async () => {

        
        try {
          // First, fetch the latest completed workouts from the database
          const { data: completedWorkouts, error } = await supabase
            .from('user_workout_history')
            .select('*')
            .eq('user_id', user.id)
            .eq('plan_id', plan.id);
            
          if (error) {
            // Error fetching completed workouts
          } else if (completedWorkouts) {
            // Update the completed workout days list
            const completedDates: string[] = [];
            
            // For each completed workout, find the corresponding dates in the calendar
            Object.entries(markedDates).forEach(([dateStr, value]: [string, any]) => {
              if (value.workoutDayIndex !== undefined) {
                // Check if this date's workout day index matches any completed workout
                const isCompleted = completedWorkouts.some(
                  workout => workout.workout_day === value.workoutDayIndex
                );
                
                if (isCompleted) {
                  completedDates.push(dateStr);
                }
              }
            });
            
            // Update the completed workout days state
            setCompletedWorkoutDays(completedDates);

          }
          
          // Refresh the calendar dates with the latest data
          if (userWorkoutDays.length > 0) {
            setupCalendarDates(plan.start_date, plan.workoutDays.length);
          }
          
          // Check workout completion for the current active day
          if (activeDay !== null) {
            checkWorkoutCompletion(activeDay);
          }
          
          // Mark that we've refreshed the calendar
          setHasRefreshedCalendar(true);
        } catch (err) {
          // Error refreshing calendar data
        }
      };
      
      // Refresh immediately
      refreshCalendarData();
    }
  }, [plan, user, hasRefreshedCalendar, userWorkoutDays.length, markedDates, activeDay]);
  
  // Reset the refresh flag when the plan or user changes
  useEffect(() => {
    if (plan && user) {
      setHasRefreshedCalendar(false);
    }
  }, [plan?.id, user?.id]);
  
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

  // Function to navigate to settings to set workout preferences
  const navigateToWorkoutSettings = () => {
    router.push('/(stack)/settings');
  };
  
  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        {!embedded && (
          <Appbar.Header>
            <Appbar.BackAction onPress={() => router.back()} />
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
            <Appbar.BackAction onPress={() => router.back()} />
            <Appbar.Content title="My Plan" />
          </Appbar.Header>
        )}
        <View style={styles.noPlanContainer}>
          <Text style={styles.noPlanTitle}>No Active Plan</Text>
          <Text style={styles.noPlanText}>
            You currently don't have an active workout plan. Visit the Plans section to choose a plan.
          </Text>
          <Button 
            mode="contained" 
            style={styles.browseButton}
            onPress={() => router.push('/discover')}
          >
            BROWSE PLANS
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: embedded ? 0 : insets.top }]}>
      {!embedded && (
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
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
            paddingBottom: insets.bottom + 150, // Increased from 100 to 150 for more space
            paddingTop: embedded ? SPACING.xxl * 2.5 : SPACING.xl // Increased padding in both modes
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
        {activeDay !== null && activeDay < plan.workoutDays.length && markedDates[format(selectedDate, 'yyyy-MM-dd')]?.marked ? (
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
                  <Text style={styles.completionStatValue}>{plan.workoutDays[activeDay].total_exercises}</Text>
                  <Text style={styles.completionStatLabel}>EXERCISES DONE</Text>
                </View>
                
                {/* Vertical Divider */}
                <View style={styles.statDivider} />
                
                <View style={[styles.completionStatItem, styles.centerStatItem]}>
                  <Text style={[styles.completionStatValue, styles.timeValue]} numberOfLines={1}>
                    {completedWorkoutData?.duration ? completedWorkoutData.duration.split(':').slice(0, 2).join(':') : '00:00'}
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
                    <Text style={styles.statLabel}>{plan.workoutDays[activeDay].total_exercises} Exercises</Text>
                  </View>
                  <View style={styles.statItem}>
                    <IconButton icon="clock-outline" size={16} iconColor={COLORS.primary} style={styles.statIcon} />
                    <Text style={styles.statLabel}>{plan.workoutDays[activeDay].estimated_duration} Min</Text>
                  </View>
                  <View style={styles.statItem}>
                    <IconButton icon="fire" size={16} iconColor={COLORS.primary} style={styles.statIcon} />
                    <Text style={styles.statLabel}>{plan.workoutDays[activeDay].total_calories} Cal</Text>
                  </View>
                </View>
                
                {/* Prompt to set workout preferences if user hasn't done so yet */}
                {userWorkoutDays.length === 0 && plan && (
                  <View style={styles.preferencesPromptContainer}>
                    <Text style={styles.promptTitle}>Set Your Workout Days</Text>
                    <Text style={styles.promptText}>
                      Please set your preferred workout days to properly schedule your workouts.
                    </Text>
                    <Button 
                      mode="contained" 
                      onPress={navigateToWorkoutSettings}
                      style={styles.promptButton}
                      labelStyle={styles.promptButtonText}
                    >
                      Set Workout Days
                    </Button>
                  </View>
                )}
                
                {/* Exercise List */}
                <View style={styles.exercisesContainer}>
                  <FlatList
                    data={plan.workoutDays[activeDay].exercises}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item, index }) => (
                      <View style={[
                        styles.exerciseCard,
                        index === plan.workoutDays[activeDay].exercises.length - 1 && { borderBottomWidth: 0 }
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
          <View style={styles.noWorkoutContainer}>
            <Text style={styles.noWorkoutText}>
              No workout scheduled for this day.
            </Text>
          </View>
        )}
      </ScrollView>
      
      {/* Start/Redo Workout FAB */}
      {activeDay !== null && activeDay < plan.workoutDays.length && markedDates[format(selectedDate, 'yyyy-MM-dd')]?.marked && (
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
  // Styles for workout preferences prompt
  preferencesPromptContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    margin: SPACING.md,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  promptTitle: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
  },
  promptText: {
    color: COLORS.text,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  promptButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.sm,
  },
  promptButtonText: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  noPlanTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  noPlanText: {
    fontSize: 16,
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  browseButton: {
    marginTop: SPACING.md,
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
}); 