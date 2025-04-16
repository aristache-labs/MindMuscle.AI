import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput, Button, useTheme, ActivityIndicator, Snackbar } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WorkoutSet } from '../../../types/workout';
import { workoutService } from '../../../services/workoutService';

const EditSetScreen = () => {
  const theme = useTheme();
  const { id, exerciseId, setId } = useLocalSearchParams<{ id: string; exerciseId: string; setId: string }>();
  const [set, setSet] = useState<WorkoutSet | null>(null);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  useEffect(() => {
    loadSet();
  }, []);

  const loadSet = async () => {
    try {
      setIsLoading(true);
      const workout = await workoutService.getWorkoutById(id);
      if (!workout) {
        throw new Error('Workout not found');
      }

      const exercise = workout.exercises.find(e => e.id === exerciseId);
      if (!exercise) {
        throw new Error('Exercise not found');
      }

      const setData = exercise.sets.find(s => s.id === setId);
      if (!setData) {
        throw new Error('Set not found');
      }

      setSet(setData);
      setReps(setData.reps.toString());
      setWeight(setData.weight.toString());
      setNotes(setData.notes || '');
    } catch (err) {
      setError('Error loading set');
      setSnackbarVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!set) return;

    try {
      setIsSubmitting(true);
      const updatedSet = {
        ...set,
        reps: parseInt(reps, 10),
        weight: parseFloat(weight),
        notes: notes.trim() || undefined,
      };

      await workoutService.updateSet(id, exerciseId, setId, updatedSet);
      router.back();
    } catch (err) {
      setError('Error updating set');
      setSnackbarVisible(true);
    } finally {
      setIsSubmitting(false);
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.content}>
          <Text variant="headlineMedium" style={styles.title}>
            Edit Set
          </Text>

          <TextInput
            label="Reps"
            value={reps}
            onChangeText={setReps}
            keyboardType="numeric"
            style={styles.input}
          />

          <TextInput
            label="Weight (kg)"
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
            style={styles.input}
          />

          <TextInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            style={styles.input}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.submitButton}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Save Changes
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
});

export default EditSetScreen; 