import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, FlatList, Pressable, Dimensions, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, Button, Divider } from 'react-native-paper';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import supabase from '../services/supabase';
import workoutPlanService from '../services/workoutPlanService';
import { useAuth } from '../store/AuthContext';
import OptimizedImage from '../components/OptimizedImage';
import ExerciseMaxWeightGraph from '../components/ExerciseMaxWeightGraph';
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

// Add interface for max weight data
interface MaxWeightDataPoint {
  date: string;
  value: number;
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
  
  // State for max weight graph data
  const [maxWeightData, setMaxWeightData] = useState<Record<string, MaxWeightDataPoint[]>>({});
  const [absoluteMaxWeightData, setAbsoluteMaxWeightData] = useState<Record<string, { weight: number, reps: number, date: string }>>({});
  
  // State for workout completion
  const [isWorkoutCompleted, setIsWorkoutCompleted] = useState(false);
  const [completedWorkoutData, setCompletedWorkoutData] = useState<{
    completedExercises: number;
    duration: string;
    caloriesBurned: number;
    totalVolume: number;
    totalReps: number;
    completedAt: string;
    weekName: string;
    cycleWeek: number;
  } | null>(null);
  
  // Add warmup state
  const [showWarmup, setShowWarmup] = useState(true);
  const [warmupCompleted, setWarmupCompleted] = useState(false);
  
  // State for exit modal
  const [showExitModal, setShowExitModal] = useState(false);
  
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
  const fetchLastExerciseRecords = useCallback(async () => {
    if (!user) return;
    if (exercises.length === 0) {
      return;
    }
    
    try {
      // Use the service function to fetch last exercise records
      const lastValues = await workoutPlanService.fetchLastExerciseRecords(user.id, exercises);
      
      if (Object.keys(lastValues).length > 0) {
        setLastExerciseValues(lastValues);
      }
    } catch (error) {
      // Error in fetchLastExerciseRecords
    }
  }, [user?.id, exercises]);
  
