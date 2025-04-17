import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Text, Searchbar, Card, FAB, useTheme, Snackbar } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Exercise as ExerciseType } from '../../types/exercise';
import { exerciseService } from '../../services/exerciseService';
import { COLORS, SPACING } from '../../constants/theme';

// TODO: Replace with actual exercise type
type Exercise = {
  id: string;
  name: string;
  category: string;
  equipment: string;
  difficulty: string;
};

const ExercisesScreen = () => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  useEffect(() => {
    loadExercises();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const searchExercises = async () => {
        try {
          const results = await exerciseService.searchExercises(searchQuery);
          setFilteredExercises(results);
        } catch (err) {
          setError('Error searching exercises');
          setSnackbarVisible(true);
        }
      };
      searchExercises();
    } else {
      setFilteredExercises(exercises);
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

  const onChangeSearch = (query: string) => setSearchQuery(query);

  const renderExerciseItem = ({ item }: { item: Exercise }) => (
    <Card
      style={styles.card}
      onPress={() => router.push(`/exercises/${item.id}`)}
    >
      <Card.Content>
        <Text variant="titleMedium">{item.name}</Text>
        <Text variant="bodyMedium" style={styles.category}>
          {item.category}
        </Text>
        <View style={styles.tagsContainer}>
          <Text variant="labelSmall" style={styles.tag}>
            {item.equipment}
          </Text>
          <Text variant="labelSmall" style={styles.tag}>
            {item.difficulty}
          </Text>
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
          Exercises Library
        </Text>
        <Searchbar
          placeholder="Search exercises..."
          onChangeText={onChangeSearch}
          value={searchQuery}
          style={styles.searchBar}
        />
      </View>

      {filteredExercises.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text variant="bodyLarge">No exercises found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredExercises}
          renderItem={renderExerciseItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => router.push('/exercises/new')}
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
  searchBar: {
    marginBottom: SPACING.sm,
  },
  listContainer: {
    padding: SPACING.lg,
  },
  card: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  category: {
    marginTop: SPACING.xs,
    color: COLORS.text,
    opacity: 0.7,
  },
  tagsContainer: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  tag: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: SPACING.xs,
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
  },
});

export default ExercisesScreen; 