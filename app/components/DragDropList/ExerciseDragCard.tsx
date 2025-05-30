import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OptimizedImage from '../OptimizedImage';
import { COLORS, SPACING } from '../../constants/theme';
import { DragDropItem, ExerciseSet } from './types';

// Helper function to get placeholder image
const getPlaceholderImage = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../../assets/exercises/placeholder.jpg');
};

interface ExerciseDragCardProps {
  exercise: DragDropItem;
  index: number;
  currentExerciseIndex: number;
  isCustomizeMode: boolean;
  isDragging: boolean;
  exerciseSets: Record<string, ExerciseSet[]>;
  onPress: () => void;
  onRemove: () => void;
}

// Helper function to calculate card state
const useCardState = (
  exercise: DragDropItem | null,
  index: number,
  currentExerciseIndex: number,
  exerciseSets: Record<string, ExerciseSet[]>,
) => {
  return React.useMemo(() => {
    if (!exercise) {
      return {
        isCompleted: false,
        isPast: false,
        isCurrent: false,
        completedSets: 0,
        totalSets: 0,
      };
    }

    const sets = exerciseSets[exercise.id] || [];
    const completed = sets.filter((set) => set.isCompleted === true).length;
    const total = sets.length;

    return {
      isCompleted: completed === total && total > 0,
      isPast: index < currentExerciseIndex,
      isCurrent: index === currentExerciseIndex,
      completedSets: completed,
      totalSets: total,
    };
  }, [exercise?.id, index, currentExerciseIndex, exerciseSets]);
};

// Helper function to get image source
const useImageSource = (exercise: DragDropItem | null) => {
  return React.useMemo(() => {
    if (!exercise) return getPlaceholderImage();

    const hasValidImageUrl =
      exercise?.image_url &&
      exercise.image_url.trim() !== '' &&
      exercise.image_url !== 'null' &&
      exercise.image_url !== 'undefined';

    return hasValidImageUrl ? { uri: exercise.image_url } : getPlaceholderImage();
  }, [exercise?.image_url]);
};

// Helper function to get card styles
const getCardStyles = (
  isCurrent: boolean,
  isCompleted: boolean,
  isPast: boolean,
  isCustomizeMode: boolean,
  isDragging: boolean,
) => {
  return [
    styles.exerciseCard,
    isCurrent && styles.currentExerciseCard,
    isCompleted && styles.completedExerciseCard,
    isPast && styles.pastExerciseCard,
    isCustomizeMode && styles.customizeModeCard,
    isDragging && styles.draggingCard,
  ];
};

// Exercise Image Component
interface ExerciseImageProps {
  imageSource: string | number | { uri: string };
  isCurrent: boolean;
  isCompleted: boolean;
  isPast: boolean;
}

const ExerciseImage: React.FC<ExerciseImageProps> = ({
  imageSource,
  isCurrent,
  isCompleted,
  isPast,
}) => (
  <View style={[styles.exerciseImageContainer, isCurrent && styles.currentExerciseImageContainer]}>
    <OptimizedImage
      source={imageSource}
      style={[styles.exerciseImage, (isCompleted || isPast) && styles.completedExerciseImage]}
      fallback={getPlaceholderImage()}
      resizeMode="cover"
      cachePolicy="immutable"
    />
    {isCompleted && (
      <View style={styles.completedOverlay}>
        <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
      </View>
    )}
  </View>
);

// Exercise Info Component
interface ExerciseInfoProps {
  exercise: DragDropItem;
  isCurrent: boolean;
  isCompleted: boolean;
  isPast: boolean;
  completedSets: number;
  totalSets: number;
}

const ExerciseInfo: React.FC<ExerciseInfoProps> = ({
  exercise,
  isCurrent,
  isCompleted,
  isPast,
  completedSets,
  totalSets,
}) => (
  <View style={styles.exerciseInfo}>
    <Text
      style={[styles.exerciseName, (isCompleted || isPast) && styles.completedExerciseName]}
      numberOfLines={2}
      ellipsizeMode="tail"
    >
      {exercise?.name || 'Exercise'}
      {isCurrent && ' • CURRENT'}
    </Text>
    <Text
      style={[styles.exerciseDetails, (isCompleted || isPast) && styles.completedExerciseDetails]}
    >
      {completedSets}/{totalSets} sets x {exercise?.reps_range || '0'} reps
    </Text>
  </View>
);

