import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { Surface, IconButton, Divider } from 'react-native-paper';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';

import { COLORS, SPACING } from '../constants/theme';
import { useAuth } from '../store/AuthContext';
import supabase from '../services/supabase';
import { SentryDataCollection, SentryLogger } from '../services/sentry';

interface WorkoutExercise {
  id: string;
  exercise_name: string;
  sets: Array<{
    weight: number | null;
    reps: number | null;
  }>;
}

interface WorkoutDetails {
  id: string;
  workout_name: string;
  completed_at: string;
  workout_duration: string;
  total_volume: number;
  calories_burned: number | null;
  exercises: WorkoutExercise[];
}

const { width: screenWidth } = Dimensions.get('window');

export default function WorkoutDetailsScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const selectedDate = params.date as string;

  const [selectedWeekDate, setSelectedWeekDate] = useState<Date>(
    selectedDate ? parseISO(selectedDate) : new Date(),
  );
  const [workoutDetails, setWorkoutDetails] = useState<WorkoutDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Animation values
  const slideAnim = useRef(new Animated.Value(screenWidth)).current; // Start from right side
  const opacityAnim = useRef(new Animated.Value(0)).current; // Start transparent

  useEffect(() => {
    if (selectedDate && user?.id) {
      loadWorkoutDetails();
    }
  }, [selectedDate, user?.id]);

  // Slide-in animation when component mounts
  useEffect(() => {
    // Small delay to ensure smooth transition
    const animationTimeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();

      // Track animation start
      SentryDataCollection.addBreadcrumb({
        message: 'Workout details slide-in animation started',
        category: 'ui.animation',
        data: {
          component: 'WorkoutDetailsScreen',
          animation_type: 'slide_in_from_right',
          duration: 350,
        },
      });
    }, 50);

    return () => {
      clearTimeout(animationTimeout);
    };
  }, [slideAnim, opacityAnim]);

  const loadWorkoutDetails = async () => {
    if (!user?.id || !selectedDate) return;

    try {
      setLoading(true);
      setError(null);

      SentryDataCollection.addBreadcrumb({
        message: 'Loading workout details',
        category: 'data.load',
        data: {
          component: 'WorkoutDetailsScreen',
          user_id: user.id,
          selected_date: selectedDate,
        },
      });

      // Get workout history for the selected date
      const { data: workoutHistory, error: historyError } = await supabase
        .from('user_workout_history')
        .select(
          `
          id,
          workout_day,
          completed_at,
          workout_duration,
          total_volume,
          calories_burned,
          week_name
        `,
        )
        .eq('user_id', user.id)
        .gte('completed_at', `${selectedDate}T00:00:00.000Z`)
        .lt('completed_at', `${selectedDate}T23:59:59.999Z`)
        .order('completed_at', { ascending: false });

      if (historyError) throw historyError;

      if (!workoutHistory || workoutHistory.length === 0) {
        setWorkoutDetails([]);
        return;
      }

      // Process each workout for the day
      const allWorkoutDetails: WorkoutDetails[] = [];

      for (const workout of workoutHistory) {
        // Get exercise records for this workout
        const { data: exerciseRecords, error: exerciseError } = await supabase
          .from('user_exercise_records')
          .select(
            `
            id,
            exercise_id,
            weight,
            reps,
            exercises!inner(name)
          `,
          )
          .eq('workout_history_id', workout.id)
          .eq('completed', true)
          .order('created_at', { ascending: true });

        if (exerciseError) throw exerciseError;

        // Group exercises by exercise_id and collect sets
        const exerciseMap = new Map<string, WorkoutExercise>();

        exerciseRecords?.forEach((record) => {
          const exerciseId = record.exercise_id;
          const exerciseName =
            (record.exercises as unknown as { name: string })?.name || 'Unknown Exercise';

          if (!exerciseMap.has(exerciseId)) {
            exerciseMap.set(exerciseId, {
              id: exerciseId,
              exercise_name: exerciseName,
              sets: [],
            });
          }

          const exercise = exerciseMap.get(exerciseId)!;
          exercise.sets.push({
            weight: record.weight,
            reps: record.reps,
          });
        });

        const workoutDetail: WorkoutDetails = {
          id: workout.id,
          workout_name: `${workout.week_name || 'Week'} - Day ${workout.workout_day}`,
          completed_at: workout.completed_at,
          workout_duration: workout.workout_duration || '0:00:00',
          total_volume: workout.total_volume || 0,
          calories_burned: workout.calories_burned,
          exercises: Array.from(exerciseMap.values()),
        };

        allWorkoutDetails.push(workoutDetail);
      }

      setWorkoutDetails(allWorkoutDetails);

      SentryDataCollection.addBreadcrumb({
        message: 'Workout details loaded successfully',
        category: 'data.process',
        data: {
          component: 'WorkoutDetailsScreen',
          workouts_count: allWorkoutDetails.length,
          total_exercises: allWorkoutDetails.reduce((sum, w) => sum + w.exercises.length, 0),
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load workout details';
      setError(errorMessage);

      SentryDataCollection.captureException(err as Error, {
        component: 'WorkoutDetailsScreen',
        action: 'load_workout_details_error',
        selected_date: selectedDate,
      });

      SentryLogger.error('Error loading workout details', {
        error: err as Error,
        component: 'WorkoutDetailsScreen',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (duration: string): string => {
    try {
      const parts = duration.split(':');
      if (parts.length >= 2) {
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        if (hours > 0) {
          return `${hours}:${minutes.toString().padStart(2, '0')} hr`;
        }
        return `${minutes} min`;
      }
      return duration;
    } catch {
      return duration;
    }
  };

  const formatWeight = (weight: number): string => {
    if (weight >= 1000) {
      return `${(weight / 1000).toFixed(1)}K kg`;
    }
    return `${weight} kg`;
  };

  const formatSet = (set: WorkoutExercise['sets'][0], index: number): string => {
    if (set.weight && set.reps) {
      return `${set.weight} kg\n${set.reps} reps`;
    }

    if (set.reps) {
      return `${set.reps} reps`;
    }

    return `Set ${index + 1}`;
  };

  const getWeekDates = () => {
    const startDate = startOfWeek(selectedWeekDate, { weekStartsOn: 1 }); // Monday start
    return Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
  };

  const handleDatePress = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    setSelectedWeekDate(date);

    // Navigate to the same screen with new date
    router.replace({
      pathname: '/(stack)/workout-details',
      params: { date: dateString },
    });
  };

  const handleTodayPress = () => {
    const today = new Date();
    const todayString = format(today, 'yyyy-MM-dd');
    setSelectedWeekDate(today);

    router.replace({
      pathname: '/(stack)/workout-details',
      params: { date: todayString },
    });
  };

  const handleBackPress = () => {
    // Track back button press
    SentryDataCollection.addBreadcrumb({
      message: 'Workout details back button pressed',
      category: 'ui.interaction',
      data: {
        component: 'WorkoutDetailsScreen',
        animation_type: 'slide_out_to_right',
      },
    });

    // Slide-out animation before navigation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Navigate after animation completes
      router.push('/(tabs)/insights');
    });
  };

  const weekDates = getWeekDates();
  const today = new Date();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <Animated.View
        style={[
          styles.animatedContainer,
          {
            transform: [{ translateX: slideAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        {/* Custom Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <IconButton
              icon="arrow-left"
              iconColor={COLORS.text}
              size={24}
              onPress={handleBackPress}
              style={styles.backButton}
            />
          </View>
          <Text style={styles.headerTitle}>YOUR WORKOUTS</Text>
          <View style={styles.headerRight} />
        </View>
        <Divider style={styles.divider} />

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Week Calendar */}
          <Surface style={styles.weekCalendarContainer} elevation={2}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekRange}>
                {format(weekDates[0], 'MM/dd/yy')} - {format(weekDates[6], 'MM/dd/yy')}
              </Text>
              <Pressable onPress={handleTodayPress} style={styles.todayButton}>
                <Text style={styles.todayButtonText}>Today</Text>
              </Pressable>
            </View>

            <View style={styles.weekDays}>
              {weekDates.map((date, index) => {
                const isSelected = selectedDate === format(date, 'yyyy-MM-dd');
                const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                return (
                  <Pressable
                    key={index}
                    style={[styles.dayContainer, isSelected && styles.selectedDay]}
                    onPress={() => handleDatePress(date)}
                  >
                    <Text style={[styles.dayName, isSelected && styles.selectedDayText]}>
                      {dayNames[date.getDay()]}
                    </Text>
                    <Text
                      style={[
                        styles.dayNumber,
                        isToday && styles.todayNumber,
                        isSelected && styles.selectedDayText,
                      ]}
                    >
                      {format(date, 'd')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Surface>

          {/* Selected Date */}
          <View style={styles.selectedDateContainer}>
            <Text style={styles.selectedDateText}>
              {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
            </Text>
          </View>

          {/* Workout Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Error: {error}</Text>
            </View>
          ) : workoutDetails.length > 0 ? (
            <View style={styles.workoutContent}>
              {workoutDetails.map((workout, workoutIndex) => (
                <View key={workout.id} style={styles.workoutContainer}>
                  {/* Workout Header with number if multiple workouts */}
                  {workoutDetails.length > 1 && (
                    <Text style={styles.workoutNumber}>
                      Workout {workoutIndex + 1} of {workoutDetails.length}
                    </Text>
                  )}

                  {/* Workout Summary */}
                  <Surface style={styles.workoutSummary} elevation={2}>
                    <View style={styles.summaryHeader}>
                      <Text style={styles.workoutTitle}>{workout.workout_name}</Text>
                      <View style={styles.workoutHeaderRight}>
                        <Text style={styles.workoutTime}>
                          {format(new Date(workout.completed_at), 'HH:mm')}
                        </Text>
                        <IconButton
                          icon="share-variant"
                          iconColor={COLORS.text}
                          size={20}
                          onPress={() => {}}
                        />
                      </View>
                    </View>
                    <Text style={styles.workoutStats}>
                      {formatDuration(workout.workout_duration)} |{' '}
                      {formatWeight(workout.total_volume)} | {workout.calories_burned || 0} cal
                    </Text>
                  </Surface>

                  {/* Exercises List */}
                  {workout.exercises.map((exercise) => (
                    <Surface key={exercise.id} style={styles.exerciseCard} elevation={1}>
                      <View style={styles.exerciseHeader}>
                        <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
                        <IconButton
                          icon="pencil"
                          iconColor={COLORS.text}
                          size={16}
                          onPress={() => {}}
                        />
                      </View>

                      <View style={styles.setsContainer}>
                        {exercise.sets.map((set, setIndex) => (
                          <View key={setIndex} style={styles.setItem}>
                            <Text style={styles.setText}>{formatSet(set, setIndex)}</Text>
                          </View>
                        ))}
                      </View>
                    </Surface>
                  ))}

                  {/* Add spacing between workouts if multiple */}
                  {workoutDetails.length > 1 && workoutIndex < workoutDetails.length - 1 && (
                    <View style={styles.workoutSeparator} />
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noWorkoutContainer}>
              <Text style={styles.noWorkoutText}>No workout found for this date</Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  animatedContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xxl * 1.5,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    flex: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  backButton: {
    margin: 0,
  },
  divider: {
    backgroundColor: COLORS.primary,
    height: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: SPACING.md,
    paddingBottom: 100,
  },
  weekCalendarContainer: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  weekRange: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayContainer: {
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: 8,
    minWidth: 40,
  },
  selectedDay: {
    backgroundColor: COLORS.primary,
  },
  dayName: {
    fontSize: 12,
    color: COLORS.text,
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  todayNumber: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  selectedDayText: {
    color: COLORS.background,
  },
  selectedDateContainer: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  selectedDateText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorContainer: {
    marginHorizontal: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
  },
  noWorkoutContainer: {
    marginHorizontal: SPACING.md,
    padding: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    alignItems: 'center',
  },
  noWorkoutText: {
    fontSize: 16,
    color: COLORS.text,
    opacity: 0.7,
    textAlign: 'center',
  },
  workoutContent: {
    marginHorizontal: SPACING.md,
  },
  workoutContainer: {
    marginBottom: SPACING.lg,
  },
  workoutNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  workoutSummary: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  workoutHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  workoutTime: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    opacity: 0.7,
    marginRight: SPACING.xs,
  },
  workoutStats: {
    fontSize: 14,
    color: COLORS.text,
    opacity: 0.8,
  },
  workoutSeparator: {
    height: 2,
    backgroundColor: 'rgba(108, 71, 255, 0.2)',
    marginVertical: SPACING.lg,
    borderRadius: 1,
  },
  exerciseCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  singleSetText: {
    fontSize: 14,
    color: COLORS.text,
    opacity: 0.8,
  },
  setsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  setItem: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: SPACING.sm,
    minWidth: 80,
    alignItems: 'center',
  },
  setText: {
    fontSize: 12,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 16,
  },
});
