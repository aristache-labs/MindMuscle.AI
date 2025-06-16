import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/theme';
import { fetchExerciseAlternatives } from '../services/exerciseAlternativesService';
import { simpleErrorHandler } from '../services/sentry/simpleErrorHandler';
import OptimizedImage from './OptimizedImage';

type _ListItemType =
  | { type: 'current'; exercise: Exercise; key: string }
  | { type: 'header'; title: string; icon: keyof typeof Ionicons.glyphMap; key: string }
  | { type: 'exercise'; exercise: ExerciseAlternative; key: string }
  | { type: 'debug'; key: string }
  | { type: 'no-alternatives'; key: string };

interface Exercise {
  id: string;
  exercise_id: string;
  name: string;
  sets: number;
  reps_range: string;
  image_url?: string;
  primary_muscles?: string[];
  order: number;
  workout_day: number;
  requires_weight?: boolean;
  difficulty?: string;
  equipment?: string;
  rest_time?: number;
}

interface ExerciseAlternative {
  id: string;
  exercise_id?: string; // Add exercise_id to match Exercise interface
  name: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  difficulty: string;
  equipment: string;
  requires_weight: boolean;
  muscle_group: string;
  image_url?: string;
  sets: number;
  reps_range: string;
  rest_time: number;
  order: number;
  workout_day: number;
  recommendation_type: 'recommended' | 'other';
  similarity_score: number;
}

interface ChangeExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  currentExercise: Exercise | null;
  availableExercises: Exercise[];
  onExerciseSelect: (exercise: ExerciseAlternative) => void;
}

// Helper function to get a valid muscle group from primary muscles array
function getValidMuscleGroupFromArray(primaryMuscles: string[]): string {
  try {
    // Check if we have valid primary muscles
    if (primaryMuscles && primaryMuscles.length > 0) {
      const primaryMuscle = primaryMuscles[0];

      // Validate that it's not empty or undefined
      if (primaryMuscle && primaryMuscle.trim().length > 0) {
        return primaryMuscle.trim();
      }
    }

    // Default fallback to a valid muscle group that works with SVG highlighting
    return 'Chest'; // Using 'Chest' as a safe fallback since it's always visible and well-defined in SVG
  } catch (error) {
    simpleErrorHandler.captureException(error as Error, {
      component: 'ChangeExerciseModal',
      action: 'get_valid_muscle_group',
      primaryMuscles,
    });

    // Return safe fallback on error
    return 'Chest';
  }
}

