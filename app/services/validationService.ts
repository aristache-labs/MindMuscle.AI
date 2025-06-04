import { z } from 'zod';
import { logger } from '../utils/logger';
import {
  AchievementSchema,
  ActivePlanDataSchema,
  CustomizeExerciseFormSchema,
  ExerciseConfigurationSchema,
  ExerciseSchema,
  GeneralExerciseSchema,
  LoginFormSchema,
  MeasurementFormSchema,
  MeasurementSchema,
  NotificationSettingsSchema,
  PausedWorkoutSchema,
  PlanSchema,
  ProgressPhotoRecordSchema,
  ProgressPhotoSchema,
  ProgressPhotoUploadSchema,
  RegisterFormSchema,
  SaveCompletedWorkoutSchema,
  TimerSettingsSchema,
  UpdateAchievementProgressSchema,
  UserAchievementSchema,
  UserPreferencesSchema,
  UserProfileSchema,
  WorkoutDaySchema,
  WorkoutDaysPreferenceSchema,
} from '../validation/schemas';
import {
  safeValidate,
  validateArray,
  ValidationException,
  ValidationResult,
} from '../validation/utils';

class ValidationService {
  // Exercise validation methods
  validateExercise(data: unknown): ValidationResult<z.infer<typeof ExerciseSchema>> {
    return safeValidate(ExerciseSchema, data, 'exercise');
  }

  validateGeneralExercise(data: unknown): ValidationResult<z.infer<typeof GeneralExerciseSchema>> {
    return safeValidate(GeneralExerciseSchema, data, 'general exercise');
  }

  validateExerciseConfiguration(
    data: unknown,
  ): ValidationResult<z.infer<typeof ExerciseConfigurationSchema>> {
    return safeValidate(ExerciseConfigurationSchema, data, 'exercise configuration');
  }

  validateExerciseConfigurations(
    data: unknown[],
  ): ValidationResult<z.infer<typeof ExerciseConfigurationSchema>[]> {
    return validateArray(ExerciseConfigurationSchema, data, 'exercise configurations');
  }

  // Workout validation methods
  validateWorkoutDay(data: unknown): ValidationResult<z.infer<typeof WorkoutDaySchema>> {
    return safeValidate(WorkoutDaySchema, data, 'workout day');
  }

  validatePlan(data: unknown): ValidationResult<z.infer<typeof PlanSchema>> {
    return safeValidate(PlanSchema, data, 'workout plan');
  }

  validatePausedWorkout(data: unknown): ValidationResult<z.infer<typeof PausedWorkoutSchema>> {
    return safeValidate(PausedWorkoutSchema, data, 'paused workout');
  }

  // User validation methods
  validateUserProfile(data: unknown): ValidationResult<z.infer<typeof UserProfileSchema>> {
    return safeValidate(UserProfileSchema, data, 'user profile');
  }

  validateLoginForm(data: unknown): ValidationResult<z.infer<typeof LoginFormSchema>> {
    return safeValidate(LoginFormSchema, data, 'login form');
  }

  validateRegisterForm(data: unknown): ValidationResult<z.infer<typeof RegisterFormSchema>> {
    return safeValidate(RegisterFormSchema, data, 'register form');
  }

  // Measurement validation methods
  validateMeasurement(data: unknown): ValidationResult<z.infer<typeof MeasurementSchema>> {
    return safeValidate(MeasurementSchema, data, 'measurement');
  }

  validateProgressPhoto(data: unknown): ValidationResult<z.infer<typeof ProgressPhotoSchema>> {
    return safeValidate(ProgressPhotoSchema, data, 'progress photo');
  }

  // Workout data service validation methods
  async validateWorkoutHistoryRecord(
    data: unknown,
  ): Promise<ValidationResult<z.infer<typeof WorkoutHistoryRecordSchema>>> {
    const { WorkoutHistoryRecordSchema } = await import('../validation/schemas');
    return safeValidate(WorkoutHistoryRecordSchema, data, 'workout history record');
  }

  async validateExerciseRecord(
    data: unknown,
  ): Promise<ValidationResult<z.infer<typeof ExerciseRecordSchema>>> {
    const { ExerciseRecordSchema } = await import('../validation/schemas');
    return safeValidate(ExerciseRecordSchema, data, 'exercise record');
  }

