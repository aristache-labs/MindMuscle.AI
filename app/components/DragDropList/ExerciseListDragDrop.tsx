import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DragDropList from './DragDropList';
import ExerciseDragCard from './ExerciseDragCard';
import { SPACING } from '../../constants/theme';
import { ExerciseSet, DragDropItem } from './types';

interface ExerciseListDragDropProps {
  exercises: DragDropItem[];
  currentExerciseIndex: number;
  isCustomizeMode: boolean;
  exerciseSets: Record<string, ExerciseSet[]>;
  onReorder: (reorderedExercises: DragDropItem[]) => void;
  onExercisePress: (index: number) => void;
  onRemoveExercise: (index: number) => void;
}

const ExerciseListDragDrop: React.FC<ExerciseListDragDropProps> = ({
  exercises,
  currentExerciseIndex,
  isCustomizeMode,
  exerciseSets,
  onReorder,
  onExercisePress,
  onRemoveExercise,
}) => {
  console.log('ExerciseListDragDrop: Using smooth drag and drop functionality', {
    exerciseCount: exercises.length,
    isCustomizeMode,
  });

  // Enhanced validation
  if (!Array.isArray(exercises)) {
    console.warn('ExerciseListDragDrop: exercises prop is not an array:', exercises);
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Invalid exercise data</Text>
      </View>
    );
  }

  if (exercises.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No exercises available</Text>
      </View>
    );
  }

  // Validate each exercise has required properties
  const invalidExercises = exercises.filter(
    (exercise) =>
      !exercise ||
      typeof exercise !== 'object' ||
      !exercise.id ||
      typeof exercise.id !== 'string' ||
      !exercise.name ||
      typeof exercise.name !== 'string',
  );

  if (invalidExercises.length > 0) {
    console.warn('ExerciseListDragDrop: Found invalid exercises:', invalidExercises);
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Invalid exercise data detected</Text>
        <Text style={styles.errorSubtext}>Please refresh and try again</Text>
      </View>
    );
  }

  // Validate callback functions
  if (typeof onReorder !== 'function') {
    console.error('ExerciseListDragDrop: onReorder must be a function');
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Configuration error</Text>
      </View>
    );
  }

  if (typeof onExercisePress !== 'function') {
    console.error('ExerciseListDragDrop: onExercisePress must be a function');
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Configuration error</Text>
      </View>
    );
  }

  if (typeof onRemoveExercise !== 'function') {
    console.error('ExerciseListDragDrop: onRemoveExercise must be a function');
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Configuration error</Text>
      </View>
    );
  }

  // Convert exercises to DragDropItem format with additional safety
  const dragDropItems = exercises.map((exercise) => {
    try {
      return {
        ...exercise,
        // Ensure all required DragDropItem properties are present with defaults
        id: exercise.id || `fallback-${Math.random()}`,
        exercise_id: exercise.exercise_id || exercise.id || `fallback-${Math.random()}`,
        name: exercise.name || 'Unknown Exercise',
        sets: typeof exercise.sets === 'number' ? exercise.sets : 3,
        reps_range: exercise.reps_range || '8-12',
        image_url: exercise.image_url || undefined,
        primary_muscles: Array.isArray(exercise.primary_muscles) ? exercise.primary_muscles : [],
        order: typeof exercise.order === 'number' ? exercise.order : 0,
        workout_day: typeof exercise.workout_day === 'number' ? exercise.workout_day : 1,
        requires_weight: Boolean(exercise.requires_weight),
      };
    } catch (error) {
      console.error('ExerciseListDragDrop: Error processing exercise:', exercise, error);
      return {
        id: `error-${Math.random()}`,
        exercise_id: `error-${Math.random()}`,
        name: 'Error Loading Exercise',
        sets: 3,
        reps_range: '8-12',
        image_url: undefined,
        primary_muscles: [],
        order: 0,
        workout_day: 1,
        requires_weight: false,
      };
    }
  });

  // Render function for drag and drop items
  const renderDragDropItem = useCallback(
    (item: DragDropItem, index: number, isDragging: boolean) => {
      try {
        if (!item || typeof item !== 'object') {
          console.warn('ExerciseListDragDrop: Invalid item in renderDragDropItem:', item);
          return null;
        }

        return (
          <ExerciseDragCard
            exercise={item}
            index={index}
            currentExerciseIndex={currentExerciseIndex}
            isCustomizeMode={isCustomizeMode}
            isDragging={isDragging}
            exerciseSets={exerciseSets || {}}
            onPress={() => {
              try {
                onExercisePress(index);
              } catch (error) {
                console.error('ExerciseListDragDrop: Error in onExercisePress:', error);
              }
            }}
            onRemove={() => {
              try {
                onRemoveExercise(index);
              } catch (error) {
                console.error('ExerciseListDragDrop: Error in onRemoveExercise:', error);
              }
            }}
          />
        );
      } catch (error) {
        console.error('ExerciseListDragDrop: Error in renderDragDropItem:', error);
        return null;
      }
    },
    [currentExerciseIndex, isCustomizeMode, exerciseSets, onExercisePress, onRemoveExercise],
  );

  // Key extractor for drag and drop
  const keyExtractor = useCallback((item: DragDropItem) => {
    try {
      return item?.id || `item-${Math.random()}`;
    } catch (error) {
      console.error('ExerciseListDragDrop: Error in keyExtractor:', error);
      return `error-${Math.random()}`;
    }
  }, []);

  // Handle reorder callback
  const handleReorder = useCallback(
    (reorderedItems: DragDropItem[]) => {
      try {
        if (!Array.isArray(reorderedItems)) {
          console.error('ExerciseListDragDrop: reorderedItems is not an array:', reorderedItems);
          return;
        }

        // Update the order property for each exercise
        const updatedExercises = reorderedItems.map((exercise, index) => {
          try {
            return {
              ...exercise,
              order: index,
            };
          } catch (error) {
            console.error('ExerciseListDragDrop: Error updating exercise order:', exercise, error);
            return exercise;
          }
        });

        onReorder(updatedExercises);
      } catch (error) {
        console.error('ExerciseListDragDrop: Error in handleReorder:', error);
      }
    },
    [onReorder],
  );

  try {
    return (
      <View style={styles.container}>
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionTitle}>
            EXERCISES ({exercises.length}) - {isCustomizeMode ? 'DRAG TO REORDER' : 'VIEW MODE'}
          </Text>
        </View>

        {isCustomizeMode ? (
          <DragDropList
            data={dragDropItems}
            onReorder={handleReorder}
            itemHeight={84} // Fixed height for each exercise card
            renderItem={renderDragDropItem}
            keyExtractor={keyExtractor}
          />
        ) : (
          // Use regular FlatList for non-customize mode for better performance
          <View style={{ flex: 1 }}>
            {exercises.map((exercise, index) => (
              <View key={exercise.id} style={styles.exerciseCardContainer}>
                <ExerciseDragCard
                  exercise={exercise}
                  index={index}
                  currentExerciseIndex={currentExerciseIndex}
                  isCustomizeMode={false}
                  isDragging={false}
                  exerciseSets={exerciseSets || {}}
                  onPress={() => onExercisePress(index)}
                  onRemove={() => onRemoveExercise(index)}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    );
  } catch (error) {
    console.error('ExerciseListDragDrop: Error in render:', error);
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error loading exercise list</Text>
        <Text style={styles.errorSubtext}>Please try again or contact support</Text>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  sectionHeaderContainer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    paddingTop: SPACING.md,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exerciseCardContainer: { marginBottom: SPACING.sm },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: 8,
    margin: 16,
  },
  errorText: {
    color: '#FF5252',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: { color: '#FF5252', fontSize: 14, textAlign: 'center', opacity: 0.8 },
});

export default ExerciseListDragDrop;
