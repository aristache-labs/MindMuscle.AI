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
import { captureValidationError, capturePerformanceError, setContext, setTag } from './sentry';
import { addBreadcrumb, captureMessage } from './sentry/simpleErrorHandler';

class ValidationService {
  constructor() {
    this.initializeSentryContext();
  }

  private initializeSentryContext(): void {
    // Set up Sentry context for validation service
    setContext('validation_service', {
      service: 'ValidationService',
      version: '1.0.0',
      capabilities: [
        'schema_validation',
        'batch_validation',
        'conditional_validation',
        'transformation_validation',
        'ui_validation',
        'api_validation',
        'database_validation',
        'env_validation',
      ],
      monitoring: {
        performance_tracking: true,
        error_categorization: true,
        validation_metrics: true,
        breadcrumb_tracking: true,
      },
    });
    setTag('service.type', 'validation');
    setTag('validation.framework', 'zod');

    addBreadcrumb('ValidationService initialized', 'system', {
      timestamp: new Date().toISOString(),
      capabilities_count: 8,
    });

    captureMessage('ValidationService with Sentry monitoring initialized', 'info', {
      category: 'validation_error',
      capabilities: [
        'schema_validation',
        'batch_validation',
        'conditional_validation',
        'transformation_validation',
        'ui_validation',
        'api_validation',
        'database_validation',
        'env_validation',
      ],
      monitoring_features: [
        'performance_tracking',
        'error_categorization',
        'validation_metrics',
        'breadcrumb_tracking',
      ],
    });
  }

  private trackValidationPerformance<T>(
    operation: string,
    validationFn: () => ValidationResult<T>,
    context?: string,
  ): ValidationResult<T> {
    const startTime = Date.now();
    const operationId = `${operation}_${Date.now()}`;

    this.logValidationStart(operation, context || 'unknown', operationId);

    try {
      const result = validationFn();
      const duration = Date.now() - startTime;

      this.handleValidationResult(result, operation, context || 'unknown', duration, operationId);
      return result;
    } catch (error) {
      this.handleValidationError(
        error,
        operation,
        context || 'unknown',
        Date.now() - startTime,
        operationId,
      );
      throw error;
    }
  }

  private logValidationStart(operation: string, context: string, operationId: string): void {
    addBreadcrumb(`Starting validation: ${operation}`, 'validation', {
      operation,
      context,
      operation_id: operationId,
    });
  }

  private handleValidationResult<T>(
    result: ValidationResult<T>,
    operation: string,
    context: string,
    duration: number,
    operationId: string,
  ): void {
    this.trackPerformanceMetrics(operation, duration, result.success, context, operationId);
    this.logValidationCompletion(operation, context, result, duration, operationId);
    this.handleValidationErrors(result, operation, context, duration, operationId);
    this.trackSuccessMetrics(result, operation);
  }

  private trackPerformanceMetrics(
    operation: string,
    duration: number,
    success: boolean,
    context: string,
    operationId: string,
  ): void {
    if (duration > 100) {
      capturePerformanceError(
        `Slow validation operation: ${operation}`,
        'validation_duration',
        duration,
      );
      captureMessage(`Slow validation detected: ${operation} took ${duration}ms`, 'warning', {
        category: 'performance_error',
        operation,
        context,
        success,
        operation_id: operationId,
        duration,
      });
    }
  }

  private logValidationCompletion<T>(
    operation: string,
    context: string,
    result: ValidationResult<T>,
    duration: number,
    operationId: string,
  ): void {
    addBreadcrumb(`Validation completed: ${operation}`, 'validation', {
      operation,
      context,
      success: result.success,
      duration,
      error_count: result.errors?.length || 0,
      operation_id: operationId,
    });
  }

  private handleValidationErrors<T>(
    result: ValidationResult<T>,
    operation: string,
    context: string,
    duration: number,
    operationId: string,
  ): void {
    if (!result.success && result.errors) {
      captureValidationError(
        new Error(`Validation failed for ${operation}`),
        'validation_service',
        {
          operation,
          context,
          error_count: result.errors.length,
          errors: result.errors.map((e) => ({ field: e.field, message: e.message })),
          duration,
          operation_id: operationId,
        },
      );

      captureMessage(`Validation failed: ${operation}`, 'warning', {
        category: 'validation_error',
        operation,
        context,
        error_count: result.errors.length,
        duration,
      });
    }
  }

