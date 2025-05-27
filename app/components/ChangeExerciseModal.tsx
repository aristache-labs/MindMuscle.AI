import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import OptimizedImage from './OptimizedImage';
import { fetchExerciseAlternatives } from '../services/exerciseAlternativesService';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

const { width: screenWidth } = Dimensions.get('window');

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

export default function ChangeExerciseModal({
  visible,
  onClose,
  currentExercise,
  availableExercises,
  onExerciseSelect
}: ChangeExerciseModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedExercise, setSelectedExercise] = useState<ExerciseAlternative | null>(null);
  const [recommendedExercises, setRecommendedExercises] = useState<ExerciseAlternative[]>([]);
  const [otherExercises, setOtherExercises] = useState<ExerciseAlternative[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch exercise alternatives when modal opens
  useEffect(() => {
    if (visible && currentExercise) {
      fetchAlternatives();
    } else {
      setSelectedExercise(null);
      setRecommendedExercises([]);
      setOtherExercises([]);
    }
  }, [visible, currentExercise]);

  const fetchAlternatives = async () => {
    if (!currentExercise) return;
    
    setIsLoading(true);
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

      const { recommended, other } = await fetchExerciseAlternatives(currentExerciseData);
      setRecommendedExercises(recommended);
      setOtherExercises(other);
    } catch (error) {
      console.error('Error fetching exercise alternatives:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExercisePress = (exercise: ExerciseAlternative) => {
    setSelectedExercise(exercise);
  };

  const handleConfirmChange = () => {
    if (selectedExercise) {
      console.log('ChangeExerciseModal: Confirming exercise change:', selectedExercise);
      try {
        onExerciseSelect(selectedExercise);
        onClose();
      } catch (error) {
        console.error('Error in handleConfirmChange:', error);
      }
    }
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

  // Filter out the current exercise from available exercises
  const filteredExercises = availableExercises.filter(
    exercise => exercise.exercise_id !== currentExercise?.exercise_id
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
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
              <TouchableOpacity onPress={onClose} style={styles.headerButton}>
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

            {/* Current Exercise Info */}
            {currentExercise && (
              <View style={styles.currentExerciseSection}>
                <Text style={styles.sectionTitle}>Current Exercise</Text>
                <View style={styles.currentExerciseCard}>
                  <View style={styles.exerciseImageContainer}>
                    <OptimizedImage
                      source={currentExercise.image_url ? 
                        { uri: currentExercise.image_url } : 
                        require('../../assets/exercises/placeholder.jpg')
                      }
                      style={styles.exerciseImage}
                      fallback={require('../../assets/exercises/placeholder.jpg')}
                      resizeMode="cover"
                      cachePolicy="immutable"
                    />
                  </View>
                  
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{currentExercise.name}</Text>
                    {currentExercise.primary_muscles && currentExercise.primary_muscles.length > 0 && (
                      <View style={[styles.muscleTag, { backgroundColor: getMuscleTagColor(currentExercise.primary_muscles[0]) }]}>
                        <Text style={styles.muscleTagText}>{currentExercise.primary_muscles[0]}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Exercise List */}
            <View style={styles.exerciseListSection}>
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>Finding alternatives...</Text>
                </View>
              ) : (
                <ScrollView 
                  style={styles.exerciseList}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Recommended Alternatives */}
                  {recommendedExercises.length > 0 && (
                    <>
                      <View style={styles.categoryHeader}>
                        <Ionicons name="star" size={20} color="#FFD700" />
                        <Text style={styles.categoryTitle}>Recommended Alternatives</Text>
                      </View>
                      {recommendedExercises.map((exercise, index) => (
                        <TouchableOpacity
                          key={exercise.id}
                          style={[
                            styles.exerciseItem,
                            selectedExercise?.id === exercise.id && styles.selectedExerciseItem
                          ]}
                          onPress={() => handleExercisePress(exercise)}
                        >
                          <View style={styles.exerciseImageContainer}>
                            <OptimizedImage
                              source={exercise.image_url ? 
                                { uri: exercise.image_url } : 
                                require('../../assets/exercises/placeholder.jpg')
                              }
                              style={styles.exerciseImage}
                              fallback={require('../../assets/exercises/placeholder.jpg')}
                              resizeMode="cover"
                              cachePolicy="immutable"
                            />
                          </View>
                          
                          <View style={styles.exerciseInfo}>
                            <Text style={styles.exerciseName}>{exercise.name}</Text>
                            <Text style={styles.exerciseDetails}>
                              {exercise.sets} sets × {exercise.reps_range} reps
                            </Text>
                            <View style={styles.exerciseMetadata}>
                              <View style={[styles.muscleTag, { backgroundColor: getMuscleTagColor(exercise.primary_muscles[0]) }]}>
                                <Text style={styles.muscleTagText}>{exercise.primary_muscles[0]}</Text>
                              </View>
                              <View style={styles.difficultyTag}>
                                <Text style={styles.difficultyText}>{exercise.difficulty}</Text>
                              </View>
                            </View>
                          </View>
                          
                          {selectedExercise?.id === exercise.id && (
                            <View style={styles.selectedIndicator}>
                              <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </>
                  )}

                  {/* Other Alternatives */}
                  {otherExercises.length > 0 && (
                    <>
                      <View style={styles.categoryHeader}>
                        <Ionicons name="list" size={20} color={COLORS.text} />
                        <Text style={styles.categoryTitle}>Other Alternatives</Text>
                      </View>
                      {otherExercises.map((exercise, index) => (
                        <TouchableOpacity
                          key={exercise.id}
                          style={[
                            styles.exerciseItem,
                            selectedExercise?.id === exercise.id && styles.selectedExerciseItem
                          ]}
                          onPress={() => handleExercisePress(exercise)}
                        >
                          <View style={styles.exerciseImageContainer}>
                            <OptimizedImage
                              source={exercise.image_url ? 
                                { uri: exercise.image_url } : 
                                require('../../assets/exercises/placeholder.jpg')
                              }
                              style={styles.exerciseImage}
                              fallback={require('../../assets/exercises/placeholder.jpg')}
                              resizeMode="cover"
                              cachePolicy="immutable"
                            />
                          </View>
                          
                          <View style={styles.exerciseInfo}>
                            <Text style={styles.exerciseName}>{exercise.name}</Text>
                            <Text style={styles.exerciseDetails}>
                              {exercise.sets} sets × {exercise.reps_range} reps
                            </Text>
                            <View style={styles.exerciseMetadata}>
                              <View style={[styles.muscleTag, { backgroundColor: getMuscleTagColor(exercise.primary_muscles[0]) }]}>
                                <Text style={styles.muscleTagText}>{exercise.primary_muscles[0]}</Text>
                              </View>
                              <View style={styles.difficultyTag}>
                                <Text style={styles.difficultyText}>{exercise.difficulty}</Text>
                              </View>
                            </View>
                          </View>
                          
                          {selectedExercise?.id === exercise.id && (
                            <View style={styles.selectedIndicator}>
                              <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </>
                  )}

                  {/* No alternatives found */}
                  {!isLoading && recommendedExercises.length === 0 && otherExercises.length === 0 && (
                    <View style={styles.noAlternativesContainer}>
                      <Ionicons name="search" size={48} color={COLORS.text} style={{ opacity: 0.5 }} />
                      <Text style={styles.noAlternativesText}>No alternatives found</Text>
                      <Text style={styles.noAlternativesSubtext}>
                        Try a different exercise or check your connection
                      </Text>
                    </View>
                  )}
                </ScrollView>
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
  currentExerciseSection: {
    padding: SPACING.lg,
    borderBottomWidth: 0.2,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
    opacity: 0.8,
  },
  currentExerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  exerciseListSection: {
    flex: 1,
    padding: SPACING.lg,
  },
  exerciseList: {
    flex: 1,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedExerciseItem: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
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
}); 