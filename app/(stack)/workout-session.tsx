import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, FlatList, Pressable, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, Button, Divider } from 'react-native-paper';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import supabase from '../services/supabase';
import { useAuth } from '../store/AuthContext';
import OptimizedImage from '../components/OptimizedImage';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

const { width: screenWidth } = Dimensions.get('window');

interface ExerciseData {
  id: string;
  exercise_id: string;
  name: string;
  sets: number;
  reps_range: string;
  image_url?: string;
  primary_muscles?: string[];
  restTime?: number;
  order: number;
  workout_day: number;
}

interface ExerciseSet {
  id: string;
  setNumber: number;
  weight: string;
  reps: string;
  isCompleted: boolean;
}

// Add TypeScript interface to properly type the data returned from Supabase
interface ExerciseDataItem {
  id: string;
  sets: number;
  reps_range: string;
  exercise_id: string;
  workout_day: number;
  exercise_name?: string;
  rest_time?: number;
  order: number;
  exercises?: any; // Use any type to avoid TypeScript errors
}

export default function WorkoutSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [exerciseSets, setExerciseSets] = useState<Record<string, ExerciseSet[]>>({});
  const [restTimer, setRestTimer] = useState(0);
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [workoutStartTime, setWorkoutStartTime] = useState<Date | null>(null);
  const [workoutDuration, setWorkoutDuration] = useState(0);
  const [workoutTimerActive, setWorkoutTimerActive] = useState(false);
  const [totalVolume, setTotalVolume] = useState<number>(0); // Total weight lifted (kg)
  const [totalReps, setTotalReps] = useState<number>(0); // Total reps performed
  const [recommendations, setRecommendations] = useState<Record<string, any>>({});
  const [focusedInputs, setFocusedInputs] = useState<Record<string, boolean>>({});
  const [lastExerciseValues, setLastExerciseValues] = useState<Record<string, Record<number, { weight: string, reps: string }>>>({});
  
  // State for workout completion
  const [isWorkoutCompleted, setIsWorkoutCompleted] = useState(false);
  const [completedWorkoutData, setCompletedWorkoutData] = useState<{
    completedExercises: number;
    duration: number;
    caloriesBurned: number;
    totalVolume: number;
    totalReps: number;
    completedAt: string;
    weekName: string;
    cycleWeek: number;
  } | null>(null);
  
  // Functions to handle input focus and blur
  const handleInputFocus = (id: string) => {
    setFocusedInputs(prev => ({
      ...prev,
      [id]: true
    }));
  };
  
  const handleInputBlur = (id: string) => {
    setFocusedInputs(prev => ({
      ...prev,
      [id]: false
    }));
  };
  
  // Function to fetch last exercise records for all exercises
  const fetchLastExerciseRecords = async () => {
    if (!user) return;
    if (exercises.length === 0) {

      return;
    }
    
    try {

      
      // Create an object to store the last values for each exercise and set
      const lastValues: Record<string, Record<number, { weight: string, reps: string }>> = {};
      
      // For each exercise, fetch the last records
      for (const exercise of exercises) {
        if (!exercise.exercise_id) {

          continue;
        }
        

        
        const { data: records, error } = await supabase
          .from('user_exercise_records')
          .select('*')
          .eq('exercise_id', exercise.exercise_id)
          .eq('completed', true)
          .order('created_at', { ascending: false });
        
        if (error) {
          // Error fetching last exercise records
          continue;
        }
        

        
        if (records && records.length > 0) {
          // Group records by set_number
          const setRecords: Record<number, { weight: string, reps: string }> = {};
          
          // Process records to get the last value for each set number
          records.forEach(record => {
            const setNumber = record.set_number;
            
            // Only store the first (most recent) record for each set number
            if (!setRecords[setNumber]) {
              setRecords[setNumber] = {
                weight: record.weight,
                reps: record.reps
              };

            }
          });
          
          lastValues[exercise.exercise_id] = setRecords;
        }
      }
      
      if (Object.keys(lastValues).length > 0) {

        setLastExerciseValues(lastValues);
      } else {

      }
    } catch (error) {
      // Error in fetchLastExerciseRecords
    }
  };
  
  // Function to auto-fill the next set with values from the previous set
  const autoFillNextSet = (exerciseId: string, currentSetIndex: number) => {
    // Only auto-fill if there's a next set
    if (exerciseSets[exerciseId] && exerciseSets[exerciseId][currentSetIndex + 1]) {
      const nextSet = exerciseSets[exerciseId][currentSetIndex + 1];
      const currentSet = exerciseSets[exerciseId][currentSetIndex];
      
      // Only auto-fill if the next set doesn't already have values
      if ((nextSet.weight === '' || nextSet.weight === '-') && 
          (nextSet.reps === '' || nextSet.reps === '-') &&
          currentSet.weight !== '' && currentSet.weight !== '-' && 
          currentSet.reps !== '' && currentSet.reps !== '-') {
        
        setExerciseSets(prev => {
          const updatedSets = { ...prev };
          if (updatedSets[exerciseId]) {
            updatedSets[exerciseId][currentSetIndex + 1] = {
              ...updatedSets[exerciseId][currentSetIndex + 1],
              weight: currentSet.weight,
              reps: currentSet.reps
            };
          }
          return updatedSets;
        });
      }
    }
  };
  
  // Extract params
  const planId = params.planId as string;
  const workoutDay = parseInt(params.workoutDay as string, 10);
  const cycleWeek = parseInt(params.cycleWeek as string, 10) || 1;
  const weekName = params.weekName as string || 'Adaptation';
  
  // Store the original cycle week for redo workouts
  const [originalCycleWeek, setOriginalCycleWeek] = useState<number | null>(null);
  
  // Timer interval reference
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get forceStart parameter from URL
  const forceStart = params.forceStart === 'true';
  
  // Effect to monitor exercises state and fetch last records when exercises change
  useEffect(() => {
    if (exercises.length > 0 && user) {

      fetchLastExerciseRecords();
    }
  }, [exercises, user]);

  useEffect(() => {
    // Check if workout is already completed for today, but skip if forceStart is true
    if (!forceStart) {
      checkWorkoutCompletion();
    } else {
      // If forceStart is true, always fetch workout data and start the timer
      fetchWorkoutData();
      setWorkoutStartTime(new Date());
      setWorkoutTimerActive(true);
      
      // Start workout duration timer
      const workoutTimerInterval = setInterval(() => {
        setWorkoutDuration(prev => prev + 1);
      }, 1000);
      
      // Add cleanup for the timer
      return () => {
        clearInterval(workoutTimerInterval);
      };
    }
    
    // Cleanup
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [planId, workoutDay, forceStart]);
  
  // Check if workout is already completed for today
  const checkWorkoutCompletion = async () => {
    if (!user || !planId) return;
    
    try {
      setIsLoading(true);
      

      
      // Get today's date in ISO format (YYYY-MM-DD)
      const today = new Date().toISOString().split('T')[0];
      
      // Check if there's a completed workout for today
      const { data, error } = await supabase
        .from('user_workout_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', planId)
        .eq('workout_day', workoutDay);
      

      
      if (error) {
        // Error checking workout completion
        throw error;
      }
      
      if (data && data.length > 0) {
        // Workout is already completed, get the most recent one
        const mostRecentWorkout = data.sort((a, b) => 
          new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
        )[0];
        

        setIsWorkoutCompleted(true);
        
        // Get the count of exercises from the user_exercise_records table
        const { data: exerciseData, error: exerciseError } = await supabase
          .from('user_exercise_records')
          .select('exercise_id')
          .eq('workout_history_id', mostRecentWorkout.id)
          .limit(1000);
        
        if (exerciseError) {
          // Error fetching exercise records
        }
        

        
        // Set completed workout data
        setCompletedWorkoutData({
          completedExercises: exerciseData ? new Set(exerciseData.map(item => item.exercise_id)).size : 0,
          duration: mostRecentWorkout.duration_minutes || 0,
          caloriesBurned: mostRecentWorkout.calories_burned || 0,
          totalVolume: mostRecentWorkout.total_volume || 0,
          totalReps: mostRecentWorkout.total_reps || 0,
          completedAt: mostRecentWorkout.completed_at,
          weekName: mostRecentWorkout.week_name,
          cycleWeek: mostRecentWorkout.cycle_week
        });
        
        setIsLoading(false);
      } else {
        // Workout is not completed, fetch workout data

        setIsWorkoutCompleted(false);
        fetchWorkoutData();
        
        // Start workout timer
        setWorkoutStartTime(new Date());
        setWorkoutTimerActive(true);
        
        // Start workout duration timer
        const workoutTimerInterval = setInterval(() => {
          setWorkoutDuration(prev => prev + 1);
        }, 1000);
        
        // Add cleanup for the timer
        return () => {
          clearInterval(workoutTimerInterval);
        };
      }
    } catch (error) {
      // Error in checkWorkoutCompletion
      setIsLoading(false);
      // If there's an error, proceed with normal workout
      setIsWorkoutCompleted(false);
      fetchWorkoutData();
      
      // Start workout timer
      setWorkoutStartTime(new Date());
      setWorkoutTimerActive(true);
      
      // Start workout duration timer
      const workoutTimerInterval = setInterval(() => {
        setWorkoutDuration(prev => prev + 1);
      }, 1000);
      
      // Add cleanup for the timer
      return () => {
        clearInterval(workoutTimerInterval);
      };
    }
  };

  const fetchWorkoutData = async () => {
    if (!planId || isNaN(workoutDay) || !user) {
      Alert.alert('Error', 'Invalid workout parameters');
      router.back();
      return;
    }

    try {
      setIsLoading(true);
      
      // Fetch exercises for this workout
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('workout_plan_exercises')
        .select(`
          id,
          sets,
          reps_range,
          exercise_id,
          workout_day,
          exercise_name,
          rest_time,
          "order",
          exercises:exercise_id (
            id,
            name,
            image_url,
            primary_muscles
          )
        `)
        .eq('plan_id', planId)
        .eq('workout_day', workoutDay)
        .order('order', { ascending: true });
        
      if (exercisesError) throw exercisesError;
      
      if (!exercisesData || exercisesData.length === 0) {
        Alert.alert('Error', 'No exercises found for this workout');
        router.back();
        return;
      }
      
      // Format exercise data with proper typing
      const formattedExercises: ExerciseData[] = (exercisesData as unknown as ExerciseDataItem[]).map(item => ({
        id: item.id,
        exercise_id: item.exercise_id,
        name: item.exercise_name || (item.exercises ? item.exercises.name : undefined) || 'Unknown Exercise',
        sets: item.sets || 3,
        reps_range: item.reps_range || '8-12',
        image_url: item.exercises ? item.exercises.image_url : undefined,
        primary_muscles: item.exercises ? item.exercises.primary_muscles : undefined,
        restTime: item.rest_time,
        order: item.order,
        workout_day: item.workout_day
      }));
      
      setExercises(formattedExercises);
      
      // Initialize exercise sets
      const initialSets: Record<string, ExerciseSet[]> = {};
      
      for (const exercise of formattedExercises) {
        const exerciseSets: ExerciseSet[] = [];
        
        for (let i = 1; i <= exercise.sets; i++) {
          exerciseSets.push({
            id: `${exercise.id}-set-${i}`,
            setNumber: i,
            weight: '',
            reps: '',
            isCompleted: false
          });
        }
        
        initialSets[exercise.id] = exerciseSets;
        
        // Fetch recommendations for this exercise
        if (user?.id && exercise.exercise_id) {
          const { data: recommendationData } = await supabase.rpc(
            'get_exercise_recommendations',
            {
              p_user_id: user.id,
              p_exercise_id: exercise.exercise_id,
              p_cycle_week: cycleWeek
            }
          );
          
          if (recommendationData && recommendationData.length > 0) {
            setRecommendations(prev => ({
              ...prev,
              [exercise.id]: recommendationData[0]
            }));
          }
        }
      }
      
      setExerciseSets(initialSets);
      
      // After setting up the exercises and sets, fetch the last exercise records
      await fetchLastExerciseRecords();
      
    } catch (error) {
      // Error fetching workout data
      Alert.alert('Error', 'Failed to load workout data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackPress = () => {
    Alert.alert(
      'Exit Workout',
      'Are you sure you want to exit? Your progress will not be saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => router.back() }
      ]
    );
  };

  const startRestTimer = (seconds: number) => {
    setRestTimer(seconds);
    setRestTimerActive(true);
    
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    
    timerIntervalRef.current = setInterval(() => {
      setRestTimer(prev => {
        if (prev <= 1) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          setRestTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000) as unknown as NodeJS.Timeout;
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const formatRestTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSetComplete = (exerciseId: string, setIndex: number) => {
    // First, update the set state
    setExerciseSets(prev => {
      const updatedSets = [...prev[exerciseId]];
      const currentSet = updatedSets[setIndex];
      const newCompletedState = !currentSet.isCompleted;
      const wasNotCompletedBefore = !currentSet.isCompleted;
      
      // If the set is being marked as completed, add its volume and reps to totals
      if (newCompletedState) {
        const weight = currentSet.weight === '-' || currentSet.weight === '' ? 0 : parseFloat(currentSet.weight);
        const reps = currentSet.reps === '-' || currentSet.reps === '' ? 0 : parseFloat(currentSet.reps);
        const setVolume = parseFloat((weight * reps).toFixed(1)); // Ensure precision to 1 decimal place
        
        // Log the values for debugging

        
        setTotalVolume(prev => {
          const newTotal = parseFloat((prev + setVolume).toFixed(1));

          return newTotal;
        });
        
        setTotalReps(prev => {
          const newTotal = prev + reps;

          return newTotal;
        });
        
        // Store the last values for this exercise if they're valid
        if (currentSet.weight !== '-' && currentSet.weight !== '' && currentSet.reps !== '-' && currentSet.reps !== '') {
          setLastExerciseValues(prev => ({
            ...prev,
            [exerciseId]: { weight: currentSet.weight, reps: currentSet.reps }
          }));
          
          // If this set is being completed, auto-fill the next set if it exists
          if (wasNotCompletedBefore && updatedSets.length > setIndex + 1) {
            const nextSet = updatedSets[setIndex + 1];
            // Only auto-fill if the next set doesn't already have values
            if ((nextSet.weight === '' || nextSet.weight === '-') && 
                (nextSet.reps === '' || nextSet.reps === '-')) {
              updatedSets[setIndex + 1] = {
                ...nextSet,
                weight: currentSet.weight,
                reps: currentSet.reps
              };
            }
          }
        }
      } else {
        // If the set is being unmarked, subtract its volume and reps from totals
        const weight = currentSet.weight === '-' || currentSet.weight === '' ? 0 : parseFloat(currentSet.weight);
        const reps = currentSet.reps === '-' || currentSet.reps === '' ? 0 : parseFloat(currentSet.reps);
        const setVolume = parseFloat((weight * reps).toFixed(1)); // Ensure precision to 1 decimal place
        
        setTotalVolume(prev => Math.max(0, parseFloat((prev - setVolume).toFixed(1))));
        setTotalReps(prev => Math.max(0, prev - reps));
      }
      
      updatedSets[setIndex] = {
        ...currentSet,
        isCompleted: newCompletedState
      };
      
      // Create a new exerciseSets object with the updated sets
      const newExerciseSets = { ...prev, [exerciseId]: updatedSets };
      
      // Check if this was the last set of the last exercise to be completed
      if (newCompletedState) {
        // Check if all sets for the current exercise are completed
        const allCurrentExerciseSetsCompleted = updatedSets.every(set => set.isCompleted);
        
        if (allCurrentExerciseSetsCompleted) {
          // If we're on the last exercise and all its sets are completed, check if all exercises are completed
          if (currentExerciseIndex === exercises.length - 1) {
            // Check if all exercises have all their sets completed
            const allExercisesCompleted = exercises.every(exercise => {
              // For the current exercise, use the updated sets
              if (exercise.id === exerciseId) {
                return updatedSets.every(set => set.isCompleted);
              }
              // For other exercises, use the existing sets from prev
              const sets = prev[exercise.id] || [];
              return sets.length > 0 && sets.every(set => set.isCompleted);
            });
            
            if (allExercisesCompleted) {
              // All exercises and all sets are completed, save the workout data

              
              // Calculate the latest volume and reps including the last set
              const weight = currentSet.weight === '-' || currentSet.weight === '' ? 0 : parseFloat(currentSet.weight);
              const reps = currentSet.reps === '-' || currentSet.reps === '' ? 0 : parseFloat(currentSet.reps);
              const setVolume = parseFloat((weight * reps).toFixed(1));
              
              // Calculate the new totals including this last set
              const newTotalVolume = parseFloat((totalVolume + setVolume).toFixed(1));
              const newTotalReps = totalReps + reps;
              


              
              // Pass the fresh values directly to completeWorkout
              setTimeout(() => {
                completeWorkout(newTotalVolume, newTotalReps);
              }, 500);
            } else {
              // Just move to the next exercise (which will be the last one)
              setTimeout(() => {

                moveToNextExercise();
              }, 500);
            }
          } else {
            // Not the last exercise, just move to the next one
            setTimeout(() => {
              moveToNextExercise();
            }, 500);
          }
        }
      }
      
      return newExerciseSets;
    });
    
    // Start rest timer if set was marked as completed
    const exercise = exercises.find(ex => ex.id === exerciseId);
    if (exercise && exercise.restTime) {
      startRestTimer(exercise.restTime);
    } else {
      startRestTimer(60); // Default rest time: 60 seconds
    }
  };

  const handleRedoSet = (exerciseId: string, setIndex: number) => {
    // Mark the set as not completed and update volume/reps totals
    setExerciseSets(prev => {
      const updatedSets = [...prev[exerciseId]];
      const currentSet = updatedSets[setIndex];
      
      // If the set was completed, subtract its volume and reps from totals
      if (currentSet.isCompleted) {
        const weight = currentSet.weight === '-' || currentSet.weight === '' ? 0 : parseFloat(currentSet.weight);
        const reps = currentSet.reps === '-' || currentSet.reps === '' ? 0 : parseFloat(currentSet.reps);
        const setVolume = parseFloat((weight * reps).toFixed(1)); // Ensure precision to 1 decimal place
        
        setTotalVolume(prev => Math.max(0, parseFloat((prev - setVolume).toFixed(1))));
        setTotalReps(prev => Math.max(0, prev - reps));
      }
      
      updatedSets[setIndex] = {
        ...currentSet,
        isCompleted: false
      };
      
      return { ...prev, [exerciseId]: updatedSets };
    });
  };

  const handleLogAllSets = (exerciseId: string) => {
    // Get the current sets for this exercise
    const sets = exerciseSets[exerciseId];
    if (!sets || sets.length === 0) return;
    
    // First, fill in any empty values with 0
    setExerciseSets(prev => {
      const updatedSets = { ...prev };
      const setsForExercise = [...updatedSets[exerciseId]];
      
      // Update any incomplete sets with empty values
      setsForExercise.forEach((set, index) => {
        if (!set.isCompleted) {
          // Fill empty weight with 0
          if (set.weight === '' || set.weight === '-') {
            setsForExercise[index] = {
              ...set,
              weight: '0'
            };
          }
          
          // Fill empty reps with 0
          if (set.reps === '' || set.reps === '-') {
            setsForExercise[index] = {
              ...set,
              reps: '0'
            };
          }
        }
      });
      
      updatedSets[exerciseId] = setsForExercise;
      return updatedSets;
    });
    
    // Use setTimeout to ensure state update completes before marking sets as complete
    setTimeout(() => {
      // Get the updated sets after filling in zeros
      const updatedSets = exerciseSets[exerciseId];
      if (!updatedSets) return;
      
      // Find all incomplete sets (they now all have values)
      const incompleteSets = updatedSets.filter(set => !set.isCompleted);
      
      if (incompleteSets.length > 0) {
        // Mark each set as completed one by one to ensure proper volume calculation
        incompleteSets.forEach((set, idx) => {
          const setIndex = updatedSets.findIndex(s => s.id === set.id);
          if (setIndex !== -1) {
            // For all sets except the last one, use normal handleSetComplete
            if (idx < incompleteSets.length - 1) {
              handleSetComplete(exerciseId, setIndex);
            } else {
              // For the last set, directly mark it as completed and then move to next exercise
              setExerciseSets(prev => {
                const finalUpdatedSets = [...prev[exerciseId]];
                finalUpdatedSets[setIndex] = {
                  ...finalUpdatedSets[setIndex],
                  isCompleted: true
                };
                return { ...prev, [exerciseId]: finalUpdatedSets };
              });
              
              // Update volume and reps for the last set
              const lastSet = updatedSets[setIndex];
              const weight = lastSet.weight === '-' || lastSet.weight === '' ? 0 : parseFloat(lastSet.weight);
              const reps = lastSet.reps === '-' || lastSet.reps === '' ? 0 : parseFloat(lastSet.reps);
              const setVolume = parseFloat((weight * reps).toFixed(1));
              
              setTotalVolume(prev => parseFloat((prev + setVolume).toFixed(1)));
              setTotalReps(prev => prev + reps);
              
              // Start rest timer
              const exercise = exercises.find(ex => ex.id === exerciseId);
              if (exercise && exercise.restTime) {
                startRestTimer(exercise.restTime);
              } else {
                startRestTimer(60);
              }
              
              // Check if this was the last exercise
              if (currentExerciseIndex === exercises.length - 1) {
                // Check if all exercises have all their sets completed after this update
                setTimeout(() => {
                  const allExercisesCompleted = exercises.every(ex => {
                    // For the current exercise, we know all sets are now completed
                    if (ex.id === exerciseId) return true;
                    
                    // For other exercises, check their sets
                    const exSets = exerciseSets[ex.id] || [];
                    return exSets.length > 0 && exSets.every(s => s.isCompleted);
                  });
                  
                  if (allExercisesCompleted) {
                    // All exercises are completed, save workout data

                    
                    // Use the current UI state values which should be accurate after the timeout
                    const currentTotalVolume = totalVolume;
                    const currentTotalReps = totalReps;
                    

                    completeWorkout(currentTotalVolume, currentTotalReps);
                  } else {
                    // Not all exercises are completed, just move to next exercise

                    moveToNextExercise();
                  }
                }, 500);
              } else {
                // Not the last exercise, just move to next
                setTimeout(() => {
                  moveToNextExercise();
                }, 500);
              }
            }
          }
        });
      } else {
        // All sets are already completed
        Alert.alert(
          'Sets Completed',
          'All sets for this exercise are already logged.',
          [{ text: 'OK' }]
        );
        // Move to next exercise since all sets are already completed

        moveToNextExercise();
      }
    }, 100); // Small delay to ensure state update completes
  };

  const handleWeightChange = (exerciseId: string, setIndex: number, value: string) => {
    // Validate and transform the input value
    // Allow decimal input with either dot or comma as separator
    let processedValue = value;
    
    // Replace comma with dot for decimal values
    if (value.includes(',')) {
      processedValue = value.replace(',', '.');
    }
    
    // Keep '-' as is but remove leading zeros
    if (processedValue !== '-') {
      // Handle decimal values correctly
      if (processedValue.includes('.')) {
        const [wholePart, decimalPart] = processedValue.split('.');
        
        // Limit whole part to 999 maximum
        let limitedWholePart = wholePart.replace(/^0+(?=\d)/, '');
        if (limitedWholePart !== '' && parseInt(limitedWholePart, 10) > 999) {
          limitedWholePart = '999';
        }
        
        // Limit decimal part to 1 digit
        const limitedDecimalPart = decimalPart.length > 0 ? decimalPart.substring(0, 1) : '';
        processedValue = `${limitedWholePart}.${limitedDecimalPart}`;
      } else {
        // For non-decimal values, limit to 999 maximum
        let limitedValue = processedValue.replace(/^0+(?=\d)/, '');
        if (limitedValue !== '' && parseInt(limitedValue, 10) > 999) {
          limitedValue = '999';
        }
        processedValue = limitedValue;
      }
    }
    
    setExerciseSets(prev => {
      const updatedSets = { ...prev };
      if (updatedSets[exerciseId]) {
        updatedSets[exerciseId][setIndex].weight = processedValue;
      }
      return updatedSets;
    });
  };

  const handleRepsChange = (exerciseId: string, setIndex: number, value: string) => {
    // Validate and transform the input value
    let processedValue = value === '-' ? value : value.replace(/^0+(?=\d)/, ''); // Keep '-' as is but remove leading zeros
    
    // Limit reps to a maximum of 999
    if (processedValue !== '-' && processedValue !== '') {
      const numValue = parseInt(processedValue, 10);
      if (!isNaN(numValue) && numValue > 999) {
        processedValue = '999';
      }
    }
    
    setExerciseSets(prev => {
      const updatedSets = { ...prev };
      if (updatedSets[exerciseId]) {
        updatedSets[exerciseId][setIndex].reps = processedValue;
      }
      return updatedSets;
    });
  };

  const moveToNextExercise = () => {
    if (currentExerciseIndex < exercises.length - 1) {

      // Use a function to update state to avoid closure issues
      setCurrentExerciseIndex(prevIndex => prevIndex + 1);
      
      // No notification when moving to next exercise for better UX flow
    } else {

      
      // Check if all exercises have all their sets completed
      const allExercisesCompleted = exercises.every(exercise => {
        const sets = exerciseSets[exercise.id] || [];
        return sets.length > 0 && sets.every(set => set.isCompleted);
      });
      
      if (allExercisesCompleted) {
        // All exercises and all sets are completed, automatically save data

        // Use setTimeout to ensure UI updates complete before saving
        setTimeout(() => {
          completeWorkout();
        }, 500);
      } else {
        // Not all sets are completed, show regular completion alert
        Alert.alert(
          'Workout Complete',
          'You have reached the end of your workout!',
          [{ 
            text: 'Complete Workout', 
            onPress: () => {
              // Allow the user to manually complete the workout even if not all sets are done
              completeWorkout();
            }
          }]
        );
      }
    }
  };

  const moveToPreviousExercise = () => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex(prev => prev - 1);
    }
  };

  const completeWorkout = async (overrideVolume?: number, overrideReps?: number) => {
    if (!user || !planId || !workoutStartTime) {
      // Missing required data for workout completion
      return;
    }
    
    // Stop the workout timer
    setWorkoutTimerActive(false);
    
    // Use override values if provided, otherwise fall back to state values
    // This ensures we capture the most up-to-date values including the last set
    const finalDuration = workoutDuration;
    const finalVolume = overrideVolume !== undefined ? overrideVolume : totalVolume;
    const finalReps = overrideReps !== undefined ? overrideReps : totalReps;
    


    if (overrideVolume !== undefined) {

    }
    

    
    try {
      // Show loading indicator
      setIsLoading(true);
      
      // Calculate workout duration
      const workoutEndTime = new Date();
      const workoutDurationMinutes = Math.round((workoutEndTime.getTime() - workoutStartTime.getTime()) / 60000);
      
      // Format workout duration in hh:mm:ss format
      const hours = Math.floor(finalDuration / 3600);
      const minutes = Math.floor((finalDuration % 3600) / 60);
      const seconds = finalDuration % 60;
      const formattedDuration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      

      
      // Check if this is a redone workout (started with forceStart parameter)
      const forceStartParam = params.forceStart;
      const isRedoWorkout = forceStartParam === 'true';
      
      // For redo workouts, we need to determine the original cycle week and week name
      let workoutCycleWeek = cycleWeek;
      let workoutWeekName = weekName;
      
      if (isRedoWorkout) {
        // If this is a redo workout, we should use the original cycle week and week name
        try {
          // Query the database to find the original cycle week and week name
          // for this workout day and plan
          const { data: historyData } = await supabase
            .from('user_workout_history')
            .select('cycle_week, week_name')
            .eq('user_id', user.id)
            .eq('plan_id', planId)
            .eq('workout_day', workoutDay)
            .order('completed_at', { ascending: false })
            .limit(1);
            
          if (historyData && historyData.length > 0) {
            // Use the cycle week and week name from the most recent workout for this day
            workoutCycleWeek = historyData[0].cycle_week;
            workoutWeekName = historyData[0].week_name;

          } else if (originalCycleWeek !== null) {
            // Fall back to the stored original cycle week if available
            workoutCycleWeek = originalCycleWeek;
            // Map cycle week to week name
            const weekNames: Record<number, string> = {
              1: 'Adaptation',
              2: 'Accumulation',
              3: 'Intensification',
              4: 'Peak',
              5: 'Deload'
            };
            workoutWeekName = weekNames[workoutCycleWeek] || 'Adaptation';

          }
        } catch (err) {
          // Error fetching original workout data
        }
      }
      

      
      // 1. Insert workout history entry with total volume and reps
      const { data: workoutData, error: workoutError } = await supabase
        .from('user_workout_history')
        .insert({
          user_id: user.id,
          plan_id: planId,
          workout_day: workoutDay,
          cycle_week: workoutCycleWeek,
          week_name: workoutWeekName,
          workout_duration: formattedDuration, // Save formatted duration in hh:mm:ss format
          calories_burned: Math.round(workoutDurationMinutes * 8.5), // Match the calculation used in plan-details.tsx (8.5 calories per minute)
          total_volume: finalVolume, // Add total volume (kg)
          total_reps: finalReps, // Add total reps
          completed_at: new Date().toISOString(), // Add completion timestamp
          exercises_count: exercises.length // Store the actual number of exercises
        })
        .select('id')
        .single();
        
        if (workoutError) {
        // Error creating workout history
        throw workoutError;
      }
      
      if (!workoutData) throw new Error('Failed to create workout history record');
      
      const workoutHistoryId = workoutData.id;

      
      // 2. Insert exercise records
      const exerciseRecords = [];
      
      for (const exercise of exercises) {
        const sets = exerciseSets[exercise.id] || [];
        
        for (const set of sets) {
          if (set.isCompleted) { // Only save completed sets
            // Transform '-' to '0' when saving to database
            const weight = set.weight === '-' || set.weight === '' ? '0' : set.weight;
            const reps = set.reps === '-' || set.reps === '' ? '0' : set.reps;
            
            exerciseRecords.push({
              workout_history_id: workoutHistoryId,
              exercise_id: exercise.exercise_id,
              workout_plan_exercise_id: exercise.id,
              set_number: set.setNumber,
              weight: weight ? parseFloat(weight) : 0,
              reps: reps ? parseInt(reps, 10) : 0,
              completed: set.isCompleted
            });
          }
        }
      }
      

      
      if (exerciseRecords.length > 0) {
        const { error: recordsError } = await supabase
          .from('user_exercise_records')
          .insert(exerciseRecords);
          
        if (recordsError) {
          // Error saving exercise records
          throw recordsError;
        }
        

      }
      
      // 3. Update user active plan
      const { data: planData, error: planError } = await supabase
        .from('user_active_plans')
        .select('completed_workouts, current_week, current_day')
        .eq('user_id', user.id)
        .eq('plan_id', planId)
        .eq('is_active', true)
        .single();
        
      if (planError) {
        // Error fetching active plan
        throw planError;
      }
      
      if (planData) {
        const { completed_workouts, current_week, current_day } = planData;
        let updatedWeek = current_week;
        let updatedCompleted = false;
        let updatedDay = current_day;
        
        // Check if this is a redone workout (started with forceStart parameter)
        const forceStartParam = params.forceStart;
        const isRedoWorkout = forceStartParam === 'true';
        
        // Only increment completed workouts count if this is NOT a redone workout
        let newCompletedWorkouts = completed_workouts || 0;
        if (!isRedoWorkout) {
          newCompletedWorkouts += 1;
          
          // Check if we should advance to the next week
          const workoutsPerWeek = 3; // 3 workouts per week based on requirements
          
          if (newCompletedWorkouts % workoutsPerWeek === 0) {
            // We've completed a full week
            if (current_week < 5) {
              // Advance to next week
              updatedWeek = current_week + 1;

            } else if (current_week === 5) {
              // We've completed the full 5-week cycle
              updatedCompleted = true;

            }
          }
          
          // Only update the current day if this is not a redone workout
          updatedDay = (current_day + 1) % workoutsPerWeek; // Cycle through 0, 1, 2
        } else {

        }
        
        // For redo workouts, we need to be careful about what we update
        // We should only update the last_workout_date and not change any progression values
        const updateData = isRedoWorkout ? {
          // For redo workouts, only update the last workout date
          last_workout_date: new Date().toISOString()
        } : {
          // For normal workouts, update all progression values
          completed_workouts: newCompletedWorkouts,
          current_week: updatedWeek,
          current_day: updatedDay,
          last_workout_date: new Date().toISOString(),
          completed: updatedCompleted
        };
        

        
        // Update the active plan
        const { error: updateError } = await supabase
          .from('user_active_plans')
          .update(updateData)
          // We're already storing workout metrics in user_workout_history
          .eq('user_id', user.id)
          .eq('plan_id', planId)
          .eq('is_active', true);
          
        if (updateError) {
          // Error updating active plan
          throw updateError;
        }
        

      }
      
      // Set completed workout data for display
      setCompletedWorkoutData({
        completedExercises: exercises.length,
        duration: workoutDurationMinutes,
        caloriesBurned: Math.round(workoutDurationMinutes * 8.5),
        totalVolume: finalVolume,
        totalReps: finalReps,
        completedAt: new Date().toISOString(),
        weekName: weekName,
        cycleWeek: cycleWeek
      });
      
      // Set workout as completed
      setIsWorkoutCompleted(true);
      setIsLoading(false);
      
      // We'll handle the navigation in the render function when isWorkoutCompleted is true
      // This prevents navigation issues and ensures consistent behavior

      
      // Also refresh the last exercise records after completing the workout
      // This ensures the data is up-to-date for the next time this exercise is performed
      await fetchLastExerciseRecords();
      
    } catch (error) {
      setIsLoading(false);
      // Error completing workout
      Alert.alert('Error', 'Failed to save workout data. Please try again.');
    }
  };
  
  // Function to restart the workout (for REDO WORKOUT button)
  const redoWorkout = async () => {

    
    // Store the current last exercise values before resetting
    const currentLastValues = {...lastExerciseValues};

    
    // Store the original cycle week before resetting
    // This ensures we use the correct cycle week when saving the workout history
    setOriginalCycleWeek(cycleWeek);

    
    setIsWorkoutCompleted(false);
    setCompletedWorkoutData(null);
    setWorkoutStartTime(new Date());
    setWorkoutTimerActive(true);
    setWorkoutDuration(0);
    setTotalVolume(0);
    setTotalReps(0);
    setCurrentExerciseIndex(0);
    
    // Reset all sets to not completed
    setExerciseSets(prev => {
      const resetSets = { ...prev };
      Object.keys(resetSets).forEach(exerciseId => {
        resetSets[exerciseId] = resetSets[exerciseId].map(set => ({
          ...set,
          isCompleted: false,
          weight: '',
          reps: ''
        }));
      });
      return resetSets;
    });
    
    // Immediately restore the last exercise values to ensure they're available
    // This prevents the values from disappearing during state updates
    setLastExerciseValues(currentLastValues);
    
    // Also fetch fresh data after a delay to ensure we have the latest records
    setTimeout(async () => {

      await fetchLastExerciseRecords();
    }, 1000); // Longer delay to ensure all state updates have completed
    
    // Start workout duration timer
    const workoutTimerInterval = setInterval(() => {
      setWorkoutDuration(prev => prev + 1);
    }, 1000);
    
    // Add cleanup for the timer
    return () => {
      clearInterval(workoutTimerInterval);
    };
  };

  const currentExercise = exercises[currentExerciseIndex];
  const currentSets = currentExercise ? exerciseSets[currentExercise.id] || [] : [];
  const currentRecommendation = currentExercise ? recommendations[currentExercise.id] : null;

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }
  
  // If workout is completed, navigate back to the plan screen
  if (isWorkoutCompleted && completedWorkoutData) {
    // Use setTimeout to ensure the navigation happens after state updates
    setTimeout(() => {
      // Navigate directly to the tabs layout with My Plan selected
      // This ensures we have the proper navigation structure with bottom tabs
      router.replace('/(tabs)/?selectedOption=My Plan');
    }, 100);
    
    // Show a loading indicator while navigating
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Workout completed! Returning to plan...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={[styles.headerContainer, { marginTop: insets.top }]}>
        <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Exit</Text>
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            EXERCISE {currentExerciseIndex + 1}/{exercises.length}
          </Text>
        </View>
        
        <TouchableOpacity style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Exercises</Text>
        </TouchableOpacity>
      </View>
      
      <Divider style={styles.divider} />
      
      {/* Timer Tabs */}
      <View style={styles.tabContainer}>
        <View style={styles.tabItem}>
          <Text style={styles.tabText}>Time</Text>
          <Text style={styles.tabValueText}>{formatTime(workoutDuration)}</Text>
        </View>
        <View style={styles.tabItem}>
          <Text style={styles.tabText}>Volume</Text>
          <Text style={styles.tabValueText}>{totalVolume.toFixed(1)} kg</Text>
        </View>
        <View style={styles.tabItem}>
          <Text style={styles.tabText}>Reps</Text>
          <Text style={styles.tabValueText}>{totalReps}</Text>
        </View>
      </View>
      
      {/* Main Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
        {/* Exercise Card */}
        <View style={styles.exerciseCard}>
          <View style={styles.exerciseRow}>
            <View style={styles.exerciseImageContainer}>
              <OptimizedImage
                source={currentExercise?.image_url ? { uri: currentExercise.image_url } : require('../../assets/exercises/placeholder.jpg')}
                style={styles.exerciseImage}
                fallback={require('../../assets/exercises/placeholder.jpg')}
                resizeMode="cover"
                cachePolicy="immutable"
              />
            </View>
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName}>
                {currentExercise?.name || 'Unknown Exercise'}
              </Text>
              {currentExercise?.primary_muscles && currentExercise.primary_muscles.length > 0 && (
                <View style={styles.muscleTag}>
                  <Text style={styles.muscleTagText}>{currentExercise.primary_muscles[0]}</Text>
                </View>
              )}
              <IconButton
                icon="information-outline"
                size={20}
                style={styles.infoButton}
                iconColor={COLORS.text}
                onPress={() => {/* Show exercise instructions */}}
              />
            </View>
          </View>
        </View>
        
        {/* Exercise Sets */}
        <View style={styles.setsContainer}>
          {currentSets.map((set, index) => {
            // Find the first incomplete set to make it active
            let activeSetIndex = currentSets.findIndex(s => !s.isCompleted);
            // If all sets are completed, no set should be active
            if (activeSetIndex === -1) activeSetIndex = currentSets.length;
            const isActive = index === activeSetIndex;
            const isCompleted = set.isCompleted;
            return (
              <View
                key={set.id}
                style={[
                  styles.setCard,
                  isActive && !isCompleted ? styles.activeSetCard : styles.inactiveSetCard,
                  isCompleted && styles.completedSetCard
                ]}
              >
                <View style={styles.setCardContent}>
                  {isActive && !isCompleted ? (
                    <View style={styles.activeSetCardContainer}>
                      <View style={styles.tableLayout}>
                        {/* Left Column: Contains Top Row (Weight/Reps) and Bottom Row (Label) */}
                        <View style={styles.leftColumn}>
                          {/* Top Row for Weight and Reps */}
                          <View style={styles.topContentRow}>
                            <View style={styles.weightCell}>
                              <View style={styles.inputContainer}>
                                <TextInput
                                  style={styles.inputField}
                                  value={set.weight}
                                  onChangeText={(value) => handleWeightChange(currentExercise.id, index, value)}
                                  keyboardType="decimal-pad"
                                  placeholder={focusedInputs[`${currentExercise.id}-${index}-weight`] ? '' : '-'}
                                  placeholderTextColor="rgba(255,255,255,0.5)"
                                  selectTextOnFocus={true}
                                  onFocus={() => handleInputFocus(`${currentExercise.id}-${index}-weight`)}
                                  onBlur={() => handleInputBlur(`${currentExercise.id}-${index}-weight`)}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                />
                                <Text style={styles.activeSetValueUnit}>kg</Text>
                              </View>
                              <Text style={styles.activeSetSubValue}>
                                {lastExerciseValues[currentExercise.exercise_id]?.[index + 1]?.weight 
                                  ? `(Last ${lastExerciseValues[currentExercise.exercise_id][index + 1].weight})` 
                                  : '(No previous data)'}
                              </Text>
                            </View>
                            <View style={styles.dividerContainer}>
                              <View style={styles.horizontalDivider} />
                            </View>
                            <View style={styles.repsCell}>
                              <View style={styles.inputContainer}>
                                <TextInput
                                  style={styles.inputField}
                                  value={set.reps}
                                  onChangeText={(value) => handleRepsChange(currentExercise.id, index, value)}
                                  keyboardType="numeric"
                                  placeholder={focusedInputs[`${currentExercise.id}-${index}-reps`] ? '' : (currentExercise.reps_range || '-')}
                                  placeholderTextColor="rgba(255,255,255,0.5)"
                                  selectTextOnFocus={true}
                                  onFocus={() => handleInputFocus(`${currentExercise.id}-${index}-reps`)}
                                  onBlur={() => handleInputBlur(`${currentExercise.id}-${index}-reps`)}
                                />
                                <Text style={styles.activeSetValueUnit}>reps</Text>
                              </View>
                              <Text style={styles.activeSetSubValue}>
                                {lastExerciseValues[currentExercise.exercise_id]?.[index + 1]?.reps 
                                  ? `(Last ${lastExerciseValues[currentExercise.exercise_id][index + 1].reps})` 
                                  : '(No previous data)'}
                              </Text>
                            </View>
                          </View>
                          {/* Bottom Row for Label */}
                          <View style={styles.bottomLabelRow}>
                            <Text style={styles.activeSetLabel}>Weight of bar + plates</Text>
                          </View>
                        </View>

                        {/* Main Vertical Divider between left column and Did It button */}
                        <View style={styles.mainVerticalDivider} />

                        {/* Right Column: Did It Button */}
                        <View style={styles.didItButtonCell}>
                          <TouchableOpacity 
                            style={{flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center'}}
                            onPress={() => handleSetComplete(currentExercise.id, index)}
                          >
                            <Text style={styles.didItTextSet}>Did It</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.inactiveSetCardContent}>
                      <View style={styles.inactiveWeightColumn}>
                        <View style={styles.inactiveInputContainer}>
                          <TextInput
                            style={[styles.inactiveInputField, isCompleted && styles.completedInputField]}
                            value={set.weight}
                            onChangeText={(value) => handleWeightChange(currentExercise.id, index, value)}
                            keyboardType="decimal-pad"
                            placeholder={focusedInputs[`${currentExercise.id}-${index}-weight`] ? '' : '-'}
                            placeholderTextColor="rgba(255,255,255,0.5)"
                            selectTextOnFocus={true}
                            onFocus={() => handleInputFocus(`${currentExercise.id}-${index}-weight`)}
                            onBlur={() => handleInputBlur(`${currentExercise.id}-${index}-weight`)}
                            editable={!isCompleted}
                          />
                          <Text style={styles.suggestedUnit}>kg</Text>
                        </View>
                      </View>
                      
                      <View style={styles.inactiveDivider} />
                      
                      <View style={styles.inactiveRepsColumn}>
                        <View style={styles.inactiveInputContainer}>
                          <TextInput
                            style={[styles.inactiveInputField, isCompleted && styles.completedInputField]}
                            value={set.reps}
                            onChangeText={(value) => handleRepsChange(currentExercise.id, index, value)}
                            keyboardType="numeric"
                            placeholder={focusedInputs[`${currentExercise.id}-${index}-reps`] ? '' : (currentExercise.reps_range || '-')}
                            placeholderTextColor="rgba(255,255,255,0.5)"
                            selectTextOnFocus={true}
                            onFocus={() => handleInputFocus(`${currentExercise.id}-${index}-reps`)}
                            onBlur={() => handleInputBlur(`${currentExercise.id}-${index}-reps`)}
                            editable={!isCompleted}
                          />
                          <Text style={styles.suggestedUnit}>reps</Text>
                        </View>
                      </View>
                      
                      <View style={styles.inactiveDivider} />
                      
                      <TouchableOpacity
                        style={[styles.playButtonSet, isCompleted && styles.redoButtonSet]}
                        onPress={() => {
                          if (isCompleted) {
                            // If completed, redo the set
                            handleRedoSet(currentExercise.id, index);
                          } else if (isActive) {
                            // If active but not completed, mark as complete
                            handleSetComplete(currentExercise.id, index);
                          }
                        }}
                        disabled={!isCompleted && !isActive}
                      >
                        <Ionicons 
                          name={isCompleted ? "reload" : "play"} 
                          size={20} 
                          color={COLORS.text} 
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
        
        {/* Log All Sets Button */}
        <Button
          mode="contained"
          style={styles.logAllButton}
          labelStyle={styles.logAllButtonText}
          onPress={() => handleLogAllSets(currentExercise.id)}
        >
          Log All Sets
        </Button>
        
        {/* Customize Exercise Link */}
        <TouchableOpacity style={styles.customizeLink}>
          <Text style={styles.customizeLinkText}>Customize Exercise</Text>
        </TouchableOpacity>
      </ScrollView>
      
      {/* Next Exercise Navigation */}
      <View style={styles.navigationFooter}>
        <View style={styles.navigationContent}>
          <Text style={styles.nextExerciseText}>Next Exercise</Text>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[styles.progressBarFill, { width: `${(currentExerciseIndex + 1) / exercises.length * 100}%` }]} 
              />
            </View>
          </View>
          <TouchableOpacity 
            style={styles.playButton}
            onPress={moveToNextExercise}
          >
            <Ionicons name="play" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingText: {
    color: COLORS.text,
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  completionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  backButtonContainer: {
    padding: SPACING.xs,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: SPACING.sm,
    // This is used in both the original and completed workout screens
  },
  calendarContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  weekText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
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
  shareButtonContainer: {
    padding: SPACING.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.sm,
  },
  statValue: {
    color: COLORS.primary,
    fontSize: 32,
    fontWeight: 'bold',
  },
  statLabel: {
    color: COLORS.text,
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.xs,
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
  redoButton: {
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  redoButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    height: 50,
    backgroundColor: COLORS.background,
  },
  headerButton: {
    padding: SPACING.xs,
  },
  headerButtonText: {
    color: COLORS.text,
    fontSize: 16,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: SPACING.xl,
  },
  divider: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    height: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tabItem: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.1)',
  },
  tabText: {
    color: COLORS.secondary,
    fontSize: 14,
    marginBottom: 4,
  },
  tabValueText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 100,
  },
  exerciseCard: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(30, 30, 40, 0.6)',
    borderRadius: BORDER_RADIUS.sm,
    margin: SPACING.md,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseImageContainer: {
    marginRight: SPACING.md,
  },
  exerciseImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surface,
  },
  exerciseInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  muscleTag: {
    backgroundColor: '#FFD700',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  muscleTagText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    margin: 0,
  },
  sectionLabel: {
    color: COLORS.secondary,
    fontSize: 14,
    marginBottom: SPACING.xs,
  },

  sampleOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
  sampleText: {
    position: 'absolute',
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 18,
    textAlign: 'center',
    width: '100%',
    transform: [{ rotate: '-10deg' }],
    top: 5,
  },
  setsContainer: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  setCard: {
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    minHeight: 70,
  },
  activeSetCard: {
    backgroundColor: COLORS.primary,
  },
  inactiveSetCard: {
    backgroundColor: COLORS.surface,
  },
  completedSetCard: {
    opacity: 0.5,
  },
  setCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
  },
  setNumber: {
    fontWeight: 'bold',
    fontSize: 18,
    marginRight: SPACING.md,
    color: COLORS.text,
  },
  weightInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.onSurface,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.md,
    paddingHorizontal: SPACING.xs,
    flex: 1,
  },
  activeSetCardContainer: {
    width: '100%',
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.primary, // Ensure card background is set
  },
  tableLayout: {
    flexDirection: 'row',
    // Height will be determined by content, ensure leftColumn and didItButtonCell align
  },
  leftColumn: {
    flex: 1, // Takes up space not used by the button and its divider
    flexDirection: 'column',
  },
  topContentRow: {
    flexDirection: 'row',
    height: 75, // Example height, adjust as needed for content
    alignItems: 'stretch', // Ensure cells and divider stretch vertically
  },
  weightCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  dividerContainer: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  horizontalDivider: {
    width: 0.5,
    height: '70%',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  repsCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  bottomLabelRow: {
    height: 25, // Example height, adjust as needed for content
    paddingVertical: 1,
    paddingHorizontal: SPACING.md,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  mainVerticalDivider: {
    width: 0.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  didItButtonCell: {
    width: 80,
    backgroundColor: COLORS.primary, 
    justifyContent: 'center',
    alignItems: 'center',
    // Height will stretch to match leftColumn due to tableLayout's alignItems: 'stretch' (default for row)
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    minHeight: 44, // Increase minimum height for better touch area
    columnGap: 0, // Remove gap between input and unit label
  },
  inputField: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'transparent',
    padding: 8, // Add padding for better touch area
    paddingRight: 0, // Reduced right padding to bring value closer to unit
    height: 44,
    minHeight: 44,
    minWidth: 60, // Ensure minimum width for better touch area
  },
  inputContainerStyle: {
    borderBottomWidth: 0,
  },

  inactiveInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
    minHeight: 44, // Increase minimum height for better touch area
    columnGap: 0, // Remove gap between input and unit label
  },
  inactiveInputField: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'transparent',
    padding: 8, // Add padding for better touch area
    paddingRight: 0, // Reduced right padding to bring value closer to unit
    height: 40,
    minHeight: 40,
    minWidth: 50, // Ensure minimum width for better touch area
  },
  completedInputField: {
    opacity: 0.5,
  },
  inactiveInputContainerStyle: {
    borderBottomWidth: 0,
  },

  activeSetValueUnit: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginLeft: 4, // Reduced from 5 to 2
    color: 'rgba(255, 255, 255, 0.52)',
  },
  activeSetSubValue: {
    color: COLORS.text,
    fontSize: 12,
    opacity: 0.8,
    marginTop: 2,
    textAlign: 'center',
  },
  activeSetLabel: {
    color: COLORS.text,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 0,
  },
  didItTextSet: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
  inactiveSetCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 80,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
  },
  inactiveWeightColumn: {
    width: '40%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  inactiveRepsColumn: {
    width: '40%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  inactiveDivider: {
    height: '50%',
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
  },
  suggestedColumnContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestedUnit: {
    fontSize: 14,
    fontWeight: 'normal',
    marginTop: 10,
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 4, // Reduced from 5 to 2
  },
  playButtonSet: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.md,
  },
  redoButtonSet: {
    backgroundColor: COLORS.secondary,
  },
  logAllButton: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
  },
  logAllButtonText: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  customizeLink: {
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  customizeLinkText: {
    color: COLORS.primary,
    fontSize: 14,
  },
  navigationFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingVertical: SPACING.sm,
  },
  navigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  nextExerciseText: {
    color: COLORS.text,
    fontSize: 14,
  },
  progressBarContainer: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});