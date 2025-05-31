/**
 * MyPlanCalendar Component
 *
 * A reusable weekly calendar component specifically designed for workout plans.
 * Displays a 7-day rolling calendar view with indicators for:
 * - Workout days (blue dots)
 * - Completed workouts (green checkmarks)
 * - Paused workouts (orange pause icons)
 *
 * Used by: my-plan.tsx
 */

import { addDays, format, getDay, isSameDay, startOfWeek } from 'date-fns';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from 'react-native-paper';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _cycleProgress?: any;
}

export default function MyPlanCalendar({
  plan,
  userWorkoutDays,
  onDateSelect,
  completedWorkoutDays,
  pausedWorkoutDays,
  embedded = false,
  initialSelectedDate,
  _cycleProgress,
}: MyPlanCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate || new Date());
  const [markedDates, setMarkedDates] = useState<{ [key: string]: MarkedDateInfo }>({});
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    // Always start with the current week (Sunday to Saturday)
    return startOfWeek(new Date(), { weekStartsOn: 0 });
  });

  // Use ref to track if we've already auto-selected today's date
  const hasAutoSelectedToday = useRef(false);

  // Use actual completion data from parent component
  const finalCompletedDays = completedWorkoutDays;
  const finalPausedDays = pausedWorkoutDays;

  // Memoize weekDays to prevent unnecessary recalculations
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(currentWeekStart, i));
    }
    return days;
  }, [currentWeekStart]);

  // Setup calendar marked dates based on workout frequency and user preferences
  const setupCalendarDates = useCallback(
    (startDate: string, totalDays: number) => {
      if (userWorkoutDays.length === 0) return;

      // Use the new progressive calendar system
      const markedDatesObj = workoutPlanService.setupCalendarDatesProgressive(
        startDate,
        totalDays,
        userWorkoutDays,
        { primary: COLORS.primary },
      );

      setMarkedDates(markedDatesObj);
    },
    [userWorkoutDays.join(',')],
  );

  // Handle date selection on calendar
  const handleDateSelect = useCallback(
    async (day: Date) => {
      setSelectedDate(day);

      // Find the workout day that corresponds to this date
      if (plan) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const markedDateInfo = markedDates[dateStr];

        if (markedDateInfo && markedDateInfo.marked) {
          // This is a workout day - get the workout day index from the marked date
          const workoutDayIndex = markedDateInfo.workoutDayIndex;

          onDateSelect(day, workoutDayIndex, true);
        } else {
          // Not a workout day
          onDateSelect(day, null, false);
        }
      } else {
        // No plan available, just call onDateSelect with no workout day
        onDateSelect(day, null, false);
      }
    },
    [plan, markedDates, onDateSelect],
  );

  // Function to get day abbreviation
  const getDayAbbreviation = (date: Date) => {
    const dayOfWeek = getDay(date);
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
      return;
    }

    await handleDateSelect(date);
  };

  // Navigation functions
  const goToPreviousWeek = () => {
    setCurrentWeekStart((prev) => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart((prev) => addDays(prev, 7));
  };

  const goToCurrentWeek = () => {
    const today = new Date();
    setCurrentWeekStart(startOfWeek(today, { weekStartsOn: 0 }));

    // Also select today's date and trigger proper date selection
    setSelectedDate(today);
    handleDateSelect(today);
  };

  // Function to find next workout day
  const findNextWorkoutDay = () => {
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
        break;
      }
    }
  };

  // Function to find previous workout day
  const findPreviousWorkoutDay = () => {
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
        break;
      }
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
      <View style={styles.weekDaysRow}>
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
      </View>
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
