// Helper function to format duration as H:mm (hours without leading zero)
export const formatDurationAsHMM = (duration: string): string => {
  if (!duration) return '0:00';

  const parts = duration.split(':');
  if (parts.length < 2) return '0:00';

  const hours = parseInt(parts[0]);
  const minutes = parts[1];

  return `${hours}:${minutes}`;
};

// Helper function to get muscle tag color
export const getMuscleTagColor = (muscle: string) => {
  const colors: { [key: string]: string } = {
    chest: '#00CCFF',
    back: '#FF6666',
    biceps: '#FF66CC',
    triceps: '#CC99FF',
    shoulders: '#99CCFF',
    legs: '#FFCC66',
    glutes: '#FFCC66',
    abs: '#66FF99',
    default: '#AAAAAA',
  };

  const key = muscle.toLowerCase();
  return colors[key] || colors.default;
};

// Helper function to get muscle tag display name
export const getMuscleTagName = (muscle: string) => {
  const muscleNames: { [key: string]: string } = {
    chest: 'Chest',
    back: 'Back',
    biceps: 'Biceps',
    triceps: 'Triceps',
    shoulders: 'Shoulders',
    legs: 'Legs',
    quads: 'Legs',
    hamstrings: 'Legs',
    calves: 'Legs',
    glutes: 'Glutes',
    abs: 'Abs',
    core: 'Abs',
  };

  const key = muscle.toLowerCase();
  return muscleNames[key] || muscle;
};

// Import existing types from the types file
import { Exercise, PausedWorkout } from '../types';

// REMOVED: ExtendedExercise interface - no longer needed with simplified approach

// REMOVED: User interface - no longer needed with simplified approach

// REMOVED: ExerciseChange interface - no longer needed with simplified approach

// REMOVED: ExerciseData interface - no longer needed with simplified approach

// REMOVED: WorkoutPlanService interface - no longer needed with simplified approach

// REMOVED: identifySwitchedExercises - no longer needed with simplified approach

// REMOVED: updateExerciseWithCustomizations - no longer needed with simplified approach

// REMOVED: identifyExerciseChanges - no longer needed with simplified approach

// REMOVED: createNewExerciseSets - no longer needed with simplified approach

// REMOVED: adjustExerciseSetCounts and adjustSetCount - no longer needed with simplified approach

// SIMPLIFIED: Main function to update paused workout with current exercise customizations
// Instead of complex merging, just return the paused workout exactly as it was saved
export const updatePausedWorkoutWithCustomizations = async (
  pausedWorkoutData: PausedWorkout,
): Promise<PausedWorkout> => {
  console.log(
    'SIMPLIFIED UPDATE - Returning paused workout exactly as saved (no merging):',
    JSON.stringify(pausedWorkoutData.exercises),
  );

  // The paused workout already contains the exercises with their customized sets/reps
  // No need to merge with current data - just return the saved state
  return pausedWorkoutData;
};

// Workout calculation utilities
export const calculateWorkoutDuration = (exercises: Exercise[]): number => {
  let totalDuration = 0;

  exercises.forEach((exercise) => {
    const sets = exercise.sets || 3;
    const repRange = exercise.reps_range || '8-10';

    // Parse rep range to get average reps (e.g., "8-12" -> 10)
    let avgReps = 10; // Default
    if (repRange.includes('-')) {
      const [min, max] = repRange.split('-').map((num: string) => parseInt(num));
      if (!Number.isNaN(min) && !Number.isNaN(max)) {
        avgReps = Math.floor((min + max) / 2);
      }
    } else if (!Number.isNaN(parseInt(repRange))) {
      avgReps = parseInt(repRange);
    }

    // Estimate time per rep at ~2-3 seconds
    const timePerSet = avgReps * 2.5; // seconds

    // Rest time between sets (typically 60-90 seconds)
    const restTime = 75; // seconds

    // Total time for this exercise (all sets + rest between sets)
    const exerciseTime = sets * timePerSet + restTime * (sets - 1);

    // Add to total duration (convert to minutes)
    totalDuration += exerciseTime / 60;
  });

  // Round up to nearest minute
  return Math.ceil(totalDuration);
};

export const calculateWorkoutCalories = (durationMinutes: number): number => {
  // Calculate calories based on duration with a more realistic formula
  // Moderate exercise burns approximately 7-10 calories per minute depending on intensity
  const calorieRate = 8.5; // calories per minute for moderate-high intensity workout
  return Math.round(durationMinutes * calorieRate);
};

export const calculateWorkoutStats = (
  exercises: Exercise[],
): { duration: number; calories: number; exerciseCount: number } => {
  const exerciseCount = exercises.length;
  const duration = calculateWorkoutDuration(exercises);
  const calories = calculateWorkoutCalories(duration);

  return {
    duration,
    calories,
    exerciseCount,
  };
};

export default function disablewarn() {
  return null;
}
