import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo } from 'react';
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

interface ExerciseListModalProps {
  visible: boolean;
  onClose: () => void;
  exercises: ExerciseData[];
  currentExerciseIndex: number;
  onExerciseSelect: (index: number) => void;
  onReorderExercises?: (newOrder: ExerciseData[]) => void;
  onRemoveExercise?: (index: number) => void;
}

// Custom hook for drag animations
function useDragAnimations() {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const startDragAnimation = useCallback(() => {
    scale.value = withSpring(1.05, { damping: 20, stiffness: 400 });
    opacity.value = withTiming(0.9, { duration: 100 });
  }, []);

  const endDragAnimation = useCallback(() => {
    translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
    scale.value = withSpring(1, { damping: 20, stiffness: 300 });
    opacity.value = withTiming(1, { duration: 200 });
  }, []);

  const updateDragPosition = useCallback((y: number) => {
    translateY.value = y;
  }, []);

  const updateDisplacement = useCallback((displacement: number) => {
    translateY.value = withSpring(displacement, { damping: 20, stiffness: 300 });
  }, []);

  return {
    animatedStyle,
    startDragAnimation,
    endDragAnimation,
    updateDragPosition,
    updateDisplacement,
  };
}

// Custom hook for drag displacement logic
function useDragDisplacement(
  index: number,
  isDragging: boolean,
  draggedIndex: number,
  dragTargetIndex: number,
  isBeingDragged: boolean,
) {
  const shouldMoveUp = useMemo(() => {
    return (
      isDragging &&
      !isBeingDragged &&
      draggedIndex < index &&
      index <= dragTargetIndex &&
      dragTargetIndex > draggedIndex
    );
  }, [isDragging, isBeingDragged, draggedIndex, index, dragTargetIndex]);

  const shouldMoveDown = useMemo(() => {
    return (
      isDragging &&
      !isBeingDragged &&
      draggedIndex > index &&
      index >= dragTargetIndex &&
      dragTargetIndex < draggedIndex
    );
  }, [isDragging, isBeingDragged, draggedIndex, index, dragTargetIndex]);

  return { shouldMoveUp, shouldMoveDown };
}

// Exercise status indicator component
function ExerciseStatusIndicator({
  isCompleted,
  isActive,
  isUpcoming,
  index,
}: {
  isCompleted: boolean;
  isActive: boolean;
  isUpcoming: boolean;
  index: number;
}) {
  if (isCompleted) {
    return (
      <View style={styles.completedIndicator}>
        <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
      </View>
    );
  }

  if (isActive) {
    return (
      <View style={styles.activeIndicator}>
        <Text style={styles.activeText}>CURRENT</Text>
      </View>
    );
  }

  if (isUpcoming) {
    return (
      <View style={styles.upcomingIndicator}>
        <Text style={styles.upcomingText}>#{index + 1}</Text>
      </View>
    );
  }

  return null;
}

// Exercise image component
function ExerciseImage({
  exercise,
  isCompleted,
}: {
  exercise: ExerciseData;
  isCompleted: boolean;
}) {
  return (
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
      {isCompleted && <View style={styles.imageOverlay} />}
    </View>
  );
}

interface DraggableExerciseItemProps {
  exercise: ExerciseData;
  index: number;
  currentExerciseIndex: number;
  onExerciseSelect: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  onDragUpdate: (draggedIndex: number, currentY: number) => void;
  isDragging: boolean;
  draggedIndex: number;
  dragTargetIndex: number;
  totalExercises: number;
  isCustomizeMode?: boolean;
  onRemoveExercise?: (index: number) => void;
}

