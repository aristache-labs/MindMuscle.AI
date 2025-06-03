import React from 'react';
import { View, Text } from 'react-native';
import { IconButton } from 'react-native-paper';
import { format, isSameDay } from 'date-fns';
import { COLORS } from '../../../constants/theme';
import { CycleProgress } from '../types';
import { styles } from '../styles';

interface WorkoutHeaderProps {
  selectedDate: Date;
  planSubtitle?: string;
  cycleProgress: CycleProgress | null;
  onPlanOverviewPress: () => void;
  onEditPlanPress: () => void;
}

const WorkoutHeader: React.FC<WorkoutHeaderProps> = ({
  selectedDate,
  planSubtitle,
  cycleProgress,
  onPlanOverviewPress,
  onEditPlanPress,
}) => {
  return (
    <View style={styles.todaysWorkoutHeader}>
      <View style={styles.workoutTitleRow}>
        <Text style={styles.todaysWorkoutTitle}>
          {isSameDay(selectedDate, new Date())
            ? "TODAY'S WORKOUT"
            : `${format(selectedDate, 'EEEE').toUpperCase()} WORKOUT`}
        </Text>
        <View style={styles.workoutHeaderIcons}>
          <IconButton
            icon="chart-timeline-variant"
            iconColor={COLORS.primary}
            size={24}
            onPress={onPlanOverviewPress}
            style={styles.headerIconButton}
          />
          <IconButton
            icon="pencil"
            iconColor={COLORS.primary}
            size={24}
            onPress={onEditPlanPress}
            style={styles.headerIconButton}
          />
        </View>
      </View>
      <Text style={styles.workoutName}>{planSubtitle || 'Unknown'}</Text>

      {/* Cycle Week Information */}
      {cycleProgress && (
        <View style={styles.cycleWeekContainer}>
          <View style={styles.cycleWeekCard}>
            {/* Header with Week Badge and Title */}
            <View style={styles.cycleCardHeader}>
              <View style={styles.cycleWeekBadge}>
                <Text style={styles.cycleWeekBadgeText}>W{cycleProgress.currentWeek}</Text>
                <Text style={styles.cycleWeekSubtext}>of 5</Text>
              </View>
              <View style={styles.cycleTitleSection}>
                <Text style={styles.cycleWeekName}>{cycleProgress.weekName}</Text>
                <Text style={styles.cyclePhaseLabel}>Training Phase</Text>
              </View>
            </View>

            {/* Description */}
            <Text style={styles.cycleWeekDescription}>{cycleProgress.weekDescription}</Text>

            {/* Progress Section */}
            <View style={styles.cycleProgressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Week Progress</Text>
                <View style={styles.progressStats}>
                  <Text style={styles.progressNumber}>{cycleProgress.completedWorkouts}</Text>
                  <Text style={styles.progressDivider}>/</Text>
                  <Text style={styles.progressTotal}>{cycleProgress.totalWorkoutsInCycle}</Text>
                  <Text style={styles.progressLabel}>workouts</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.cycleProgressBarContainer}>
                <View style={styles.cycleProgressBarTrack}>
                  <View
                    style={[
                      styles.cycleProgressBarFill,
                      { width: `${Math.min(100, cycleProgress.progressPercentage)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.cycleProgressPercentage}>
                  {Math.round(cycleProgress.progressPercentage)}%
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default WorkoutHeader;
