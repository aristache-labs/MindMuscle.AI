import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Icon } from 'react-native-paper';
import OptimizedImage from '../../../components/OptimizedImage';
import { styles } from '../styles';
import { Exercise, PausedWorkout } from '../types';
import { getMuscleTagColor, getMuscleTagName } from '../utils';

interface ExerciseSet {
  isCompleted: boolean;
  weight?: number;
  reps?: number;
}

interface ExerciseItemProps {
  item: Exercise;
  index: number;
  totalExercises: number;
  hasPausedWorkout: boolean;
  pausedWorkout: PausedWorkout | null;
  onExerciseNamePress: (exercise: Exercise) => void;
}

interface ExerciseDisplayData {
  sets: number;
  repsRange: string;
  name: string;
  imageUrl: string | undefined;
  primaryMuscles: string[];
}

interface ExerciseStateData {
  state: 'completed' | 'ongoing' | 'normal';
  displayData: ExerciseDisplayData;
}

// Helper function to get default display data
const getDefaultDisplayData = (item: Exercise): ExerciseDisplayData => ({
  sets: item.sets,
  repsRange: item.reps_range,
  name: item.name,
  imageUrl: item.image_url,
  primaryMuscles: item.primary_muscles || [],
});

// Helper function to determine exercise state and display data
const getExerciseStateData = (
  item: Exercise,
  hasPausedWorkout: boolean,
  pausedWorkout: PausedWorkout | null,
): ExerciseStateData => {
  const defaultDisplayData = getDefaultDisplayData(item);

  if (!hasPausedWorkout || !pausedWorkout || !pausedWorkout.exercises) {
    return { state: 'normal', displayData: defaultDisplayData };
  }

  // Check if this is actually a paused workout exercise by looking at the exercise data structure
  // If we're showing paused workout exercises, the item IS the paused exercise
  const isPausedWorkoutExercise = pausedWorkout.exercises.some((e: Exercise) => e.id === item.id);

  if (!isPausedWorkoutExercise) {
    return { state: 'normal', displayData: defaultDisplayData };
  }

  // Find the index of this exercise in the paused workout
  const pausedExerciseIndex = pausedWorkout.exercises.findIndex((e: Exercise) => e.id === item.id);
  const isCurrentExercise = pausedExerciseIndex === pausedWorkout.currentExerciseIndex;
  const exerciseSets: ExerciseSet[] = pausedWorkout.exerciseSets[item.id] || [];
  const isCompleted =
    exerciseSets.length > 0 && exerciseSets.every((set: ExerciseSet) => set.isCompleted);

  // Since item is already the paused exercise, use its data directly
  const displayData: ExerciseDisplayData = {
    sets: item.sets,
    repsRange: item.reps_range,
    name: item.name,
    imageUrl: item.image_url,
    primaryMuscles: item.primary_muscles || [],
  };

  if (isCompleted) {
    return { state: 'completed', displayData };
  }

  if (isCurrentExercise) {
    return { state: 'ongoing', displayData };
  }

  return { state: 'normal', displayData };
};

// Helper function to get image source
const getImageSource = (imageUrl: string | undefined) => {
  if (imageUrl) {
    return { uri: imageUrl };
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../../../assets/exercises/placeholder.jpg');
};

// Helper function to get fallback image
const getFallbackImage = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../../../assets/exercises/placeholder.jpg');
};

// Helper component for exercise image
const ExerciseImage: React.FC<{ imageUrl: string | undefined }> = ({ imageUrl }) => (
  <View style={styles.exerciseImageContainer}>
    <OptimizedImage
      source={getImageSource(imageUrl)}
      style={styles.exerciseImage}
      fallback={getFallbackImage()}
      resizeMode="cover"
      cachePolicy="immutable"
      showLoader={false}
    />
  </View>
);

// Helper component for exercise details
const ExerciseDetails: React.FC<{
  displayData: ExerciseDisplayData;
  exerciseState: string;
  item: Exercise;
  onExerciseNamePress: (exercise: Exercise) => void;
}> = ({ displayData, exerciseState, item, onExerciseNamePress }) => (
  <View style={styles.exerciseDetails}>
    <TouchableOpacity
      onPress={() =>
        onExerciseNamePress({
          ...item,
          name: displayData.name,
          image_url: displayData.imageUrl,
          primary_muscles: displayData.primaryMuscles,
        })
      }
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.exerciseName,
          styles.exerciseNameClickable,
          (exerciseState === 'completed' || exerciseState === 'ongoing') &&
            styles.exerciseTextGreyed,
        ]}
      >
        {displayData.name}
      </Text>
    </TouchableOpacity>
    <Text
      style={[
        styles.exerciseSets,
        (exerciseState === 'completed' || exerciseState === 'ongoing') && styles.exerciseTextGreyed,
      ]}
    >
      {displayData.sets} sets × {displayData.repsRange} reps
    </Text>
  </View>
);

