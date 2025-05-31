import { Ionicons } from '@expo/vector-icons';
import React, { useCallback } from 'react';
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/theme';
import type { ExerciseData } from '../features/workout/types';
import OptimizedImage from './OptimizedImage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ITEM_HEIGHT = 88;
const _DRAG_THRESHOLD = 10;

interface ExerciseListModalProps {
  visible: boolean;
  onClose: () => void;
  exercises: ExerciseData[];
  currentExerciseIndex: number;
  onExerciseSelect: (index: number) => void;
  onCustomizeExercise?: (index: number) => void;
  onReorderExercises?: (newOrder: ExerciseData[]) => void;
}

interface DraggableExerciseItemProps {
  exercise: ExerciseData;
  index: number;
  currentExerciseIndex: number;
  onExerciseSelect: (index: number) => void;
  onCustomizeExercise?: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  isDragging: boolean;
  draggedIndex: number;
  totalExercises: number;
}

function DraggableExerciseItem({
  exercise,
  index,
  currentExerciseIndex,
  onExerciseSelect,
  onCustomizeExercise,
  onDragStart,
  onDragEnd,
  isDragging,
  draggedIndex,
  totalExercises,
}: DraggableExerciseItemProps) {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const opacity = useSharedValue(1);

  const isActive = index === currentExerciseIndex;
  const isUpcoming = index > currentExerciseIndex;
  const isCompleted = index < currentExerciseIndex;
  const isBeingDragged = isDragging && draggedIndex === index;

  const panGesture = Gesture.Pan()
    .onStart(() => {
      runOnJS(onDragStart)(index);

      // Simple drag start animation
      scale.value = withSpring(1.05);
      zIndex.value = 1000;
      opacity.value = withTiming(0.9);
    })
    .onUpdate((event) => {
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const moveDistance = event.translationY;
      const itemsMoved = Math.round(moveDistance / ITEM_HEIGHT);
      const newIndex = Math.max(0, Math.min(index + itemsMoved, totalExercises - 1));

      runOnJS(onDragEnd)(index, newIndex);

      // Simple return animation
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
      zIndex.value = withTiming(0);
      opacity.value = withTiming(1);
    });

  // Simplified animation style
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }, { scale: scale.value }],
      zIndex: zIndex.value,
      opacity: opacity.value,
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[animatedStyle]}>
        <TouchableOpacity
          style={[
            styles.exerciseItem,
            isActive && styles.activeExerciseItem,
            isCompleted && styles.completedExerciseItem,
            isBeingDragged && styles.draggingItem,
          ]}
          onPress={() => onExerciseSelect(index)}
          activeOpacity={0.8}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandle}>
            <Ionicons name="reorder-three-outline" size={20} color={COLORS.placeholder} />
          </View>

          <View style={styles.exerciseImageContainer}>
            {exercise.image_url ? (
              <OptimizedImage
                source={{ uri: exercise.image_url }}
                style={styles.exerciseImage}
                fallback={require('../../assets/exercises/placeholder.jpg')}
                resizeMode="cover"
                cachePolicy="immutable"
                showLoader={false}
                priority="normal"
                debugLabel={`ExerciseList-${exercise.name}`}
              />
            ) : (
              <View style={styles.exercisePlaceholder}>
                <Ionicons name="barbell-outline" size={24} color={COLORS.placeholder} />
              </View>
            )}

            {/* Completion overlay */}
            {isCompleted && <View style={styles.imageOverlay} />}
          </View>

          <View style={styles.exerciseInfo}>
            <Text style={[styles.exerciseName, isCompleted && styles.completedText]}>
              {exercise.name}
            </Text>
            <Text style={[styles.exerciseDetails, isCompleted && styles.completedText]}>
              {exercise.sets} sets × {exercise.reps_range} reps
            </Text>
          </View>

          {/* Status indicator */}
          <View style={styles.statusContainer}>
            {isCompleted && (
              <View style={styles.completedIndicator}>
                <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
              </View>
            )}
            {isActive && (
              <View style={styles.activeIndicator}>
                <Text style={styles.activeText}>CURRENT</Text>
              </View>
            )}
            {isUpcoming && (
              <View style={styles.upcomingIndicator}>
                <Text style={styles.upcomingText}>#{index + 1}</Text>
              </View>
            )}
          </View>

          {/* Customize button */}
          {onCustomizeExercise && (
            <TouchableOpacity
              style={styles.customizeButton}
              onPress={() => onCustomizeExercise(index)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="settings-outline" size={18} color={COLORS.placeholder} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
}

export default function ExerciseListModal({
  visible,
  onClose,
  exercises,
  currentExerciseIndex,
  onExerciseSelect,
  onCustomizeExercise,
  onReorderExercises,
}: ExerciseListModalProps) {
  const insets = useSafeAreaInsets();
  const [localExercises, setLocalExercises] = React.useState(exercises);
  const [isDragging, setIsDragging] = React.useState(false);
  const [draggedIndex, setDraggedIndex] = React.useState(-1);

  // Shared values for drag coordination (simplified)
  // Removed complex displacement tracking to prevent crashes

  // Modal animation
  const modalAnimation = useSharedValue(0);

  // Update local exercises when prop changes
  React.useEffect(() => {
    setLocalExercises(exercises);
  }, [exercises]);

  // Modal entrance animation
  React.useEffect(() => {
    if (visible) {
      modalAnimation.value = withSpring(1, { damping: 20, stiffness: 300 });
    } else {
      modalAnimation.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const handleDragStart = useCallback((index: number) => {
    setIsDragging(true);
    setDraggedIndex(index);
  }, []);

  const handleDragEnd = useCallback(
    (fromIndex: number, toIndex: number) => {
      try {
        setIsDragging(false);
        setDraggedIndex(-1);

        if (
          fromIndex !== toIndex &&
          toIndex >= 0 &&
          toIndex < localExercises.length &&
          fromIndex >= 0 &&
          fromIndex < localExercises.length
        ) {
          const newExercises = [...localExercises];
          const [movedExercise] = newExercises.splice(fromIndex, 1);
          newExercises.splice(toIndex, 0, movedExercise);

          setLocalExercises(newExercises);
          onReorderExercises?.(newExercises);
        }
      } catch {
        // Reset state on error
        setIsDragging(false);
        setDraggedIndex(-1);
      }
    },
    [localExercises, onReorderExercises],
  );

  const modalStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          modalAnimation.value,
          [0, 1],
          [SCREEN_HEIGHT * 0.3, 0],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(modalAnimation.value, [0, 1], [0.95, 1], Extrapolation.CLAMP),
      },
    ],
    opacity: modalAnimation.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: modalAnimation.value * 0.6,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        </Animated.View>

        <Animated.View
          style={[styles.modalContainer, { paddingBottom: insets.bottom }, modalStyle]}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Exercise List</Text>
              <Text style={styles.headerSubtitle}>{localExercises.length} exercises</Text>
            </View>

            <View style={styles.dragHint}>
              <Ionicons name="move-outline" size={20} color={COLORS.primary} />
            </View>
          </View>

          {/* Exercise List */}
          <ScrollView
            style={styles.exercisesList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.exercisesListContent}
            scrollEnabled={!isDragging}
          >
            {localExercises.map((exercise, index) => (
              <DraggableExerciseItem
                key={`${exercise.id}-${index}`}
                exercise={exercise}
                index={index}
                currentExerciseIndex={currentExerciseIndex}
                onExerciseSelect={onExerciseSelect}
                onCustomizeExercise={onCustomizeExercise}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                isDragging={isDragging}
                draggedIndex={draggedIndex}
                totalExercises={localExercises.length}
              />
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    height: SCREEN_HEIGHT * 0.85,
    paddingTop: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.disabled,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: COLORS.placeholder,
    fontSize: 14,
    marginTop: 2,
  },
  dragHint: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  exercisesList: {
    flex: 1,
  },
  exercisesListContent: {
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    minHeight: ITEM_HEIGHT,
    borderWidth: 1,
    borderColor: COLORS.disabled,
  },
  activeExerciseItem: {
    backgroundColor: COLORS.surfaceLight,
    borderColor: COLORS.primary,
  },
  completedExerciseItem: {
    backgroundColor: COLORS.surfaceLight,
    opacity: 0.7,
  },
  draggingItem: {
    backgroundColor: COLORS.surfaceLight,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  dragHandle: {
    paddingRight: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseImageContainer: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginRight: SPACING.md,
    position: 'relative',
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
  },
  exercisePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  exerciseDetails: {
    color: COLORS.placeholder,
    fontSize: 14,
  },
  completedText: {
    opacity: 0.6,
  },
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
    minWidth: 60,
  },
  completedIndicator: {
    padding: 4,
  },
  activeIndicator: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  activeText: {
    color: COLORS.background,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  upcomingIndicator: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  upcomingText: {
    color: COLORS.placeholder,
    fontSize: 12,
    fontWeight: '500',
  },
  customizeButton: {
    padding: SPACING.sm,
    marginLeft: SPACING.xs,
  },
});
