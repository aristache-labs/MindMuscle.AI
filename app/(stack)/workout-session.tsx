import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator, Text, Alert, TouchableOpacity, Platform, Image, TextInput, Animated, PanResponder } from 'react-native';
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

  // Rest timer has been removed
  
  // Add input state for active set
  const [activeSetInput, setActiveSetInput] = useState({ weight: '', reps: '' });
  const [activeSet, setActiveSet] = useState(1);
  const [completedSets, setCompletedSets] = useState<number[]>([]);

  // Use state to store max weight info
  const [maxWeightInfo, setMaxWeightInfo] = useState<{ weight: number; reps: number; date: string } | null>(null);

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

    return () => clearInterval(interval);
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

  const handleSetComplete = async (exerciseId: string, setNumber: number, weight: number = 0, reps: number = 0) => {
    if (!params.sessionId || !user) return;

    try {
      // Make sure we're using the actual exercise_id, not the entry id
      const actualExerciseId = currentExerciseData?.exercise_id || exerciseId;
      
      logger.debug(`Logging set completion`, () => ({
        exerciseId: actualExerciseId, 
        setNumber, 
        weight, 
        reps
      }));
      
      // Add more detailed logging to check all parameters
      logger.debug('Exercise set details for logging', () => ({
        sessionId: params.sessionId,
        userId: user.id,
        actualExerciseId,
        setNumber,
        weight,
        reps
      }));
      
      // Use the workoutPlanService to log the exercise set
      // This will handle both online and offline scenarios
      try {
        await workoutPlanService.logExerciseSet(
          params.sessionId as string, 
          actualExerciseId,
          setNumber,
          { weight, reps }
        );
        logger.debug('Successfully called workoutPlanService.logExerciseSet');
        
        // Ensure user_exercises_history is also populated directly
        if (typeof workoutPlanService.logUserExerciseHistory === 'function') {
          await workoutPlanService.logUserExerciseHistory(
            user.id,
            actualExerciseId,
            params.sessionId as string,
            setNumber,
            weight,
            reps
          );
          logger.debug('Successfully logged user exercise history');
          
          // Also update personal records
          if (typeof workoutPlanService.checkAndUpdatePersonalRecord === 'function') {
            await workoutPlanService.checkAndUpdatePersonalRecord(
              user.id,
              actualExerciseId,
              weight,
              reps
            );
            logger.debug('Successfully checked/updated personal records');
          }
        }
      } catch (serviceError) {
        logger.error('Error in workoutPlanService.logExerciseSet:', serviceError);
        throw serviceError;
      }

      // Update local state
      setExerciseHistory(prev => {
        const newHistory = { ...prev };
        if (!newHistory[exerciseId]) {
          newHistory[exerciseId] = {
            sets_completed: 0,
            total_volume: 0,
            sets_data: []
          };
        }
        
        // Ensure sets_data exists and is an array
        if (!newHistory[exerciseId].sets_data || !Array.isArray(newHistory[exerciseId].sets_data)) {
          newHistory[exerciseId].sets_data = [];
        }
        
        // Add new set data
        const newSet: ExerciseSet = {
          set: setNumber,
          weight,
          reps
        };
        
        // Update or add set - with proper null check
        const setIndex = newHistory[exerciseId].sets_data.findIndex((s: ExerciseSet) => s.set === setNumber);
        if (setIndex >= 0) {
          newHistory[exerciseId].sets_data[setIndex] = newSet;
        } else {
          newHistory[exerciseId].sets_data.push(newSet);
          newHistory[exerciseId].sets_completed++;
        }
        
        // Recalculate total volume
        newHistory[exerciseId].total_volume = newHistory[exerciseId].sets_data.reduce(
          (sum: number, set: ExerciseSet) => sum + (set.weight * set.reps),
          0
        );
        
        return newHistory;
      });

      // Keep the values in the input field after logging
      // Don't clear the inputs: setActiveSetInput({ weight: '', reps: '' });
    } catch (error) {
      logger.error('Error logging set:', error);
      Alert.alert('Error', 'Failed to log set. Data will be synced when online.');
    }
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
        
        await handleSetComplete(actualExerciseId, setNumber, weight, reps);
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
      
      // Parse the weight the user entered. If the field is empty (or non-numeric), default to 0.
      const parsedWeight = parseInt(activeSetInput.weight.trim(), 10);
      const weight = isNaN(parsedWeight) ? 0 : parsedWeight;
      
      // Get reps value - use entered value or try to parse from reps range
      let reps = 0;
      if (activeSetInput.reps && activeSetInput.reps.trim() !== '') {
        reps = parseInt(activeSetInput.reps, 10);
      } else if (currentExerciseData.reps) {
        // Try to extract a reasonable value from the reps range (e.g., "6-8" becomes 7)
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
      
      await handleSetComplete(
        actualExerciseId,
        activeSet,
        weight,
        reps
      );
      
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
      Alert.alert('Error', 'Failed to record your set. Please try again.');
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

  // Reset the input fields whenever we change to a new exercise
  useEffect(() => {
    if (exercises.length === 0) return;
    const current = exercises[currentExercise];
    if (!current) return;

    // Attempt to preload with last logged data for this exercise
    const lastData = getLastSetData(current.exercise_id || current.id);
    if (lastData.weight > 0) {
      setActiveSetInput({
        weight: lastData.weight.toString(),
        reps: lastData.reps.toString(),
      });
    } else {
      setActiveSetInput({ weight: '', reps: '' });
    }
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
      
      fetchMaxWeight();
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
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

      <ScrollView style={styles.content}>
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
          
          // Render the active set with special input style
          if (isActive) {
            return (
              <View key={`set-${setNumber}`} style={styles.setCardWrapper}>
                <Surface style={{ borderRadius: BORDER_RADIUS.md }}>
                  <View style={[styles.setCardInner, { backgroundColor: COLORS.primary }]}>
                    <View style={styles.suggestedLabel}>
                      <Text style={[styles.suggestedLabelText, { color: COLORS.background }]}>Suggested</Text>
                    </View>
                    <View style={styles.activeInputRow}>
                      <View style={styles.activeInputLeft}>
                        <TextInput
                          style={styles.activeInputText}
                          value={activeSetInput.weight}
                          onChangeText={(text) => setActiveSetInput(prev => ({ ...prev, weight: text }))}
                          keyboardType="numeric"
                          placeholder="-"
                          placeholderTextColor={COLORS.background}
                        />
                        <Text style={styles.activeInputUnit}>kg</Text>
                      </View>
                      <View style={styles.activeInputDivider} />
                      <View style={styles.activeInputRight}>
                        <TextInput
                          style={styles.activeInputText}
                          value={activeSetInput.reps}
                          onChangeText={(text) => setActiveSetInput(prev => ({ ...prev, reps: text }))}
                          keyboardType="numeric"
                          placeholder={currentExerciseData?.reps || "6-8"}
                          placeholderTextColor={COLORS.background}
                        />
                        <Text style={styles.activeInputUnit}>reps</Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.didItButton}
                        onPress={handleDidItPress}
                      >
                        <Text style={styles.didItButtonText}>Did It</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.weightNote, { textAlign: 'left', paddingLeft: SPACING.md }]}>Weight of bar + plates</Text>
                  </View>
                </Surface>
              </View>
            );
          }
          
          return (
            <View key={`set-${setNumber}`} style={styles.setCardWrapper}>
              <Surface style={{ borderRadius: BORDER_RADIUS.md }}>
                <View style={[
                  styles.setCardInner, 
                  { 
                    backgroundColor: isCompleted ? COLORS.surfaceLight : COLORS.surface,
                  }
                ]}>
                  {isCompleted ? (
                    <View style={styles.darkSuggestedRow}>
                      <Text style={styles.darkSuggestedLabel}>Set {setNumber} (Completed)</Text>
                      <View style={styles.darkSuggestedContent}>
                        <View style={styles.darkSuggestedLeft}>
                          <Text style={styles.darkSuggestedValue}>
                            {getSetData(currentExerciseData.exercise_id || currentExerciseData.id, setNumber).weight}
                          </Text>
                          <Text style={styles.darkSuggestedUnit}>kg</Text>
                        </View>
                        <View style={styles.darkSuggestedRight}>
                          <Text style={styles.darkSuggestedValue}>
                            {getSetData(currentExerciseData.exercise_id || currentExerciseData.id, setNumber).reps}
                          </Text>
                          <Text style={styles.darkSuggestedUnit}>reps</Text>
                        </View>
                        <TouchableOpacity 
                          style={styles.playButton}
                          onPress={() => handleRedoSet(setNumber)}
                        >
                          <MaterialCommunityIcons name="refresh" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.suggestedRow}>
                      <View style={styles.suggestedLabel}>
                        <Text style={styles.suggestedLabelText}>Suggested</Text>
                      </View>
                      <View style={styles.suggestedContent}>
                        <View style={styles.suggestedLeft}>
                          <Text style={styles.suggestedValue}>-</Text>
                          <Text style={styles.suggestedUnit}>kg</Text>
                        </View>
                        <View style={styles.suggestedDivider} />
                        <View style={styles.suggestedRight}>
                          <Text style={styles.suggestedValue}>{currentExerciseData?.reps || "6-8"}</Text>
                          <Text style={styles.suggestedUnit}>reps</Text>
                        </View>
                        <TouchableOpacity 
                          style={styles.playButton}
                          onPress={() => {
                            // Make this the active set
                            setActiveSet(setNumber);
                          }}
                        >
                          <MaterialCommunityIcons name="play" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>
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
    </View>
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
    height: 70,
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
}); 