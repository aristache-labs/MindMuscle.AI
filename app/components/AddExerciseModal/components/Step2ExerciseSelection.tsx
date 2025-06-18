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

        const exerciseData = await exerciseService.getExercisesByCategory(
          categoryKey as ExerciseCategory,
        );

        setExercises(exerciseData);

        // Track successful loading
        const duration = Date.now() - startTime;
        Sentry.addBreadcrumb({
          message: 'Exercises Loaded Successfully',
          category: 'api.success',
          level: 'info',
          data: {
            muscleGroup: selectedMuscleGroup,
            exerciseCount: exerciseData.length,
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
