import React from 'react';
import { View, Text } from 'react-native';
import { IconButton } from 'react-native-paper';
import { COLORS } from '../../../constants/theme';
import { styles } from '../styles';

interface WorkoutStatsRowProps {
  exercises: number;
  duration: number;
  calories: number;
}

const WorkoutStatsRow: React.FC<WorkoutStatsRowProps> = ({ exercises, duration, calories }) => {
  return (
    <View style={styles.statsRow}>
      <View style={styles.statItem}>
        <IconButton icon="flash" size={16} iconColor={COLORS.primary} style={styles.statIcon} />
        <Text style={styles.statLabel}>{exercises} Exercises</Text>
      </View>
      <View style={styles.statItem}>
        <IconButton
          icon="clock-outline"
          size={16}
          iconColor={COLORS.primary}
          style={styles.statIcon}
        />
        <Text style={styles.statLabel}>{duration} Min</Text>
      </View>
      <View style={styles.statItem}>
        <IconButton icon="fire" size={16} iconColor={COLORS.primary} style={styles.statIcon} />
        <Text style={styles.statLabel}>{calories} Cal</Text>
      </View>
    </View>
  );
};

export default WorkoutStatsRow;
