import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, Card, Button, Avatar, ProgressBar } from 'react-native-paper';
import { COLORS, SPACING } from '../constants/theme';

export default function HomeScreen() {
  // Mock data - replace with real data later
  const user = {
    name: 'John',
    streakDays: 5,
    todaysProgress: 0.6,
    nextWorkout: {
      name: 'Full Body Workout',
      duration: '45 min',
      difficulty: 'Intermediate',
    },
  };

  const featuredWorkouts = [
    {
      id: '1',
      name: 'Morning HIIT',
      duration: '30 min',
      difficulty: 'Advanced',
      image: 'https://example.com/workout1.jpg',
    },
    {
      id: '2',
      name: 'Core Strength',
      duration: '20 min',
      difficulty: 'Intermediate',
      image: 'https://example.com/workout2.jpg',
    },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Welcome Section */}
      <View style={styles.header}>
        <View style={styles.welcomeContainer}>
          <Text variant="headlineSmall" style={styles.welcomeText}>
            Welcome back, {user.name}! 👋
          </Text>
          <Avatar.Icon size={40} icon="bell" style={styles.notificationIcon} />
        </View>
        <Text variant="bodyLarge" style={styles.streakText}>
          🔥 {user.streakDays} day streak
        </Text>
      </View>

      {/* Today's Progress */}
      <Card style={styles.progressCard}>
        <Card.Content>
          <Text variant="titleMedium">Today's Progress</Text>
          <ProgressBar
            progress={user.todaysProgress}
            color={COLORS.primary}
            style={styles.progressBar}
          />
          <Text variant="bodyMedium" style={styles.progressText}>
            {Math.round(user.todaysProgress * 100)}% of daily goal completed
          </Text>
        </Card.Content>
      </Card>

      {/* Next Workout */}
      <Card style={styles.workoutCard}>
        <Card.Content>
          <Text variant="titleMedium">Next Workout</Text>
          <View style={styles.workoutInfo}>
            <View>
              <Text variant="bodyLarge">{user.nextWorkout.name}</Text>
              <Text variant="bodyMedium" style={styles.workoutMeta}>
                {user.nextWorkout.duration} • {user.nextWorkout.difficulty}
              </Text>
            </View>
            <Button mode="contained">Start</Button>
          </View>
        </Card.Content>
      </Card>

      {/* Featured Workouts */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium">Featured Workouts</Text>
          <Button mode="text">See All</Button>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {featuredWorkouts.map((workout) => (
            <Card key={workout.id} style={styles.featuredCard}>
              <Card.Cover source={{ uri: workout.image }} />
              <Card.Content>
                <Text variant="titleMedium">{workout.name}</Text>
                <Text variant="bodyMedium" style={styles.workoutMeta}>
                  {workout.duration} • {workout.difficulty}
                </Text>
              </Card.Content>
            </Card>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  welcomeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    color: COLORS.text,
  },
  notificationIcon: {
    backgroundColor: COLORS.surface,
  },
  streakText: {
    color: COLORS.text,
    marginTop: SPACING.xs,
    opacity: 0.7,
  },
  progressCard: {
    margin: SPACING.lg,
    marginTop: 0,
    backgroundColor: COLORS.surface,
  },
  progressBar: {
    marginVertical: SPACING.md,
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    color: COLORS.text,
    opacity: 0.7,
  },
  workoutCard: {
    margin: SPACING.lg,
    marginTop: 0,
    backgroundColor: COLORS.surface,
  },
  workoutInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  workoutMeta: {
    color: COLORS.text,
    opacity: 0.7,
    marginTop: SPACING.xs,
  },
  section: {
    padding: SPACING.lg,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  featuredCard: {
    width: 280,
    marginRight: SPACING.md,
    backgroundColor: COLORS.surface,
  },
}); 