/**
 * MyPlanCalendar Component
 *
 * A reusable weekly calendar component specifically designed for workout plans.
 * Displays a 7-day rolling calendar view with indicators for:
 * - Workout days (blue dots)
 * - Completed workouts (green checkmarks)
 * - Paused workouts (orange pause icons)
 * - Swipe gestures for week navigation (left/right)
 *
 * Used by: my-plan.tsx
 */

import { addDays, format, getDay, isSameDay, startOfWeek } from 'date-fns';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Icon } from 'react-native-paper';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Sentry from '@sentry/react-native';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/theme';
import workoutPlanService from '../services/workoutPlanService';

// Define proper types for the plan and marked dates
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
  day: number;
  exercises: Exercise[];
  total_exercises: number;
  estimated_duration: number;
  total_calories: number;
}

interface WorkoutPlan {
  id: string;
  start_date: string;
  workoutDays: WorkoutDay[];
}

interface MarkedDateInfo {
  marked: boolean;
  workoutDayIndex: number;
  cycleWeek: number;
  weekName: string;
}

interface MyPlanCalendarProps {
  plan: WorkoutPlan;
  userWorkoutDays: number[];
  onDateSelect: (date: Date, workoutDayIndex: number | null, isWorkoutDay: boolean) => void;
  completedWorkoutDays: string[];
  pausedWorkoutDays: string[];
  embedded?: boolean;
  initialSelectedDate?: Date;
}