export default function ChangeExerciseModal({
  visible,
  onClose,
  currentExercise,
  availableExercises,
  onExerciseSelect,
}: ChangeExerciseModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedExercise, setSelectedExercise] = useState<ExerciseAlternative | null>(null);
  const [recommendedExercises, setRecommendedExercises] = useState<ExerciseAlternative[]>([]);
  const [otherExercises, setOtherExercises] = useState<ExerciseAlternative[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch exercise alternatives when modal opens
  useEffect(() => {
    if (visible && currentExercise) {
      simpleErrorHandler.addBreadcrumb('ChangeExerciseModal opened', 'ui', {
        currentExerciseId: currentExercise.exercise_id,
        currentExerciseName: currentExercise.name,
        availableExercisesCount: availableExercises.length,
      });
      fetchAlternatives();
    } else {
      if (visible) {
        simpleErrorHandler.addBreadcrumb(
          'ChangeExerciseModal opened without current exercise',
          'warning',
        );
      }
      setSelectedExercise(null);
      setRecommendedExercises([]);
      setOtherExercises([]);
    }
  }, [visible, currentExercise]);

  const fetchAlternatives = async () => {
    if (!currentExercise) {
      simpleErrorHandler.addBreadcrumb(
        'fetchAlternatives called without current exercise',
        'warning',
      );
      return;
    }

    setIsLoading(true);
    simpleErrorHandler.addBreadcrumb('Started fetching exercise alternatives', 'data', {
      currentExerciseId: currentExercise.exercise_id,
      currentExerciseName: currentExercise.name,
    });

    try {
      const currentExerciseData = {
        exercise_id: currentExercise.exercise_id,
        sets: currentExercise.sets,
        reps_range: currentExercise.reps_range,
        rest_time: currentExercise.rest_time || 60,
        order: currentExercise.order,
        workout_day: currentExercise.workout_day,
        primary_muscles: currentExercise.primary_muscles || [],
        difficulty: currentExercise.difficulty,
        equipment: currentExercise.equipment,
        requires_weight: currentExercise.requires_weight,
      };

      console.log('ChangeExerciseModal: Fetching alternatives for:', currentExerciseData);

      const { recommended, other } = await fetchExerciseAlternatives(currentExerciseData);

      simpleErrorHandler.addBreadcrumb('Successfully fetched exercise alternatives', 'data', {
        recommendedCount: recommended.length,
        otherCount: other.length,
        totalAlternatives: recommended.length + other.length,
        currentExerciseId: currentExercise.exercise_id,
      });

      console.log('ChangeExerciseModal: Received alternatives:', {
        recommended: recommended.length,
        other: other.length,
        recommendedNames: recommended.map((ex) => ex.name),
        otherNames: other.map((ex) => ex.name),
        availableExercisesCount: availableExercises.length,
      });

      // Always ensure we have a good selection of exercises
      let finalRecommended = [...recommended];
      let finalOther = [...other];

      // If we don't have enough exercises from the service, add some from availableExercises as fallback
      const totalFromService = finalRecommended.length + finalOther.length;
      const minDesiredTotal = 10; // Aim for at least 10 total exercises

      if (totalFromService < minDesiredTotal && availableExercises.length > 0) {
        console.log('ChangeExerciseModal: Adding fallback exercises from availableExercises');
        console.log(
          'Current totals - Recommended:',
          finalRecommended.length,
          'Other:',
          finalOther.length,
        );

        // Filter out current exercise and already included exercises
        const excludedIds = new Set([
          currentExercise.exercise_id,
          ...finalRecommended.map((ex) => ex.exercise_id || ex.id),
          ...finalOther.map((ex) => ex.exercise_id || ex.id),
        ]);

        const fallbackExercises = availableExercises
          .filter((ex) => !excludedIds.has(ex.exercise_id))
          .slice(0, minDesiredTotal - totalFromService) // Fill up to desired total
          .map((ex) => ({
            ...ex,
            exercise_id: ex.exercise_id,
            primary_muscles: ex.primary_muscles || [],
            secondary_muscles: [],
            difficulty: ex.difficulty || 'Intermediate',
            equipment: ex.equipment || 'Standard',
            requires_weight: ex.requires_weight !== false,
            muscle_group: getValidMuscleGroupFromArray(ex.primary_muscles || []),
            rest_time: ex.rest_time || 60,
            recommendation_type: 'other' as 'recommended' | 'other',
            similarity_score: 25, // Lower score for fallback exercises
          }));

        console.log(
          'Adding',
          fallbackExercises.length,
          'fallback exercises:',
          fallbackExercises.map((ex) => ex.name),
        );

        // If we have very few recommended exercises, add some fallback to recommended
        if (finalRecommended.length < 3 && fallbackExercises.length > 0) {
          const fallbackForRecommended = fallbackExercises.splice(
            0,
            Math.min(3 - finalRecommended.length, fallbackExercises.length),
          );
          fallbackForRecommended.forEach((ex) => (ex.recommendation_type = 'recommended'));
          finalRecommended = [...finalRecommended, ...fallbackForRecommended];
        }

        // Add remaining fallback exercises to "other" category
        finalOther = [...finalOther, ...fallbackExercises];
      }

      console.log(
        'ChangeExerciseModal: Final counts - Recommended:',
        finalRecommended.length,
        'Other:',
        finalOther.length,
      );

      // Show ALL exercises for the muscle group - no artificial limits needed
      console.log(
        'ChangeExerciseModal: Showing all exercises for muscle group - Recommended:',
        finalRecommended.length,
        'Other:',
        finalOther.length,
      );

      setRecommendedExercises(finalRecommended);
      setOtherExercises(finalOther);
    } catch (error) {
      simpleErrorHandler.captureException(error as Error, {
        component: 'ChangeExerciseModal',
        category: 'api_error',
        currentExerciseId: currentExercise.exercise_id,
      });

      console.error('Error fetching exercise alternatives:', error);

      // Fallback: use availableExercises if service fails
      if (availableExercises.length > 0) {
        simpleErrorHandler.addBreadcrumb(
          'Using availableExercises as fallback due to API error',
          'data',
          {
            fallbackExerciseCount: availableExercises.length,
            currentExerciseId: currentExercise.exercise_id,
          },
        );
        console.log('ChangeExerciseModal: Using availableExercises as fallback due to error');

        const fallbackExercises = availableExercises
          .filter((ex) => ex.exercise_id !== currentExercise.exercise_id)
          .slice(0, 20) // Get more exercises for better selection
          .map((ex) => ({
            ...ex,
            exercise_id: ex.exercise_id,
            primary_muscles: ex.primary_muscles || [],
            secondary_muscles: [],
            difficulty: ex.difficulty || 'Intermediate',
            equipment: ex.equipment || 'Standard',
            requires_weight: ex.requires_weight !== false,
            muscle_group: getValidMuscleGroupFromArray(ex.primary_muscles || []),
            rest_time: ex.rest_time || 60,
            recommendation_type: 'other' as 'recommended' | 'other',
            similarity_score: 20,
          }));

        // Split fallback exercises between recommended and other
        const fallbackRecommended = fallbackExercises.slice(0, 5).map((ex) => ({
          ...ex,
          recommendation_type: 'recommended' as 'recommended' | 'other',
        }));
        const fallbackOther = fallbackExercises.slice(5).map((ex) => ({
          ...ex,
          recommendation_type: 'other' as 'recommended' | 'other',
        }));

        console.log(
          'Fallback split - Recommended:',
          fallbackRecommended.length,
          'Other:',
          fallbackOther.length,
        );

        // Show all fallback exercises - no limits needed for muscle group filtering
        setRecommendedExercises(fallbackRecommended);
        setOtherExercises(fallbackOther);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleExercisePress = useCallback((exercise: ExerciseAlternative) => {
    try {
      simpleErrorHandler.addBreadcrumb('User selected exercise alternative', 'user_interaction', {
        selectedExerciseId: exercise.id,
        selectedExerciseName: exercise.name,
        recommendationType: exercise.recommendation_type,
        similarityScore: exercise.similarity_score,
      });
      setSelectedExercise(exercise);
    } catch (error) {
      simpleErrorHandler.captureException(error as Error, {
        component: 'ChangeExerciseModal',
        category: 'ui_error',
      });
      console.error('Error handling exercise press:', error);
    }
  }, []);

  const handleConfirmChange = useCallback(() => {
    if (selectedExercise) {
      simpleErrorHandler.addBreadcrumb('User confirmed exercise change', 'user_interaction', {
        oldExerciseId: currentExercise?.exercise_id,
        oldExerciseName: currentExercise?.name,
        newExerciseId: selectedExercise.id,
        newExerciseName: selectedExercise.name,
        recommendationType: selectedExercise.recommendation_type,
      });

      console.log('ChangeExerciseModal: Confirming exercise change:', selectedExercise);
      try {
        // Add a flag to indicate this is a changed exercise that needs history data
        const exerciseWithChangeFlag = {
          ...selectedExercise,
          isChangedExercise: true, // This flag will be used to identify changed exercises
        };
        onExerciseSelect(exerciseWithChangeFlag);
        onClose();
      } catch (error) {
        simpleErrorHandler.captureException(error as Error, {
          component: 'ChangeExerciseModal',
          category: 'ui_error',
        });
        console.error('Error in handleConfirmChange:', error);
      }
    } else {
      simpleErrorHandler.addBreadcrumb(
        'User attempted to confirm change without selecting exercise',
        'warning',
      );
    }
  }, [selectedExercise, onExerciseSelect, onClose, currentExercise]);

  const getMuscleTagColor = useCallback((muscle: string) => {
    const muscleColors: Record<string, string> = {
      Chest: '#FF6B6B',
      Back: '#4ECDC4',
      Shoulders: '#45B7D1',
      Arms: '#96CEB4',
      Legs: '#FFEAA7',
      Core: '#DDA0DD',
      Glutes: '#F39C12',
      Biceps: '#96CEB4',
      Triceps: '#96CEB4',
      Quadriceps: '#FFEAA7',
      Hamstrings: '#FFEAA7',
      Calves: '#FFEAA7',
      Lats: '#4ECDC4',
      Traps: '#4ECDC4',
      Delts: '#45B7D1',
      Abs: '#DDA0DD',
    };
    return muscleColors[muscle] || '#FFD700';
  }, []);

  // Exercise item component without memoization for testing
  const ExerciseItem = React.memo(
    ({
      exercise,
      isSelected,
      onPress,
    }: {
      exercise: ExerciseAlternative;
      isSelected: boolean;
      onPress: () => void;
    }) => {
      // Memoize muscle tag color to prevent recalculation
      const muscleTagColor = useMemo(
        () => getMuscleTagColor(exercise.primary_muscles[0]),
        [exercise.primary_muscles],
      );

      // Memoize image source to prevent unnecessary recalculation
      const imageSource = useMemo(
        () => getImageSource(exercise),
        [exercise.image_url, exercise.exercise_id, exercise.id],
      );

      return (
        <TouchableOpacity
          style={[styles.exerciseItem, isSelected && styles.selectedExerciseItem]}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <View style={styles.exerciseImageContainer}>
            <OptimizedImage
              source={imageSource}
              style={styles.exerciseImage}
              fallback={require('../../assets/exercises/placeholder.jpg')}
              resizeMode="cover"
              cachePolicy="immutable"
              showLoader={false}
              priority="normal"
              debugLabel={`ChangeExercise-${exercise?.exercise_id || exercise?.id || 'Unknown'}`}
              key={`exercise-${exercise?.exercise_id || exercise?.id}-${exercise?.image_url || 'no-image'}`}
            />
          </View>

          <View style={styles.exerciseInfo}>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            <Text style={styles.exerciseDetails}>
              {exercise.sets} sets × {exercise.reps_range} reps
            </Text>
            <View style={styles.exerciseMetadata}>
              <View style={[styles.muscleTag, { backgroundColor: muscleTagColor }]}>
                <Text style={styles.muscleTagText}>{exercise.primary_muscles[0]}</Text>
              </View>
              <View style={styles.difficultyTag}>
                <Text style={styles.difficultyText}>{exercise.difficulty}</Text>
              </View>
            </View>
          </View>

          {isSelected && (
            <View style={styles.selectedIndicator}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
            </View>
          )}
        </TouchableOpacity>
      );
    },
    (prevProps, nextProps) => {
      // Custom comparison function for better performance
      return (
        prevProps.exercise.id === nextProps.exercise.id &&
        prevProps.exercise.image_url === nextProps.exercise.image_url &&
        prevProps.isSelected === nextProps.isSelected
      );
    },
  );

  // Remove unused current exercise image source since we now use the helper function

  // Stable key generator to prevent unnecessary re-renders
  const getStableKey = useCallback(
    (exercise: ExerciseAlternative, prefix: string, index?: number) => {
      // Use exercise_id as primary identifier, fallback to id, then name
      const identifier =
        exercise.exercise_id || exercise.id || exercise.name.replace(/\s+/g, '-').toLowerCase();
      const baseKey = `${prefix}-${identifier}`;
      return index !== undefined ? `${baseKey}-${index}` : baseKey;
    },
    [],
  );

  // Helper function to safely get image source (similar to WorkoutExerciseCard)
  const getImageSource = useCallback((exercise: ExerciseAlternative | Exercise) => {
    // Check if we have a valid image URL
    // This prevents flickering by avoiding invalid URI loading attempts
    const trimmedImageUrl = exercise?.image_url?.trim();
    const hasValidImageUrl =
      trimmedImageUrl &&
      trimmedImageUrl !== '' &&
      trimmedImageUrl !== 'null' &&
      trimmedImageUrl !== 'undefined';

    if (hasValidImageUrl) {
      return { uri: exercise.image_url };
    } else {
      // Use placeholder directly for local assets to prevent any loading attempts
      return require('../../assets/exercises/placeholder.jpg');
    }
  }, []);

  // Memoized exercise data to prevent unnecessary re-renders and image flickering
  const allExercisesData = useMemo(() => {
    const exercises: _ListItemType[] = [];

    // Add current exercise
    if (currentExercise) {
      exercises.push({
        type: 'current' as const,
        exercise: currentExercise,
        key: `current-${currentExercise.exercise_id || currentExercise.id}`,
      });
    }

    // Add recommended exercises
    if (recommendedExercises.length > 0) {
      exercises.push({
        type: 'header' as const,
        title: 'Recommended Alternatives',
        icon: 'star-outline',
        key: 'recommended-header',
      });

      recommendedExercises.forEach((exercise) => {
        exercises.push({
          type: 'exercise' as const,
          exercise,
          key: getStableKey(exercise, 'recommended'),
        });
      });
    }

    // Add other exercises
    if (otherExercises.length > 0) {
      exercises.push({
        type: 'header' as const,
        title: 'Other Alternatives',
        icon: 'list',
        key: 'other-header',
      });

      otherExercises.forEach((exercise) => {
        exercises.push({
          type: 'exercise' as const,
          exercise,
          key: getStableKey(exercise, 'other'),
        });
      });
    }

    // Add debug info in development
    if (process.env.NODE_ENV === 'development' && !isLoading) {
      exercises.push({
        type: 'debug' as const,
        key: 'debug-info',
      });
    }

    // Add no alternatives message if needed
    if (!isLoading && recommendedExercises.length === 0 && otherExercises.length === 0) {
      exercises.push({
        type: 'no-alternatives' as const,
        key: 'no-alternatives',
      });
    }

    return exercises;
  }, [
    selectedExercise,
    recommendedExercises,
    otherExercises,
    availableExercises,
    currentExercise,
    isLoading,
  ]);

  // Render item function for FlatList
  const renderItem = useCallback(
    ({ item }: { item: _ListItemType }) => {
      if (item.type === 'current') {
        return (
          <>
            <View style={[styles.categoryHeader, styles.categoryHeaderFirst]}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.text} />
              <Text style={styles.categoryTitle}>Current Exercise</Text>
            </View>
            <View style={[styles.exerciseItem, styles.currentExerciseItem]}>
              <View style={styles.exerciseImageContainer}>
                <OptimizedImage
                  source={getImageSource(item.exercise)}
                  style={styles.exerciseImage}
                  fallback={require('../../assets/exercises/placeholder.jpg')}
                  resizeMode="cover"
                  cachePolicy="immutable"
                  showLoader={false}
                  priority="normal"
                  debugLabel={`CurrentExercise-${item.exercise?.exercise_id || item.exercise?.id || 'Unknown'}`}
                  key={`current-${item.exercise?.exercise_id || item.exercise?.id}-${item.exercise?.image_url || 'no-image'}`}
                />
              </View>

              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{item.exercise.name}</Text>
                <Text style={styles.exerciseDetails}>
                  {item.exercise.sets} sets × {item.exercise.reps_range} reps
                </Text>
                <View style={styles.exerciseMetadata}>
                  {item.exercise.primary_muscles && item.exercise.primary_muscles.length > 0 && (
                    <View
                      style={[
                        styles.muscleTag,
                        { backgroundColor: getMuscleTagColor(item.exercise.primary_muscles[0]) },
                      ]}
                    >
                      <Text style={styles.muscleTagText}>{item.exercise.primary_muscles[0]}</Text>
                    </View>
                  )}
                  {item.exercise.difficulty && (
                    <View style={styles.difficultyTag}>
                      <Text style={styles.difficultyText}>{item.exercise.difficulty}</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.currentExerciseIndicator}>
                <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
              </View>
            </View>
          </>
        );
      }

      if (item.type === 'header') {
        return (
          <View style={styles.categoryHeader}>
            <Ionicons name={item.icon} size={20} color={COLORS.text} />
            <Text style={styles.categoryTitle}>{item.title}</Text>
          </View>
        );
      }

      if (item.type === 'exercise') {
        return (
          <ExerciseItem
            exercise={item.exercise}
            isSelected={selectedExercise?.id === item.exercise.id}
            onPress={() => handleExercisePress(item.exercise)}
          />
        );
      }

      if (item.type === 'debug') {
        return (
          <View style={styles.debugContainer}>
            <Text style={styles.debugText}>
              Debug: R:{recommendedExercises.length} O:{otherExercises.length} A:
              {availableExercises.length}
            </Text>
          </View>
        );
      }

      if (item.type === 'no-alternatives') {
        return (
          <View style={styles.noAlternativesContainer}>
            <Ionicons name="search" size={48} color={COLORS.text} style={{ opacity: 0.5 }} />
            <Text style={styles.noAlternativesText}>No alternatives found</Text>
            <Text style={styles.noAlternativesSubtext}>
              Try a different exercise or check your connection
            </Text>
          </View>
        );
      }

      return null;
    },
    [
      selectedExercise,
      recommendedExercises,
      otherExercises,
      availableExercises,
      currentExercise,
      isLoading,
    ],
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => {
        simpleErrorHandler.addBreadcrumb('User closed ChangeExerciseModal', 'user_interaction', {
          selectedExerciseId: selectedExercise?.id,
          hadSelection: !!selectedExercise,
        });
        onClose();
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <LinearGradient
            colors={['#121418', '#0A0C10']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalGradient}
          >
            {/* Adding glowing corners */}
            <View style={styles.topGlowLeft} />
            <View style={styles.topGlowRight} />

            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => {
                  simpleErrorHandler.addBreadcrumb(
                    'User cancelled exercise change',
                    'user_interaction',
                    {
                      hadSelection: !!selectedExercise,
                      selectedExerciseId: selectedExercise?.id,
                    },
                  );
                  onClose();
                }}
                style={styles.headerButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <Text style={styles.headerTitle}>CHANGE EXERCISE</Text>

              <TouchableOpacity
                onPress={handleConfirmChange}
                style={[styles.headerButton, { opacity: selectedExercise ? 1 : 0.5 }]}
                disabled={!selectedExercise}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>

            {/* Exercise List */}
            <View style={styles.exerciseListSection}>
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>Finding alternatives...</Text>
                </View>
              ) : (
                <FlatList
                  key={`exercise-list-${currentExercise?.exercise_id || 'default'}`}
                  data={allExercisesData}
                  renderItem={renderItem}
                  keyExtractor={(item) => item.key}
                  showsVerticalScrollIndicator={false}
                  removeClippedSubviews={false}
                  maxToRenderPerBatch={8}
                  updateCellsBatchingPeriod={100}
                  initialNumToRender={8}
                  windowSize={5}
                  getItemLayout={undefined}
                  contentContainerStyle={styles.flatListContent}
                  extraData={selectedExercise?.id}
                />
              )}
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '98%',
    backgroundColor: 'transparent',
  },
  modalGradient: {
    flex: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
    borderWidth: 0,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
  },
  topGlowLeft: {
    position: 'absolute',
    top: -0.7,
    left: -0.2,
    width: 13,
    height: 13,
    borderTopLeftRadius: 12,
    backgroundColor: 'transparent',
    borderLeftWidth: 0.9,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
    elevation: 15,
    zIndex: 1,
  },
  topGlowRight: {
    position: 'absolute',
    top: -0.7,
    right: -0.2,
    width: 13,
    height: 13,
    borderTopRightRadius: 12,
    backgroundColor: 'transparent',
    borderRightWidth: 0.9,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
    elevation: 15,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 0.2,
    borderBottomColor: COLORS.primary,
    backgroundColor: COLORS.background,
  },
  headerButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  cancelButtonText: {
    color: '#FF5252',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  confirmButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  currentExerciseItem: {
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
    borderWidth: 0.2,
  },
  currentExerciseIndicator: {
    marginLeft: SPACING.md,
  },
  exerciseListSection: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 0.2,
    borderColor: 'transparent',
  },
  selectedExerciseItem: {
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
  },
  exerciseImageContainer: {
    width: 50,
    height: 50,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    marginRight: SPACING.md,
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  exerciseDetails: {
    color: COLORS.text,
    fontSize: 14,
    opacity: 0.7,
    marginBottom: SPACING.xs,
  },
  muscleTag: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  muscleTagText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
  selectedIndicator: {
    marginLeft: SPACING.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    color: COLORS.text,
    fontSize: 16,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
  },
  categoryHeaderFirst: {
    marginTop: 0,
  },
  categoryTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: SPACING.sm,
  },
  exerciseMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  difficultyTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 8,
  },
  difficultyText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.8,
  },
  noAlternativesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    marginTop: SPACING.xl,
  },
  noAlternativesText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  noAlternativesSubtext: {
    color: COLORS.text,
    fontSize: 14,
    opacity: 0.7,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  debugContainer: {
    backgroundColor: 'rgba(255, 255, 0, 0.1)',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginVertical: SPACING.sm,
  },
  debugText: {
    color: '#FFD700',
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  flatListContent: {
    paddingBottom: SPACING.lg,
  },
});