  // Function to fetch max weight data for current exercise
  const fetchMaxWeightData = useCallback(async () => {
    if (!user || exercises.length === 0 || currentExerciseIndex < 0) return;
    
    try {
      const currentExercise = exercises[currentExerciseIndex];
      
      if (currentExercise?.exercise_id) {
        // Fetch trending data
        const trendingData = await workoutPlanService.fetchExerciseMaxWeightData(
          user.id, 
          currentExercise.exercise_id, 
          6 // Get last 6 data points
        );
        
        // Fetch absolute max weight
        const absoluteMaxData = await workoutPlanService.fetchExerciseAbsoluteMaxWeight(
          user.id,
          currentExercise.exercise_id
        );
        
        if (trendingData.length > 0) {
          setMaxWeightData(prev => ({
            ...prev,
            [currentExercise.exercise_id]: trendingData
          }));
        }
        
        if (absoluteMaxData) {
          setAbsoluteMaxWeightData(prev => ({
            ...prev,
            [currentExercise.exercise_id]: absoluteMaxData
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching max weight data:', error);
    }
  }, [user?.id, exercises, currentExerciseIndex]);
  
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
  }, [exercises, user, fetchLastExerciseRecords]);
  
  // Effect to fetch max weight data when current exercise changes
  useEffect(() => {
    if (exercises.length > 0 && user && currentExerciseIndex >= 0) {
      fetchMaxWeightData();
    }
  }, [currentExerciseIndex, exercises, user, fetchMaxWeightData]);

  useEffect(() => {
    // Check if workout is already completed for today, but skip if forceStart is true
    if (!forceStart) {
      // Get forceResume parameter from URL
      const forceResume = params.forceResume === 'true';
      
      if (forceResume) {
        // If forceResume is true, directly try to load and resume the paused workout
        const resumePausedWorkoutDirectly = async () => {
          try {
            setIsLoading(true);
            
            // Try to get the paused workout
            const pausedWorkout = await workoutPlanService.getPausedWorkout(
              user?.id || '',
              planId,
              workoutDay
            );
            
            if (pausedWorkout) {
              // Directly resume the paused workout
              resumePausedWorkout(pausedWorkout);
            } else {
              // No paused workout found, fetch workout data normally
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
          } catch (error) {
            // If there's an error, fetch workout data normally
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
        };
        
        resumePausedWorkoutDirectly();
      } else {
        // Normal flow - check if workout is completed or paused
        checkWorkoutCompletion();
      }
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
  
  // Function to fetch workout data
  const fetchWorkoutData = async () => {
    if (!planId || isNaN(workoutDay) || !user) {
      Alert.alert('Error', 'Invalid workout parameters');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Use the service function to fetch workout data
      const { exercises: formattedExercises, exerciseSets: initialSets, recommendations } = 
        await workoutPlanService.fetchWorkoutData(planId, workoutDay, user.id, cycleWeek);
      
      // Set exercises state
      setExercises(formattedExercises);
      
      // Set exercise sets state
      setExerciseSets(initialSets);
      
      // Set recommendations state
      setRecommendations(recommendations);
      
      // Fetch last exercise records to show previous values
      await fetchLastExerciseRecords();
      
      // Fetch max weight data for current exercise
      await fetchMaxWeightData();
      
      setIsLoading(false);
    } catch (error) {
      // Error fetching workout data
      setIsLoading(false);
      Alert.alert('Error', 'Failed to load workout data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // This function only checks if workout is completed without paused workout logic
  const checkWorkoutCompletionOnly = async () => {
    if (!user || !planId) return;
    
    try {
      // Use the service function to check workout completion
      const { isCompleted, completedWorkoutData } = await workoutPlanService.checkWorkoutCompletion(
        user.id,
        planId,
        workoutDay
      );
      
      if (isCompleted && completedWorkoutData) {
        // Workout is already completed
        setIsWorkoutCompleted(true);
        setCompletedWorkoutData(completedWorkoutData);
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
  
  // Function to resume a paused workout
  const resumePausedWorkout = (pausedWorkout: any) => {
    try {
      // Set all the workout state from the paused workout
      setExercises(pausedWorkout.exercises);
      setExerciseSets(pausedWorkout.exerciseSets);
      setCurrentExerciseIndex(pausedWorkout.currentExerciseIndex);
      setWorkoutDuration(pausedWorkout.workoutDuration);
      setTotalVolume(pausedWorkout.totalVolume);
      setTotalReps(pausedWorkout.totalReps);
      
      if (pausedWorkout.originalCycleWeek !== null) {
        setOriginalCycleWeek(pausedWorkout.originalCycleWeek);
      }
      
      // Fetch additional data
      fetchLastExerciseRecords();
      fetchMaxWeightData();
      
      // Start the workout timer
      setWorkoutStartTime(new Date());
      setWorkoutTimerActive(true);
      
      // Start workout duration timer
      const workoutTimerInterval = setInterval(() => {
        setWorkoutDuration(prev => prev + 1);
      }, 1000);
      
      // Remove the warmup popup if we're resuming
      setWarmupCompleted(true);
      setShowWarmup(false);
      
      setIsLoading(false);
      
      // Clear the paused workout since we're resuming it now
      workoutPlanService.clearPausedWorkout(user?.id, planId, workoutDay);
      
      // Add cleanup for the timer
      return () => {
        clearInterval(workoutTimerInterval);
      };
    } catch (error) {
      // If resuming fails, just start a new workout
      setIsLoading(false);
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
  
  // Check if workout is already completed for today
  const checkWorkoutCompletion = async () => {
    if (!user || !planId) return;
    
    try {
      setIsLoading(true);
      
      // First check if there's a paused workout to resume
      const pausedWorkout = await workoutPlanService.getPausedWorkout(
        user.id,
        planId,
        workoutDay
      );
      
      if (pausedWorkout) {
        // No longer show the alert dialog - directly resume the paused workout
        // since the user explicitly chose to resume by clicking the Resume button
        resumePausedWorkout(pausedWorkout);
      } else {
        // No paused workout, continue with normal flow
        checkWorkoutCompletionOnly();
      }
    } catch (error) {
      setIsLoading(false);
      // If there's an error, proceed with normal workout
      checkWorkoutCompletionOnly();
    }
  };

  const handleBackPress = () => {
    setShowExitModal(true);
  };

  const handleExitWorkout = () => {
    setShowExitModal(false);
    router.back();
  };

  const handlePauseWorkout = async () => {
    setShowExitModal(false);
    
    try {
      setIsLoading(true);
      
      // Save the current workout state
      const success = await workoutPlanService.savePausedWorkout(
        user?.id || '',
        planId,
        workoutDay,
        cycleWeek,
        weekName,
        exercises,
        exerciseSets,
        workoutDuration,
        totalVolume,
        totalReps,
        currentExerciseIndex,
        originalCycleWeek
      );
      
      if (success) {
        Alert.alert(
          'Workout Paused', 
          'Your workout has been saved. You can resume it later from the workout plan screen.',
          [{ 
            text: 'OK',
            onPress: () => {
              // Stop the workout timer
              setWorkoutTimerActive(false);
              
              // Navigate back to home screen
              router.replace('/');
            }
          }]
        );
      } else {
        Alert.alert(
          'Error',
          'Failed to pause your workout. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to pause your workout. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReturnToWorkout = () => {
    setShowExitModal(false);
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
    if (!user || !planId) return;
    
    // Stop the workout timer
    setWorkoutTimerActive(false);
    
    // Use override values if provided, otherwise fall back to state values
    // This ensures we capture the most up-to-date values including the last set
    const finalDuration = workoutDuration;
    const finalVolume = overrideVolume !== undefined ? overrideVolume : totalVolume;
    const finalReps = overrideReps !== undefined ? overrideReps : totalReps;
    
    try {
      // Show loading indicator
      setIsLoading(true);
      
      // Check if this is a redone workout (started with forceStart parameter)
      const forceStartParam = params.forceStart;
      const isRedoWorkout = forceStartParam === 'true';
      
      // Use the service function to complete the workout
      const success = await workoutPlanService.completeWorkout(
        user.id,
        planId,
        workoutDay,
        cycleWeek,
        weekName,
        exercises,
        exerciseSets,
        finalDuration,
        finalVolume,
        finalReps,
        isRedoWorkout,
        originalCycleWeek
      );
      
      if (success) {
        // Calculate workout duration in minutes for display
        const workoutDurationMinutes = Math.round(finalDuration / 60);
        
        // Set completed workout data for display
        setCompletedWorkoutData({
          completedExercises: exercises.length,
          duration: formatTime(finalDuration),
          caloriesBurned: Math.round(workoutDurationMinutes * 8.5),
          totalVolume: finalVolume,
          totalReps: finalReps,
          completedAt: new Date().toISOString(),
          weekName: weekName,
          cycleWeek: cycleWeek
        });
        
        // Set workout as completed
        setIsWorkoutCompleted(true);
        
        // Also refresh the last exercise records after completing the workout
        // This ensures the data is up-to-date for the next time this exercise is performed
        await fetchLastExerciseRecords();
      } else {
        // Error completing workout
        Alert.alert('Error', 'Failed to save workout data. Please try again.');
      }
      
      setIsLoading(false);
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

  // Function to handle warmup completion
  const handleWarmupComplete = () => {
    setWarmupCompleted(true);
    setShowWarmup(false);
    // The first set will automatically become active due to the logic in the render method
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
      // Navigate back to home screen
      router.replace('/');
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
        
        {/* Max Weight Progress Graph - separate container with small spacing */}
        {currentExercise && (
          <View style={styles.maxWeightGraphContainer}>
            <ExerciseMaxWeightGraph
              data={maxWeightData[currentExercise.exercise_id] || []}
              exerciseName={currentExercise.name}
              absoluteMaxWeight={absoluteMaxWeightData[currentExercise.exercise_id] || null}
            />
          </View>
        )}
        
        {/* Exercise Sets */}
        <View style={styles.setsContainer}>
          {currentSets.map((set, index) => {
            // Find the first incomplete set to make it active
            let activeSetIndex = currentSets.findIndex(s => !s.isCompleted);
            // If all sets are completed, no set should be active
            if (activeSetIndex === -1) activeSetIndex = currentSets.length;
            
            // If warmup is showing and not completed, no set should be active
            if (showWarmup && !warmupCompleted) {
              activeSetIndex = -1; // No set is active when warmup is showing
            }
            
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
                        {/* Left Column: Weight and Reps stacked vertically */}
                        <View style={styles.leftColumn}>
                          {/* Weight and Reps Cell - both inputs in same cell */}
                          <View style={styles.weightRepsCell}>
                            <View style={styles.inputRow}>
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
                              
                              <View style={styles.inputDivider} />
                              
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
                            </View>
                            
                            {/* Last values row - split under each input */}
                            {(lastExerciseValues[currentExercise.exercise_id]?.[index + 1]?.weight || 
                              lastExerciseValues[currentExercise.exercise_id]?.[index + 1]?.reps) && (
                              <View style={styles.lastValuesRow}>
                                <View style={styles.lastValueContainer}>
                                  {lastExerciseValues[currentExercise.exercise_id]?.[index + 1]?.weight && (
                                    <Text style={styles.activeSetSubValue}>
                                      ( Last {lastExerciseValues[currentExercise.exercise_id][index + 1]?.weight} )
                                    </Text>
                                  )}
                                </View>
                                
                                <View style={styles.lastValueSpacer} />
                                
                                <View style={styles.lastValueContainer}>
                                  {lastExerciseValues[currentExercise.exercise_id]?.[index + 1]?.reps && (
                                    <Text style={styles.activeSetSubValue}>
                                      ( Last {lastExerciseValues[currentExercise.exercise_id][index + 1]?.reps} )
                                    </Text>
                                  )}
                                </View>
                              </View>
                            )}
                          </View>

                          {/* Horizontal Divider */}
                          <View style={styles.horizontalDivider} />

                          {/* Label Cell */}
                          <View style={styles.labelCell}>
                            <Text style={styles.activeSetLabel}>Weight of bar + plates</Text>
                          </View>
                        </View>

                        {/* Vertical Divider */}
                        <View style={styles.mainVerticalDivider} />

                        {/* Button Cell - spans full height */}
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
                      {/* Left Cell: Weight and Reps inputs */}
                      <View style={styles.inactiveLeftCell}>
                        <View style={styles.inactiveInputRow}>
                          <View style={styles.inputContainer}>
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
                          
                          <View style={styles.inactiveInputDivider} />
                          
                          <View style={styles.inputContainer}>
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
                      </View>
                      
                      {/* Vertical Divider */}
                      <View style={styles.inactiveVerticalDivider} />
                      
                      {/* Right Cell: Button */}
                      <View style={styles.inactiveButtonCell}>
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
        
        {/* Next Exercise Preview - moved inside ScrollView */}
        <View style={styles.nextExerciseSection}>
          <Text style={styles.nextExerciseLabel}>Next Exercise</Text>
          
          {currentExerciseIndex < exercises.length - 1 && (
            <TouchableOpacity 
              style={styles.nextExerciseCard}
              onPress={moveToNextExercise}
            >
              <View style={styles.nextExerciseImageContainer}>
                {exercises[currentExerciseIndex + 1]?.image_url ? (
                  <OptimizedImage
                    source={{ uri: exercises[currentExerciseIndex + 1].image_url }}
                    style={styles.nextExerciseImage}
                    fallback={require('../../assets/exercises/placeholder.jpg')}
                    resizeMode="cover"
                    cachePolicy="immutable"
                  />
                ) : (
                  <View style={styles.nextExercisePlaceholder}>
                    <Ionicons name="barbell-outline" size={24} color={COLORS.text} />
                  </View>
                )}
              </View>
              
              <View style={styles.nextExerciseInfo}>
                <Text style={styles.nextExerciseName}>
                  {exercises[currentExerciseIndex + 1]?.name || 'Next Exercise'}
                </Text>
                <Text style={styles.nextExerciseDetails}>
                  {exercises[currentExerciseIndex + 1]?.sets || 4} sets x {exercises[currentExerciseIndex + 1]?.reps_range || '8-10'} reps
                  {exercises[currentExerciseIndex + 1] && exercises[currentExerciseIndex + 1].exercise_id && 
                    lastExerciseValues[exercises[currentExerciseIndex + 1].exercise_id]?.[1]?.weight && 
                    ` x ${lastExerciseValues[exercises[currentExerciseIndex + 1].exercise_id][1].weight} kg`}
                </Text>
              </View>
              
              {/* Display primary muscle as text tag */}
              {(() => {
                const nextExercise = exercises[currentExerciseIndex + 1];
                if (nextExercise?.primary_muscles && nextExercise.primary_muscles.length > 0) {
                  return (
                    <View style={styles.nextExerciseMuscleTag}>
                      <Text style={styles.nextExerciseMuscleText}>
                        {nextExercise.primary_muscles[0]}
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}
            </TouchableOpacity>
          )}
          
          {currentExerciseIndex === exercises.length - 1 && (
            <TouchableOpacity 
              style={[styles.nextExerciseCard, styles.completeWorkoutCard]}
              onPress={() => completeWorkout()}
            >
              <Text style={styles.completeWorkoutText}>Complete Workout</Text>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.text} />
            </TouchableOpacity>
          )}
          
          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[styles.progressBarFill, { width: `${(currentExerciseIndex + 1) / exercises.length * 100}%` }]} 
              />
            </View>
          </View>
        </View>
      </ScrollView>
      
      {/* Warmup Modal */}
      <Modal
        visible={showWarmup && !warmupCompleted}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={['#121418', '#0A0C10']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalContent}>
                {/* Header with Icon */}
                <View style={styles.modalHeader}>
                  <View style={styles.warmupIconContainer}>
                    <Ionicons name="flame" size={32} color={COLORS.text} />
                  </View>
                  <View style={styles.headerTextContainer}>
                    <Text style={styles.modalTitle}>Exercise Warmup</Text>
                    <Text style={styles.modalSubtitle}>Prepare your muscles for {currentExercise?.name || 'the workout'}</Text>
                  </View>
                </View>
                
                {/* Instructions */}
                <View style={styles.warmupInstructionsContainer}>
                  <Text style={styles.instructionsTitle}>Warmup Protocol:</Text>
                  
                  <View style={styles.instructionsList}>
                    <View style={styles.instructionItem}>
                      <View style={styles.instructionNumber}>
                        <Text style={styles.instructionNumberText}>1</Text>
                      </View>
                      <View style={styles.instructionContent}>
                        <Text style={styles.instructionText}>5 reps with light weight</Text>
                        <Text style={styles.instructionSubtext}>Focus on form and range of motion</Text>
                      </View>
                    </View>
                    
                    <View style={styles.instructionItem}>
                      <View style={styles.instructionNumber}>
                        <Text style={styles.instructionNumberText}>2</Text>
                      </View>
                      <View style={styles.instructionContent}>
                        <Text style={styles.instructionText}>3 reps with medium weight</Text>
                        <Text style={styles.instructionSubtext}>Gradually increase intensity</Text>
                      </View>
                    </View>
                  </View>
                </View>
                
                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={styles.skipButton}
                    onPress={handleWarmupComplete}
                  >
                    <Text style={styles.skipButtonText}>Skip</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.modalButton}
                    onPress={handleWarmupComplete}
                  >
                    <View style={styles.buttonContent}>
                      <Ionicons name="checkmark" size={20} color={COLORS.primary} style={styles.buttonIcon} />
                      <Text style={styles.modalButtonText}>Complete</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
      
      {/* Exit Workout Modal */}
      <Modal
        visible={showExitModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowExitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.exitModalContainer]}>
            <LinearGradient
              colors={['#121418', '#0A0C10']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalContent}>
                {/* Header with just title */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Exit Workout?</Text>
                </View>
                
                {/* Action Buttons */}
                <View style={styles.exitModalActions}>
                  {/* End Workout Button */}
                  <TouchableOpacity 
                    style={styles.exitModalButton}
                    onPress={handleExitWorkout}
                  >
                    <View style={styles.exitButtonContent}>
                      <Ionicons name="close-circle" size={24} color="#FF5252" style={styles.exitButtonIcon} />
                      <View style={styles.exitButtonTextContainer}>
                        <Text style={styles.exitButtonTitle}>End Workout</Text>
                        <Text style={styles.exitButtonSubtitle}>Discard progress</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  
                  {/* Pause Workout Button */}
                  <TouchableOpacity 
                    style={styles.exitModalButton}
                    onPress={handlePauseWorkout}
                  >
                    <View style={styles.exitButtonContent}>
                      <Ionicons name="pause-circle" size={24} color="#FFC107" style={styles.exitButtonIcon} />
                      <View style={styles.exitButtonTextContainer}>
                        <Text style={styles.exitButtonTitle}>Pause Workout</Text>
                        <Text style={styles.exitButtonSubtitle}>Save progress for later</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  
                  {/* Return Button */}
                  <TouchableOpacity 
                    style={[styles.exitModalButton, styles.returnButton]}
                    onPress={handleReturnToWorkout}
                  >
                    <View style={styles.exitButtonContent}>
                      <Ionicons name="arrow-back-circle" size={24} color={COLORS.primary} style={styles.exitButtonIcon} />
                      <View style={styles.exitButtonTextContainer}>
                        <Text style={styles.exitButtonTitle}>Return to Workout</Text>
                        <Text style={styles.exitButtonSubtitle}>Continue current session</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 24,
  },
  exerciseCard: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.md,
    marginLeft: SPACING.md,
    marginRight: SPACING.md,
    marginBottom: 0,
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
  setsContainer: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.xs,
  },
  setCard: {
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
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
  activeSetCardContainer: {
    width: '100%',
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.primary,
  },
  tableLayout: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 160,
  },
  leftColumn: {
    flex: 1,
    flexDirection: 'column',
  },
  weightRepsCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: SPACING.xl,
  },
  labelCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: SPACING.sm,
  },
  horizontalDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: SPACING.md,
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
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    minHeight: 44,
    columnGap: 0,
  },
  inputField: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'transparent',
    padding: 8,
    paddingRight: 0,
    height: 44,
    minHeight: 44,
    minWidth: 60,
  },
  inactiveInputField: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'transparent',
    padding: 8,
    paddingRight: 0,
    height: 40,
    minHeight: 40,
    minWidth: 60,
  },
  completedInputField: {
    opacity: 0.5,
  },
  activeSetValueUnit: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginLeft: 4,
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
    fontSize: 14,
    textAlign: 'left',
    fontWeight: '500',
    marginTop: 0,
    marginLeft: SPACING.sm,
  },
  didItTextSet: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
  inactiveSetCardContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    height: 80,
    paddingLeft: 0,
    paddingRight: 0,
  },
  inactiveLeftCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: SPACING.lg,
  },
  inactiveInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  inactiveInputDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: SPACING.xxl,
  },
  inactiveVerticalDivider: {
    width: 0.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  inactiveButtonCell: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestedUnit: {
    fontSize: 14,
    fontWeight: 'normal',
    marginTop: 10,
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 4,
  },
  maxWeightGraphContainer: {
    marginTop: 0,
    marginBottom: 0,
  },
  nextExerciseSection: {
    backgroundColor: COLORS.background,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  nextExerciseLabel: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  nextExerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.xs,
    justifyContent: 'space-between',
  },
  nextExerciseImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: SPACING.md,
  },
  nextExerciseImage: {
    width: '100%',
    height: '100%',
  },
  nextExercisePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextExerciseInfo: {
    flex: 1,
  },
  nextExerciseName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  nextExerciseDetails: {
    color: COLORS.text,
    fontSize: 14,
    opacity: 0.8,
  },
  nextExerciseMuscleTag: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
    alignSelf: 'center',
  },
  nextExerciseMuscleText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
  completeWorkoutCard: {
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  completeWorkoutText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: SPACING.md,
  },
  progressBarContainer: {
    marginTop: 0,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  modalContainer: {
    backgroundColor: 'transparent',
    borderRadius: BORDER_RADIUS.lg,
    width: '90%',
    maxWidth: 400,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    borderWidth: 0.2,
    borderColor: COLORS.primary,
  },
  modalGradient: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
  },
  modalContent: {
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
    width: '100%',
  },
  warmupIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 30,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  headerTextContainer: {
    alignItems: 'center',
    width: '100%',
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: COLORS.text,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.9,
  },
  warmupInstructionsContainer: {
    width: '100%',
    marginBottom: SPACING.xl,
  },
  instructionsTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  instructionsList: {
    width: '100%',
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  instructionNumber: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  instructionNumberText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  instructionContent: {
    flex: 1,
  },
  instructionText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  instructionSubtext: {
    color: COLORS.text,
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: SPACING.md,
  },
  skipButton: {
    backgroundColor: 'rgba(30, 35, 45, 0.8)',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    flex: 1,
    alignItems: 'center',
  },
  skipButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: 'rgba(30, 35, 45, 0.8)',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    flex: 1,
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonIcon: {
    marginRight: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  modalButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
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
    marginVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
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
  lastValuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  lastValueContainer: {
    flex: 1,
    alignItems: 'center',
  },
  lastValueSpacer: {
    width: SPACING.xs,
  },
  exitModalContainer: {
    width: '90%',
    maxWidth: 400,
    borderWidth: 0.2,
    borderColor: COLORS.primary,
  },
  exitIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 30,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  exitModalActions: {
    width: '100%',
    gap: SPACING.md,
    alignItems: 'center',
  },
  exitModalButton: {
    backgroundColor: 'rgba(30, 35, 45, 0.8)',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    width: '90%',
    alignSelf: 'center',
  },
  exitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  exitButtonIcon: {
    marginRight: SPACING.md,
    marginLeft: SPACING.xs,
  },
  exitButtonTextContainer: {
    alignItems: 'center',
    width: '60%',
  },
  exitButtonTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  exitButtonSubtitle: {
    color: COLORS.text,
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  returnButton: {
    // Background color is already in exitModalButton
  },
});