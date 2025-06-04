import { z } from 'zod';

// Base validation schemas
export const IdSchema = z.string().min(1, 'ID cannot be empty');
export const EmailSchema = z.string().email('Invalid email format');
export const UrlSchema = z.string().url('Invalid URL format').optional().or(z.literal(''));
export const DateStringSchema = z.string().datetime('Invalid date format');
export const PositiveNumberSchema = z.number().positive('Must be a positive number');
export const NonNegativeNumberSchema = z.number().min(0, 'Cannot be negative');

// Exercise validation schemas
export const ExerciseSetSchema = z.object({
  id: z.string(),
  setNumber: z.number(),
  weight: z.string(),
  reps: z.string(),
  isCompleted: z.boolean(),
});

// General exercise schema (for exercise library)
export const GeneralExerciseSchema = z.object({
  id: IdSchema,
  name: z.string().min(1, 'Exercise name is required'),
  description: z.string().optional(),
  muscle_group: z.string().optional(),
  primary_muscles: z.array(z.string()).optional(),
  secondary_muscles: z.array(z.string()).optional(),
  equipment: z.string().optional(),
  difficulty: z.string().optional(),
  instructions: z.array(z.string()).optional(),
  image_url: UrlSchema,
  video_url: UrlSchema,
  requires_weight: z.boolean().optional(),
  is_favorite: z.boolean().optional(),
  category: z.string().optional(),
});

// Workout exercise schema (for exercises in a workout plan)
export const ExerciseSchema = z.object({
  id: IdSchema,
  name: z.string().min(1, 'Exercise name is required'),
  sets: PositiveNumberSchema,
  reps_range: z.string().regex(/^\d+-\d+$/, 'Reps range must be in format "min-max"'),
  image_url: UrlSchema,
  primary_muscles: z.array(z.string()).optional(),
  exercise_name: z.string().optional(),
  workout_day: PositiveNumberSchema,
  exercise_id: z.string().optional(),
  muscle_group: z.string().optional(),
  requires_weight: z.boolean().optional(),
  estimated_duration: z.number().optional(),
  calories_per_set: z.number().optional(),
});

export const WorkoutDaySchema = z.object({
  day: PositiveNumberSchema,
  exercises: z.array(ExerciseSchema),
  total_exercises: NonNegativeNumberSchema,
  estimated_duration: NonNegativeNumberSchema,
  total_calories: NonNegativeNumberSchema,
  id: z.string().optional(),
  name: z.string().optional(),
});

export const PlanSchema = z.object({
  id: IdSchema,
  title: z.string().min(1, 'Plan title is required'),
  difficulty_level: z.string().optional(),
  subtitle: z.string().optional(),
  category_name: z.string().optional(),
  workoutDays: z.array(WorkoutDaySchema),
  current_day: PositiveNumberSchema,
  start_date: DateStringSchema,
});

// User validation schemas
export const UserProfileSchema = z.object({
  id: IdSchema,
  email: EmailSchema.optional(),
  full_name: z.string().optional(),
  avatar_url: UrlSchema,
  created_at: DateStringSchema.optional(),
  updated_at: DateStringSchema.optional(),
  user_metadata: z.record(z.unknown()).optional(),
});

// Workout session validation schemas
export const PausedWorkoutSchema = z.object({
  userId: IdSchema,
  planId: IdSchema,
  workoutDay: PositiveNumberSchema,
  cycleWeek: PositiveNumberSchema,
  weekName: z.string(),
  exercises: z.array(ExerciseSchema),
  exerciseSets: z.record(z.array(ExerciseSetSchema)),
  workoutDuration: NonNegativeNumberSchema,
  totalVolume: NonNegativeNumberSchema,
  totalReps: NonNegativeNumberSchema,
  currentExerciseIndex: NonNegativeNumberSchema,
  originalCycleWeek: PositiveNumberSchema,
  pausedAt: DateStringSchema,
});

export const CompletedWorkoutDataSchema = z.object({
  completedExercises: NonNegativeNumberSchema,
  duration: z.string(),
  caloriesBurned: NonNegativeNumberSchema,
  totalVolume: NonNegativeNumberSchema,
  totalReps: NonNegativeNumberSchema,
  completedAt: DateStringSchema,
  weekName: z.string(),
  cycleWeek: PositiveNumberSchema,
});

// Cycle and progress validation schemas
export const CycleProgressSchema = z.object({
  currentWeek: PositiveNumberSchema,
  weekName: z.string(),
  completedWorkouts: NonNegativeNumberSchema,
  totalWorkoutsInCycle: PositiveNumberSchema,
  progressPercentage: z.number().min(0).max(100),
  weekDescription: z.string(),
  recommendationTemplate: z.string(),
});

