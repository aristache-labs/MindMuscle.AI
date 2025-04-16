import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Text, Button, Chip, useTheme, ActivityIndicator, Snackbar } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Exercise } from '../../types/exercise';
import { exerciseService } from '../../services/exerciseService';

const ExerciseDetailScreen = () => {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  useEffect(() => {
    loadExercise();
  }, [id]);

  const loadExercise = async () => {
    try {
      setIsLoading(true);
      const data = await exerciseService.getExerciseById(id);
      if (!data) {
        setError('Exercise not found');
        setSnackbarVisible(true);
        router.back();
        return;
      }
      setExercise(data);
    } catch (err) {
      setError('Error loading exercise');
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

  if (!exercise) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {exercise.imageUrl && (
          <Image
            source={{ uri: exercise.imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        )}
        
        <View style={styles.content}>
          <Text variant="headlineMedium" style={styles.title}>
            {exercise.name}
          </Text>

          <View style={styles.chipsContainer}>
            <Chip style={styles.chip}>{exercise.category}</Chip>
            <Chip style={styles.chip}>{exercise.equipment}</Chip>
            <Chip style={styles.chip}>{exercise.difficulty}</Chip>
          </View>

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Description
          </Text>
          <Text variant="bodyMedium" style={styles.description}>
            {exercise.description}
          </Text>

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Instructions
          </Text>
          {exercise.instructions.map((instruction, index) => (
            <View key={index} style={styles.instructionItem}>
              <Text variant="titleSmall" style={styles.instructionNumber}>
                {index + 1}.
              </Text>
              <Text variant="bodyMedium" style={styles.instructionText}>
                {instruction}
              </Text>
            </View>
          ))}

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Target Muscles
          </Text>
          <View style={styles.musclesContainer}>
            {exercise.muscles.map((muscle, index) => (
              <Chip key={index} style={styles.muscleChip}>
                {muscle}
              </Chip>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={() => router.push(`/workout/new?exerciseId=${id}`)}
          style={styles.addButton}
        >
          Add to Workout
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 250,
  },
  content: {
    padding: 16,
  },
  title: {
    marginBottom: 16,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  chip: {
    marginRight: 8,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
  },
  description: {
    marginBottom: 16,
    lineHeight: 24,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  instructionNumber: {
    marginRight: 8,
    color: '#666',
  },
  instructionText: {
    flex: 1,
    lineHeight: 24,
  },
  musclesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  muscleChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  addButton: {
    width: '100%',
  },
});

export default ExerciseDetailScreen; 