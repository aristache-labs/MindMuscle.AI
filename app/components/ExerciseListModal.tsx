import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { ScaleDecorator, OpacityDecorator, ShadowDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import OptimizedImage from './OptimizedImage';
import ExerciseMaxWeightGraph from './ExerciseMaxWeightGraph';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const EXERCISE_CARD_HEIGHT = 76; // Actual height of each exercise card (from styles)
const EXERCISE_CARD_SPACING = 8; // Bottom margin from exerciseCardWrapper (SPACING.sm)
const TOTAL_CARD_HEIGHT = EXERCISE_CARD_HEIGHT + EXERCISE_CARD_SPACING; // Total space each card takes
const DRAG_THRESHOLD = 10; // Pixels to move before starting drag

// Enhanced Exercise Card Component for DraggableFlatList
interface EnhancedExerciseCardProps {
  exercise: Exercise;
  index: number;
  currentExerciseIndex: number;
  isCustomizeMode: boolean;
  exerciseSets: Record<string, any[]>;
  onPress: () => void;
  onRemove: () => void;
  drag: () => void;
  isActive: boolean;
}

const EnhancedExerciseCard: React.FC<EnhancedExerciseCardProps> = ({
  exercise,
  index,
  currentExerciseIndex,
  isCustomizeMode,
  exerciseSets,
  onPress,
  onRemove,
  drag,
  isActive,
}) => {
  const getCompletedSets = (exerciseId: string): number => {
    const sets = exerciseSets[exerciseId] || [];
    return sets.filter(set => set.isCompleted).length;
  };

  const getTotalSets = (exerciseId: string): number => {
    const sets = exerciseSets[exerciseId] || [];
    return sets.length;
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
    <View style={[
      styles.exerciseCardWrapper,
      { overflow: 'visible' }
    ]}>
      <View
        style={[
          styles.exerciseCard,
          isCurrent && styles.currentExerciseCard,
          isCompleted && styles.completedExerciseCard,
          isPast && styles.pastExerciseCard,
          isCustomizeMode && styles.customizeModeCard,
          isActive && styles.activelyDraggedCard,
          { 
            minHeight: EXERCISE_CARD_HEIGHT - SPACING.sm,
            // Ensure no conflicting positioning during drag
            position: 'relative',
          },
        ]}
      >
        {/* Card Content */}
        {!isCustomizeMode ? (
          <TouchableOpacity 
            style={styles.exerciseCardContent}
            onPress={onPress}
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
                {isCurrent && " • CURRENT"}
              </Text>
              <Text style={[
                styles.exerciseDetails,
                (isCompleted || isPast) && styles.completedExerciseDetails
              ]}>
                {getCompletedSets(exercise.id)}/{getTotalSets(exercise.id)} sets x {exercise.reps_range} reps
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.exerciseCardContent}>
            {/* Drag Handle - visual indicator only */}
            <View style={styles.dragHandle}>
              <Ionicons name="menu" size={28} color="rgba(255, 255, 255, 0.95)" />
            </View>
            
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
              <View style={styles.imageShadowOverlay} />
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
                {isCurrent && " • CURRENT"}
              </Text>
              <Text style={[
                styles.exerciseDetails,
                (isCompleted || isPast) && styles.completedExerciseDetails
              ]}>
                {getCompletedSets(exercise.id)}/{getTotalSets(exercise.id)} sets x {exercise.reps_range} reps
              </Text>
            </View>
            
            <TouchableOpacity 
              style={styles.recycleIconContainer}
              onPress={onRemove}
            >
              <Ionicons name="trash-outline" size={20} color={'#FF5252'} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
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
  onCurrentExerciseIndexChange?: (newIndex: number) => void;
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
  onRemoveExercise,
  onCurrentExerciseIndexChange
}: ExerciseListModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number | null>(null);
  const [isCustomizeMode, setIsCustomizeMode] = useState(false);
  const [showBottomMenu, setShowBottomMenu] = useState(false);
  const [localExercises, setLocalExercises] = useState<Exercise[]>(exercises);
  const [showToast, setShowToast] = useState(false);
  const slideAnim = useRef(new Animated.Value(screenWidth)).current;
  const bottomMenuAnim = useRef(new Animated.Value(100)).current;
  const toastAnim = useRef(new Animated.Value(-100)).current;

  // Sync local exercises with props
  useEffect(() => {
    setLocalExercises(exercises);
  }, [exercises]);

  // Handle initial selected exercise when modal becomes visible
  useEffect(() => {
    if (visible && initialSelectedExerciseIndex !== null) {
      setSelectedExerciseIndex(initialSelectedExerciseIndex);
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
    
    console.log('🔧 Customize button pressed:', {
      currentMode: isCustomizeMode,
      newMode: newCustomizeMode,
      draggableDataLength: draggableData.length
    });
    
    setIsCustomizeMode(newCustomizeMode);
    setShowBottomMenu(newCustomizeMode);
    
    if (newCustomizeMode) {
      setShowToast(true);
      Animated.sequence([
        Animated.timing(toastAnim, {
          toValue: 20,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
        Animated.timing(toastAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start(() => {
        setShowToast(false);
      });
    }
    
    if (!newCustomizeMode) {
      if (onReorderExercises && JSON.stringify(localExercises) !== JSON.stringify(exercises)) {
        onReorderExercises(localExercises);
      }
    }
    
    Animated.timing(bottomMenuAnim, {
      toValue: newCustomizeMode ? 0 : 100,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleRemoveExercise = (index: number) => {
    if (!isCustomizeMode || !onRemoveExercise) return;
    onRemoveExercise(index);
  };

  const handleBackToList = () => {
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

  // Handle drag end from DraggableFlatList
  const handleDragEnd = ({ data }: { data: Exercise[] }) => {
    console.log('🎯 Drag ended:', {
      originalDataLength: localExercises.length,
      newDataLength: data.length,
      currentExerciseIndex,
      reorderedData: data.map(ex => ex.name)
    });
    
    // Update the local exercises with the new order
    setLocalExercises(data);
    
    // Update the current exercise index to follow the moved exercise
    const currentExercise = localExercises[currentExerciseIndex];
    const newCurrentIndex = data.findIndex(ex => ex.id === currentExercise.id);
    
    console.log('✅ Final reordered exercises:', data.map(ex => ex.name));
    console.log('🔄 Current exercise moved from index', currentExerciseIndex, 'to', newCurrentIndex);
    
    // Update the current exercise index if the active exercise was moved
    if (newCurrentIndex !== -1 && newCurrentIndex !== currentExerciseIndex) {
      console.log('📍 Active exercise index updated to:', newCurrentIndex);
      onCurrentExerciseIndexChange?.(newCurrentIndex);
    }
  };

  // Use all exercises for dragging (no exclusions)
  const draggableData = localExercises;

  // Debug log for DraggableFlatList configuration
  useEffect(() => {
    console.log('📋 DraggableFlatList config updated:', {
      dataLength: draggableData.length,
      isCustomizeMode,
      activationDistance: isCustomizeMode ? 0 : 999999,
      scrollEnabled: !isCustomizeMode,
      data: draggableData.map(item => ({ id: item.id, name: item.name }))
    });
  }, [isCustomizeMode, draggableData.length]);



  // Render placeholder to prevent layout jumps during dragging
  const renderPlaceholder = () => {
    return (
      <View style={{ height: TOTAL_CARD_HEIGHT, backgroundColor: 'transparent' }} />
    );
  };

  // Get helper functions (same as before)
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
      const lastWeight = lastExerciseValues[exerciseExerciseId]?.[setNumber]?.weight;
      return lastWeight && lastWeight !== '-' && lastWeight !== '0' ? lastWeight : '--';
    } else {
      if (recommendation?.recommended_reps) {
        return recommendation.recommended_reps.toString();
      }
      const lastReps = lastExerciseValues[exerciseExerciseId]?.[setNumber]?.reps;
      return lastReps && lastReps !== '-' && lastReps !== '0' ? lastReps : '--';
    }
  };

  const getLastValue = (exerciseExerciseId: string, setNumber: number, type: 'weight' | 'reps'): string => {
    const lastValue = lastExerciseValues[exerciseExerciseId]?.[setNumber]?.[type];
    return lastValue && lastValue !== '-' && lastValue !== '0' ? lastValue : '--';
  };

  const getImageSource = (exercise: Exercise) => {
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
            <View style={styles.topGlowLeft} />
            <View style={styles.topGlowRight} />
            
            {/* Header */}
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
                {draggableData.length > 0 && (
                  <View style={styles.activeExerciseSection}>
                    <Text style={styles.sectionTitle}>ACTIVE EXERCISE</Text>
                    
                    {/* Current Exercise Card - Single item draggable */}
                    <DraggableFlatList
                      data={[draggableData[currentExerciseIndex]]}
                      onDragEnd={({ data }) => {
                        // Handle moving the active exercise within the full list
                        const movedExercise = data[0];
                        const fullArray = [...draggableData];
                        // Remove from current position and add to new position
                        fullArray.splice(currentExerciseIndex, 1);
                        fullArray.unshift(movedExercise); // Move to beginning for now
                        handleDragEnd({ data: fullArray });
                      }}
                      keyExtractor={(item) => `active-${item.id}`}
                      renderItem={({ item, drag, isActive }) => (
                        <View
                          style={[
                            styles.exerciseCardWrapper,
                            {
                              zIndex: isActive ? 20 : 10,
                              elevation: isActive ? 10 : 5,
                              position: 'relative',
                              transform: [{ scale: isActive ? 1.02 : 1 }],
                              opacity: isActive ? 0.98 : 1,
                              overflow: 'visible',
                            }
                          ]}
                        >
                          <TouchableOpacity
                            onLongPress={isCustomizeMode ? drag : undefined}
                            delayLongPress={isCustomizeMode ? 80 : undefined}
                            activeOpacity={0.95}
                            style={{ width: '100%' }}
                          >
                            <EnhancedExerciseCard
                              exercise={item}
                              index={currentExerciseIndex}
                              currentExerciseIndex={currentExerciseIndex}
                              isCustomizeMode={isCustomizeMode}
                              exerciseSets={exerciseSets}
                              onPress={() => handleExercisePress(currentExerciseIndex)}
                              onRemove={() => handleRemoveExercise(currentExerciseIndex)}
                              drag={drag}
                              isActive={isActive}
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                      activationDistance={isCustomizeMode ? 8 : 999999}
                      dragItemOverflow={true}
                      scrollEnabled={false}
                      showsVerticalScrollIndicator={false}
                    />
                  </View>
                )}

                {/* Upcoming Exercises Section */}
                {draggableData.length > 1 && (
                  <View style={styles.upcomingExercisesSection}>
                    <Text style={styles.sectionTitle}>
                      UPCOMING EXERCISES ({draggableData.length - 1})
                    </Text>
                    
                    {/* Remaining exercises */}
                    <DraggableFlatList
                      data={draggableData.filter((_, index) => index !== currentExerciseIndex)}
                      onDragEnd={({ data }) => {
                        // Reconstruct the full array with current exercise at its position
                        const fullArray = [...data];
                        fullArray.splice(currentExerciseIndex, 0, draggableData[currentExerciseIndex]);
                        handleDragEnd({ data: fullArray });
                      }}
                      keyExtractor={(item) => `upcoming-${item.id}`}
                      renderItem={({ item, drag, isActive }) => {
                        const realIndex = draggableData.findIndex(ex => ex.id === item.id);
                        return (
                          <View
                            style={[
                              styles.exerciseCardWrapper,
                              {
                                zIndex: isActive ? 20 : 0,
                                elevation: isActive ? 10 : 1,
                                position: 'relative',
                                transform: [{ scale: isActive ? 1.02 : 1 }],
                                opacity: isActive ? 0.98 : 1,
                                overflow: 'visible',
                              }
                            ]}
                          >
                            <TouchableOpacity
                              onLongPress={isCustomizeMode ? drag : undefined}
                              delayLongPress={isCustomizeMode ? 80 : undefined}
                              activeOpacity={0.95}
                              style={{ width: '100%' }}
                            >
                              <EnhancedExerciseCard
                                exercise={item}
                                index={realIndex}
                                currentExerciseIndex={currentExerciseIndex}
                                isCustomizeMode={isCustomizeMode}
                                exerciseSets={exerciseSets}
                                onPress={() => handleExercisePress(realIndex)}
                                onRemove={() => handleRemoveExercise(realIndex)}
                                drag={drag}
                                isActive={isActive}
                              />
                            </TouchableOpacity>
                          </View>
                        );
                      }}
                      activationDistance={isCustomizeMode ? 8 : 999999}
                      dragItemOverflow={true}
                      containerStyle={styles.draggableList}
                      contentContainerStyle={styles.draggableListContent}
                      showsVerticalScrollIndicator={false}
                      scrollEnabled={!isCustomizeMode}
                      autoscrollThreshold={50}
                      autoscrollSpeed={100}
                    />
                  </View>
                )}

                {/* No exercises fallback */}
                {draggableData.length === 0 && (
                  <View style={styles.noExercises}>
                    <Text style={styles.noExercisesText}>
                      No exercises available
                    </Text>
                  </View>
                )}
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
                  console.log('Add Exercise pressed');
                }}
              >
                <View style={styles.bottomMenuButtonContent}>
                  <Ionicons name="add-circle" size={24} color="#8B5CF6" />
                  <Text style={styles.bottomMenuButtonText}>Add Exercise</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.bottomMenuButton}
                onPress={() => {
                  console.log('Add Superset pressed');
                }}
              >
                <View style={styles.bottomMenuButtonContent}>
                  <Ionicons name="link" size={24} color="#8B5CF6" />
                  <Text style={styles.bottomMenuButtonText}>Add Superset</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.bottomMenuButton}
                onPress={() => {
                  console.log('Add Cardio pressed');
                }}
              >
                <View style={styles.bottomMenuButtonContent}>
                  <Ionicons name="heart" size={24} color="#8B5CF6" />
                  <Text style={styles.bottomMenuButtonText}>Add Cardio</Text>
                </View>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Toast Notification */}
        {showToast && (
          <Animated.View 
            style={[
              styles.toastNotification,
              {
                transform: [{ translateY: toastAnim }]
              }
            ]}
          >
            <View style={styles.toastContent}>
              <Ionicons name="move" size={20} color="#8B5CF6" />
              <Text style={styles.toastText}>Drag to reorder exercises</Text>
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
    overflow: 'visible', // Allow dragged exercises to be visible
    zIndex: 0, // Lower z-index for overlay
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'visible', // Allow dragged cards to float above
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
    borderColor: '#8B5CF6',
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
    borderColor: '#8B5CF6',
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
  exercisesListContent: {
    paddingBottom: SPACING.lg,
  },
  exercisesListContentDragging: {
    paddingBottom: SPACING.xl * 2, // Extra space when dragging
  },
  exerciseCardWrapper: {
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'visible', // Allow shadows to show
    position: 'relative', // Enable z-index positioning
  },
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
    overflow: 'visible', // Allow drag effects to show
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
    overflow: 'visible', // Allow dragged cards to float above
    paddingTop: SPACING.lg, // Add significant top padding to move content lower
  },
  listView: {
    flex: 1,
    overflow: 'visible', // Allow dragged cards to float above
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
    left: -5, // Position it over the center of the image
    top: '60%',
    transform: [{ translateY: -22 }, { translateX: 14 }], // Perfect center over 72px image
    zIndex: 9999, // Ensure it's above everything
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    borderWidth: 0.,
    borderColor: 'rgba(139, 92, 246, 0.8)',
  },
  imageShadowOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 10,
  },
  toastNotification: {
    position: 'absolute',
    top: 0,
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 1000,
  },
  toastContent: {
    backgroundColor: '#1C1D22',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  toastText: {
    color: '#F5F5F5',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  // NEW: DraggableFlatList specific styles
  activelyDraggedCard: {
    // Simplified styling to prevent jitter - removed purple shadows and heavy effects
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    // Removed shadowColor, shadowOpacity, shadowRadius, shadowOffset
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.7)',
  },
  draggableList: {
    flex: 1,
    overflow: 'visible', // Allow dragged items to be visible outside bounds
  },
  draggableListContent: {
    paddingBottom: SPACING.lg,
    overflow: 'visible', // Allow dragged items to be visible outside bounds
  },
  exerciseListSection: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xxl, // Add top padding to push list content lower
    overflow: 'visible', // Allow dragged items to be visible outside bounds
  },
  noExercises: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
  noExercisesText: {
    color: COLORS.text,
    fontSize: 16,
    fontStyle: 'italic',
    opacity: 0.7,
    textAlign: 'center',
  },
  allExercisesSection: {
    paddingHorizontal: SPACING.md,
    flex: 1,
    overflow: 'visible', // Allow dragged items to be visible outside bounds
  },
  currentExerciseHeader: {
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  currentExerciseHeaderText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  upcomingExercisesHeader: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  upcomingExercisesHeaderText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeExerciseSection: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    overflow: 'visible', // Allow dragged items to be visible outside bounds
  },
  activeExerciseCardWrapper: {
    marginBottom: 0,
    overflow: 'visible', // Allow dragged items to be visible outside bounds
  },
  upcomingExercisesSection: {
    paddingHorizontal: SPACING.md,
    flex: 1,
    overflow: 'visible', // Allow dragged items to be visible outside bounds
  },
}); 