// Measurement validation schemas
export const MeasurementSchema = z.object({
  id: IdSchema.optional(),
  user_id: IdSchema,
  measurement_type: z.enum([
    'weight',
    'chest',
    'waist',
    'biceps',
    'thigh',
    'calf',
    'shoulders',
    'abs',
  ]),
  value: PositiveNumberSchema,
  unit: z.enum(['kg', 'lbs', 'cm', 'in']),
  measured_at: DateStringSchema,
  notes: z.string().optional(),
});

// Progress photo validation schemas
export const ProgressPhotoSchema = z.object({
  id: IdSchema.optional(),
  user_id: IdSchema,
  photo_url: z.string().min(1, 'Photo URL is required'),
  photo_type: z.enum(['front', 'side', 'back']),
  taken_at: DateStringSchema,
  notes: z.string().optional(),
});

// AI Coaching validation schemas
export const AICoachingRequestSchema = z.object({
  userId: IdSchema,
  message: z.string().min(1, 'Message cannot be empty'),
  context: z
    .object({
      currentWorkout: z.string().optional(),
      recentProgress: z.array(z.unknown()).optional(),
      goals: z.array(z.string()).optional(),
    })
    .optional(),
});

export const AICoachingResponseSchema = z.object({
  message: z.string(),
  suggestions: z.array(z.string()).optional(),
  exerciseRecommendations: z.array(z.string()).optional(),
  motivationalTips: z.array(z.string()).optional(),
});

// Exercise configuration validation (for AddExerciseModal)
export const ExerciseConfigurationSchema = z.object({
  exerciseId: IdSchema,
  name: z.string().min(1, 'Exercise name is required'),
  sets: PositiveNumberSchema,
  reps_range: z.string().regex(/^\d+-\d+$/, 'Reps range must be in format "min-max"'),
  image_url: z.string().url('Invalid URL format').optional().or(z.literal('')),
  muscle_group: z.string(),
  primary_muscles: z.array(z.string()).optional(),
  requires_weight: z.boolean().optional(),
});

// API response validation schemas
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export const PaginatedResponseSchema = z.object({
  data: z.array(z.unknown()),
  pagination: z.object({
    page: PositiveNumberSchema,
    limit: PositiveNumberSchema,
    total: NonNegativeNumberSchema,
    totalPages: PositiveNumberSchema,
  }),
});