  private trackSuccessMetrics<T>(result: ValidationResult<T>, operation: string): void {
    if (result.success) {
      setTag('validation.last_success', operation);
    }
  }

  private handleValidationError(
    error: unknown,
    operation: string,
    context: string,
    duration: number,
    operationId: string,
  ): void {
    addBreadcrumb(`Validation error: ${operation}`, 'error', {
      operation,
      context,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      operation_id: operationId,
    });

    captureValidationError(
      error instanceof Error ? error : new Error('Unknown validation error'),
      'validation_service_critical',
      {
        operation,
        context,
        duration,
        operation_id: operationId,
      },
    );
  }

  private async trackAsyncValidationPerformance<T>(
    operation: string,
    validationFn: () => Promise<ValidationResult<T>>,
    context?: string,
  ): Promise<ValidationResult<T>> {
    const startTime = Date.now();
    const operationId = `async_${operation}_${Date.now()}`;

    addBreadcrumb(`Starting async validation: ${operation}`, 'validation', {
      operation,
      context: context || 'unknown',
      type: 'async',
      operation_id: operationId,
    });

    try {
      const result = await validationFn();
      const duration = Date.now() - startTime;

      // Track async validation performance
      if (duration > 200) {
        // Log slow async validations (>200ms)
        capturePerformanceError(
          `Slow async validation operation: ${operation}`,
          'async_validation_duration',
          duration,
        );

        // Add additional context via message
        captureMessage(
          `Slow async validation detected: ${operation} took ${duration}ms`,
          'warning',
          {
            category: 'performance_error',
            operation,
            context: context || 'unknown',
            success: result.success,
            operation_id: operationId,
            duration,
          },
        );
      }

      addBreadcrumb(`Async validation completed: ${operation}`, 'validation', {
        operation,
        context: context || 'unknown',
        success: result.success,
        duration,
        error_count: result.errors?.length || 0,
        type: 'async',
        operation_id: operationId,
      });

      if (!result.success && result.errors) {
        captureValidationError(
          new Error(`Async validation failed for ${operation}`),
          'async_validation_service',
          {
            operation,
            context: context || 'unknown',
            error_count: result.errors.length,
            errors: result.errors.map((e) => ({ field: e.field, message: e.message })),
            duration,
            operation_id: operationId,
          },
        );
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      captureValidationError(
        error instanceof Error ? error : new Error('Unknown async validation error'),
        'async_validation_service_critical',
        {
          operation,
          context: context || 'unknown',
          duration,
          operation_id: operationId,
        },
      );

      throw error;
    }
  }

  // Exercise validation methods
  validateExercise(data: unknown): ValidationResult<z.infer<typeof ExerciseSchema>> {
    return this.trackValidationPerformance(
      'validateExercise',
      () => safeValidate(ExerciseSchema, data, 'exercise'),
      'exercise',
    );
  }

  validateGeneralExercise(data: unknown): ValidationResult<z.infer<typeof GeneralExerciseSchema>> {
    return this.trackValidationPerformance(
      'validateGeneralExercise',
      () => safeValidate(GeneralExerciseSchema, data, 'general exercise'),
      'exercise',
    );
  }

  validateExerciseConfiguration(
    data: unknown,
  ): ValidationResult<z.infer<typeof ExerciseConfigurationSchema>> {
    return this.trackValidationPerformance(
      'validateExerciseConfiguration',
      () => safeValidate(ExerciseConfigurationSchema, data, 'exercise configuration'),
      'exercise',
    );
  }

  validateExerciseConfigurations(
    data: unknown[],
  ): ValidationResult<z.infer<typeof ExerciseConfigurationSchema>[]> {
    return this.trackValidationPerformance(
      'validateExerciseConfigurations',
      () => validateArray(ExerciseConfigurationSchema, data, 'exercise configurations'),
      'exercise_array',
    );
  }

  // Workout validation methods
  validateWorkoutDay(data: unknown): ValidationResult<z.infer<typeof WorkoutDaySchema>> {
    return this.trackValidationPerformance(
      'validateWorkoutDay',
      () => safeValidate(WorkoutDaySchema, data, 'workout day'),
      'workout',
    );
  }

  validatePlan(data: unknown): ValidationResult<z.infer<typeof PlanSchema>> {
    return this.trackValidationPerformance(
      'validatePlan',
      () => safeValidate(PlanSchema, data, 'workout plan'),
      'workout',
    );
  }

  validatePausedWorkout(data: unknown): ValidationResult<z.infer<typeof PausedWorkoutSchema>> {
    return this.trackValidationPerformance(
      'validatePausedWorkout',
      () => safeValidate(PausedWorkoutSchema, data, 'paused workout'),
      'workout',
    );
  }

  // User validation methods
  validateUserProfile(data: unknown): ValidationResult<z.infer<typeof UserProfileSchema>> {
    return this.trackValidationPerformance(
      'validateUserProfile',
      () => safeValidate(UserProfileSchema, data, 'user profile'),
      'user',
    );
  }

  validateLoginForm(data: unknown): ValidationResult<z.infer<typeof LoginFormSchema>> {
    return this.trackValidationPerformance(
      'validateLoginForm',
      () => safeValidate(LoginFormSchema, data, 'login form'),
      'auth',
    );
  }

  validateRegisterForm(data: unknown): ValidationResult<z.infer<typeof RegisterFormSchema>> {
    return this.trackValidationPerformance(
      'validateRegisterForm',
      () => safeValidate(RegisterFormSchema, data, 'register form'),
      'auth',
    );
  }

  // Measurement validation methods
  validateMeasurement(data: unknown): ValidationResult<z.infer<typeof MeasurementSchema>> {
    return this.trackValidationPerformance(
      'validateMeasurement',
      () => safeValidate(MeasurementSchema, data, 'measurement'),
      'measurement',
    );
  }

  validateProgressPhoto(data: unknown): ValidationResult<z.infer<typeof ProgressPhotoSchema>> {
    return this.trackValidationPerformance(
      'validateProgressPhoto',
      () => safeValidate(ProgressPhotoSchema, data, 'progress photo'),
      'measurement',
    );
  }

  // Workout data service validation methods
  async validateWorkoutHistoryRecord(data: unknown): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateWorkoutHistoryRecord',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(schemas.WorkoutHistoryRecordSchema, data, 'workout history record');
      },
      'workout_data',
    );
  }

  async validateExerciseRecord(data: unknown): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateExerciseRecord',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(schemas.ExerciseRecordSchema, data, 'exercise record');
      },
      'workout_data',
    );
  }

  async validateCompleteWorkoutOptions(data: unknown): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateCompleteWorkoutOptions',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(schemas.CompleteWorkoutOptionsSchema, data, 'complete workout options');
      },
      'workout_data',
    );
  }

  async validateSavedExerciseStructure(data: unknown): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateSavedExerciseStructure',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(schemas.SavedExerciseStructureSchema, data, 'saved exercise structure');
      },
      'workout_data',
    );
  }

  async validateExerciseRecords(data: unknown[]): Promise<ValidationResult<unknown[]>> {
    return this.trackAsyncValidationPerformance(
      'validateExerciseRecords',
      async () => {
        const schemas = await import('../validation/schemas');
        return validateArray(schemas.ExerciseRecordSchema, data, 'exercise records');
      },
      'workout_data',
    );
  }

  // Achievement validation methods
  validateAchievement(data: unknown): ValidationResult<z.infer<typeof AchievementSchema>> {
    return this.trackValidationPerformance(
      'validateAchievement',
      () => safeValidate(AchievementSchema, data, 'achievement'),
      'achievement',
    );
  }

  validateUserAchievement(data: unknown): ValidationResult<z.infer<typeof UserAchievementSchema>> {
    return this.trackValidationPerformance(
      'validateUserAchievement',
      () => safeValidate(UserAchievementSchema, data, 'user achievement'),
      'achievement',
    );
  }

  validateUpdateAchievementProgress(
    data: unknown,
  ): ValidationResult<z.infer<typeof UpdateAchievementProgressSchema>> {
    return this.trackValidationPerformance(
      'validateUpdateAchievementProgress',
      () => safeValidate(UpdateAchievementProgressSchema, data, 'achievement progress update'),
      'achievement',
    );
  }

  // Progress photo validation methods
  validateProgressPhotoUpload(
    data: unknown,
  ): ValidationResult<z.infer<typeof ProgressPhotoUploadSchema>> {
    return this.trackValidationPerformance(
      'validateProgressPhotoUpload',
      () => safeValidate(ProgressPhotoUploadSchema, data, 'progress photo upload'),
      'progress_photo',
    );
  }

  validateProgressPhotoRecord(
    data: unknown,
  ): ValidationResult<z.infer<typeof ProgressPhotoRecordSchema>> {
    return this.trackValidationPerformance(
      'validateProgressPhotoRecord',
      () => safeValidate(ProgressPhotoRecordSchema, data, 'progress photo record'),
      'progress_photo',
    );
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

  // Workout data service validation methods
  async validateFetchWorkoutData(data: unknown): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateFetchWorkoutData',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(schemas.FetchWorkoutDataSchema, data, 'fetch workout data');
      },
      'workout_data',
    );
  }

  async validateFetchLastExerciseRecords(data: unknown): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateFetchLastExerciseRecords',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(
          schemas.FetchLastExerciseRecordsSchema,
          data,
          'fetch last exercise records',
        );
      },
      'workout_data',
    );
  }

  async validateCheckWorkoutCompletion(data: unknown): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateCheckWorkoutCompletion',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(schemas.CheckWorkoutCompletionSchema, data, 'check workout completion');
      },
      'workout_data',
    );
  }

  async validateGetLastCompletedWorkoutStructure(
    data: unknown,
  ): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateGetLastCompletedWorkoutStructure',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(
          schemas.GetLastCompletedWorkoutStructureSchema,
          data,
          'get last completed workout structure',
        );
      },
      'workout_data',
    );
  }

  async validateCheckWorkoutCompletionForCycleWeek(
    data: unknown,
  ): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateCheckWorkoutCompletionForCycleWeek',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(
          schemas.CheckWorkoutCompletionForCycleWeekSchema,
          data,
          'check workout completion for cycle week',
        );
      },
      'workout_data',
    );
  }

  async validateGetMostRecentCustomizedWorkoutStructure(
    data: unknown,
  ): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateGetMostRecentCustomizedWorkoutStructure',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(
          schemas.GetMostRecentCustomizedWorkoutStructureSchema,
          data,
          'get most recent customized workout structure',
        );
      },
      'workout_data',
    );
  }

  // Add exercise form validation
  async validateAddExerciseForm(data: unknown): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateAddExerciseForm',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(schemas.AddExerciseFormSchema, data, 'add exercise form');
      },
      'form_data',
    );
  }

  // AI Coaching validation methods
  validateCoachingRequest(data: unknown): ValidationResult<{
    prompt: string;
    context: {
      fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
      goals: string[];
      preferences: string[];
      recentWorkouts: string[];
      userProfile: {
        age: number;
        gender: string;
        weight: number;
        height: number;
        medicalConditions?: string[];
      };
    };
    type: 'workout' | 'nutrition' | 'mindset';
  }> {
    const CoachingRequestSchema = z.object({
      prompt: z.string().min(1, 'Prompt is required').max(1000, 'Prompt too long'),
      context: z.object({
        fitnessLevel: z.enum(['beginner', 'intermediate', 'advanced']),
        goals: z.array(z.string()).min(1, 'At least one goal is required'),
        preferences: z.array(z.string()),
        recentWorkouts: z.array(z.string()),
        userProfile: z.object({
          age: z.number().min(13, 'Age must be at least 13').max(120, 'Age must be realistic'),
          gender: z.string().min(1, 'Gender is required'),
          weight: z
            .number()
            .min(20, 'Weight must be realistic')
            .max(500, 'Weight must be realistic'),
          height: z
            .number()
            .min(50, 'Height must be realistic')
            .max(300, 'Height must be realistic'),
          medicalConditions: z.array(z.string()).optional(),
        }),
      }),
      type: z.enum(['workout', 'nutrition', 'mindset']),
    });

    return safeValidate(CoachingRequestSchema, data, 'coaching request');
  }

  validateCoachingFeedback(data: unknown): ValidationResult<{
    sessionId: string;
    feedback: string;
    rating: number;
  }> {
    const CoachingFeedbackSchema = z.object({
      sessionId: z.string().min(1, 'Session ID is required'),
      feedback: z.string().min(1, 'Feedback is required').max(500, 'Feedback too long'),
      rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
    });

    return safeValidate(CoachingFeedbackSchema, data, 'coaching feedback');
  }

  // Notification validation methods
  validateNotificationPayload(data: unknown): ValidationResult<{
    userId: string;
    type: 'workout_reminder' | 'achievement_unlocked' | 'progress_update' | 'coaching_insight';
    title: string;
    message: string;
    data?: Record<string, string | number | boolean>;
    priority: 'low' | 'normal' | 'high';
    scheduledFor?: Date;
  }> {
    const NotificationPayloadSchema = z.object({
      userId: z.string().min(1, 'User ID is required'),
      type: z.enum([
        'workout_reminder',
        'achievement_unlocked',
        'progress_update',
        'coaching_insight',
      ]),
      title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
      message: z.string().min(1, 'Message is required').max(500, 'Message too long'),
      data: z.record(z.any()).optional(),
      priority: z.enum(['low', 'normal', 'high']),
      scheduledFor: z.date().optional(),
    });

    return safeValidate(NotificationPayloadSchema, data, 'notification payload');
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
    const startTime = Date.now();
    const operationId = `api_validation_${Date.now()}`;

    addBreadcrumb('Starting API response validation', 'validation', {
      endpoint: endpoint || 'unknown',
      operation_id: operationId,
    });

    try {
      const result = schema.parse(response);
      const duration = Date.now() - startTime;

      addBreadcrumb('API response validation successful', 'validation', {
        endpoint: endpoint || 'unknown',
        duration,
        operation_id: operationId,
      });

      if (duration > 50) {
        capturePerformanceError(
          `Slow API response validation: ${endpoint || 'unknown endpoint'}`,
          'api_validation_duration',
          duration,
        );
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof z.ZodError) {
        const errorMessage = `API response validation failed${endpoint ? ` for ${endpoint}` : ''}`;

        captureValidationError(new Error(errorMessage), 'api_response_validation', {
          endpoint: endpoint || 'unknown',
          error_count: error.errors.length,
          errors: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
          duration,
          operation_id: operationId,
        });

        captureMessage(`API validation failed: ${endpoint || 'unknown endpoint'}`, 'error', {
          category: 'validation_error',
          endpoint: endpoint || 'unknown',
          error_count: error.errors.length,
          duration,
        });

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

      captureValidationError(
        error instanceof Error ? error : new Error('Unknown API validation error'),
        'api_validation_critical',
        {
          endpoint: endpoint || 'unknown',
          duration,
          operation_id: operationId,
        },
      );

      throw error;
    }
  }

  // Validation for database operations
  validateForDatabase<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    operation: 'insert' | 'update' | 'select',
  ): T {
    const startTime = Date.now();
    const operationId = `db_validation_${operation}_${Date.now()}`;

    addBreadcrumb(`Starting database validation: ${operation}`, 'validation', {
      operation,
      operation_id: operationId,
    });

    try {
      const result = schema.parse(data);
      const duration = Date.now() - startTime;

      addBreadcrumb(`Database validation successful: ${operation}`, 'validation', {
        operation,
        duration,
        operation_id: operationId,
      });

      if (duration > 75) {
        capturePerformanceError(
          `Slow database validation: ${operation}`,
          'db_validation_duration',
          duration,
        );
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof z.ZodError) {
        const errorMessage = `Database ${operation} validation failed`;

        captureValidationError(new Error(errorMessage), 'database_validation', {
          operation,
          error_count: error.errors.length,
          errors: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
          duration,
          operation_id: operationId,
        });

        captureMessage(`Database validation failed: ${operation}`, 'error', {
          category: 'validation_error',
          operation,
          error_count: error.errors.length,
          duration,
        });

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

      captureValidationError(
        error instanceof Error ? error : new Error('Unknown database validation error'),
        'database_validation_critical',
        {
          operation,
          duration,
          operation_id: operationId,
        },
      );

      throw error;
    }
  }

  // Environment variable validation
  validateEnvVar<T>(schema: z.ZodSchema<T>, envVar: string | undefined, varName: string): T {
    const operationId = `env_validation_${varName}_${Date.now()}`;

    addBreadcrumb(`Validating environment variable: ${varName}`, 'validation', {
      var_name: varName,
      has_value: envVar !== undefined,
      operation_id: operationId,
    });

    if (envVar === undefined) {
      const error = new Error(`Environment variable ${varName} is not defined`);

      captureValidationError(error, 'env_validation_missing', {
        var_name: varName,
        operation_id: operationId,
      });

      captureMessage(`Missing environment variable: ${varName}`, 'error', {
        category: 'validation_error',
        var_name: varName,
      });

      throw error;
    }

    try {
      const result = schema.parse(envVar);

      addBreadcrumb(`Environment variable validation successful: ${varName}`, 'validation', {
        var_name: varName,
        operation_id: operationId,
      });

      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = `Environment variable ${varName} validation failed`;

        captureValidationError(new Error(errorMessage), 'env_validation_schema', {
          var_name: varName,
          error_count: error.errors.length,
          errors: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
          operation_id: operationId,
        });

        captureMessage(`Environment variable validation failed: ${varName}`, 'error', {
          category: 'validation_error',
          var_name: varName,
          error_count: error.errors.length,
        });

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

      captureValidationError(
        error instanceof Error ? error : new Error('Unknown environment validation error'),
        'env_validation_critical',
        {
          var_name: varName,
          operation_id: operationId,
        },
      );

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

  // Storage and Context validation methods
  async validateProfileContext(data: unknown): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateProfileContext',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(schemas.ProfileContextSchema, data, 'profile context');
      },
      'storage_context',
    );
  }

  async validateUserStats(data: unknown): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateUserStats',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(schemas.UserStatsSchema, data, 'user stats');
      },
      'storage_context',
    );
  }

  async validateAuthState(data: unknown): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateAuthState',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(schemas.AuthStateSchema, data, 'auth state');
      },
      'storage_context',
    );
  }

  async validatePausedWorkoutData(data: unknown): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validatePausedWorkoutData',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(schemas.PausedWorkoutDataSchema, data, 'paused workout data');
      },
      'storage_context',
    );
  }

  async validateSavedPlan(data: unknown): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateSavedPlan',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(schemas.SavedPlanSchema, data, 'saved plan');
      },
      'storage_context',
    );
  }

  async validateCacheEntry(data: unknown): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateCacheEntry',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(schemas.CacheEntrySchema, data, 'cache entry');
      },
      'storage_context',
    );
  }

  async validatePersistedClient(data: unknown): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validatePersistedClient',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(schemas.PersistedClientSchema, data, 'persisted client');
      },
      'storage_context',
    );
  }

  async validateCoachingHistory(data: unknown): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateCoachingHistory',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(schemas.CoachingHistorySchema, data, 'coaching history');
      },
      'storage_context',
    );
  }

  async validateWorkoutDaysData(data: unknown): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateWorkoutDaysData',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(schemas.WorkoutDaysDataSchema, data, 'workout days data');
      },
      'storage_context',
    );
  }

  async validateCoachingUserProfile(data: unknown): Promise<ValidationResult<unknown>> {
    return this.trackAsyncValidationPerformance(
      'validateCoachingUserProfile',
      async () => {
        const schemas = await import('../validation/schemas');
        return safeValidate(schemas.CoachingUserProfileSchema, data, 'coaching user profile');
      },
      'storage_context',
    );
  }

  // Helper method for safe JSON parsing with validation
  safeParseJson<T>(
    jsonString: string | null,
    schema: z.ZodSchema<T>,
    context?: string,
    fallback?: T,
  ): T | null {
    if (!jsonString) {
      return fallback || null;
    }

    try {
      const parsed = JSON.parse(jsonString);
      const validationResult = safeValidate(schema, parsed, context);

      if (validationResult.success) {
        return validationResult.data;
      } else {
        logger.warn(`JSON validation failed for ${context || 'unknown context'}`, {
          context: { jsonString, errors: validationResult.errors },
        });
        return fallback || null;
      }
    } catch (error) {
      logger.error(`JSON parsing failed for ${context || 'unknown context'}`, error as Error, {
        context: { jsonString },
      });
      return fallback || null;
    }
  }
}

// Create and export a singleton instance
export const validationService = new ValidationService();
export default validationService;
