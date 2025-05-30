export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps_range: string;
  image_url?: string;
  primary_muscles?: string[];
  exercise_name?: string;
  workout_day: number;
  exercise_id?: string;
}

export interface ExerciseSet {
  isCompleted: boolean;
  weight?: number;
  reps?: number;
  restTime?: number;
  notes?: string;
}

export interface WorkoutDay {
  day: number;
  exercises: Exercise[];
  total_exercises: number;
  estimated_duration: number;
  total_calories: number;
  id?: string;
  name?: string;
}

export interface Plan {
  id: string;
  title: string;
  difficulty_level?: string;
  subtitle?: string;
  category_name?: string;
  workoutDays: WorkoutDay[];
  current_day: number;
  start_date: string;
}

export interface MyPlanScreenProps {
  embedded?: boolean;
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

export interface CycleProgress {
  currentWeek: number;
  weekName: string;
  completedWorkouts: number;
  totalWorkoutsInCycle: number;
  progressPercentage: number;
  weekDescription: string;
  recommendationTemplate: string;
}

export interface LockedWeekInfo {
  selectedWeek: number;
  selectedWeekName: string;
  currentWeek: number;
  currentWeekName: string;
}

export interface PausedWorkoutInfo {
  pausedDay: number | null;
  currentDay: number | null;
  mode: 'start' | 'redo';
}

export interface ExerciseChange {
  id: string;
  oldExerciseId: string;
  newExerciseId: string;
  newExercise: Exercise;
}

export interface SelectedExercise {
  id: string;
  name: string;
  image_url?: string;
  primary_muscles?: string[];
  secondary_muscles?: string[];
  exercise_id?: string;
}

export interface PausedWorkout {
  userId: string;
  planId: string;
  workoutDay: number;
  cycleWeek: number;
  weekName: string;
  exercises: Exercise[];
  exerciseSets: Record<string, ExerciseSet[]>;
  workoutDuration: number;
  totalVolume: number;
  totalReps: number;
  currentExerciseIndex: number;
  originalCycleWeek: number;
  pausedAt: string;
}
export default function disablewarn() {
  return null;
}
