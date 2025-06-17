import React, { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import { IconButton, Portal, Provider, Text } from 'react-native-paper';
import OptimizedImage from '../components/OptimizedImage';
import { COLORS, SPACING } from '../constants/theme';
import supabase from '../services/supabase';
import { SentryDataCollection, SentryInsights } from '../services/sentry';
import { getMostRecentCustomizedWorkoutStructure } from '../services/workoutDataService';
import { useAuth } from '../store/AuthContext';
import { validationService } from '../services/validationService';
import { SavedExerciseStructureSchema } from '../validation/schemas';
import ExerciseDetailsModal from './ExerciseDetailsModal';
import { z } from 'zod';

// Define interfaces for database query results
interface ExerciseData {
  id?: string;
  sets?: number;
  reps_range?: string;
  exercise_id?: string;
  workout_day?: number;
  exercise_name?: string;
  rest_time?: number;
  order?: number;
  exercises?: {
    id?: string;
    name?: string;
    image_url?: string;
    primary_muscles?: string[];
    secondary_muscles?: string[];
    requires_weight?: boolean;
  }[];
}

interface Exercise {
  id: string;
  name: string;
  sets?: number;
  reps?: string | number;
  duration?: number;
  image?: string;
  equipment?: string;
  kg?: number;
  primary_muscles?: string[];
  secondary_muscles?: string[];
}

interface WeekData {
  number: number;
  name: string;
  color: string;
  description: string;
  days: number;
  isActive?: boolean;
  isCompleted?: boolean; // New field for completion status
}

// New interface for completion tracking
interface CompletionData {
  completedWorkouts: number;
  currentWeek: number;
  completedWorkoutsByWeekAndDay: Record<string, boolean>; // "week_day" -> completed
  completedWeeks: Set<number>; // Set of completed week numbers
}

interface Props {
  visible: boolean;
  onClose: () => void;
  modalAnim?: Animated.Value;
  planTitle: string;
  planSubtitle?: string;
  weeks: WeekData[];
  currentWeek: number;
  onWeekPress?: (weekNumber: number) => void;
  onDayPress?: (weekNumber: number, dayNumber: number) => void;
  activePlanId?: string; // ID of the active plan
  planWorkoutFrequency?: number; // Number of workout days per week in the plan
}

// Helper function to extract muscle data from exercise data
function extractMuscleData(exerciseData: ExerciseData) {
  const exerciseInfo = exerciseData.exercises?.[0];
  return {
    primary_muscles: exerciseInfo?.primary_muscles || [],
    secondary_muscles: exerciseInfo?.secondary_muscles || [],
  };
}

// Helper function to fetch completion data
async function fetchCompletionDataAsync(
  activePlanId: string,
  userId: string,
  planWorkoutFrequency: number,
): Promise<CompletionData | null> {
  const startTime = performance.now();

  SentryDataCollection.addBreadcrumb({
    message: 'Fetching completion data started',
    category: 'data.fetch',
    data: { activePlanId, userId, timestamp: new Date().toISOString() },
  });

  try {
    // Fetch active plan data
    const { data: activePlanData, error: activePlanError } = await supabase
      .from('user_active_plans')
      .select('completed_workouts, current_week')
      .eq('user_id', userId)
      .eq('plan_id', activePlanId)
      .eq('is_active', true)
      .single();

    if (activePlanError) {
      SentryDataCollection.captureException(activePlanError, {
        component: 'PlanOverviewModal',
        action: 'fetch_active_plan_data',
        planId: activePlanId,
        userId,
      });
      return null;
    }

    // Fetch completed workouts
    const { data: completedWorkouts, error: completedError } = await supabase
      .from('user_workout_history')
      .select('workout_day, cycle_week, completed_at')
      .eq('user_id', userId)
      .eq('plan_id', activePlanId);

    if (completedError) {
      SentryDataCollection.captureException(completedError, {
        component: 'PlanOverviewModal',
        action: 'fetch_completed_workouts',
        planId: activePlanId,
        userId,
      });
      return null;
    }

    // Process completion data
    const completedWorkoutsByWeekAndDay: Record<string, boolean> = {};
    const completedWeeks = new Set<number>();

    if (completedWorkouts?.length > 0) {
      completedWorkouts.forEach((workout) => {
        const weekDayKey = `${workout.cycle_week}_${workout.workout_day}`;
        completedWorkoutsByWeekAndDay[weekDayKey] = true;

        const weekWorkouts = completedWorkouts.filter((w) => w.cycle_week === workout.cycle_week);
        if (weekWorkouts.length >= planWorkoutFrequency) {
          completedWeeks.add(workout.cycle_week);
        }
      });
    }

    const result = {
      completedWorkouts: activePlanData?.completed_workouts || 0,
      currentWeek: activePlanData?.current_week || 1,
      completedWorkoutsByWeekAndDay,
      completedWeeks,
    };

    const fetchDuration = performance.now() - startTime;
    SentryDataCollection.addBreadcrumb({
      message: 'Completion data fetched successfully',
      category: 'data.fetch',
      data: {
        activePlanId,
        fetchDurationMs: fetchDuration.toFixed(2),
        completedWorkoutsCount: result.completedWorkouts,
        completedWeeksCount: result.completedWeeks.size,
        currentWeek: result.currentWeek,
      },
    });

    return result;
  } catch (error) {
    const fetchDuration = performance.now() - startTime;
    SentryDataCollection.captureException(error as Error, {
      component: 'PlanOverviewModal',
      action: 'fetch_completion_data',
      planId: activePlanId,
      userId,
      fetchDurationMs: fetchDuration.toFixed(2),
    });
    return null;
  }
}

// Helper function to fetch exercises for a specific day (with customization support)
async function fetchDayExercises(
  activePlanId: string,
  dayNumber: number,
  userId?: string,
  weekNumber?: number,
  currentWeek?: number,
  isWorkoutDayCompleted?: boolean,
): Promise<Exercise[] | null> {
  try {
    SentryDataCollection.addBreadcrumb({
      message: 'Fetching day exercises with customization support',
      category: 'data.fetch',
      data: {
        activePlanId,
        dayNumber,
        weekNumber,
        currentWeek,
        isWorkoutDayCompleted,
        userId: userId ? 'provided' : 'not_provided',
        timestamp: new Date().toISOString(),
      },
    });

    if (userId) {
      // For completed past weeks, get the actual exercises from workout history
      if (weekNumber && currentWeek && weekNumber < currentWeek && isWorkoutDayCompleted) {
        try {
          const { data: workoutHistory, error } = await supabase
            .from('user_workout_history')
            .select('exercise_structure')
            .eq('user_id', userId)
            .eq('plan_id', activePlanId)
            .eq('workout_day', dayNumber)
            .eq('cycle_week', weekNumber)
            .eq('is_redo_workout', false)
            .order('completed_at', { ascending: false })
            .limit(1)
            .single();

          if (!error && workoutHistory?.exercise_structure) {
            const exerciseStructureArray = validationService.safeParseJson(
              workoutHistory.exercise_structure,
              z.array(SavedExerciseStructureSchema),
              'completed_workout_exercise_structure',
              [],
            );

            if (exerciseStructureArray && exerciseStructureArray.length > 0) {
              SentryDataCollection.addBreadcrumb({
                message: 'Found actual completed exercises from workout history',
                category: 'data.process',
                data: {
                  activePlanId,
                  dayNumber,
                  weekNumber,
                  exercisesCount: exerciseStructureArray.length,
                  isCompleted: true,
                },
              });

              // Convert to Exercise format for display
              return exerciseStructureArray.map(
                (item): Exercise => ({
                  id: item.exercise_id || item.id || '',
                  name: item.name || 'Unknown Exercise',
                  sets: item.sets || 3,
                  reps: item.reps_range || '8-12',
                  image: item.image_url,
                  equipment: 'Standard',
                  kg: 0,
                  primary_muscles: item.primary_muscles || [],
                  secondary_muscles: [],
                }),
              );
            }
          }
        } catch (historyError) {
          SentryDataCollection.captureException(historyError as Error, {
            component: 'PlanOverviewModal',
            action: 'fetch_completed_workout_exercises',
            planId: activePlanId,
            dayNumber,
            weekNumber,
            userId,
          });
          // Continue to other methods
        }
      }

      // For current week and future weeks, apply customizations
      if (weekNumber && currentWeek && weekNumber >= currentWeek) {
        try {
          const customizedExercises = await getMostRecentCustomizedWorkoutStructure(
            userId,
            activePlanId,
            dayNumber,
          );

          if (customizedExercises && customizedExercises.length > 0) {
            SentryDataCollection.addBreadcrumb({
              message: 'Found customized exercises for current/future week in plan overview',
              category: 'data.process',
              data: {
                activePlanId,
                dayNumber,
                weekNumber,
                currentWeek,
                exercisesCount: customizedExercises.length,
                isCustomized: true,
              },
            });

            // Convert ExerciseData to Exercise format for display
            return customizedExercises.map(
              (item): Exercise => ({
                id: item.exercise_id || item.id || '',
                name: item.name || 'Unknown Exercise',
                sets: item.sets || 3,
                reps: item.reps_range || '8-12',
                image: item.image_url,
                equipment: 'Standard',
                kg: 0,
                primary_muscles: item.primary_muscles || [],
                secondary_muscles: [], // Add if available in the future
              }),
            );
          }
        } catch (customizationError) {
          SentryDataCollection.captureException(customizationError as Error, {
            component: 'PlanOverviewModal',
            action: 'fetch_customized_exercises',
            planId: activePlanId,
            dayNumber,
            weekNumber,
            userId,
          });
          // Continue to fallback to original exercises
        }
      }
    }

    // Fallback to original plan exercises
    const { data, error } = await supabase
      .from('workout_plan_exercises')
      .select(
        `
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
          primary_muscles,
          secondary_muscles,
          requires_weight
        )
      `,
      )
      .eq('plan_id', activePlanId)
      .eq('workout_day', dayNumber)
      .order('order', { ascending: true });

    if (error) {
      SentryDataCollection.captureException(error, {
        component: 'PlanOverviewModal',
        action: 'fetch_original_exercises',
        planId: activePlanId,
        dayNumber,
      });
      return null;
    }

    if (!data?.length) {
      return [];
    }

    SentryDataCollection.addBreadcrumb({
      message: 'Loaded original plan exercises for plan overview',
      category: 'data.process',
      data: {
        activePlanId,
        dayNumber,
        weekNumber,
        currentWeek,
        exercisesCount: data.length,
        isCustomized: false,
        reason:
          weekNumber && currentWeek && weekNumber < currentWeek
            ? isWorkoutDayCompleted
              ? 'past_week_no_history_found'
              : 'past_week_not_completed'
            : 'no_customizations_found',
      },
    });

    return data.map((item: ExerciseData): Exercise => {
      const muscleData = extractMuscleData(item);
      return {
        id: item.exercise_id || item.id || '',
        name: item.exercise_name || item.exercises?.[0]?.name || 'Unknown Exercise',
        sets: item.sets || 3,
        reps: item.reps_range || '8-12',
        image: item.exercises?.[0]?.image_url,
        equipment: 'Standard',
        kg: 0,
        primary_muscles: muscleData.primary_muscles,
        secondary_muscles: muscleData.secondary_muscles,
      };
    });
  } catch (error) {
    SentryDataCollection.captureException(error as Error, {
      component: 'PlanOverviewModal',
      action: 'fetch_day_exercises',
      planId: activePlanId,
      dayNumber,
      userId,
    });
    return null;
  }
}

export default function PlanOverviewModal({
  visible,
  onClose,
  planTitle,
  planSubtitle,
  weeks,
  currentWeek,
  onDayPress,
  activePlanId,
  planWorkoutFrequency = 3, // Default to 3 days per week if not provided
}: Props) {
  // Track component mount and modal lifecycle
  useEffect(() => {
    SentryDataCollection.addBreadcrumb({
      message: 'PlanOverviewModal component mounted',
      category: 'ui.lifecycle',
      data: {
        planTitle,
        activePlanId,
        planWorkoutFrequency,
        weeksCount: weeks?.length || 0,
        currentWeek,
      },
    });

    return () => {
      SentryDataCollection.addBreadcrumb({
        message: 'PlanOverviewModal component unmounted',
        category: 'ui.lifecycle',
        data: {
          planTitle,
        },
      });
    };
  }, []);

  // Track modal visibility changes
  useEffect(() => {
    if (visible) {
      SentryDataCollection.addBreadcrumb({
        message: 'PlanOverviewModal opened',
        category: 'ui.modal',
        data: {
          planTitle,
          activePlanId,
          currentWeek,
          timestamp: new Date().toISOString(),
        },
      });

      // Start performance monitoring for modal load
      const transaction = SentryInsights.startTransaction(
        'PlanOverviewModal Load',
        'ui.modal.load',
      );

      transaction.setData('plan_id', activePlanId || 'unknown');
      transaction.setData('plan_title', planTitle);
      transaction.setData('weeks_count', weeks?.length || 0);

      // Finish transaction after a short delay to measure initial render
      setTimeout(() => {
        SentryInsights.finishTransaction(transaction, 'ok');
      }, 100);
    } else {
      SentryDataCollection.addBreadcrumb({
        message: 'PlanOverviewModal closed',
        category: 'ui.modal',
        data: {
          planTitle,
        },
      });
    }
  }, [visible]);

  // Generate our own animation value
  const [modalAnim] = useState(() => new Animated.Value(0));
  const [selectedDay, setSelectedDay] = useState<{ weekNumber: number; dayNumber: number } | null>(
    null,
  );
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(false);
  const { user } = useAuth();

  // New state for the exercise details modal
  const [exerciseDetailsVisible, setExerciseDetailsVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  // Create a local state for weeks to avoid directly mutating props
  const [localWeeks, setLocalWeeks] = useState<WeekData[]>([]);

  // New state for completion tracking
  const [completionData, setCompletionData] = useState<CompletionData>({
    completedWorkouts: 0,
    currentWeek: 1,
    completedWorkoutsByWeekAndDay: {},
    completedWeeks: new Set(),
  });
  const [isLoadingCompletion, setIsLoadingCompletion] = useState(false);

  // Function to fetch completion data
  const fetchCompletionData = async () => {
    if (!activePlanId || !user?.id) return;

    setIsLoadingCompletion(true);
    try {
      const result = await fetchCompletionDataAsync(activePlanId, user.id, planWorkoutFrequency);
      if (result) {
        setCompletionData(result);
      }
    } finally {
      setIsLoadingCompletion(false);
    }
  };

  // Initialize local weeks when weeks prop changes or when modal becomes visible
  useEffect(() => {
    if (visible && weeks && weeks.length > 0) {
      try {
        // Create a deep copy of weeks to avoid mutating props
        const updatedWeeks = weeks.map((week) => ({
          ...week,
          // Ensure days is at least planWorkoutFrequency
          days: Math.max(week.days || 0, planWorkoutFrequency),
          // Mark week as completed if it's in the completed weeks set
          isCompleted: completionData.completedWeeks.has(week.number),
        }));

        setLocalWeeks(updatedWeeks);

        SentryDataCollection.addBreadcrumb({
          message: 'Local weeks initialized',
          category: 'data.process',
          data: {
            weeksCount: updatedWeeks.length,
            planWorkoutFrequency,
            completedWeeksCount: completionData.completedWeeks.size,
          },
        });
      } catch (error) {
        SentryDataCollection.captureException(error as Error, {
          component: 'PlanOverviewModal',
          action: 'initialize_local_weeks',
          weeksLength: weeks?.length,
          planWorkoutFrequency,
        });
      }
    }
  }, [weeks, visible, planWorkoutFrequency, completionData.completedWeeks]);

  // Fetch completion data when modal becomes visible
  useEffect(() => {
    if (visible && activePlanId && user?.id) {
      fetchCompletionData();
    }
  }, [visible, activePlanId, user?.id]);

  // Run animation when visibility changes
  useEffect(() => {
    if (visible) {
      Animated.spring(modalAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Reset selected day when modal closes
      setSelectedDay(null);
    }
  }, [visible, modalAnim]);

  // Calculate translateY based on animation value
  const translateY = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Dimensions.get('window').height, 0],
  });

  // Function to check if a specific workout day is completed
  const isWorkoutDayCompleted = (weekNumber: number, dayNumber: number): boolean => {
    // Create the same unique key used when storing completion data
    const weekDayKey = `${weekNumber}_${dayNumber}`;
    return completionData.completedWorkoutsByWeekAndDay[weekDayKey] || false;
  };

  // Function to handle exercise press - updated to show modal instead of navigating
  const handleExercisePress = (exercise: Exercise) => {
    try {
      SentryDataCollection.addBreadcrumb({
        message: 'Exercise pressed in plan overview',
        category: 'ui.interaction',
        data: {
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          planTitle,
          timestamp: new Date().toISOString(),
        },
      });

      // Set the selected exercise and show the modal
      setSelectedExercise(exercise);
      setExerciseDetailsVisible(true);
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'PlanOverviewModal',
        action: 'handle_exercise_press',
        exerciseId: exercise.id,
        exerciseName: exercise.name,
      });
    }
  };

  // Function to handle day press and fetch exercises
  const handleDayPress = async (weekNumber: number, dayNumber: number) => {
    try {
      SentryDataCollection.addBreadcrumb({
        message: 'Day pressed in plan overview',
        category: 'ui.interaction',
        data: { weekNumber, dayNumber, planTitle, activePlanId, hasUserId: !!user?.id },
      });

      setSelectedDay({ weekNumber, dayNumber });

      if (onDayPress) {
        onDayPress(weekNumber, dayNumber);
      }

      // Fetch exercises for the selected day (with customization support)
      if (activePlanId) {
        setIsLoadingExercises(true);
        try {
          const isDayCompleted = isWorkoutDayCompleted(weekNumber, dayNumber);
          const exercises = await fetchDayExercises(
            activePlanId,
            dayNumber,
            user?.id,
            weekNumber,
            currentWeek,
            isDayCompleted,
          );
          setExercises(exercises || []);
        } finally {
          setIsLoadingExercises(false);
        }
      }
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'PlanOverviewModal',
        action: 'handle_day_press',
        weekNumber,
        dayNumber,
        currentWeek,
        userId: user?.id,
      });
    }
  };

  // Custom close handler to reset state before closing
  const handleClose = () => {
    try {
      SentryDataCollection.addBreadcrumb({
        message: 'PlanOverviewModal close button pressed',
        category: 'ui.interaction',
        data: {
          planTitle,
          selectedDay: selectedDay
            ? `Week ${selectedDay.weekNumber}, Day ${selectedDay.dayNumber}`
            : null,
          timestamp: new Date().toISOString(),
        },
      });

      setSelectedDay(null);
      onClose();
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'PlanOverviewModal',
        action: 'handle_close',
        planTitle,
      });
      // Still close the modal even if tracking fails
      setSelectedDay(null);
      onClose();
    }
  };

  // Early return after all hooks have been called
  if (!visible) return null;

  return (
    <Provider>
      <Portal>
        <Modal
          visible={visible && !exerciseDetailsVisible}
          transparent={true}
          animationType="none"
          onRequestClose={handleClose}
          statusBarTranslucent={true}
        >
          <View style={styles.overlay}>
            <Animated.View style={[styles.modalContainer, { transform: [{ translateY }] }]}>
              <View style={styles.container}>
                <View style={styles.topGlowLeft} />
                <View style={styles.topGlowRight} />
                <View style={styles.header}>
                  <Text style={styles.title}>{'PLAN OVERVIEW'}</Text>
                  <IconButton
                    icon="close"
                    iconColor="#fff"
                    size={24}
                    style={styles.closeButton}
                    onPress={handleClose}
                  />
                </View>

                {planTitle ? <Text style={styles.planTitle}>{planTitle}</Text> : null}

                {planSubtitle ? <Text style={styles.planSubtitle}>{planSubtitle}</Text> : null}

                {/* Progress Summary */}
                {!isLoadingCompletion && (
                  <View style={styles.progressSummary}>
                    <Text style={styles.progressText}>
                      {`${completionData.completedWorkouts} of ${planWorkoutFrequency * 5} workouts completed`}
                    </Text>
                    <Text style={styles.progressSubtext}>
                      {`Week ${completionData.currentWeek} of 5 • ${completionData.completedWeeks.size} weeks completed`}
                    </Text>
                  </View>
                )}

                <GestureHandlerRootView style={styles.gestureRoot}>
                  <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollViewContent}
                    bounces={true}
                    showsVerticalScrollIndicator={false}
                  >
                    {selectedDay ? (
                      // Show exercises for selected day
                      <View style={styles.exercisesContainer}>
                        <View style={styles.exercisesHeader}>
                          <View style={styles.exercisesHeaderLeft}>
                            <Text style={styles.exercisesTitle}>
                              {`Week ${selectedDay.weekNumber} - Day ${selectedDay.dayNumber}`}
                            </Text>
                            {isWorkoutDayCompleted(
                              selectedDay.weekNumber,
                              selectedDay.dayNumber,
                            ) && (
                              <View style={styles.completedBadge}>
                                <Text style={styles.completedBadgeText}>✓ COMPLETED</Text>
                              </View>
                            )}
                          </View>
                          <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => setSelectedDay(null)}
                          >
                            <Text style={styles.backButtonText}>{'Back to Overview'}</Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.exercisesList}>
                          {isLoadingExercises ? (
                            <View style={styles.loadingContainer}>
                              <Text style={styles.loadingText}>{'Loading exercises...'}</Text>
                            </View>
                          ) : exercises.length > 0 ? (
                            exercises.map((exercise, index) => {
                              const isLastExercise = index === exercises.length - 1;
                              return (
                                <View key={`exercise-${exercise.id}-${index}`}>
                                  <TouchableOpacity
                                    style={styles.exerciseItem}
                                    onPress={() => handleExercisePress(exercise)}
                                    activeOpacity={0.7}
                                  >
                                    <View style={styles.exerciseRow}>
                                      <View style={styles.exerciseImageContainer}>
                                        <OptimizedImage
                                          source={
                                            exercise.image
                                              ? { uri: exercise.image }
                                              : require('../../assets/exercises/placeholder.jpg')
                                          }
                                          style={styles.exerciseImage}
                                          fallback={require('../../assets/exercises/placeholder.jpg')}
                                        />
                                      </View>
                                      <View style={styles.exerciseContent}>
                                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                                        <View style={styles.exerciseDetails}>
                                          {exercise.sets ? (
                                            <Text style={styles.exerciseDetail}>
                                              {`${exercise.sets} sets`}
                                            </Text>
                                          ) : null}
                                          {exercise.reps ? (
                                            <Text style={styles.exerciseDetail}>
                                              {`${exercise.reps} reps`}
                                            </Text>
                                          ) : null}
                                          {exercise.kg && exercise.kg > 0 ? (
                                            <Text style={styles.exerciseDetail}>
                                              {`${exercise.kg} kg`}
                                            </Text>
                                          ) : null}
                                        </View>
                                      </View>
                                    </View>
                                  </TouchableOpacity>

                                  {!isLastExercise && <View style={styles.exerciseDivider} />}
                                </View>
                              );
                            })
                          ) : (
                            <Text style={styles.noExercisesText}>
                              {'No exercises found for this day.'}
                            </Text>
                          )}
                        </View>
                      </View>
                    ) : (
                      // Show timeline view
                      <View style={styles.timeline}>
                        {localWeeks.length > 0 ? <View style={styles.timelineLine} /> : null}

                        {localWeeks.map((week) => {
                          const isWeekCompleted = week.isCompleted || false;
                          const isCurrentWeek = week.number === currentWeek;

                          return (
                            <View key={`week-${week.number}`} style={styles.weekContainer}>
                              {/* Timeline dot */}
                              <View style={styles.timelineLeft}>
                                <View
                                  style={[
                                    styles.timelineDot,
                                    { backgroundColor: week.color },
                                    isCurrentWeek && styles.activeTimelineDot,
                                    isWeekCompleted && styles.completedTimelineDot,
                                  ]}
                                >
                                  {isWeekCompleted && (
                                    <Text style={styles.timelineDotCheck}>✓</Text>
                                  )}
                                </View>
                              </View>

                              {/* Week content */}
                              <View
                                style={[
                                  styles.weekContent,
                                  isCurrentWeek && styles.activeWeekContent,
                                  isWeekCompleted && styles.completedWeekContent,
                                ]}
                              >
                                <View style={styles.weekHeader}>
                                  <View
                                    style={[styles.weekIndicator, { backgroundColor: week.color }]}
                                  />
                                  <Text style={styles.weekTitle}>
                                    {`Week ${week.number} - ${week.name}`}
                                  </Text>
                                  {isWeekCompleted && (
                                    <View style={styles.weekCompletedBadge}>
                                      <Text style={styles.weekCompletedBadgeText}>COMPLETED</Text>
                                    </View>
                                  )}
                                </View>

                                {week.description ? (
                                  <View style={styles.weekDescription}>
                                    <Text style={styles.descriptionText}>{week.description}</Text>
                                  </View>
                                ) : null}

                                <ScrollView
                                  horizontal
                                  showsHorizontalScrollIndicator={false}
                                  contentContainerStyle={styles.daysScrollContent}
                                >
                                  {Array.from({ length: week.days }).map((_, i) => {
                                    const dayNumber = i + 1;
                                    const isDayCompleted = isWorkoutDayCompleted(
                                      week.number,
                                      dayNumber,
                                    );

                                    return (
                                      <TouchableOpacity
                                        key={`day-${dayNumber}`}
                                        style={[
                                          styles.dayButton,
                                          isDayCompleted && styles.completedDayButton,
                                        ]}
                                        onPress={() => handleDayPress(week.number, dayNumber)}
                                      >
                                        <Text
                                          style={[
                                            styles.dayButtonText,
                                            isDayCompleted && styles.completedDayButtonText,
                                          ]}
                                        >
                                          {`Day ${dayNumber}`}
                                        </Text>
                                        {isDayCompleted && (
                                          <Text style={styles.dayButtonCheck}>✓</Text>
                                        )}
                                      </TouchableOpacity>
                                    );
                                  })}
                                </ScrollView>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {!selectedDay ? (
                      <Text style={styles.footerText}>
                        {
                          'Once you complete your last workout on this plan we will generate your next plan based on your preferences, so you continue seeing results'
                        }
                      </Text>
                    ) : null}
                  </ScrollView>
                </GestureHandlerRootView>
              </View>
            </Animated.View>
          </View>
        </Modal>

        {/* Exercise Details Modal - moved outside the main Modal */}
        {selectedExercise && (
          <ExerciseDetailsModal
            visible={exerciseDetailsVisible}
            onClose={() => {
              setExerciseDetailsVisible(false);
              setSelectedExercise(null);
            }}
            exerciseId={selectedExercise.id}
            exerciseName={selectedExercise.name}
            exerciseImage={selectedExercise.image}
            primary_muscles={selectedExercise.primary_muscles || []}
            secondary_muscles={selectedExercise.secondary_muscles || []}
          />
        )}
      </Portal>
    </Provider>
  );
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    height: SCREEN_HEIGHT,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
    height: '94%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
  },
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 0,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: {
          width: 10,
          height: 0,
        },
        shadowOpacity: 1,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  topGlowLeft: {
    position: 'absolute',
    top: -0.7,
    left: -0.2,
    width: 13,
    height: 13,
    borderTopLeftRadius: 12,
    backgroundColor: 'transparent',
    borderLeftWidth: 0.9,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 15,
    zIndex: 1,
  },
  topGlowRight: {
    position: 'absolute',
    top: -0.7,
    right: -0.2,
    width: 13,
    height: 13,
    borderTopRightRadius: 12,
    backgroundColor: 'transparent',
    borderRightWidth: 0.9,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 15,
    zIndex: 1,
  },
  gestureRoot: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderBottomWidth: 0.2,
    borderBottomColor: COLORS.primary,
    backgroundColor: COLORS.background,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    right: 8,
    margin: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  planTitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  planSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 16,
  },
  // New progress summary styles
  progressSummary: {
    backgroundColor: '#1a1d29',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(123, 105, 238, 0.3)',
  },
  progressText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  progressSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  timeline: {
    marginTop: 16,
    position: 'relative',
    paddingLeft: 0, // Remove padding to position elements properly
  },
  timelineLine: {
    position: 'absolute',
    width: 1,
    top: 90, // Start exactly at the blue dot
    bottom: 70, // End exactly at the green dot
    left: 30, // Center it through the dots
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 1,
  },
  timelineLineSegment: {
    position: 'absolute',
    width: 1,
    height: 70,
    left: 5.5, // Better center alignment with the dot
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 1,
  },
  weekContainer: {
    flexDirection: 'row',
    marginBottom: 0,
    position: 'relative',
    paddingTop: 10,
  },
  timelineLeft: {
    width: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginLeft: 24, // Position dots over the line
    zIndex: 2,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    marginTop: 0, // Adjusted for better vertical alignment
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTimelineDot: {
    borderWidth: 1.5,
    borderColor: `rgba(255, 255, 255, 0.7)`,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  // New completed timeline dot styles
  completedTimelineDot: {
    backgroundColor: '#4CAF50', // Green for completed
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  timelineDotCheck: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  weekContent: {
    flex: 1,
    backgroundColor: '#242936',
    borderRadius: 12,
    padding: 16,
    marginLeft: 12,
  },
  activeWeekContent: {
    backgroundColor: '#24293E',
    borderWidth: 1,
    borderColor: COLORS.primary, // Use primary color for active week border
  },
  // New completed week content styles
  completedWeekContent: {
    backgroundColor: '#1e2a1e', // Slightly green tint for completed weeks
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  weekIndicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: 8,
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  // New week completed badge styles
  weekCompletedBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  weekCompletedBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  weekDescription: {
    marginBottom: 10,
    marginTop: 2,
  },
  descriptionText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  daysScrollContainer: {
    position: 'relative',
  },
  daysScrollContent: {
    paddingVertical: 4,
    flexDirection: 'row',
  },
  dayButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayButton: {
    backgroundColor: '#333845',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 2,
    minWidth: 70,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  // New completed day button styles
  completedDayButton: {
    backgroundColor: '#4CAF50',
  },
  scrollIndicator: {
    position: 'absolute',
    right: 0,
    top: '50%',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    transform: [{ translateY: -10 }],
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 3,
  },
  dayButtonText: {
    fontSize: 14,
    color: '#fff',
  },
  // New completed day button text styles
  completedDayButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  dayButtonCheck: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 16,
    marginHorizontal: 16,
    fontStyle: 'italic',
  },
  // Exercise list styles
  exercisesContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exercisesHeaderLeft: {
    flex: 1,
  },
  exercisesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  // New completed badge styles for exercise header
  completedBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  completedBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  backButtonText: {
    fontSize: 14,
    color: '#fff',
  },
  exercisesList: {
    backgroundColor: '#242936',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  exerciseItem: {
    marginBottom: 0,
    paddingVertical: SPACING.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  exerciseImage: {
    width: 60,
    height: 60,
  },
  exerciseContent: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  exerciseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  exerciseDetail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginRight: 12,
  },
  exerciseDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: SPACING.xs,
  },
  noExercisesText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
  },
});
