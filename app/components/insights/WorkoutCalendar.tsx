import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Surface } from 'react-native-paper';
import { Calendar } from 'react-native-calendars';
import { format, addMonths } from 'date-fns';
import { router } from 'expo-router';
import { COLORS } from '../../constants/theme';
import * as Sentry from '@sentry/react-native';
import { captureUIError, SentryReactProfiler } from '../../services/sentry';
import { useAuth } from '../../store/AuthContext';
import { useWorkoutCalendarData } from '../../hooks/useWorkoutCalendarData';
import { AnimatedWorkoutDot } from './AnimatedWorkoutDot';

interface WorkoutCalendarProps {
  calendarDate: Date;
  calendarKey: number;
  onMonthChange: (date: { timestamp: number }) => void;
  onTodayPress: () => void;
}

const WorkoutCalendarComponent: React.FC<WorkoutCalendarProps> = ({
  calendarDate,
  calendarKey,
  onMonthChange,
  onTodayPress,
}) => {
  const { user } = useAuth();
  const { workoutDates, loading, error } = useWorkoutCalendarData(calendarDate, user?.id);
  const today = new Date();
  const minDate = format(today, 'yyyy-MM-dd');
  const maxDate = format(addMonths(today, 12), 'yyyy-MM-dd');

  // Track component lifecycle and calendar state
  useEffect(() => {
    // Track component mount and calendar state
    Sentry.addBreadcrumb({
      message: 'Workout Calendar Section Rendered',
      category: 'ui.render',
      level: 'info',
      data: {
        currentDate: format(calendarDate, 'yyyy-MM-dd'),
        calendarKey,
        minDate,
        maxDate,
        timestamp: new Date().toISOString(),
        has_user: !!user?.id,
        workout_data_loading: loading,
        workout_data_error: !!error,
      },
    });

    // Track component lifecycle
    SentryReactProfiler.trackComponentLifecycle('WorkoutCalendar', 'mount');

    return () => {
      SentryReactProfiler.trackComponentLifecycle('WorkoutCalendar', 'unmount');
    };
  }, []);

  // Track calendar date changes
  useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'Calendar Date Updated',
      category: 'ui.update',
      level: 'info',
      data: {
        newDate: format(calendarDate, 'yyyy-MM-dd'),
        calendarKey,
        timestamp: new Date().toISOString(),
      },
    });
  }, [calendarDate, calendarKey]);

  const handleMonthChange = (date: { timestamp: number }) => {
    try {
      const newDate = new Date(date.timestamp);

      // Track month navigation attempt
      Sentry.addBreadcrumb({
        message: 'Calendar Month Change Started',
        category: 'user.interaction',
        level: 'info',
        data: {
          previousMonth: format(calendarDate, 'yyyy-MM'),
          newMonth: format(newDate, 'yyyy-MM'),
          timestamp: new Date().toISOString(),
        },
      });

      onMonthChange(date);

      // Track successful month change
      Sentry.addBreadcrumb({
        message: 'Calendar Month Changed Successfully',
        category: 'user.success',
        level: 'info',
        data: {
          appliedMonth: format(newDate, 'yyyy-MM'),
          navigationDirection: newDate > calendarDate ? 'forward' : 'backward',
        },
      });
    } catch (error) {
      // Capture month change errors
      captureUIError(error as Error, 'WorkoutCalendar.handleMonthChange', 'insights-calendar');

      Sentry.addBreadcrumb({
        message: 'Calendar Month Change Failed',
        category: 'user.error',
        level: 'error',
        data: {
          error: (error as Error).message,
          attemptedTimestamp: date.timestamp,
          currentMonth: format(calendarDate, 'yyyy-MM'),
        },
      });

      console.error('Month change error:', error);
    }
  };

  const handleTodayPress = () => {
    try {
      // Track today button press
      Sentry.addBreadcrumb({
        message: 'Today Button Pressed',
        category: 'user.interaction',
        level: 'info',
        data: {
          currentDate: format(calendarDate, 'yyyy-MM-dd'),
          todayDate: format(today, 'yyyy-MM-dd'),
          isAlreadyToday: format(calendarDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'),
          timestamp: new Date().toISOString(),
        },
      });

      onTodayPress();

      // Track successful today navigation
      Sentry.addBreadcrumb({
        message: 'Today Navigation Successful',
        category: 'user.success',
        level: 'info',
        data: {
          navigatedToToday: true,
          action: 'today_button_success',
        },
      });
    } catch (error) {
      // Capture today press errors
      captureUIError(error as Error, 'WorkoutCalendar.handleTodayPress', 'insights-calendar');

      Sentry.addBreadcrumb({
        message: 'Today Button Press Failed',
        category: 'user.error',
        level: 'error',
        data: {
          error: (error as Error).message,
          currentDate: format(calendarDate, 'yyyy-MM-dd'),
        },
      });

      console.error('Today press error:', error);
    }
  };

  const handleDayPress = (day: { dateString: string }) => {
    try {
      // Track day selection
      Sentry.addBreadcrumb({
        message: 'Calendar Day Pressed',
        category: 'user.interaction',
        level: 'info',
        data: {
          selectedDate: day.dateString,
          currentMonth: format(calendarDate, 'yyyy-MM'),
          isToday: day.dateString === format(today, 'yyyy-MM-dd'),
          timestamp: new Date().toISOString(),
        },
      });

      // Check if this date has a completed workout
      const hasWorkout = workoutDates[day.dateString]?.completed;

      console.log(
        'Day pressed:',
        day.dateString,
        'hasWorkout:',
        hasWorkout,
        'workoutDates:',
        workoutDates,
      );

      if (hasWorkout) {
        console.log('Navigating to workout details for date:', day.dateString);
        // Navigate to workout details page
        router.push({
          pathname: '/(stack)/workout-details',
          params: { date: day.dateString },
        });

        Sentry.addBreadcrumb({
          message: 'Navigating to workout details',
          category: 'navigation',
          level: 'info',
          data: {
            selectedDate: day.dateString,
            hasWorkout: true,
          },
        });
      }

      Sentry.addBreadcrumb({
        message: 'Day Press Handled',
        category: 'user.success',
        level: 'info',
        data: {
          selectedDate: day.dateString,
          action: hasWorkout ? 'navigate_to_workout_details' : 'day_press_tracked',
          hasWorkout,
        },
      });
    } catch (error) {
      // Capture day press errors
      captureUIError(error as Error, 'WorkoutCalendar.handleDayPress', 'insights-calendar');

      Sentry.addBreadcrumb({
        message: 'Day Press Handler Failed',
        category: 'user.error',
        level: 'error',
        data: {
          error: (error as Error).message,
          attemptedDate: day.dateString,
        },
      });

      console.error('Day press error:', error);
    }
  };

  return (
    <Surface style={styles.calendarContainer} elevation={2}>
      <View style={styles.calendarHeader}>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <Pressable
            onPress={handleTodayPress}
            style={({ pressed }) => [
              styles.todayButtonContainer,
              pressed && styles.todayButtonPressed,
            ]}
          >
            <Text style={styles.todayButton}>Today</Text>
          </Pressable>
        </View>
        <Text style={[styles.sectionTitle, { flex: 1 }]}>YOUR WORKOUTS</Text>
        <View style={{ flex: 1 }} />
      </View>
      <Calendar
        key={calendarKey}
        current={format(calendarDate, 'yyyy-MM-dd')}
        minDate={minDate}
        maxDate={maxDate}
        onMonthChange={handleMonthChange}
        dayComponent={({ date, state }) => {
          if (!date) return null;

          const dateString = date.dateString;
          const hasWorkout = workoutDates[dateString]?.completed;
          const isToday = dateString === format(today, 'yyyy-MM-dd');
          const isDisabled = state === 'disabled';

          return (
            <Pressable style={styles.dayContainer} onPress={() => handleDayPress({ dateString })}>
              <Text
                style={[
                  styles.dayText,
                  isToday && styles.todayText,
                  isDisabled && styles.disabledText,
                  hasWorkout && styles.workoutDayText,
                ]}
              >
                {date.day}
              </Text>
              {hasWorkout && (
                <AnimatedWorkoutDot size={8} color={COLORS.primary} pulseEnabled={true} />
              )}
            </Pressable>
          );
        }}
        enableSwipeMonths={true}
        hideExtraDays={true}
        theme={{
          backgroundColor: 'transparent',
          calendarBackground: 'transparent',
          textSectionTitleColor: COLORS.onSurface,
          selectedDayBackgroundColor: COLORS.primary,
          selectedDayTextColor: '#fff',
          todayTextColor: COLORS.primary,
          dayTextColor: COLORS.onSurface,
          textDisabledColor: COLORS.disabled,
          dotColor: COLORS.primary,
          monthTextColor: COLORS.onSurface,
          textDayFontSize: 16,
          textMonthFontSize: 18,
          textDayHeaderFontSize: 14,
          todayButtonFontFamily: 'System',
          textDayFontWeight: '400',
          todayButtonFontSize: 24,
          arrowColor: COLORS.primary,
        }}
      />
    </Surface>
  );
};

// Export the component wrapped with Sentry profiler
export const WorkoutCalendar = SentryReactProfiler.withProfiler(
  WorkoutCalendarComponent as React.ComponentType<unknown>,
  'WorkoutCalendar',
) as React.FC<WorkoutCalendarProps>;

const styles = StyleSheet.create({
  calendarContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  todayButtonContainer: {
    padding: 8,
    borderRadius: 8,
  },
  todayButtonPressed: {
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
  },
  todayButton: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  dayContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    position: 'relative',
  },
  dayText: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.text,
  },
  todayText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  disabledText: {
    color: COLORS.disabled,
  },
  workoutDayText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default function DebugHelpers() {
  return null;
}
