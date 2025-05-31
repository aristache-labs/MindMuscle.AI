import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import ExerciseMaxWeightGraph from '../../../components/ExerciseMaxWeightGraph';
import OptimizedImage from '../../../components/OptimizedImage';
import { BORDER_RADIUS, COLORS, SPACING } from '../../../constants/theme';

interface WorkoutExerciseCardProps {
  exercise: {
    id: string;
    exercise_id: string;
    name: string;
    image_url?: string;
    primary_muscles?: string[];
    requires_weight?: boolean;
  };
  maxWeightData: Array<{ date: string; value: number }>;
  absoluteMaxWeight: { weight: number; reps: number; date: string } | null;
  onExerciseNamePress: () => void;
}

export default function WorkoutExerciseCard({
  exercise,
  maxWeightData,
  absoluteMaxWeight,
  onExerciseNamePress,
}: WorkoutExerciseCardProps) {
  // Helper function to determine the image source
  const getImageSource = () => {
    // Check if we have a valid image URL
    // This prevents flickering by avoiding invalid URI loading attempts
    const trimmedImageUrl = exercise?.image_url?.trim();
    const hasValidImageUrl =
      trimmedImageUrl &&
      trimmedImageUrl !== '' &&
      trimmedImageUrl !== 'null' &&
      trimmedImageUrl !== 'undefined';

    if (hasValidImageUrl) {
      return { uri: trimmedImageUrl };
    } else {
      // Use placeholder directly for local assets to prevent any loading attempts
      return require('../../../../assets/exercises/placeholder.jpg');
    }
  };

  return (
    <>
      {/* Exercise Card */}
      <View style={styles.exerciseCard}>
        <View style={styles.exerciseRow}>
          <View style={styles.exerciseImageContainer}>
            <OptimizedImage
              source={getImageSource()}
              style={styles.exerciseImage}
              fallback={require('../../../../assets/exercises/placeholder.jpg')}
              resizeMode="cover"
              cachePolicy="immutable"
              showLoader={false}
              isImportant={true}
              priority="high"
              debugLabel={`Exercise-${exercise?.name || 'Unknown'}`}
            />
          </View>
          <View style={styles.exerciseInfo}>
            <TouchableOpacity onPress={onExerciseNamePress} activeOpacity={0.7}>
              <Text style={styles.exerciseName}>{exercise?.name || 'Unknown Exercise'}</Text>
            </TouchableOpacity>
            {exercise?.primary_muscles && exercise.primary_muscles.length > 0 && (
              <View style={styles.muscleTag}>
                <Text style={styles.muscleTagText}>{exercise.primary_muscles[0]}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Max Weight Progress Graph - separate container with small spacing */}
      {exercise && exercise.requires_weight !== false && (
        <View style={styles.maxWeightGraphContainer}>
          <ExerciseMaxWeightGraph
            data={maxWeightData || []}
            exerciseName={exercise.name}
            absoluteMaxWeight={absoluteMaxWeight || null}
          />
        </View>
      )}
    </>
  );
}

const styles = {
  exerciseCard: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.md,
    marginLeft: SPACING.md,
    marginRight: SPACING.md,
    marginBottom: 0,
  },
  exerciseRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  exerciseImageContainer: {
    marginRight: SPACING.md,
  },
  exerciseImage: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surface,
  },
  exerciseInfo: {
    flex: 1,
    justifyContent: 'center' as const,
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold' as const,
    marginBottom: SPACING.xs,
  },
  muscleTag: {
    backgroundColor: '#FFD700',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start' as const,
  },
  muscleTagText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: 'bold' as const,
  },
  maxWeightGraphContainer: {
    marginTop: 0,
    marginBottom: 0,
  },
};
