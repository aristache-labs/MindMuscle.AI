export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  preferences: UserPreferences;
  stats: UserStats;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  goal: 'muscle_gain' | 'weight_loss' | 'strength' | 'endurance' | 'flexibility';
  measurementUnit: 'metric' | 'imperial';
  darkMode: boolean;
  notifications: boolean;
  language: string;
}

export interface UserStats {
  workoutsCompleted: number;
  totalWorkoutTime: number;
  streakDays: number;
  level: number;
  experience: number;
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: Date;
}

export interface Exercise {
  id: string;
  name: string;
  description: string;
  type: 'strength' | 'cardio' | 'flexibility' | 'custom';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  muscleGroups: MuscleGroup[];
  equipment: Equipment[];
  instructions: string[];
  videoUrl?: string;
  thumbnailUrl?: string;
  metrics: ExerciseMetrics;
  isCustom: boolean;
  createdBy?: string;
}

export interface ExerciseMetrics {
  sets?: number;
  reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
}

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'legs'
  | 'core'
  | 'fullBody';

export type Equipment =
  | 'bodyweight'
  | 'dumbbell'
  | 'barbell'
  | 'kettlebell'
  | 'resistance_band'
  | 'machine'
  | 'cable'
  | 'other';

export interface Workout {
  id: string;
  name: string;
  description: string;
  type: 'strength' | 'cardio' | 'flexibility' | 'custom';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  exercises: WorkoutExercise[];
  duration: number;
  calories: number;
  isCustom: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: number;
  reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
  order: number;
}

export interface WorkoutProgress {
  id: string;
  workoutId: string;
  userId: string;
  startedAt: Date;
  completedAt?: Date;
  exercises: WorkoutExerciseProgress[];
  notes?: string;
}

export interface WorkoutExerciseProgress {
  exerciseId: string;
  sets: {
    reps?: number;
    weight?: number;
    duration?: number;
    distance?: number;
    completed: boolean;
  }[];
} 