import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { COLORS } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MenuHeader } from '../components/MenuHeader';

interface SingleWorkoutScreenProps {
  embedded?: boolean;
}

export default function SingleWorkoutScreen({ embedded = false }: SingleWorkoutScreenProps) {
  return (
    <View style={styles.container}>
      {!embedded && <MenuHeader currentOption="Single Workout" />}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.workoutTypeHeader}>
          <Button
            mode="outlined"
            icon="refresh"
            style={styles.actionButton}
            textColor={COLORS.text}
            onPress={() => {}}>
            Refresh
          </Button>
          <Button
            mode="outlined"
            icon="dumbbell"
            style={styles.actionButton}
            textColor={COLORS.text}
            onPress={() => {}}>
            Muscles
          </Button>
          <Button
            mode="outlined"
            icon="clock-outline"
            style={styles.actionButton}
            textColor={COLORS.text}
            onPress={() => {}}>
            Duration
          </Button>
        </View>

        <View style={styles.workoutHeader}>
          <Text style={styles.workoutTitle}>Full Body Workout</Text>
          <Text style={styles.subtitleText}>Intermediate Level</Text>
        </View>

        <View style={styles.workoutStats}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="lightning-bolt" size={24} color={COLORS.primary} />
            <Text style={styles.statText}>8 Exercises</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="clock-outline" size={24} color={COLORS.primary} />
            <Text style={styles.statText}>45 Min</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="fire" size={24} color={COLORS.primary} />
            <Text style={styles.statText}>400 Cal</Text>
          </View>
        </View>

        <Button
          mode="contained"
          style={styles.startButton}
          labelStyle={styles.startButtonLabel}
          onPress={() => {}}>
          START WORKOUT
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
  },
  workoutTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    borderColor: COLORS.primary,
  },
  workoutHeader: {
    marginBottom: 20,
  },
  workoutTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitleText: {
    color: COLORS.secondary,
    fontSize: 16,
  },
  workoutStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    color: COLORS.text,
    marginLeft: 8,
    fontSize: 16,
  },
  startButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  startButtonLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 