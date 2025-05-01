import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MenuHeader } from '../components/MenuHeader';

interface MyPlanScreenProps {
  embedded?: boolean;
}

export default function MyPlanScreen({ embedded = false }: MyPlanScreenProps) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const currentDay = new Date().getDay(); // 0 is Sunday

  return (
    <View style={styles.container}>
      {!embedded && <MenuHeader currentOption="My Plan" />}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.calendarStrip}>
          {days.map((day, index) => {
            const isCurrentDay = (index + 1) % 7 === currentDay;
            return (
              <View
                key={day}
                style={[styles.dayItem, isCurrentDay && styles.currentDayItem]}
              >
                <Text style={[styles.dayText, isCurrentDay && styles.currentDayText]}>
                  {day}
                </Text>
                <View style={[styles.dayDot, isCurrentDay && styles.currentDayDot]} />
              </View>
            );
          })}
        </View>

        <View style={styles.workoutHeader}>
          <Text style={styles.weekText}>Week 1</Text>
          <Text style={styles.workoutTitle}>Full Body Workout</Text>
          <Text style={styles.subtitleText}>3 exercises • 40 min</Text>
        </View>

        <View style={styles.workoutStats}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="dumbbell" size={24} color={COLORS.text} />
            <Text style={styles.statText}>Strength</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="clock-outline" size={24} color={COLORS.text} />
            <Text style={styles.statText}>40 min</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="fire" size={24} color={COLORS.text} />
            <Text style={styles.statText}>350 cal</Text>
          </View>
        </View>
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
  calendarStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 20,
  },
  dayItem: {
    alignItems: 'center',
    padding: 8,
  },
  currentDayItem: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  dayText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  currentDayText: {
    color: '#FFFFFF',
  },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  currentDayDot: {
    backgroundColor: '#FFFFFF',
  },
  workoutHeader: {
    marginBottom: 20,
  },
  weekText: {
    color: COLORS.primary,
    fontSize: 16,
    marginBottom: 8,
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
}); 