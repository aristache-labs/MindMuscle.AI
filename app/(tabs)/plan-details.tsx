import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { Text, IconButton, Divider, Button } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OptimizedImage from '../components/OptimizedImage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import workoutPlanService, { WorkoutPlan, PlanExercise } from '../services/workoutPlanService';

const { width } = Dimensions.get('window');

// Add debug tracking for plan details screen
const DEBUG_NAVIGATION = true;

export default function PlanDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const planId = params.planId as string;
  const planNumber = params.planNumber as string;
  
  // Get accent color from params or default to primary color
  const accentColor = params.accent as string || COLORS.primary;
  
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [exercises, setExercises] = useState<PlanExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalDuration, setTotalDuration] = useState(0);
  const [totalCalories, setTotalCalories] = useState(0);

  // Map for fallback exercise images based on the ones in assets/exercises
  const fallbackImageMap: { [key: string]: any } = {
    'fullbody.jpg': require('../../assets/exercises/fullbody.jpg'),
    'dumbbell.jpg': require('../../assets/exercises/dumbbell.jpg'),
    'pushup.jpg': require('../../assets/exercises/pushup.jpg'),
    'squat.jpg': require('../../assets/exercises/squat.jpg'),
    'yoga.jpg': require('../../assets/exercises/yoga.jpg'),
    'placeholder.jpg': require('../../assets/exercises/placeholder.jpg'),
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
            
            // Fetch exercises for this plan
            const exercisesData = await workoutPlanService.getPlanExercises(planId);
            
            if (exercisesData && exercisesData.length > 0) {
              setExercises(exercisesData);
              
              // Calculate stats 
              let duration = 0;
              let calories = 0;
              
              exercisesData.forEach(exercise => {
                const setsTime = exercise.sets * 45; 
                const restTime = (exercise.sets - 1) * (exercise.rest_time || 60);
                duration += setsTime + restTime;
                calories += Math.floor((setsTime + restTime) / 60 * 10);
              });
              
              setTotalDuration(Math.ceil(duration / 60));
              setTotalCalories(calories);
            }
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        setIsLoading(false);
      }
    }

    fetchPlanDetails();
  }, [planId]);

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
      pathname: "/(tabs)/plans",
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

  const handleStartWorkout = () => {
    // Navigate to workout screen with plan details
    // This will be implemented in a future step
    router.push('/(tabs)/index');
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
        pathname: "/(tabs)/exercise-details",
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

    return (
      <Pressable 
        key={exercise.id || `exercise-${index}`}
        style={styles.exerciseCard}
        onPress={() => handleExercisePress(exercise)}
        android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
      >
        <View style={styles.exerciseLeft}>
          <OptimizedImage
            source={getImageSource(exercise)}
            style={styles.exerciseImage}
            contentFit="cover"
          />
        </View>
        <View style={styles.exerciseCenter}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <Text style={styles.exerciseDetails}>
            {exercise.sets || 3} sets × {exercise.reps || '8-10'} reps
          </Text>
          {exercise.rest_time && (
            <Text style={styles.restTimeText}>
              Rest: {exercise.rest_time}s
            </Text>
          )}
        </View>
        <View style={styles.exerciseRight}>
          {/* Muscle icons removed */}
        </View>
      </Pressable>
    );
  };

  // Calculate content padding based on bottom insets
  const contentPadding = insets.bottom + SPACING.xl;
  
  // Determine if we should show the start plan button
  const shouldShowStartButton = (exercises.length > 0 && !isLoading);

  // Debug accent color
  useEffect(() => {
    console.log('Plan Details - Accent Color:', params.accent);
  }, [params.accent]);

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
                <Text style={styles.statValue}>{exercises.length} Exercises</Text>
              </View>
              
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="clock-outline" size={18} color={COLORS.primary} />
                <Text style={styles.statValue}>{totalDuration} Min</Text>
              </View>
              
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="fire" size={18} color={COLORS.primary} />
                <Text style={styles.statValue}>{totalCalories} Cal</Text>
              </View>
            </View>
          </View>
          
          {/* Exercises List Title */}
          <View style={styles.sectionTitleContainer}>


          </View>
          
          {/* Exercises List */}
          <View style={styles.exercisesContainer}>
            {exercises.length > 0 ? (
              <>
                {exercises.map((exercise, index) => (
                  renderExerciseItem(exercise, index)
                ))}
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="dumbbell" size={64} color="rgba(255,255,255,0.5)" />
                <Text style={styles.emptyText}>No exercises in this plan</Text>
                <Text style={styles.emptySubtext}>Exercises will be available soon</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
      
      {/* Start Plan Button */}
      {shouldShowStartButton && (
        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            style={styles.startButton}
            buttonColor={COLORS.primary}
            textColor="#FFFFFF"
            labelStyle={{ fontWeight: 'bold', fontSize: 16 }}
            onPress={handleStartWorkout}
          >
            START THIS PLAN
          </Button>
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
  exercisesContainer: {
    marginHorizontal: SPACING.md,
    marginTop: 0,
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
  exerciseCenter: {
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
  restTimeText: {
    color: `${COLORS.text}80`, // 50% opacity
    fontSize: 12,
    marginTop: 2,
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
  buttonContainer: {
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
  dayButton: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
    height: 50,
    justifyContent: 'center',
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
}); 