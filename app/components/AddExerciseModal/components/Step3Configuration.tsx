import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../styles';
import { SelectedExercise } from '../types';
import DraggableConfigurationItem from './DraggableConfigurationItem';

const ITEM_HEIGHT = 100;

export const Step3Configuration = ({
  selectedExercises,
  onAddAll,
}: {
  selectedExercises: SelectedExercise[];
  onAddAll: (exercises: SelectedExercise[]) => void;
}) => {
  const [localExercises, setLocalExercises] = useState(selectedExercises || []);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(-1);
  const [dragTargetIndex, setDragTargetIndex] = useState(-1);
  const [isInitialized, setIsInitialized] = useState(false);

  // Only initialize once when the component mounts
  useEffect(() => {
    if (!isInitialized && selectedExercises && selectedExercises.length > 0) {
      setLocalExercises(selectedExercises);
      setIsInitialized(true);
    }
  }, [selectedExercises, isInitialized]);

  const handleDragStart = useCallback((index: number) => {
    setIsDragging(true);
    setDraggedIndex(index);
    setDragTargetIndex(index);
  }, []);

  const handleDragUpdate = useCallback(
    (draggedIndex: number, currentY: number) => {
      // Simple calculation - determine target position based on drag distance
      const itemsMoved = Math.round(currentY / ITEM_HEIGHT);
      const exerciseCount = localExercises?.length || 0;
      const newTargetIndex = Math.max(0, Math.min(draggedIndex + itemsMoved, exerciseCount - 1));
      setDragTargetIndex(newTargetIndex);
    },
    [localExercises?.length],
  );

  const handleDragEnd = useCallback(
    (fromIndex: number, toIndex: number) => {
      // Reset drag state
      setIsDragging(false);
      setDraggedIndex(-1);
      setDragTargetIndex(-1);

      // Only reorder if position actually changed and localExercises exists
      if (
        localExercises &&
        fromIndex !== toIndex &&
        toIndex >= 0 &&
        toIndex < localExercises.length
      ) {
        const newExercises = [...localExercises];
        const [movedExercise] = newExercises.splice(fromIndex, 1);
        newExercises.splice(toIndex, 0, movedExercise);

        setLocalExercises(newExercises);
      }
    },
    [localExercises],
  );

  const handleRemoveExercise = useCallback(
    (index: number) => {
      if (localExercises) {
        const newExercises = localExercises.filter((_, i) => i !== index);
        setLocalExercises(newExercises);
      }
    },
    [localExercises],
  );

  const handleConfigurationChangeLocal = useCallback(
    (exerciseId: string, field: 'sets' | 'reps_range', value: string | number) => {
      setLocalExercises((prev) =>
        (prev || []).map((ex) => (ex.id === exerciseId ? { ...ex, [field]: value } : ex)),
      );
      // Don't call onConfigurationChange here to avoid triggering parent re-renders
      // The parent will get the updated exercises when onAddAll is called
    },
    [],
  );

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.configurationList}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isDragging}
      >
        {(localExercises || []).map((exercise, index) => (
          <DraggableConfigurationItem
            key={exercise.id}
            exercise={exercise}
            index={index}
            onConfigurationChange={handleConfigurationChangeLocal}
            onRemoveExercise={handleRemoveExercise}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragUpdate={handleDragUpdate}
            isDragging={isDragging}
            draggedIndex={draggedIndex}
            dragTargetIndex={dragTargetIndex}
            totalExercises={localExercises?.length || 0}
          />
        ))}
      </ScrollView>

      <View style={styles.stepActions}>
        <Text style={styles.summaryText}>Selected Exercises: {localExercises?.length || 0}</Text>

        <TouchableOpacity
          style={[
            styles.nextButton,
            (localExercises?.length || 0) === 0 && styles.nextButtonDisabled,
          ]}
          onPress={() => onAddAll(localExercises || [])}
          disabled={(localExercises?.length || 0) === 0}
        >
          <Text style={styles.nextButtonText}>Add All</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
