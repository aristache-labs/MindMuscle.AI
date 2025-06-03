import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Surface, Chip } from 'react-native-paper';
import { COLORS } from '../../constants/theme';

const TIME_FILTERS = [
  { label: '1w', value: '1w' },
  { label: '1m', value: '1m' },
  { label: '3m', value: '3m' },
  { label: '6m', value: '6m' },
  { label: '1y', value: '1y' },
];

interface StatsOverviewProps {
  selectedFilter: string;
  onFilterChange: (filter: string) => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ selectedFilter, onFilterChange }) => {
  return (
    <Surface style={styles.combinedStatsContainer} elevation={2}>
      {/* Time Filters */}
      <View style={styles.filterContainer}>
        {TIME_FILTERS.map((filter) => (
          <Chip
            key={filter.value}
            selected={selectedFilter === filter.value}
            onPress={() => onFilterChange(filter.value)}
            style={[
              styles.filterChip,
              selectedFilter === filter.value && { backgroundColor: COLORS.primary },
            ]}
            textStyle={[
              styles.filterChipText,
              selectedFilter === filter.value && { color: '#fff' },
            ]}
          >
            {filter.label}
          </Chip>
        ))}
      </View>

      <View style={styles.statsDivider} />

      {/* Stats Overview */}
      <View style={styles.statsOverview}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>12</Text>
          <Text style={styles.statLabel}>Number of{'\n'}Workouts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>11</Text>
          <Text style={styles.statLabel}>Hours at{'\n'}the Gym</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>32.9K</Text>
          <Text style={styles.statLabel}>Total Weight{'\n'}Lifted (kg)</Text>
        </View>
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  combinedStatsContainer: {
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
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statsDivider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 16,
  },
  statsOverview: {
    flexDirection: 'row',
  },
  filterChip: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    minWidth: 50,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.text,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#333',
    marginHorizontal: 8,
  },
});
export default function DebugHelpers() {
  return null;
}
