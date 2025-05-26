import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import OptimizedImage from './OptimizedImage';
import ExerciseMaxWeightGraph from './ExerciseMaxWeightGraph';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
  onCustomizeExercise
}: ExerciseListModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number | null>(null);
  const slideAnim = useRef(new Animated.Value(screenWidth)).current;

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
    slideAnim.setValue(screenWidth);
  };

  const handleClose = () => {
    resetModal();
    onClose();
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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
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
                  
                  <Text style={styles.headerTitle}>Exercise List</Text>
                  
                  <TouchableOpacity style={styles.headerButton}>
                    <Text style={styles.headerButtonText}>Customize</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Main Content Area */}
            <View style={styles.contentContainer}>
              {/* Exercise List View */}
              <View style={styles.listView}>
                {/* Current Exercise Section */}
                <View style={styles.currentExerciseSection}>
                  <Text style={styles.sectionTitle}>Current Exercise</Text>
                  {exercises[currentExerciseIndex] && (
                    <TouchableOpacity 
                      style={[styles.exerciseCard, styles.currentExerciseCard]}
                      onPress={() => handleExercisePress(currentExerciseIndex)}
                    >
                      <View style={styles.exerciseImageContainer}>
                        <OptimizedImage
                          source={exercises[currentExerciseIndex].image_url ? 
                            { uri: exercises[currentExerciseIndex].image_url } : 
                            require('../../assets/exercises/placeholder.jpg')
                          }
                          style={styles.exerciseImage}
                          fallback={require('../../assets/exercises/placeholder.jpg')}
                          resizeMode="cover"
                          cachePolicy="immutable"
                        />
                      </View>
                      
                      <View style={styles.exerciseInfo}>
                        <Text style={styles.exerciseName}>
                          {exercises[currentExerciseIndex].name}
                        </Text>
                        <Text style={styles.exerciseDetails}>
                          {getCompletedSets(exercises[currentExerciseIndex].id)}/{getTotalSets(exercises[currentExerciseIndex].id)} sets x {exercises[currentExerciseIndex].reps_range} reps
                        </Text>
                      </View>
                      
                      {exercises[currentExerciseIndex].primary_muscles && 
                       exercises[currentExerciseIndex].primary_muscles!.length > 0 && (
                        <View style={[
                          styles.muscleTag, 
                          { backgroundColor: getMuscleTagColor(exercises[currentExerciseIndex].primary_muscles![0]) }
                        ]}>
                          <Text style={styles.muscleTagText}>
                            {exercises[currentExerciseIndex].primary_muscles![0]}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {/* Next Exercises Section */}
                <View style={styles.nextExercisesSection}>
                  <Text style={styles.sectionTitle}>Next Exercises</Text>
                  
                  <ScrollView 
                    style={styles.exercisesList}
                    showsVerticalScrollIndicator={false}
                  >
                    {exercises.map((exercise, index) => {
                      if (index === currentExerciseIndex) return null;
                      
                      const isCompleted = getCompletedSets(exercise.id) === getTotalSets(exercise.id) && getTotalSets(exercise.id) > 0;
                      const isPast = index < currentExerciseIndex;
                      
                      return (
                        <TouchableOpacity
                          key={exercise.id}
                          style={[
                            styles.exerciseCard,
                            isCompleted && styles.completedExerciseCard,
                            isPast && styles.pastExerciseCard
                          ]}
                          onPress={() => handleExercisePress(index)}
                        >
                          <View style={styles.exerciseImageContainer}>
                            <OptimizedImage
                              source={exercise.image_url ? 
                                { uri: exercise.image_url } : 
                                require('../../assets/exercises/placeholder.jpg')
                              }
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
                            <Text style={[
                              styles.exerciseName,
                              (isCompleted || isPast) && styles.completedExerciseName
                            ]}>
                              {exercise.name}
                            </Text>
                            <Text style={[
                              styles.exerciseDetails,
                              (isCompleted || isPast) && styles.completedExerciseDetails
                            ]}>
                              {getCompletedSets(exercise.id)}/{getTotalSets(exercise.id)} sets x {exercise.reps_range} reps
                            </Text>
                          </View>
                          
                          {exercise.primary_muscles && exercise.primary_muscles.length > 0 && (
                            <View style={[
                              styles.muscleTag, 
                              { backgroundColor: getMuscleTagColor(exercise.primary_muscles[0]) },
                              (isCompleted || isPast) && styles.completedMuscleTag
                            ]}>
                              <Text style={[
                                styles.muscleTagText,
                                (isCompleted || isPast) && styles.completedMuscleTagText
                              ]}>
                                {exercise.primary_muscles[0]}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
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
                          source={exercises[selectedExerciseIndex].image_url ? 
                            { uri: exercises[selectedExerciseIndex].image_url } : 
                            require('../../assets/exercises/placeholder.jpg')
                          }
                          style={styles.detailImage}
                          fallback={require('../../assets/exercises/placeholder.jpg')}
                          resizeMode="cover"
                          cachePolicy="immutable"
                        />
                      </View>
                      
                      <View style={styles.detailInfo}>
                        <Text style={styles.detailExerciseName}>
                          {exercises[selectedExerciseIndex].name}
                        </Text>
                        {exercises[selectedExerciseIndex].primary_muscles && 
                         exercises[selectedExerciseIndex].primary_muscles!.length > 0 && (
                          <View style={styles.detailMuscleContainer}>
                            <View style={[
                              styles.detailMuscleTag, 
                              { backgroundColor: getMuscleTagColor(exercises[selectedExerciseIndex].primary_muscles![0]) }
                            ]}>
                              <Text style={styles.detailMuscleText}>
                                {exercises[selectedExerciseIndex].primary_muscles![0]}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Max Weight Graph Section */}
                    {exercises[selectedExerciseIndex] && exercises[selectedExerciseIndex].requires_weight !== false && (
                      <View style={styles.maxWeightGraphContainer}>
                        <ExerciseMaxWeightGraph
                          data={maxWeightData[exercises[selectedExerciseIndex].exercise_id] || []}
                          exerciseName={exercises[selectedExerciseIndex].name}
                          absoluteMaxWeight={absoluteMaxWeightData[exercises[selectedExerciseIndex].exercise_id] || null}
                        />
                      </View>
                    )}

                    {/* Sets Section */}
                    <View style={styles.setsSection}>
                      {Array.from({ length: exercises[selectedExerciseIndex].sets || 4 }).map((_, index) => {
                        const setNumber = index + 1;
                        const exercise = exercises[selectedExerciseIndex];
                        
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
      </View>
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
  },
  headerButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  currentExerciseCard: {
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  completedExerciseCard: {
    opacity: 0.7,
  },
  pastExerciseCard: {
    opacity: 0.6,
  },
  exerciseImageContainer: {
    width: 60,
    height: 60,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    marginRight: SPACING.md,
    position: 'relative',
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
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  completedExerciseName: {
    opacity: 0.7,
  },
  exerciseDetails: {
    color: COLORS.text,
    fontSize: 14,
    opacity: 0.8,
  },
  completedExerciseDetails: {
    opacity: 0.5,
  },
  muscleTag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
    marginLeft: SPACING.sm,
  },
  completedMuscleTag: {
    opacity: 0.6,
  },
  muscleTagText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: 'bold',
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
}); 