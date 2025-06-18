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

export const Step2ExerciseSelection = ({
  selectedMuscleGroup,
  selectedExercises,
  onExerciseToggle,
  onNext,
  searchState,
  isExerciseAlreadyAdded,
}: {
  selectedMuscleGroup: string;
  selectedExercises: Set<string>;
  onExerciseToggle: (exerciseId: string) => void;
  onNext: () => void;
  searchState: ReturnType<typeof useSearchState>;
  isExerciseAlreadyAdded?: (exerciseId: string) => boolean;
}) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [favoriteExerciseIds, setFavoriteExerciseIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExercises = async () => {
      const startTime = Date.now();

      try {
        setLoading(true);

        // Track exercise loading start
        Sentry.addBreadcrumb({
          message: 'Loading Exercises for Muscle Group',
          category: 'api.request',
          level: 'info',
          data: {
            muscleGroup: selectedMuscleGroup,
            step: 'exercise_selection',
          },
        });

        let categoryKey = selectedMuscleGroup;
        if (selectedMuscleGroup === 'Lower back') {
          categoryKey = 'Lower_back';
        }

        // Load exercises and favorites in parallel
        const [exerciseData, favoriteExercises] = await Promise.all([
          exerciseService.getExercisesByCategory(categoryKey as ExerciseCategory),
          exerciseService.getFavoriteExercises().catch(() => []), // Fallback to empty array if favorites fail
        ]);

        setExercises(exerciseData);
        setFavoriteExerciseIds(new Set(favoriteExercises.map((ex) => ex.id)));

        // Track successful loading
        const duration = Date.now() - startTime;
        Sentry.addBreadcrumb({
          message: 'Exercises Loaded Successfully',
          category: 'api.success',
          level: 'info',
          data: {
            muscleGroup: selectedMuscleGroup,
            exerciseCount: exerciseData.length,
            favoriteCount: favoriteExercises.length,
            loadDuration: duration,
          },
        });
      } catch (error) {
        console.error('Error loading exercises:', error);

        // Capture API error
        captureAPIError(error as Error, 'exercise-loading', 'Step2ExerciseSelection');

        Sentry.addBreadcrumb({
          message: 'Failed to Load Exercises',
          category: 'api.error',
          level: 'error',
          data: {
            error: (error as Error).message,
            muscleGroup: selectedMuscleGroup,
            duration: Date.now() - startTime,
          },
        });
      } finally {
        setLoading(false);
      }
    };

    loadExercises();
  }, [selectedMuscleGroup]);

  const { filteredExercises } = useExerciseFiltering(exercises, searchState.searchQuery);

  // Filter out exercises that are already added to the workout
  const availableExercises = filteredExercises.filter(
    (exercise) => !isExerciseAlreadyAdded?.(exercise.id),
  );

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
          <Text style={styles.loadingText}>Loading exercises...</Text>
        </View>
      ) : (
        <ScrollView style={styles.exerciseGrid} showsVerticalScrollIndicator={false}>
          <View style={styles.exerciseCardsContainer}>
            {availableExercises.length === 0
              ? emptyComponent()
              : Array.from({ length: Math.ceil(availableExercises.length / 2) }).map(
                  (_, rowIndex) => {
                    const startIdx = rowIndex * 2;
                    const rowItems = availableExercises.slice(startIdx, startIdx + 2);

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
                              isFavorite={favoriteExerciseIds.has(exercise.id)}
                              onPress={() => {
                                // Simple toggle - no need for checks since we've filtered out unavailable exercises
                                onExerciseToggle(exercise.id);
                              }}
                              onToggleFavorite={() => {}} // No-op function as requested
                              favoriteReadOnly={true}
                              useOptimizedImage={true}
                              showWrapper={false}
                            />
                            {selectedExercises.has(exercise.id) && (
                              <View style={styles.selectedOverlay} pointerEvents="none">
                                <View style={styles.selectedOverlayIcon}>
                                  <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                                </View>
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
