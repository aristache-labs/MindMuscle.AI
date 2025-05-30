import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import OptimizedImage from './OptimizedImage';
import ChangeExerciseModal from './ChangeExerciseModal';
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
  isChangedExercise?: boolean;
}

interface CustomizeExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  exercise: Exercise | null;
  onSave: (updatedExercise: { sets: number; reps_range: string }) => void;
  availableExercises?: Exercise[];
  onExerciseChange?: (newExercise: Exercise) => void;
}

export default function CustomizeExerciseModal({
  visible,
  onClose,
  exercise,
  onSave,
  availableExercises = [],
  onExerciseChange
}: CustomizeExerciseModalProps) {
  const insets = useSafeAreaInsets();

  // Helper function to determine the image source safely
  const getImageSource = (exerciseData: Exercise | null) => {
    // Check if we have a valid image URL
    const hasValidImageUrl = exerciseData?.image_url && 
                             exerciseData.image_url.trim() !== '' && 
                             exerciseData.image_url !== 'null' && 
                             exerciseData.image_url !== 'undefined';
    
    if (hasValidImageUrl) {
      return { uri: exerciseData.image_url };
    } else {
      // Use placeholder directly for local assets to prevent any loading attempts
      return require('../../assets/exercises/placeholder.jpg');
    }
  };

  const [sets, setSets] = useState(exercise?.sets || 4);
  const [repsMin, setRepsMin] = useState(() => {
    if (!exercise?.reps_range) return 8;
    const range = exercise.reps_range.split('-');
    return parseInt(range[0]) || 8;
  });
  const [repsMax, setRepsMax] = useState(() => {
    if (!exercise?.reps_range) return 10;
    const range = exercise.reps_range.split('-');
    return parseInt(range[1]) || parseInt(range[0]) || 10;
  });
  const [showChangeExerciseModal, setShowChangeExerciseModal] = useState(false);

  // Reset values when exercise changes
  React.useEffect(() => {
    if (exercise) {
      setSets(exercise.sets);
      const range = exercise.reps_range.split('-');
      setRepsMin(parseInt(range[0]) || 8);
      setRepsMax(parseInt(range[1]) || parseInt(range[0]) || 10);
    }
  }, [exercise]);

  const handleDiscard = () => {
    // Reset to original values
    if (exercise) {
      setSets(exercise.sets);
      const range = exercise.reps_range.split('-');
      setRepsMin(parseInt(range[0]) || 8);
      setRepsMax(parseInt(range[1]) || parseInt(range[0]) || 10);
    }
    onClose();
  };

  const handleSave = () => {
    const reps_range = repsMin === repsMax ? repsMin.toString() : `${repsMin}-${repsMax}`;
    onSave({ sets, reps_range });
    onClose();
  };

  const handleChangeExercise = () => {
    setShowChangeExerciseModal(true);
  };

  const handleExerciseSelect = (selectedExercise: any) => {
    console.log('CustomizeExerciseModal: Received exercise selection:', selectedExercise);
    
    if (onExerciseChange) {
      try {
        // Convert ExerciseAlternative to Exercise format
        const newExercise: Exercise = {
          id: selectedExercise.id,
          exercise_id: selectedExercise.exercise_id || selectedExercise.id, // Use exercise_id if available, fallback to id
          name: selectedExercise.name,
          sets: selectedExercise.sets,
          reps_range: selectedExercise.reps_range,
          image_url: selectedExercise.image_url,
          primary_muscles: selectedExercise.primary_muscles,
          order: selectedExercise.order,
          workout_day: selectedExercise.workout_day,
          requires_weight: selectedExercise.requires_weight,
          // Pass along the isChangedExercise flag if it exists
          isChangedExercise: selectedExercise.isChangedExercise || false
        };
        
        console.log('CustomizeExerciseModal: Calling onExerciseChange with:', newExercise);
        onExerciseChange(newExercise);
        
        // Close modals after successful exercise change
        setTimeout(() => {
          setShowChangeExerciseModal(false);
          onClose();
        }, 100); // Small delay to ensure state updates complete
        
      } catch (error) {
        console.error('Error in handleExerciseSelect:', error);
        // Still close modals even if there's an error
        setShowChangeExerciseModal(false);
        onClose();
      }
    } else {
      // Close modals if no onExerciseChange callback
      setShowChangeExerciseModal(false);
      onClose();
    }
  };

  const adjustSets = (increment: boolean) => {
    setSets(prev => {
      const newValue = increment ? prev + 1 : prev - 1;
      return Math.max(1, Math.min(10, newValue)); // Limit between 1-10
    });
  };

  // Predefined rep ranges
  const repRanges = [
    { min: 1, max: 3 },
    { min: 3, max: 5 },
    { min: 4, max: 6 },
    { min: 6, max: 8 },
    { min: 8, max: 10 },
    { min: 10, max: 12 },
    { min: 12, max: 15 },
    { min: 15, max: 20 },
    { min: 20, max: 25 },
    { min: 25, max: 30 }
  ];

  const adjustReps = (increment: boolean) => {
    const currentRangeIndex = repRanges.findIndex(range => 
      range.min === repsMin && range.max === repsMax
    );
    
    if (currentRangeIndex !== -1) {
      // Current values match a predefined range
      if (increment && currentRangeIndex < repRanges.length - 1) {
        const nextRange = repRanges[currentRangeIndex + 1];
        setRepsMin(nextRange.min);
        setRepsMax(nextRange.max);
      } else if (!increment && currentRangeIndex > 0) {
        const prevRange = repRanges[currentRangeIndex - 1];
        setRepsMin(prevRange.min);
        setRepsMax(prevRange.max);
      }
    } else {
      // Current values don't match a predefined range, find closest
      const currentAvg = (repsMin + repsMax) / 2;
      let closestIndex = 0;
      let closestDiff = Math.abs((repRanges[0].min + repRanges[0].max) / 2 - currentAvg);
      
      for (let i = 1; i < repRanges.length; i++) {
        const rangeAvg = (repRanges[i].min + repRanges[i].max) / 2;
        const diff = Math.abs(rangeAvg - currentAvg);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIndex = i;
        }
      }
      
      // Move to next or previous range from closest match
      if (increment && closestIndex < repRanges.length - 1) {
        const nextRange = repRanges[closestIndex + 1];
        setRepsMin(nextRange.min);
        setRepsMax(nextRange.max);
      } else if (!increment && closestIndex > 0) {
        const prevRange = repRanges[closestIndex - 1];
        setRepsMin(prevRange.min);
        setRepsMax(prevRange.max);
      } else {
        // Use the closest range
        const closestRange = repRanges[closestIndex];
        setRepsMin(closestRange.min);
        setRepsMax(closestRange.max);
      }
    }
  };

  if (!exercise) return null;

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
              <TouchableOpacity onPress={handleDiscard} style={styles.headerButton}>
                <Text style={styles.discardButtonText}>Discard</Text>
              </TouchableOpacity>
              
              <Text style={styles.headerTitle}>CUSTOMIZE EXERCISE</Text>
              
              <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Exercise Info */}
            <View style={styles.exerciseSection}>
              <View style={styles.exerciseCard}>
                <View style={styles.exerciseImageContainer}>
                  <OptimizedImage
                    source={getImageSource(exercise)}
                    style={styles.exerciseImage}
                    fallback={require('../../assets/exercises/placeholder.jpg')}
                    resizeMode="cover"
                    cachePolicy="immutable"
                  />
                </View>
                
                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  {exercise.primary_muscles && exercise.primary_muscles.length > 0 && (
                    <Text style={styles.exerciseMuscle}>{exercise.primary_muscles[0]}</Text>
                  )}
                </View>
                
                {/* Change Exercise Button */}
                {availableExercises.length > 0 && onExerciseChange && (
                  <TouchableOpacity 
                    style={styles.changeExerciseButton}
                    onPress={handleChangeExercise}
                  >
                    <Ionicons name="swap-horizontal" size={20} color={COLORS.text} />
                  </TouchableOpacity>
                )}

              </View>
            </View>

            {/* Customization Controls */}
            <View style={styles.controlsSection}>
              {/* Controls Row - Sets and Reps side by side */}
              <View style={styles.controlsRow}>
                {/* Sets Control */}
                <View style={styles.controlColumn}>
                  <View style={styles.controlContainer}>
                    <TouchableOpacity 
                      style={styles.controlButton}
                      onPress={() => adjustSets(false)}
                    >
                      <Text style={styles.controlButtonText}>−</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.valueContainer}>
                      <Text style={styles.valueText}>{sets}</Text>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.controlButton}
                      onPress={() => adjustSets(true)}
                    >
                      <Text style={styles.controlButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.controlLabel}>sets</Text>
                </View>

                {/* Reps Control */}
                <View style={styles.controlColumn}>
                  <View style={styles.controlContainer}>
                    <TouchableOpacity 
                      style={styles.controlButton}
                      onPress={() => adjustReps(false)}
                    >
                      <Text style={styles.controlButtonText}>−</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.valueContainer}>
                      <Text style={styles.valueText}>
                        {repsMin === repsMax ? repsMin : `${repsMin}-${repsMax}`}
                      </Text>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.controlButton}
                      onPress={() => adjustReps(true)}
                    >
                      <Text style={styles.controlButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.controlLabel}>reps</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>
      
      {/* Change Exercise Modal */}
      <ChangeExerciseModal
        visible={showChangeExerciseModal}
        onClose={() => setShowChangeExerciseModal(false)}
        currentExercise={exercise}
        availableExercises={availableExercises}
        onExerciseSelect={handleExerciseSelect}
      />
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
    height: '50%',
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
    position: 'relative',
  },
  headerButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  discardButtonText: {
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
  doneButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  exerciseSection: {
    padding: SPACING.lg,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  exerciseImageContainer: {
    width: 60,
    height: 60,
    borderRadius: BORDER_RADIUS.md,
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
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  exerciseMuscle: {
    color: COLORS.text,
    fontSize: 14,
    opacity: 0.7,
  },
  changeExerciseButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.md,
  },
  controlsSection: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  controlColumn: {
    alignItems: 'center',
    flex: 1,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  controlLabel: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  controlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xs,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonText: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  valueContainer: {
    minWidth: 80,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueText: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
}); 