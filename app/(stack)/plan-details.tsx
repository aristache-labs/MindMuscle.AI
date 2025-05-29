import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  FlatList,
} from 'react-native';
import { Text, IconButton, Divider } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import OptimizedImage from '../components/OptimizedImage';
import useImagePreloader from '../hooks/useImagePreloader';
import ExerciseDetailsModal from '../components/ExerciseDetailsModal';
import workoutPlanService from '../services/workoutPlanService';
import { useAuth } from '../store/AuthContext';

// Placeholder image constant
// eslint-disable-next-line @typescript-eslint/no-require-imports
const placeholderImage = require('../../assets/exercises/placeholder.jpg');

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
  day: number; // Now 1-indexed (day 1 = 1, day 2 = 2, etc.)
  exercises: Exercise[];
  total_exercises: number;
  estimated_duration: number;
  total_calories: number;
}

interface Plan {
  id: string;
  title: string;
  difficulty_level?: string;
  estimated_duration?: number;
  workoutDays: WorkoutDay[];
  category_name?: string;
  subtitle?: string;
  workout_frequency?: number;
}

const { width: screenWidth } = Dimensions.get('window');

export default function PlanDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const planId = params.planId as string;
  const { user } = useAuth();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Using 0 for currentDayIndex since this is the array index (0-based), not the workout day value
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // State for exercise details modal
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<{
    id: string;
    name: string;
    image_url?: string;
    primary_muscles?: string[];
    secondary_muscles?: string[];
  } | null>(null);

  const [isStartingPlan, setIsStartingPlan] = useState(false);

  // Extract all exercise image URLs for preloading
  const exerciseImageUrls =
    (plan?.workoutDays
      .flatMap((day) => day.exercises)
      .map((exercise) => exercise.image_url)
      .filter((url) => !!url) as string[]) || [];

  // Preload exercise images
  const _imagePreloadStatus = useImagePreloader(exerciseImageUrls, {
    priority: 'high',
    skipIfCached: true,
    debugLabel: 'PlanDetails',
  });

  useEffect(() => {
    const fetchPlanDetails = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Use the service function to fetch plan details
        const formattedPlan = await workoutPlanService.fetchPlanDetails(planId);
        setPlan(formattedPlan as Plan);
      } catch {
        setError('Failed to load plan details.');
        // Error fetching plan details
      } finally {
        setIsLoading(false);
      }
    };

    if (planId) {
      fetchPlanDetails();
    }
  }, [planId]);

  const handleBackPress = () => {
    router.back();
  };

  const handleStartPlan = async () => {
    if (!user) {
      // User not authenticated
      return;
    }

    setIsStartingPlan(true);

    try {
      // Use the service function to start the plan
      const success = await workoutPlanService.startPlan(user.id, planId);

      if (success) {
        // Navigate back to the home screen with the My Plan tab selected
        router.push({
          pathname: '/(tabs)',
          params: { selectedOption: 'My Plan' },
        });
      }
    } catch {
      // Error starting plan
    } finally {
      setIsStartingPlan(false);
    }
  };

  // Handle day change
  const handleDayChange = (index: number) => {
    setCurrentDayIndex(index);
    flatListRef.current?.scrollToIndex({ animated: true, index });
  };

  // Handle scroll end to update current day index
  const handleMomentumScrollEnd = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / screenWidth);
    setCurrentDayIndex(newIndex);
  };

  // Handle exercise press to show details modal
  const handleExercisePress = async (exercise: Exercise) => {
    try {
      // Show the modal immediately with basic info
      setSelectedExercise({
        id: exercise.id,
        name: exercise.name,
        image_url: exercise.image_url,
        primary_muscles: Array.isArray(exercise.primary_muscles) ? exercise.primary_muscles : [],
        secondary_muscles: [],
      });
      setIsModalVisible(true);

      // Then fetch complete data in the background
      setIsLoading(true);

      // Get the actual exercise ID from the exercise object
      const actualExerciseId = exercise.exercise_id || exercise.id;

      if (!actualExerciseId) {
        // No valid exercise ID found for this exercise
        throw new Error('Missing exercise ID');
      }

      // Use the service function to fetch exercise details
      try {
        const exerciseDetails = await workoutPlanService.fetchExerciseDetails(actualExerciseId);

        if (exerciseDetails) {
          // Update the modal with complete data
          setSelectedExercise(exerciseDetails);
        }
      } catch {
        // Error fetching exercise details
        // Even if fetch fails, still show what we have
      }
    } catch {
      // Error in handleExercisePress
    } finally {
      setIsLoading(false);
    }
  };

  // Close the modal
  const handleCloseModal = () => {
    setIsModalVisible(false);
  };

  // Render workout day content
  const renderWorkoutDay = ({ item, index }: { item: WorkoutDay; index: number }) => {
    return (
      <View style={{ width: screenWidth }}>
        <ScrollView contentContainerStyle={styles.dayContentContainer}>
          <Text style={styles.dayTitle}>DAY {item.day}</Text>

          {item.exercises.map((exercise) => (
            <View key={exercise.id} style={styles.exerciseCard}>
              <View style={styles.exerciseLeftContent}>
                <OptimizedImage
                  source={exercise.image_url ? { uri: exercise.image_url } : placeholderImage}
                  style={styles.exerciseImage}
                  fallback={placeholderImage}
                  resizeMode="cover"
                  cachePolicy="immutable"
                  showLoader={false}
                  isImportant={index < 5} // Mark first few exercises as important
                />
                <TouchableOpacity
                  style={styles.exerciseDetails}
                  onPress={() => handleExercisePress(exercise)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseSets}>
                    {exercise.sets} sets x {exercise.reps_range} reps
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="light" />

      {/* Exercise Details Modal */}
      <ExerciseDetailsModal
        visible={isModalVisible}
        onClose={handleCloseModal}
        exerciseId={selectedExercise?.id || ''}
        exerciseName={selectedExercise?.name || ''}
        exerciseImage={selectedExercise?.image_url}
        primary_muscles={selectedExercise?.primary_muscles}
        secondary_muscles={selectedExercise?.secondary_muscles}
      />

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
          <Text style={styles.headerTitle}>{plan?.title || 'PLAN'}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>
      <Divider style={styles.divider} />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : plan ? (
        <View style={styles.contentWrapper}>
          {/* Plan Overview Card */}
          <View style={styles.planOverviewCard}>
            <Text style={styles.planOverviewTitle}>{plan.subtitle || plan.category_name}</Text>
            {plan.workoutDays.length > 0 && (
              <View style={styles.planStats}>
                <View style={styles.statItem}>
                  <IconButton
                    icon="flash"
                    size={18}
                    iconColor={COLORS.primary}
                    style={styles.statIcon}
                  />
                  <Text style={styles.statValue}>
                    {plan.workoutDays[currentDayIndex].total_exercises} Exercises
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <IconButton
                    icon="clock-outline"
                    size={18}
                    iconColor={COLORS.primary}
                    style={styles.statIcon}
                  />
                  <Text style={styles.statValue}>
                    {plan.workoutDays[currentDayIndex].estimated_duration} Min
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <IconButton
                    icon="fire"
                    size={18}
                    iconColor={COLORS.primary}
                    style={styles.statIcon}
                  />
                  <Text style={styles.statValue}>
                    {plan.workoutDays[currentDayIndex].total_calories} Cal
                  </Text>
                </View>
              </View>
            )}

            {plan.workoutDays.length > 1 && (
              <View style={styles.daySelector}>
                <View style={styles.dayPills}>
                  {plan.workoutDays.map((day, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.dayPill, currentDayIndex === index && styles.activeDayPill]}
                      onPress={() => handleDayChange(index)}
                    >
                      <Text
                        style={[
                          styles.dayPillText,
                          currentDayIndex === index && styles.activeDayPillText,
                        ]}
                      >
                        {day.day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Exercise Days Slider */}
          {plan.workoutDays.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={plan.workoutDays}
              keyExtractor={(item) => `day-${item.day}`}
              renderItem={renderWorkoutDay}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              initialScrollIndex={currentDayIndex}
              getItemLayout={(data, index) => ({
                length: screenWidth,
                offset: screenWidth * index,
                index,
              })}
              style={styles.daySlider}
            />
          ) : (
            <View style={styles.noExercisesContainer}>
              <Text style={styles.noExercisesText}>No exercises found for this plan.</Text>
            </View>
          )}

          {/* Fixed Start Plan Button */}
          <View style={styles.fixedButtonContainer}>
            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartPlan}
              disabled={isStartingPlan}
            >
              {isStartingPlan ? (
                <ActivityIndicator color={COLORS.text} size="small" />
              ) : (
                <Text style={styles.startButtonText}>START THIS PLAN</Text>
              )}
            </TouchableOpacity>
            <View style={styles.buttonBottomFill} />
          </View>
        </View>
      ) : (
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>Plan not found.</Text>
        </View>
      )}
    </GestureHandlerRootView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 16,
    textAlign: 'center',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  contentWrapper: {
    flex: 1,
    position: 'relative',
  },
  daySlider: {
    flex: 1,
  },
  dayContentContainer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 100,
  },
  noExercisesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  noExercisesText: {
    color: COLORS.text,
    fontSize: 16,
    textAlign: 'center',
  },
  fixedButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    paddingVertical: 10,
    paddingHorizontal: 16,
    paddingBottom: 50,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 5,
  },
  planOverviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    margin: SPACING.md,
    marginBottom: SPACING.md,
  },
  planOverviewTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  planStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.lg,
  },
  statIcon: {
    margin: 0,
    padding: 0,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 14,
  },
  daySelector: {
    marginTop: SPACING.md,
    alignItems: 'center',
  },
  dayPills: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.xs,
    flexWrap: 'wrap',
  },
  dayPill: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginHorizontal: 4,
    marginBottom: 4,
  },
  activeDayPill: {
    backgroundColor: COLORS.primary,
  },
  dayPillText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeDayPillText: {
    color: COLORS.text,
  },
  dayTitle: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
  },
  exerciseLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  exerciseImage: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.md,
    backgroundColor: COLORS.surfaceLight,
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
  startButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  startButtonText: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonBottomFill: {
    position: 'absolute',
    bottom: -50,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: COLORS.background,
  },
});
