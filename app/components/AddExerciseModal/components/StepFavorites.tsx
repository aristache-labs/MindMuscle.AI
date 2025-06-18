import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../../constants/theme';
import exerciseService, { Exercise } from '../../../services/exerciseService';
import ExerciseCard from '../../ExerciseCard';
import { FALLBACK_IMAGE_OBJECT } from '../constants';
import { useExerciseFiltering, useSearchState } from '../hooks';
import { styles } from '../styles';

export const StepFavorites = ({
  selectedExercises,
  onExerciseToggle,
  onNext,
  selectedMuscleGroup,
  searchState,
  isExerciseAlreadyAdded,
}: {
  selectedExercises: Set<string>;
  onExerciseToggle: (exerciseId: string) => void;
  onNext: () => void;
  selectedMuscleGroup?: string;
  searchState: ReturnType<typeof useSearchState>;
  isExerciseAlreadyAdded?: (exerciseId: string) => boolean;
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

  const getEmptyStateText = () => {
    if (searchState.searchQuery.trim()) {
      return 'No favorite exercises match your search';
    }
    if (selectedMuscleGroup) {
      return `No favorite ${selectedMuscleGroup.toLowerCase()} exercises found`;
    }
    return 'No favorite exercises found';
  };

  const getEmptyStateSubtext = () => {
    if (searchState.searchQuery.trim()) {
      return 'Try adjusting your search terms';
    }
    if (selectedMuscleGroup) {
      return `Mark ${selectedMuscleGroup.toLowerCase()} exercises as favorites to see them here`;
    }
    return 'Mark exercises as favorites to see them here';
  };

  const emptyComponent = () => (
    <View style={styles.emptyFavoritesContainer}>
      <Ionicons name="star-outline" size={64} color={COLORS.placeholder} />
      <Text style={styles.emptyFavoritesTitle}>{getEmptyStateText()}</Text>
      <Text style={styles.emptyFavoritesText}>{getEmptyStateSubtext()}</Text>
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
                              isFavorite={true}
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
