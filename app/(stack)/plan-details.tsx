import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ScrollView, Pressable, ActivityIndicator, Dimensions, Modal, Alert, FlatList, TouchableOpacity } from 'react-native';
import { Text, IconButton, Divider, Button, Chip } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import workoutPlanService, { WorkoutPlan, PlanExercise } from '../services/workoutPlanService';
import OptimizedImage from '../components/OptimizedImage';
import { markAsImportantImage, batchPreloadImages, ImagePriority } from '../utils/imagePreloader';
import supabase from '../services/supabase';
import { useAuth } from '../store/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const { width } = Dimensions.get('window');

// Add debug tracking for plan details screen
const DEBUG_NAVIGATION = true;

// Storage key for user's active plan
const ACTIVE_PLAN_STORAGE_KEY = 'mindmuscle_active_plan';

export default function PlanDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const planId = params.planId as string;
  const planNumber = params.planNumber as string;
  const { user } = useAuth();
  
  // Get accent color from params or default to primary color
  const accentColor = params.accent as string || COLORS.primary;
  
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalDuration, setTotalDuration] = useState(0);
  const [totalCalories, setTotalCalories] = useState(0);
  const [imagesPreloaded, setImagesPreloaded] = useState(false);
  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [replacePlanModalVisible, setReplacePlanModalVisible] = useState(false);
  const [existingPlanDetails, setExistingPlanDetails] = useState<any>(null);
  
  // Multi-day workout support
  const [workoutDays, setWorkoutDays] = useState<number[]>([1]); // Default to day 1
  const [currentWorkoutDay, setCurrentWorkoutDay] = useState<number>(1);
  const [exercisesByDay, setExercisesByDay] = useState<{[key: number]: PlanExercise[]}>({});
  const flatListRef = useRef<FlatList>(null);
  
  // Add these state variables to track per-day stats
  const [dayStats, setDayStats] = useState<{[key: number]: {exercises: number, duration: number, calories: number}}>({});
  
  // Map for fallback exercise images based on the ones in assets/exercises
  const fallbackImageMap: { [key: string]: any } = {
    'fullbody.jpg': (global as any).placeholderImages?.fullbody || require('../../assets/exercises/fullbody.jpg'),
    'dumbbell.jpg': (global as any).placeholderImages?.dumbbell || require('../../assets/exercises/dumbbell.jpg'),
    'pushup.jpg': (global as any).placeholderImages?.pushup || require('../../assets/exercises/pushup.jpg'),
    'squat.jpg': (global as any).placeholderImages?.squat || require('../../assets/exercises/squat.jpg'),
    'yoga.jpg': (global as any).placeholderImages?.yoga || require('../../assets/exercises/yoga.jpg'),
    'placeholder.jpg': (global as any).placeholderImages?.exercise || require('../../assets/exercises/placeholder.jpg'),
  };

  // Day navigation handler through buttons
  const handleDayChange = (dayNumber: number) => {
    setCurrentWorkoutDay(dayNumber);
    
    // Find the index of the day and scroll to it
    const dayIndex = workoutDays.indexOf(dayNumber);
    if (dayIndex !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index: dayIndex,
        animated: true
      });
    }
  };

  // Navigate between days via direction
  const handleDayNavigation = (direction: 'left' | 'right') => {
    const currentIndex = workoutDays.indexOf(currentWorkoutDay);
    let nextIndex;
    
    if (direction === 'left' && currentIndex < workoutDays.length - 1) {
      // Next day (to the right)
      nextIndex = currentIndex + 1;
    } else if (direction === 'right' && currentIndex > 0) {
      // Previous day (to the left)
      nextIndex = currentIndex - 1;
    } else {
      // Edge cases - no more days in this direction
      return;
    }
    
    if (nextIndex !== undefined) {
      setCurrentWorkoutDay(workoutDays[nextIndex]);
      
      // Scroll to the corresponding index
      if (flatListRef.current) {
        flatListRef.current.scrollToIndex({
          index: nextIndex,
          animated: true
        });
      }
    }
  };

  // Fetch plan and exercises
  useEffect(() => {
    async function fetchPlanDetails() {
      try {
        setIsLoading(true);
        
        // Fetch plan details
        if (planId) {
          const planData = await workoutPlanService.getPlanById(planId);
          
          if (planData) {
            setPlan(planData);
            
            // Fetch available workout days first
            const availableDays = await workoutPlanService.getPlanWorkoutDays(planId);
            setWorkoutDays(availableDays);
            
            // Organize exercises by workout day
            const exercisesByDayMap: {[key: number]: PlanExercise[]} = {};
            let allExercises: PlanExercise[] = [];
            
            // For tracking stats per day
            const dayStatsMap: {[key: number]: {exercises: number, duration: number, calories: number}} = {};
            
            // Fetch exercises for all days
            for (const day of availableDays) {
              const dayExercises = await workoutPlanService.getPlanExercises(planId, day);
              exercisesByDayMap[day] = dayExercises;
              allExercises = [...allExercises, ...dayExercises];
              
              // Calculate stats for this specific day
              let dayDuration = 0;
              let dayCalories = 0;
              
              dayExercises.forEach(exercise => {
                const setsTime = exercise.sets * 45; 
                const restTime = (exercise.sets - 1) * (exercise.rest_time || 60);
                dayDuration += setsTime + restTime;
                dayCalories += Math.floor((setsTime + restTime) / 60 * 10);
              });
              
              // Store per-day stats
              dayStatsMap[day] = {
                exercises: dayExercises.length,
                duration: Math.ceil(dayDuration / 60),
                calories: dayCalories
              };
            }
            
            setDayStats(dayStatsMap);
            setExercisesByDay(exercisesByDayMap);
            setExercises(allExercises);
            
            // Calculate overall stats (still needed for other parts of the app)
            let duration = 0;
            let calories = 0;
            
            allExercises.forEach(exercise => {
              const setsTime = exercise.sets * 45; 
              const restTime = (exercise.sets - 1) * (exercise.rest_time || 60);
              duration += setsTime + restTime;
              calories += Math.floor((setsTime + restTime) / 60 * 10);
            });
            
            setTotalDuration(Math.ceil(duration / 60));
            setTotalCalories(calories);
            
            // Preload exercise images for better performance
            const imagesToPreload = allExercises
              .map(exercise => exercise.image_url)
              .filter((url): url is string => {
                return !!url && typeof url === 'string' && url.startsWith('http');
              });
              
            if (imagesToPreload.length > 0) {
              batchPreloadImages(
                imagesToPreload,
                ImagePriority.HIGH,
                5,
                (progress) => {
                  if (progress === 1) {
                    setImagesPreloaded(true);
                  }
                }
              );
            }
            
            // Mark plan image as important if available
            if (planData.image_url && typeof planData.image_url === 'string') {
              markAsImportantImage(planData.image_url);
            }
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error in fetchPlanDetails:', error);
        setIsLoading(false);
      }
    }

    fetchPlanDetails();
  }, [planId]);

  // Handle viewable exercises change
  const handleViewableItemsChanged = ({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      const visibleDay = viewableItems[0].item;
      setCurrentWorkoutDay(visibleDay);
    }
  };

  // Configure viewability config for FlatList
  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50
  };

  // Create ref for viewability callback
  const viewabilityConfigCallbackPairs = useRef([
    { viewabilityConfig, onViewableItemsChanged: handleViewableItemsChanged }
  ]);

  const handleBackPress = () => {
    if (DEBUG_NAVIGATION) {
      console.log('🔀 NAVIGATION: Going back from plan-details screen');
    }
    
    // Always use explicit navigation to plans screen instead of router.back()
    // We need to preserve the subcategoryId if it was passed to ensure proper data loading
    const subcategoryId = params.subcategoryId as string;
    const accent = params.accent as string;
    const title = params.subcategoryTitle as string || params.planTitle as string;
    const subcategoryName = params.subcategoryName as string;
    const subcategoryTitle = params.subcategoryTitle as string;
    const subcategorySubtitle = params.subcategorySubtitle as string;
    const categoryName = params.categoryName as string;
    
    // Always navigate to plans - explicitly set the path to ensure proper navigation
    router.push({
      pathname: "/(stack)/plans",
      params: subcategoryId ? { 
        subcategoryId,
        accent, // Pass the accent color to preserve it when navigating back
        title,
        subcategoryName,
        subcategoryTitle,
        subcategorySubtitle,
        categoryName
      } : {}
    });
  };

  const handleAddToMyPlan = async () => {
    if (!plan || isAddingPlan || !user) return;
    
    try {
      setIsAddingPlan(true);
      
      if (DEBUG_NAVIGATION) {
        console.log('📋 PLAN: Adding plan to My Plan:', plan.title || `Plan ${planNumber || ''}`);
      }
      
      // First check if user already has an active plan
      try {
        const { data: existingPlans, error: checkError } = await supabase
          .from('user_active_plans')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'InProgress')
          .limit(1);
          
        if (checkError) {
          console.error('Error checking for existing plan:', checkError);
          setIsAddingPlan(false);
          Alert.alert('Error', 'Failed to check for existing plans. Please try again.');
          return;
        }
        
        // If there's an existing plan, show replacement modal
        if (existingPlans && existingPlans.length > 0) {
          setExistingPlanDetails(existingPlans[0]);
          setReplacePlanModalVisible(true);
          setIsAddingPlan(false);
          return;
        }
        
        // If no existing plan, add the new one directly
        await addNewPlan();
      } catch (fetchError) {
        console.error('Exception checking for existing plans:', fetchError);
        
        // Ask the user if they want to try adding the plan anyway
        Alert.alert(
          'Warning', 
          'Unable to check for existing plans. Do you want to try adding this plan anyway?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setIsAddingPlan(false)
            },
            {
              text: 'Try Anyway',
              onPress: () => addNewPlan()
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error in handleAddToMyPlan:', error);
      setIsAddingPlan(false);
      Alert.alert('Error', 'Failed to add plan. Please try again.');
    }
  };

  const handleReplacePlan = async (planToReplace = null) => {
    try {
      // Use provided plan or existingPlanDetails from state
      const planDetail = planToReplace || existingPlanDetails;
      
      if (!planDetail || !user) {
        console.error('Missing plan details or user');
        setIsAddingPlan(false);
        return;
      }
      
      setIsAddingPlan(true);
      
      // First explicitly delete the existing plan
      console.log('Deleting existing plan:', planDetail.id);
      
      // 1. Delete the plan exercises first (to avoid foreign key constraints)
      const { error: deleteExercisesError } = await supabase
        .from('user_active_plan_exercises')
        .delete()
        .eq('active_plan_id', planDetail.id);
        
      if (deleteExercisesError) {
        console.error('Error deleting existing exercises:', deleteExercisesError);
        // Continue anyway as the plan deletion will cascade
      }
      
      // 2. Now delete the plan itself
      const { error: deletePlanError } = await supabase
        .from('user_active_plans')
        .delete()
        .eq('id', planDetail.id);
        
      if (deletePlanError) {
        console.error('Error deleting existing plan:', deletePlanError);
        Alert.alert('Error', 'Failed to replace your current plan. Please try again.');
        setIsAddingPlan(false);
        return;
      }
      
      // Wait for deletion to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 3. Now insert the new plan
      const weekProgressionData = {
        "1": "Adaptation",
        "2": "Accumulation",
        "3": "Intensification", 
        "4": "Realization",
        "5": "Recovery"
      };
      
      const { data: newPlan, error: insertError } = await supabase
        .from('user_active_plans')
        .insert({
          user_id: user.id,
          plan_id: planId,
          name: plan?.title || `Plan ${planNumber || ''}`,
          subtitle: plan?.subcategory_subtitle || '',
          exercise_count: exercises.length,
          duration: totalDuration,
          calories: totalCalories,
          accent_color: accentColor,
          status: 'InProgress',
          is_active: true,
          source_type: 'default_plan',
          section: 'default_plan',
          source_identifier: plan?.identifier || (params.subcategoryId as string || ''),
          workout_frequency: plan?.workout_frequency || 1,
          current_week: 1,
          week_started_at: new Date().toISOString(),
          week_progression: weekProgressionData
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('Error inserting new plan after replacement:', insertError);
        Alert.alert('Error', 'Failed to add new plan after replacing old one. Please try again.');
        setIsAddingPlan(false);
        return;
      }
      
      // 4. Add the exercises for the new plan
      if (exercises.length > 0 && newPlan) {
        const exercisesToInsert = exercises.map((ex, index) => ({
          active_plan_id: newPlan.id,
          exercise_id: ex.exercise_id,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          rest_time: ex.rest_time,
          order_position: index + 1,
          image_url: ex.image_url || ''
        }));
        
        const { error: exerciseError } = await supabase
          .from('user_active_plan_exercises')
          .insert(exercisesToInsert);
          
        if (exerciseError) {
          console.error('Error inserting plan exercises:', exerciseError);
          Alert.alert('Error', 'Your plan was replaced but exercises could not be added. You may need to select a new plan.');
          setIsAddingPlan(false);
          return;
        }
      }
      
      // Success! Navigate to home screen
      router.replace("/(tabs)");
      
      // Close the modal
      setReplacePlanModalVisible(false);
    } catch (error) {
      console.error('Error replacing plan:', error);
      Alert.alert('Error', 'Failed to replace plan. Please try again.');
    } finally {
      setIsAddingPlan(false);
    }
  };

  const addNewPlan = async () => {
    try {
      setIsAddingPlan(true);
      
      // Check if user is logged in
      if (!user) {
        Alert.alert('Error', 'You need to be logged in to add a plan.');
        setIsAddingPlan(false);
        return;
      }
      
      // Prepare week progression data
      const weekProgressionData = {
        "1": "Adaptation",
        "2": "Accumulation",
        "3": "Intensification", 
        "4": "Realization",
        "5": "Recovery"
      };
      
      // First, delete ANY existing active plans for this user
      const { error: deleteError } = await supabase
        .from('user_active_plans')
        .delete()
        .eq('user_id', user.id)
        .eq('status', 'InProgress');
        
      if (deleteError) {
        console.error('Error deleting existing plans:', deleteError);
        Alert.alert('Error', 'Could not delete existing plans. Please try again.');
        setIsAddingPlan(false);
        return;
      }
      
      // Wait to ensure deletion is complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Now insert the new plan
      const { data: newPlan, error: insertError } = await supabase
        .from('user_active_plans')
        .insert({
          user_id: user.id,
          plan_id: planId,
          name: plan?.title || `Plan ${planNumber || ''}`,
          subtitle: plan?.subcategory_subtitle || '',
          exercise_count: exercises.length,
          duration: totalDuration,
          calories: totalCalories,
          accent_color: accentColor,
          status: 'InProgress',
          is_active: true,
          source_type: 'default_plan',
          section: 'default_plan',
          source_identifier: plan?.identifier || (params.subcategoryId as string || ''),
          workout_frequency: plan?.workout_frequency || 1,
          current_week: 1,
          week_started_at: new Date().toISOString(),
          week_progression: weekProgressionData
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('Error inserting plan:', insertError);
        Alert.alert('Error', 'Failed to add plan. Please try again later.');
        setIsAddingPlan(false);
        return;
      }
      
      // Add exercises for the active plan
      if (exercises.length > 0 && newPlan) {
        try {
          const exercisesToInsert = exercises.map((ex, index) => ({
            active_plan_id: newPlan.id,
            exercise_id: ex.exercise_id,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            rest_time: ex.rest_time,
            order_position: index + 1,
            image_url: ex.image_url || ''
          }));
          
          const { error: exerciseError } = await supabase
            .from('user_active_plan_exercises')
            .insert(exercisesToInsert);
            
          if (exerciseError) {
            console.error('Error inserting plan exercises:', exerciseError);
            Alert.alert('Error', 'Failed to add exercises to new plan.');
            setIsAddingPlan(false);
            return;
          }
        } catch (insertExercisesError) {
          console.error('Exception inserting exercises:', insertExercisesError);
          Alert.alert('Error', 'Failed to add exercises to new plan.');
          setIsAddingPlan(false);
          return;
        }
      }
      
      // Success! Navigate to home screen
      router.replace("/(tabs)");
    } catch (error) {
      console.error('Error in addNewPlan:', error);
      Alert.alert('Error', 'Failed to add plan. Please try again.');
    } finally {
      setIsAddingPlan(false);
    }
  };

  // Navigate to exercise details screen
  const handleExercisePress = (exercise: PlanExercise) => {
    // Navigate to exercise details screen with the exercise ID
    if (exercise.exercise_id) {
      // Get proper image URL to pass
      let imageUrl = '';
      
      // If the exercise has a valid image_url that's a full URL, use it
      if (exercise.image_url && exercise.image_url.startsWith('http')) {
        imageUrl = exercise.image_url;
      } 
      // Otherwise, we need to find an appropriate placeholder
      // We can only pass URL strings as params, not require() references
      else if (exercise.primary_muscles) {
        // Try to determine a specific placeholder based on primary muscles
        if (exercise.primary_muscles.some(m => m.toLowerCase().includes('chest'))) {
          imageUrl = 'placeholder_pushup';
        } else if (exercise.primary_muscles.some(m => m.toLowerCase().includes('quad'))) {
          imageUrl = 'placeholder_squat';
        } else if (exercise.primary_muscles.some(m => m.toLowerCase().includes('bicep') || m.toLowerCase().includes('tricep'))) {
          imageUrl = 'placeholder_dumbbell';
        } else {
          imageUrl = 'placeholder_default';
        }
      } else {
        imageUrl = 'placeholder_default';
      }
      
      // Get accent color from params
      const accent = params.accent as string;
      const subcategoryId = params.subcategoryId as string;
      const subcategoryName = params.subcategoryName as string;
      const subcategoryTitle = params.subcategoryTitle as string;
      const subcategorySubtitle = params.subcategorySubtitle as string; 
      const categoryName = params.categoryName as string;
      
      router.push({
        pathname: "/(stack)/exercise-details",
        params: {
          id: exercise.exercise_id,
          name: exercise.name || 'Exercise',
          image: imageUrl,
          fromPlanDetails: 'true',
          planId: planId, // Pass the plan ID for navigation back to plan details
          accent: accent, // Pass the accent color to preserve color scheme
          subcategoryId,
          subcategoryName,
          subcategoryTitle,
          subcategorySubtitle,
          categoryName
        }
      });
    }
  };

  // Helper to get appropriate image source with fallback
  const getImageSource = (exercise: PlanExercise) => {
    // If the exercise has a valid image_url, use it
    if (exercise.image_url) {
      // Check if it's a full URL (starts with http/https)
      if (exercise.image_url.startsWith('http')) {
        return { uri: exercise.image_url };
      } 
      // Check if it's a key in our fallback image map
      else if (fallbackImageMap[exercise.image_url]) {
        return fallbackImageMap[exercise.image_url];
      }
    }
    
    // Determine fallback based on muscle group if possible
    if (exercise.muscle_group) {
      const muscleGroup = exercise.muscle_group.toLowerCase();
      if (muscleGroup.includes('chest')) {
        return fallbackImageMap['pushup.jpg'];
      } else if (muscleGroup.includes('leg') || muscleGroup.includes('quad')) {
        return fallbackImageMap['squat.jpg'];
      }
    }
    
    // Check if exercise has primary muscles that can help us determine a suitable image
    if (exercise.primary_muscles && exercise.primary_muscles.length > 0) {
      const primaryMuscle = exercise.primary_muscles[0].toLowerCase();
      if (primaryMuscle.includes('chest')) {
        return fallbackImageMap['pushup.jpg'];
      } else if (primaryMuscle.includes('quad') || primaryMuscle.includes('glute')) {
        return fallbackImageMap['squat.jpg'];
      } else if (primaryMuscle.includes('bicep') || primaryMuscle.includes('tricep')) {
        return fallbackImageMap['dumbbell.jpg'];
      }
    }
    
    // Default fallback
    return fallbackImageMap['placeholder.jpg'];
  };

  // Get plan title or fallback
  const getPlanTitle = () => {
    return `PLAN ${planNumber || ''}`;
  };

  // Render an individual exercise row
  const renderExerciseItem = (exercise: PlanExercise, index: number) => {
    if (!exercise.name) {
      return null;
    }

    const imageSource = getImageSource(exercise);
    const debugLabel = `Exercise-${exercise.id || index}`;

    return (
      <Pressable 
        key={exercise.id || `exercise-${index}`}
        style={styles.exerciseCard}
        onPress={() => handleExercisePress(exercise)}
        android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
      >
        <View style={styles.exerciseLeft}>
          <OptimizedImage
            source={imageSource}
            style={styles.exerciseImage}
            resizeMode="cover"
            priority="normal"
            cachePolicy="immutable"
            showLoader={!imagesPreloaded}
            fallback={fallbackImageMap['placeholder.jpg']}
            debugLabel={debugLabel}
          />
        </View>
        <View style={styles.exerciseMiddle}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <Text style={styles.exerciseDetails}>
            {exercise.sets} sets · {exercise.reps} reps
            {exercise.rest_time ? ` · ${exercise.rest_time}s rest` : ''}
          </Text>
        </View>
        <View style={styles.exerciseRight}>
          <IconButton
            icon="chevron-right"
            size={24}
            iconColor={COLORS.text}
          />
        </View>
      </Pressable>
    );
  };

  // Render a day's worth of exercises
  const renderDayExercises = ({ item: dayNumber, index }: { item: number, index: number }) => {
    const dayExercises = exercisesByDay[dayNumber] || [];
    
    return (
      <View style={[styles.dayExercisesContainer, { width }]}>
        <View style={styles.exercisesContainer}>
          {dayExercises.length > 0 ? (
            dayExercises.map((exercise, index) => renderExerciseItem(exercise, index))
          ) : (
            <Text style={styles.noExercisesText}>No exercises available for this day.</Text>
          )}
        </View>
        
        {/* Add pagination dots directly below exercises */}
        {workoutDays.length > 1 && (
          <View style={styles.paginationContainer}>
            {workoutDays.map(day => (
              <TouchableOpacity
                key={`dot-${day}`}
                onPress={() => handleDayChange(day)}
                style={[
                  styles.paginationDot,
                  currentWorkoutDay === day && styles.activePaginationDot
                ]}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  // Calculate content padding based on bottom insets
  const contentPadding = insets.bottom + SPACING.xl;
  
  // Determine if we should show the start plan button
  const shouldShowStartButton = (exercises.length > 0 && !isLoading);

  // Add this new function for the modal button
  const onReplacePlanPress = async () => {
    // Close modal first to avoid visual issues if there's an error
    setReplacePlanModalVisible(false);
    
    // Small delay to allow modal to close before starting replacement
    setTimeout(() => {
      handleReplacePlan(existingPlanDetails);
    }, 300);
  };

  // Get current day's stats
  const currentDayStats = dayStats[currentWorkoutDay] || { exercises: 0, duration: 0, calories: 0 };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={[styles.header, { marginTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <IconButton
            icon="arrow-left"
            size={28}
            onPress={handleBackPress}
            iconColor={COLORS.text}
            style={styles.backButton}
          />
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{getPlanTitle()}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>
      <Divider style={styles.divider} />
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading plan details...</Text>
        </View>
      ) : (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={{ paddingBottom: contentPadding }}
            showsVerticalScrollIndicator={false}
          >
            {/* Plan Summary */}
            <View style={styles.summaryContainer}>
              <Text style={styles.planTypeLabel}>{plan?.subcategory_subtitle || 'Unknown'}</Text>
              
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <MaterialCommunityIcons name="lightning-bolt" size={18} color={COLORS.primary} />
                  <Text style={styles.statValue}>{currentDayStats.exercises} Exercises</Text>
                </View>
                
                <View style={styles.statItem}>
                  <MaterialCommunityIcons name="clock-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.statValue}>{currentDayStats.duration} Min</Text>
                </View>
                
                <View style={styles.statItem}>
                  <MaterialCommunityIcons name="fire" size={18} color={COLORS.primary} />
                  <Text style={styles.statValue}>{currentDayStats.calories} Cal</Text>
                </View>
              </View>
            </View>
            
            {/* Day indicator with simplified display */}
            {workoutDays.length > 1 && (
              <View style={styles.dayIndicatorContainer}>
                <View style={styles.dayNavigationRow}>
                  <Text style={styles.dayIndicatorText}>
                    Day {currentWorkoutDay}
                  </Text>
                </View>
                <Text style={styles.swipeInstructionText}>
                  Swipe to navigate between days
                </Text>
              </View>
            )}
            
            {/* FlatList for horizontal day scrolling */}
            <FlatList
              ref={flatListRef}
              data={workoutDays}
              renderItem={renderDayExercises}
              keyExtractor={(item) => `day-${item}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
              initialScrollIndex={workoutDays.indexOf(currentWorkoutDay)}
              getItemLayout={(data, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
              onScrollToIndexFailed={(info) => {
                // Handle scroll failures gracefully
                const wait = new Promise(resolve => setTimeout(resolve, 100));
                wait.then(() => {
                  flatListRef.current?.scrollToIndex({ index: 0, animated: false });
                });
              }}
            />

            {/* Pagination dots removed from here - now inside each day's view */}
          </ScrollView>
        </GestureHandlerRootView>
      )}
      
      {/* Bottom action button */}
      <View style={styles.bottomButtonContainer}>
        <Button
          mode="contained"
          onPress={handleAddToMyPlan}
          style={styles.startButton}
          labelStyle={styles.startButtonLabel}
          loading={isAddingPlan}
          disabled={isAddingPlan}
        >
          START THIS PLAN
        </Button>
      </View>
      
      {/* Replace Plan Modal */}
      <Modal
        visible={replacePlanModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setReplacePlanModalVisible(false);
          setIsAddingPlan(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Replace Current Plan?</Text>
            <Text style={styles.modalMessage}>
              You already have a training plan in progress ({existingPlanDetails?.name || 'Active Plan'}). 
              Replacing it will delete your current progress. Would you like to continue?
            </Text>
            <Button
              mode="contained"
              style={[styles.modalButton, { backgroundColor: COLORS.error }]}
              onPress={onReplacePlanPress}
              loading={isAddingPlan}
              disabled={isAddingPlan}
            >
              Replace Current Plan
            </Button>
            <Button
              mode="text"
              style={styles.modalButton}
              onPress={() => {
                setReplacePlanModalVisible(false);
                setIsAddingPlan(false);
              }}
              disabled={isAddingPlan}
            >
              Cancel
            </Button>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    height: 56,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  headerRight: {
    flex: 1,
  },
  backButton: {
    margin: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  divider: {
    height: 0.2,
    backgroundColor: COLORS.primary,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  summaryContainer: {
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: `${COLORS.surface}30`,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 0.2,
    borderColor: `${COLORS.primary}80`,
  },
  gradientBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  planTypeLabel: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.surfaceLight}30`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs / 5,
    borderRadius: BORDER_RADIUS.sm,
  },
  statValue: {
    color: COLORS.text,
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '500',
  },
  sectionTitleContainer: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sectionDivider: {
    backgroundColor: `${COLORS.primary}60`,
    height: 2,
    width: 40,
  },
  dayExercisesContainer: {
    flex: 1,
    paddingBottom: 0,
  },
  exercisesContainer: {
    marginHorizontal: SPACING.md,
    marginTop: 0,
    marginBottom: 0,
  },
  workoutDaysTabs: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  workoutDaysTabsContent: {
    paddingVertical: SPACING.xs,
    gap: SPACING.xs,
  },
  dayTab: {
    marginRight: SPACING.xs,
    backgroundColor: COLORS.surface,
  },
  dayTabText: {
    fontSize: 14,
    color: COLORS.text,
  },
  selectedDayTabText: {
    color: '#000',
    fontWeight: 'bold',
  },
  exercisesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  exerciseCard: {
    flexDirection: 'row',
    backgroundColor: `${COLORS.surface}60`,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    height: 90,
    borderWidth: 0.2,
    borderColor: `${COLORS.primary}80`,
  },
  exerciseLeft: {
    width: 90,
    height: 90,
  },
  exerciseImage: {
    width: 90,
    height: 90,
  },
  exerciseMiddle: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
  },
  exerciseName: {
    color: COLORS.text,
    fontWeight: 500,
    fontSize: 15,
  },
  exerciseDetails: {
    color: `${COLORS.text}B3`, // 70% opacity
    fontSize: 13,
    marginTop: 4,
  },
  exerciseRight: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: SPACING.sm,
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: `${COLORS.primary}20`,
  },
  emptyText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  emptySubtext: {
    color: COLORS.text,
    opacity: 0.7,
    fontSize: 14,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  bottomButtonContainer: {
    padding: SPACING.md,
    borderTopWidth: 0.2,
    borderTopColor: `${COLORS.primary}80`,
    backgroundColor: COLORS.background,
    paddingBottom: SPACING.xl,
  },
  startButton: {
    borderRadius: BORDER_RADIUS.md,
    height: 52,
    justifyContent: 'center',
  },
  startButtonLabel: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingIndicator: {
    marginTop: SPACING.md,
  },
  noExercisesText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.error,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  modalButton: {
    width: '100%',
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: SPACING.xs,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
    marginHorizontal: 5,
  },
  activePaginationDot: {
    width: 10,
    height: 10, 
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  dayIndicatorContainer: {
    alignItems: 'center',
    marginVertical: SPACING.sm,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.md,
  },
  dayIndicatorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  dayNavigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeInstructionText: {
    fontSize: 12,
    color: COLORS.text,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: SPACING.xs/2,
  },
}); 