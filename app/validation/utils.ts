import { z } from 'zod';
import { logger } from '../utils/logger';
import * as Sentry from '@sentry/react-native';
import { SentryDataCollection, SentryLogger } from '../services/sentry';

// Sentry context initialization
const initializeSentryContext = () => {
  try {
    SentryDataCollection.setContext('validation_utils', {
      module: 'validation_utils',
      version: '1.0.0',
      initialized_at: new Date().toISOString(),
      features: [
        'safe_validation',
        'strict_validation',
        'array_validation',
        'partial_validation',
        'form_validation',
        'api_response_validation',
        'environment_validation',
        'query_validation',
        'performance_monitoring',
        'error_tracking',
      ],
    });

    SentryDataCollection.addBreadcrumb({
      message: 'Validation utils module initialized',
      category: 'validation_utils.initialization',
      level: 'info',
      data: {
        timestamp: new Date().toISOString(),
        module: 'validation_utils',
        version: '1.0.0',
      },
    });

    SentryLogger.info('Validation utils module initialized successfully', {
      module: 'validation_utils',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    SentryDataCollection.captureException(error as Error, {
      operation: 'validation_utils_initialization_failed',
      module: 'validation_utils',
    });

    logger.error('Failed to initialize validation utils Sentry context', error as Error);
  }
};

// Performance tracking utilities
interface ValidationMetrics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  averageValidationTime: number;
  slowValidations: number;
  validationsByType: Record<string, number>;
  errorsByType: Record<string, number>;
}

let validationMetrics: ValidationMetrics = {
  totalValidations: 0,
  successfulValidations: 0,
  failedValidations: 0,
  averageValidationTime: 0,
  slowValidations: 0,
  validationsByType: {},
  errorsByType: {},
};

const updateValidationMetrics = (
  validationType: string,
  success: boolean,
  duration: number,
  errorType?: string,
) => {
  try {
    validationMetrics.totalValidations++;
    validationMetrics.validationsByType[validationType] =
      (validationMetrics.validationsByType[validationType] || 0) + 1;

    if (success) {
      validationMetrics.successfulValidations++;
    } else {
      validationMetrics.failedValidations++;
      if (errorType) {
        validationMetrics.errorsByType[errorType] =
          (validationMetrics.errorsByType[errorType] || 0) + 1;
      }
    }

    // Update average validation time
    const totalTime =
      validationMetrics.averageValidationTime * (validationMetrics.totalValidations - 1) + duration;
    validationMetrics.averageValidationTime = totalTime / validationMetrics.totalValidations;

    // Track slow validations (>50ms)
    if (duration > 50) {
      validationMetrics.slowValidations++;
    }

    // Update Sentry context with current metrics
    SentryDataCollection.setContext('validation_utils_metrics', {
      ...validationMetrics,
      last_updated: new Date().toISOString(),
    });

    // Log performance warnings for slow validations
    if (duration > 100) {
      SentryLogger.warn(`Slow validation detected: ${validationType}`, {
        validation_type: validationType,
        duration,
        threshold: 100,
        success,
      });
    }
  } catch (error) {
    SentryDataCollection.captureException(error as Error, {
      operation: 'validation_metrics_update_failed',
      validation_type: validationType,
      duration,
      success,
    });
  }
};

const addBreadcrumb = Sentry.addBreadcrumb;

// Initialize Sentry context
initializeSentryContext();

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
  const startTime = Date.now();
  const operation = `safe_validate_${context || 'unknown'}`;

  addBreadcrumb({
    message: `Starting safe validation: ${context || 'unknown'}`,
    category: 'validation_utils.safe_validate',
    level: 'debug',
    data: {
      context,
      has_data: !!data,
      data_type: typeof data,
      operation,
    },
  });

  try {
    const result = schema.safeParse(data);
    const duration = Date.now() - startTime;

    if (result.success) {
      updateValidationMetrics('safe_validate', true, duration);

      addBreadcrumb({
        message: `Safe validation successful: ${context || 'unknown'}`,
        category: 'validation_utils.safe_validate_success',
        level: 'debug',
        data: {
          context,
          duration,
          operation,
        },
      });

      SentryDataCollection.setContext('last_successful_validation', {
        type: 'safe_validate',
        context,
        duration,
        timestamp: new Date().toISOString(),
      });

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

    updateValidationMetrics('safe_validate', false, duration, 'validation_failed');

    SentryDataCollection.captureException(
      new Error(`Safe validation failed for ${context || 'unknown'}`),
      {
        operation: 'safe_validation_failed',
        context,
        validation_errors: errors,
        duration,
        error_count: errors.length,
      },
    );

    addBreadcrumb({
      message: `Safe validation failed: ${context || 'unknown'}`,
      category: 'validation_utils.safe_validate_error',
      level: 'warning',
      data: {
        context,
        duration,
        error_count: errors.length,
        errors: errors.slice(0, 3), // Limit for brevity
        operation,
      },
    });

    // Log validation errors for debugging
    if (context) {
      logger.warn(`Validation failed for ${context}`, {
        context: { errors, data, duration },
      });

      SentryLogger.warn(`Safe validation failed for ${context}`, {
        context,
        validation_errors: errors,
        duration,
        error_count: errors.length,
      });
    }

    return {
      success: false,
      data: null,
      errors,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    updateValidationMetrics('safe_validate', false, duration, 'exception');

    SentryDataCollection.captureException(error as Error, {
      operation: 'safe_validation_exception',
      context,
      duration,
    });

    SentryLogger.error(`Unexpected error during safe validation for ${context || 'unknown'}`, {
      error: error as Error,
      context,
      duration,
    });

    logger.error('Unexpected error during validation', error as Error, {
      context: { context, data, duration },
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
  const startTime = Date.now();
  const operation = `validate_or_throw_${context || 'unknown'}`;

  addBreadcrumb({
    message: `Starting strict validation: ${context || 'unknown'}`,
    category: 'validation_utils.validate_or_throw',
    level: 'debug',
    data: {
      context,
      has_data: !!data,
      data_type: typeof data,
      operation,
    },
  });

  try {
    const result = schema.parse(data);
    const duration = Date.now() - startTime;

    updateValidationMetrics('validate_or_throw', true, duration);

    addBreadcrumb({
      message: `Strict validation successful: ${context || 'unknown'}`,
      category: 'validation_utils.validate_or_throw_success',
      level: 'debug',
      data: {
        context,
        duration,
        operation,
      },
    });

    SentryDataCollection.setContext('last_successful_validation', {
      type: 'validate_or_throw',
      context,
      duration,
      timestamp: new Date().toISOString(),
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof z.ZodError) {
      const errorMessage = `Validation failed${context ? ` for ${context}` : ''}`;
      const validationErrors = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      updateValidationMetrics('validate_or_throw', false, duration, 'zod_error');

      SentryDataCollection.captureException(error, {
        operation: 'strict_validation_failed',
        context,
        validation_errors: validationErrors,
        duration,
        error_count: validationErrors.length,
      });

      addBreadcrumb({
        message: `Strict validation failed: ${context || 'unknown'}`,
        category: 'validation_utils.validate_or_throw_error',
        level: 'error',
        data: {
          context,
          duration,
          error_count: validationErrors.length,
          errors: validationErrors.slice(0, 3),
          operation,
        },
      });

      logger.error(errorMessage, error, {
        context: { validationErrors, data, duration },
      });

      SentryLogger.error(errorMessage, {
        error,
        context,
        validation_errors: validationErrors,
        duration,
      });

      throw new ValidationException(errorMessage, validationErrors);
    }

    updateValidationMetrics('validate_or_throw', false, duration, 'unexpected_error');

    SentryDataCollection.captureException(error as Error, {
      operation: 'strict_validation_exception',
      context,
      duration,
    });

    SentryLogger.error(`Unexpected error during strict validation for ${context || 'unknown'}`, {
      error: error as Error,
      context,
      duration,
    });

    logger.error('Unexpected error during validation', error as Error, {
      context: { context, data, duration },
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

    // Add Sentry context for this exception
    SentryDataCollection.setContext('validation_exception', {
      message,
      error_count: errors.length,
      first_error: errors[0],
      timestamp: new Date().toISOString(),
    });
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
  const operation = `middleware_${context || 'unknown'}`;

  addBreadcrumb({
    message: `Creating validation middleware: ${context || 'unknown'}`,
    category: 'validation_utils.create_middleware',
    level: 'info',
    data: {
      context,
      operation,
      timestamp: new Date().toISOString(),
    },
  });

  SentryLogger.info(`Validation middleware created: ${context || 'unknown'}`, {
    context,
    operation,
    timestamp: new Date().toISOString(),
  });

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
  const startTime = Date.now();
  const operation = `validate_array_${context || 'unknown'}`;

  addBreadcrumb({
    message: `Starting array validation: ${context || 'unknown'}`,
    category: 'validation_utils.validate_array',
    level: 'debug',
    data: {
      context,
      array_length: Array.isArray(data) ? data.length : 0,
      is_array: Array.isArray(data),
      operation,
    },
  });

  if (!Array.isArray(data)) {
    const duration = Date.now() - startTime;
    updateValidationMetrics('validate_array', false, duration, 'not_array');

    SentryDataCollection.captureException(
      new Error(`Array validation failed: expected array for ${context || 'unknown'}`),
      {
        operation: 'array_validation_type_error',
        context,
        data_type: typeof data,
        duration,
      },
    );

    addBreadcrumb({
      message: `Array validation failed: not an array - ${context || 'unknown'}`,
      category: 'validation_utils.validate_array_error',
      level: 'warning',
      data: {
        context,
        data_type: typeof data,
        duration,
        operation,
      },
    });

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

  const duration = Date.now() - startTime;

  if (errors.length > 0) {
    updateValidationMetrics('validate_array', false, duration, 'validation_errors');

    SentryDataCollection.captureException(
      new Error(`Array validation failed for ${context || 'unknown'}`),
      {
        operation: 'array_validation_failed',
        context,
        array_length: data.length,
        successful_items: results.length,
        failed_items: errors.length,
        duration,
      },
    );

    addBreadcrumb({
      message: `Array validation failed: ${context || 'unknown'}`,
      category: 'validation_utils.validate_array_error',
      level: 'warning',
      data: {
        context,
        array_length: data.length,
        successful_items: results.length,
        failed_items: errors.length,
        duration,
        operation,
      },
    });

    SentryLogger.warn(`Array validation failed for ${context || 'unknown'}`, {
      context,
      array_length: data.length,
      successful_items: results.length,
      failed_items: errors.length,
      duration,
    });

    return {
      success: false,
      data: null,
      errors,
    };
  }

  updateValidationMetrics('validate_array', true, duration);

  addBreadcrumb({
    message: `Array validation successful: ${context || 'unknown'}`,
    category: 'validation_utils.validate_array_success',
    level: 'debug',
    data: {
      context,
      array_length: data.length,
      duration,
      operation,
    },
  });

  SentryDataCollection.setContext('last_successful_validation', {
    type: 'validate_array',
    context,
    array_length: data.length,
    duration,
    timestamp: new Date().toISOString(),
  });

  return {
    success: true,
    data: results,
    errors: null,
  };
}

// Helper to validate partial objects (for updates) - only works with ZodObject
export function validatePartial<T extends Record<string, unknown>>(
  schema: z.ZodObject<z.ZodRawShape>,
  data: unknown,
  context?: string,
): ValidationResult<Partial<T>> {
  const startTime = Date.now();
  const operation = `validate_partial_${context || 'unknown'}`;

  addBreadcrumb({
    message: `Starting partial validation: ${context || 'unknown'}`,
    category: 'validation_utils.validate_partial',
    level: 'debug',
    data: {
      context,
      has_data: !!data,
      data_type: typeof data,
      operation,
    },
  });

  try {
    const partialSchema = schema.partial();
    const result = safeValidate(partialSchema, data, context) as ValidationResult<Partial<T>>;
    const duration = Date.now() - startTime;

    updateValidationMetrics(
      'validate_partial',
      result.success,
      duration,
      result.success ? undefined : 'partial_validation_failed',
    );

    if (result.success) {
      addBreadcrumb({
        message: `Partial validation successful: ${context || 'unknown'}`,
        category: 'validation_utils.validate_partial_success',
        level: 'debug',
        data: {
          context,
          duration,
          operation,
        },
      });

      SentryDataCollection.setContext('last_successful_validation', {
        type: 'validate_partial',
        context,
        duration,
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    updateValidationMetrics('validate_partial', false, duration, 'exception');

    SentryDataCollection.captureException(error as Error, {
      operation: 'partial_validation_exception',
      context,
      duration,
    });

    SentryLogger.error(`Unexpected error during partial validation for ${context || 'unknown'}`, {
      error: error as Error,
      context,
      duration,
    });

    return {
      success: false,
      data: null,
      errors: [
        {
          field: 'unknown',
          message: 'An unexpected partial validation error occurred',
          code: 'unknown_error',
        },
      ],
    };
  }
}

// Helper to validate and transform data
export function validateAndTransform<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  data: unknown,
  transformer: (data: TInput) => TOutput,
  context?: string,
): ValidationResult<TOutput> {
  const startTime = Date.now();
  const operation = `validate_and_transform_${context || 'unknown'}`;

  addBreadcrumb({
    message: `Starting validate and transform: ${context || 'unknown'}`,
    category: 'validation_utils.validate_and_transform',
    level: 'debug',
    data: {
      context,
      has_data: !!data,
      data_type: typeof data,
      operation,
    },
  });

  const validationResult = safeValidate(schema, data, context);

  if (!validationResult.success) {
    const duration = Date.now() - startTime;
    updateValidationMetrics('validate_and_transform', false, duration, 'validation_failed');

    addBreadcrumb({
      message: `Validate and transform failed at validation: ${context || 'unknown'}`,
      category: 'validation_utils.validate_and_transform_error',
      level: 'warning',
      data: {
        context,
        duration,
        stage: 'validation',
        operation,
      },
    });

    return validationResult as ValidationError;
  }

  try {
    const transformedData = transformer(validationResult.data);
    const duration = Date.now() - startTime;

    updateValidationMetrics('validate_and_transform', true, duration);

    addBreadcrumb({
      message: `Validate and transform successful: ${context || 'unknown'}`,
      category: 'validation_utils.validate_and_transform_success',
      level: 'debug',
      data: {
        context,
        duration,
        operation,
      },
    });

    SentryDataCollection.setContext('last_successful_validation', {
      type: 'validate_and_transform',
      context,
      duration,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      data: transformedData,
      errors: null,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    updateValidationMetrics('validate_and_transform', false, duration, 'transformation_error');

    SentryDataCollection.captureException(error as Error, {
      operation: 'transformation_error',
      context,
      duration,
      stage: 'transformation',
    });

    addBreadcrumb({
      message: `Validate and transform failed at transformation: ${context || 'unknown'}`,
      category: 'validation_utils.validate_and_transform_error',
      level: 'error',
      data: {
        context,
        duration,
        stage: 'transformation',
        operation,
      },
    });

    SentryLogger.error(`Error during data transformation for ${context || 'unknown'}`, {
      error: error as Error,
      context,
      duration,
    });

    logger.error('Error during data transformation', error as Error, {
      context: { context, data, duration },
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
export function createFormValidator<T extends Record<string, unknown>>(
  schema: z.ZodObject<z.ZodRawShape>,
) {
  const formId = `form_${Date.now()}`;

  addBreadcrumb({
    message: 'Creating form validator',
    category: 'validation_utils.create_form_validator',
    level: 'info',
    data: {
      form_id: formId,
      timestamp: new Date().toISOString(),
    },
  });

  SentryLogger.info('Form validator created', {
    form_id: formId,
    timestamp: new Date().toISOString(),
  });

  return {
    validate: (data: unknown) => {
      addBreadcrumb({
        message: 'Form validation requested',
        category: 'validation_utils.form_validate',
        level: 'debug',
        data: { form_id: formId },
      });
      return safeValidate(schema, data);
    },
    validateField: (fieldName: keyof T, value: unknown) => {
      addBreadcrumb({
        message: `Form field validation requested: ${String(fieldName)}`,
        category: 'validation_utils.form_validate_field',
        level: 'debug',
        data: {
          form_id: formId,
          field_name: String(fieldName),
          has_value: value !== undefined && value !== null,
        },
      });

      const fieldSchema = schema.shape[fieldName as string];
      if (!fieldSchema) {
        SentryLogger.warn(`Unknown field validation attempted: ${String(fieldName)}`, {
          form_id: formId,
          field_name: String(fieldName),
        });

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
    validatePartial: (data: unknown) => {
      addBreadcrumb({
        message: 'Form partial validation requested',
        category: 'validation_utils.form_validate_partial',
        level: 'debug',
        data: { form_id: formId },
      });
      return validatePartial<T>(schema, data);
    },
  };
}

// Helper to format validation errors for UI display
export function formatValidationErrors(errors: ValidationErrorDetail[]): Record<string, string> {
  const startTime = Date.now();

  addBreadcrumb({
    message: 'Formatting validation errors for UI',
    category: 'validation_utils.format_errors',
    level: 'debug',
    data: {
      error_count: errors.length,
    },
  });

  try {
    const formattedErrors: Record<string, string> = {};

    errors.forEach((error) => {
      if (!formattedErrors[error.field]) {
        formattedErrors[error.field] = error.message;
      }
    });

    const duration = Date.now() - startTime;

    SentryDataCollection.setContext('error_formatting', {
      input_error_count: errors.length,
      output_field_count: Object.keys(formattedErrors).length,
      duration,
      timestamp: new Date().toISOString(),
    });

    return formattedErrors;
  } catch (error) {
    const duration = Date.now() - startTime;

    SentryDataCollection.captureException(error as Error, {
      operation: 'format_validation_errors_failed',
      error_count: errors.length,
      duration,
    });

    SentryLogger.error('Failed to format validation errors', {
      error: error as Error,
      input_error_count: errors.length,
      duration,
    });

    // Return empty object as fallback
    return {};
  }
}

// Helper to check if data matches schema without throwing
export function isValidData<T>(schema: z.ZodSchema<T>, data: unknown): data is T {
  const startTime = Date.now();

  addBreadcrumb({
    message: 'Checking data validity',
    category: 'validation_utils.is_valid_data',
    level: 'debug',
    data: {
      has_data: !!data,
      data_type: typeof data,
    },
  });

  try {
    const result = schema.safeParse(data);
    const duration = Date.now() - startTime;

    updateValidationMetrics(
      'is_valid_data',
      result.success,
      duration,
      result.success ? undefined : 'invalid_data',
    );

    SentryDataCollection.setContext('data_validity_check', {
      is_valid: result.success,
      duration,
      timestamp: new Date().toISOString(),
    });

    return result.success;
  } catch (error) {
    const duration = Date.now() - startTime;
    updateValidationMetrics('is_valid_data', false, duration, 'exception');

    SentryDataCollection.captureException(error as Error, {
      operation: 'data_validity_check_failed',
      duration,
    });

    SentryLogger.error('Error during data validity check', {
      error: error as Error,
      duration,
    });

    return false;
  }
}

// Helper for API response validation
export function validateApiResponse<T>(
  schema: z.ZodSchema<T>,
  response: unknown,
  endpoint?: string,
): T {
  const context = `API response${endpoint ? ` from ${endpoint}` : ''}`;
  const operation = `api_response_validation_${endpoint || 'unknown'}`;

  addBreadcrumb({
    message: `Validating API response: ${endpoint || 'unknown endpoint'}`,
    category: 'validation_utils.api_response',
    level: 'debug',
    data: {
      endpoint,
      has_response: !!response,
      response_type: typeof response,
      operation,
    },
  });

  try {
    const result = validateOrThrow(schema, response, context);

    SentryDataCollection.setContext('api_validation', {
      last_validated_endpoint: endpoint,
      success: true,
      timestamp: new Date().toISOString(),
    });

    return result;
  } catch (error) {
    SentryDataCollection.captureException(error as Error, {
      operation: 'api_response_validation_failed',
      endpoint,
      context,
    });

    SentryLogger.error(`API response validation failed for ${endpoint || 'unknown endpoint'}`, {
      error: error as Error,
      endpoint,
      context,
    });

    throw error;
  }
}

// Helper for environment variable validation
export function validateEnvVar<T>(
  schema: z.ZodSchema<T>,
  envVar: string | undefined,
  varName: string,
): T {
  const operation = `env_var_validation_${varName}`;

  addBreadcrumb({
    message: `Validating environment variable: ${varName}`,
    category: 'validation_utils.env_var',
    level: 'debug',
    data: {
      var_name: varName,
      is_defined: envVar !== undefined,
      operation,
    },
  });

  if (envVar === undefined) {
    const error = new Error(`Environment variable ${varName} is not defined`);

    SentryDataCollection.captureException(error, {
      operation: 'env_var_undefined',
      var_name: varName,
    });

    SentryLogger.error(`Environment variable not defined: ${varName}`, {
      var_name: varName,
    });

    throw error;
  }

  try {
    const result = validateOrThrow(schema, envVar, `environment variable ${varName}`);

    SentryDataCollection.setContext('env_validation', {
      last_validated_var: varName,
      success: true,
      timestamp: new Date().toISOString(),
    });

    return result;
  } catch (error) {
    SentryDataCollection.captureException(error as Error, {
      operation: 'env_var_validation_failed',
      var_name: varName,
    });

    SentryLogger.error(`Environment variable validation failed: ${varName}`, {
      error: error as Error,
      var_name: varName,
    });

    throw error;
  }
}

// Helper to create type-safe database query validators
export function createQueryValidator<T extends Record<string, unknown>>(
  schema: z.ZodObject<z.ZodRawShape>,
) {
  const validatorId = `query_validator_${Date.now()}`;

  addBreadcrumb({
    message: 'Creating database query validator',
    category: 'validation_utils.create_query_validator',
    level: 'info',
    data: {
      validator_id: validatorId,
      timestamp: new Date().toISOString(),
    },
  });

  SentryLogger.info('Database query validator created', {
    validator_id: validatorId,
    timestamp: new Date().toISOString(),
  });

  return {
    validateInsert: (data: unknown) => {
      addBreadcrumb({
        message: 'Database insert validation',
        category: 'validation_utils.db_insert',
        level: 'debug',
        data: { validator_id: validatorId },
      });
      return validateOrThrow(schema, data, 'database insert');
    },
    validateUpdate: (data: unknown) => {
      addBreadcrumb({
        message: 'Database update validation',
        category: 'validation_utils.db_update',
        level: 'debug',
        data: { validator_id: validatorId },
      });
      return validatePartial<T>(schema, data, 'database update');
    },
    validateResult: (data: unknown) => {
      addBreadcrumb({
        message: 'Database result validation',
        category: 'validation_utils.db_result',
        level: 'debug',
        data: { validator_id: validatorId },
      });
      return validateOrThrow(schema, data, 'database result');
    },
    validateResults: (data: unknown[]) => {
      addBreadcrumb({
        message: 'Database results validation',
        category: 'validation_utils.db_results',
        level: 'debug',
        data: {
          validator_id: validatorId,
          result_count: Array.isArray(data) ? data.length : 0,
        },
      });
      return validateArray(schema, data, 'database results');
    },
  };
}

// Helper to create type-safe database query validators for non-object schemas
export function createSimpleQueryValidator<T>(schema: z.ZodSchema<T>) {
  const validatorId = `simple_query_validator_${Date.now()}`;

  addBreadcrumb({
    message: 'Creating simple database query validator',
    category: 'validation_utils.create_simple_query_validator',
    level: 'info',
    data: {
      validator_id: validatorId,
      timestamp: new Date().toISOString(),
    },
  });

  SentryLogger.info('Simple database query validator created', {
    validator_id: validatorId,
    timestamp: new Date().toISOString(),
  });

  return {
    validateInsert: (data: unknown) => {
      addBreadcrumb({
        message: 'Simple database insert validation',
        category: 'validation_utils.simple_db_insert',
        level: 'debug',
        data: { validator_id: validatorId },
      });
      return validateOrThrow(schema, data, 'database insert');
    },
    validateResult: (data: unknown) => {
      addBreadcrumb({
        message: 'Simple database result validation',
        category: 'validation_utils.simple_db_result',
        level: 'debug',
        data: { validator_id: validatorId },
      });
      return validateOrThrow(schema, data, 'database result');
    },
    validateResults: (data: unknown[]) => {
      addBreadcrumb({
        message: 'Simple database results validation',
        category: 'validation_utils.simple_db_results',
        level: 'debug',
        data: {
          validator_id: validatorId,
          result_count: Array.isArray(data) ? data.length : 0,
        },
      });
      return validateArray(schema, data, 'database results');
    },
  };
}

// Validation metrics utilities
export const getValidationMetrics = (): ValidationMetrics => {
  addBreadcrumb({
    message: 'Validation metrics requested',
    category: 'validation_utils.get_metrics',
    level: 'debug',
    data: {
      total_validations: validationMetrics.totalValidations,
      success_rate:
        validationMetrics.totalValidations > 0
          ? (validationMetrics.successfulValidations / validationMetrics.totalValidations) * 100
          : 0,
    },
  });

  return { ...validationMetrics };
};

export const resetValidationMetrics = (): void => {
  addBreadcrumb({
    message: 'Validation metrics reset',
    category: 'validation_utils.reset_metrics',
    level: 'info',
    data: {
      previous_total_validations: validationMetrics.totalValidations,
      timestamp: new Date().toISOString(),
    },
  });

  SentryLogger.info('Validation metrics reset', {
    previous_total_validations: validationMetrics.totalValidations,
    timestamp: new Date().toISOString(),
  });

  validationMetrics = {
    totalValidations: 0,
    successfulValidations: 0,
    failedValidations: 0,
    averageValidationTime: 0,
    slowValidations: 0,
    validationsByType: {},
    errorsByType: {},
  };

  SentryDataCollection.setContext('validation_utils_metrics', {
    ...validationMetrics,
    last_reset: new Date().toISOString(),
  });
};

// Performance monitoring utility
export const getValidationPerformanceReport = () => {
  const metrics = getValidationMetrics();
  const successRate =
    metrics.totalValidations > 0
      ? (metrics.successfulValidations / metrics.totalValidations) * 100
      : 0;
  const slowValidationRate =
    metrics.totalValidations > 0 ? (metrics.slowValidations / metrics.totalValidations) * 100 : 0;

  const report = {
    summary: {
      totalValidations: metrics.totalValidations,
      successRate: Math.round(successRate * 100) / 100,
      averageTime: Math.round(metrics.averageValidationTime * 100) / 100,
      slowValidationRate: Math.round(slowValidationRate * 100) / 100,
    },
    breakdown: {
      validationsByType: metrics.validationsByType,
      errorsByType: metrics.errorsByType,
    },
    timestamp: new Date().toISOString(),
  };

  addBreadcrumb({
    message: 'Validation performance report generated',
    category: 'validation_utils.performance_report',
    level: 'info',
    data: {
      total_validations: metrics.totalValidations,
      success_rate: successRate,
      timestamp: new Date().toISOString(),
    },
  });

  SentryDataCollection.setContext('validation_performance_report', report);

  return report;
};

// Default export to satisfy Expo Router (this file should not be a route)
export default function UtilsRouterPlaceholder() {
  return null;
}
