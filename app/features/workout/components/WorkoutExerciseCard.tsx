import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import OptimizedImage from '../../../components/OptimizedImage';
import ExerciseMaxWeightGraph from '../../../components/ExerciseMaxWeightGraph';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../constants/theme';

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
  return (
    <>
      {/* Exercise Card */}
      <View style={styles.exerciseCard}>
        <View style={styles.exerciseRow}>
          <View style={styles.exerciseImageContainer}>
            <OptimizedImage
              source={exercise?.image_url ? { uri: exercise.image_url } : require('../../../../assets/exercises/placeholder.jpg')}
              style={styles.exerciseImage}
              fallback={require('../../../../assets/exercises/placeholder.jpg')}
              resizeMode="cover"
              cachePolicy="immutable"
            />
          </View>
          <View style={styles.exerciseInfo}>
            <TouchableOpacity onPress={onExerciseNamePress} activeOpacity={0.7}>
              <Text style={styles.exerciseName}>
                {exercise?.name || 'Unknown Exercise'}
              </Text>
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