function DraggableExerciseItem({
  exercise,
  index,
  currentExerciseIndex,
  onExerciseSelect,
  onDragStart,
  onDragEnd,
  onDragUpdate,
  isDragging,
  draggedIndex,
  dragTargetIndex,
  totalExercises,
  isCustomizeMode,
  onRemoveExercise,
}: DraggableExerciseItemProps) {
  const isActive = index === currentExerciseIndex;
  const isUpcoming = index > currentExerciseIndex;
  const isCompleted = index < currentExerciseIndex;
  const isBeingDragged = isDragging && draggedIndex === index;

  const { shouldMoveUp, shouldMoveDown } = useDragDisplacement(
    index,
    isDragging,
    draggedIndex,
    dragTargetIndex,
    isBeingDragged,
  );

  const {
    animatedStyle,
    startDragAnimation,
    endDragAnimation,
    updateDragPosition,
    updateDisplacement,
  } = useDragAnimations();

  // Apply displacement animation
  React.useEffect(() => {
    if (isBeingDragged) return;

    if (shouldMoveUp) {
      updateDisplacement(-ITEM_HEIGHT);
    } else if (shouldMoveDown) {
      updateDisplacement(ITEM_HEIGHT);
    } else {
      updateDisplacement(0);
    }
  }, [shouldMoveUp, shouldMoveDown, isBeingDragged, updateDisplacement]);

  const handlePress = useCallback(() => {
    if (!isDragging) {
      onExerciseSelect(index);
    }
  }, [isDragging, onExerciseSelect, index]);

  const handleRemove = useCallback(() => {
    if (!isDragging && onRemoveExercise) {
      onRemoveExercise(index);
    }
  }, [isDragging, onRemoveExercise, index]);

  const safeHapticFeedback = useCallback((style: Haptics.ImpactFeedbackStyle) => {
    try {
      Haptics.impactAsync(style);
    } catch {
      // Haptics might not be available on all devices
    }
  }, []);

  const panGesture = useMemo(() => {
    // Only enable drag gesture when in customize mode
    if (!isCustomizeMode) {
      return Gesture.Pan().enabled(false);
    }

    return Gesture.Pan()
      .minDistance(5)
      .onStart(() => {
        'worklet';
        runOnJS(onDragStart)(index);
        runOnJS(safeHapticFeedback)(Haptics.ImpactFeedbackStyle.Medium);
        runOnJS(startDragAnimation)();
      })
      .onUpdate((event) => {
        'worklet';
        if (isBeingDragged) {
          runOnJS(updateDragPosition)(event.translationY);
          runOnJS(onDragUpdate)(index, event.translationY);
        }
      })
      .onEnd((event) => {
        'worklet';
        if (!isBeingDragged) return;

        const moveDistance = event.translationY;
        const itemsMoved = Math.round(moveDistance / ITEM_HEIGHT);
        const newIndex = Math.max(0, Math.min(index + itemsMoved, totalExercises - 1));

        runOnJS(endDragAnimation)();

        if (newIndex !== index) {
          runOnJS(safeHapticFeedback)(Haptics.ImpactFeedbackStyle.Light);
        }

        runOnJS(onDragEnd)(index, newIndex);
      });
  }, [
    index,
    isBeingDragged,
    totalExercises,
    onDragStart,
    onDragEnd,
    onDragUpdate,
    safeHapticFeedback,
    startDragAnimation,
    endDragAnimation,
    updateDragPosition,
    isCustomizeMode,
  ]);

  const itemStyle = [
    styles.exerciseItem,
    isActive && styles.activeExerciseItem,
    isCompleted && styles.completedExerciseItem,
    isBeingDragged && styles.draggingItem,
    {
      zIndex: isBeingDragged ? 1000 : 0,
      elevation: isBeingDragged ? 10 : 0,
    },
  ];

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          style={itemStyle}
          onPress={handlePress}
          activeOpacity={0.8}
          disabled={isDragging}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandle}>
            <Ionicons
              name="reorder-three-outline"
              size={20}
              color={isCustomizeMode ? COLORS.primary : COLORS.placeholder}
            />
          </View>

          <ExerciseImage exercise={exercise} isCompleted={isCompleted} />

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
            <ExerciseStatusIndicator
              isCompleted={isCompleted}
              isActive={isActive}
              isUpcoming={isUpcoming}
              index={index}
            />
          </View>

          {/* Remove button (only in customize mode) */}
          {isCustomizeMode && onRemoveExercise && (
            <TouchableOpacity
              style={styles.customizeButton}
              onPress={handleRemove}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              disabled={isDragging}
            >
              <Ionicons name="trash-outline" size={18} color="#FF4444" />
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
  onReorderExercises,
  onRemoveExercise,
}: ExerciseListModalProps) {
  const insets = useSafeAreaInsets();
  const [localExercises, setLocalExercises] = React.useState(exercises);
  const [isDragging, setIsDragging] = React.useState(false);
  const [draggedIndex, setDraggedIndex] = React.useState(-1);
  const [dragTargetIndex, setDragTargetIndex] = React.useState(-1);
  const [isCustomizeMode, setIsCustomizeMode] = React.useState(false);

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

  // Reset drag state when modal closes
  React.useEffect(() => {
    if (!visible) {
      setIsDragging(false);
      setDraggedIndex(-1);
      setDragTargetIndex(-1);
      setIsCustomizeMode(false);
    }
  }, [visible]);

  const handleDragStart = useCallback(
    (index: number) => {
      // Only allow drag in customize mode
      if (!isCustomizeMode) return;

      setIsDragging(true);
      setDraggedIndex(index);
      setDragTargetIndex(index);
    },
    [isCustomizeMode],
  );

  const handleDragUpdate = useCallback(
    (draggedIndex: number, currentY: number) => {
      // Only allow drag updates in customize mode
      if (!isCustomizeMode) return;

      // Simple calculation - determine target position based on drag distance
      const itemsMoved = Math.round(currentY / ITEM_HEIGHT);
      const newTargetIndex = Math.max(
        0,
        Math.min(draggedIndex + itemsMoved, localExercises.length - 1),
      );
      setDragTargetIndex(newTargetIndex);
    },
    [localExercises.length, isCustomizeMode],
  );

  const handleDragEnd = useCallback(
    (fromIndex: number, toIndex: number) => {
      // Only allow drag end in customize mode
      if (!isCustomizeMode) return;

      // Reset drag state
      setIsDragging(false);
      setDraggedIndex(-1);
      setDragTargetIndex(-1);

      // Only reorder if position actually changed
      if (fromIndex !== toIndex && toIndex >= 0 && toIndex < localExercises.length) {
        const newExercises = [...localExercises];
        const [movedExercise] = newExercises.splice(fromIndex, 1);
        newExercises.splice(toIndex, 0, movedExercise);

        setLocalExercises(newExercises);
        onReorderExercises?.(newExercises);
      }
    },
    [localExercises, onReorderExercises, isCustomizeMode],
  );

  const handleToggleCustomizeMode = useCallback(() => {
    setIsCustomizeMode(!isCustomizeMode);
  }, [isCustomizeMode]);

  const handleRemoveExercise = useCallback(
    (index: number) => {
      // Only allow removal in customize mode
      if (!isCustomizeMode || !onRemoveExercise) return;

      onRemoveExercise(index);
      // Update local exercises by removing the exercise at the given index
      const newExercises = localExercises.filter((_, i) => i !== index);
      setLocalExercises(newExercises);
    },
    [localExercises, onRemoveExercise, isCustomizeMode],
  );

  const modalStyle = useAnimatedStyle(() => {
    'worklet';
    return {
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
    };
  });

  const backdropStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: modalAnimation.value * 0.6,
    };
  });

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
          <View style={styles.container}>
            <View style={styles.topGlowLeft} />
            <View style={styles.topGlowRight} />
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>

              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>
                  {isCustomizeMode ? 'CUSTOMIZE LIST' : 'EXERCISE LIST'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {localExercises.length} exercises
                  {isDragging
                    ? ' • Drag to reorder'
                    : isCustomizeMode
                      ? ' • Drag to reorder • Tap trash to remove'
                      : ' • Drag to reorder'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleToggleCustomizeMode}
                style={styles.customizeHeaderButton}
              >
                <Text style={styles.customizeHeaderButtonText}>
                  {isCustomizeMode ? 'Done' : 'Customize'}
                </Text>
              </TouchableOpacity>
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
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragUpdate={handleDragUpdate}
                  isDragging={isDragging}
                  draggedIndex={draggedIndex}
                  dragTargetIndex={dragTargetIndex}
                  totalExercises={localExercises.length}
                  isCustomizeMode={isCustomizeMode}
                  onRemoveExercise={handleRemoveExercise}
                />
              ))}
            </ScrollView>
          </View>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 0,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
  },
  topGlowLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 20,
    height: 20,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    backgroundColor: 'transparent',
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 20,
    zIndex: 10,
  },
  topGlowRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderTopRightRadius: BORDER_RADIUS.xl,
    backgroundColor: 'transparent',
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 20,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 0.2,
    borderBottomColor: COLORS.primary,
    backgroundColor: COLORS.background,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerSubtitle: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 2,
    textAlign: 'center',
  },
  customizeHeaderButton: {
    padding: SPACING.sm,
  },
  customizeHeaderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  displacedItem: {
    backgroundColor: COLORS.surfaceLight,
    borderColor: COLORS.primary,
    opacity: 0.9,
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
