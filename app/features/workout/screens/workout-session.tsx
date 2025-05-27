import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, FlatList, Pressable, Dimensions, Modal, Keyboard, Platform, KeyboardAvoidingView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, Button, Divider } from 'react-native-paper';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import supabase from '../../../services/supabase';
import workoutPlanService from '../../../services/workoutPlanService';
import { useAuth } from '../../../store/AuthContext';
import OptimizedImage from '../../../components/OptimizedImage';
import ExerciseMaxWeightGraph from '../../../components/ExerciseMaxWeightGraph';
import ExerciseDetailsModal from '../../../components/ExerciseDetailsModal';
import ExerciseListModal from '../../../components/ExerciseListModal';
import CustomizeExerciseModal from '../../../components/CustomizeExerciseModal';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../constants/theme';
import { useWorkoutTimer, useExerciseSets } from '../hooks';
import { WorkoutHeader, WorkoutTimerTabs, WorkoutExerciseCard, WorkoutExerciseSetRow, WorkoutWarmupModal, WorkoutExitModal } from '../components';
import type { ExerciseData, ExerciseSet, ExerciseDataItem, MaxWeightDataPoint } from '../types';

const { width: screenWidth } = Dimensions.get('window');

export default function WorkoutSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [exerciseSets, setExerciseSets] = useState<Record<string, ExerciseSet[]>>({});
  const [totalVolume, setTotalVolume] = useState<number>(0); // Total weight lifted (kg)
  const [totalReps, setTotalReps] = useState<number>(0); // Total reps performed
  
  // Use the timer hook
  const {
    workoutDuration,
    workoutTimerActive,
    restTimer,
    restTimerActive,
    workoutStartTime,
    startWorkoutTimer,
    stopWorkoutTimer,
    startRestTimer,
    clearAllTimers,
    setWorkoutStartTime,
    setWorkoutDuration,
    formatTime,
    formatRestTime,
  } = useWorkoutTimer();
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

  // Initialize the exercise sets hook with all necessary callbacks
  const exerciseSetsHook = useExerciseSets({
    exercises,
    currentExerciseIndex,
    recommendations,
    lastExerciseValues,
    totalVolume,
    totalReps,
    setTotalVolume,
    setTotalReps,
    onWorkoutComplete: (volume, reps, sets) => {
      // Callback for basic workout completion (not currently used)
      console.log('Workout completion callback:', volume, reps);
    },
    onExerciseComplete: () => {
      // Callback for exercise completion (not currently used)
      console.log('Exercise completion callback');
    },
    onStartRestTimer: (seconds) => {
      startRestTimer(seconds);
    },
    // Pass external state to hook for integration
    exerciseSets,
    setExerciseSets,
    userEnteredValues,
    setUserEnteredValues,
    exerciseCustomized,
    setExerciseCustomized,
    // Additional callbacks for complex functions
    onCompleteWorkoutWithStateSync: (volume, reps, sets) => {
      completeWorkoutWithStateSync(volume, reps, sets);
    },
    onMoveToNextExercise: () => {
      moveToNextExercise();
    },
  });

  // Use hook functions for all exercise set management
  const {
    handleWeightChange,
    handleRepsChange,
    handleSetComplete,
    handleRedoSet,
    handleLogAllSets,
    autoFillNextIncompleteSetWithValues,
    autoFillNextSetWithValues,
    autoFillNextSet,
    getHighestRepsFromRange,
    getSuggestedValue,
  } = exerciseSetsHook;

  
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
  
  // Get forceStart parameter from URL
  const forceStart = params.forceStart === 'true';

  // REMOVED: Timer functions now come from useWorkoutTimer hook
  
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
        
        // Check if all remaining sets are completed after reducing the number of sets
        const allRemainingCompleted = updatedSets.every(set => set.isCompleted);
        
        if (allRemainingCompleted) {
          // All sets are now completed, handle progression
          setTimeout(() => {
            // Check if this is the last exercise
            if (currentExerciseIndex === exercises.length - 1) {
              // Check if all exercises have all their sets completed
              const allExercisesCompleted = exercises.every(exercise => {
                if (exercise.id === exerciseToUpdate.id) {
                  // For the current exercise, we know all sets are completed
                  return true;
                }
                // For other exercises, check their sets
                const exSets = exerciseSets[exercise.id] || [];
                return exSets.length > 0 && exSets.every(s => s.isCompleted);
              });
              
              if (allExercisesCompleted) {
                // All exercises are completed, save workout data
                completeWorkout();
              }
            } else {
              // Not the last exercise, move to next exercise
              moveToNextExercise();
            }
          }, 500); // Small delay to allow state updates to complete
        }
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

  // REMOVED: Timer functions now come from useWorkoutTimer hook



  // Local functions removed - now handled by useExerciseSets hook
  // Functions moved to hook: handleSetComplete, handleRedoSet, handleLogAllSets, handleWeightChange, handleRepsChange

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
      
      <WorkoutHeader
        insets={insets}
        currentExerciseIndex={currentExerciseIndex}
        totalExercises={exercises.length}
        cycleWeek={cycleWeek}
        weekName={weekName}
        onBackPress={handleBackPress}
        onExerciseListPress={handleExerciseListPress}
      />
      
      <WorkoutTimerTabs
        workoutDuration={workoutDuration}
        totalVolume={totalVolume}
        totalReps={totalReps}
        formatTime={formatTime}
      />
      
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
        <WorkoutExerciseCard
          exercise={currentExercise}
          maxWeightData={maxWeightData[currentExercise?.exercise_id] || []}
          absoluteMaxWeight={absoluteMaxWeightData[currentExercise?.exercise_id] || null}
          onExerciseNamePress={handleExerciseNamePress}
        />
        
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
            
            // Ensure activeSetIndex is within bounds (safety check for when sets are reduced)
            if (activeSetIndex >= currentSets.length) {
              activeSetIndex = -1; // No set should be active if index is out of bounds
            }
            
            const isActive = index === activeSetIndex;
            const isCompleted = set.isCompleted;
            
            return (
              <WorkoutExerciseSetRow
                key={set.id}
                set={set}
                setIndex={index}
                exercise={currentExercise}
                isActive={isActive}
                isCompleted={isCompleted}
                focusedInputs={focusedInputs}
                userEnteredValues={userEnteredValues}
                exerciseCustomized={exerciseCustomized}
                lastExerciseValues={lastExerciseValues}
                currentRecommendation={currentRecommendation}
                textInputRefreshKey={textInputRefreshKey}
                onWeightChange={handleWeightChange}
                onRepsChange={handleRepsChange}
                onSetComplete={handleSetComplete}
                onRedoSet={handleRedoSet}
                onInputFocus={handleInputFocus}
                onInputBlur={handleInputBlur}
                getSuggestedValue={getSuggestedValue}
              />
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
                    fallback={require('../../../../assets/exercises/placeholder.jpg')}
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
      <WorkoutWarmupModal
        visible={showWarmup && !warmupCompleted}
        exerciseName={currentExercise?.name}
        onComplete={handleWarmupComplete}
        onSkip={handleWarmupComplete}
      />
      
                      {/* Exit Workout Modal */}
        <WorkoutExitModal
          visible={showExitModal}
          onEndWorkout={handleExitWorkout}
          onPauseWorkout={handlePauseWorkout}
          onReturnToWorkout={handleReturnToWorkout}
          onClose={() => setShowExitModal(false)}
        />
      
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
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 24,
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



});