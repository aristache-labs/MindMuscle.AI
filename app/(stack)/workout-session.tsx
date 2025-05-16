import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator, Text, Alert, TouchableOpacity, Platform, Image, TextInput, Animated, PanResponder, Keyboard, KeyboardAvoidingView } from 'react-native';
import { Button, IconButton, Surface, useTheme } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNetwork } from '../store/NetworkContext';
import supabase from '../services/supabase';
import { useAuth } from '../store/AuthContext';
import OptimizedImage from '../components/OptimizedImage';
import workoutPlanService from '../services/workoutPlanService';
import { MUSCLE_COLORS } from '../utils/muscleHighlighter';
import { STORAGE_BUCKETS } from '../components/SplashScreenManager';
// Import debug helpers
import { createComponentLogger } from '../utils/debugHelpers';

// Create a logger for workout session
const logger = createComponentLogger('WORKOUT_SESSION');

// Add interface for set data
interface ExerciseSet {
  set: number;
  weight: number;
  reps: number;
}

interface ExerciseHistoryEntry {
  sets_completed: number;
  total_volume: number;
  sets_data: ExerciseSet[];
}

export default function WorkoutSessionScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const { isConnected, isInternetReachable } = useNetwork();
  
  const [isLoading, setIsLoading] = useState(true);
  const [exercises, setExercises] = useState<any[]>([]);
  const [currentExercise, setCurrentExercise] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [exerciseHistory, setExerciseHistory] = useState<{[key: string]: ExerciseHistoryEntry}>({});
  const [totalVolume, setTotalVolume] = useState(0);
  const [totalReps, setTotalReps] = useState(0);
  
  // Timer state
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [startTime] = useState(new Date());
  
  // Keyboard handling
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Rest timer has been removed
  
  // Add input state for active set
  const [activeSetInput, setActiveSetInput] = useState({ weight: '', reps: '' });
  const [activeSet, setActiveSet] = useState(1);
  const [completedSets, setCompletedSets] = useState<number[]>([]);

  // Use state to store max weight info
  const [maxWeightInfo, setMaxWeightInfo] = useState<{ weight: number; reps: number; date: string } | null>(null);
  
  // Add state to store previous set data
  const [previousSetData, setPreviousSetData] = useState<{[key: string]: {weight: string|number, reps: string|number}}>({});

  // Pan responder for timer has been removed

  useEffect(() => {
    // Load exercises
    loadExercises();
    
    // Reset exercise tracking
    resetExerciseTracking();

    // Start workout timer
    const interval = setInterval(() => {
      if (isTimerRunning) {
        setElapsedTime(Math.floor((new Date().getTime() - startTime.getTime()) / 1000));
      }
    }, 1000);
    
    // Setup keyboard listeners
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      clearInterval(interval);
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Add a function to initialize the UI with sample data for demonstrating set tracking
  useEffect(() => {
    if (exercises.length > 0 && !isLoading) {
      // Set the first set as active and make sure no sets are marked as completed
      resetExerciseTracking();
      
      // Initialize input with previous values if available
      if (exercises[0]) {
        // Try to get the last weight used for this exercise
        const lastData = getLastSetData(exercises[0].exercise_id || exercises[0].id);
        if (lastData.weight > 0) {
          setActiveSetInput({
            weight: lastData.weight.toString(),
            reps: lastData.reps.toString()
          });
        } else {
          // Otherwise clear the inputs
          setActiveSetInput({ weight: '', reps: '' });
        }
      }
      
      // Debug: Log this event to see if this code runs
      logger.debug('Initializing exercise set tracking', () => ({
        exerciseCount: exercises.length,
        activeSet: 1,
        completedSets: []
      }));
    }
  }, [exercises, isLoading]);

  // Calculate total volume and reps whenever exerciseHistory changes
  useEffect(() => {
    let volume = 0;
    let reps = 0;
    
    Object.keys(exerciseHistory).forEach(exerciseId => {
      const history = exerciseHistory[exerciseId];
      if (history && history.sets_data && Array.isArray(history.sets_data)) {
        // Calculate volume by summing weight * reps for each set
        history.sets_data.forEach(set => {
          // Make sure we have valid numbers
          const setWeight = set.weight || 0;
          const setReps = set.reps || 0;
          
          // Add to totals
          volume += setWeight * setReps;
          reps += setReps;
        });
      }
    });
    
    // Set states with calculated totals
    setTotalVolume(volume);
    setTotalReps(reps);
    
    logger.debug('Updated workout totals:', () => ({
      totalVolume: volume,
      totalReps: reps,
      exerciseCount: Object.keys(exerciseHistory).length
    }));
  }, [exerciseHistory]);

  // Rest timer has been removed

  // Helper function to process exercise image URLs
  const processImageUrl = (imageUrl: string | null | undefined): string | null => {
    if (!imageUrl) return null;
    
    // If image URL already starts with http, return it as is
    if (imageUrl.startsWith('http')) return imageUrl;
    
    // Check if it's one of our fallback images
    const fallbackImages = ['fullbody.jpg', 'dumbbell.jpg', 'pushup.jpg', 'squat.jpg', 'yoga.jpg', 'placeholder.jpg'];
    if (fallbackImages.includes(imageUrl)) return imageUrl;
    
    // Otherwise assume it's in Firebase storage and construct the URL
    const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    const filePath = `${STORAGE_BUCKETS.EXERCISES}/${imageUrl}`;
    return `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(filePath)}?alt=media&key=${apiKey}`;
  };

  const loadExercises = async () => {
    if (!params.planId) return;
    
    try {
      // Reset exercise history to make sure we start fresh
      setExerciseHistory({});
      setCompletedSets([]);
      setActiveSet(1);
      
      // Get the workout day from params (if not provided, default to 0)
      const workoutDay = params.workoutDay ? parseInt(params.workoutDay as string, 10) : 0;
      
      logger.debug('Starting to load exercises for active plan', () => ({ 
        planId: params.planId, 
        workoutDay 
      }));
      
      // Since we're in the workout session, we should be loading from user_active_plan_exercises
      // instead of workout_plan_exercises
      const { data: exerciseList, error } = await supabase
        .from('user_active_plan_exercises')
        .select(`
          *,
          exercises(*)
        `)
        .eq('active_plan_id', params.planId as string)
        .eq('workout_day', workoutDay)
        .order('order_position', { ascending: true });
      
      if (error) {
        logger.error('Error loading exercises:', error);
        Alert.alert('Error', 'Failed to load workout exercises. Please try again.');
        setIsLoading(false);
        return;
      }
      
      logger.debug(`Loaded ${exerciseList?.length || 0} exercises for day ${workoutDay}`);
      
      if (exerciseList && exerciseList.length > 0) {
        // Map exercise data to include details
        const formattedExercises = exerciseList.map(ex => {
          const exerciseDetails = ex.exercises || {};
          
          // Process the image URL
          const imageUrl = processImageUrl(ex.image_url || exerciseDetails.image_url);
          
          return {
            id: ex.id,
            exercise_id: ex.exercise_id,
            name: ex.name || exerciseDetails.name || 'Unknown Exercise',
            image_url: imageUrl,
            sets: ex.sets || 3,
            reps: ex.reps || '8-12',
            equipment: exerciseDetails.equipment || 'None',
            muscle_group: exerciseDetails.muscle_group || 'General',
            primary_muscles: exerciseDetails.primary_muscles || [],
            secondary_muscles: exerciseDetails.secondary_muscles || [],
            instructions: exerciseDetails.instructions || [],
            rest_time: ex.rest_time || 60,
            order: ex.order_position || 0,
            workout_day: workoutDay
          };
        });
        
        setExercises(formattedExercises);
        return;
      }
      
      // If no exercises found for the specific day, try loading all exercises and group by day
      logger.debug('No exercises found for specific day, trying to load all exercises');
      
      const { data: allExercises, error: allError } = await supabase
        .from('user_active_plan_exercises')
        .select(`
          *,
          exercises(*)
        `)
        .eq('active_plan_id', params.planId as string)
        .order('order_position', { ascending: true });
        
      if (allError) {
        logger.error('Error loading all exercises:', allError);
        Alert.alert('Error', 'Failed to load workout exercises. Please try again.');
        setIsLoading(false);
        return;
      }
      
      if (allExercises && allExercises.length > 0) {
        logger.debug(`Found ${allExercises.length} exercises across all days`);
        
        // Group exercises by workout day
        const exercisesByDay = allExercises.reduce((groups: {[key: number]: any[]}, exercise) => {
          const day = exercise.workout_day !== undefined ? exercise.workout_day : 0;
          if (!groups[day]) {
            groups[day] = [];
          }
          groups[day].push(exercise);
          return groups;
        }, {});
        
        // Get available days from the exercises
        const daysWithExercises = Object.keys(exercisesByDay).map(Number).sort();
        logger.debug('Days with exercises:', () => ({ days: daysWithExercises }));
        
        if (daysWithExercises.length > 0) {
          // If the requested day exists, use it; otherwise use the first available day
          const dayToUse = daysWithExercises.includes(workoutDay) ? 
            workoutDay : daysWithExercises[0];
            
          // Format the exercises for the selected day
          const selectedDayExercises = exercisesByDay[dayToUse].map(ex => {
            const exerciseDetails = ex.exercises || {};
            
            // Process the image URL
            const imageUrl = processImageUrl(ex.image_url || exerciseDetails.image_url);
            
            return {
              id: ex.id,
              exercise_id: ex.exercise_id,
              name: ex.name || exerciseDetails.name || 'Unknown Exercise',
              image_url: imageUrl,
              sets: ex.sets || 3,
              reps: ex.reps || '8-12',
              equipment: exerciseDetails.equipment || 'None',
              muscle_group: exerciseDetails.muscle_group || 'General',
              primary_muscles: exerciseDetails.primary_muscles || [],
              secondary_muscles: exerciseDetails.secondary_muscles || [],
              instructions: exerciseDetails.instructions || [],
              rest_time: ex.rest_time || 60,
              order: ex.order_position || 0,
              workout_day: dayToUse
            };
          });
          
          setExercises(selectedDayExercises);
          
          if (dayToUse !== workoutDay) {
            Alert.alert(
              "Using Different Workout Day", 
              `No exercises found for day ${workoutDay + 1}. Showing exercises for day ${dayToUse + 1} instead.`,
              [{ text: "OK" }]
            );
          }
        } else {
          Alert.alert(
            "No Exercises Found", 
            "Could not identify workout days in this plan. Please check your plan configuration.",
            [{ text: "OK", onPress: () => router.back() }]
          );
        }
      } else {
        Alert.alert(
          "No Exercises Found", 
          "No exercises found for this workout plan. Please check your plan configuration.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      }
    } catch (error) {
      logger.error('Error loading exercises:', error);
      Alert.alert("Error", "Failed to load workout exercises. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };



  const getLastSetData = (exerciseId: string) => {
    const history = exerciseHistory[exerciseId];
    if (!history || !history.sets_data || history.sets_data.length === 0) {
      return { weight: 0, reps: 0 };
    }
    
    const lastSet = history.sets_data[history.sets_data.length - 1];
    return {
      weight: lastSet?.weight ?? 0,
      reps: lastSet?.reps ?? 0
    };
  };

  const handleLogAllSets = async () => {
    if (!params.sessionId || !user || !currentExerciseData) return;
    
    // For each set in the current exercise, mark it as completed
    try {
      const totalSets = currentExerciseData.sets || 0;
      // Make sure we're using the actual exercise_id, not the entry id
      const actualExerciseId = currentExerciseData.exercise_id || currentExerciseData.id;
      
      logger.debug(`Logging all sets for exercise: ${actualExerciseId}, Total sets: ${totalSets}`);
      
      for (let i = 0; i < totalSets; i++) {
        const setNumber = i + 1;
        // Default values or get from inputs
        const weight = requiresWeights(currentExerciseData) ? 0 : 0; // We would need input fields to capture this
        const reps = 8; // Default to a reasonable number or parse from reps range
        
        await workoutPlanService.logExerciseSet(
          params.sessionId as string,
          actualExerciseId,
          setNumber,
          { weight, reps }
        );
      }
      
      // If this is the last exercise, finish the workout
      if (currentExercise === exercises.length - 1) {
        handleFinishWorkout();
      } else {
        // Move to next exercise
        setCurrentExercise(prev => prev + 1);
      }
    } catch (error) {
      logger.error('Error logging all sets:', error);
      Alert.alert('Error', 'Failed to log sets. Please try again.');
    }
  };

  const handleFinishWorkout = async () => {
    if (!params.sessionId || !user) return;

    try {
      // Update session status
      const { error } = await supabase
        .from('workout_sessions')
        .update({
          end_time: new Date().toISOString(),
          total_duration: elapsedTime,
          calories_burned: Math.floor(elapsedTime / 60 * 6.5), // Rough estimate
          status: 'completed'
        })
        .eq('id', params.sessionId);

      if (error) throw error;
      
      router.back();
    } catch (error) {
      logger.error('Error completing workout:', error);
      Alert.alert('Error', 'Failed to save workout. Will sync when online.');
    }
  };

  // Function to get color for muscle group tag
  const getMuscleColor = (muscleGroup: string): string => {
    if (!muscleGroup) return COLORS.primary;
    
    // Convert to lowercase for case-insensitive matching
    const lowerMuscle = muscleGroup.toLowerCase();
    
    // Look up in the MUSCLE_COLORS map
    return MUSCLE_COLORS[lowerMuscle] || COLORS.primary;
  };

  // Function to check if an exercise requires weights
  const requiresWeights = (exercise: any): boolean => {
    if (!exercise) return false;
    
    // Check equipment to determine if weights are needed
    const equipment = exercise.equipment?.toLowerCase() || '';
    const noWeightEquipment = ['none', 'bodyweight', 'mat', 'pull-up bar', 'resistance band'];
    
    // If exercise is specifically marked as bodyweight, or has equipment that doesn't need weights
    if (equipment && noWeightEquipment.some(e => equipment.includes(e))) {
      return false;
    }
    
    // Check if the name contains bodyweight exercise keywords
    const bodyweightKeywords = ['push-up', 'pushup', 'pull-up', 'pullup', 'dip', 'plank', 
      'crunch', 'sit-up', 'situp', 'squat', 'lunge', 'burpee', 'mountain climber'];
    
    if (exercise.name && bodyweightKeywords.some(keyword => 
      exercise.name.toLowerCase().includes(keyword))) {
      // If it's a squat but has barbell/dumbbell in the name, it does require weights
      if (exercise.name.toLowerCase().includes('squat') && 
         (exercise.name.toLowerCase().includes('barbell') || 
          exercise.name.toLowerCase().includes('dumbbell'))) {
        return true;
      }
      return false;
    }
    
    // Default to true for safety - most exercises use weights
    return true;
  };

  // Function to calculate max weight lifted for current exercise
  const getMaxWeightLifted = async (exerciseId: string): Promise<{ weight: number; reps: number; date: string } | null> => {
    if (!user || !exerciseId) return null;
    
    try {
      // Check if the getMaxWeightLifted function exists in the service
      if (typeof workoutPlanService.getMaxWeightLifted === 'function') {
        // Get max weight lifted from our service
        const result = await workoutPlanService.getMaxWeightLifted(user.id, exerciseId);
        
        if (result) {
          return result;
        }
      } else {
        // Function doesn't exist yet, log this for debugging
        logger.warn('workoutPlanService.getMaxWeightLifted function is not available yet');
      }
      
      // If no personal records found or function doesn't exist, return default values
      return {
        weight: 0,
        reps: 0,
        date: new Date().toISOString().split('T')[0]
      };
    } catch (error) {
      logger.error('Error getting max weight lifted:', error);
      
      // Return default values if there's an error
      return {
        weight: 0,
        reps: 0,
        date: new Date().toISOString().split('T')[0]
      };
    }
  };

  // Rest timer functions have been removed

  // Function to handle when user completes a set by pressing "Did It"
  const handleDidItPress = async () => {
    if (!currentExerciseData) return;

    try {
      const actualExerciseId = currentExerciseData.exercise_id || currentExerciseData.id;
      
      // Get the previous set data for this exercise and set
      const setKey = `${actualExerciseId}_${activeSet}`;
      const prevData = previousSetData[setKey] || { weight: '0', reps: '0' };
      
      // Check if user entered a new weight or if we should use previous weight
      let weight = 0;
      if (activeSetInput.weight && activeSetInput.weight.trim() !== '') {
        // User entered a new weight
        const parsedWeight = parseInt(activeSetInput.weight.trim(), 10);
        weight = isNaN(parsedWeight) ? 0 : parsedWeight;
      } else if (prevData.weight !== '-' && prevData.weight !== undefined && prevData.weight !== null) {
        // Use previous weight if available and valid
        const parsedPrevWeight = typeof prevData.weight === 'string' ? parseInt(prevData.weight, 10) : prevData.weight;
        weight = isNaN(parsedPrevWeight) ? 0 : parsedPrevWeight;
      }
      
      // Check if user entered new reps or if we should use previous reps
      let reps = 0;
      if (activeSetInput.reps && activeSetInput.reps.trim() !== '') {
        // User entered new reps
        const parsedReps = parseInt(activeSetInput.reps.trim(), 10);
        reps = isNaN(parsedReps) ? 0 : parsedReps;
      } else if (prevData.reps !== '-' && prevData.reps !== undefined && prevData.reps !== null) {
        // Use previous reps if available and valid
        const parsedPrevReps = typeof prevData.reps === 'string' ? parseInt(prevData.reps, 10) : prevData.reps;
        reps = isNaN(parsedPrevReps) ? 0 : parsedPrevReps;
      } else if (currentExerciseData.reps) {
        // As a fallback, try to extract a reasonable value from the reps range (e.g., "6-8" becomes 7)
        const repsRange = currentExerciseData.reps.split('-');
        if (repsRange.length > 1) {
          const minReps = parseInt(repsRange[0], 10);
          const maxReps = parseInt(repsRange[1], 10);
          if (!isNaN(minReps) && !isNaN(maxReps)) {
            reps = Math.round((minReps + maxReps) / 2);
          } else {
            reps = 8; // Default if parsing fails
          }
        } else {
          reps = parseInt(repsRange[0], 10) || 8;
        }
      } else {
        reps = 8; // Default reps
      }
      
      logger.debug(`Did It pressed: Exercise ${actualExerciseId}, Set ${activeSet}, Weight ${weight}, Reps ${reps}`);
      
      // Make a direct call to the workoutPlanService to record this set
      await workoutPlanService.logExerciseSet(
        params.sessionId as string,
        actualExerciseId,
        activeSet,
        { weight, reps }
      );
      
      // Directly log to exercise history in our local state too - this ensures the UI updates
      // even if the database operation has issues
      setExerciseHistory(prev => {
        const newHistory = { ...prev };
        if (!newHistory[actualExerciseId]) {
          newHistory[actualExerciseId] = {
            sets_completed: 0,
            total_volume: 0,
            sets_data: []
          };
        }
        
        // Ensure sets_data exists and is an array
        if (!newHistory[actualExerciseId].sets_data || !Array.isArray(newHistory[actualExerciseId].sets_data)) {
          newHistory[actualExerciseId].sets_data = [];
        }
        
        // Add new set data
        const newSet: ExerciseSet = {
          set: activeSet,
          weight,
          reps
        };
        
        // Update or add set - with proper null check
        const setIndex = newHistory[actualExerciseId].sets_data.findIndex((s: ExerciseSet) => s.set === activeSet);
        if (setIndex >= 0) {
          newHistory[actualExerciseId].sets_data[setIndex] = newSet;
        } else {
          newHistory[actualExerciseId].sets_data.push(newSet);
          newHistory[actualExerciseId].sets_completed++;
        }
        
        // Recalculate total volume
        newHistory[actualExerciseId].total_volume = newHistory[actualExerciseId].sets_data.reduce(
          (sum: number, set: ExerciseSet) => sum + (set.weight * set.reps),
          0
        );
        
        return newHistory;
      });
      
      // Mark this set as completed
      setCompletedSets(prev => [...prev, activeSet]);
      
      // Check if there are more sets for this exercise
      if (activeSet < (currentExerciseData.sets || 0)) {
        // Advance to the next set
        setActiveSet(activeSet + 1);
        // No rest timer - we removed it
      } else {
        // Last set of this exercise completed
        // Show a brief success message
        Alert.alert(
          "Exercise Completed", 
          "All sets for this exercise are complete! Moving to the next exercise.",
          [{ 
            text: "OK", 
            onPress: () => {
              // If this is the last exercise, ask to finish the workout
              if (currentExercise >= exercises.length - 1) {
                Alert.alert(
                  "Workout Complete", 
                  "You've completed all exercises in this workout. Would you like to finish?",
                  [
                    { text: "Keep going", style: "cancel" },
                    { text: "Finish Workout", onPress: handleFinishWorkout }
                  ]
                );
              } else {
                // Move to the next exercise
                setCurrentExercise(prevIndex => prevIndex + 1);
                // Reset active set and completed sets for the new exercise
                setActiveSet(1);
                setCompletedSets([]);
              }
            }
          }]
        );
      }
    } catch (error) {
      logger.error('Error in handleDidItPress:', error);
      
      // Even if there's an error, add the set to local state so the UI updates correctly
      try {
        const actualExerciseId = currentExerciseData.exercise_id || currentExerciseData.id;
        
        // Get the previous set data for this exercise and set
        const setKey = `${actualExerciseId}_${activeSet}`;
        const prevData = previousSetData[setKey] || { weight: '0', reps: '0' };
        
              // Check if user entered a new weight or if we should use previous weight
      let weight = 0;
      if (activeSetInput.weight && activeSetInput.weight.trim() !== '') {
        // User entered a new weight
        const parsedWeight = parseInt(activeSetInput.weight.trim(), 10);
        weight = isNaN(parsedWeight) ? 0 : parsedWeight;
      } else if (prevData.weight !== '-' && prevData.weight !== undefined && prevData.weight !== null) {
        // Use previous weight if available and valid
        const parsedPrevWeight = typeof prevData.weight === 'string' ? parseInt(prevData.weight, 10) : prevData.weight;
        weight = isNaN(parsedPrevWeight) ? 0 : parsedPrevWeight;
      }
      
      // Check if user entered new reps or if we should use previous reps
      let reps = 0;
      if (activeSetInput.reps && activeSetInput.reps.trim() !== '') {
        // User entered new reps
        const parsedReps = parseInt(activeSetInput.reps.trim(), 10);
        reps = isNaN(parsedReps) ? 0 : parsedReps;
      } else if (prevData.reps !== '-' && prevData.reps !== undefined && prevData.reps !== null) {
        // Use previous reps if available and valid
        const parsedPrevReps = typeof prevData.reps === 'string' ? parseInt(prevData.reps, 10) : prevData.reps;
        reps = isNaN(parsedPrevReps) ? 0 : parsedPrevReps;
      } else {
        reps = 8; // Default
        }
        
        // Update local state to reflect the set
        setExerciseHistory(prev => {
          const newHistory = { ...prev };
          if (!newHistory[actualExerciseId]) {
            newHistory[actualExerciseId] = {
              sets_completed: 0,
              total_volume: 0,
              sets_data: []
            };
          }
          
          const newSet: ExerciseSet = {
            set: activeSet,
            weight,
            reps
          };
          
          // Add or update the set
          const setIndex = newHistory[actualExerciseId].sets_data.findIndex((s: ExerciseSet) => s.set === activeSet);
          if (setIndex >= 0) {
            newHistory[actualExerciseId].sets_data[setIndex] = newSet;
          } else {
            newHistory[actualExerciseId].sets_data.push(newSet);
            newHistory[actualExerciseId].sets_completed++;
          }
          
          // Recalculate total volume
          newHistory[actualExerciseId].total_volume = newHistory[actualExerciseId].sets_data.reduce(
            (sum: number, set: ExerciseSet) => sum + (set.weight * set.reps),
            0
          );
          
          return newHistory;
        });
        
        // Mark this set as completed
        setCompletedSets(prev => [...prev, activeSet]);
        
        // Show a warning but allow continuing
        Alert.alert(
          "Warning", 
          "There was an error saving your set data. Your progress for this workout has been saved locally, but may not sync with the server.",
          [{ text: "Continue Anyway", style: "default" }]
        );
        
        // Move to next set or exercise as appropriate
        if (activeSet < (currentExerciseData.sets || 0)) {
          setActiveSet(activeSet + 1);
        } else if (currentExercise < exercises.length - 1) {
          setCurrentExercise(prev => prev + 1);
          setActiveSet(1);
          setCompletedSets([]);
        }
      } catch (stateError) {
        // Last resort error handling
        logger.error('Error updating local state:', stateError);
        Alert.alert('Error', 'Failed to record your set. Please try again.');
      }
    }
  };

  // Add a function to handle redoing a set
  const handleRedoSet = async (setNumber: number) => {
    if (!currentExerciseData) return;
    
    try {
      // Make the selected set the active set
      setActiveSet(setNumber);
      
      // Remove this set from completed sets
      setCompletedSets(prev => prev.filter(set => set !== setNumber));
      
      // Get the last data for this set if available
      const lastSetData = getLastSetData(currentExerciseData.exercise_id || currentExerciseData.id);
      
      // Pre-fill the input with the last values
      setActiveSetInput({
        weight: lastSetData.weight.toString() || '',
        reps: lastSetData.reps.toString() || ''
      });
      
      logger.debug(`Redoing set ${setNumber} for exercise ${currentExerciseData.id}`);
    } catch (error) {
      logger.error('Error in handleRedoSet:', error);
      Alert.alert('Error', 'Failed to redo this set. Please try again.');
    }
  };
  
  // Handle input focus to scroll to the active set
  const handleInputFocus = (setNumber: number, inputType: 'weight' | 'reps') => {
    setActiveSet(setNumber);
    
    // Schedule a scroll to the active set after a short delay
    // This ensures the view has updated before we try to scroll
    setTimeout(() => {
      // Find the ref of the set we want to scroll to
      const setY = setNumber * 130; // Approximate height of a set card
      
      // Scroll to the position, with offset to account for header
      scrollViewRef.current?.scrollTo({
        y: setY - 150, // Offset to show the input field above the keyboard
        animated: true
      });
    }, 100);
  };

  // Add a function to check if a set is completed
const isSetCompleted = (setNumber: number) => {
  // Only return true if the set is explicitly in our completedSets array
  return completedSets.includes(setNumber);
};

  // Add a function to determine if a set is active
  const isSetActive = (setNumber: number) => {
    return setNumber === activeSet;
  };

  // Add debugging to check exercise history
  useEffect(() => {
    if (Object.keys(exerciseHistory).length > 0) {
      logger.debug('Exercise history updated:', () => exerciseHistory);
    }
  }, [exerciseHistory]);

  // Add a function to reset the exercise tracking state
  const resetExerciseTracking = () => {
    setExerciseHistory({});
    setCompletedSets([]);
    setActiveSet(1);
    logger.debug('Exercise tracking state has been reset');
  };

  // Helper to get data for a specific set number (weight & reps)
  const getSetData = (exerciseId: string, setNumber: number) => {
    const history = exerciseHistory[exerciseId];
    if (!history || !history.sets_data) {
      return { weight: '-', reps: '-' } as const;
    }
    const data = history.sets_data.find((s: ExerciseSet) => s.set === setNumber);

    const formattedWeight = data && data.weight && data.weight > 0 ? data.weight : '-';
    const formattedReps = data && data.reps && data.reps > 0 ? data.reps : '-';

    return {
      weight: formattedWeight,
      reps: formattedReps,
    } as const;
  };

  // Helper function to extract a rep value from a rep range string (e.g. "8-12" becomes 10)
  const extractRepValue = (repRange: string | undefined): string => {
    if (!repRange) return "-";
    
    // Check if it contains a hyphen (range)
    if (repRange.includes('-')) {
      const [min, max] = repRange.split('-').map(val => parseInt(val.trim(), 10));
      // If we have valid min and max values, return the average
      if (!isNaN(min) && !isNaN(max)) {
        return Math.round((min + max) / 2).toString();
      }
    }
    
    // Try to extract a single number
    const singleValue = parseInt(repRange.trim(), 10);
    if (!isNaN(singleValue)) {
      return singleValue.toString();
    }
    
    // Default fallback
    return "-";
  };

  // Add function to get previous workout data for a specific set
  const getPreviousSetData = async (exerciseId: string, setNumber: number) => {
    if (!user) return { weight: '-', reps: '-' };
    try {
      // Query for previous workout data for this specific exercise and set
      const { data, error } = await supabase
        .from('user_exercises_history')
        .select('weight, reps')
        .eq('user_id', user.id)
        .eq('exercise_id', exerciseId)
        .eq('set_number', setNumber)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error || !data || data.length === 0) {
        logger.debug(`No previous data found for exercise ${exerciseId}, set ${setNumber}`);
        return { weight: '-', reps: '-' };
      }
      
      // Ensure we have valid numeric values
      const weight = data[0].weight || 0;
      const reps = data[0].reps || 0;
      
      // Only return if we have positive values
      if (weight <= 0 && reps <= 0) {
        return { weight: '-', reps: '-' };
      }
      
      logger.debug(`Found previous data for exercise ${exerciseId}, set ${setNumber}: weight=${weight}, reps=${reps}`);
      
      return {
        weight: weight > 0 ? weight.toString() : '-',
        reps: reps > 0 ? reps.toString() : '-'
      };
    } catch (error) {
      logger.error('Error getting previous set data:', error);
      return { weight: '-', reps: '-' };
    }
  };

  // Reset the input fields whenever we change to a new exercise
  useEffect(() => {
    if (exercises.length === 0) return;
    const current = exercises[currentExercise];
    if (!current) return;

    // Reset active set input
    setActiveSetInput({ weight: '', reps: '' });
    
    // We'll let the UI use previous history data automatically, 
    // rather than prefilling the input, so the user can see what they did last time
    // but still make a conscious decision to use the same values
    // Reset set counters
    setActiveSet(1);
    setCompletedSets([]);

    // Fetch max weight info for this exercise
    if (user && current) {
      const actualExerciseId = current.exercise_id || current.id;
      
      const fetchMaxWeight = async () => {
        try {
          const maxWeight = await getMaxWeightLifted(actualExerciseId);
          setMaxWeightInfo(maxWeight);
        } catch (error) {
          logger.error('Error fetching max weight:', error);
          // Set default values if there's an error
          setMaxWeightInfo({
            weight: 0,
            reps: 0,
            date: new Date().toISOString().split('T')[0]
          });
        }
      };
      
      // Load previous set data for all sets of this exercise
      const fetchPreviousSetData = async () => {
        try {
          // Reset previous set data
          setPreviousSetData({});
          
          // Get total sets for this exercise
          const totalSets = current.sets || 0;
          const newPreviousData: {[key: string]: {weight: string|number, reps: string|number}} = {};
          
          logger.debug(`Fetching previous set data for exercise ${actualExerciseId} (${totalSets} sets)`);
          
          // Fetch data for each set
          for (let i = 1; i <= totalSets; i++) {
            const prevData = await getPreviousSetData(actualExerciseId, i);
            // Create a unique key for each set
            const setKey = `${actualExerciseId}_${i}`;
            newPreviousData[setKey] = prevData;
            
            logger.debug(`Set ${i} previous data:`, () => ({ 
              weight: prevData.weight, 
              reps: prevData.reps,
              hasData: prevData.weight !== '-' || prevData.reps !== '-'
            }));
          }
          
          setPreviousSetData(newPreviousData);
          logger.debug('Loaded previous set data', () => ({
            exerciseId: actualExerciseId,
            setCount: Object.keys(newPreviousData).length,
            hasData: Object.values(newPreviousData).some(data => data.weight !== '-' || data.reps !== '-')
          }));
        } catch (error) {
          logger.error('Error fetching previous set data:', error);
          // Set empty previous data
          setPreviousSetData({});
        }
      };
      
      fetchMaxWeight();
      fetchPreviousSetData();
    }
  }, [currentExercise, exercises, user]);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (exercises.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.errorText}>No exercises found for this workout day.</Text>
        <Button 
          mode="contained" 
          style={{ marginTop: SPACING.lg }}
          onPress={() => router.back()}
        >
          Go Back
        </Button>
      </View>
    );
  }

  const currentExerciseData = exercises[currentExercise];
  const nextExerciseData = currentExercise < exercises.length - 1 ? exercises[currentExercise + 1] : null;

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <StatusBar style="light" />
      
      {/* Header */}
      <Surface style={styles.header}>
        <View style={styles.headerInner}>
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
              <Text style={styles.headerButtonText}>Exit</Text>
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>
              EXERCISE {currentExercise + 1}/{exercises.length}
            </Text>
            
            <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/exercises')}>
              <Text style={styles.headerButtonText}>Exercises</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Surface>

      {/* Stats Bar */}
      <Surface style={styles.statsBar}>
        <View style={styles.statsBarInner}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Time</Text>
            <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Volume</Text>
            <Text style={styles.statValue}>{totalVolume} kg</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Reps</Text>
            <Text style={styles.statValue}>{totalReps}</Text>
          </View>
        </View>
      </Surface>

      <ScrollView 
        style={styles.content}
        ref={scrollViewRef}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: keyboardVisible ? 300 : 20, // Add extra padding when keyboard is visible
        }}>
        {/* Exercise Info */}
        <View style={styles.exerciseCard}>
          <View style={styles.exerciseHeader}>
            <OptimizedImage
              source={currentExerciseData?.image_url ? { uri: currentExerciseData.image_url } : require('../../assets/exercises/placeholder.jpg')}
              style={styles.exerciseImage}
              fallback={require('../../assets/exercises/placeholder.jpg')}
              resizeMode="cover"
            />
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName}>{currentExerciseData?.name}</Text>
              <View style={[styles.muscleTag, { backgroundColor: getMuscleColor(currentExerciseData?.muscle_group) }]}>
                <Text style={styles.muscleTagText}>
                  {currentExerciseData?.muscle_group?.toUpperCase() || 'GENERAL'}
                </Text>
              </View>
            </View>
          </View>
          
          {/* Max Weight Lifted */}
          <View style={styles.maxWeightContainer}>
            <Text style={styles.maxWeightTitle}>Max Weight Lifted</Text>
            <Text style={styles.maxWeightValue}>{maxWeightInfo?.weight || 0} kg</Text>
            <Text style={styles.maxWeightDetail}>{maxWeightInfo?.reps || 0} reps</Text>
            <Text style={styles.maxWeightDate}>{maxWeightInfo?.date || '-'}</Text>
            
            {/* Progress Bar */}
            <View style={styles.maxWeightProgress}>
              <View 
                style={[
                  styles.maxWeightFill, 
                  { 
                    width: maxWeightInfo && maxWeightInfo.weight > 0 ? '70%' : '0%' 
                  }
                ]} 
              />
            </View>
          </View>
        </View>

        {/* Active set will now be rendered within the list itself */}



        {/* Generate set cards for this exercise */}
        {Array.from({ length: currentExerciseData?.sets || 0 }).map((_, index) => {
          const setNumber = index + 1;
          const isCompleted = isSetCompleted(setNumber);
          const isActive = isSetActive(setNumber);
          
          // Get previous set data if available
          const prevSetData = previousSetData[`${currentExerciseData.exercise_id || currentExerciseData.id}_${setNumber}`] || { weight: '-', reps: '-' };
          const hasPrevHistory = prevSetData.weight !== '-' && prevSetData.reps !== '-';
          
          // Show suggested value only if no history exists and max weight info exists
          const showSuggested = !hasPrevHistory && maxWeightInfo && maxWeightInfo.weight > 0;
          
          // Prioritize: 1. User input 2. Previous history 3. Max weight info
          const prefillWeight = activeSetInput.weight !== '' ? 
                               activeSetInput.weight : 
                               (hasPrevHistory ? prevSetData.weight.toString() : 
                               (showSuggested ? maxWeightInfo.weight.toString() : ''));
                               
          const prefillReps = activeSetInput.reps !== '' ? 
                              activeSetInput.reps : 
                              (hasPrevHistory ? prevSetData.reps.toString() : 
                              (showSuggested ? maxWeightInfo.reps.toString() : ''));
          return (
            <View key={`set-${setNumber}`} style={styles.setCardWrapper}>
                    <Surface style={{ borderRadius: BORDER_RADIUS.md }}>
        <View style={[
          styles.setCardInner, 
          { backgroundColor: isActive ? COLORS.primary : isCompleted ? '#2A3038' : '#1D2126' }
        ]}>  
          <View style={[styles.activeInputRow, { backgroundColor: isActive ? COLORS.primary : isCompleted ? '#2A3038' : '#1D2126' }]}>
                        <View style={styles.activeInputLeft}>
              {/* Only show suggested label if this is active set and max weight info exists */}
              {isActive && showSuggested && (
                <Text style={[styles.suggestedLabelText, { 
                  color: COLORS.background, 
                  position: 'absolute',
                  top: -16, 
                  left: 40, 
                  fontSize: 11 
                }]}>
                  Suggested
                </Text>
              )}
              <View style={{ alignItems: 'center' }}>
                <TextInput
                  style={[
                    styles.activeInputText,
                    { color: isActive ? COLORS.background : COLORS.text }
                  ]}
                  value={
                    isActive 
                      ? prefillWeight 
                      : (isCompleted 
                          ? getSetData(currentExerciseData.exercise_id || currentExerciseData.id, setNumber).weight.toString()
                          : previousSetData[`${currentExerciseData.exercise_id || currentExerciseData.id}_${setNumber}`]?.weight !== '-'
                            ? previousSetData[`${currentExerciseData.exercise_id || currentExerciseData.id}_${setNumber}`]?.weight.toString()
                            : '-')
                  }
                  onChangeText={(text) => setActiveSetInput(prev => ({ ...prev, weight: text }))}
                  onFocus={() => handleInputFocus(setNumber, 'weight')}
                  keyboardType="numeric"
                  placeholder={previousSetData[`${currentExerciseData.exercise_id || currentExerciseData.id}_${setNumber}`]?.weight !== '-' ? 
                    previousSetData[`${currentExerciseData.exercise_id || currentExerciseData.id}_${setNumber}`]?.weight.toString() : 
                    "-"}
                  placeholderTextColor={isActive ? COLORS.background : COLORS.text}
                  editable={isActive}
                />
                {/* Previous weight indicator - show for active set only */}
                {isActive && previousSetData[`${currentExerciseData.exercise_id || currentExerciseData.id}_${setNumber}`]?.weight !== '-' && (
                  <Text style={[styles.previousValueText, { color: COLORS.background }]}>
                    Last {previousSetData[`${currentExerciseData.exercise_id || currentExerciseData.id}_${setNumber}`]?.weight}
                  </Text>
                )}
              </View>
              <Text style={[styles.activeInputUnit, { color: isActive ? COLORS.background : COLORS.text }]}>kg</Text>
            </View>
                    <View style={[
              styles.activeInputDivider, 
              { backgroundColor: isActive ? COLORS.background : COLORS.surfaceLight }
            ]} />
                                <View style={styles.activeInputRight}>
              <View style={{ alignItems: 'center' }}>
                <TextInput
                  style={[
                    styles.activeInputText,
                    { color: isActive ? COLORS.background : COLORS.text }
                  ]}
                  value={
                    isActive 
                      ? prefillReps 
                      : (isCompleted 
                          ? getSetData(currentExerciseData.exercise_id || currentExerciseData.id, setNumber).reps.toString()
                          : previousSetData[`${currentExerciseData.exercise_id || currentExerciseData.id}_${setNumber}`]?.reps !== '-'
                            ? previousSetData[`${currentExerciseData.exercise_id || currentExerciseData.id}_${setNumber}`]?.reps.toString()
                            : extractRepValue(currentExerciseData?.reps))
                  }
                  onChangeText={(text) => setActiveSetInput(prev => ({ ...prev, reps: text }))}
                  onFocus={() => handleInputFocus(setNumber, 'reps')}
                  keyboardType="numeric"
                  placeholder={previousSetData[`${currentExerciseData.exercise_id || currentExerciseData.id}_${setNumber}`]?.reps !== '-' ? 
                    previousSetData[`${currentExerciseData.exercise_id || currentExerciseData.id}_${setNumber}`]?.reps.toString() : 
                    (currentExerciseData?.reps || "6-8")}
                  placeholderTextColor={isActive ? COLORS.background : COLORS.text}
                  editable={isActive}
                />
                {/* Previous reps indicator - show for active set only */}
                {isActive && previousSetData[`${currentExerciseData.exercise_id || currentExerciseData.id}_${setNumber}`]?.reps !== '-' && (
                  <Text style={[styles.previousValueText, { color: COLORS.background }]}>
                    Last {previousSetData[`${currentExerciseData.exercise_id || currentExerciseData.id}_${setNumber}`]?.reps}
                  </Text>
                )}
              </View>
              <Text style={[styles.activeInputUnit, { color: isActive ? COLORS.background : COLORS.text }]}>reps</Text>
            </View>
                                {isActive ? (
              <TouchableOpacity 
                style={styles.didItButton}
                onPress={handleDidItPress}
              >
                <Text style={styles.didItButtonText}>Did It</Text>
              </TouchableOpacity>
            ) : isCompleted ? (
              <View style={styles.completedIndicator}>
                <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.success} />
              </View>
            ) : (
              <TouchableOpacity 
                style={[styles.didItButton, { opacity: 0.5 }]}
                onPress={() => {
                  // Allow user to manually activate this set
                  setActiveSet(setNumber);
                }}
              >
                <Text style={[styles.didItButtonText, { opacity: 0.7 }]}>Set {setNumber}</Text>
              </TouchableOpacity>
            )}
                  </View>
                  {/* Only show weight note for active set */}
                  {isActive && (
              <Text style={[
                styles.weightNote, 
                { 
                  textAlign: 'left', 
                  paddingLeft: SPACING.md,
                  color: COLORS.background,
                  opacity: 0.9
                }
              ]}>Weight of bar + plates</Text>
            )}
                </View>
              </Surface>
            </View>
          );
        })}

        {/* Log All Sets Button */}
        <TouchableOpacity style={styles.logAllButton} onPress={handleLogAllSets}>
          <Text style={styles.logAllButtonText}>Log All Sets</Text>
        </TouchableOpacity>

        {/* Customize Exercise Button */}
        <TouchableOpacity style={styles.customizeButton}>
          <Text style={styles.customizeButtonText}>Customize Exercise</Text>
        </TouchableOpacity>

        {/* Next Exercise */}
        <View style={styles.nextExerciseContainer}>
          <Text style={styles.nextExerciseLabel}>Next Exercise</Text>
          <View style={styles.progressBar}>
            <View style={styles.progressFill} />
          </View>
        </View>
      </ScrollView>

      {/* Rest Timer has been removed */}

      {/* Offline Indicator */}
      {(!isConnected || !isInternetReachable) && (
        <View style={styles.offlineBar}>
          <Text style={styles.offlineText}>You are offline. Changes will sync when online.</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Header styles
  header: {
    backgroundColor: COLORS.background,
    elevation: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
  },
  headerInner: {
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    height: 56,
  },
  headerButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  headerButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  // Stats bar styles
  statsBar: {
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
  },
  statsBarInner: {
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  statLabel: {
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    opacity: 0.8,
    marginBottom: 4,
  },
  statValue: {
    color: COLORS.text,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  // Content styles
  content: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Exercise card styles
  exerciseCard: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
    backgroundColor: COLORS.background,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  exerciseImage: {
    width: 60,
    height: 60,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  exerciseInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  exerciseName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  muscleTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  muscleTagText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.xs,
    fontWeight: 'bold',
  },
  // Set card styles
  setCardWrapper: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  setCard: {
    borderRadius: BORDER_RADIUS.md,
  },
  setCardInner: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  setCardCompleted: {
    opacity: 0.6,
  },
  setContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  setLeft: {
    flex: 1,
    padding: SPACING.md,
  },
  setReps: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  setTarget: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    opacity: 0.8,
  },
  didItButton: {
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  keyboardAccessoryView: {
    height: Platform.OS === 'ios' ? 45 : 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
  },
  doneButton: {
    padding: 8,
    marginRight: 10,
  },
  doneButtonText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: FONT_SIZES.md,
  },
  didItButtonText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  playButton: {
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    width: 50,
    height: '100%',
    borderTopRightRadius: BORDER_RADIUS.md,
    borderBottomRightRadius: BORDER_RADIUS.md,
  },
  // Active input row styles
  activeInputRow: {
    flexDirection: 'row',
    height: 100, // Increased from 70 to accommodate the Last X values
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  activeInputLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  activeInputRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  activeInputDivider: {
    width: 1,
    height: '60%',
    backgroundColor: COLORS.background,
    marginHorizontal: SPACING.xs,
  },
  activeInputText: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
    minWidth: 60,
    textAlign: 'center',
    padding: 0,
  },
  activeInputUnit: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    marginLeft: 4,
    fontWeight: '500',
  },
  activeInputHistory: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    marginLeft: 4,
    opacity: 0.8,
  },
  weightNote: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    textAlign: 'center',
    paddingBottom: SPACING.xs,
    opacity: 0.8,
  },
  // Suggested row styles
  suggestedRow: {
    padding: SPACING.sm,
  },
  suggestedLabel: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
  },
  suggestedLabelText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    marginBottom: 2,
    opacity: 0.8,
  },
  suggestedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 45,
  },
  suggestedLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  suggestedRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  suggestedDivider: {
    width: 1,
    height: '50%',
    backgroundColor: COLORS.background,
    opacity: 0.3,
  },
  suggestedValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  suggestedUnit: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    marginLeft: 2,
    opacity: 0.8,
  },
  suggestedHistory: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    marginLeft: 4,
  },
  // Dark suggested styles
  darkSuggestedRow: {
    padding: SPACING.md,
  },
  darkSuggestedLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    opacity: 0.7,
    marginBottom: 4,
  },
  darkSuggestedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  darkSuggestedLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  darkSuggestedRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  darkSuggestedValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  darkSuggestedUnit: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    marginLeft: 2,
  },
  darkSuggestedHistory: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    marginLeft: 2,
    opacity: 0.7,
  },
  // This style has been replaced by the new playButton style below
  // Action buttons
  logAllButton: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    backgroundColor: '#1D2126',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  logAllButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
  customizeButton: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
  },
  customizeButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
  },
  // Next exercise styles
  nextExerciseContainer: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  nextExerciseLabel: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    marginBottom: SPACING.sm,
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.round,
  },
  progressFill: {
    width: '40%',
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.round,
  },
  // Error and offline styles
  offlineBar: {
    backgroundColor: `${COLORS.error}20`,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  offlineText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
  },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    textAlign: 'center',
    marginHorizontal: SPACING.lg,
  },
  // Rest Timer styles have been removed
  maxWeightContainer: {
    marginTop: SPACING.sm,
  },
  maxWeightTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  maxWeightValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  maxWeightDetail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    opacity: 0.7,
  },
  maxWeightDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    opacity: 0.7,
  },
  maxWeightProgress: {
    height: 8,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.round,
    marginTop: SPACING.md,
  },
  maxWeightFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.round,
  },
  completedIndicator: {
    width: 80,
    height: '100%',
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previousValueText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '400',
    marginTop: 2,
  },
}); 