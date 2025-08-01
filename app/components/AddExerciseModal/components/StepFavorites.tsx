import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../../constants/theme';
import exerciseService, { Exercise } from '../../../services/exerciseService';
import ExerciseCard from '../../ExerciseCard';
import { FALLBACK_IMAGE_OBJECT } from '../constants';
import { useExerciseFiltering, useSearchState } from '../hooks';
import { styles } from '../styles';
import { MaterialIcons } from '@expo/vector-icons';

export const StepFavorites = ({
  selectedExercises,
  onExerciseToggle,
  onNext,
  selectedMuscleGroup,
  searchState,
  isExerciseAlreadyAdded,
  buttonText = 'Next',
}: {
  selectedExercises: Set<string>;
  onExerciseToggle: (exerciseId: string) => void;
  onNext: () => void;
  selectedMuscleGroup?: string;
  searchState: ReturnType<typeof useSearchState>;
  isExerciseAlreadyAdded?: (exerciseId: string) => boolean;
  buttonText?: string;
}) => {
  const [favoriteExercises, setFavoriteExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFavoriteExercises = async () => {
      try {
        setLoading(true);
        // Use the actual favorite exercises service
        const allFavorites = await exerciseService.getFavoriteExercises();

        // Filter by muscle group if one is selected
        let filteredFavorites = allFavorites;
        if (selectedMuscleGroup) {
          let categoryKey = selectedMuscleGroup;
          if (selectedMuscleGroup === 'Lower back') {
            categoryKey = 'Lower_back';
          }
          filteredFavorites = allFavorites.filter(
            (exercise) => exercise.muscle_group === categoryKey,
          );
        }

        setFavoriteExercises(filteredFavorites);
      } catch (error) {
        console.error('Error loading favorite exercises:', error);
        setFavoriteExercises([]);
      } finally {
        setLoading(false);
      }
    };

    loadFavoriteExercises();
  }, [selectedMuscleGroup]);

  const { filteredExercises } = useExerciseFiltering(favoriteExercises, searchState.searchQuery);

  // Filter out exercises that are already added to the workout
  const availableExercises = filteredExercises.filter(
    (exercise) => !isExerciseAlreadyAdded?.(exercise.id),
  );

  const emptyComponent = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="search-off" size={48} color="rgba(255,255,255,0.5)" />
      <Text style={styles.emptyText}>
        {searchState.searchQuery.trim()
          ? 'No favorite exercises match your search'
          : selectedMuscleGroup
            ? `No favorite ${selectedMuscleGroup.toLowerCase()} exercises`
            : 'No favorite exercises'}
      </Text>
    </View>
  );

  return (
    <View style={styles.stepContainer}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading favorite exercises...</Text>
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
                              isFavorite={true}
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
          <Text style={styles.nextButtonText}>{buttonText}</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};
