import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Divider } from 'react-native-paper';
import { COLORS, SPACING } from '../../../constants/theme';

interface WorkoutHeaderProps {
  insets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  currentExerciseIndex: number;
  totalExercises: number;
  cycleWeek: number;
  weekName: string;
  onBackPress: () => void;
  onExerciseListPress: () => void;
}

export default function WorkoutHeader({
  insets,
  currentExerciseIndex,
  totalExercises,
  cycleWeek,
  weekName,
  onBackPress,
  onExerciseListPress,
}: WorkoutHeaderProps) {
  return (
    <>
      {/* Header */}
      <View style={[styles.headerContainer, { marginTop: insets.top }]}>
        <TouchableOpacity onPress={onBackPress} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Exit</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            EXERCISE {currentExerciseIndex + 1}/{totalExercises}
          </Text>
          <Text style={styles.weekIndicator}>
            Week {cycleWeek}: {weekName}
          </Text>
        </View>

        <TouchableOpacity style={styles.headerButton} onPress={onExerciseListPress}>
          <Text style={styles.headerButtonText}>Exercises</Text>
        </TouchableOpacity>
      </View>

      <Divider style={styles.divider} />
    </>
  );
}

const styles = {
  headerContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: SPACING.md,
    height: 50,
    backgroundColor: COLORS.background,
  },
  headerButton: {
    padding: SPACING.xs,
  },
  headerButtonText: {
    color: COLORS.text,
    fontSize: 16,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingLeft: SPACING.xl,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold' as const,
    marginLeft: SPACING.sm,
  },
  weekIndicator: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 2,
    textAlign: 'center' as const,
  },
  divider: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    height: 1,
  },
};
