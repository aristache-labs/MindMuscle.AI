import React, { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, Dimensions, ViewStyle, TextStyle, ImageStyle, Image } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/theme';
import { MaterialIcons } from '@expo/vector-icons';
import OptimizedImage from './OptimizedImage';
import ExerciseMaxWeightGraph from './ExerciseMaxWeightGraph';

interface ExerciseCardProps {
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

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 28) / 2; // Reduced spacing (from 36 to 28) to make cards wider

// Create a proper comparison function for memo
const arePropsEqual = (prevProps: ExerciseCardProps, nextProps: ExerciseCardProps) => {
  return (
    prevProps.exercise.id === nextProps.exercise.id &&
    prevProps.exercise.name === nextProps.exercise.name &&
    prevProps.maxWeightData === nextProps.maxWeightData &&
    prevProps.absoluteMaxWeight === nextProps.absoluteMaxWeight &&
    // Compare image objects or URIs
    ((prevProps.exercise.image_url && nextProps.exercise.image_url && prevProps.exercise.image_url === nextProps.exercise.image_url) || 
     prevProps.exercise.image_url === nextProps.exercise.image_url) &&
    // Functions can't be directly compared, so we skip them
    // They should be wrapped in useCallback in the parent component
    true
  );
};

const ExerciseCard = memo(({ 
  exercise,
  maxWeightData,
  absoluteMaxWeight,
  onExerciseNamePress,
}: ExerciseCardProps) => {
  // Create a unique debug label using exercise id or name
  const debugLabel = `exercise-card-${exercise.id || exercise.name.toLowerCase().replace(/\s+/g, '_').substring(0, 20)}`;

  // Memoize the image source to prevent unnecessary re-renders
  const imageSource = useMemo(() => {
    // Check if this is a placeholder image with a stable reference
    if (typeof exercise.image_url === 'string' && exercise.image_url && 
        (!exercise.image_url || exercise.image_url === null)) {
      // Use the globally cached placeholder image if available
      return (global as any).placeholderImages?.exercise || require('../../assets/exercises/placeholder.jpg');
    }
    return exercise.image_url;
  }, [exercise.image_url]);

  // Only log on dev builds and when needed for debugging
  if (__DEV__) {
    useEffect(() => {
      // console.log(`[ExerciseCard ${debugLabel}] mounted or props changed. Name: ${exercise.name}, Favorite: ${exercise.requires_weight}`);
      // console.log(`[ExerciseCard ${debugLabel}] Image prop:`, exercise.image_url);
    }, [exercise.id, exercise.name, exercise.requires_weight, exercise.image_url, debugLabel]);
  }

  return (
    <>
      {/* Exercise Card */}
      <View style={styles.exerciseCard}>
        <View style={styles.exerciseRow}>
          <View style={styles.exerciseImageContainer}>
            <OptimizedImage
              source={imageSource ? { uri: imageSource } : require('../../assets/exercises/placeholder.jpg')}
              style={styles.exerciseImage}
              fallback={require('../../assets/exercises/placeholder.jpg')}
              resizeMode="cover"
              cachePolicy="immutable"
              testID={debugLabel}
              isImportant={true}
              showLoader={false}
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
}, arePropsEqual);

interface Styles {
  exerciseCard: ViewStyle;
  exerciseRow: ViewStyle;
  exerciseImageContainer: ViewStyle;
  exerciseImage: ImageStyle;
  exerciseInfo: ViewStyle;
  exerciseName: TextStyle;
  muscleTag: ViewStyle;
  muscleTagText: TextStyle;
  maxWeightGraphContainer: ViewStyle;
}

const styles = StyleSheet.create<Styles>({
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
});

export default ExerciseCard; 