import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, Card, ProgressBar, Button, IconButton } from 'react-native-paper';
import { useProgress } from '../store/ProgressContext';
import { useProfile } from '../store/ProfileContext';
import { useAuth } from '../store/AuthContext';
import { COLORS, SPACING } from '../constants/theme';
import { router } from 'expo-router';

export default function HomeScreen() {
  const { metrics } = useProgress();
  const { profile } = useProfile();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.welcomeContainer}>
          <Text variant="headlineMedium" style={styles.welcomeText}>
            Welcome, {profile?.name || 'User'}
          </Text>
          <View style={styles.headerButtons}>
            <IconButton
              icon="bell"
              mode="contained"
              containerColor={COLORS.surface}
              iconColor={COLORS.text}
              size={24}
              onPress={() => {}}
              style={styles.headerButton}
            />
            <IconButton
              icon="logout"
              mode="contained"
              containerColor={COLORS.surface}
              iconColor={COLORS.error}
              size={24}
              onPress={handleLogout}
              style={styles.headerButton}
            />
          </View>
        </View>
        <Text style={styles.streakText}>
          {metrics.streak} day streak! Keep it up!
        </Text>
      </View>

      <Card style={styles.progressCard}>
        <Card.Content>
          <Text variant="titleMedium">Your Progress</Text>
          <ProgressBar
            progress={0.7}
            color={COLORS.primary}
            style={styles.progressBar}
          />
          <Text style={styles.progressText}>
            {metrics.totalWorkouts} workouts completed
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.workoutCard}>
        <Card.Content>
          <Text variant="titleMedium">Today's Workout</Text>
          <View style={styles.workoutInfo}>
            <Text variant="bodyLarge">Full Body Strength</Text>
            <Text variant="bodyMedium">45 min</Text>
          </View>
          <Text style={styles.workoutMeta}>
            8 exercises • 3 sets each
          </Text>
          <Button
            mode="contained"
            style={{ marginTop: SPACING.md }}
            onPress={() => {}}
          >
            Start Workout
          </Button>
        </Card.Content>
      </Card>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="titleLarge">Featured Workouts</Text>
          <Button mode="text">See All</Button>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Card style={styles.featuredCard}>
            <Card.Cover source={{ uri: 'https://picsum.photos/700' }} />
            <Card.Content>
              <Text variant="titleMedium">Upper Body Blast</Text>
              <Text variant="bodyMedium">30 min • Intermediate</Text>
            </Card.Content>
          </Card>
          <Card style={styles.featuredCard}>
            <Card.Cover source={{ uri: 'https://picsum.photos/700' }} />
            <Card.Content>
              <Text variant="titleMedium">Core Crusher</Text>
              <Text variant="bodyMedium">20 min • Beginner</Text>
            </Card.Content>
          </Card>
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
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: SPACING.xs,
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