  async validateCompleteWorkoutOptions(
    data: unknown,
  ): Promise<ValidationResult<z.infer<typeof CompleteWorkoutOptionsSchema>>> {
    const { CompleteWorkoutOptionsSchema } = await import('../validation/schemas');
    return safeValidate(CompleteWorkoutOptionsSchema, data, 'complete workout options');
  }

  async validateSavedExerciseStructure(
    data: unknown,
  ): Promise<ValidationResult<z.infer<typeof SavedExerciseStructureSchema>>> {
    const { SavedExerciseStructureSchema } = await import('../validation/schemas');
    return safeValidate(SavedExerciseStructureSchema, data, 'saved exercise structure');
  }

  async validateExerciseRecords(
    data: unknown[],
  ): Promise<ValidationResult<z.infer<typeof ExerciseRecordSchema>[]>> {
    const { ExerciseRecordSchema } = await import('../validation/schemas');
    return validateArray(ExerciseRecordSchema, data, 'exercise records');
  }

  // Achievement validation methods
  validateAchievement(data: unknown): ValidationResult<z.infer<typeof AchievementSchema>> {
    return safeValidate(AchievementSchema, data, 'achievement');
  }

  validateUserAchievement(data: unknown): ValidationResult<z.infer<typeof UserAchievementSchema>> {
    return safeValidate(UserAchievementSchema, data, 'user achievement');
  }

  validateUpdateAchievementProgress(
    data: unknown,
  ): ValidationResult<z.infer<typeof UpdateAchievementProgressSchema>> {
    return safeValidate(UpdateAchievementProgressSchema, data, 'achievement progress update');
  }

  // Progress photo validation methods
  validateProgressPhotoUpload(
    data: unknown,
  ): ValidationResult<z.infer<typeof ProgressPhotoUploadSchema>> {
    return safeValidate(ProgressPhotoUploadSchema, data, 'progress photo upload');
  }

  validateProgressPhotoRecord(
    data: unknown,
  ): ValidationResult<z.infer<typeof ProgressPhotoRecordSchema>> {
    return safeValidate(ProgressPhotoRecordSchema, data, 'progress photo record');
  }

  // Settings and preferences validation methods
  validateUserPreferences(data: unknown): ValidationResult<z.infer<typeof UserPreferencesSchema>> {
    return safeValidate(UserPreferencesSchema, data, 'user preferences');
  }

  validateWorkoutDaysPreference(
    data: unknown,
  ): ValidationResult<z.infer<typeof WorkoutDaysPreferenceSchema>> {
    return safeValidate(WorkoutDaysPreferenceSchema, data, 'workout days preference');
  }

  validateNotificationSettings(
    data: unknown,
  ): ValidationResult<z.infer<typeof NotificationSettingsSchema>> {
    return safeValidate(NotificationSettingsSchema, data, 'notification settings');
  }

  // Workout plan service validation methods
  validateActivePlanData(data: unknown): ValidationResult<z.infer<typeof ActivePlanDataSchema>> {
    return safeValidate(ActivePlanDataSchema, data, 'active plan data');
  }

  validateSaveCompletedWorkout(
    data: unknown,
  ): ValidationResult<z.infer<typeof SaveCompletedWorkoutSchema>> {
    return safeValidate(SaveCompletedWorkoutSchema, data, 'save completed workout');
  }

  // Form component validation methods
  validateCustomizeExerciseForm(
    data: unknown,
  ): ValidationResult<z.infer<typeof CustomizeExerciseFormSchema>> {
    return safeValidate(CustomizeExerciseFormSchema, data, 'customize exercise form');
  }

  validateMeasurementForm(data: unknown): ValidationResult<z.infer<typeof MeasurementFormSchema>> {
    return safeValidate(MeasurementFormSchema, data, 'measurement form');
  }

  validateTimerSettings(data: unknown): ValidationResult<z.infer<typeof TimerSettingsSchema>> {
    return safeValidate(TimerSettingsSchema, data, 'timer settings');
  }

