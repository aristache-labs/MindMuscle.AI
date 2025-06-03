import { z } from 'zod';

// Base validation schemas
export const IdSchema = z.string().min(1, 'ID cannot be empty');
export const EmailSchema = z.string().email('Invalid email format');
export const UrlSchema = z.string().url('Invalid URL format').optional();
export const DateStringSchema = z.string().datetime('Invalid date format');
export const PositiveNumberSchema = z.number().positive('Must be a positive number');
export const NonNegativeNumberSchema = z.number().min(0, 'Cannot be negative');

// Exercise validation schemas
export const ExerciseSetSchema = z.object({
  isCompleted: z.boolean(),
  weight: z.number().optional(),
  reps: z.number().optional(),
  restTime: z.number().optional(),
  notes: z.string().optional(),
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
  image_url: UrlSchema,
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
