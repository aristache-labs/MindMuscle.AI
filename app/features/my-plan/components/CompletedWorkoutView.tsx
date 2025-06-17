import React from 'react';
import { View, Text } from 'react-native';
import { Button } from 'react-native-paper';
import { CompletedWorkoutData, WorkoutDay } from '../types';
import { formatDurationAsHMM } from '../utils';
import { styles } from '../styles';

interface CompletedWorkoutViewProps {
  completedWorkoutData: CompletedWorkoutData | null;
  workoutDay: WorkoutDay | null;
  onRedoWorkout: () => void;
}

const CompletedWorkoutView: React.FC<CompletedWorkoutViewProps> = ({
  completedWorkoutData,
  workoutDay,
  onRedoWorkout,
}) => {
  if (!completedWorkoutData || !workoutDay) return null;

  return (
    <View style={styles.completedWorkoutContainer}>
      {/* Workout Week/Cycle Info - Centered */}
      <View style={styles.completedWorkoutHeader}>
        <Text style={styles.completedWorkoutTitle}>
          Week {completedWorkoutData.cycleWeek || 1}/5 -{' '}
          {completedWorkoutData.weekName || 'Adaptation'}
        </Text>
      </View>

      {/* Modern Completed Banner */}
      <View style={styles.completionBanner}>
        <Text style={styles.completionBannerText}>WORKOUT COMPLETED</Text>
      </View>

      {/* Workout Stats */}
      <View style={styles.completionStatsRow}>
        <View style={[styles.completionStatItem, styles.leftStatItem]}>
          <Text style={styles.completionStatValue}>
            {completedWorkoutData.completedExercises || 0}
          </Text>
          <Text style={styles.completionStatLabel}>EXERCISES DONE</Text>
        </View>

        {/* Vertical Divider */}
        <View style={styles.statDivider} />

        <View style={[styles.completionStatItem, styles.centerStatItem]}>
          <Text style={[styles.completionStatValue, styles.timeValue]} numberOfLines={1}>
            {formatDurationAsHMM(completedWorkoutData.duration || '0:00:00')}
          </Text>
          <Text style={styles.completionStatLabel}>WORKOUT TIME</Text>
        </View>

        {/* Vertical Divider */}
        <View style={styles.statDivider} />

        <View style={[styles.completionStatItem, styles.rightStatItem]}>
          <Text style={styles.completionStatValue}>{completedWorkoutData.caloriesBurned || 0}</Text>
          <Text style={styles.completionStatLabel}>CALORIES BURNED</Text>
        </View>
      </View>

      {/* Muscle Groups Worked Section */}
      <View style={styles.muscleGroupsSection}>
        <Text style={styles.muscleGroupsTitle}>MUSCLE GROUPS WORKED IN THIS WORKOUT</Text>

        <View style={styles.muscleGroupsLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#7B69EE' }]} />
            <Text style={styles.legendText}>Primary</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#CCCCCC' }]} />
            <Text style={styles.legendText}>Secondary</Text>
          </View>
        </View>

        {/* This would be replaced with your actual muscle visualization component */}
        <View style={styles.muscleVisualizationPlaceholder}>
          <Text style={styles.placeholderText}>Muscle visualization would go here</Text>
        </View>
      </View>

      {/* Redo Workout Button */}
      <Button
        mode="contained"
        style={styles.redoButton}
        labelStyle={styles.redoButtonText}
        onPress={onRedoWorkout}
      >
        REDO WORKOUT
      </Button>
    </View>
  );
};

export default CompletedWorkoutView;
