import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput, Button, useTheme, Snackbar, ActivityIndicator } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { workoutService } from '../../services/workoutService';
import { exerciseService } from '../../services/exerciseService';
import { Exercise } from '../../types/exercise';

const NewWorkoutScreen = () => {
  const theme = useTheme();
  const { exerciseId } = useLocalSearchParams<{ exerciseId?: string }>();
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [initialExercise, setInitialExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    if (exerciseId) {
      loadInitialExercise();
    }
  }, [exerciseId]);

  const loadInitialExercise = async () => {
    try {
      const exercise = await exerciseService.getExerciseById(exerciseId);
      if (exercise) {
        setInitialExercise(exercise);
        setName(`${exercise.name} Workout`);
      }
    } catch (err) {
      setError('Error loading exercise');
      setSnackbarVisible(true);
    }
  };

  const validateForm = () => {
    if (!name.trim()) {
      setError('Workout name is required');
      return false;
    }
    if (!date) {
      setError('Date is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      setSnackbarVisible(true);
      return;
    }

    try {
      setIsSubmitting(true);
      
      const workout = await workoutService.createWorkout({
        name: name.trim(),
        date,
        duration: duration ? parseInt(duration, 10) : undefined,
        notes: notes.trim() || undefined,
        exercises: initialExercise ? [{
          exerciseId: initialExercise.id,
          sets: [],
        }] : [],
      });

      router.push(`/workouts/${workout.id}`);
    } catch (err) {
      setError('Error creating workout');
      setSnackbarVisible(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Creating workout...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.content}>
          <Text variant="headlineMedium" style={styles.title}>
            New Workout
          </Text>

          <TextInput
            label="Workout Name"
            value={name}
            onChangeText={setName}
            style={styles.input}
            error={!name.trim()}
          />

          <TextInput
            label="Date"
            value={date}
            onChangeText={setDate}
            style={styles.input}
            error={!date}
            keyboardType="default"
          />

          <TextInput
            label="Duration (minutes)"
            value={duration}
            onChangeText={setDuration}
            style={styles.input}
            keyboardType="numeric"
          />

          <TextInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            style={styles.input}
          />

          {initialExercise && (
            <View style={styles.initialExerciseContainer}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Initial Exercise
              </Text>
              <Text variant="bodyMedium">{initialExercise.name}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.submitButton}
          disabled={isSubmitting}
        >
          Create Workout
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
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
  },
  title: {
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  submitButton: {
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  initialExerciseContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
});

export default NewWorkoutScreen; 