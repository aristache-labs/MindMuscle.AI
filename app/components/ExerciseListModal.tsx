import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, { 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedGestureHandler, 
  runOnJS,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import OptimizedImage from './OptimizedImage';
import ExerciseMaxWeightGraph from './ExerciseMaxWeightGraph';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const EXERCISE_CARD_HEIGHT = 96; // Height of each exercise card
const DRAG_THRESHOLD = 10; // Pixels to move before starting drag

// Draggable Exercise Card Component
interface DraggableExerciseCardProps {
  exercise: Exercise;
  index: number;
  currentExerciseIndex: number;
  isCustomizeMode: boolean;
  exerciseSets: Record<string, any[]>;
  onPress: () => void;
  onRemove: () => void;
  onDragStart: (index: number) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  isDragging: boolean;
  draggedIndex: number | null;
}

const DraggableExerciseCard: React.FC<DraggableExerciseCardProps> = ({
  exercise,
  index,
  currentExerciseIndex,
  isCustomizeMode,
  exerciseSets,
  onPress,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  draggedIndex,
}) => {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const opacity = useSharedValue(1);
  
  const isBeingDragged = draggedIndex === index;
  const shouldShift = draggedIndex !== null && draggedIndex !== index;
  
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, context: any) => {
      if (!isCustomizeMode) return;
      
      context.startY = translateY.value;
      scale.value = withSpring(1.08, { damping: 15, stiffness: 200 });
      zIndex.value = 1000;
      opacity.value = withTiming(0.95, { duration: 150 });
      runOnJS(onDragStart)(index);
    },
    onActive: (event, context: any) => {
      if (!isCustomizeMode) return;
      
      translateY.value = context.startY + event.translationY;
      
      // Add subtle rotation based on drag velocity for more natural feel
      const rotation = Math.max(-3, Math.min(3, event.velocityY / 1000));
      
      // Calculate which position this should be dropped to
      const newIndex = Math.round((context.startY + event.translationY) / EXERCISE_CARD_HEIGHT) + index;
      const clampedIndex = Math.max(0, Math.min(newIndex, exerciseSets ? Object.keys(exerciseSets).length - 1 : 0));
      
      // Smooth scale animation based on drag distance
      const dragDistance = Math.abs(event.translationY);
      const scaleValue = 1.08 + Math.min(0.04, dragDistance / 1000);
      scale.value = withSpring(scaleValue, { damping: 20, stiffness: 300 });
    },
    onEnd: (event, context: any) => {
      if (!isCustomizeMode) return;
      
      const newIndex = Math.round((context.startY + event.translationY) / EXERCISE_CARD_HEIGHT) + index;
      const clampedIndex = Math.max(0, Math.min(newIndex, exerciseSets ? Object.keys(exerciseSets).length - 1 : 0));
      
      // Smooth return animations with spring physics
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      scale.value = withSpring(1, { damping: 18, stiffness: 250 });
      zIndex.value = 0;
      opacity.value = withTiming(1, { duration: 200 });
      
      if (clampedIndex !== index) {
        runOnJS(onDragEnd)(index, clampedIndex);
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    let transform = [];
    
    if (isBeingDragged) {
      transform.push({ translateY: translateY.value });
      transform.push({ scale: scale.value });
      // Add subtle rotation for more natural drag feel
      const rotation = Math.max(-2, Math.min(2, translateY.value / 200));
      transform.push({ rotate: `${rotation}deg` });
    } else if (shouldShift && draggedIndex !== null) {
      // Smooth shift animation for other items
      const shiftAmount = draggedIndex < index ? -EXERCISE_CARD_HEIGHT : EXERCISE_CARD_HEIGHT;
      transform.push({ 
        translateY: withSpring(shiftAmount, { 
          damping: 25, 
          stiffness: 400,
          mass: 0.8 
        }) 
      });
    } else {
      // Smooth return to original position
      transform.push({ 
        translateY: withSpring(0, { 
          damping: 25, 
          stiffness: 400,
          mass: 0.8 
        }) 
      });
    }
    
    // Enhanced scale animation for current exercise
    if (isCurrent && !isBeingDragged) {
      transform.push({ 
        scale: withSpring(1.02, { 
          damping: 25, 
          stiffness: 300,
          mass: 0.9 
        }) 
      });
    }
    
    return {
      transform,
      zIndex: zIndex.value,
      opacity: opacity.value,
      // Add subtle shadow enhancement during drag
      shadowOpacity: isBeingDragged ? 0.3 : 0.1,
      elevation: isBeingDragged ? 15 : 4,
    };
  });

  const getCompletedSets = (exerciseId: string): number => {
    const sets = exerciseSets[exerciseId] || [];
    return sets.filter(set => set.isCompleted).length;
  };

  const getTotalSets = (exerciseId: string): number => {
    const sets = exerciseSets[exerciseId] || [];
    return sets.length;
  };

  const getMuscleTagColor = (muscle: string) => {
    const muscleColors: Record<string, string> = {
      'Chest': '#FF6B6B',
      'Back': '#4ECDC4',
      'Shoulders': '#45B7D1',
      'Arms': '#96CEB4',
      'Legs': '#FFEAA7',
      'Core': '#DDA0DD',
      'Glutes': '#F39C12',
      'Biceps': '#96CEB4',
      'Triceps': '#96CEB4',
      'Quadriceps': '#FFEAA7',
      'Hamstrings': '#FFEAA7',
      'Calves': '#FFEAA7',
      'Lats': '#4ECDC4',
      'Traps': '#4ECDC4',
      'Delts': '#45B7D1',
      'Abs': '#DDA0DD',
    };
    return muscleColors[muscle] || '#FFD700';
  };

  const getImageSource = () => {
    const hasValidImageUrl = exercise?.image_url && 
                             exercise.image_url.trim() !== '' && 
                             exercise.image_url !== 'null' && 
                             exercise.image_url !== 'undefined';
    
    if (hasValidImageUrl) {
      return { uri: exercise.image_url };
    } else {
      return require('../../assets/exercises/placeholder.jpg');
    }
  };

  const isCompleted = getCompletedSets(exercise.id) === getTotalSets(exercise.id) && getTotalSets(exercise.id) > 0;
  const isPast = index < currentExerciseIndex;
  const isCurrent = index === currentExerciseIndex;

  return (
    <Reanimated.View style={[animatedStyle, { height: EXERCISE_CARD_HEIGHT }]}>
      <PanGestureHandler
        onGestureEvent={gestureHandler}
        enabled={isCustomizeMode}
        minPointers={1}
        maxPointers={1}
        activeOffsetY={[-8, 8]}
        failOffsetX={[-20, 20]}
        shouldCancelWhenOutside={false}
      >
        <Reanimated.View
          style={[
            styles.exerciseCard,
            isCurrent && styles.currentExerciseCard,
            isCompleted && styles.completedExerciseCard,
            isPast && styles.pastExerciseCard,
            isCustomizeMode && styles.customizeModeCard,
            { minHeight: EXERCISE_CARD_HEIGHT - SPACING.sm },
          ]}
        >
          {/* Drag Handle - only show in customize mode */}
          {isCustomizeMode && (
            <View style={styles.dragHandle}>
              <Ionicons name="menu" size={28} color="rgba(255, 255, 255, 0.9)" />
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.exerciseCardContent}
            onPress={() => !isCustomizeMode && onPress()}
            disabled={isCustomizeMode}
            activeOpacity={0.7}
          >
            <View style={[
              styles.exerciseImageContainer,
              isCurrent && styles.currentExerciseImageContainer
            ]}>
              <OptimizedImage
                source={getImageSource()}
                style={[
                  styles.exerciseImage,
                  (isCompleted || isPast) && styles.completedExerciseImage
                ]}
                fallback={require('../../assets/exercises/placeholder.jpg')}
                resizeMode="cover"
                cachePolicy="immutable"
              />
              {/* Shadow overlay when in customize mode */}
              {isCustomizeMode && (
                <View style={styles.imageShadowOverlay} />
              )}
              {isCompleted && (
                <View style={styles.completedOverlay}>
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                </View>
              )}
            </View>
            
            <View style={styles.exerciseInfo}>
              <Text 
                style={[
                  styles.exerciseName,
                  (isCompleted || isPast) && styles.completedExerciseName
                ]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {exercise.name}
              </Text>
              <Text style={[
                styles.exerciseDetails,
                (isCompleted || isPast) && styles.completedExerciseDetails
              ]}>
                {getCompletedSets(exercise.id)}/{getTotalSets(exercise.id)} sets x {exercise.reps_range} reps
              </Text>
            </View>
            
            {isCustomizeMode && (
              <TouchableOpacity 
                style={styles.recycleIconContainer}
                onPress={onRemove}
              >
                <Ionicons name="trash-outline" size={20} color={'#FF5252'} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </Reanimated.View>
      </PanGestureHandler>
    </Reanimated.View>
  );
};

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
}

interface ExerciseListModalProps {
  visible: boolean;
  onClose: () => void;
  exercises: Exercise[];
  currentExerciseIndex: number;
  onExerciseSelect: (index: number) => void;
  exerciseSets?: Record<string, any[]>;
  onStartExercise?: (index: number) => void;
  maxWeightData?: Record<string, any[]>;
  absoluteMaxWeightData?: Record<string, any>;
  recommendations?: Record<string, any>;
  lastExerciseValues?: Record<string, Record<number, { weight: string, reps: string }>>;
  initialSelectedExerciseIndex?: number | null;
  onCustomizeExercise?: (exerciseIndex: number) => void;
  onReorderExercises?: (exercises: Exercise[]) => void;
  onRemoveExercise?: (exerciseIndex: number) => void;
}

export default function ExerciseListModal({
  visible,
  onClose,
  exercises,
  currentExerciseIndex,
  onExerciseSelect,
  exerciseSets = {},
  onStartExercise,
  maxWeightData = {},
  absoluteMaxWeightData = {},
  recommendations = {},
  lastExerciseValues = {},
  initialSelectedExerciseIndex = null,
  onCustomizeExercise,
  onReorderExercises,
  onRemoveExercise
}: ExerciseListModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number | null>(null);
  const [isCustomizeMode, setIsCustomizeMode] = useState(false);
  const [showBottomMenu, setShowBottomMenu] = useState(false);
  const [localExercises, setLocalExercises] = useState<Exercise[]>(exercises);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const slideAnim = useRef(new Animated.Value(screenWidth)).current;
  const bottomMenuAnim = useRef(new Animated.Value(100)).current;

  // Sync local exercises with props
  useEffect(() => {
    setLocalExercises(exercises);
  }, [exercises]);

  // Handle initial selected exercise when modal becomes visible
  useEffect(() => {
    if (visible && initialSelectedExerciseIndex !== null) {
      setSelectedExerciseIndex(initialSelectedExerciseIndex);
      // Animate slide in from right immediately
      slideAnim.setValue(screenWidth);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, initialSelectedExerciseIndex]);

  const handleExercisePress = (index: number) => {
    setSelectedExerciseIndex(index);
    // Animate slide in from right
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const resetModal = () => {
    setSelectedExerciseIndex(null);
    setIsCustomizeMode(false);
    setShowBottomMenu(false);
    slideAnim.setValue(screenWidth);
    bottomMenuAnim.setValue(100);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleCustomizePress = () => {
    const newCustomizeMode = !isCustomizeMode;
    setIsCustomizeMode(newCustomizeMode);
    setShowBottomMenu(newCustomizeMode);
    
    // Apply reorder changes when exiting customize mode
    if (!newCustomizeMode) {
      // Apply reorder changes if any
      if (onReorderExercises && JSON.stringify(localExercises) !== JSON.stringify(exercises)) {
        onReorderExercises(localExercises);
      }
    }
    
    // Animate bottom menu
    Animated.timing(bottomMenuAnim, {
      toValue: newCustomizeMode ? 0 : 100,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
    setIsDragging(true);
  };

  const handleDragEnd = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      setDraggedIndex(null);
      setIsDragging(false);
      return;
    }

    const newExercises = [...localExercises];
    const movedExercise = newExercises.splice(fromIndex, 1)[0];
    newExercises.splice(toIndex, 0, movedExercise);
    
    setLocalExercises(newExercises);
    setDraggedIndex(null);
    setIsDragging(false);
  };

  const handleRemoveExercise = (index: number) => {
    if (!isCustomizeMode || !onRemoveExercise) return;
    
    // Adjust index based on current vs other exercises
    let actualIndex = index;
    if (index > currentExerciseIndex) {
      actualIndex = index; // Keep the same index for exercises after current
    } else if (index === currentExerciseIndex) {
      actualIndex = currentExerciseIndex; // Current exercise
    } else {
      actualIndex = index; // Exercises before current
    }
    
    onRemoveExercise(actualIndex);
  };

  const handleBackToList = () => {
    // Animate slide out to right
    Animated.timing(slideAnim, {
      toValue: screenWidth,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setSelectedExerciseIndex(null);
    });
  };

  const handleStartExercise = () => {
    if (selectedExerciseIndex !== null) {
      onExerciseSelect(selectedExerciseIndex);
      if (onStartExercise) {
        onStartExercise(selectedExerciseIndex);
      }
      resetModal();
      onClose();
    }
  };

  const getCompletedSets = (exerciseId: string): number => {
    const sets = exerciseSets[exerciseId] || [];
    return sets.filter(set => set.isCompleted).length;
  };

  const getTotalSets = (exerciseId: string): number => {
    const sets = exerciseSets[exerciseId] || [];
    return sets.length;
  };

  const getMuscleTagColor = (muscle: string) => {
    const muscleColors: Record<string, string> = {
      'Chest': '#FF6B6B',
      'Back': '#4ECDC4',
      'Shoulders': '#45B7D1',
      'Arms': '#96CEB4',
      'Legs': '#FFEAA7',
      'Core': '#DDA0DD',
      'Glutes': '#F39C12',
      'Biceps': '#96CEB4',
      'Triceps': '#96CEB4',
      'Quadriceps': '#FFEAA7',
      'Hamstrings': '#FFEAA7',
      'Calves': '#FFEAA7',
      'Lats': '#4ECDC4',
      'Traps': '#4ECDC4',
      'Delts': '#45B7D1',
      'Abs': '#DDA0DD',
    };
    return muscleColors[muscle] || '#FFD700';
  };

  const getSuggestedValue = (exerciseId: string, exerciseExerciseId: string, setNumber: number, type: 'weight' | 'reps'): string => {
    const recommendation = recommendations[exerciseId];
    
    if (type === 'weight') {
      if (recommendation?.recommended_weight) {
        return recommendation.recommended_weight.toString();
      }
      // Fallback to last weight if no recommendation
      const lastWeight = lastExerciseValues[exerciseExerciseId]?.[setNumber]?.weight;
      return lastWeight && lastWeight !== '-' && lastWeight !== '0' ? lastWeight : '--';
    } else {
      if (recommendation?.recommended_reps) {
        return recommendation.recommended_reps.toString();
      }
      // Fallback to last reps if no recommendation
      const lastReps = lastExerciseValues[exerciseExerciseId]?.[setNumber]?.reps;
      return lastReps && lastReps !== '-' && lastReps !== '0' ? lastReps : '--';
    }
  };

  const getLastValue = (exerciseExerciseId: string, setNumber: number, type: 'weight' | 'reps'): string => {
    const lastValue = lastExerciseValues[exerciseExerciseId]?.[setNumber]?.[type];
    return lastValue && lastValue !== '-' && lastValue !== '0' ? lastValue : '--';
  };

  // Helper function to determine the image source safely
  const getImageSource = (exercise: Exercise) => {
    // Check if we have a valid image URL
    const hasValidImageUrl = exercise?.image_url && 
                             exercise.image_url.trim() !== '' && 
                             exercise.image_url !== 'null' && 
                             exercise.image_url !== 'undefined';
    
    if (hasValidImageUrl) {
      return { uri: exercise.image_url };
    } else {
      // Use placeholder directly for local assets to prevent any loading attempts
      return require('../../assets/exercises/placeholder.jpg');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={styles.modalOverlay}>
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
            
            {/* Header with border and glow effect */}
            <View style={styles.header}>
              {selectedExerciseIndex !== null ? (
                <>
                  <TouchableOpacity onPress={handleBackToList} style={styles.headerButton}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.text} />
                  </TouchableOpacity>
                  
                  <Text style={styles.headerTitle}>Next Exercise</Text>
                  
                  <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
                    <Text style={styles.headerButtonText}>Close</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
                    <Text style={styles.headerButtonText}>Close</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>
                      {isCustomizeMode ? 'Customize List' : 'Exercise List'}
                    </Text>
                  </View>
                  
                  <TouchableOpacity onPress={handleCustomizePress} style={styles.headerButton}>
                    <Text style={[styles.headerButtonText, isCustomizeMode && styles.activeCustomizeText]}>
                      {isCustomizeMode ? 'Done' : 'Customize'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Main Content Area */}
            <View style={styles.contentContainer}>
              {/* Exercise List View */}
              <View style={styles.listView}>
                {/* Active Exercise Section */}
                <View style={styles.activeExerciseSection}>
                  <Text style={styles.sectionTitle}>Active Exercise</Text>
                  {localExercises[currentExerciseIndex] && (
                    <DraggableExerciseCard
                      key={`active-${localExercises[currentExerciseIndex].id}`}
                      exercise={localExercises[currentExerciseIndex]}
                      index={currentExerciseIndex}
                      currentExerciseIndex={currentExerciseIndex}
                      isCustomizeMode={isCustomizeMode}
                      exerciseSets={exerciseSets}
                      onPress={() => handleExercisePress(currentExerciseIndex)}
                      onRemove={() => handleRemoveExercise(currentExerciseIndex)}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      isDragging={isDragging}
                      draggedIndex={draggedIndex}
                    />
                  )}
                </View>

                {/* Upcoming Exercises Section */}
                <View style={styles.upcomingExercisesSection}>
                  <Text style={styles.sectionTitle}>
                    Upcoming Exercises ({localExercises.length - currentExerciseIndex - 1})
                  </Text>
                  
                  <ScrollView 
                    style={styles.exercisesList}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={!isDragging} // Disable scroll when dragging
                  >
                    {localExercises.map((exercise, index) => {
                      // Skip the current exercise (shown in Active section)
                      if (index === currentExerciseIndex) return null;
                      
                      return (
                        <DraggableExerciseCard
                          key={exercise.id}
                          exercise={exercise}
                          index={index}
                          currentExerciseIndex={currentExerciseIndex}
                          isCustomizeMode={isCustomizeMode}
                          exerciseSets={exerciseSets}
                          onPress={() => handleExercisePress(index)}
                          onRemove={() => handleRemoveExercise(index)}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          isDragging={isDragging}
                          draggedIndex={draggedIndex}
                        />
                      );
                    })}
                    
                    {/* Show message if no upcoming exercises */}
                    {localExercises.length - currentExerciseIndex - 1 === 0 && (
                      <View style={styles.noUpcomingExercises}>
                        <Text style={styles.noUpcomingText}>
                          🎉 This is your last exercise!
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                </View>


              </View>

              {/* Exercise Detail View - Slides in from right */}
              {selectedExerciseIndex !== null && (
                <Animated.View 
                  style={[
                    styles.detailView,
                    {
                      transform: [{ translateX: slideAnim }]
                    }
                  ]}
                >
                  <ScrollView style={styles.detailScrollView} showsVerticalScrollIndicator={false}>
                    {/* Exercise Header */}
                    <View style={styles.detailHeader}>
                      <View style={styles.detailImageContainer}>
                        <OptimizedImage
                          source={getImageSource(localExercises[selectedExerciseIndex])}
                          style={styles.detailImage}
                          fallback={require('../../assets/exercises/placeholder.jpg')}
                          resizeMode="cover"
                          cachePolicy="immutable"
                        />
                      </View>
                      
                      <View style={styles.detailInfo}>
                        <Text style={styles.detailExerciseName}>
                          {localExercises[selectedExerciseIndex].name}
                        </Text>
                        {localExercises[selectedExerciseIndex].primary_muscles && 
                         localExercises[selectedExerciseIndex].primary_muscles!.length > 0 && (
                          <View style={styles.detailMuscleContainer}>
                            <View style={[
                              styles.detailMuscleTag, 
                              { backgroundColor: getMuscleTagColor(localExercises[selectedExerciseIndex].primary_muscles![0]) }
                            ]}>
                              <Text style={styles.detailMuscleText}>
                                {localExercises[selectedExerciseIndex].primary_muscles![0]}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Max Weight Graph Section */}
                    {localExercises[selectedExerciseIndex] && localExercises[selectedExerciseIndex].requires_weight !== false && (
                      <View style={styles.maxWeightGraphContainer}>
                        <ExerciseMaxWeightGraph
                          data={maxWeightData[localExercises[selectedExerciseIndex].exercise_id] || []}
                          exerciseName={localExercises[selectedExerciseIndex].name}
                          absoluteMaxWeight={absoluteMaxWeightData[localExercises[selectedExerciseIndex].exercise_id] || null}
                        />
                      </View>
                    )}

                    {/* Sets Section */}
                    <View style={styles.setsSection}>
                      {Array.from({ length: localExercises[selectedExerciseIndex].sets || 4 }).map((_, index) => {
                        const setNumber = index + 1;
                        const exercise = localExercises[selectedExerciseIndex];
                        
                        return (
                          <View key={index} style={styles.setRow}>
                            <View style={styles.setInfo}>
                              {exercise.requires_weight !== false ? (
                                // Exercise requires weight - show both weight and reps
                                <View style={styles.setValues}>
                                  <View style={styles.setValue}>
                                    <Text style={styles.suggestedLabel}>Suggested</Text>
                                    <View style={styles.setValueRow}>
                                      <Text style={styles.setValueNumber}>
                                        {getSuggestedValue(exercise.id, exercise.exercise_id, setNumber, 'weight')}
                                      </Text>
                                      <Text style={styles.setValueUnit}>kg</Text>
                                    </View>
                                    <Text style={styles.setValueSubtext}>
                                      ({getLastValue(exercise.exercise_id, setNumber, 'weight')})
                                    </Text>
                                  </View>
                                  <View style={styles.setValueDivider} />
                                  <View style={styles.setValue}>
                                    <Text style={styles.suggestedLabelPlaceholder}> </Text>
                                    <View style={styles.setValueRow}>
                                      <Text style={styles.setValueNumber}>
                                        {getSuggestedValue(exercise.id, exercise.exercise_id, setNumber, 'reps')}
                                      </Text>
                                      <Text style={styles.setValueUnit}>reps</Text>
                                    </View>
                                    <Text style={styles.setValueSubtext}>
                                      ({getLastValue(exercise.exercise_id, setNumber, 'reps')})
                                    </Text>
                                  </View>
                                </View>
                              ) : (
                                // Bodyweight exercise - show only reps
                                <View style={styles.setValuesSingle}>
                                  <View style={styles.setValue}>
                                    <Text style={styles.suggestedLabel}>Suggested</Text>
                                    <View style={styles.setValueRow}>
                                      <Text style={styles.setValueNumber}>
                                        {getSuggestedValue(exercise.id, exercise.exercise_id, setNumber, 'reps')}
                                      </Text>
                                      <Text style={styles.setValueUnit}>reps</Text>
                                    </View>
                                    <Text style={styles.setValueSubtext}>
                                      ({getLastValue(exercise.exercise_id, setNumber, 'reps')})
                                    </Text>
                                  </View>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {/* Customize Exercise Link */}
                    <TouchableOpacity 
                      style={styles.customizeExerciseButton}
                      onPress={() => {
                        if (onCustomizeExercise && selectedExerciseIndex !== null) {
                          onCustomizeExercise(selectedExerciseIndex);
                        }
                      }}
                    >
                      <Text style={styles.customizeExerciseText}>Customize Exercise</Text>
                    </TouchableOpacity>
                  </ScrollView>

                  {/* Start Exercise Button */}
                  <View style={styles.startExerciseContainer}>
                    <TouchableOpacity 
                      style={styles.startExerciseButton}
                      onPress={handleStartExercise}
                    >
                      <Text style={styles.startExerciseText}>
                        {selectedExerciseIndex !== currentExerciseIndex ? 'Switch to Exercise' : 'Continue Exercise'}
                      </Text>
                    </TouchableOpacity>
                    {selectedExerciseIndex !== null && selectedExerciseIndex !== currentExerciseIndex && (
                      <Text style={styles.switchExerciseNote}>
                        Current exercise will be moved to the end
                      </Text>
                    )}
                  </View>
                </Animated.View>
              )}
            </View>
          </LinearGradient>
        </View>
        
        {/* Bottom Menu */}
        {showBottomMenu && (
          <Animated.View 
            style={[
              styles.bottomMenu,
              {
                transform: [{ translateY: bottomMenuAnim }]
              }
            ]}
          >
            <View style={styles.bottomMenuContent}>
              <TouchableOpacity 
                style={styles.bottomMenuButton}
                onPress={() => {
                  // TODO: Implement add exercise functionality
                  console.log('Add Exercise pressed');
                }}
              >
                <View style={styles.bottomMenuButtonContent}>
                  <Ionicons name="add-circle" size={24} color={COLORS.primary} />
                  <Text style={styles.bottomMenuButtonText}>Add Exercise</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.bottomMenuButton}
                onPress={() => {
                  // TODO: Implement add superset functionality
                  console.log('Add Superset pressed');
                }}
              >
                <View style={styles.bottomMenuButtonContent}>
                  <Ionicons name="link" size={24} color={COLORS.primary} />
                  <Text style={styles.bottomMenuButtonText}>Add Superset</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.bottomMenuButton}
                onPress={() => {
                  // TODO: Implement add cardio functionality
                  console.log('Add Cardio pressed');
                }}
              >
                <View style={styles.bottomMenuButtonContent}>
                  <Ionicons name="heart" size={24} color={COLORS.primary} />
                  <Text style={styles.bottomMenuButtonText}>Add Cardio</Text>
                </View>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
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
    position: 'relative',
  },
  headerButton: {
    padding: SPACING.xs,
    zIndex: 1,
  },
  headerButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  currentExerciseSection: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  nextExercisesSection: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  allExercisesSection: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  activeExerciseSection: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  upcomingExercisesSection: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  noUpcomingExercises: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
  noUpcomingText: {
    color: COLORS.text,
    fontSize: 16,
    fontStyle: 'italic',
    opacity: 0.7,
    textAlign: 'center',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exercisesList: {
    flex: 1,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 52, 65, 0.95)',
    borderRadius: 12,
    padding: 8,
    marginBottom: SPACING.sm,
    borderWidth: 0.3,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    height: 76,
  },
  currentExerciseCard: {
    backgroundColor: 'rgba(138, 80, 255, 0.12)',
    borderWidth: 0.8,
    borderColor: 'rgba(138, 80, 255, 0.6)',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  completedExerciseCard: {
    backgroundColor: 'rgba(45, 52, 65, 0.6)',
    borderColor: 'rgba(76, 175, 80, 0.3)',
    opacity: 0.8,
  },
  pastExerciseCard: {
    backgroundColor: 'rgba(45, 52, 65, 0.7)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    opacity: 0.7,
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
  muscleTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  completedMuscleTag: {
    opacity: 0.6,
  },
  currentMuscleTag: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
    transform: [{ scale: 1.02 }],
  },
  muscleTagText: {
    color: COLORS.background,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  completedMuscleTagText: {
    opacity: 0.8,
  },
  // New styles for exercise detail view
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  listView: {
    flex: 1,
  },
  detailView: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    zIndex: 10,
  },
  detailScrollView: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    marginBottom: 0,
  },
  detailImageContainer: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginRight: SPACING.md,
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  detailInfo: {
    flex: 1,
  },
  detailExerciseName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  detailMuscleContainer: {
    marginTop: SPACING.xs,
  },
  detailMuscleTag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  detailMuscleText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
  maxWeightGraphContainer: {
    marginTop: 0,
    marginBottom: 0,
  },
  maxWeightSection: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  maxWeightTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
  },
  maxWeightValue: {
    color: COLORS.primary,
    fontSize: 28,
    fontWeight: 'bold',
  },
  maxWeightReps: {
    color: COLORS.text,
    fontSize: 16,
    opacity: 0.8,
  },
  maxWeightDate: {
    color: COLORS.text,
    fontSize: 14,
    opacity: 0.6,
    marginTop: SPACING.xs,
  },
  setsSection: {
    marginTop: 0,
    marginBottom: SPACING.lg,
  },
  setRow: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  setInfo: {
    width: '100%',
  },
  suggestedLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: SPACING.xs,
    opacity: 0.8,
    textAlign: 'center',
  },
  suggestedLabelPlaceholder: {
    color: 'transparent',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  setValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  setValuesSingle: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  setValue: {
    flex: 1,
    alignItems: 'center',
  },
  setValueDivider: {
    width: 1,
    backgroundColor: COLORS.text,
    opacity: 0.2,
    marginHorizontal: SPACING.md,
    alignSelf: 'stretch',
  },
  setValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  setValueNumber: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  setValueUnit: {
    color: COLORS.text,
    fontSize: 12,
    opacity: 0.8,
    marginLeft: 4,
    marginBottom: 2,
  },
  setValueSubtext: {
    color: COLORS.text,
    fontSize: 12,
    opacity: 0.6,
    marginTop: 1,
    textAlign: 'center',
  },
  customizeExerciseButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginBottom: SPACING.lg,
  },
  customizeExerciseText: {
    color: COLORS.primary,
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  startExerciseContainer: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: COLORS.background,
  },
  startExerciseButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  startExerciseText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchExerciseNote: {
    color: COLORS.text,
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  // New styles for customize mode
  activeCustomizeText: {
    color: COLORS.primary,
  },
  reorderHandle: {
    position: 'absolute',
    left: SPACING.xs,
    top: '50%',
    transform: [{ translateY: -12 }],
    zIndex: 1,
    flexDirection: 'column',
    alignItems: 'center',
  },
  reorderButton: {
    padding: 2,
    marginVertical: 1,
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
  customizeModeCard: {
    borderWidth: 0.3,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  // Bottom menu styles
  bottomMenu: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.primary,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  bottomMenuContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  bottomMenuButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  bottomMenuButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomMenuButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  // Reorder styles
  exerciseCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  dragHandle: {
    position: 'absolute',
    left: SPACING.xs + 6, // Position it over the center of the image
    top: '60%',
    transform: [{ translateY: -22 }, { translateX: 14 }], // Perfect center over 72px image
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  imageShadowOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.66)',
    borderRadius: 10,
  },
}); 