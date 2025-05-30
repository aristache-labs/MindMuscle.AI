import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Surface } from 'react-native-paper';
import { Calendar } from 'react-native-calendars';
import { format, addMonths } from 'date-fns';
import { COLORS } from '../../constants/theme';

interface WorkoutCalendarProps {
  calendarDate: Date;
  calendarKey: number;
  onMonthChange: (date: { timestamp: number }) => void;
  onTodayPress: () => void;
}

export const WorkoutCalendar: React.FC<WorkoutCalendarProps> = ({
  calendarDate,
  calendarKey,
  onMonthChange,
  onTodayPress,
}) => {
  const today = new Date();
  const minDate = format(today, 'yyyy-MM-dd');
  const maxDate = format(addMonths(today, 12), 'yyyy-MM-dd');

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
            onPress={onTodayPress}
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
        onMonthChange={onMonthChange}
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
        onDayPress={(_day: { dateString: string }) => {}}
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