// Form validation schemas
export const LoginFormSchema = z.object({
  email: EmailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const RegisterFormSchema = z
  .object({
    email: EmailSchema,
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const ProfileUpdateSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  avatar_url: UrlSchema,
  preferences: z.record(z.unknown()).optional(),
});

// Workout plan creation validation
export const CreateWorkoutPlanSchema = z.object({
  title: z.string().min(1, 'Plan title is required'),
  subtitle: z.string().optional(),
  difficulty_level: z.string().optional(),
  category_name: z.string().optional(),
  workoutDays: z.array(WorkoutDaySchema),
});

// Workout data service validation schemas
export const WorkoutHistoryRecordSchema = z.object({
  id: IdSchema.optional(),
  user_id: IdSchema,
  plan_id: IdSchema,
  workout_day: PositiveNumberSchema,
  cycle_week: PositiveNumberSchema,
  week_name: z.string().min(1, 'Week name is required'),
  workout_duration: z.string().min(1, 'Workout duration is required'),
  calories_burned: NonNegativeNumberSchema,
  total_volume: NonNegativeNumberSchema,
  total_reps: NonNegativeNumberSchema,
  completed_at: DateStringSchema,
  exercises_count: PositiveNumberSchema,
  exercise_structure: z.string().optional(),
});

export const ExerciseRecordSchema = z.object({
  id: IdSchema.optional(),
  workout_history_id: IdSchema,
  exercise_id: IdSchema,
  workout_plan_exercise_id: IdSchema,
  set_number: PositiveNumberSchema,
  weight: NonNegativeNumberSchema,
  reps: NonNegativeNumberSchema,
  completed: z.boolean(),
  created_at: DateStringSchema.optional(),
});

export const CompleteWorkoutOptionsSchema = z.object({
  userId: IdSchema,
  planId: IdSchema,
  workoutDay: PositiveNumberSchema,
  cycleWeek: PositiveNumberSchema,
  weekName: z.string().min(1, 'Week name is required'),
  exercises: z.array(ExerciseSchema),
  exerciseSets: z.record(z.array(ExerciseSetSchema)),
  workoutDuration: PositiveNumberSchema,
  totalVolume: NonNegativeNumberSchema,
  totalReps: NonNegativeNumberSchema,
  isRedoWorkout: z.boolean().optional(),
  originalCycleWeek: PositiveNumberSchema.optional(),
});

export const SavedExerciseStructureSchema = z.object({
  id: IdSchema,
  exercise_id: IdSchema,
  name: z.string().min(1, 'Exercise name is required'),
  sets: PositiveNumberSchema,
  reps_range: z.string().regex(/^\d+-\d+$/, 'Reps range must be in format "min-max"'),
  image_url: UrlSchema,
  primary_muscles: z.array(z.string()).optional(),
  requires_weight: z.boolean(),
  workout_day: PositiveNumberSchema,
  order: NonNegativeNumberSchema,
  restTime: NonNegativeNumberSchema,
  isChangedExercise: z.boolean().optional(),
});

// Achievement validation schemas
export const AchievementSchema = z.object({
  id: IdSchema.optional(),
  title: z.string().min(1, 'Achievement title is required'),
  description: z.string().min(1, 'Achievement description is required'),
  subtitle: z.string().optional(),
  requirement: z.string().min(1, 'Achievement requirement is required'),
  icon: z.string().min(1, 'Achievement icon is required'),
  icon_background_color: z.string().optional(),
  total_progress: PositiveNumberSchema.optional(),
  created_at: DateStringSchema.optional(),
  updated_at: DateStringSchema.optional(),
});

export const UserAchievementSchema = z.object({
  id: IdSchema.optional(),
  user_id: IdSchema,
  achievement_id: IdSchema,
  is_completed: z.boolean(),
  completed_at: DateStringSchema.optional(),
  current_progress: NonNegativeNumberSchema,
  created_at: DateStringSchema.optional(),
  updated_at: DateStringSchema.optional(),
});

export const UpdateAchievementProgressSchema = z.object({
  userId: IdSchema,
  achievementId: IdSchema,
  progress: NonNegativeNumberSchema,
});

// Progress photo validation schemas (enhanced)
export const ProgressPhotoUploadSchema = z.object({
  userId: IdSchema,
  type: z.enum(['before', 'after']),
  uri: z.string().min(1, 'Photo URI is required'),
  date: z.date().optional(),
});

export const ProgressPhotoRecordSchema = z.object({
  id: IdSchema.optional(),
  user_id: IdSchema,
  photo_url: z.string().min(1, 'Photo URL is required'),
  type: z.enum(['before', 'after']),
  created_at: DateStringSchema.optional(),
  taken_at: DateStringSchema,
});

// Settings and preferences validation schemas
export const UserPreferencesSchema = z.object({
  preferred_weight_unit: z.enum(['KG', 'LB']).optional(),
  preferred_height_unit: z.enum(['CM', 'INCH']).optional(),
  notifications_enabled: z.boolean().optional(),
  workout_reminders: z.boolean().optional(),
  dark_theme: z.boolean().optional(),
  sound_enabled: z.boolean().optional(),
});

export const WorkoutDaysPreferenceSchema = z.object({
  userId: IdSchema,
  workoutDays: z.array(z.number().min(0).max(6)).min(1, 'At least one workout day is required'),
});

export const NotificationSettingsSchema = z.object({
  userId: IdSchema,
  workout_reminders: z.boolean(),
  achievement_notifications: z.boolean(),
  progress_updates: z.boolean(),
  reminder_time: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format')
    .optional(),
});

// Workout plan service validation schemas
export const ActivePlanDataSchema = z.object({
  currentWeek: PositiveNumberSchema,
  weekName: z.string().min(1, 'Week name is required'),
  planId: IdSchema,
  workoutDay: NonNegativeNumberSchema,
});

export const SaveCompletedWorkoutSchema = z.object({
  userId: IdSchema,
  planId: IdSchema,
  workoutDay: PositiveNumberSchema,
  cycleWeek: PositiveNumberSchema,
  weekName: z.string().min(1, 'Week name is required'),
  exercises: z.array(ExerciseSchema),
  exerciseSets: z.record(z.array(ExerciseSetSchema)),
  totalVolume: NonNegativeNumberSchema,
  totalReps: NonNegativeNumberSchema,
  duration: PositiveNumberSchema,
  completedAt: z.string().min(1, 'Completion time is required'),
});

// Form component validation schemas
export const CustomizeExerciseFormSchema = z.object({
  exerciseId: IdSchema,
  sets: PositiveNumberSchema.min(1).max(20),
  repsRange: z.string().regex(/^\d+-\d+$/, 'Reps range must be in format "min-max"'),
  restTime: NonNegativeNumberSchema.max(600), // Max 10 minutes
});

export const MeasurementFormSchema = z.object({
  category: z.enum(['WEIGHT', 'CHEST', 'WAIST', 'BICEPS', 'THIGH', 'CALF', 'SHOULDERS', 'ABS']),
  value: PositiveNumberSchema,
  unit: z.string().min(1, 'Unit is required'),
  measuredAt: z.date().optional(),
});

export const TimerSettingsSchema = z.object({
  restTime: NonNegativeNumberSchema.max(600), // Max 10 minutes
  autoStart: z.boolean(),
  soundEnabled: z.boolean(),
  vibrationEnabled: z.boolean(),
});

// Workout data service validation schemas
export const FetchWorkoutDataSchema = z.object({
  planId: IdSchema,
  workoutDay: PositiveNumberSchema,
  userId: IdSchema,
  cycleWeek: PositiveNumberSchema,
  isRedoWorkout: z.boolean().optional(),
});

export const FetchLastExerciseRecordsSchema = z.object({
  userId: IdSchema,
  exercises: z.array(ExerciseSchema),
});

export const CheckWorkoutCompletionSchema = z.object({
  userId: IdSchema,
  planId: IdSchema,
  workoutDay: PositiveNumberSchema,
});

export const GetLastCompletedWorkoutStructureSchema = z.object({
  userId: IdSchema,
  planId: IdSchema,
  workoutDay: PositiveNumberSchema,
  cycleWeek: PositiveNumberSchema,
});

export const CheckWorkoutCompletionForCycleWeekSchema = z.object({
  userId: IdSchema,
  planId: IdSchema,
  workoutDay: PositiveNumberSchema,
  cycleWeek: PositiveNumberSchema,
});

// Add Exercise Modal validation schemas
export const AddExerciseFormSchema = z.object({
  exercises: z.array(ExerciseConfigurationSchema).min(1, 'At least one exercise must be selected'),
});

// Storage and Context validation schemas
export const ProfileContextSchema = z.object({
  name: z.string(),
  email: z.string().email('Invalid email format'),
  avatar: z.string().optional(),
  preferences: z.object({
    notifications: z.boolean(),
    darkMode: z.boolean(),
    language: z.string(),
  }),
});

export const AchievementContextSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  xp: z.number().nonnegative(),
  completed: z.boolean(),
  progress: z.number().nonnegative(),
  target: z.number().positive(),
  type: z.enum(['workouts', 'exercises', 'streak', 'personalRecords', 'duration']),
  completedAt: z.string().optional(),
});