export default function MyPlanCalendar({
  plan,
  userWorkoutDays,
  onDateSelect,
  completedWorkoutDays,
  pausedWorkoutDays,
  embedded = false,
  initialSelectedDate,
}: MyPlanCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate || new Date());
  const [markedDates, setMarkedDates] = useState<{ [key: string]: MarkedDateInfo }>({});
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    // Always start with the current week (Sunday to Saturday)
    return startOfWeek(new Date(), { weekStartsOn: 0 });
  });

  // Use ref to track if we've already auto-selected today's date
  const hasAutoSelectedToday = useRef(false);

  // Track component mount
  useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'MyPlanCalendar component mounted',
      category: 'ui.lifecycle',
      data: {
        planId: plan?.id,
        userWorkoutDaysCount: userWorkoutDays.length,
        completedDaysCount: completedWorkoutDays.length,
        pausedDaysCount: pausedWorkoutDays.length,
        embedded,
        hasInitialDate: !!initialSelectedDate,
      },
    });

    return () => {
      Sentry.addBreadcrumb({
        message: 'MyPlanCalendar component unmounted',
        category: 'ui.lifecycle',
      });
    };
  }, []);

  // Track plan changes
  useEffect(() => {
    if (plan?.id) {
      Sentry.addBreadcrumb({
        message: 'MyPlanCalendar plan updated',
        category: 'ui.update',
        data: {
          planId: plan.id,
          startDate: plan.start_date,
          workoutDaysCount: plan.workoutDays?.length || 0,
        },
      });
    }
  }, [plan?.id]);

  // Animated values for swipe gestures
  const translateX = useSharedValue(0);
  const isGestureActive = useSharedValue(false);
  const weekOpacity = useSharedValue(1);

  // Swipe gesture configuration
  const SWIPE_THRESHOLD = 50; // Minimum distance to trigger week change
  const SWIPE_VELOCITY_THRESHOLD = 500; // Minimum velocity to trigger week change

  // Use actual completion data from parent component
  const finalCompletedDays = completedWorkoutDays;
  const finalPausedDays = pausedWorkoutDays;

  // Memoize weekDays to prevent unnecessary recalculations
  const weekDays = useMemo(() => {
    try {
      const startTime = performance.now();
      const days = [];
      for (let i = 0; i < 7; i++) {
        days.push(addDays(currentWeekStart, i));
      }
      const endTime = performance.now();

      // Track week calculation performance
      Sentry.addBreadcrumb({
        message: 'Week days calculated',
        category: 'performance',
        data: {
          duration: `${(endTime - startTime).toFixed(2)}ms`,
          weekStart: format(currentWeekStart, 'yyyy-MM-dd'),
        },
      });

      return days;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MyPlanCalendar',
          action: 'calculate_week_days',
        },
        extra: {
          currentWeekStart: currentWeekStart?.toString(),
        },
      });
      return [];
    }
  }, [currentWeekStart]);

  // Setup calendar marked dates based on workout frequency and user preferences
  const setupCalendarDates = useCallback(
    (startDate: string, totalDays: number) => {
      if (userWorkoutDays.length === 0) return;

      try {
        const startTime = performance.now();

        // Use the new progressive calendar system
        const markedDatesObj = workoutPlanService.setupCalendarDatesProgressive(
          startDate,
          totalDays,
          userWorkoutDays,
          { primary: COLORS.primary },
        );

        setMarkedDates(markedDatesObj);

        const endTime = performance.now();

        // Track calendar setup performance
        Sentry.addBreadcrumb({
          message: 'Calendar dates setup completed',
          category: 'performance',
          data: {
            duration: `${(endTime - startTime).toFixed(2)}ms`,
            totalDays,
            userWorkoutDaysCount: userWorkoutDays.length,
            markedDatesCount: Object.keys(markedDatesObj).length,
          },
        });
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            component: 'MyPlanCalendar',
            action: 'setup_calendar_dates',
          },
          extra: {
            startDate,
            totalDays,
            userWorkoutDays,
          },
        });
      }
    },
    [userWorkoutDays.join(',')],
  );

  // Handle date selection on calendar
  const handleDateSelect = useCallback(
    async (day: Date) => {
      try {
        const startTime = performance.now();
        setSelectedDate(day);

        // Find the workout day that corresponds to this date
        if (plan) {
          const dateStr = format(day, 'yyyy-MM-dd');
          const markedDateInfo = markedDates[dateStr];

          if (markedDateInfo && markedDateInfo.marked) {
            // This is a workout day - get the workout day index from the marked date
            const workoutDayIndex = markedDateInfo.workoutDayIndex;

            Sentry.addBreadcrumb({
              message: 'Workout day selected',
              category: 'ui.interaction',
              data: {
                date: dateStr,
                workoutDayIndex,
                cycleWeek: markedDateInfo.cycleWeek,
                weekName: markedDateInfo.weekName,
              },
            });

            onDateSelect(day, workoutDayIndex, true);
          } else {
            // Not a workout day
            Sentry.addBreadcrumb({
              message: 'Non-workout day selected',
              category: 'ui.interaction',
              data: {
                date: dateStr,
              },
            });

            onDateSelect(day, null, false);
          }
        } else {
          // No plan available, just call onDateSelect with no workout day
          onDateSelect(day, null, false);
        }

        const endTime = performance.now();

        // Track date selection performance
        Sentry.addBreadcrumb({
          message: 'Date selection completed',
          category: 'performance',
          data: {
            duration: `${(endTime - startTime).toFixed(2)}ms`,
            selectedDate: format(day, 'yyyy-MM-dd'),
            hasPlan: !!plan,
          },
        });
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            component: 'MyPlanCalendar',
            action: 'handle_date_select',
          },
          extra: {
            selectedDay: day?.toString(),
            planId: plan?.id,
            markedDatesCount: Object.keys(markedDates).length,
          },
        });
      }
    },
    [plan, markedDates, onDateSelect],
  );

  // Function to get day abbreviation
  const getDayAbbreviation = (date: Date) => {
    const dayOfWeek = getDay(date); // getDay() returns 0-6 (0=Sunday, 6=Saturday)
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    return days[dayOfWeek];
  };

  // Function to check if date is selected
  const isSelected = (date: Date) => {
    return isSameDay(date, selectedDate);
  };

  // Function to handle date selection from weekly calendar
  const handleWeekDayPress = async (date: Date) => {
    // Skip processing if the user taps on the already selected date
    if (isSelected(date)) {
      Sentry.addBreadcrumb({
        message: 'Same date tapped - skipping',
        category: 'ui.interaction',
        data: {
          date: format(date, 'yyyy-MM-dd'),
        },
      });
      return;
    }

    Sentry.addBreadcrumb({
      message: 'Week day pressed',
      category: 'ui.interaction',
      data: {
        date: format(date, 'yyyy-MM-dd'),
        dayOfWeek: getDayAbbreviation(date),
      },
    });

    await handleDateSelect(date);
  };

  // Helper functions for week navigation
  const updateToPreviousWeek = useCallback(() => {
    try {
      setCurrentWeekStart((prev) => addDays(prev, -7));
      weekOpacity.value = withSpring(1, { damping: 15, stiffness: 200 });

      Sentry.addBreadcrumb({
        message: 'Week navigation - previous week',
        category: 'ui.navigation',
        data: {
          direction: 'previous',
        },
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MyPlanCalendar',
          action: 'update_to_previous_week',
        },
      });
    }
  }, [weekOpacity]);

  const updateToNextWeek = useCallback(() => {
    try {
      setCurrentWeekStart((prev) => addDays(prev, 7));
      weekOpacity.value = withSpring(1, { damping: 15, stiffness: 200 });

      Sentry.addBreadcrumb({
        message: 'Week navigation - next week',
        category: 'ui.navigation',
        data: {
          direction: 'next',
        },
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MyPlanCalendar',
          action: 'update_to_next_week',
        },
      });
    }
  }, [weekOpacity]);

  // Navigation functions with animation
  const goToPreviousWeek = useCallback(() => {
    try {
      // Animate week replacement
      weekOpacity.value = withSpring(0, { damping: 15, stiffness: 200 }, (finished) => {
        if (finished) {
          runOnJS(updateToPreviousWeek)();
        }
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MyPlanCalendar',
          action: 'go_to_previous_week',
        },
      });
    }
  }, [weekOpacity, updateToPreviousWeek]);

  const goToNextWeek = useCallback(() => {
    try {
      // Animate week replacement
      weekOpacity.value = withSpring(0, { damping: 15, stiffness: 200 }, (finished) => {
        if (finished) {
          runOnJS(updateToNextWeek)();
        }
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MyPlanCalendar',
          action: 'go_to_next_week',
        },
      });
    }
  }, [weekOpacity, updateToNextWeek]);

  // Pan gesture for swipe navigation
  const panGesture = Gesture.Pan()
    .onStart(() => {
      try {
        isGestureActive.value = true;
        Sentry.addBreadcrumb({
          message: 'Swipe gesture started',
          category: 'ui.gesture',
        });
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            component: 'MyPlanCalendar',
            action: 'gesture_start',
          },
        });
      }
    })
    .onUpdate((event) => {
      try {
        // Only allow horizontal movement with reduced sensitivity
        translateX.value = event.translationX * 0.3; // Reduce movement for smoother feel
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            component: 'MyPlanCalendar',
            action: 'gesture_update',
          },
          extra: {
            translationX: event.translationX,
          },
        });
      }
    })
    .onEnd((event) => {
      try {
        const { translationX, velocityX } = event;

        // Determine if swipe should trigger navigation
        const shouldNavigate =
          Math.abs(translationX) > SWIPE_THRESHOLD ||
          Math.abs(velocityX) > SWIPE_VELOCITY_THRESHOLD;

        // Reset animation first
        translateX.value = withSpring(0, {
          damping: 15,
          stiffness: 150,
        });
        isGestureActive.value = false;

        // Track gesture completion
        Sentry.addBreadcrumb({
          message: 'Swipe gesture completed',
          category: 'ui.gesture',
          data: {
            translationX,
            velocityX,
            shouldNavigate,
            direction: translationX > 0 ? 'right' : 'left',
          },
        });

        // Then trigger navigation if needed
        if (shouldNavigate) {
          if (translationX > 0) {
            // Swipe right - go to previous week
            runOnJS(goToPreviousWeek)();
          } else {
            // Swipe left - go to next week
            runOnJS(goToNextWeek)();
          }
        }
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            component: 'MyPlanCalendar',
            action: 'gesture_end',
          },
          extra: {
            translationX: event.translationX,
            velocityX: event.velocityX,
          },
        });
      }
    });

  // Animated style for the week days row only
  const weekDaysAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: translateX.value,
        },
      ],
      opacity: weekOpacity.value * (isGestureActive.value ? 0.7 : 1),
    };
  });

  const goToCurrentWeek = useCallback(() => {
    try {
      const today = new Date();

      // Animate week replacement
      weekOpacity.value = withSpring(0, { damping: 15, stiffness: 200 }, (finished) => {
        if (finished) {
          runOnJS(() => {
            setCurrentWeekStart(startOfWeek(today, { weekStartsOn: 0 }));
            setSelectedDate(today);
            handleDateSelect(today);
          })();
          weekOpacity.value = withSpring(1, { damping: 15, stiffness: 200 });
        }
      });

      Sentry.addBreadcrumb({
        message: 'Navigate to current week',
        category: 'ui.navigation',
        data: {
          todayDate: format(today, 'yyyy-MM-dd'),
        },
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MyPlanCalendar',
          action: 'go_to_current_week',
        },
      });
    }
  }, [weekOpacity, handleDateSelect]);

  // Function to find next workout day
  const findNextWorkoutDay = () => {
    try {
      const today = new Date();

      // Look for workout days in the next 30 days
      for (let i = 1; i <= 30; i++) {
        const checkDate = addDays(today, i);
        const checkDateStr = format(checkDate, 'yyyy-MM-dd');

        if (markedDates[checkDateStr]?.marked) {
          // Found a workout day, navigate to the week containing this date
          const weekStart = startOfWeek(checkDate, { weekStartsOn: 0 });
          setCurrentWeekStart(weekStart);
          setSelectedDate(checkDate);
          handleDateSelect(checkDate);

          Sentry.addBreadcrumb({
            message: 'Next workout day found and selected',
            category: 'ui.navigation',
            data: {
              nextWorkoutDate: checkDateStr,
              daysFromToday: i,
            },
          });
          break;
        }
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MyPlanCalendar',
          action: 'find_next_workout_day',
        },
        extra: {
          markedDatesCount: Object.keys(markedDates).length,
        },
      });
    }
  };

  // Function to find previous workout day
  const findPreviousWorkoutDay = () => {
    try {
      const today = new Date();

      // Look for workout days in the previous 30 days
      for (let i = 1; i <= 30; i++) {
        const checkDate = addDays(today, -i);
        const checkDateStr = format(checkDate, 'yyyy-MM-dd');

        if (markedDates[checkDateStr]?.marked) {
          // Found a workout day, navigate to the week containing this date
          const weekStart = startOfWeek(checkDate, { weekStartsOn: 0 });
          setCurrentWeekStart(weekStart);
          setSelectedDate(checkDate);
          handleDateSelect(checkDate);

          Sentry.addBreadcrumb({
            message: 'Previous workout day found and selected',
            category: 'ui.navigation',
            data: {
              previousWorkoutDate: checkDateStr,
              daysFromToday: i,
            },
          });
          break;
        }
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MyPlanCalendar',
          action: 'find_previous_workout_day',
        },
        extra: {
          markedDatesCount: Object.keys(markedDates).length,
        },
      });
    }
  };

  // Get week display text
  const getWeekDisplayText = () => {
    const today = new Date();
    const thisWeekStart = startOfWeek(today, { weekStartsOn: 0 });

    if (isSameDay(currentWeekStart, thisWeekStart)) {
      return 'This Week';
    }

    const weeksDiff = Math.round(
      (currentWeekStart.getTime() - thisWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );

    if (weeksDiff === 1) {
      return 'Next Week';
    } else if (weeksDiff === -1) {
      return 'Last Week';
    } else if (weeksDiff > 0) {
      return `+${weeksDiff} weeks`;
    } else {
      return `${weeksDiff} weeks`;
    }
  };

  // Update selected date when initialSelectedDate prop changes
  useEffect(() => {
    if (initialSelectedDate) {
      setSelectedDate(initialSelectedDate);
      // Navigate to the week containing the selected date
      const weekStart = startOfWeek(initialSelectedDate, { weekStartsOn: 0 });
      setCurrentWeekStart(weekStart);

      Sentry.addBreadcrumb({
        message: 'Initial selected date updated',
        category: 'ui.update',
        data: {
          initialDate: format(initialSelectedDate, 'yyyy-MM-dd'),
        },
      });
    }
  }, [initialSelectedDate]);

  // Setup calendar dates when plan or userWorkoutDays change
  useEffect(() => {
    if (plan?.id && plan?.start_date && userWorkoutDays.length > 0) {
      setupCalendarDates(plan.start_date, plan.workoutDays.length);
    }
  }, [plan?.id, plan?.start_date, plan?.workoutDays?.length, userWorkoutDays.join(',')]);

  // Auto-select today's date when marked dates are first set up (only once)
  useEffect(() => {
    if (Object.keys(markedDates).length > 0 && plan?.id && !hasAutoSelectedToday.current) {
      // Only auto-select if we haven't manually selected a different date
      const today = new Date();
      if (isSameDay(selectedDate, today)) {
        // Trigger the date selection for today to update the parent component
        handleDateSelect(today);
        hasAutoSelectedToday.current = true;

        Sentry.addBreadcrumb({
          message: "Auto-selected today's date",
          category: 'ui.auto_action',
          data: {
            todayDate: format(today, 'yyyy-MM-dd'),
          },
        });
      }
    }
  }, [markedDates, plan?.id]);

  // Reset the auto-select flag when plan changes
  useEffect(() => {
    hasAutoSelectedToday.current = false;
  }, [plan?.id]);

  return (
    <View
      style={[
        styles.weeklyCalendarContainer,
        {
          paddingTop: embedded ? SPACING.md : SPACING.sm,
          paddingBottom: embedded ? SPACING.md : 12,
          marginTop: embedded ? 100 : 0,
        },
      ]}
    >
      {/* Navigation Header */}
      <View style={styles.navigationHeader}>
        <TouchableOpacity onPress={goToPreviousWeek} style={styles.navButton}>
          <Icon source="chevron-left" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.weekInfo}>
          <TouchableOpacity onPress={goToCurrentWeek} style={styles.todayButton}>
            <Text style={styles.weekText}>{getWeekDisplayText()}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={goToNextWeek} style={styles.navButton}>
          <Icon source="chevron-right" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Workout Navigation */}
      {!embedded && (
        <View style={styles.workoutNavigation}>
          <TouchableOpacity onPress={findPreviousWorkoutDay} style={styles.workoutNavButton}>
            <Icon source="skip-previous" size={16} color={COLORS.primary} />
            <Text style={styles.workoutNavText}>Prev Workout</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={findNextWorkoutDay} style={styles.workoutNavButton}>
            <Text style={styles.workoutNavText}>Next Workout</Text>
            <Icon source="skip-next" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Calendar Days */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.weekDaysRow, weekDaysAnimatedStyle]}>
          {weekDays.map((day, index) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const hasWorkout = markedDates[dayStr]?.marked;
            const isCompleted = finalCompletedDays.includes(dayStr);
            const isPaused = finalPausedDays.includes(dayStr);
            const isSelectedDay = isSelected(day);

            // Determine the icon to show (priority: completed > paused > workout indicator)
            // Only show workout indicator if it's NOT completed or paused
            let iconType = 'none';
            if (hasWorkout) {
              if (isCompleted) {
                iconType = 'completed';
              } else if (isPaused) {
                iconType = 'paused';
              } else {
                // Only show workout indicator if not completed and not paused
                iconType = 'workout';
              }
            }

            return (
              <TouchableOpacity
                key={index}
                style={[styles.weekDay, isSelectedDay && styles.selectedWeekDay]}
                onPress={() => handleWeekDayPress(day)}
              >
                <View style={styles.weekDayContent}>
                  <Text style={[styles.weekDayText, isSelectedDay && styles.selectedWeekDayText]}>
                    {getDayAbbreviation(day)}
                  </Text>
                  <Text style={[styles.weekDayNumber, isSelectedDay && styles.selectedWeekDayText]}>
                    {format(day, 'd')}
                  </Text>

                  {/* Render only ONE indicator based on workout state priority */}
                  {iconType !== 'none' && (
                    <View style={styles.indicatorContainer}>
                      {iconType === 'completed' && (
                        <View style={styles.completedIconBackground}>
                          <Icon source="check" size={12} color="#FFFFFF" />
                        </View>
                      )}

                      {iconType === 'paused' && (
                        <View style={styles.pausedIconBackground}>
                          <Icon source="pause" size={12} color="#FFFFFF" />
                        </View>
                      )}

                      {iconType === 'workout' && (
                        <View
                          style={[
                            styles.workoutIndicator,
                            isSelectedDay && styles.selectedWorkoutIndicator,
                          ]}
                        />
                      )}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  weeklyCalendarContainer: {
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.background,
    zIndex: 1,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekDay: {
    width: 44,
    height: 68,
    borderRadius: 25,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedWeekDay: {
    backgroundColor: COLORS.primary,
    elevation: 5,
  },
  weekDayContent: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: '100%',
    width: '100%',
  },
  weekDayText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 4,
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 8,
  },
  selectedWeekDayText: {
    color: COLORS.text,
  },
  navigationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  navButton: {
    padding: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  weekInfo: {
    flex: 1,
    alignItems: 'center',
  },
  todayButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  weekText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  workoutNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  workoutNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(123, 105, 238, 0.1)',
  },
  workoutNavText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
    marginHorizontal: SPACING.xs,
  },
  indicatorContainer: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
  },
  completedIconBackground: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  pausedIconBackground: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  workoutIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  selectedWorkoutIndicator: {
    backgroundColor: COLORS.text,
  },
});
