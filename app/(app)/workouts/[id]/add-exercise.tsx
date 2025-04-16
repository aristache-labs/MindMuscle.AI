import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, Searchbar, useTheme, ActivityIndicator, Snackbar, Button } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Exercise } from '../../../types/exercise';
import { exerciseService } from '../../../services/exerciseService';
import { workoutService } from '../../../services/workoutService';

const AddExerciseScreen = () => {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('Invalid workout ID');
      setSnackbarVisible(true);
      return;
    }
    loadExercises();
  }, [id]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredExercises(exercises);
    } else {
      const filtered = exercises.filter(exercise =>
        exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exercise.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredExercises(filtered);
    }
  }, [searchQuery, exercises]);

  const loadExercises = async () => {
    try {
      setIsLoading(true);
      const data = await exerciseService.getAllExercises();
      setExercises(data);
      setFilteredExercises(data);
    } catch (err) {
      setError('Error loading exercises');
      setSnackbarVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExercise = async (exercise: Exercise) => {
    if (!id) {
      setError('Invalid workout ID');
      setSnackbarVisible(true);
      return;
    }

    try {
      await workoutService.addExerciseToWorkout(id, {
        exerciseId: exercise.id,
      });
      router.back();
    } catch (err) {
      setError('Error adding exercise to workout');
      setSnackbarVisible(true);
    }
  };

  const renderExerciseItem = ({ item }: { item: Exercise }) => (
    <Card
      style={styles.card}
      onPress={() => handleAddExercise(item)}
    >
      <Card.Content>
        <Text variant="titleMedium">{item.name}</Text>
        <Text variant="bodySmall" style={styles.category}>
          {item.category}
        </Text>
        {item.equipment && (
          <Text variant="bodySmall" style={styles.equipment}>
            Equipment: {item.equipment}
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  if (!id) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text variant="headlineSmall" style={styles.errorText}>
            Invalid workout ID
          </Text>
          <Button mode="contained" onPress={() => router.back()}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

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
          Add Exercise
        </Text>
        <Searchbar
          placeholder="Search exercises"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
      </View>

      {filteredExercises.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text variant="bodyLarge">No exercises found</Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Try adjusting your search
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredExercises}
          renderItem={renderExerciseItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}

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
    marginBottom: 16,
  },
  searchBar: {
    marginBottom: 16,
  },
  listContainer: {
    padding: 16,
  },
  card: {
    marginBottom: 12,
  },
  category: {
    color: '#666',
    marginTop: 4,
  },
  equipment: {
    color: '#666',
    marginTop: 4,
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
    padding: 16,
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    marginBottom: 16,
    textAlign: 'center',
  },
});

export default AddExerciseScreen; 