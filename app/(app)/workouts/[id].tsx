import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Card, useTheme, ActivityIndicator, Snackbar, FAB } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Workout } from '../../types/workout';
import { Exercise } from '../../types/exercise';
import { workoutService } from '../../services/workoutService';
import { exerciseService } from '../../services/exerciseService';

const WorkoutDetailScreen = () => {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  useEffect(() => {
    loadWorkout();
  }, [id]);

  const loadWorkout = async () => {
    try {
      setIsLoading(true);
      const data = await workoutService.getWorkoutById(id);
      if (!data) {
        setError('Workout not found');
        setSnackbarVisible(true);
        router.back();
        return;
      }
      setWorkout(data);

      // Load exercise details
      const exerciseDetails: Record<string, Exercise> = {};
      for (const exercise of data.exercises) {
        const exerciseData = await exerciseService.getExerciseById(exercise.exerciseId);
        if (exerciseData) {
          exerciseDetails[exercise.exerciseId] = exerciseData;
        }
      }
      setExercises(exerciseDetails);
    } catch (err) {
      setError('Error loading workout');
      setSnackbarVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSet = async (exerciseId: string) => {
    try {
      if (!workout) return;

      const newSet = {
        exerciseId,
        reps: 0,
        weight: 0,
      };

      const updatedWorkout = await workoutService.addSetToExercise(
        workout.id,
        exerciseId,
        newSet
      );

      setWorkout(updatedWorkout);
    } catch (err) {
      setError('Error adding set');
      setSnackbarVisible(true);
    }
  };

  const handleAddExercise = () => {
    router.push(`/workouts/${id}/add-exercise`);
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
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
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
          {workout.notes && (
            <Text variant="bodyMedium" style={styles.notes}>
              {workout.notes}
            </Text>
          )}
        </View>

        <View style={styles.exercisesContainer}>
          {workout.exercises.map((exercise) => {
            const exerciseDetails = exercises[exercise.exerciseId];
            if (!exerciseDetails) return null;

            return (
              <Card key={exercise.id} style={styles.exerciseCard}>
                <Card.Content>
                  <Text variant="titleMedium">{exerciseDetails.name}</Text>
                  <Text variant="bodySmall" style={styles.exerciseCategory}>
                    {exerciseDetails.category}
                  </Text>

                  <View style={styles.setsContainer}>
                    {exercise.sets.map((set, index) => (
                      <View key={set.id} style={styles.setItem}>
                        <Text variant="bodyMedium">Set {index + 1}</Text>
                        <Text variant="bodyMedium">
                          {set.reps} reps × {set.weight} kg
                        </Text>
                      </View>
                    ))}
                  </View>

                  <Button
                    mode="outlined"
                    onPress={() => handleAddSet(exercise.id)}
                    style={styles.addSetButton}
                  >
                    Add Set
                  </Button>
                </Card.Content>
              </Card>
            );
          })}
        </View>
      </ScrollView>

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={handleAddExercise}
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
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
  },
  title: {
    marginBottom: 8,
  },
  date: {
    color: '#666',
    marginBottom: 4,
  },
  duration: {
    color: '#666',
    marginBottom: 4,
  },
  notes: {
    marginTop: 8,
    color: '#666',
  },
  exercisesContainer: {
    padding: 16,
  },
  exerciseCard: {
    marginBottom: 16,
  },
  exerciseCategory: {
    color: '#666',
    marginTop: 4,
  },
  setsContainer: {
    marginTop: 16,
  },
  setItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  addSetButton: {
    marginTop: 16,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default WorkoutDetailScreen; 