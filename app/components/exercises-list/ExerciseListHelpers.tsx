import React from 'react';
import { View, Text } from 'react-native';
import { Exercise, ExerciseCategory } from '../../services/exerciseService';
import ExerciseCard from '../ExerciseCard';

// Fallback image object for exercises
const FALLBACK_IMAGE_OBJECT = { uri: null, testUri: 'dumbbell.jpg' };

// Category display names mapping
const CATEGORY_NAMES: Record<string, string> = {
  all: 'ALL EXERCISES',
  Cardio: 'CARDIO',
  Chest: 'CHEST',
  Shoulders: 'SHOULDERS',
  Biceps: 'BICEPS',
  Triceps: 'TRICEPS',
  Forearms: 'FOREARMS',
  Abs: 'ABS',
  Obliques: 'OBLIQUES',
  Lats: 'LATS',
  Traps: 'TRAPS',
  Lower_back: 'LOWER BACK',
  Glutes: 'GLUTES',
  Quads: 'QUADS',
  Hamstrings: 'HAMSTRINGS',
  Adductors: 'ADDUCTORS',
  Abductors: 'ABDUCTORS',
  Calves: 'CALVES',
};

// Styles for the helper components - matching exercises-single-group.tsx
const styles = {
  unifiedCategoryContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  allExercisesTitleGradient: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  allExercisesTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  exerciseCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500' as const,
  },
  exerciseCardsContainer: {
    paddingTop: 4,
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  columnWrapper: {
    justifyContent: 'space-between' as const,
    marginBottom: 0,
    flexDirection: 'row' as const,
    paddingHorizontal: 0,
    gap: 0,
  },
  emptyCardSpace: {
    flex: 1,
    marginHorizontal: 4,
  },
};

// Helper function to render search results
export const renderSearchResults = (
  displayedExercises: Exercise[],
  favoriteIds: Set<string>,
  handleExercisePress: (id: string) => void,
  toggleFavorite: (id: string) => void,
  ListEmptyComponent: React.ComponentType,
) => (
  <View style={styles.unifiedCategoryContainer}>
    <View style={styles.allExercisesTitleGradient}>
      <Text style={styles.categoryTitle}>SEARCH RESULTS</Text>
      <Text style={styles.exerciseCount}>
        {displayedExercises.length} {displayedExercises.length === 1 ? 'exercise' : 'exercises'}
      </Text>
    </View>

    <View style={styles.exerciseCardsContainer}>
      {Array.from({ length: Math.ceil(displayedExercises.length / 2) }).map((_, rowIndex) => {
        const startIdx = rowIndex * 2;
        const rowItems = displayedExercises.slice(startIdx, startIdx + 2);

        return (
          <View key={`row-${rowIndex}`} style={styles.columnWrapper}>
            {rowItems.map((item) => (
              <ExerciseCard
                key={item.id}
                id={item.id}
                name={item.name}
                image={item.image_url ? { uri: item.image_url } : FALLBACK_IMAGE_OBJECT}
                isFavorite={favoriteIds.has(item.id)}
                onPress={handleExercisePress}
                onToggleFavorite={toggleFavorite}
                useOptimizedImage={true}
              />
            ))}
            {rowItems.length === 1 && <View style={styles.emptyCardSpace} />}
          </View>
        );
      })}
    </View>

    {displayedExercises.length === 0 && <ListEmptyComponent />}
  </View>
);

