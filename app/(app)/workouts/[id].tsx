import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, useTheme, ActivityIndicator, Snackbar } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Workout } from '../../types/workout';
import { workoutService } from '../../services/workoutService';
import { COLORS, SPACING } from '../../constants/theme';

const WorkoutDetailsScreen = () => {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  useEffect(() => {
    if (id) {
      loadWorkout();
    }
  }, [id]);

  const loadWorkout = async () => {
    try {
      setIsLoading(true);
      const data = await workoutService.getWorkoutById(id);
      setWorkout(data);
    } catch (err) {
      setError('Error loading workout');
      setSnackbarVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!workout) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text variant="bodyLarge">Workout not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            {workout.name}
          </Text>
          <Text variant="bodyMedium" style={styles.date}>
            {format(new Date(workout.date), 'PPP')}
          </Text>
          {workout.duration && (
            <Text variant="bodyMedium" style={styles.duration}>
              Duration: {workout.duration} minutes
            </Text>
          )}
        </View>

        <View style={styles.exercisesContainer}>
          {workout.exercises.map((exercise) => (
            <Card key={exercise.id} style={styles.exerciseCard}>
              <Card.Content>
                <Text variant="titleMedium">{exercise.name}</Text>
                {exercise.sets.map((set, index) => (
                  <View key={index} style={styles.setContainer}>
                    <Text variant="bodyMedium">
                      Set {index + 1}: {set.reps} reps × {set.weight} kg
                    </Text>
                  </View>
                ))}
              </Card.Content>
            </Card>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={() => router.push(`/workouts/${id}/add-exercise`)}
          style={styles.addButton}
        >
          Add Exercise
        </Button>
      </View>

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
  scrollView: {
    flex: 1,
  },
  header: {
    padding: SPACING.lg,
  },
  title: {
    marginBottom: SPACING.xs,
  },
  date: {
    marginBottom: SPACING.xs,
    color: COLORS.text,
    opacity: 0.7,
  },
  duration: {
    color: COLORS.text,
    opacity: 0.7,
  },
  exercisesContainer: {
    padding: SPACING.lg,
  },
  exerciseCard: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  setContainer: {
    marginTop: SPACING.sm,
  },
  footer: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.surface,
  },
  addButton: {
    width: '100%',
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
});

export default WorkoutDetailsScreen; 