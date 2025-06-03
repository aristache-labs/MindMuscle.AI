import React from 'react';
import { View, Text } from 'react-native';
import { COLORS, SPACING } from '../../../constants/theme';

interface WorkoutTimerTabsProps {
  workoutDuration: number;
  totalVolume: number;
  totalReps: number;
  formatTime: (seconds: number) => string;
}

export default function WorkoutTimerTabs({
  workoutDuration,
  totalVolume,
  totalReps,
  formatTime,
}: WorkoutTimerTabsProps) {
  return (
    <View style={styles.tabContainer}>
      <View style={styles.tabItem}>
        <Text style={styles.tabText}>Time</Text>
        <Text style={styles.tabValueText}>{formatTime(workoutDuration)}</Text>
      </View>
      <View style={styles.tabItem}>
        <Text style={styles.tabText}>Volume</Text>
        <Text style={styles.tabValueText}>{totalVolume.toFixed(1)} kg</Text>
      </View>
      <View style={styles.tabItem}>
        <Text style={styles.tabText}>Reps</Text>
        <Text style={styles.tabValueText}>{totalReps}</Text>
      </View>
    </View>
  );
}

const styles = {
  tabContainer: {
    flexDirection: 'row' as const,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tabItem: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.1)',
  },
  tabText: {
    color: COLORS.secondary,
    fontSize: 14,
    marginBottom: 4,
  },
  tabValueText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold' as const,
  },
};
