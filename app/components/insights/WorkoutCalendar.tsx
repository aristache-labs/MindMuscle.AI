import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Surface } from 'react-native-paper';
import { Calendar } from 'react-native-calendars';
import { format, addMonths } from 'date-fns';
import { COLORS } from '../../constants/theme';
import * as Sentry from '@sentry/react-native';
import { captureUIError, SentryReactProfiler } from '../../services/sentry';

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

      // Currently no action taken on day press, but tracking for future features
      Sentry.addBreadcrumb({
        message: 'Day Press Handled',
        category: 'user.success',
        level: 'info',
        data: {
          selectedDate: day.dateString,
          action: 'day_press_tracked',
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

  // Mark dates that have workouts
  const markedDates = {
    '2025-04-01': { marked: true, dotColor: COLORS.primary },
    '2025-04-02': { marked: true, dotColor: COLORS.primary },
    '2025-04-04': { marked: true, dotColor: COLORS.primary },
  };

  return (
    <Surface style={styles.calendarContainer} elevation={2}>
      <View style={styles.calendarHeader}>
        <View style={{ flex: 1 }}>
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
        <Text style={[styles.sectionTitle, { flex: 1, paddingRight: '20%' }]}>YOUR WORKOUTS</Text>
        <View style={{ flex: 1 }} />
      </View>
      <Calendar
        markingType="custom"
        key={calendarKey}
        current={format(calendarDate, 'yyyy-MM-dd')}
        minDate={minDate}
        maxDate={maxDate}
        onMonthChange={handleMonthChange}
        markedDates={{
          ...markedDates,
          [format(new Date(), 'yyyy-MM-dd')]: {
            customStyles: {
              container: {
                alignItems: 'center',
                justifyContent: 'center',
              },
              text: {
                fontSize: 20,
                fontWeight: '700',
                color: COLORS.primary,
              },
            },
          },
        }}
        enableSwipeMonths={true}
        hideExtraDays={true}
        onDayPress={handleDayPress}
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
});

export default function DebugHelpers() {
  return null;
}
