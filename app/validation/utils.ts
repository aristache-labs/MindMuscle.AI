import { z } from 'zod';
import { logger } from '../utils/logger';

// Validation result types
export interface ValidationSuccess<T> {
  success: true;
  data: T;
  errors: null;
}

export interface ValidationError {
  success: false;
  data: null;
  errors: ValidationErrorDetail[];
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

// Safe validation function that returns a result object
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string,
): ValidationResult<T> {
  try {
    const result = schema.safeParse(data);

    if (result.success) {
      return {
        success: true,
        data: result.data,
        errors: null,
      };
    }

    const errors: ValidationErrorDetail[] = result.error.errors.map((error) => ({
      field: error.path.join('.'),
      message: error.message,
      code: error.code,
    }));

    // Log validation errors for debugging
    if (context) {
      logger.warn(`Validation failed for ${context}`, {
        context: { errors, data },
      });
    }

    return {
      success: false,
      data: null,
      errors,
    };
  } catch (error) {
    logger.error('Unexpected error during validation', error as Error, {
      context: { context, data },
    });

    return {
      success: false,
      data: null,
      errors: [
        {
          field: 'unknown',
          message: 'An unexpected validation error occurred',
          code: 'unknown_error',
        },
      ],
    };
  }
}

// Strict validation function that throws on error
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown, context?: string): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = `Validation failed${context ? ` for ${context}` : ''}`;
      const validationErrors = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      logger.error(errorMessage, error, {
        context: { validationErrors, data },
      });

      throw new ValidationException(errorMessage, validationErrors);
    }

    logger.error('Unexpected error during validation', error as Error, {
      context: { context, data },
    });
    throw error;
  }
}

// Custom validation exception class
export class ValidationException extends Error {
  public readonly errors: ValidationErrorDetail[];

  constructor(message: string, errors: ValidationErrorDetail[]) {
    super(message);
    this.name = 'ValidationException';
    this.errors = errors;
  }

  public getErrorsForField(field: string): ValidationErrorDetail[] {
    return this.errors.filter((error) => error.field === field);
  }

  public getFirstError(): ValidationErrorDetail | null {
    return this.errors[0] || null;
  }

  public getErrorMessage(): string {
    const firstError = this.getFirstError();
    return firstError ? firstError.message : this.message;
  }

  public getAllErrorMessages(): string[] {
    return this.errors.map((error) => error.message);
  }
}

// Validation middleware for API endpoints
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>, context?: string) {
  return (data: unknown): T => {
    return validateOrThrow(schema, data, context);
  };
}

// Helper to validate arrays with detailed error reporting
export function validateArray<T>(
  schema: z.ZodSchema<T>,
  data: unknown[],
  context?: string,
): ValidationResult<T[]> {
  if (!Array.isArray(data)) {
    return {
      success: false,
      data: null,
      errors: [
        {
          field: 'root',
          message: 'Expected an array',
          code: 'invalid_type',
        },
      ],
    };
  }

  const results: T[] = [];
  const errors: ValidationErrorDetail[] = [];

  data.forEach((item, index) => {
    const result = safeValidate(schema, item, `${context}[${index}]`);
    if (result.success) {
      results.push(result.data);
    } else {
      errors.push(
        ...result.errors.map((error) => ({
          ...error,
          field: `[${index}].${error.field}`,
        })),
      );
    }
  });

  if (errors.length > 0) {
    return {
      success: false,
      data: null,
      errors,
    };
  }

  return {
    success: true,
    data: results,
    errors: null,
  };
}

// Helper to validate partial objects (for updates) - only works with ZodObject
export function validatePartial<T extends Record<string, any>>(
  schema: z.ZodObject<any>,
  data: unknown,
  context?: string,
): ValidationResult<Partial<T>> {
  const partialSchema = schema.partial();
  return safeValidate(partialSchema, data, context) as ValidationResult<Partial<T>>;
}

// Helper to validate and transform data
export function validateAndTransform<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  data: unknown,
  transformer: (data: TInput) => TOutput,
  context?: string,
): ValidationResult<TOutput> {
  const validationResult = safeValidate(schema, data, context);

  if (!validationResult.success) {
    return validationResult as ValidationError;
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

// Helper to create form validation hooks - only works with ZodObject
export function createFormValidator<T extends Record<string, any>>(schema: z.ZodObject<any>) {
  return {
    validate: (data: unknown) => safeValidate(schema, data),
    validateField: (fieldName: keyof T, value: unknown) => {
      const fieldSchema = schema.shape[fieldName as string];
      if (!fieldSchema) {
        return {
          success: false,
          data: null,
          errors: [
            {
              field: String(fieldName),
              message: 'Unknown field',
              code: 'unknown_field',
            },
          ],
        };
      }
      return safeValidate(fieldSchema, value, String(fieldName));
    },
    validatePartial: (data: unknown) => validatePartial<T>(schema, data),
  };
}

// Helper to format validation errors for UI display
export function formatValidationErrors(errors: ValidationErrorDetail[]): Record<string, string> {
  const formattedErrors: Record<string, string> = {};

  errors.forEach((error) => {
    if (!formattedErrors[error.field]) {
      formattedErrors[error.field] = error.message;
    }
  });

  return formattedErrors;
}

// Helper to check if data matches schema without throwing
export function isValidData<T>(schema: z.ZodSchema<T>, data: unknown): data is T {
  const result = schema.safeParse(data);
  return result.success;
}

// Helper for API response validation
export function validateApiResponse<T>(
  schema: z.ZodSchema<T>,
  response: unknown,
  endpoint?: string,
): T {
  return validateOrThrow(schema, response, `API response${endpoint ? ` from ${endpoint}` : ''}`);
}

// Helper for environment variable validation
export function validateEnvVar<T>(
  schema: z.ZodSchema<T>,
  envVar: string | undefined,
  varName: string,
): T {
  if (envVar === undefined) {
    throw new Error(`Environment variable ${varName} is not defined`);
  }

  return validateOrThrow(schema, envVar, `environment variable ${varName}`);
}

// Helper to create type-safe database query validators
export function createQueryValidator<T extends Record<string, any>>(schema: z.ZodObject<any>) {
  return {
    validateInsert: (data: unknown) => validateOrThrow(schema, data, 'database insert'),
    validateUpdate: (data: unknown) => validatePartial<T>(schema, data, 'database update'),
    validateResult: (data: unknown) => validateOrThrow(schema, data, 'database result'),
    validateResults: (data: unknown[]) => validateArray(schema, data, 'database results'),
  };
}

// Helper to create type-safe database query validators for non-object schemas
export function createSimpleQueryValidator<T>(schema: z.ZodSchema<T>) {
  return {
    validateInsert: (data: unknown) => validateOrThrow(schema, data, 'database insert'),
    validateResult: (data: unknown) => validateOrThrow(schema, data, 'database result'),
    validateResults: (data: unknown[]) => validateArray(schema, data, 'database results'),
  };
}

// Default export to satisfy Expo Router (this file should not be a route)
export default function UtilsRouterPlaceholder() {
  return null;
}
