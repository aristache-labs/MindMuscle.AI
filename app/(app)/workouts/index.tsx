import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, FAB, useTheme, ActivityIndicator, Snackbar } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Workout } from '../../types/workout';
import { workoutService } from '../../services/workoutService';
import { COLORS, SPACING } from '../../constants/theme';

const WorkoutsScreen = () => {
  const theme = useTheme();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  useEffect(() => {
    loadWorkouts();
  }, []);

  const loadWorkouts = async () => {
    try {
      setIsLoading(true);
      const data = await workoutService.getAllWorkouts();
      // Sort workouts by date in descending order
      const sortedWorkouts = data.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setWorkouts(sortedWorkouts);
    } catch (err) {
      setError('Error loading workouts');
      setSnackbarVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  const renderWorkoutItem = ({ item }: { item: Workout }) => (
    <Card
      style={styles.card}
      onPress={() => router.push(`/workouts/${item.id}`)}
    >
      <Card.Content>
        <Text variant="titleMedium">{item.name}</Text>
        <Text variant="bodyMedium" style={styles.date}>
          {format(new Date(item.date), 'PPP')}
        </Text>
        <View style={styles.statsContainer}>
          <Text variant="bodySmall" style={styles.stat}>
            {item.exercises.length} exercises
          </Text>
          {item.duration && (
            <Text variant="bodySmall" style={styles.stat}>
              {item.duration} minutes
            </Text>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Workouts
        </Text>
      </View>

      {workouts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text variant="bodyLarge">No workouts yet</Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Start tracking your workouts by creating a new one
          </Text>
        </View>
      ) : (
        <FlatList
          data={workouts}
          renderItem={renderWorkoutItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => router.push('/workouts/new')}
      />

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        action={{
          label: 'Dismiss',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {error}
      </Snackbar>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SPACING.lg,
  },
  title: {
    marginBottom: SPACING.md,
  },
  listContainer: {
    padding: SPACING.lg,
  },
  card: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  date: {
    marginTop: SPACING.xs,
    color: COLORS.text,
    opacity: 0.7,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    gap: SPACING.md,
  },
  stat: {
    color: COLORS.text,
    opacity: 0.7,
  },
  fab: {
    position: 'absolute',
    margin: SPACING.lg,
    right: 0,
    bottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  emptyText: {
    marginTop: SPACING.sm,
    textAlign: 'center',
    color: COLORS.text,
    opacity: 0.7,
  },
});

export default WorkoutsScreen; 