// Helper function to render all exercises view
export const renderAllExercisesView = (
  currentCategory: string,
  searchQuery: string,
  displayedExercises: Exercise[],
  favoriteIds: Set<string>,
  handleExercisePress: (id: string) => void,
  toggleFavorite: (id: string) => void,
) => {
  if (currentCategory !== 'all' || searchQuery.trim()) {
    return null;
  }

  return (
    <View style={styles.unifiedCategoryContainer}>
      <View style={styles.allExercisesTitleGradient}>
        <Text style={styles.allExercisesTitle}>{CATEGORY_NAMES['all']}</Text>
        <Text style={styles.exerciseCount}>
          {displayedExercises.length} {displayedExercises.length === 1 ? 'exercise' : 'exercises'}
        </Text>
      </View>

      <View style={styles.exerciseCardsContainer}>
        {Array.from({ length: Math.ceil(displayedExercises.length / 2) }).map((_, rowIndex) => {
          const startIdx = rowIndex * 2;
          const rowItems = displayedExercises.slice(startIdx, startIdx + 2);

          return (
            <View key={`row-${rowIndex}`} style={styles.columnWrapper}>
              {rowItems.map((item) => (
                <ExerciseCard
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  image={item.image_url ? { uri: item.image_url } : FALLBACK_IMAGE_OBJECT}
                  isFavorite={favoriteIds.has(item.id)}
                  onPress={handleExercisePress}
                  onToggleFavorite={toggleFavorite}
                  useOptimizedImage={true}
                />
              ))}
              {rowItems.length === 1 && <View style={styles.emptyCardSpace} />}
            </View>
          );
        })}
      </View>
    </View>
  );
};

// Helper function to create exercise sections
export const createExerciseSections = (
  displayedExercises: Exercise[],
  searchQuery: string,
  currentCategory: string,
  shouldGroupByMuscle: boolean,
): { title: string; data: Exercise[] }[] => {
  const sections: { title: string; data: Exercise[] }[] = [];

  // If searching, group alphabetically
  if (searchQuery.trim() !== '') {
    // Create sections based on first letter
    const sectionMap = new Map<string, Exercise[]>();

    displayedExercises.forEach((exercise) => {
      const firstLetter = exercise.name.charAt(0).toUpperCase();
      if (!sectionMap.has(firstLetter)) {
        sectionMap.set(firstLetter, []);
      }
      sectionMap.get(firstLetter)!.push(exercise);
    });

    // Convert map to array and sort sections alphabetically
    Array.from(sectionMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([title, data]) => {
        sections.push({ title, data });
      });
  }
  // If viewing all exercises and groupByMuscle is true, group by muscle group
  else if (currentCategory === 'all' && shouldGroupByMuscle) {
    // Create sections based on muscle groups
    const sectionMap = new Map<string, Exercise[]>();

    // Define the order of muscle groups for better organization
    const muscleGroupOrder: ExerciseCategory[] = [
      'Cardio',
      'Chest',
      'Shoulders',
      'Biceps',
      'Triceps',
      'Forearms',
      'Abs',
      'Obliques',
      'Lats',
      'Traps',
      'Lower_back',
      'Glutes',
      'Quads',
      'Hamstrings',
      'Adductors',
      'Abductors',
      'Calves',
    ];

    // Group exercises by muscle group
    displayedExercises.forEach((exercise) => {
      const muscleGroup = exercise.muscle_group || 'Other';
      if (!sectionMap.has(muscleGroup)) {
        sectionMap.set(muscleGroup, []);
      }
      sectionMap.get(muscleGroup)!.push(exercise);
    });

    // Add sections in the defined order
    muscleGroupOrder.forEach((muscleGroup) => {
      if (sectionMap.has(muscleGroup)) {
        const data = sectionMap.get(muscleGroup)!;
        // Sort exercises alphabetically within each muscle group
        data.sort((a, b) => a.name.localeCompare(b.name));
        sections.push({
          title: CATEGORY_NAMES[muscleGroup] || muscleGroup,
          data,
        });
      }
    });

    // Add any remaining muscle groups not in the defined order
    Array.from(sectionMap.entries()).forEach(([muscleGroup, data]) => {
      if (!muscleGroupOrder.includes(muscleGroup as ExerciseCategory)) {
        data.sort((a, b) => a.name.localeCompare(b.name));
        sections.push({
          title: CATEGORY_NAMES[muscleGroup] || muscleGroup,
          data,
        });
      }
    });
  }
  // Default: single section with all exercises
  else {
    sections.push({
      title: CATEGORY_NAMES[currentCategory] || currentCategory,
      data: displayedExercises,
    });
  }

  return sections;
};

// Default export to satisfy Expo Router (this file should not be a route)
export default function ExerciseListHelpersRouterPlaceholder() {
  return null;
}