export const UserStatsSchema = z.object({
  level: z.number().positive(),
  xp: z.number().nonnegative(),
  totalXp: z.number().nonnegative(),
  nextLevelXp: z.number().positive(),
  achievements: z.array(AchievementContextSchema),
});

export const AuthStateSchema = z.object({
  user: z
    .object({
      id: z.string(),
      email: z.string().email(),
      name: z.string(),
    })
    .nullable(),
  token: z.string().nullable(),
});

export const ExerciseDataSchema = z.object({
  id: z.string(),
  exercise_id: z.string(),
  name: z.string(),
  sets: z.number().positive(),
  reps_range: z.string(),
  image_url: z.string().optional(),
  primary_muscles: z.array(z.string()).optional(),
  restTime: z.number().optional(),
  order: z.number().nonnegative(),
  workout_day: z.number().nonnegative(),
  requires_weight: z.boolean().optional(),
  isChangedExercise: z.boolean().optional(),
});

export const PausedWorkoutDataSchema = z.object({
  userId: z.string(),
  planId: z.string(),
  workoutDay: z.number().nonnegative(),
  cycleWeek: z.number().positive(),
  weekName: z.string(),
  exercises: z.array(ExerciseDataSchema),
  exerciseSets: z.record(z.array(ExerciseSetSchema)),
  workoutDuration: z.number().nonnegative(),
  totalVolume: z.number().nonnegative(),
  totalReps: z.number().nonnegative(),
  currentExerciseIndex: z.number().nonnegative(),
  originalCycleWeek: z.number().positive().nullable().optional(),
  pausedAt: z.string().optional(),
});