// Helper component for muscle tag
const MuscleTag: React.FC<{
  primaryMuscles: string[];
  exerciseState: string;
}> = ({ primaryMuscles, exerciseState }) => {
  if (!primaryMuscles || primaryMuscles.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.muscleTag,
        { backgroundColor: getMuscleTagColor(primaryMuscles[0]) },
        (exerciseState === 'completed' || exerciseState === 'ongoing') && styles.muscleTagGreyed,
      ]}
    >
      <Text
        style={[
          styles.muscleTagText,
          (exerciseState === 'completed' || exerciseState === 'ongoing') &&
            styles.muscleTagTextGreyed,
        ]}
      >
        {getMuscleTagName(primaryMuscles[0])}
      </Text>
    </View>
  );
};

// Helper component for exercise overlay
const ExerciseOverlay: React.FC<{ exerciseState: string }> = ({ exerciseState }) => {
  if (exerciseState === 'completed') {
    return (
      <View style={styles.exerciseOverlay}>
        <View style={styles.completedIconContainer}>
          <View style={{ opacity: 1 }}>
            <Icon source="check" size={24} color="#fff" />
          </View>
        </View>
      </View>
    );
  }

  if (exerciseState === 'ongoing') {
    return (
      <View style={styles.exerciseOverlay}>
        <View style={styles.ongoingIconContainer}>
          <View style={{ opacity: 1 }}>
            <Icon source="pause" size={22} color="#FFFFFF" />
          </View>
        </View>
      </View>
    );
  }

  return null;
};

// Helper component for progress bar
const ExerciseProgressBar: React.FC<{
  exerciseState: string;
  hasPausedWorkout: boolean;
  pausedWorkout: PausedWorkout | null;
}> = ({ exerciseState, hasPausedWorkout, pausedWorkout }) => {
  if (exerciseState !== 'ongoing' || !hasPausedWorkout || !pausedWorkout) {
    return null;
  }

  const progressPercentage = Math.max(
    0,
    Math.min(100, (pausedWorkout.currentExerciseIndex / pausedWorkout.exercises.length) * 100),
  );

  return (
    <View style={styles.exerciseProgressContainer}>
      <View style={styles.exerciseProgressTrack}>
        <View style={[styles.exerciseProgressFill, { width: `${progressPercentage}%` }]} />
      </View>
      <Text style={styles.exerciseProgressText}>
        {pausedWorkout.currentExerciseIndex} of {pausedWorkout.exercises.length} exercises completed
      </Text>
    </View>
  );
};

const ExerciseItem: React.FC<ExerciseItemProps> = ({
  item,
  index,
  totalExercises,
  hasPausedWorkout,
  pausedWorkout,
  onExerciseNamePress,
}) => {
  const isLastExercise = index === totalExercises - 1;
  const { state: exerciseState, displayData } = getExerciseStateData(
    item,
    hasPausedWorkout,
    pausedWorkout,
  );

  return (
    <View>
      <View style={[styles.exerciseCard, { borderBottomWidth: 0, position: 'relative' }]}>
        <View style={styles.exerciseLeftContent}>
          <ExerciseImage imageUrl={displayData.imageUrl} />
          <ExerciseDetails
            displayData={displayData}
            exerciseState={exerciseState}
            item={item}
            onExerciseNamePress={onExerciseNamePress}
          />
        </View>

        <MuscleTag primaryMuscles={displayData.primaryMuscles} exerciseState={exerciseState} />

        <ExerciseOverlay exerciseState={exerciseState} />
      </View>

      <ExerciseProgressBar
        exerciseState={exerciseState}
        hasPausedWorkout={hasPausedWorkout}
        pausedWorkout={pausedWorkout}
      />

      {/* Custom divider logic - only show for normal exercises */}
      {!isLastExercise && exerciseState === 'normal' && <View style={styles.exerciseDivider} />}
    </View>
  );
};

export default ExerciseItem;
