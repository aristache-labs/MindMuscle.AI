// Workout Feature Types
export interface ExerciseData {
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

export interface ExerciseSet {
  id: string;
  setNumber: number;
  weight: string;
  reps: string;
  isCompleted: boolean;
}

export interface ExerciseDataItem {
  id: string;
  sets: number;
  reps_range: string;
  exercise_id: string;
  workout_day: number;
  exercise_name?: string;
  rest_time?: number;
  order: number;
  exercises?: any;
}

export interface MaxWeightDataPoint {
  date: string;
  value: number;
}

export interface CompletedWorkoutData {
  completedExercises: number;
  duration: string;
  caloriesBurned: number;
  totalVolume: number;
  totalReps: number;
  completedAt: string;
  weekName: string;
  cycleWeek: number;
}

export interface CycleWeekInfo {
  weekNumber: number;
  weekName: string;
  weightAdjustmentPercentage: number;
  repsAdjustmentPercentage: number;
}

export type WorkoutState = 'in_progress' | 'completing' | 'completed'; 