export const SavedPlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  difficulty_level: z.string().optional(),
  subtitle: z.string().optional(),
  category_name: z.string().optional(),
  workoutDays: z.array(WorkoutDaySchema),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const CacheEntrySchema = z.object({
  data: z.unknown(),
  timestamp: z.number(),
  ttl: z.number().optional(),
  version: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const PersistedClientSchema = z.object({
  clientState: z.object({
    queries: z.array(z.unknown()),
    mutations: z.array(z.unknown()),
  }),
  buster: z.string(),
});

export const CoachingHistorySchema = z.array(
  z.object({
    id: z.string(),
    message: z.string(),
    response: z.string(),
    timestamp: z.string(),
    context: z.record(z.unknown()).optional(),
  }),
);

export const WorkoutDaysDataSchema = z.object({
  selectedDays: z.array(z.number().min(0).max(6)),
  lastUpdated: z.string().optional(),
  version: z.number().optional(),
});

export const CoachingUserProfileSchema = z.object({
  age: z.number().min(13).max(120),
  gender: z.string().min(1),
  weight: z.number().positive(),
  height: z.number().positive(),
  medicalConditions: z.array(z.string()).optional(),
});

// Type exports for new schemas
export type ProfileContext = z.infer<typeof ProfileContextSchema>;
export type AchievementContext = z.infer<typeof AchievementContextSchema>;
export type UserStats = z.infer<typeof UserStatsSchema>;
export type AuthState = z.infer<typeof AuthStateSchema>;
export type ExerciseData = z.infer<typeof ExerciseDataSchema>;
export type PausedWorkoutData = z.infer<typeof PausedWorkoutDataSchema>;
export type SavedPlan = z.infer<typeof SavedPlanSchema>;
export type CacheEntry = z.infer<typeof CacheEntrySchema>;
export type PersistedClient = z.infer<typeof PersistedClientSchema>;
export type CoachingHistory = z.infer<typeof CoachingHistorySchema>;
export type WorkoutDaysData = z.infer<typeof WorkoutDaysDataSchema>;

// Type exports
export type GeneralExercise = z.infer<typeof GeneralExerciseSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type WorkoutDay = z.infer<typeof WorkoutDaySchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type PausedWorkout = z.infer<typeof PausedWorkoutSchema>;
export type CompletedWorkoutData = z.infer<typeof CompletedWorkoutDataSchema>;
export type CycleProgress = z.infer<typeof CycleProgressSchema>;
export type Measurement = z.infer<typeof MeasurementSchema>;
export type ProgressPhoto = z.infer<typeof ProgressPhotoSchema>;
export type ExerciseConfiguration = z.infer<typeof ExerciseConfigurationSchema>;
export type LoginForm = z.infer<typeof LoginFormSchema>;
export type RegisterForm = z.infer<typeof RegisterFormSchema>;
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
export type CreateWorkoutPlan = z.infer<typeof CreateWorkoutPlanSchema>;
export type AICoachingRequest = z.infer<typeof AICoachingRequestSchema>;
export type AICoachingResponse = z.infer<typeof AICoachingResponseSchema>;
export type WorkoutHistoryRecord = z.infer<typeof WorkoutHistoryRecordSchema>;
export type ExerciseRecord = z.infer<typeof ExerciseRecordSchema>;
export type CompleteWorkoutOptions = z.infer<typeof CompleteWorkoutOptionsSchema>;
export type SavedExerciseStructure = z.infer<typeof SavedExerciseStructureSchema>;
export type Achievement = z.infer<typeof AchievementSchema>;
export type UserAchievement = z.infer<typeof UserAchievementSchema>;
export type UpdateAchievementProgress = z.infer<typeof UpdateAchievementProgressSchema>;
export type ProgressPhotoUpload = z.infer<typeof ProgressPhotoUploadSchema>;
export type ProgressPhotoRecord = z.infer<typeof ProgressPhotoRecordSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type WorkoutDaysPreference = z.infer<typeof WorkoutDaysPreferenceSchema>;
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;
export type ActivePlanData = z.infer<typeof ActivePlanDataSchema>;
export type SaveCompletedWorkout = z.infer<typeof SaveCompletedWorkoutSchema>;
export type CustomizeExerciseForm = z.infer<typeof CustomizeExerciseFormSchema>;
export type MeasurementForm = z.infer<typeof MeasurementFormSchema>;
export type TimerSettings = z.infer<typeof TimerSettingsSchema>;
export type FetchWorkoutData = z.infer<typeof FetchWorkoutDataSchema>;
export type FetchLastExerciseRecords = z.infer<typeof FetchLastExerciseRecordsSchema>;
export type CheckWorkoutCompletion = z.infer<typeof CheckWorkoutCompletionSchema>;
export type GetLastCompletedWorkoutStructure = z.infer<
  typeof GetLastCompletedWorkoutStructureSchema
>;
export type CheckWorkoutCompletionForCycleWeek = z.infer<
  typeof CheckWorkoutCompletionForCycleWeekSchema
>;

// Default export to satisfy Expo Router (this file should not be a route)
export default function SchemasRouterPlaceholder() {
  return null;
}