// Drag Handle Component
const DragHandle: React.FC = () => (
  <View style={styles.dragHandle}>
    <View style={styles.dragLine} />
    <View style={styles.dragLine} />
    <View style={styles.dragLine} />
  </View>
);

// Remove Button Component
interface RemoveButtonProps {
  isCustomizeMode: boolean;
  onRemove: () => void;
}

const RemoveButton: React.FC<RemoveButtonProps> = ({ isCustomizeMode, onRemove }) => {
  if (!isCustomizeMode) return null;

  return (
    <TouchableOpacity style={styles.recycleIconContainer} onPress={onRemove}>
      <Ionicons name="trash-outline" size={20} color={'#FF5252'} />
    </TouchableOpacity>
  );
};

// Main Component
const ExerciseDragCard: React.FC<ExerciseDragCardProps> = ({
  exercise,
  index,
  currentExerciseIndex,
  isCustomizeMode,
  isDragging,
  exerciseSets,
  onPress,
  onRemove,
}) => {
  const cardState = useCardState(exercise, index, currentExerciseIndex, exerciseSets);
  const imageSource = useImageSource(exercise);
  const { isCompleted, isPast, isCurrent, completedSets, totalSets } = cardState;
  const cardStyles = getCardStyles(isCurrent, isCompleted, isPast, isCustomizeMode, isDragging);

  return (
    <View style={cardStyles}>
      <TouchableOpacity style={styles.exerciseCardContent} onPress={onPress} activeOpacity={0.7}>
        <ExerciseImage
          imageSource={imageSource}
          isCurrent={isCurrent}
          isCompleted={isCompleted}
          isPast={isPast}
        />

        <ExerciseInfo
          exercise={exercise}
          isCurrent={isCurrent}
          isCompleted={isCompleted}
          isPast={isPast}
          completedSets={completedSets}
          totalSets={totalSets}
        />

        <DragHandle />

        <RemoveButton isCustomizeMode={isCustomizeMode} onRemove={onRemove} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1D22',
    borderRadius: 16,
    padding: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    height: 76,
    overflow: 'hidden',
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.xs,
  },
  currentExerciseCard: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.8)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  completedExerciseCard: {
    backgroundColor: 'rgba(28, 29, 34, 0.6)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
    opacity: 0.8,
  },
  pastExerciseCard: {
    backgroundColor: 'rgba(28, 29, 34, 0.7)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    opacity: 0.7,
  },
  customizeModeCard: {
    borderWidth: 0.3,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  draggingCard: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  exerciseCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
    position: 'relative',
  },
  exerciseImageContainer: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 14,
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 0.3,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  currentExerciseImageContainer: {
    borderWidth: 0.5,
    borderColor: 'rgba(138, 80, 255, 0.4)',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    backgroundColor: 'rgba(138, 80, 255, 0.08)',
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
  },
  completedExerciseImage: {
    opacity: 0.5,
  },
  completedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseInfo: {
    flex: 1,
    marginRight: 50,
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 5,
    letterSpacing: 0.3,
    lineHeight: 18,
    flexShrink: 1,
  },
  completedExerciseName: {
    opacity: 0.75,
    textDecorationLine: 'line-through',
    textDecorationColor: 'rgba(76, 175, 80, 0.8)',
  },
  exerciseDetails: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  completedExerciseDetails: {
    opacity: 0.6,
  },
  dragHandle: {
    position: 'absolute',
    right: 50,
    top: '50%',
    transform: [{ translateY: -12 }],
    width: 20,
    height: 24,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dragLine: {
    width: 16,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 1,
  },
  recycleIconContainer: {
    position: 'absolute',
    right: 6,
    top: '40%',
    transform: [{ translateY: -12 }],
    zIndex: 999,
    padding: 0,
    backgroundColor: 'rgba(138, 80, 255, 0.15)',
    borderRadius: 26,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(138, 80, 255, 0.33)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});

export default ExerciseDragCard;
