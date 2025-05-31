import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/theme';
import type { ExerciseData } from '../features/workout/types';
import OptimizedImage from './OptimizedImage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ExerciseListModalProps {
  visible: boolean;
  onClose: () => void;
  exercises: ExerciseData[];
  currentExerciseIndex: number;
  onExerciseSelect: (index: number) => void;
  onCustomizeExercise?: (index: number) => void;
}

export default function ExerciseListModal({
  visible,
  onClose,
  exercises,
  currentExerciseIndex,
  onExerciseSelect,
  onCustomizeExercise,
}: ExerciseListModalProps) {
  const insets = useSafeAreaInsets();

  const renderExerciseItem = (exercise: ExerciseData, index: number) => {
    const isActive = index === currentExerciseIndex;
    const isUpcoming = index > currentExerciseIndex;
    const isCompleted = index < currentExerciseIndex;

    return (
      <TouchableOpacity
        key={exercise.id}
        style={[
          styles.exerciseItem,
          isActive && styles.activeExerciseItem,
          isCompleted && styles.completedExerciseItem,
        ]}
        onPress={() => onExerciseSelect(index)}
        activeOpacity={0.7}
      >
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
              <Ionicons name="barbell-outline" size={24} color={COLORS.text} />
            </View>
          )}
        </View>

        <View style={styles.exerciseInfo}>
          <Text style={[styles.exerciseName, isCompleted && styles.completedText]}>
            {exercise.name}
          </Text>
          <Text style={[styles.exerciseDetails, isCompleted && styles.completedText]}>
            {exercise.sets} sets x {exercise.reps_range} reps
          </Text>
        </View>

        {/* Status indicator */}
        <View style={styles.statusContainer}>
          {isCompleted && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
          {isActive && (
            <View style={styles.activeIndicator}>
              <Text style={styles.activeText}>ACTIVE</Text>
            </View>
          )}
          {isUpcoming && (
            <Text style={styles.upcomingText}>{index - currentExerciseIndex} left</Text>
          )}
        </View>

        {/* Customize button */}
        {onCustomizeExercise && (
          <TouchableOpacity
            style={styles.customizeButton}
            onPress={() => onCustomizeExercise(index)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="settings-outline" size={20} color={COLORS.text} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <View style={[styles.modalContainer, { paddingBottom: insets.bottom }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Exercise List</Text>

            <TouchableOpacity style={styles.customizeButton}>
              <Text style={styles.customizeButtonText}>Customize</Text>
            </TouchableOpacity>
          </View>

          {/* All Exercises in Single Scrollable Container */}
          <ScrollView
            style={styles.exercisesList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.exercisesListContent}
          >
            {/* Active Exercise Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ACTIVE EXERCISE</Text>
              {exercises[currentExerciseIndex] &&
                renderExerciseItem(exercises[currentExerciseIndex], currentExerciseIndex)}
            </View>

            {/* Upcoming Exercises Section */}
            {currentExerciseIndex < exercises.length - 1 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  UPCOMING EXERCISES ({exercises.length - currentExerciseIndex - 1})
                </Text>
                {exercises
                  .slice(currentExerciseIndex + 1)
                  .map((exercise, index) =>
                    renderExerciseItem(exercise, currentExerciseIndex + 1 + index),
                  )}
              </View>
            )}

            {/* Completed Exercises Section */}
            {currentExerciseIndex > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  COMPLETED EXERCISES ({currentExerciseIndex})
                </Text>
                {exercises
                  .slice(0, currentExerciseIndex)
                  .map((exercise, index) => renderExerciseItem(exercise, index))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingTop: SCREEN_HEIGHT * 0.05,
  },
  backdrop: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    height: SCREEN_HEIGHT * 0.95,
    paddingTop: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    padding: SPACING.xs,
  },
  closeButtonText: {
    color: COLORS.text,
    fontSize: 16,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  customizeButton: {
    padding: SPACING.xs,
  },
  customizeButtonText: {
    color: COLORS.text,
    fontSize: 16,
  },
  section: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  sectionTitle: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: SPACING.sm,
    letterSpacing: 0.5,
  },
  exercisesList: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  exercisesListContent: {
    paddingBottom: SPACING.lg,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  activeExerciseItem: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  completedExerciseItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    opacity: 0.7,
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
  exercisePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    marginBottom: 2,
  },
  exerciseDetails: {
    color: COLORS.text,
    fontSize: 14,
    opacity: 0.8,
  },
  completedText: {
    opacity: 0.6,
  },
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
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
    fontWeight: 'bold',
  },
  upcomingText: {
    color: COLORS.text,
    fontSize: 12,
    opacity: 0.6,
  },
});
