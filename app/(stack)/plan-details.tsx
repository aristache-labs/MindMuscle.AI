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
import { SentryDataCollection, SentryLogger } from '../services/sentry';

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
  useImagePreloader(exerciseImageUrls, {
    priority: 'high',
    skipIfCached: true,
    debugLabel: 'PlanDetails',
  });

  useEffect(() => {
    const fetchPlanDetails = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Log plan details screen access
        SentryLogger.info('Plan details screen accessed', {
          user_id: user?.id,
          plan_id: planId,
          timestamp: new Date().toISOString(),
        });

        // Add breadcrumb for screen navigation
        SentryDataCollection.addBreadcrumb({
          message: 'User navigated to plan details screen',
          category: 'navigation',
          level: 'info',
          data: {
            screen: 'plan-details',
            plan_id: planId,
            user_authenticated: !!user,
          },
        });

        // Set user context for this session
        if (user) {
          SentryDataCollection.setUser({
            id: user.id,
            email: user.email,
          });
        }

        // Use the service function to fetch plan details
        const formattedPlan = await workoutPlanService.fetchPlanDetails(planId);
        setPlan(formattedPlan as Plan);

        // Log successful plan loading
        SentryLogger.info('Plan details loaded successfully', {
          user_id: user?.id,
          plan_id: planId,
          plan_title: formattedPlan.title,
          workout_days_count: formattedPlan.workoutDays?.length || 0,
          total_exercises:
            formattedPlan.workoutDays?.reduce((sum, day) => sum + day.total_exercises, 0) || 0,
          difficulty_level: formattedPlan.difficulty_level,
          category: formattedPlan.category_name,
        });

        // Set Sentry tags for plan analytics
        SentryDataCollection.setTag('current_plan_id', planId);
        SentryDataCollection.setTag('plan_difficulty', formattedPlan.difficulty_level || 'unknown');
        SentryDataCollection.setTag('plan_category', formattedPlan.category_name || 'unknown');

        // Add context for plan analytics
        SentryDataCollection.setContext('current_plan', {
          plan_id: planId,
          plan_title: formattedPlan.title,
          workout_days: formattedPlan.workoutDays?.length || 0,
          total_exercises:
            formattedPlan.workoutDays?.reduce((sum, day) => sum + day.total_exercises, 0) || 0,
          difficulty: formattedPlan.difficulty_level,
          category: formattedPlan.category_name,
          frequency: formattedPlan.workout_frequency,
        });
      } catch (fetchError) {
        const errorMessage = 'Failed to load plan details.';
        setError(errorMessage);

        // Log plan loading error
        SentryDataCollection.captureException(fetchError as Error, {
          context: 'plan_details_fetch',
          user_id: user?.id,
          plan_id: planId,
          error_type: 'plan_fetch_failed',
        });

        SentryLogger.error('Failed to fetch plan details', {
          error: fetchError,
          plan_id: planId,
          user_id: user?.id,
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (planId) {
      fetchPlanDetails();
    } else {
      // Log missing plan ID
      SentryLogger.error('Plan details screen accessed without plan ID', {
        user_id: user?.id,
        params,
      });

      SentryDataCollection.captureException(new Error('Missing plan ID'), {
        context: 'plan_details_missing_id',
        user_id: user?.id,
        params,
      });
    }
  }, [planId, user, params]);

  const handleBackPress = () => {
    try {
      SentryDataCollection.addBreadcrumb({
        message: 'User navigated back from plan details',
        category: 'navigation',
        level: 'info',
        data: {
          from_screen: 'plan-details',
          plan_id: planId,
          plan_title: plan?.title,
        },
      });

      router.back();
    } catch (navigationError) {
      SentryDataCollection.captureException(navigationError as Error, {
        context: 'plan_details_navigation_back',
        user_id: user?.id,
        plan_id: planId,
      });
    }
  };

  const handleStartPlan = async () => {
    if (!user) {
      // Log unauthenticated access attempt
      SentryLogger.warn('Unauthenticated user attempted to start plan', {
        plan_id: planId,
        plan_title: plan?.title,
      });

      SentryDataCollection.addBreadcrumb({
        message: 'Unauthenticated user attempted to start plan',
        category: 'auth.error',
        level: 'warning',
        data: {
          plan_id: planId,
          plan_title: plan?.title,
        },
      });
      return;
    }

    setIsStartingPlan(true);

    try {
      // Log plan start attempt
      SentryLogger.info('User initiated plan start', {
        user_id: user.id,
        plan_id: planId,
        plan_title: plan?.title,
        plan_difficulty: plan?.difficulty_level,
        plan_category: plan?.category_name,
        workout_days_count: plan?.workoutDays?.length || 0,
        timestamp: new Date().toISOString(),
      });

      // Add breadcrumb for user action
      SentryDataCollection.addBreadcrumb({
        message: 'User started workout plan',
        category: 'user-action',
        level: 'info',
        data: {
          plan_id: planId,
          plan_title: plan?.title,
          user_id: user.id,
          action_type: 'start_plan',
        },
      });

      // Use the service function to start the plan
      const success = await workoutPlanService.startPlan(user.id, planId);

      if (success) {
        // Log successful plan start
        SentryLogger.info('Plan started successfully', {
          user_id: user.id,
          plan_id: planId,
          plan_title: plan?.title,
          operation_type: 'start_plan_success',
        });

        // Set tag for active plan tracking
        SentryDataCollection.setTag('user_active_plan', planId);

        // Navigate back to the home screen with the My Plan tab selected
        router.push({
          pathname: '/(tabs)',
          params: { selectedOption: 'My Plan' },
        });
      } else {
        // Log plan start failure
        SentryLogger.error('Plan start failed - service returned false', {
          user_id: user.id,
          plan_id: planId,
          plan_title: plan?.title,
          operation_type: 'start_plan_failed',
        });

        SentryDataCollection.captureException(new Error('Plan start service returned false'), {
          context: 'plan_start_service_failure',
          user_id: user.id,
          plan_id: planId,
        });
      }
    } catch (startError) {
      // Log plan start error
      SentryDataCollection.captureException(startError as Error, {
        context: 'plan_start_operation',
        user_id: user.id,
        plan_id: planId,
        plan_title: plan?.title,
      });

      SentryLogger.error('Error starting plan', {
        error: startError,
        user_id: user.id,
        plan_id: planId,
        plan_title: plan?.title,
      });
    } finally {
      setIsStartingPlan(false);
    }
  };

  // Handle day change
  const handleDayChange = (index: number) => {
    try {
      const selectedDay = plan?.workoutDays[index];

      // Log day navigation
      SentryLogger.info('User changed workout day', {
        user_id: user?.id,
        plan_id: planId,
        from_day_index: currentDayIndex,
        to_day_index: index,
        from_day_number: plan?.workoutDays[currentDayIndex]?.day,
        to_day_number: selectedDay?.day,
        day_exercises_count: selectedDay?.total_exercises,
        day_duration: selectedDay?.estimated_duration,
      });

      // Add breadcrumb for day navigation
      SentryDataCollection.addBreadcrumb({
        message: `User navigated to workout day ${selectedDay?.day}`,
        category: 'user-interaction',
        level: 'info',
        data: {
          plan_id: planId,
          day_index: index,
          day_number: selectedDay?.day,
          exercises_count: selectedDay?.total_exercises,
          estimated_duration: selectedDay?.estimated_duration,
          user_id: user?.id,
        },
      });

      setCurrentDayIndex(index);
      flatListRef.current?.scrollToIndex({ animated: true, index });
    } catch (dayChangeError) {
      SentryDataCollection.captureException(dayChangeError as Error, {
        context: 'day_change_interaction',
        user_id: user?.id,
        plan_id: planId,
        target_day_index: index,
      });
    }
  };

  // Handle scroll end to update current day index
  const handleMomentumScrollEnd = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    try {
      const contentOffsetX = event.nativeEvent.contentOffset.x;
      const newIndex = Math.round(contentOffsetX / screenWidth);

      if (newIndex !== currentDayIndex && plan?.workoutDays[newIndex]) {
        const newDay = plan.workoutDays[newIndex];

        // Log scroll-based day change
        SentryDataCollection.addBreadcrumb({
          message: `User scrolled to workout day ${newDay.day}`,
          category: 'user-interaction',
          level: 'info',
          data: {
            plan_id: planId,
            scroll_from_index: currentDayIndex,
            scroll_to_index: newIndex,
            day_number: newDay.day,
            interaction_type: 'scroll',
            user_id: user?.id,
          },
        });

        setCurrentDayIndex(newIndex);
      }
    } catch (scrollError) {
      SentryDataCollection.captureException(scrollError as Error, {
        context: 'scroll_momentum_end',
        user_id: user?.id,
        plan_id: planId,
      });
    }
  };

  // Handle exercise press to show details modal
  const handleExercisePress = async (exercise: Exercise) => {
    try {
      // Log exercise interaction immediately
      SentryLogger.info('User tapped exercise for details', {
        user_id: user?.id,
        plan_id: planId,
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        workout_day: exercise.workout_day,
        sets: exercise.sets,
        reps_range: exercise.reps_range,
        has_image: !!exercise.image_url,
        primary_muscles: exercise.primary_muscles,
        timestamp: new Date().toISOString(),
      });

      // Add breadcrumb for exercise interaction
      SentryDataCollection.addBreadcrumb({
        message: `User opened exercise details: ${exercise.name}`,
        category: 'user-interaction',
        level: 'info',
        data: {
          plan_id: planId,
          exercise_id: exercise.id,
          exercise_name: exercise.name,
          workout_day: exercise.workout_day,
          user_id: user?.id,
          interaction_type: 'exercise_details',
        },
      });

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
        const errorMessage = 'Missing exercise ID';
        SentryLogger.error('Exercise details fetch failed - missing ID', {
          user_id: user?.id,
          plan_id: planId,
          exercise_name: exercise.name,
          exercise_object: exercise,
        });

        SentryDataCollection.captureException(new Error(errorMessage), {
          context: 'exercise_details_missing_id',
          user_id: user?.id,
          plan_id: planId,
          exercise: exercise,
        });
        throw new Error(errorMessage);
      }

      // Use the service function to fetch exercise details
      try {
        const exerciseDetails = await workoutPlanService.fetchExerciseDetails(actualExerciseId);

        if (exerciseDetails) {
          // Update the modal with complete data
          setSelectedExercise(exerciseDetails);

          // Log successful exercise details fetch
          SentryLogger.info('Exercise details loaded successfully', {
            user_id: user?.id,
            plan_id: planId,
            exercise_id: actualExerciseId,
            exercise_name: exerciseDetails.name,
            primary_muscles: exerciseDetails.primary_muscles,
            secondary_muscles: exerciseDetails.secondary_muscles,
          });
        } else {
          SentryLogger.warn('Exercise details fetch returned null', {
            user_id: user?.id,
            plan_id: planId,
            exercise_id: actualExerciseId,
            exercise_name: exercise.name,
          });
        }
      } catch (fetchDetailsError) {
        // Log exercise details fetch error
        SentryDataCollection.captureException(fetchDetailsError as Error, {
          context: 'exercise_details_fetch',
          user_id: user?.id,
          plan_id: planId,
          exercise_id: actualExerciseId,
          exercise_name: exercise.name,
        });

        SentryLogger.error('Failed to fetch exercise details', {
          error: fetchDetailsError,
          user_id: user?.id,
          plan_id: planId,
          exercise_id: actualExerciseId,
          exercise_name: exercise.name,
        });
        // Even if fetch fails, still show what we have
      }
    } catch (exercisePressError) {
      SentryDataCollection.captureException(exercisePressError as Error, {
        context: 'exercise_press_handler',
        user_id: user?.id,
        plan_id: planId,
        exercise: exercise,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Close the modal
  const handleCloseModal = () => {
    try {
      // Log modal close
      SentryDataCollection.addBreadcrumb({
        message: 'User closed exercise details modal',
        category: 'user-interaction',
        level: 'info',
        data: {
          plan_id: planId,
          exercise_id: selectedExercise?.id,
          exercise_name: selectedExercise?.name,
          user_id: user?.id,
          interaction_type: 'modal_close',
        },
      });

      setIsModalVisible(false);
    } catch (modalCloseError) {
      SentryDataCollection.captureException(modalCloseError as Error, {
        context: 'exercise_modal_close',
        user_id: user?.id,
        plan_id: planId,
      });
    }
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
