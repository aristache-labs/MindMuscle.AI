import { z } from 'zod';
import { logger } from '../utils/logger';
import {
  ExerciseConfigurationSchema,
  ExerciseSchema,
  LoginFormSchema,
  MeasurementSchema,
  PausedWorkoutSchema,
  PlanSchema,
  ProgressPhotoSchema,
  RegisterFormSchema,
  UserProfileSchema,
  WorkoutDaySchema,
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
}

// Create and export a singleton instance
export const validationService = new ValidationService();
export default validationService;