  // Generic validation methods
  validateWithSchema<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    context?: string,
  ): ValidationResult<T> {
    return safeValidate(schema, data, context);
  }

  validateArrayWithSchema<T>(
    schema: z.ZodSchema<T>,
    data: unknown[],
    context?: string,
  ): ValidationResult<T[]> {
    return validateArray(schema, data, context);
  }

  // Validation with error handling for UI
  async validateForUI<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    context?: string,
  ): Promise<{ isValid: boolean; data?: T; errors?: Record<string, string> }> {
    const result = safeValidate(schema, data, context);

    if (result.success) {
      return {
        isValid: true,
        data: result.data,
      };
    }

    // Format errors for UI display
    const errors: Record<string, string> = {};
    result.errors.forEach((error) => {
      if (!errors[error.field]) {
        errors[error.field] = error.message;
      }
    });

    return {
      isValid: false,
      errors,
    };
  }

  // Validation for API responses
  validateApiResponse<T>(schema: z.ZodSchema<T>, response: unknown, endpoint?: string): T {
    try {
      return schema.parse(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = `API response validation failed${endpoint ? ` for ${endpoint}` : ''}`;
        logger.error(errorMessage, error, {
          context: { endpoint, response, errors: error.errors },
        });
        throw new ValidationException(
          errorMessage,
          error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        );
      }
      throw error;
    }
  }

  // Validation for database operations
  validateForDatabase<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    operation: 'insert' | 'update' | 'select',
  ): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = `Database ${operation} validation failed`;
        logger.error(errorMessage, error, {
          context: { operation, data, errors: error.errors },
        });
        throw new ValidationException(
          errorMessage,
          error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        );
      }
      throw error;
    }
  }

  // Environment variable validation
  validateEnvVar<T>(schema: z.ZodSchema<T>, envVar: string | undefined, varName: string): T {
    if (envVar === undefined) {
      throw new Error(`Environment variable ${varName} is not defined`);
    }

    try {
      return schema.parse(envVar);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = `Environment variable ${varName} validation failed`;
        logger.error(errorMessage, error, {
          context: { varName, value: envVar, errors: error.errors },
        });
        throw new ValidationException(
          errorMessage,
          error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        );
      }
      throw error;
    }
  }

  // Validation with transformation
  validateAndTransform<TInput, TOutput>(
    schema: z.ZodSchema<TInput>,
    data: unknown,
    transformer: (data: TInput) => TOutput,
    context?: string,
  ): ValidationResult<TOutput> {
    const validationResult = safeValidate(schema, data, context);

    if (!validationResult.success) {
      return validationResult as ValidationResult<TOutput>;
    }

    try {
      const transformedData = transformer(validationResult.data);
      return {
        success: true,
        data: transformedData,
        errors: null,
      };
    } catch (error) {
      logger.error('Error during data transformation', error as Error, {
        context: { context, data },
      });

      return {
        success: false,
        data: null,
        errors: [
          {
            field: 'transformation',
            message: 'Failed to transform validated data',
            code: 'transformation_error',
          },
        ],
      };
    }
  }

  // Batch validation for multiple items
  validateBatch<T>(
    schema: z.ZodSchema<T>,
    items: unknown[],
    context?: string,
  ): {
    validItems: T[];
    invalidItems: Array<{ index: number; item: unknown; errors: string[] }>;
    hasErrors: boolean;
  } {
    const validItems: T[] = [];
    const invalidItems: Array<{ index: number; item: unknown; errors: string[] }> = [];

    items.forEach((item, index) => {
      const result = safeValidate(schema, item, `${context}[${index}]`);
      if (result.success) {
        validItems.push(result.data);
      } else {
        invalidItems.push({
          index,
          item,
          errors: result.errors.map((error) => error.message),
        });
      }
    });

    return {
      validItems,
      invalidItems,
      hasErrors: invalidItems.length > 0,
    };
  }

  // Conditional validation
  validateConditionally<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    condition: (data: unknown) => boolean,
    context?: string,
  ): ValidationResult<T> | null {
    if (!condition(data)) {
      return null; // Skip validation
    }

    return safeValidate(schema, data, context);
  }

  // Validation with custom error messages
  validateWithCustomErrors<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    errorMap: Record<string, string>,
    context?: string,
  ): ValidationResult<T> {
    const result = safeValidate(schema, data, context);

    if (!result.success) {
      // Apply custom error messages
      const customErrors = result.errors.map((error) => ({
        ...error,
        message: errorMap[error.field] || error.message,
      }));

      return {
        success: false,
        data: null,
        errors: customErrors,
      };
    }

    return result;
  }
}

// Create and export a singleton instance
export const validationService = new ValidationService();
export default validationService;
