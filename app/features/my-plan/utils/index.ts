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
import { Exercise, ExerciseSet, PausedWorkout, Plan } from '../types';

// Extended Exercise type for internal use (with optional order property)
interface ExtendedExercise extends Exercise {
  order?: number;
  requires_weight?: boolean;
  isChangedExercise?: boolean;
}

// User interface for the function parameters
interface User {
  id: string;
  email?: string;
  full_name?: string;
  user_metadata?: { [key: string]: unknown };
}

// Exercise change tracking interface
interface ExerciseChange {
  id: string;
  oldExerciseId: string;
  newExerciseId: string;
  newExercise: ExtendedExercise;
}

// ExerciseData interface to match workoutPlanService
interface ExerciseData {
  id: string;
  exercise_id: string;
  name: string;
  sets: number;
  reps_range: string;
  image_url?: string;
  primary_muscles?: string[];
  restTime?: number;
  order: number;
  workout_day: number;
  requires_weight?: boolean;
}

// Workout plan service interface - updated to match actual implementation
interface WorkoutPlanService {
  fetchLastExerciseRecords: (
    userId: string,
    exercises: ExerciseData[],
  ) => Promise<Record<string, Record<number, { weight: string; reps: string }>>>;
  fetchWorkoutData: (
    planId: string,
    workoutDay: number,
    userId: string,
    cycleWeek: number,
  ) => Promise<{ exercises: ExtendedExercise[] }>;
}

// Helper function to identify switched exercises in paused workout
const identifySwitchedExercises = (pausedWorkoutData: PausedWorkout): ExtendedExercise[] => {
  return pausedWorkoutData.exercises.filter(
    (ex: ExtendedExercise) => ex.isChangedExercise === true,
  );
};

// Helper function to update exercise with current customizations
const updateExerciseWithCustomizations = (
  pausedExercise: ExtendedExercise,
  currentExercise: ExtendedExercise,
  wasChangedDuringWorkout: boolean,
): ExtendedExercise => {
  if (wasChangedDuringWorkout) {
    return {
      ...pausedExercise,
      sets: currentExercise.sets,
      reps_range: currentExercise.reps_range,
      isChangedExercise: true,
    };
  }

  const hasChangedSincePausing =
    (currentExercise.exercise_id || currentExercise.id) !==
    (pausedExercise.exercise_id || pausedExercise.id);

  if (hasChangedSincePausing) {
    return {
      ...pausedExercise,
      exercise_id: currentExercise.exercise_id || currentExercise.id,
      name: currentExercise.name,
      sets: currentExercise.sets,
      reps_range: currentExercise.reps_range,
      image_url: currentExercise.image_url,
      primary_muscles: currentExercise.primary_muscles,
      requires_weight: currentExercise.requires_weight,
      isChangedExercise: true,
    };
  }

  return {
    ...pausedExercise,
    sets: currentExercise.sets,
    reps_range: currentExercise.reps_range,
    isChangedExercise: false,
  };
};

// Helper function to identify exercise changes
const identifyExerciseChanges = (
  pausedExercises: Exercise[],
  currentExercises: ExtendedExercise[],
): { updatedExercises: ExtendedExercise[]; exerciseChanges: ExerciseChange[] } => {
  const updatedExercises: ExtendedExercise[] = [];
  const exerciseChanges: ExerciseChange[] = [];

  for (const pausedExercise of pausedExercises) {
    const extendedPausedExercise = pausedExercise as ExtendedExercise;
    const wasChangedDuringWorkout = extendedPausedExercise.isChangedExercise === true;
    const currentExercise = currentExercises.find((ex) => ex.id === pausedExercise.id);

    if (currentExercise) {
      const updatedExercise = updateExerciseWithCustomizations(
        extendedPausedExercise,
        currentExercise,
        wasChangedDuringWorkout,
      );

      if (
        !wasChangedDuringWorkout &&
        (currentExercise.exercise_id || currentExercise.id) !==
          (extendedPausedExercise.exercise_id || extendedPausedExercise.id)
      ) {
        exerciseChanges.push({
          id: pausedExercise.id,
          oldExerciseId: extendedPausedExercise.exercise_id || extendedPausedExercise.id,
          newExerciseId: currentExercise.exercise_id || currentExercise.id,
          newExercise: currentExercise,
        });
      }

      updatedExercises.push(updatedExercise);
    } else {
      updatedExercises.push(extendedPausedExercise);
    }
  }

  return { updatedExercises, exerciseChanges };
};

// Helper function to create new exercise sets with history data
const createNewExerciseSets = async (
  exerciseChanges: ExerciseChange[],
  pausedWorkoutData: PausedWorkout,
  user: User,
  workoutPlanService: WorkoutPlanService,
): Promise<Record<string, ExerciseSet[]>> => {
  const updatedExerciseSets = { ...pausedWorkoutData.exerciseSets };

  if (exerciseChanges.length === 0) {
    return updatedExerciseSets;
  }

  // Create proper ExerciseData objects for the fetchLastExerciseRecords call
  const exercisesToFetch: ExerciseData[] = exerciseChanges.map((change) => ({
    id: change.id,
    exercise_id: change.newExerciseId,
    name: change.newExercise.name,
    sets: change.newExercise.sets,
    reps_range: change.newExercise.reps_range,
    image_url: change.newExercise.image_url,
    primary_muscles: change.newExercise.primary_muscles,
    restTime: undefined,
    order: change.newExercise.order || 0,
    workout_day: pausedWorkoutData.workoutDay,
    requires_weight: change.newExercise.requires_weight,
  }));

  const lastValues = await workoutPlanService.fetchLastExerciseRecords(user.id, exercisesToFetch);

  for (const change of exerciseChanges) {
    const historyData = lastValues[change.newExerciseId];
    const newSetsCount = change.newExercise.sets;
    const newSets: ExerciseSet[] = [];

    for (let i = 0; i < newSetsCount; i++) {
      const setNumber = i + 1;
      const historySet = historyData?.[setNumber];

      newSets.push({
        isCompleted: false,
        weight: historySet?.weight ? Number(historySet.weight) : undefined,
        reps: historySet?.reps ? Number(historySet.reps) : undefined,
      });
    }

    updatedExerciseSets[change.id] = newSets;
  }

  return updatedExerciseSets;
};

