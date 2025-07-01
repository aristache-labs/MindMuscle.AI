// Export workout feature components
export * from './components';

// Export workout feature hooks
export {
  useWorkoutTimer,
  useExerciseSets,
  useWorkoutState,
  useWorkoutNavigation,
  useWorkoutCompletion,
  useWorkoutData,
  useWorkoutInitialization,
  useWorkoutRender,
  useWorkoutExitHandling,
  useWorkoutKeyboardHandling,
  useExerciseSelection,
  useWorkoutWarmup,
  useWorkoutRestTimer,
  useKeyboardHandling,
  type UseWorkoutRestTimerReturn,
  type UseWorkoutRestTimerParams,
} from './hooks';

// Export workout feature types
export type {
  ExerciseData,
  ExerciseSet,
  ExerciseDataItem,
  MaxWeightDataPoint,
  CompletedWorkoutData,
  CycleWeekInfo,
  WorkoutState,
} from './types';

// Export workout feature utilities
export * from './utils';

// Export workout screens
export { default as WorkoutSessionScreen } from './screens/workout-session';

export default function disablewarn() {
  return null;
}
