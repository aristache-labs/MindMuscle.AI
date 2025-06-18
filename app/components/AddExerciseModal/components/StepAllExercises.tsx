import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../../constants/theme';
import {
  default as exerciseService,
  Exercise,
  ExerciseCategory,
} from '../../../services/exerciseService';
import { captureAPIError } from '../../../services/sentry';
import ExerciseCard from '../../ExerciseCard';
import { FALLBACK_IMAGE_OBJECT } from '../constants';
import { useExerciseFiltering, useSearchState } from '../hooks';
import { styles } from '../styles';

// Step for all exercises (when searching from step 1)
export const StepAllExercises = ({
  selectedExercises,
  onExerciseToggle,
  onNext,
  searchState,
  isExerciseAlreadyAdded,
}: {
  selectedExercises: Set<string>;
  onExerciseToggle: (exerciseId: string) => void;
  onNext: () => void;
  searchState: ReturnType<typeof useSearchState>;
  isExerciseAlreadyAdded?: (exerciseId: string) => boolean;
}) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  // Auto-activate search when component mounts from step 1 navigation
  useEffect(() => {
    searchState.activateSearchOnStep2();
  }, []);

  useEffect(() => {
    const loadAllExercises = async () => {
      const startTime = Date.now();

      try {
        setLoading(true);

        // Track all exercises loading start
        Sentry.addBreadcrumb({
          message: 'Loading All Exercises from Search',
          category: 'api.request',
          level: 'info',
          data: {
            trigger: 'step1_search',
            step: 'all_exercises',
          },
        });

        // Load all exercises from all categories
        const allCategories: ExerciseCategory[] = [
          'Chest',
          'Biceps',
          'Triceps',
          'Abs',
          'Shoulders',
          'Lats',
          'Quads',
          'Hamstrings',
          'Glutes',
          'Calves',
          'Forearms',
          'Lower_back',
          'Traps',
          'Obliques',
          'Adductors',
          'Abductors',
          'Cardio',
        ];

        const allExercises: Exercise[] = [];
        const failedCategories: string[] = [];

        for (const category of allCategories) {
          try {
            const categoryExercises = await exerciseService.getExercisesByCategory(category);
            allExercises.push(...categoryExercises);
          } catch (error) {
            console.warn(`Failed to load exercises for category ${category}:`, error);
            failedCategories.push(category);

            // Track individual category failures
            captureAPIError(error as Error, `category-${category}-loading`, 'StepAllExercises');
          }
        }

        setExercises(allExercises);

        // Track successful loading
        const duration = Date.now() - startTime;
        Sentry.addBreadcrumb({
          message: 'All Exercises Loaded',
          category: 'api.success',
          level: 'info',
          data: {
            totalExercises: allExercises.length,
            categoriesLoaded: allCategories.length - failedCategories.length,
            failedCategories,
            loadDuration: duration,
          },
        });
      } catch (error) {
        console.error('Error loading all exercises:', error);

        // Capture comprehensive error
        captureAPIError(error as Error, 'all-exercises-loading', 'StepAllExercises');

        Sentry.addBreadcrumb({
          message: 'Failed to Load All Exercises',
          category: 'api.error',
          level: 'error',
          data: {
            error: (error as Error).message,
            duration: Date.now() - startTime,
          },
        });
      } finally {
        setLoading(false);
      }
    };

    loadAllExercises();
  }, []);

  const { filteredExercises } = useExerciseFiltering(exercises, searchState.searchQuery);

  const emptyComponent = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="search-off" size={48} color="rgba(255,255,255,0.5)" />
      <Text style={styles.emptyText}>
        {searchState.searchQuery.trim()
          ? 'No exercises match your search'
          : 'No exercises available'}
      </Text>
    </View>
  );

  return (
    <View style={styles.stepContainer}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading all exercises...</Text>
        </View>
      ) : (
        <ScrollView style={styles.exerciseGrid} showsVerticalScrollIndicator={false}>
          <View style={styles.exerciseCardsContainer}>
            {filteredExercises.length === 0
              ? emptyComponent()
              : Array.from({ length: Math.ceil(filteredExercises.length / 2) }).map(
                  (_, rowIndex) => {
                    const startIdx = rowIndex * 2;
                    const rowItems = filteredExercises.slice(startIdx, startIdx + 2);

                    return (
                      <View key={`row-${rowIndex}`} style={styles.exerciseRow}>
                        {rowItems.map((exercise) => (
                          <View key={exercise.id} style={styles.exerciseCardContainer}>
                            <ExerciseCard
                              id={exercise.id}
                              name={exercise.name}
                              image={
                                exercise.image_url
                                  ? { uri: exercise.image_url }
                                  : FALLBACK_IMAGE_OBJECT
                              }
                              isFavorite={false}
                              onPress={() => onExerciseToggle(exercise.id)}
                              onToggleFavorite={() => {}}
                              useOptimizedImage={true}
                              hideFavoriteButton={true}
                              disabled={isExerciseAlreadyAdded?.(exercise.id) || false}
                              disabledReason="Already in workout"
                            />
                            {selectedExercises.has(exercise.id) && (
                              <View style={styles.selectedOverlay}>
                                <Ionicons
                                  name="checkmark-circle"
                                  size={24}
                                  color={COLORS.primary}
                                />
                              </View>
                            )}
                          </View>
                        ))}
                        {rowItems.length === 1 && <View style={styles.emptyCardSpace} />}
                      </View>
                    );
                  },
                )}
          </View>
        </ScrollView>
      )}

      <View style={styles.stepActions}>
        <Text style={styles.summaryText}>Selected Exercises: {selectedExercises.size}</Text>

        <TouchableOpacity
          style={[styles.nextButton, selectedExercises.size === 0 && styles.nextButtonDisabled]}
          onPress={onNext}
          disabled={selectedExercises.size === 0}
        >
          <Text style={styles.nextButtonText}>Next</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};
