import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { IconButton, Button, Divider, TextInput as PaperTextInput } from 'react-native-paper';
import { TextInput as RNTextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import supabase from '../services/supabase';
import { useAuth } from '../store/AuthContext';
import OptimizedImage from '../components/OptimizedImage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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
  const [lastExerciseValues, setLastExerciseValues] = useState<Record<string, { weight: string, reps: string }>>({});
  
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
  
  // Extract params
  const planId = params.planId as string;
  const workoutDay = parseInt(params.workoutDay as string, 10);
  const cycleWeek = parseInt(params.cycleWeek as string, 10) || 1;
  const weekName = params.weekName as string || 'Adaptation';
  
  // Timer interval reference
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchWorkoutData();
    
    // Start workout timer
    setWorkoutStartTime(new Date());
    setWorkoutTimerActive(true);
    
    // Start workout duration timer
    const workoutTimerInterval = setInterval(() => {
      setWorkoutDuration(prev => prev + 1);
    }, 1000);
    
    // Cleanup
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      clearInterval(workoutTimerInterval);
    };
  }, [planId, workoutDay]);

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
      
    } catch (error) {
      console.error('Error fetching workout data:', error);
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
    setExerciseSets(prev => {
      const updatedSets = [...prev[exerciseId]];
      const currentSet = updatedSets[setIndex];
      const newCompletedState = !currentSet.isCompleted;
      
      // If the set is being marked as completed, add its volume and reps to totals
      if (newCompletedState) {
        const weight = currentSet.weight === '-' || currentSet.weight === '' ? 0 : parseFloat(currentSet.weight);
        const reps = currentSet.reps === '-' || currentSet.reps === '' ? 0 : parseFloat(currentSet.reps);
        const setVolume = parseFloat((weight * reps).toFixed(1)); // Ensure precision to 1 decimal place
        
        setTotalVolume(prev => parseFloat((prev + setVolume).toFixed(1)));
        setTotalReps(prev => prev + reps);
        
        // Store the last values for this exercise if they're valid
        if (currentSet.weight !== '-' && currentSet.weight !== '' && currentSet.reps !== '-' && currentSet.reps !== '') {
          setLastExerciseValues(prev => ({
            ...prev,
            [exerciseId]: { weight: currentSet.weight, reps: currentSet.reps }
          }));
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
      
      // We'll handle auto-filling in the handleNextSet function
      // This code just updates the current set state
      
      return { ...prev, [exerciseId]: updatedSets };
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
      setCurrentExerciseIndex(prev => prev + 1);
    }
  };

  const moveToPreviousExercise = () => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex(prev => prev - 1);
    }
  };

  const completeWorkout = async () => {
    if (!user || !planId || !workoutStartTime) return;
    
    // Stop the workout timer
    setWorkoutTimerActive(false);
    
    // Final calculation of workout metrics
    const finalDuration = workoutDuration;
    const finalVolume = totalVolume;
    const finalReps = totalReps;
    
    try {
      // Show loading indicator
      setIsLoading(true);
      
      // Calculate workout duration
      const workoutEndTime = new Date();
      const workoutDuration = Math.round((workoutEndTime.getTime() - workoutStartTime.getTime()) / 60000);
      
      // 1. Insert workout history entry
      const { data: workoutData, error: workoutError } = await supabase
        .from('user_workout_history')
        .insert({
          user_id: user.id,
          plan_id: planId,
          workout_day: workoutDay,
          cycle_week: cycleWeek,
          week_name: weekName,
          duration_minutes: workoutDuration,
          calories_burned: Math.round(workoutDuration * 8.5) // Rough estimate
        })
        .select('id')
        .single();
        
      if (workoutError) throw workoutError;
      
      if (!workoutData) throw new Error('Failed to create workout history record');
      
      const workoutHistoryId = workoutData.id;
      
      // 2. Insert exercise records
      const exerciseRecords = [];
      
      for (const exercise of exercises) {
        const sets = exerciseSets[exercise.id] || [];
        
        for (const set of sets) {
          if (set.isCompleted) { // Only save completed sets
            // Transform '-' to '0' when saving to database
            const weight = set.weight === '-' ? '0' : set.weight;
            const reps = set.reps === '-' ? '0' : set.reps;
            
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
          
        if (recordsError) throw recordsError;
      }
      
      // 3. Update user active plan
      const { data: planData, error: planError } = await supabase
        .from('user_active_plans')
        .select('completed_workouts, current_week, current_day')
        .eq('user_id', user.id)
        .eq('plan_id', planId)
        .eq('is_active', true)
        .single();
        
      if (planError) throw planError;
      
      if (planData) {
        const { completed_workouts, current_week, current_day } = planData;
        let updatedWeek = current_week;
        let updatedCompleted = false;
        
        // Calculate new completed workouts count
        const newCompletedWorkouts = (completed_workouts || 0) + 1;
        
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
        
        // Update the active plan
        const { error: updateError } = await supabase
          .from('user_active_plans')
          .update({
            completed_workouts: newCompletedWorkouts,
            current_week: updatedWeek,
            current_day: (current_day + 1) % workoutsPerWeek, // Cycle through 0, 1, 2
            last_workout_date: new Date().toISOString(),
            completed: updatedCompleted
          })
          .eq('user_id', user.id)
          .eq('plan_id', planId)
          .eq('is_active', true);
          
        if (updateError) throw updateError;
      }
      
      // Success - navigate back to home
      Alert.alert(
        'Workout Complete!',
        'Your workout has been saved successfully.',
        [{ text: 'OK', onPress: () => router.push('/') }]
      );
      
    } catch (error) {
      console.error('Error completing workout:', error);
      Alert.alert('Error', 'Failed to save workout data');
    }
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
                                <RNTextInput
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
                              <Text style={styles.activeSetSubValue}>(Last 15)</Text>
                            </View>
                            <View style={styles.dividerContainer}>
                              <View style={styles.horizontalDivider} />
                            </View>
                            <View style={styles.repsCell}>
                              <View style={styles.inputContainer}>
                                <RNTextInput
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
                              <Text style={styles.activeSetSubValue}>(Last 10)</Text>
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
                          <RNTextInput
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
                          <RNTextInput
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
          onPress={() => {/* Log all sets */}}
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
  headerTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
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