import Animated from 'react-native-reanimated';
import type { ExerciseData } from '../../features/workout/types';

export interface ExerciseListModalProps {
  visible: boolean;
  onClose: () => void;
  exercises: ExerciseData[];
  currentExerciseIndex: number;
  onExerciseSelect: (index: number) => void;
  onExerciseDetailsPress?: (exercise: ExerciseData) => void;
  onReorderExercises?: (newOrder: ExerciseData[]) => void;
  onRemoveExercise?: (index: number) => void;
  isCustomizeMode?: boolean;
  onToggleCustomizeMode?: () => void;
  onAddExercise?: () => void;
  onAddSuperset?: () => void;
  onAddCardio?: () => void;
  onApplyChanges?: (
    exercises: ExerciseData[],
    removedIndices: number[],
    addedExercises?: ExerciseData[],
  ) => void;
  pendingAddedExercises?: ExerciseData[];
}

export interface DraggableExerciseItemProps {
  exercise: ExerciseData;
  index: number;
  currentExerciseIndex: number;
  onExerciseSelect: (index: number) => void;
  onExerciseDetailsPress?: (exercise: ExerciseData) => void;
  onDragStart: (index: number) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  onDragUpdate: (draggedIndex: number, currentY: number) => void;
  isDragging: boolean;
  draggedIndex: number;
  dragTargetIndex: number;
  totalExercises: number;
  isCustomizeMode?: boolean;
  onRemoveExercise?: (index: number) => void;
  showActiveLabel?: boolean;
  customizeAnimation?: Animated.SharedValue<number>;
}

export interface ExerciseImageProps {
  exercise: ExerciseData;
  isCompleted: boolean;
  isCustomizeMode?: boolean;
  customizeAnimation?: Animated.SharedValue<number>;
}
