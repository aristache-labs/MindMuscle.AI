import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, FlatList, Pressable, Dimensions, Modal, Keyboard, Platform, KeyboardAvoidingView } from 'react-native';
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
import ExerciseDetailsModal from '../components/ExerciseDetailsModal';
import ExerciseListModal from '../components/ExerciseListModal';
import CustomizeExerciseModal from '../components/CustomizeExerciseModal';
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
  requires_weight?: boolean; // Add this field to indicate if exercise requires weight
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
  const [userEnteredValues, setUserEnteredValues] = useState<Record<string, boolean>>({});
  const [exerciseCustomized, setExerciseCustomized] = useState<Record<string, boolean>>({});
  const [cycleWeekInfo, setCycleWeekInfo] = useState<{
    weekNumber: number;
    weekName: string;
    weightAdjustmentPercentage: number;
    repsAdjustmentPercentage: number;
  } | null>(null);

  
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
  
  // State for exercise details modal
  const [showExerciseDetailsModal, setShowExerciseDetailsModal] = useState(false);
  
  // State for exercise list modal
  const [showExerciseListModal, setShowExerciseListModal] = useState(false);
  const [initialSelectedExercise, setInitialSelectedExercise] = useState<number | null>(null);
  
  // State for customize exercise modal
  const [showCustomizeExerciseModal, setShowCustomizeExerciseModal] = useState(false);
  
  // State to force TextInput re-render when exercise is customized
  const [textInputRefreshKey, setTextInputRefreshKey] = useState(0);
  
  // State for keyboard handling
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [activeInputPosition, setActiveInputPosition] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Extract params early so they can be used in callbacks
  const planId = params.planId as string;
  const workoutDay = parseInt(params.workoutDay as string, 10);
  const cycleWeek = parseInt(params.cycleWeek as string, 10) || 1;
  const weekName = params.weekName as string || 'Adaptation';
  
  // Add workout state management
  const [workoutState, setWorkoutState] = useState<'in_progress' | 'completing' | 'completed'>('in_progress');
  
  // Functions to handle input focus and blur
  const handleInputFocus = (id: string, event?: any) => {
    setFocusedInputs(prev => ({
      ...prev,
      [id]: true
    }));
    
    // Measure the position of the focused input with a delay to ensure layout is complete
    if (event?.target) {
      // Store the target reference before the timeout
      const targetRef = event.target;
      
      setTimeout(() => {
        if (targetRef) {
          targetRef.measureInWindow((x: number, y: number, width: number, height: number) => {
            // Store the input center position for better calculation
            const inputCenterPosition = y + (height / 2);
            setActiveInputPosition(inputCenterPosition);
            
            // If keyboard is already visible, trigger immediate scroll with improved calculation
            if (keyboardHeight > 0 && scrollViewRef.current) {
              const screenHeight = Dimensions.get('window').height;
              const statusBarHeight = Platform.OS === 'ios' ? 44 : 24;
              const headerHeight = 60;
              const tabBarHeight = 0;
              
                             // Calculate the visible area above keyboard
               const visibleHeight = screenHeight - keyboardHeight - statusBarHeight - headerHeight - tabBarHeight;
               
               // Dynamic positioning based on input location - lower inputs get positioned higher up
               const currentInputPosition = inputCenterPosition - statusBarHeight - headerHeight;
               const contentHeight = screenHeight - statusBarHeight - headerHeight; // Total scrollable content area
               const inputRelativePosition = currentInputPosition / contentHeight; // 0 = top, 1 = bottom
               
               // For inputs in lower half of content, position them higher up (50-60% of visible area)
               // For inputs in upper half, position them lower (70-80% of visible area)
               let targetPositionRatio;
               if (inputRelativePosition > 0.6) {
                 // Lower content - position at 50% of visible area (more aggressive scroll up)
                 targetPositionRatio = 0.5;
               } else if (inputRelativePosition > 0.3) {
                 // Middle content - position at 60% of visible area
                 targetPositionRatio = 0.6;
               } else {
                 // Upper content - position at 70% of visible area (less aggressive)
                 targetPositionRatio = 0.7;
               }
               
               const targetInputPosition = visibleHeight * targetPositionRatio;
               
               // Calculate how much we need to scroll
               const scrollOffset = currentInputPosition - targetInputPosition;
               
               // Ensure we don't scroll to negative values
               const targetScrollY = Math.max(0, scrollOffset);
              
              scrollViewRef.current.scrollTo({
                y: targetScrollY,
                animated: true,
              });
            }
          });
        }
      }, 50); // Reduced delay for faster response
    }
  };
  
  const handleInputBlur = (id: string) => {
    setFocusedInputs(prev => ({
      ...prev,
      [id]: false
    }));
    setActiveInputPosition(0);
  };

  // Function to auto-fill the next incomplete set with specific values
  const autoFillNextIncompleteSetWithValues = (exerciseId: string, currentSetIndex: number, weightValue: string, repsValue: string) => {
    setExerciseSets(prev => {
      const currentSets = prev[exerciseId];
      if (!currentSets) return prev;
      
      // Find the next incomplete set (not just the immediate next set)
      const nextIncompleteSetIndex = currentSets.findIndex((set, index) => 
        index > currentSetIndex && !set.isCompleted
      );
      
      // If no incomplete set found, try to find ANY incomplete set (for redo scenarios)
      const anyIncompleteSetIndex = nextIncompleteSetIndex !== -1 ? 
        nextIncompleteSetIndex : 
        currentSets.findIndex(set => !set.isCompleted);
      
      if (anyIncompleteSetIndex === -1) {
        return prev;
      }
      
      const currentExercise = exercises.find(ex => ex.id === exerciseId);
      if (!currentExercise) return prev;
      
      // Check if current set has valid values
      const hasValidWeight = currentExercise.requires_weight !== false && weightValue !== '' && weightValue !== '-';
      const hasValidReps = repsValue !== '' && repsValue !== '-';
      
      // Auto-fill if current set has values
      if ((hasValidWeight || currentExercise.requires_weight === false) && hasValidReps) {
        const updatedSets = { ...prev };
        updatedSets[exerciseId] = [...updatedSets[exerciseId]];
        
        // Determine what value to use for auto-fill
        let autoFillWeight = weightValue;
        let autoFillReps = repsValue;
        
        // For customized exercises, only use the range if the current value IS the range and wasn't manually entered
        const isCustomized = exerciseCustomized[exerciseId];
        const currentSetInputKey = `${exerciseId}-${currentSetIndex}-reps`;
        const wasUserEntered = userEnteredValues[currentSetInputKey];
        
        // Only use customized range if the current value is still the range AND user hasn't manually entered it
        if (isCustomized && currentExercise.reps_range && !wasUserEntered && repsValue === currentExercise.reps_range) {
          autoFillReps = currentExercise.reps_range;
        }
        // Otherwise, always use the actual current value (prioritize user input)
        
        updatedSets[exerciseId][anyIncompleteSetIndex] = {
          ...updatedSets[exerciseId][anyIncompleteSetIndex],
          weight: hasValidWeight ? autoFillWeight : updatedSets[exerciseId][anyIncompleteSetIndex].weight,
          reps: hasValidReps ? autoFillReps : updatedSets[exerciseId][anyIncompleteSetIndex].reps
        };
        return updatedSets;
      }
      
      return prev;
    });
  };

  // Function to auto-fill the next set with specific values (legacy function for immediate next set)
  const autoFillNextSetWithValues = (exerciseId: string, currentSetIndex: number, weightValue: string, repsValue: string) => {
    setExerciseSets(prev => {
      // Only auto-fill if there's a next set
      if (!prev[exerciseId] || !prev[exerciseId][currentSetIndex + 1]) {
        return prev;
      }
      
      const nextSet = prev[exerciseId][currentSetIndex + 1];
      const currentExercise = exercises.find(ex => ex.id === exerciseId);
      
      if (!currentExercise) return prev;
      
      // IMPORTANT: Don't auto-fill if the next set is already completed
      if (nextSet.isCompleted) {
        return prev;
      }
      
      // Check if current set has valid values
      const hasValidWeight = currentExercise.requires_weight !== false && weightValue !== '' && weightValue !== '-';
      const hasValidReps = repsValue !== '' && repsValue !== '-';
      
      // Auto-fill if current set has values
      if ((hasValidWeight || currentExercise.requires_weight === false) && hasValidReps) {
        const updatedSets = { ...prev };
        updatedSets[exerciseId] = [...updatedSets[exerciseId]];
        
        // Determine what value to use for auto-fill
        let autoFillWeight = weightValue;
        let autoFillReps = repsValue;
        
        // For customized exercises, only use the range if the current value IS the range and wasn't manually entered
        const isCustomized = exerciseCustomized[exerciseId];
        const currentSetInputKey = `${exerciseId}-${currentSetIndex}-reps`;
        const wasUserEntered = userEnteredValues[currentSetInputKey];
        
        // Only use customized range if the current value is still the range AND user hasn't manually entered it
        if (isCustomized && currentExercise.reps_range && !wasUserEntered && repsValue === currentExercise.reps_range) {
          autoFillReps = currentExercise.reps_range;
        }
        // Otherwise, always use the actual current value (prioritize user input)
        
        updatedSets[exerciseId][currentSetIndex + 1] = {
          ...updatedSets[exerciseId][currentSetIndex + 1],
          weight: hasValidWeight ? autoFillWeight : nextSet.weight,
          reps: hasValidReps ? autoFillReps : nextSet.reps
        };
        return updatedSets;
      }
      
      return prev;
    });
  };

  // Function to auto-fill the next set with values from the previous set or suggested values
  const autoFillNextSet = (exerciseId: string, currentSetIndex: number) => {
    // Only auto-fill if there's a next set
    if (exerciseSets[exerciseId] && exerciseSets[exerciseId][currentSetIndex + 1]) {
      const currentSet = exerciseSets[exerciseId][currentSetIndex];
      autoFillNextSetWithValues(exerciseId, currentSetIndex, currentSet.weight, currentSet.reps);
    }
  };

  // Function to fetch cycle week info
  const fetchCycleWeekInfo = useCallback(async () => {
    try {
      const weekInfo = await workoutPlanService.getCycleWeekInfo(cycleWeek);
      if (weekInfo) {
        setCycleWeekInfo(weekInfo);
      }
    } catch (error) {
      console.error('Error fetching cycle week info:', error);
    }
  }, [cycleWeek]);



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
  }, [user?.id]); // Remove exercises to prevent infinite loop
  
  // Function to fetch max weight data for all exercises
  const fetchMaxWeightDataForAllExercises = useCallback(async () => {
    if (!user || exercises.length === 0) return;
    
    try {
      const newMaxWeightData: Record<string, MaxWeightDataPoint[]> = {};
      const newAbsoluteMaxWeightData: Record<string, { weight: number, reps: number, date: string }> = {};
      
      // Fetch data for all exercises that require weight
      const promises = exercises
        .filter(exercise => exercise.exercise_id && exercise.requires_weight !== false)
        .map(async (exercise) => {
          try {
            const [trendingData, absoluteMaxData] = await Promise.all([
              workoutPlanService.fetchExerciseMaxWeightData(user.id, exercise.exercise_id, 6),
              workoutPlanService.fetchExerciseAbsoluteMaxWeight(user.id, exercise.exercise_id)
            ]);
            
            if (trendingData.length > 0) {
              newMaxWeightData[exercise.exercise_id] = trendingData;
            }
            
            if (absoluteMaxData) {
              newAbsoluteMaxWeightData[exercise.exercise_id] = absoluteMaxData;
            }
          } catch (error) {
            console.error(`Error fetching max weight data for exercise ${exercise.exercise_id}:`, error);
          }
        });
      
      await Promise.all(promises);
      
      // Update state with all the fetched data
      setMaxWeightData(prev => ({ ...prev, ...newMaxWeightData }));
      setAbsoluteMaxWeightData(prev => ({ ...prev, ...newAbsoluteMaxWeightData }));
    } catch (error) {
      console.error('Error fetching max weight data for all exercises:', error);
    }
  }, [user?.id, exercises]);

  // Function to fetch max weight data for current exercise (for immediate updates)
  const fetchMaxWeightData = useCallback(async () => {
    if (!user || exercises.length === 0 || currentExerciseIndex < 0) return;
    
    try {
      const currentExercise = exercises[currentExerciseIndex];
      
      // Only fetch max weight data for exercises that require weight
      if (currentExercise?.exercise_id && currentExercise.requires_weight !== false) {
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
  }, [user?.id, currentExerciseIndex]); // Remove exercises to prevent infinite loop
  
  // Function to get suggested values for a specific exercise and set
  const getSuggestedValue = (exerciseId: string, setNumber: number, type: 'weight' | 'reps'): string | null => {
    if (cycleWeek <= 1) {
      return null;
    }
    
    // Find the exercise by exerciseId to get the recommendation
    const exercise = exercises.find(ex => ex.exercise_id === exerciseId);
    if (!exercise) return null;
    
    const recommendation = recommendations[exercise.id];
    if (!recommendation) return null;
    
    // Return the recommended value based on type
    if (type === 'weight' && recommendation.recommended_weight) {
      return recommendation.recommended_weight.toString();
    }
    if (type === 'reps' && recommendation.recommended_reps) {
      return recommendation.recommended_reps.toString();
    }
    
    return null;
  };



  // Function to pre-fill sets with recommended values from database
  const preFillWithSuggestedValues = useCallback(() => {
    if (Object.keys(recommendations).length === 0) {
      return;
    }

    setExerciseSets(prev => {
      const updatedSets = { ...prev };
      let hasChanges = false;
      
      exercises.forEach(exercise => {
        const exerciseRecommendation = recommendations[exercise.id];
        if (exerciseRecommendation && updatedSets[exercise.id]) {
          updatedSets[exercise.id].forEach((set, index) => {
            // Only pre-fill if the set is empty and not completed
            if (!set.isCompleted) {
              // For weight exercises, use recommended weight and reps from database
              if (exercise.requires_weight !== false) {
                // Use recommended weight from database
                if (exerciseRecommendation.recommended_weight && (set.weight === '' || set.weight === '-')) {
                  updatedSets[exercise.id][index].weight = exerciseRecommendation.recommended_weight.toString();
                  hasChanges = true;
                }
                // Use recommended reps from database, fallback to last reps (but not for customized exercises)
                if (exerciseRecommendation.recommended_reps && (set.reps === '' || set.reps === '-')) {
                  updatedSets[exercise.id][index].reps = exerciseRecommendation.recommended_reps.toString();
                  hasChanges = true;
                } else {
                  // Don't pre-fill with last values if exercise was customized
                  const isCustomized = exerciseCustomized[exercise.id];
                  if (!isCustomized) {
                    const lastReps = lastExerciseValues[exercise.exercise_id]?.[index + 1]?.reps;
                    if (lastReps && lastReps !== '-' && lastReps !== '0' && (set.reps === '' || set.reps === '-')) {
                      updatedSets[exercise.id][index].reps = lastReps;
                      hasChanges = true;
                    }
                  }
                }
              } else {
                // For bodyweight exercises, use recommended reps from database
                if (exerciseRecommendation.recommended_reps && (set.reps === '' || set.reps === '-')) {
                  updatedSets[exercise.id][index].reps = exerciseRecommendation.recommended_reps.toString();
                  hasChanges = true;
                }
              }
            }
          });
        }
      });

      
      return updatedSets;
    });
      }, [recommendations, lastExerciseValues, exercises.length]);
  
  // Store the original cycle week for redo workouts
  const [originalCycleWeek, setOriginalCycleWeek] = useState<number | null>(null);
  
  // Timer interval references
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const workoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get forceStart parameter from URL
  const forceStart = params.forceStart === 'true';

  // Centralized timer management functions
  const startWorkoutTimer = useCallback(() => {
    // Clear any existing workout timer
    if (workoutTimerRef.current) {
      clearInterval(workoutTimerRef.current);
      workoutTimerRef.current = null;
    }
    
    // Start new workout timer
    setWorkoutTimerActive(true);
    workoutTimerRef.current = setInterval(() => {
      setWorkoutDuration(prev => prev + 1);
    }, 1000) as unknown as NodeJS.Timeout;
  }, []);

  const stopWorkoutTimer = useCallback(() => {
    if (workoutTimerRef.current) {
      clearInterval(workoutTimerRef.current);
      workoutTimerRef.current = null;
    }
    setWorkoutTimerActive(false);
  }, []);

  const clearAllTimers = useCallback(() => {
    if (workoutTimerRef.current) {
      clearInterval(workoutTimerRef.current);
      workoutTimerRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);
  
  // Effect to monitor exercises state and fetch last records when exercises change
  useEffect(() => {
    if (exercises.length > 0 && user && !isLoading) {
      fetchLastExerciseRecords();
    }
  }, [exercises.length, user?.id, isLoading]); // Remove function dependency to prevent infinite loop
  
  // Effect to fetch max weight data for all exercises when exercises are loaded
  useEffect(() => {
    if (exercises.length > 0 && user && !isLoading) {
      fetchMaxWeightDataForAllExercises();
    }
  }, [exercises.length, user?.id, isLoading]); // Remove function dependency to prevent infinite loop

  // Effect to fetch cycle week info
  useEffect(() => {
    fetchCycleWeekInfo();
  }, [cycleWeek]); // Use direct dependency instead of function

  // Effect to update max weight data when sets are completed (for immediate graph updates)
  useEffect(() => {
    if (exercises.length > 0 && user && !isLoading) {
      // Check if any sets have been completed by looking at the exerciseSets state
      const hasCompletedSets = Object.values(exerciseSets).some(sets => 
        sets.some(set => set.isCompleted)
      );
      
      if (hasCompletedSets) {
        // Debounce the update to avoid too many API calls
        const timeoutId = setTimeout(() => {
          fetchMaxWeightDataForAllExercises();
        }, 1000);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [exerciseSets, exercises.length, user?.id, isLoading]);

  // Effect to pre-fill sets with recommended values when they become available
  useEffect(() => {
    if (Object.keys(recommendations).length > 0) {
      preFillWithSuggestedValues();
    }
  }, [recommendations, lastExerciseValues, exercises.length]);

  // Additional effect to pre-fill with last values when they become available (for cycle week 1 or when no suggested values)
  useEffect(() => {
    if (Object.keys(lastExerciseValues).length > 0 && exercises.length > 0) {
      
      setExerciseSets(prev => {
        const updatedSets = { ...prev };
        let hasChanges = false;
        
        exercises.forEach(exercise => {
          if (lastExerciseValues[exercise.exercise_id] && updatedSets[exercise.id]) {
            // Don't pre-fill with last values if exercise was customized
            const isCustomized = exerciseCustomized[exercise.id];
            if (isCustomized) {
              return;
            }
            
            updatedSets[exercise.id].forEach((set, index) => {
              const setNumber = index + 1;
              
              // For weight exercises, always use last reps value if available
              if (!set.isCompleted && exercise.requires_weight !== false) {
                const lastReps = lastExerciseValues[exercise.exercise_id]?.[setNumber]?.reps;
                if (lastReps && lastReps !== '-' && lastReps !== '0') {
                  updatedSets[exercise.id][index].reps = lastReps;
                  hasChanges = true;
                }
              }
            });
          }
        });

        
        return hasChanges ? updatedSets : prev;
      });
    }
  }, [lastExerciseValues, exercises.length, exerciseCustomized]); // Add exerciseCustomized dependency

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
              startWorkoutTimer();
            }
          } catch (error) {
            // If there's an error, fetch workout data normally
            fetchWorkoutData();
            setWorkoutStartTime(new Date());
            startWorkoutTimer();
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
      startWorkoutTimer();
    }
    
    // Cleanup
    return () => {
      clearAllTimers();
    };
  }, [planId, workoutDay, forceStart, clearAllTimers]);

  // Cleanup effect to ensure timers are cleared on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  // Keyboard handling effect
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        const keyboardHeight = event.endCoordinates.height;
        setKeyboardHeight(keyboardHeight);
        
        // Scroll to active input after a short delay
        setTimeout(() => {
          if (scrollViewRef.current && activeInputPosition > 0) {
            const screenHeight = Dimensions.get('window').height;
            const statusBarHeight = Platform.OS === 'ios' ? 44 : 24; // Status bar height
            const headerHeight = 60; // Approximate header height
            const tabBarHeight = 0; // No tab bar in this screen
            
            // Calculate the visible area above keyboard
            const visibleHeight = screenHeight - keyboardHeight - statusBarHeight - headerHeight - tabBarHeight;
            
            // Dynamic positioning based on input location - lower inputs get positioned higher up
            const currentInputPosition = activeInputPosition - statusBarHeight - headerHeight;
            const contentHeight = screenHeight - statusBarHeight - headerHeight; // Total scrollable content area
            const inputRelativePosition = currentInputPosition / contentHeight; // 0 = top, 1 = bottom
            
            // For inputs in lower half of content, position them higher up (50-60% of visible area)
            // For inputs in upper half, position them lower (70-80% of visible area)
            let targetPositionRatio;
            if (inputRelativePosition > 0.6) {
              // Lower content - position at 50% of visible area (more aggressive scroll up)
              targetPositionRatio = 0.5;
            } else if (inputRelativePosition > 0.3) {
              // Middle content - position at 60% of visible area
              targetPositionRatio = 0.6;
            } else {
              // Upper content - position at 70% of visible area (less aggressive)
              targetPositionRatio = 0.7;
            }
            
            const targetInputPosition = visibleHeight * targetPositionRatio;
            
            // Calculate how much we need to scroll
            const scrollOffset = currentInputPosition - targetInputPosition;
            
            // Ensure we don't scroll to negative values
            const targetScrollY = Math.max(0, scrollOffset);
            
            scrollViewRef.current.scrollTo({
              y: targetScrollY,
              animated: true,
            });
          }
        }, Platform.OS === 'ios' ? 100 : 200);
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [activeInputPosition]);
  
  // Function to fetch workout data
  const fetchWorkoutData = async () => {
    if (!planId || isNaN(workoutDay) || !user) {
      console.error('Invalid workout parameters:', { planId, workoutDay, user: !!user });
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
      
      // Fetch last exercise records directly with the exercises we just fetched
      if (formattedExercises.length > 0) {
        try {
          const lastValues = await workoutPlanService.fetchLastExerciseRecords(user.id, formattedExercises);
          if (Object.keys(lastValues).length > 0) {
            setLastExerciseValues(lastValues);
          }
        } catch (error) {
          console.error('Error fetching last exercise records:', error);
        }
      }
      
      // Fetch max weight data for all exercises
      if (formattedExercises.length > 0) {
        try {
          const newMaxWeightData: Record<string, MaxWeightDataPoint[]> = {};
          const newAbsoluteMaxWeightData: Record<string, { weight: number, reps: number, date: string }> = {};
          
          // Fetch data for all exercises that require weight
          const promises = formattedExercises
            .filter(exercise => exercise.exercise_id && exercise.requires_weight !== false)
            .map(async (exercise) => {
              try {
                const [trendingData, absoluteMaxData] = await Promise.all([
                  workoutPlanService.fetchExerciseMaxWeightData(user.id, exercise.exercise_id, 6),
                  workoutPlanService.fetchExerciseAbsoluteMaxWeight(user.id, exercise.exercise_id)
                ]);
                
                if (trendingData.length > 0) {
                  newMaxWeightData[exercise.exercise_id] = trendingData;
                }
                
                if (absoluteMaxData) {
                  newAbsoluteMaxWeightData[exercise.exercise_id] = absoluteMaxData;
                }
              } catch (error) {
                console.error(`Error fetching max weight data for exercise ${exercise.exercise_id}:`, error);
              }
            });
          
          await Promise.all(promises);
          
          // Update state with all the fetched data
          setMaxWeightData(prev => ({ ...prev, ...newMaxWeightData }));
          setAbsoluteMaxWeightData(prev => ({ ...prev, ...newAbsoluteMaxWeightData }));
        } catch (error) {
          console.error('Error fetching max weight data for all exercises:', error);
        }
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching workout data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error details:', {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        planId,
        workoutDay,
        cycleWeek,
        userId: user?.id
      });
      setIsLoading(false);
      
      // Show alert and navigate back on error
      Alert.alert(
        'Error', 
        `Failed to load workout data: ${errorMessage}`,
        [
          {
            text: 'Go Back',
            onPress: () => router.back(),
            style: 'default'
          },
          {
            text: 'Retry',
            onPress: () => {
              setIsLoading(true);
              fetchWorkoutData();
            },
            style: 'default'
          }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  // This function only checks if workout is completed without paused workout logic
  const checkWorkoutCompletionOnly = async () => {
    if (!user || !planId) return;
    
    try {
      // Use the new service function to check workout completion for specific cycle week
      const { isCompleted, completedWorkoutData } = await workoutPlanService.checkWorkoutCompletionForCycleWeek(
        user.id,
        planId,
        workoutDay,
        cycleWeek // Pass the cycle week to check for completion in the specific week
      );
      
      if (isCompleted && completedWorkoutData) {
        // Workout is already completed for this specific cycle week
        setIsWorkoutCompleted(true);
        setCompletedWorkoutData(completedWorkoutData);
        setIsLoading(false);
      } else {
        // Workout is not completed for this cycle week, fetch workout data
        setIsWorkoutCompleted(false);
        fetchWorkoutData();
        
        // Start workout timer
        setWorkoutStartTime(new Date());
        startWorkoutTimer();
      }
    } catch (error) {
      console.error('Error in checkWorkoutCompletionOnly:', error);
      setIsLoading(false);
      // If there's an error, proceed with normal workout
      setIsWorkoutCompleted(false);
      fetchWorkoutData();
      
      // Start workout timer
      setWorkoutStartTime(new Date());
      startWorkoutTimer();
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
      startWorkoutTimer();
      
      // Remove the warmup popup if we're resuming
      setWarmupCompleted(true);
      setShowWarmup(false);
      
      setIsLoading(false);
      
      // Clear the paused workout since we're resuming it now
      workoutPlanService.clearPausedWorkout(user?.id, planId, workoutDay);
    } catch (error) {
      // If resuming fails, just start a new workout
      setIsLoading(false);
      fetchWorkoutData();
      
      // Start workout timer
      setWorkoutStartTime(new Date());
      startWorkoutTimer();
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
              stopWorkoutTimer();
              
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

  const handleExerciseNamePress = () => {
    setShowExerciseDetailsModal(true);
  };

  const handleExerciseDetailsModalClose = () => {
    setShowExerciseDetailsModal(false);
  };

  const handleExerciseListPress = () => {
    setInitialSelectedExercise(null); // Show exercise list
    setShowExerciseListModal(true);
  };

  const handleExerciseListModalClose = () => {
    setShowExerciseListModal(false);
    setInitialSelectedExercise(null); // Reset the initial selection
  };

  const handleCustomizeExercisePress = () => {
    setShowCustomizeExerciseModal(true);
  };

  const handleCustomizeExerciseFromList = (exerciseIndex: number) => {
    // Close the exercise list modal first
    setShowExerciseListModal(false);
    
    // Set the current exercise index to the selected exercise
    setCurrentExerciseIndex(exerciseIndex);
    
    // Open the customize exercise modal
    setTimeout(() => {
      setShowCustomizeExerciseModal(true);
    }, 300); // Small delay to allow the list modal to close first
  };

  const handleCustomizeExerciseModalClose = () => {
    setShowCustomizeExerciseModal(false);
  };

  const handleCustomizeExerciseSave = (updatedExercise: { sets: number; reps_range: string }) => {
    // Get the exercise that's currently being customized
    const exerciseToUpdate = exercises[currentExerciseIndex];
    if (!exerciseToUpdate) {
      return;
    }
    
    // Always clear reps recommendations when customizing exercise, keep weight recommendations
    setRecommendations(prev => {
      const updated = { ...prev };
      if (updated[exerciseToUpdate.id]) {
        // Keep weight recommendations, only clear reps recommendations
        updated[exerciseToUpdate.id] = {
          ...updated[exerciseToUpdate.id],
          recommended_reps: null
        };
      }
      return updated;
    });
    
    // Clear user-entered flags for all reps inputs of this exercise because customization is the latest user action
    setUserEnteredValues(prev => {
      const updated = { ...prev };
      const currentSets = exerciseSets[exerciseToUpdate.id] || [];
      const clearedKeys: string[] = [];
      
      currentSets.forEach((set, index) => {
        const repsInputKey = `${exerciseToUpdate.id}-${index}-reps`;
        if (updated[repsInputKey]) {
          delete updated[repsInputKey];
          clearedKeys.push(repsInputKey);
        }
      });
      
      return updated;
    });
    
    // Update the exercise with new sets and reps range
    setExercises(prev => {
      const updatedExercises = [...prev];
      const exerciseIndex = updatedExercises.findIndex(ex => ex.id === exerciseToUpdate.id);
      
      if (exerciseIndex !== -1) {
        const oldRepsRange = updatedExercises[exerciseIndex].reps_range;
        updatedExercises[exerciseIndex] = {
          ...updatedExercises[exerciseIndex],
          sets: updatedExercise.sets,
          reps_range: updatedExercise.reps_range
        };
      }
      return updatedExercises;
    });

    // Update exercise sets to match the new number of sets and update only incomplete sets
    setExerciseSets(prev => {
      const currentSets = prev[exerciseToUpdate.id] || [];
      const newSetsCount = updatedExercise.sets;
      
      let updatedSets = [...currentSets];
      
      // Only update incomplete sets with the new range - leave completed sets unchanged
      updatedSets = updatedSets.map((set, index) => {
        if (!set.isCompleted) {
          // Set reps to the new range for incomplete sets only
          return {
            ...set,
            reps: updatedExercise.reps_range // Use the new reps range as the value
          };
        }
        // Keep completed sets exactly as they are
        return set;
      });
      
      if (currentSets.length < newSetsCount) {
        // Add new sets with the customized reps range
        for (let i = currentSets.length; i < newSetsCount; i++) {
          updatedSets.push({
            id: `${exerciseToUpdate.id}-set-${i + 1}`,
            setNumber: i + 1,
            weight: '',
            reps: updatedExercise.reps_range, // Use the new reps range for new sets
            isCompleted: false
          });
        }
              } else if (currentSets.length > newSetsCount) {
          // Remove excess sets and update totals
          const setsToRemove = updatedSets.slice(newSetsCount);
          
        setsToRemove.forEach((set, idx) => {
          if (set.isCompleted) {
            const weight = exerciseToUpdate.requires_weight !== false ? 
              (set.weight === '-' || set.weight === '' ? 0 : parseFloat(set.weight)) : 0;
            const reps = set.reps === '-' || set.reps === '' ? 0 : parseFloat(set.reps);
            const setVolume = exerciseToUpdate.requires_weight !== false ? 
              parseFloat((weight * reps).toFixed(1)) : 0;
            
            if (exerciseToUpdate.requires_weight !== false) {
              setTotalVolume(prev => Math.max(0, parseFloat((prev - setVolume).toFixed(1))));
            }
            setTotalReps(prev => Math.max(0, prev - reps));
          }
        });
        
        updatedSets = updatedSets.slice(0, newSetsCount);
      }
      
      
      return {
        ...prev,
        [exerciseToUpdate.id]: updatedSets
      };
    });
    
    // Mark this exercise as customized
    setExerciseCustomized(prev => {
      const updated = {
        ...prev,
        [exerciseToUpdate.id]: true
      };
      return updated;
    });
    
    // Force TextInput re-render by updating refresh key
    setTextInputRefreshKey(prev => prev + 1);
    
    // Close the modal
    setShowCustomizeExerciseModal(false);
  };

  const handleNextExercisePress = () => {
    if (currentExerciseIndex < exercises.length - 1) {
      setInitialSelectedExercise(currentExerciseIndex + 1); // Show next exercise detail
      setShowExerciseListModal(true);
    }
  };

  const moveCurrentExerciseToEnd = () => {
    if (currentExerciseIndex >= 0 && currentExerciseIndex < exercises.length - 1) {
      const currentExercise = exercises[currentExerciseIndex];
      
      // Create new exercises array with current exercise moved to end
      const newExercises = [...exercises];
      newExercises.splice(currentExerciseIndex, 1); // Remove current exercise
      newExercises.push(currentExercise); // Add it to the end
      
      // Update the exercises state
      setExercises(newExercises);
      
      // Update exercise sets to maintain the same data structure
      setExerciseSets(prev => {
        const newExerciseSets = { ...prev };
        // No need to change the sets data as it's keyed by exercise.id which remains the same
        return newExerciseSets;
      });
      
      // Update other data structures that might reference exercise order
      setLastExerciseValues(prev => ({ ...prev })); // Keep the same data
      setMaxWeightData(prev => ({ ...prev })); // Keep the same data
      setAbsoluteMaxWeightData(prev => ({ ...prev })); // Keep the same data
    }
  };

  const handleExerciseSelect = (index: number) => {
    // If user selects a different exercise (not the current one), move current to end
    if (index !== currentExerciseIndex) {
      moveCurrentExerciseToEnd();
      
      // After moving current exercise to end, the selected exercise index might have changed
      // If the selected exercise was after the current one, its index decreases by 1
      const newSelectedIndex = index > currentExerciseIndex ? index - 1 : index;
      setCurrentExerciseIndex(newSelectedIndex);
    }
    
    setShowExerciseListModal(false);
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

  // Utility function to get the highest value from a reps range
  const getHighestRepsFromRange = (repsRange: string): number => {
    if (repsRange.includes('-')) {
      // Range format like "12-15"
      const rangeParts = repsRange.split('-');
      return parseInt(rangeParts[1]) || parseInt(rangeParts[0]) || 0;
    } else {
      // Single value format like "12"
      return parseInt(repsRange) || 0;
    }
  };

  const handleSetComplete = (exerciseId: string, setIndex: number) => {
    // Get current weight and reps values from the inputs
    const currentSet = exerciseSets[exerciseId][setIndex];
    
    // Handle weight value - if empty, use placeholder value or fallback
    let weightValue = currentSet.weight;
    if (!weightValue || weightValue === '') {
      if (currentExercise?.requires_weight === false) {
        weightValue = "";
      } else {
        // Use recommended weight from database if available, otherwise fall back to suggested value or "0"
        weightValue = currentRecommendation?.recommended_weight?.toString() || 
          getSuggestedValue(currentExercise?.exercise_id || '', setIndex + 1, 'weight') || "0";
        
        console.log(`🔧 RESOLVED WEIGHT VALUE: Empty weight resolved to "${weightValue}" for set ${setIndex + 1}`);
      }
    }
    
    // Handle reps value - if empty, use placeholder value or fallback
    let repsValue = currentSet.reps;
    if (!repsValue || repsValue === '') {
      // Priority: 1. Recommended reps from database, 2. Last workout values (if not customized), 3. Exercise reps range (if customized)
      const recommendedReps = currentRecommendation?.recommended_reps?.toString();
      const lastReps = lastExerciseValues[currentExercise?.exercise_id || '']?.[setIndex + 1]?.reps;
      const exerciseRepsRange = currentExercise?.reps_range;
      const isCustomized = exerciseCustomized[currentExercise?.id || ''];
      
      // If exercise was customized, prioritize the reps_range over last values
      repsValue = recommendedReps || 
        (isCustomized ? exerciseRepsRange : lastReps) || 
        (isCustomized ? lastReps : exerciseRepsRange) || "1";
      
      console.log(`🔧 RESOLVED REPS VALUE: Empty reps resolved to "${repsValue}" for set ${setIndex + 1}`);
    } else {
      console.log(`✅ EXISTING REPS VALUE: "${repsValue}" for set ${setIndex + 1}`);
    }
    
    // Store the original reps value for auto-fill logic (before conversion)
    const originalRepsValue = repsValue;
    
    // For CALCULATION purposes, convert ranges to highest value
    let calculationRepsValue = repsValue;
    if (repsValue && typeof repsValue === 'string' && repsValue.includes('-')) {
      const rangeParts = repsValue.split('-');
      const highestReps = parseInt(rangeParts[1]) || parseInt(rangeParts[0]) || 1;
      calculationRepsValue = highestReps.toString();
    }
    
    // FORCE ALL VALUES TO BE STRINGS for TextInput compatibility
    weightValue = String(weightValue);
    
    // For COMPLETED sets, always show the calculated value (what was actually counted)
    // For auto-fill, use the original format to preserve user intent
    const finalDisplayReps = String(calculationRepsValue); // Show calculated value in completed set
    const finalCalculationReps = String(calculationRepsValue);

    // ATOMIC UPDATE: Calculate all state changes before applying any
    const newExerciseSets = { ...exerciseSets };
    
    // Update the specific set with the processed reps value - ENSURE VALUES ARE ACTUALLY STORED
    newExerciseSets[exerciseId] = newExerciseSets[exerciseId].map((set, index) => 
      index === setIndex 
        ? { 
            ...set, 
            weight: weightValue,        // This now contains the resolved value (not empty)
            reps: finalDisplayReps,     // This preserves the original format for display
            isCompleted: true 
          }
        : set
    );
    
    // IMMEDIATELY update the exerciseSets state to show the actual values in the UI
    setExerciseSets(newExerciseSets);
    
    console.log(`💾 SET COMPLETED: Set ${setIndex + 1} completed with weight="${weightValue}" display_reps="${finalDisplayReps}" calc_reps="${finalCalculationReps}"`);
    console.log(`📱 UI STATE: Updated exerciseSets for ${exerciseId}:`, newExerciseSets[exerciseId][setIndex]);

    // Calculate totals based on the new state
    let newTotalVolume = totalVolume;
    let newTotalReps = totalReps;
    
    const parsedWeight = parseFloat(weightValue) || 0;
    const parsedReps = parseInt(finalCalculationReps) || 0; // Use calculation value for totals
    const setVolume = parsedWeight * parsedReps;
    
    newTotalVolume += setVolume;
    newTotalReps += parsedReps;

    // Check if all exercises will be completed after this update
    const allExercisesCompleted = exercises.every(exercise => {
      const exerciseSetsList = newExerciseSets[exercise.id];
      return exerciseSetsList && exerciseSetsList.every(set => set.isCompleted);
    });

    // ATOMIC STATE APPLICATION: Apply remaining state changes
    setTotalVolume(newTotalVolume);
    setTotalReps(newTotalReps);

    // Check completion with the new state
    if (allExercisesCompleted) {
      // Complete workout with the already calculated values
      setTimeout(() => {
        completeWorkoutWithStateSync(newTotalVolume, newTotalReps, newExerciseSets);
      }, 100);
      return;
    }

    // Check if current exercise is fully completed to move to next exercise
    const currentExerciseCompleted = newExerciseSets[exerciseId].every(set => set.isCompleted);
    
    if (currentExerciseCompleted) {
      // Check if this is the last exercise
      if (currentExerciseIndex === exercises.length - 1) {
        // This case should be handled by allExercisesCompleted above, but just in case
        setTimeout(() => {
          completeWorkoutWithStateSync(newTotalVolume, newTotalReps, newExerciseSets);
        }, 100);
      } else {
        // Move to next exercise with a delay to allow state to settle
        setTimeout(() => {
          moveToNextExercise();
        }, 500);
      }
      return;
    }

    // Auto-fill next incomplete set in current exercise
    // Use original reps value for auto-fill (preserves ranges)
    const nextIncompleteSetIndex = newExerciseSets[exerciseId].findIndex(set => !set.isCompleted);
    if (nextIncompleteSetIndex !== -1) {
      autoFillNextIncompleteSetWithValues(exerciseId, setIndex, weightValue, originalRepsValue);
    }

    // Start rest timer if applicable
    if (currentExercise && currentExercise.restTime && currentExercise.restTime > 0) {
      startRestTimer(currentExercise.restTime);
    }
  };

  const handleRedoSet = (exerciseId: string, setIndex: number) => {
    // Mark the set as not completed and update volume/reps totals
    setExerciseSets(prev => {
      const updatedSets = [...prev[exerciseId]];
      const currentSet = updatedSets[setIndex];
      
      // Get the current exercise to check if it requires weight
      const currentExercise = exercises.find(ex => ex.id === exerciseId);
      const requiresWeight = currentExercise?.requires_weight !== false; // Default to true if not specified
      
      // If the set was completed, subtract its EXACT volume and reps from totals
      if (currentSet.isCompleted) {
        // Use the exact values that are currently stored in the set (these are what were used when it was completed)
        const weight = requiresWeight ? (currentSet.weight === '-' || currentSet.weight === '' ? 0 : parseFloat(currentSet.weight)) : 0;
        const reps = currentSet.reps === '-' || currentSet.reps === '' ? 0 : parseFloat(currentSet.reps);
        
        const setVolume = requiresWeight ? parseFloat((weight * reps).toFixed(1)) : 0;
        
        if (requiresWeight) {
          setTotalVolume(prev => Math.max(0, parseFloat((prev - setVolume).toFixed(1))));
        }
        setTotalReps(prev => Math.max(0, prev - reps));
      }
      
      updatedSets[setIndex] = {
        ...currentSet,
        isCompleted: false
        // Keep both weight and reps values - don't clear them on redo
      };
      
      return { ...prev, [exerciseId]: updatedSets };
    });
    
    // Reset user-entered flags for this set when redoing (AFTER calculating subtraction)
    const weightInputKey = `${exerciseId}-${setIndex}-weight`;
    const repsInputKey = `${exerciseId}-${setIndex}-reps`;
    setUserEnteredValues(prev => {
      const updated = { ...prev };
      delete updated[weightInputKey];
      delete updated[repsInputKey];
      return updated;
    });
  };

  const handleLogAllSets = (exerciseId: string) => {
    // Get the current sets for this exercise
    const sets = exerciseSets[exerciseId];
    if (!sets || sets.length === 0) return;
    
    // Get the current exercise to check if it requires weight
    const currentExercise = exercises.find(ex => ex.id === exerciseId);
    const requiresWeight = currentExercise?.requires_weight !== false; // Default to true if not specified
    
    // First, fill in any empty values with 0
    setExerciseSets(prev => {
      const updatedSets = { ...prev };
      const setsForExercise = [...updatedSets[exerciseId]];
      
      // Update any incomplete sets with empty values
      setsForExercise.forEach((set, index) => {
        if (!set.isCompleted) {
          // Fill empty weight with placeholder value or fallback
          if (requiresWeight && (set.weight === '' || set.weight === '-')) {
                         // Use recommended weight from database if available, otherwise fall back to suggested value or "0"
             const weightValue = currentRecommendation?.recommended_weight?.toString() || 
               getSuggestedValue(currentExercise?.exercise_id || '', index + 1, 'weight') || "0";
            setsForExercise[index] = {
              ...set,
              weight: weightValue
            };
          }
          
          // Fill empty reps or reps with range format with placeholder value or fallback
          const repsContainsRange = set.reps && typeof set.reps === 'string' && set.reps.includes('-');
          if (set.reps === '' || set.reps === '-' || repsContainsRange) {
            let repsValue = '0';
            if (repsContainsRange) {
              // If it's a range, use the highest value from that range
              const rangeParts = set.reps.split('-');
              repsValue = (parseInt(rangeParts[1]) || parseInt(rangeParts[0]) || 0).toString();
            } else {
              // Priority: 1. Recommended reps from database, 2. Last workout values (if not customized), 3. Exercise reps range (if customized)
              const recommendedReps = currentRecommendation?.recommended_reps?.toString();
              const lastReps = lastExerciseValues[currentExercise?.exercise_id || '']?.[index + 1]?.reps;
              const exerciseRepsRange = currentExercise?.reps_range;
              const isCustomized = exerciseCustomized[currentExercise?.id || ''];
              
              // If exercise was customized, prioritize the reps_range over last values
              repsValue = recommendedReps || 
                (isCustomized ? exerciseRepsRange : lastReps) || 
                (isCustomized ? lastReps : exerciseRepsRange) || "1";
              
              // If it's still a range after getting the value, extract the highest number
              if (repsValue && typeof repsValue === 'string' && repsValue.includes('-')) {
                const rangeParts = repsValue.split('-');
                repsValue = (parseInt(rangeParts[1]) || parseInt(rangeParts[0]) || 1).toString();
              }
            }
            setsForExercise[index] = {
              ...set,
              reps: repsValue
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
              const weight = requiresWeight ? (lastSet.weight === '-' || lastSet.weight === '' ? 0 : parseFloat(lastSet.weight)) : 0;
              let reps = lastSet.reps === '-' || lastSet.reps === '' ? 0 : parseFloat(lastSet.reps);
              
              // Check if reps field contains a range format and use max value if so
              const repsContainsRange = lastSet.reps && typeof lastSet.reps === 'string' && lastSet.reps.includes('-');
              const userEnteredRepsKey = `${exerciseId}-${setIndex}-reps`;
              const isUserEnteredValue = userEnteredValues[userEnteredRepsKey];
              
              if (repsContainsRange) {
                // If it's a range, always use the highest value
                const rangeParts = lastSet.reps.split('-');
                reps = parseInt(rangeParts[1]) || parseInt(rangeParts[0]) || 0;
              } else if (isNaN(reps) || !isUserEnteredValue) {
                if (currentExercise?.reps_range) {
                  reps = getHighestRepsFromRange(currentExercise.reps_range);
                }
              }
              
              const setVolume = requiresWeight ? parseFloat((weight * reps).toFixed(1)) : 0;
              
              if (requiresWeight) {
                setTotalVolume(prev => parseFloat((prev + setVolume).toFixed(1)));
              }
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
    
    // Mark this input as user-entered
    const inputKey = `${exerciseId}-${setIndex}-weight`;
    setUserEnteredValues(prev => ({
      ...prev,
      [inputKey]: true
    }));
    
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
    
    // Mark this input as user-entered
    const inputKey = `${exerciseId}-${setIndex}-reps`;
    setUserEnteredValues(prev => ({
      ...prev,
      [inputKey]: true
    }));
    
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

  const completeWorkoutWithStateSync = async (overrideVolume: number, overrideReps: number, finalExerciseSets: Record<string, ExerciseSet[]>) => {
    // Mark workout as completed immediately in UI for responsiveness
    setIsWorkoutCompleted(true);
    setCompletedWorkoutData({
      completedExercises: exercises.length,
      duration: formatTime(workoutDuration),
      caloriesBurned: Math.round((workoutDuration / 60) * 8.5),
      totalVolume: overrideVolume,
      totalReps: overrideReps,
      completedAt: new Date().toISOString(),
      weekName: weekName,
      cycleWeek: cycleWeek
    });
    
    // Use the new state machine approach for database operations
    await handleWorkoutCompletion(overrideVolume, overrideReps, finalExerciseSets);
  };

  const completeWorkout = async (overrideVolume?: number, overrideReps?: number) => {
    if (!user || !planId) return;
    
    // Stop the workout timer
    stopWorkoutTimer();
    
    // Use override values if provided, otherwise fall back to state values
    // This ensures we capture the most up-to-date values including the last set
    const finalDuration = workoutDuration;
    const finalVolume = overrideVolume !== undefined ? overrideVolume : totalVolume;
    const finalReps = overrideReps !== undefined ? overrideReps : totalReps;
    
    try {
      // Check if this is a redone workout (started with forceStart parameter)
      const forceStartParam = params.forceStart;
      const isRedoWorkout = forceStartParam === 'true';
      
      // Calculate workout duration in minutes for display
      const workoutDurationMinutes = Math.round(finalDuration / 60);
      
      // Set completed workout data for immediate UI display (without loading)
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
      
      // Set workout as completed immediately for UI
      setIsWorkoutCompleted(true);
      
      // Save to database in the background with a delay to ensure state stability
      setTimeout(async () => {
        try {
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
            // Also refresh the last exercise records after completing the workout
            await fetchLastExerciseRecords();
          }
        } catch (error) {
          // Could show a subtle notification here if needed
        }
      }, 1000); // 1 second delay for database save
      
      // Don't show loading indicator since UI updates immediately
      const success = true;
      
    } catch (error) {
      // Show error but don't block the UI since we're doing delayed save
      Alert.alert('Warning', 'Workout completed in app, but there may be an issue saving to server. Data will be retried.');
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
    setUserEnteredValues({});
    setExerciseCustomized({});
    
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
    
    // Fetch fresh workout data to reset exercises to their original state
    // This ensures that any customizations from previous sessions are cleared
    try {
      setIsLoading(true);
      
      // Use the service function to fetch fresh workout data
      const { exercises: freshExercises, exerciseSets: freshSets, recommendations: freshRecommendations } = 
        await workoutPlanService.fetchWorkoutData(planId, workoutDay, user?.id || '', cycleWeek);
      
      // Update exercises with fresh data (this resets any customizations)
      setExercises(freshExercises);
      
      // Update exercise sets with fresh data but keep them as not completed
      setExerciseSets(prev => {
        const resetSets = { ...freshSets };
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
      
      // Update recommendations with fresh data
      setRecommendations(freshRecommendations);
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching fresh workout data for redo:', error);
      setIsLoading(false);
    }
    
    // Also fetch fresh last exercise records after a delay to ensure we have the latest records
    setTimeout(async () => {
      await fetchLastExerciseRecords();
    }, 1000); // Longer delay to ensure all state updates have completed
    
    // Start workout duration timer
    startWorkoutTimer();
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

    // State machine for workout completion
  const handleWorkoutCompletion = async (
    finalVolume: number, 
    finalReps: number, 
    finalExerciseSets: Record<string, ExerciseSet[]>
  ) => {
    // Prevent multiple completion attempts
    if (workoutState !== 'in_progress') {
      return;
    }

    setWorkoutState('completing');
    
    try {
      await workoutPlanService.completeWorkout(
        user?.id!,
        planId,
        workoutDay,
        cycleWeek,
        weekName,
        exercises,
        finalExerciseSets,
        Math.floor(workoutDuration),
        finalVolume,
        finalReps,
        false, // isRedoWorkout
        null // originalCycleWeek
      );

      setWorkoutState('completed');
      
      // Clear any paused workout data
      await workoutPlanService.clearPausedWorkout(user?.id, planId, workoutDay);
      
      // Navigate to completion screen
      setTimeout(() => {
        router.replace('/(tabs)/');
      }, 1000);
      
    } catch (error) {
      console.error('❌ WORKOUT COMPLETION FAILED:', error);
      setWorkoutState('in_progress');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading workout...</Text>
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
          <Text style={styles.weekIndicator}>
            Week {cycleWeek}: {weekName}
          </Text>
        </View>
        
        <TouchableOpacity style={styles.headerButton} onPress={handleExerciseListPress}>
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
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView} 
          contentContainerStyle={[
            styles.scrollViewContent,
            { paddingBottom: keyboardHeight > 0 ? 50 : 24 }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
              <TouchableOpacity onPress={handleExerciseNamePress} activeOpacity={0.7}>
                <Text style={styles.exerciseName}>
                  {currentExercise?.name || 'Unknown Exercise'}
                </Text>
              </TouchableOpacity>
              {currentExercise?.primary_muscles && currentExercise.primary_muscles.length > 0 && (
                <View style={styles.muscleTag}>
                  <Text style={styles.muscleTagText}>{currentExercise.primary_muscles[0]}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        
        {/* Max Weight Progress Graph - separate container with small spacing */}
        {currentExercise && currentExercise.requires_weight !== false && (
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
                              {/* Only show weight input if exercise requires weight */}
                              {currentExercise?.requires_weight !== false && (
                                <>
                                  <View style={styles.inputContainer}>
                                    {/* Suggested label above weight input - hide when user has manually entered a value, on redo workouts, or completed sets */}
                                    {cycleWeek > 1 && getSuggestedValue(currentExercise.exercise_id, index + 1, 'weight') && !userEnteredValues[`${currentExercise.id}-${index}-weight`] && !originalCycleWeek && !set.isCompleted && (
                                      <Text style={styles.suggestedLabelWeightActive}>
                                        Suggested
                                      </Text>
                                    )}
                                    <View style={styles.inputFieldContainer}>
                                      <TextInput
                                        style={styles.inputField}
                                        value={set.weight}
                                        onChangeText={(value) => handleWeightChange(currentExercise.id, index, value)}
                                        keyboardType="decimal-pad"
                                        placeholder={focusedInputs[`${currentExercise.id}-${index}-weight`] ? '' : (
                                          // For completed sets, don't show any placeholder since they have actual values
                                          set.isCompleted ? '' : (
                                            // Use recommended weight from database if available, otherwise fall back to suggested value
                                            currentRecommendation?.recommended_weight?.toString() || 
                                            getSuggestedValue(currentExercise.exercise_id, index + 1, 'weight') || '-'
                                          )
                                        )}
                                        placeholderTextColor="rgba(255,255,255,0.5)"
                                        selectTextOnFocus={true}
                                        onFocus={(event) => handleInputFocus(`${currentExercise.id}-${index}-weight`, event)}
                                        onBlur={() => handleInputBlur(`${currentExercise.id}-${index}-weight`)}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                      />
                                      <Text style={styles.activeSetValueUnit}>kg</Text>
                                    </View>
                                  </View>
                                  
                                  <View style={styles.inputDivider} />
                                </>
                              )}
                              
                              <View style={styles.inputContainer}>
                                {/* Suggested label above reps input for bodyweight exercises */}
                                {currentExercise?.requires_weight === false && cycleWeek > 1 && getSuggestedValue(currentExercise.exercise_id, index + 1, 'reps') && (
                                  <Text style={styles.suggestedLabel}>
                                    Suggested
                                  </Text>
                                )}
                                <View style={styles.inputFieldContainer}>
                                  <TextInput
                                    key={`${currentExercise.id}-${index}-reps-${currentExercise.reps_range}-${exerciseCustomized[currentExercise.id] ? 'customized' : 'default'}-${textInputRefreshKey}`}
                                    style={styles.inputField}
                                    value={set.reps}
                                    onChangeText={(value) => handleRepsChange(currentExercise.id, index, value)}
                                    keyboardType="numeric"
                                    placeholder={focusedInputs[`${currentExercise.id}-${index}-reps`] ? '' : (() => {
                                      // For completed sets, don't show any placeholder since they have actual values
                                      if (set.isCompleted) {
                                        return '';
                                      }
                                      
                                      // Priority: 1. Recommended reps from database, 2. Last workout values (if not customized), 3. Exercise reps range (if customized)
                                      const recommendedReps = currentRecommendation?.recommended_reps?.toString();
                                      const lastReps = lastExerciseValues[currentExercise.exercise_id]?.[index + 1]?.reps;
                                      const exerciseRepsRange = currentExercise.reps_range;
                                      const isCustomized = exerciseCustomized[currentExercise.id];
                                      
                                      // If exercise was customized, prioritize the reps_range over last values
                                      const finalPlaceholder = recommendedReps || 
                                        (isCustomized ? exerciseRepsRange : lastReps) || 
                                        (isCustomized ? lastReps : exerciseRepsRange) || '-';
                                      

                                      
                                      return finalPlaceholder;
                                    })()}
                                    placeholderTextColor="rgba(255,255,255,0.5)"
                                    selectTextOnFocus={true}
                                    onFocus={(event) => handleInputFocus(`${currentExercise.id}-${index}-reps`, event)}
                                    onBlur={() => handleInputBlur(`${currentExercise.id}-${index}-reps`)}
                                  />
                                  <Text style={styles.activeSetValueUnit}>reps</Text>
                                </View>
                              </View>
                            </View>
                            
                            {/* Last values row - split under each input - only show for incomplete sets */}
                            {!set.isCompleted && (lastExerciseValues[currentExercise.exercise_id]?.[index + 1]?.weight || 
                              lastExerciseValues[currentExercise.exercise_id]?.[index + 1]?.reps) && (
                              <View style={styles.lastValuesRowActive}>
                                {/* Only show weight last value if exercise requires weight */}
                                {currentExercise?.requires_weight !== false && (
                                  <View style={styles.lastValueContainerActive}>
                                    {lastExerciseValues[currentExercise.exercise_id]?.[index + 1]?.weight && (
                                      <Text style={styles.activeSetSubValue}>
                                        ( Last {lastExerciseValues[currentExercise.exercise_id][index + 1]?.weight} )
                                      </Text>
                                    )}
                                  </View>
                                )}
                                
                                {currentExercise?.requires_weight !== false && (
                                  <View style={styles.lastValueSpacer} />
                                )}
                                
                                <View style={styles.lastValueContainerActive}>
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
                            <Text style={[
                              styles.activeSetLabel,
                              currentExercise?.requires_weight === false && { marginLeft: -50 }
                            ]}>
                              {currentExercise?.requires_weight !== false 
                                ? "Weight of bar + plates" 
                                : "Bodyweight exercise - reps only"}
                            </Text>
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
                          {/* Only show weight input if exercise requires weight */}
                          {currentExercise?.requires_weight !== false && (
                            <>
                              <View style={styles.inputContainer}>
                                {/* Suggested label above weight input - hide for completed sets */}
                                {cycleWeek > 1 && getSuggestedValue(currentExercise.exercise_id, index + 1, 'weight') && !set.isCompleted && (
                                  <Text style={styles.suggestedLabelWeight}>
                                    Suggested
                                  </Text>
                                )}
                                <View style={styles.inputFieldContainer}>
                                  <TextInput
                                    style={[styles.inactiveInputField, isCompleted && styles.completedInputField]}
                                    value={set.weight}
                                    onChangeText={(value) => handleWeightChange(currentExercise.id, index, value)}
                                    keyboardType="decimal-pad"
                                    placeholder={focusedInputs[`${currentExercise.id}-${index}-weight`] ? '' : (
                                      // For completed sets, don't show any placeholder since they have actual values
                                      set.isCompleted ? '' : (
                                        // Use recommended weight from database if available, otherwise fall back to suggested value
                                        currentRecommendation?.recommended_weight?.toString() || 
                                        getSuggestedValue(currentExercise.exercise_id, index + 1, 'weight') || '-'
                                      )
                                    )}
                                    placeholderTextColor="rgba(255,255,255,0.5)"
                                    selectTextOnFocus={true}
                                    onFocus={(event) => handleInputFocus(`${currentExercise.id}-${index}-weight`, event)}
                                    onBlur={() => handleInputBlur(`${currentExercise.id}-${index}-weight`)}
                                    editable={!isCompleted}
                                  />
                                  <Text style={styles.activeSetValueUnit}>kg</Text>
                                </View>
                              </View>
                              
                              <View style={styles.inactiveInputDivider} />
                            </>
                          )}
                          
                          <View style={styles.inputContainer}>
                            {/* Suggested label above reps input for bodyweight exercises - hide for completed sets */}
                            {currentExercise?.requires_weight === false && cycleWeek > 1 && getSuggestedValue(currentExercise.exercise_id, index + 1, 'reps') && !set.isCompleted && (
                              <Text style={styles.suggestedLabel}>
                                Suggested
                              </Text>
                            )}
                            <View style={styles.inputFieldContainer}>
                              <TextInput
                                key={`${currentExercise.id}-${index}-reps-${currentExercise.reps_range}-${exerciseCustomized[currentExercise.id] ? 'customized' : 'default'}-${textInputRefreshKey}`}
                                style={[styles.inactiveInputField, isCompleted && styles.completedInputField]}
                                value={set.reps}
                                onChangeText={(value) => handleRepsChange(currentExercise.id, index, value)}
                                keyboardType="numeric"
                                                                    placeholder={focusedInputs[`${currentExercise.id}-${index}-reps`] ? '' : (() => {
                                      // For completed sets, don't show any placeholder since they have actual values
                                      if (set.isCompleted) {
                                        return '';
                                      }
                                      
                                      // Priority: 1. Recommended reps from database, 2. Last workout values (if not customized), 3. Exercise reps range (if customized)
                                      const recommendedReps = currentRecommendation?.recommended_reps?.toString();
                                      const lastReps = lastExerciseValues[currentExercise.exercise_id]?.[index + 1]?.reps;
                                      const exerciseRepsRange = currentExercise.reps_range;
                                      const isCustomized = exerciseCustomized[currentExercise.id];
                                      
                                      // If exercise was customized, prioritize the reps_range over last values
                                      const finalPlaceholder = recommendedReps || 
                                        (isCustomized ? exerciseRepsRange : lastReps) || 
                                        (isCustomized ? lastReps : exerciseRepsRange) || '-';
                                      

                                      
                                      return finalPlaceholder;
                                    })()}
                                placeholderTextColor="rgba(255,255,255,0.5)"
                                selectTextOnFocus={true}
                                onFocus={(event) => handleInputFocus(`${currentExercise.id}-${index}-reps`, event)}
                                onBlur={() => handleInputBlur(`${currentExercise.id}-${index}-reps`)}
                                editable={!isCompleted}
                              />
                              <Text style={styles.activeSetValueUnit}>reps</Text>
                            </View>
                          </View>
                        </View>
                        
                        {/* Last values row for inactive cards - only show for incomplete sets */}
                        {!set.isCompleted && (lastExerciseValues[currentExercise.exercise_id]?.[index + 1]?.weight || 
                          lastExerciseValues[currentExercise.exercise_id]?.[index + 1]?.reps) && (
                          <View style={styles.lastValuesRowInactive}>
                            {/* Only show weight last value if exercise requires weight */}
                            {currentExercise?.requires_weight !== false && (
                              <View style={styles.lastValueContainerInactive}>
                                {lastExerciseValues[currentExercise.exercise_id]?.[index + 1]?.weight && (
                                  <Text style={styles.activeSetSubValue}>
                                    ( Last {lastExerciseValues[currentExercise.exercise_id][index + 1]?.weight} )
                                  </Text>
                                )}
                              </View>
                            )}
                            
                            {currentExercise?.requires_weight !== false && (
                              <View style={styles.lastValueSpacer} />
                            )}
                            
                            <View style={styles.lastValueContainerInactive}>
                              {lastExerciseValues[currentExercise.exercise_id]?.[index + 1]?.reps && (
                                <Text style={styles.activeSetSubValue}>
                                  ( Last {lastExerciseValues[currentExercise.exercise_id][index + 1]?.reps} )
                                </Text>
                              )}
                            </View>
                          </View>
                        )}
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
        <TouchableOpacity style={styles.customizeLink} onPress={handleCustomizeExercisePress}>
          <Text style={styles.customizeLinkText}>Customize Exercise</Text>
        </TouchableOpacity>
        
        {/* Next Exercise Preview - moved inside ScrollView */}
        <View style={styles.nextExerciseSection}>
          <Text style={styles.nextExerciseLabel}>Next Exercise</Text>
          
          {currentExerciseIndex < exercises.length - 1 && (
            <TouchableOpacity 
              style={styles.nextExerciseCard}
              onPress={handleNextExercisePress}
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
                  {exercises[currentExerciseIndex + 1] && 
                   exercises[currentExerciseIndex + 1].exercise_id && 
                   exercises[currentExerciseIndex + 1].requires_weight !== false &&
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
      </KeyboardAvoidingView>
      
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
      
      {/* Exercise Details Modal */}
      {currentExercise && (
        <ExerciseDetailsModal
          visible={showExerciseDetailsModal}
          onClose={handleExerciseDetailsModalClose}
          exerciseId={currentExercise.exercise_id}
          exerciseName={currentExercise.name}
          exerciseImage={currentExercise.image_url}
          primary_muscles={currentExercise.primary_muscles}
          secondary_muscles={[]} // Add secondary muscles if available in your data
        />
      )}
      
      {/* Exercise List Modal */}
      <ExerciseListModal
        visible={showExerciseListModal}
        onClose={handleExerciseListModalClose}
        exercises={exercises}
        currentExerciseIndex={currentExerciseIndex}
        onExerciseSelect={handleExerciseSelect}
        exerciseSets={exerciseSets}
        onStartExercise={handleExerciseSelect}
        maxWeightData={maxWeightData}
        absoluteMaxWeightData={absoluteMaxWeightData}
        recommendations={recommendations}
        lastExerciseValues={lastExerciseValues}
        initialSelectedExerciseIndex={initialSelectedExercise}
        onCustomizeExercise={handleCustomizeExerciseFromList}
      />
      
      {/* Customize Exercise Modal */}
      <CustomizeExerciseModal
        visible={showCustomizeExerciseModal}
        onClose={handleCustomizeExerciseModalClose}
        exercise={exercises[currentExerciseIndex]}
        onSave={handleCustomizeExerciseSave}
      />
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
  weekIndicator: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
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
    flex: 1,
  },
  inputDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: SPACING.md,
  },
  labelCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    minHeight: 44,
    columnGap: 0,
    flex: 1,
  },
  inputFieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    textAlign: 'center',
    alignSelf: 'center',
  },
  activeSetSubValue: {
    color: COLORS.text,
    fontSize: 12,
    opacity: 0.8,
    marginTop: -10,
    textAlign: 'center',
  },
  activeSetLabel: {
    color: COLORS.text,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 0,
    marginLeft: -125,
    paddingHorizontal: SPACING.sm,
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
    height: 100,
    paddingLeft: 0,
    paddingRight: 0,
  },
  inactiveLeftCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  inactiveInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -10,
    flex: 1,
  },
  inactiveInputDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: SPACING.lg,
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
  },
  lastValuesRowActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
  },
  lastValuesRowInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  lastValueContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastValueContainerActive: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastValueContainerInactive: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  suggestedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  suggestedRowInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  suggestedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestedLabel: {
    color: 'rgba(255, 255, 255, 0.61)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginLeft: 0,
    marginBottom: 0,
  },
  suggestedSpacer: {
    width: SPACING.xs,
  },
  suggestedLabelWeight: {
    color: 'rgba(255, 255, 255, 0.61)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginLeft: 0,
    marginBottom: 0,
  },
  suggestedLabelWeightActive: {
    color: 'rgba(255, 255, 255, 0.61)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginLeft: 0,
    marginBottom: 0,
  },
  suggestedContainerWeight: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});