// Helper function to adjust set counts for all exercises
const adjustExerciseSetCounts = (
  exercises: ExtendedExercise[],
  exerciseSets: Record<string, ExerciseSet[]>,
  exerciseChanges: ExerciseChange[],
): Record<string, ExerciseSet[]> => {
  const updatedExerciseSets = { ...exerciseSets };

  exercises.forEach((exercise) => {
    const currentSets = updatedExerciseSets[exercise.id] || [];
    const newSetsCount = exercise.sets;
    const wasChangedExercise = exercise.isChangedExercise === true;
    const hasCompletedSets = currentSets.some((set) => set.isCompleted);

    // Skip exercises that were handled by exerciseChanges or have completed sets
    if (
      (wasChangedExercise && hasCompletedSets) ||
      exerciseChanges.some((change) => change.id === exercise.id)
    ) {
      if (wasChangedExercise && hasCompletedSets && currentSets.length !== newSetsCount) {
        updatedExerciseSets[exercise.id] = adjustSetCount(currentSets, newSetsCount);
      }
      return;
    }

    if (currentSets.length !== newSetsCount) {
      updatedExerciseSets[exercise.id] = adjustSetCount(currentSets, newSetsCount);
    }
  });

  return updatedExerciseSets;
};

// Helper function to adjust set count for a single exercise
const adjustSetCount = (currentSets: ExerciseSet[], newSetsCount: number): ExerciseSet[] => {
  if (currentSets.length < newSetsCount) {
    const newSets = [...currentSets];
    for (let i = currentSets.length; i < newSetsCount; i++) {
      newSets.push({
        isCompleted: false,
        weight: undefined,
        reps: undefined,
      });
    }
    return newSets;
  }

  return currentSets.slice(0, newSetsCount);
};

// Main function to update paused workout with current exercise customizations
export const updatePausedWorkoutWithCustomizations = async (
  pausedWorkoutData: PausedWorkout,
  user: User,
  plan: Plan,
  workoutPlanService: WorkoutPlanService,
): Promise<PausedWorkout> => {
  if (!pausedWorkoutData?.exercises || !user || !plan) {
    return pausedWorkoutData;
  }

  console.log(
    'UPDATING PAUSED WORKOUT - Initial paused workout data:',
    JSON.stringify(pausedWorkoutData.exercises),
  );

  const switchedExercisesInPausedWorkout = identifySwitchedExercises(pausedWorkoutData);
  if (switchedExercisesInPausedWorkout.length > 0) {
    console.log(
      'UPDATING PAUSED WORKOUT - Found switched exercises in paused workout:',
      JSON.stringify(switchedExercisesInPausedWorkout),
    );
  }

  try {
    console.log(
      'UPDATING PAUSED WORKOUT - Fetching current workout data for plan:',
      plan.id,
      'day:',
      pausedWorkoutData.workoutDay,
      'cycle week:',
      pausedWorkoutData.cycleWeek,
    );

    const { exercises: currentExercises } = await workoutPlanService.fetchWorkoutData(
      plan.id,
      pausedWorkoutData.workoutDay,
      user.id,
      pausedWorkoutData.cycleWeek,
    );

    console.log(
      'UPDATING PAUSED WORKOUT - Current workout data from database:',
      JSON.stringify(currentExercises),
    );

    const { updatedExercises, exerciseChanges } = identifyExerciseChanges(
      pausedWorkoutData.exercises,
      currentExercises,
    );

    let updatedExerciseSets = await createNewExerciseSets(
      exerciseChanges,
      pausedWorkoutData,
      user,
      workoutPlanService,
    );

    updatedExerciseSets = adjustExerciseSetCounts(
      updatedExercises,
      updatedExerciseSets,
      exerciseChanges,
    );

    const finalPausedWorkoutData: PausedWorkout = {
      ...pausedWorkoutData,
      exercises: updatedExercises,
      exerciseSets: updatedExerciseSets,
    };

    console.log(
      'UPDATING PAUSED WORKOUT - Final updated exercises:',
      JSON.stringify(finalPausedWorkoutData.exercises),
    );

    const finalSwitchedExercises = finalPausedWorkoutData.exercises.filter(
      (ex: ExtendedExercise) => ex.isChangedExercise === true,
    );
    if (finalSwitchedExercises.length > 0) {
      console.log(
        'UPDATING PAUSED WORKOUT - Switched exercises in final result:',
        JSON.stringify(finalSwitchedExercises),
      );
    } else if (switchedExercisesInPausedWorkout.length > 0) {
      console.log('UPDATING PAUSED WORKOUT - WARNING: Switched exercises were lost during update!');
    }

    return finalPausedWorkoutData;
  } catch (error) {
    console.error('Error updating paused workout with customizations:', error);
    return pausedWorkoutData;
  }
};
export default function disablewarn() {
  return null;
}
