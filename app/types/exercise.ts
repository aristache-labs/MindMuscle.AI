export interface Exercise {
  id: string;
  name: string;
  category: string;
  equipment: string;
  difficulty: string;
  description: string;
  instructions: string[];
  muscles: string[];
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseSet {
  id?: string;
  setNumber?: number;
  reps?: string;
  weight?: string;
  notes?: string;
  isCompleted?: boolean;
}

export interface ExerciseInWorkout {
  id: string;
  exerciseId: string;
  name: string;
  sets: ExerciseSet[];
  notes?: string;
}

// Sentry Monitoring Types for Exercise Operations
export interface ExercisePerformanceMetrics {
  exerciseId: string;
  exerciseName: string;
  operationType: 'load' | 'save' | 'update' | 'delete' | 'search' | 'filter';
  duration: number;
  success: boolean;
  errorMessage?: string;
  timestamp: Date;
  userId?: string;
  additionalData?: Record<string, string | number | boolean | Date | null>;
}

export interface ExerciseErrorContext {
  exerciseId?: string;
  exerciseName?: string;
  operation: string;
  userId?: string;
  category?: string;
  equipment?: string;
  difficulty?: string;
  setNumber?: number;
  workoutSessionId?: string;
  errorType: 'validation' | 'network' | 'database' | 'ui' | 'business_logic' | 'permission';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ExerciseAnalyticsEvent {
  eventType:
    | 'exercise_selected'
    | 'set_completed'
    | 'exercise_customized'
    | 'exercise_favorited'
    | 'exercise_unfavorited'
    | 'exercise_searched'
    | 'exercise_filtered'
    | 'exercise_shared'
    | 'exercise_instructions_viewed'
    | 'exercise_progress_viewed';
  exerciseId: string;
  exerciseName: string;
  category: string;
  difficulty: string;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  properties?: {
    searchTerm?: string;
    filterCriteria?: string[];
    setNumber?: number;
    weight?: string;
    reps?: string;
    duration?: number;
    muscleGroups?: string[];
    equipment?: string;
    previousBest?: string;
    improvement?: boolean;
  };
}

export interface ExerciseValidationError {
  field: string;
  message: string;
  value?: string | number | boolean | Date | null | undefined;
  exerciseId?: string;
  exerciseName?: string;
  setNumber?: number;
  validationType: 'required' | 'format' | 'range' | 'custom';
}

export interface ExerciseLoadingState {
  isLoading: boolean;
  operation: string;
  exerciseId?: string;
  startTime: Date;
  timeout?: number;
  retryCount?: number;
  maxRetries?: number;
}

export interface ExerciseSessionContext {
  sessionId: string;
  workoutId?: string;
  planId?: string;
  userId: string;
  startTime: Date;
  currentExerciseId?: string;
  currentExerciseName?: string;
  currentSetNumber?: number;
  totalExercises: number;
  completedExercises: number;
  sessionType: 'workout' | 'preview' | 'custom' | 'ai_generated';
  isTimerActive?: boolean;
  timerDuration?: number;
}

// Enhanced Exercise Interfaces with Monitoring Support
export interface ExerciseWithMonitoring extends Exercise {
  performanceMetrics?: ExercisePerformanceMetrics[];
  lastAccessTime?: Date;
  accessCount?: number;
  errorCount?: number;
  averageCompletionTime?: number;
  userRating?: number;
  popularityScore?: number;
}

export interface ExerciseSetWithTracking extends ExerciseSet {
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  restTime?: number;
  perceivedExertion?: number;
  performanceNotes?: string;
  errorOccurred?: boolean;
  errorMessage?: string;
  retryCount?: number;
}

export interface ExerciseInWorkoutWithAnalytics extends ExerciseInWorkout {
  analytics?: ExerciseAnalyticsEvent[];
  performanceData?: {
    totalDuration: number;
    averageRestTime: number;
    totalVolume: number;
    personalRecord?: boolean;
    improvement?: number;
    difficultyRating?: number;
  };
  errors?: ExerciseValidationError[];
  sessionContext?: ExerciseSessionContext;
}

// Utility Types for Exercise Operations
export type ExerciseOperationType =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'search'
  | 'filter'
  | 'favorite'
  | 'unfavorite'
  | 'customize'
  | 'share'
  | 'preview'
  | 'select'
  | 'complete_set'
  | 'skip'
  | 'rest'
  | 'view_instructions'
  | 'view_progress';

export type ExerciseCategory =
  | 'strength'
  | 'cardio'
  | 'flexibility'
  | 'balance'
  | 'sports'
  | 'rehabilitation'
  | 'warm_up'
  | 'cool_down'
  | 'plyometric'
  | 'isometric'
  | 'compound'
  | 'isolation';

export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'adaptive';

export type ExerciseEquipment =
  | 'none'
  | 'dumbbells'
  | 'barbell'
  | 'resistance_bands'
  | 'kettlebells'
  | 'cable_machine'
  | 'pull_up_bar'
  | 'exercise_ball'
  | 'yoga_mat'
  | 'bench'
  | 'squat_rack'
  | 'treadmill'
  | 'bicycle'
  | 'rowing_machine'
  | 'other';

// Exercise State Management Types
export interface ExerciseState {
  exercises: Exercise[];
  currentExercise: Exercise | null;
  favoriteExercises: string[];
  recentExercises: Exercise[];
  searchTerm: string;
  filters: {
    category?: ExerciseCategory;
    difficulty?: ExerciseDifficulty;
    equipment?: ExerciseEquipment;
    muscles?: string[];
  };
  isLoading: boolean;
  error: string | null;
  performanceMetrics: ExercisePerformanceMetrics[];
  sessionContext: ExerciseSessionContext | null;
}

// Dummy component to satisfy Expo Router's requirements
const ExerciseTypes = () => null;
export default ExerciseTypes;
