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
import {
  PanGestureHandler,
  State,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
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
  const [currentSelectedDate, setCurrentSelectedDate] = useState<string>(selectedDate);
  const [workoutDetails, setWorkoutDetails] = useState<WorkoutDetails[]>([]);
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Animation values
  const slideAnim = useRef(new Animated.Value(screenWidth)).current; // Start from right side
  const opacityAnim = useRef(new Animated.Value(0)).current; // Start transparent
  const weekCalendarOpacity = useRef(new Animated.Value(1)).current; // Week calendar fade animation

  // Load workout details only when selected date changes
  useEffect(() => {
    if (currentSelectedDate && user?.id) {
      loadWorkoutDetails();
    }
  }, [currentSelectedDate, user?.id]);

  // Load workout dates for calendar when week changes
  useEffect(() => {
    if (user?.id) {
      loadWorkoutDatesForWeek();
    }
  }, [selectedWeekDate, user?.id]);

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

  const loadWorkoutDetails = async (dateToLoad?: string) => {
    const targetDate = dateToLoad || currentSelectedDate;
    if (!user?.id || !targetDate) return;

    try {
      setLoading(true);
      setError(null);

      SentryDataCollection.addBreadcrumb({
        message: 'Loading workout details',
        category: 'data.load',
        data: {
          component: 'WorkoutDetailsScreen',
          user_id: user.id,
          selected_date: targetDate,
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
        .gte('completed_at', `${targetDate}T00:00:00.000Z`)
        .lt('completed_at', `${targetDate}T23:59:59.999Z`)
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
        selected_date: targetDate,
      });

      SentryLogger.error('Error loading workout details', {
        error: err as Error,
        component: 'WorkoutDetailsScreen',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadWorkoutDatesForWeek = async (weekDate?: Date) => {
    if (!user?.id) return;

    try {
      const targetWeekDate = weekDate || selectedWeekDate;
      const weekStartDate = startOfWeek(targetWeekDate, { weekStartsOn: 1 });
      const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
      const startDate = format(weekDates[0], 'yyyy-MM-dd');
      const endDate = format(weekDates[6], 'yyyy-MM-dd');

      const { data: workoutHistory, error } = await supabase
        .from('user_workout_history')
        .select('completed_at')
        .eq('user_id', user.id)
        .gte('completed_at', `${startDate}T00:00:00.000Z`)
        .lte('completed_at', `${endDate}T23:59:59.999Z`);

      if (error) throw error;

      const workoutDateSet = new Set<string>();
      workoutHistory?.forEach((workout) => {
        const workoutDate = format(new Date(workout.completed_at), 'yyyy-MM-dd');
        workoutDateSet.add(workoutDate);
      });

      setWorkoutDates(workoutDateSet);

      SentryDataCollection.addBreadcrumb({
        message: 'Workout dates for week loaded',
        category: 'data.load',
        data: {
          component: 'WorkoutDetailsScreen',
          week_start: startDate,
          week_end: endDate,
          workout_dates_count: workoutDateSet.size,
        },
      });
    } catch (err) {
      SentryLogger.error('Error loading workout dates for week', {
        error: err as Error,
        component: 'WorkoutDetailsScreen',
      });
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

    // Only update the selected week date if it's different
    if (format(selectedWeekDate, 'yyyy-MM-dd') !== dateString) {
      setSelectedWeekDate(date);
    }

    // Update the current selected date (this will trigger workout details loading via useEffect)
    setCurrentSelectedDate(dateString);

    SentryDataCollection.addBreadcrumb({
      message: 'Date selected in workout details',
      category: 'ui.interaction',
      data: {
        component: 'WorkoutDetailsScreen',
        selected_date: dateString,
        interaction_type: 'date_press',
      },
    });
  };

  const animateWeekChange = (newWeekDate: Date) => {
    // Start loading workout dates immediately (don't wait for animation delay)
    loadWorkoutDatesForWeek(newWeekDate);

    Animated.sequence([
      // Fade out
      Animated.timing(weekCalendarOpacity, {
        toValue: 0.3,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      // Fade back in
      Animated.timing(weekCalendarOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    // Update the selected week date during the fade-out
    setTimeout(() => {
      setSelectedWeekDate(newWeekDate);
    }, 75);
  };

  const handleTodayPress = () => {
    const today = new Date();
    const todayString = format(today, 'yyyy-MM-dd');

    // Check if we need to change weeks
    const currentWeekStart = startOfWeek(selectedWeekDate, { weekStartsOn: 1 });
    const todayWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    const needsWeekChange = currentWeekStart.getTime() !== todayWeekStart.getTime();

    if (needsWeekChange) {
      // Animate week change
      animateWeekChange(today);
    } else {
      // Just update the selected week date for consistency
      setSelectedWeekDate(today);
    }

    // Update the current selected date (this will trigger workout details loading via useEffect)
    setCurrentSelectedDate(todayString);

    SentryDataCollection.addBreadcrumb({
      message: 'Today button pressed in workout details',
      category: 'ui.interaction',
      data: {
        component: 'WorkoutDetailsScreen',
        selected_date: todayString,
        interaction_type: 'today_button',
        week_changed: needsWeekChange,
      },
    });
  };

  const handleWeekSwipe = (event: PanGestureHandlerGestureEvent) => {
    const { translationX, state } = event.nativeEvent;
    const swipeThreshold = 50; // Minimum distance for swipe detection

    if (state === State.END) {
      if (translationX > swipeThreshold) {
        // Swipe right - go to previous week
        const previousWeek = addDays(selectedWeekDate, -7);

        animateWeekChange(previousWeek);

        SentryDataCollection.addBreadcrumb({
          message: 'Week changed via swipe gesture',
          category: 'ui.gesture',
          data: {
            component: 'WorkoutDetailsScreen',
            direction: 'previous',
            gesture_type: 'swipe_right',
          },
        });
      } else if (translationX < -swipeThreshold) {
        // Swipe left - go to next week
        const nextWeek = addDays(selectedWeekDate, 7);

        animateWeekChange(nextWeek);

        SentryDataCollection.addBreadcrumb({
          message: 'Week changed via swipe gesture',
          category: 'ui.gesture',
          data: {
            component: 'WorkoutDetailsScreen',
            direction: 'next',
            gesture_type: 'swipe_left',
          },
        });
      }
    }
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
          <PanGestureHandler
            onGestureEvent={handleWeekSwipe}
            onHandlerStateChange={handleWeekSwipe}
          >
            <Surface style={styles.weekCalendarContainer} elevation={2}>
              <View style={styles.weekHeader}>
                <Pressable
                  onPress={() => {
                    const previousWeek = addDays(selectedWeekDate, -7);

                    animateWeekChange(previousWeek);

                    SentryDataCollection.addBreadcrumb({
                      message: 'Week changed via arrow button',
                      category: 'ui.interaction',
                      data: {
                        component: 'WorkoutDetailsScreen',
                        direction: 'previous',
                        interaction_type: 'arrow_button',
                      },
                    });
                  }}
                  style={styles.weekNavButton}
                >
                  <Text style={styles.weekNavButtonText}>‹</Text>
                </Pressable>

                <Text style={styles.weekRange}>
                  {format(weekDates[0], 'MM/dd/yy')} - {format(weekDates[6], 'MM/dd/yy')}
                </Text>

                <View style={styles.weekHeaderRight}>
                  <Pressable
                    onPress={() => {
                      const nextWeek = addDays(selectedWeekDate, 7);

                      animateWeekChange(nextWeek);

                      SentryDataCollection.addBreadcrumb({
                        message: 'Week changed via arrow button',
                        category: 'ui.interaction',
                        data: {
                          component: 'WorkoutDetailsScreen',
                          direction: 'next',
                          interaction_type: 'arrow_button',
                        },
                      });
                    }}
                    style={styles.weekNavButton}
                  >
                    <Text style={styles.weekNavButtonText}>›</Text>
                  </Pressable>

                  <Pressable onPress={handleTodayPress} style={styles.todayButton}>
                    <Text style={styles.todayButtonText}>Today</Text>
                  </Pressable>
                </View>
              </View>

              <Animated.View style={[styles.weekDaysContainer, { opacity: weekCalendarOpacity }]}>
                <View style={styles.weekDays}>
                  {weekDates.map((date, index) => {
                    const dateString = format(date, 'yyyy-MM-dd');
                    const isSelected = currentSelectedDate === dateString;
                    const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                    const hasWorkout = workoutDates.has(dateString);
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
                            isToday && !isSelected && !hasWorkout && styles.todayNumber,
                            isSelected && styles.selectedDayText,
                            hasWorkout && !isSelected && styles.workoutDayText,
                          ]}
                        >
                          {format(date, 'd')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Animated.View>
            </Surface>
          </PanGestureHandler>

          {/* Selected Date */}
          <View style={styles.selectedDateContainer}>
            <Text style={styles.selectedDateText}>
              {format(parseISO(currentSelectedDate), 'EEEE, MMMM d, yyyy')}
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
                <React.Fragment key={workout.id}>
                  <Surface style={styles.unifiedWorkoutContainer} elevation={2}>
                    {/* Workout Header with number if multiple workouts */}
                    {workoutDetails.length > 1 && (
                      <Text style={styles.workoutNumber}>
                        Workout {workoutIndex + 1} of {workoutDetails.length}
                      </Text>
                    )}

                    {/* Workout Summary Section */}
                    <View style={styles.workoutSummarySection}>
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
                    </View>

                    {/* Exercises Section */}
                    {workout.exercises.length > 0 && (
                      <View style={styles.exercisesSection}>
                        <View style={styles.exercisesSectionHeader}>
                          <Text style={styles.exercisesSectionTitle}>Exercises</Text>
                        </View>

                        {workout.exercises.map((exercise, exerciseIndex) => (
                          <View key={exercise.id} style={styles.exerciseItem}>
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

                            {/* Add divider between exercises except for the last one */}
                            {exerciseIndex < workout.exercises.length - 1 && (
                              <View style={styles.exerciseDivider} />
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </Surface>

                  {/* Add spacing between workouts if multiple - moved outside Surface */}
                  {workoutDetails.length > 1 && workoutIndex < workoutDetails.length - 1 && (
                    <View style={styles.workoutSeparator} />
                  )}
                </React.Fragment>
              ))}
            </View>
          ) : (
            <View style={styles.noWorkoutContainer}>
              <Text style={styles.noWorkoutText}>No workouts found for this date</Text>
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
    paddingBottom: SPACING.xs,
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
  weekHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  weekRange: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    textAlign: 'center',
  },
  weekNavButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekNavButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
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
  weekDaysContainer: {
    paddingHorizontal: SPACING.sm,
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.xs,
  },
  dayContainer: {
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: 8,
    minWidth: 44,
    minHeight: 56,
    justifyContent: 'center',
    marginHorizontal: SPACING.xs / 2,
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
    color: '#FFFFFF',
    fontWeight: '600',
  },
  workoutDayText: {
    color: COLORS.primary,
    fontWeight: '600',
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
  unifiedWorkoutContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
  },
  workoutNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  workoutSummarySection: {
    marginBottom: SPACING.lg,
  },
  exercisesSection: {
    marginTop: SPACING.sm,
  },
  exercisesSectionHeader: {
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(108, 71, 255, 0.2)',
  },
  exercisesSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  exerciseItem: {
    paddingVertical: SPACING.sm,
  },
  exerciseDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: SPACING.md,
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
