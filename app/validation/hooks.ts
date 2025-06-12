import { useCallback, useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { logger } from '../utils/logger';
import {
  SentryDataCollection,
  SentryLogger,
  addBreadcrumb,
  setContext,
  setTag,
} from '../services/sentry';
import {
  ValidationErrorDetail,
  ValidationResult,
  ValidationError,
  formatValidationErrors,
  safeValidate,
} from './utils';

// Initialize Sentry context for validation hooks
const initializeSentryContext = () => {
  setContext('validation_hooks', {
    service: 'ValidationHooks',
    version: '1.0.0',
    capabilities: [
      'form_validation',
      'field_validation',
      'async_validation',
      'array_validation',
      'conditional_validation',
      'real_time_validation',
      'performance_tracking',
      'error_monitoring',
    ],
    monitoring: {
      performance_tracking: true,
      validation_metrics: true,
      error_categorization: true,
      breadcrumb_tracking: true,
      user_interaction_tracking: true,
    },
  });
  setTag('service.type', 'validation_hooks');
  setTag('validation.framework', 'react_hooks');

  addBreadcrumb({
    message: 'Validation Hooks service initialized with Sentry monitoring',
    category: 'validation_hooks.init',
    level: 'info',
    data: {
      timestamp: new Date().toISOString(),
      capabilities_count: 8,
    },
  });

  SentryLogger.info('Validation Hooks service with Sentry monitoring initialized', {
    service: 'ValidationHooks',
    capabilities: [
      'form_validation',
      'field_validation',
      'async_validation',
      'array_validation',
      'conditional_validation',
      'real_time_validation',
      'performance_tracking',
      'error_monitoring',
    ],
    monitoring_features: [
      'performance_tracking',
      'validation_metrics',
      'error_categorization',
      'breadcrumb_tracking',
      'user_interaction_tracking',
    ],
  });
};

// Initialize Sentry context
initializeSentryContext();

// Performance tracking interface
interface ValidationMetrics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  averageValidationTime: number;
  fieldValidations: number;
  formSubmissions: number;
  asyncValidations: number;
  performanceMetrics: {
    avgFormValidationTime: number;
    avgFieldValidationTime: number;
    avgAsyncValidationTime: number;
  };
  errorPatterns: Record<string, number>;
}

// Utility function to track validation performance
const trackValidationPerformance = (
  operation: string,
  duration: number,
  success: boolean,
  errorCount?: number,
  metadata?: Record<string, unknown>,
) => {
  addBreadcrumb({
    message: `Validation ${operation} completed`,
    category: 'validation_hooks.performance',
    level: success ? 'info' : 'warning',
    data: {
      operation,
      duration,
      success,
      error_count: errorCount || 0,
      ...metadata,
    },
  });

  // Track slow validations
  if (duration > 50) {
    SentryLogger.warn(`Slow validation operation: ${operation}`, {
      operation,
      duration,
      threshold: 50,
      success,
      error_count: errorCount || 0,
      ...metadata,
    });
  }

  // Track validation metrics
  SentryDataCollection.setContext('validation_metrics', {
    last_operation: operation,
    last_duration: duration,
    last_success: success,
    timestamp: new Date().toISOString(),
  });

  return duration;
};

// Hook for form validation with Sentry monitoring
export function useFormValidation<T extends Record<string, unknown>>(
  schema: z.ZodObject<z.ZodRawShape, 'strip', z.ZodTypeAny, T>,
  formName?: string,
) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValid, setIsValid] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);

  // Performance and metrics tracking
  const metricsRef = useRef<ValidationMetrics>({
    totalValidations: 0,
    successfulValidations: 0,
    failedValidations: 0,
    averageValidationTime: 0,
    fieldValidations: 0,
    formSubmissions: 0,
    asyncValidations: 0,
    performanceMetrics: {
      avgFormValidationTime: 0,
      avgFieldValidationTime: 0,
      avgAsyncValidationTime: 0,
    },
    errorPatterns: {},
  });

  const performanceTimes = useRef<number[]>([]);

  // Initialize Sentry context for this form
  useEffect(() => {
    if (formName) {
      addBreadcrumb({
        message: `Form validation hook initialized: ${formName}`,
        category: 'validation_hooks.form',
        level: 'info',
        data: {
          form_name: formName,
          schema_fields: Object.keys(schema.shape),
          field_count: Object.keys(schema.shape).length,
        },
      });

      SentryDataCollection.setContext('current_form', {
        form_name: formName,
        schema_fields: Object.keys(schema.shape),
        field_count: Object.keys(schema.shape).length,
        initialized_at: new Date().toISOString(),
      });
    }
  }, [formName, schema]);

  const validate = useCallback(
    (data: unknown): ValidationResult<T> => {
      const startTime = Date.now();

      addBreadcrumb({
        message: `Starting form validation${formName ? ` for ${formName}` : ''}`,
        category: 'validation_hooks.form.validate',
        level: 'debug',
        data: {
          form_name: formName,
          has_data: !!data,
          data_keys:
            data && typeof data === 'object' ? Object.keys(data as Record<string, unknown>) : [],
        },
      });

      try {
        const result = safeValidate(
          schema,
          data,
          formName ? `form validation: ${formName}` : 'form validation',
        );
        const duration = Date.now() - startTime;

        setHasValidated(true);
        metricsRef.current.totalValidations++;
        performanceTimes.current.push(duration);

        if (result.success) {
          setErrors({});
          setIsValid(true);
          metricsRef.current.successfulValidations++;

          trackValidationPerformance('form_validation', duration, true, 0, {
            form_name: formName,
            field_count: Object.keys(schema.shape).length,
          });

          addBreadcrumb({
            message: `Form validation successful${formName ? ` for ${formName}` : ''}`,
            category: 'validation_hooks.form.success',
            level: 'info',
            data: {
              form_name: formName,
              duration,
              validated_fields: Object.keys((data as Record<string, unknown>) || {}),
            },
          });

          SentryLogger.info(`Form validation successful${formName ? ` for ${formName}` : ''}`, {
            form_name: formName,
            duration,
            field_count: Object.keys(schema.shape).length,
            metrics: metricsRef.current,
          });

          return {
            success: true,
            data: result.data as T,
            errors: null,
          };
        } else {
          const formattedErrors = formatValidationErrors(result.errors);
          setErrors(formattedErrors);
          setIsValid(false);
          metricsRef.current.failedValidations++;

          // Track error patterns
          result.errors.forEach((error) => {
            const errorKey = `${error.field}:${error.code}`;
            metricsRef.current.errorPatterns[errorKey] =
              (metricsRef.current.errorPatterns[errorKey] || 0) + 1;
          });

          trackValidationPerformance('form_validation', duration, false, result.errors.length, {
            form_name: formName,
            field_count: Object.keys(schema.shape).length,
            error_fields: result.errors.map((e) => e.field),
          });

          addBreadcrumb({
            message: `Form validation failed${formName ? ` for ${formName}` : ''}`,
            category: 'validation_hooks.form.error',
            level: 'warning',
            data: {
              form_name: formName,
              duration,
              error_count: result.errors.length,
              errors: result.errors.slice(0, 3), // Limit for brevity
            },
          });

          SentryLogger.warn(`Form validation failed${formName ? ` for ${formName}` : ''}`, {
            form_name: formName,
            duration,
            error_count: result.errors.length,
            validation_errors: result.errors,
            field_count: Object.keys(schema.shape).length,
          });

          logger.warn(`Form validation failed${formName ? ` for ${formName}` : ''}`, {
            context: { formName, errors: result.errors, duration },
          });

          return result;
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        metricsRef.current.failedValidations++;

        SentryDataCollection.captureException(error as Error, {
          operation: 'form_validation_exception',
          form_name: formName,
          duration,
          schema_fields: Object.keys(schema.shape),
        });

        SentryLogger.error(
          `Unexpected error during form validation${formName ? ` for ${formName}` : ''}`,
          {
            error: error as Error,
            form_name: formName,
            duration,
            schema_fields: Object.keys(schema.shape),
          },
        );

        logger.error(
          `Unexpected error during form validation${formName ? ` for ${formName}` : ''}`,
          error as Error,
          {
            context: { formName, duration },
          },
        );

        setErrors({ general: 'An unexpected validation error occurred' });
        setIsValid(false);

        return {
          success: false,
          data: null,
          errors: [
            {
              field: 'general',
              message: 'An unexpected validation error occurred',
              code: 'unexpected_error',
            },
          ],
        };
      }
    },
    [schema, formName],
  );

  const validateField = useCallback(
    (fieldName: keyof T, value: unknown): boolean => {
      const startTime = Date.now();
      const fieldSchema = schema.shape[fieldName as string];

      if (!fieldSchema) {
        addBreadcrumb({
          message: `Field validation failed: schema not found for ${String(fieldName)}`,
          category: 'validation_hooks.field.error',
          level: 'warning',
          data: {
            form_name: formName,
            field_name: String(fieldName),
            available_fields: Object.keys(schema.shape),
          },
        });

        SentryLogger.warn(`Field validation failed: schema not found`, {
          form_name: formName,
          field_name: String(fieldName),
          available_fields: Object.keys(schema.shape),
        });

        return false;
      }

      try {
        const result = safeValidate(fieldSchema, value, `field ${String(fieldName)}`);
        const duration = Date.now() - startTime;

        metricsRef.current.fieldValidations++;

        setErrors((prev) => {
          const newErrors = { ...prev };
          if (result.success) {
            delete newErrors[String(fieldName)];

            trackValidationPerformance('field_validation', duration, true, 0, {
              form_name: formName,
              field_name: String(fieldName),
            });

            addBreadcrumb({
              message: `Field validation successful: ${String(fieldName)}`,
              category: 'validation_hooks.field.success',
              level: 'debug',
              data: {
                form_name: formName,
                field_name: String(fieldName),
                duration,
              },
            });
          } else {
            newErrors[String(fieldName)] = result.errors[0]?.message || 'Invalid value';

            trackValidationPerformance('field_validation', duration, false, 1, {
              form_name: formName,
              field_name: String(fieldName),
              error_message: result.errors[0]?.message,
            });

            addBreadcrumb({
              message: `Field validation failed: ${String(fieldName)}`,
              category: 'validation_hooks.field.error',
              level: 'debug',
              data: {
                form_name: formName,
                field_name: String(fieldName),
                duration,
                error: result.errors[0]?.message,
              },
            });
          }
          return newErrors;
        });

        return result.success;
      } catch (error) {
        const duration = Date.now() - startTime;

        SentryDataCollection.captureException(error as Error, {
          operation: 'field_validation_exception',
          form_name: formName,
          field_name: String(fieldName),
          duration,
        });

        SentryLogger.error(`Unexpected error during field validation`, {
          error: error as Error,
          form_name: formName,
          field_name: String(fieldName),
          duration,
        });

        logger.error(`Unexpected error during field validation`, error as Error, {
          context: { formName, fieldName: String(fieldName), duration },
        });

        setErrors((prev) => ({
          ...prev,
          [String(fieldName)]: 'Validation error occurred',
        }));

        return false;
      }
    },
    [schema, formName],
  );

  const clearErrors = useCallback(() => {
    addBreadcrumb({
      message: `Clearing form errors${formName ? ` for ${formName}` : ''}`,
      category: 'validation_hooks.form.clear',
      level: 'info',
      data: {
        form_name: formName,
        previous_error_count: Object.keys(errors).length,
      },
    });

    setErrors({});
    setIsValid(false);
    setHasValidated(false);
  }, [formName, errors]);

  const clearFieldError = useCallback(
    (fieldName: keyof T) => {
      addBreadcrumb({
        message: `Clearing field error: ${String(fieldName)}`,
        category: 'validation_hooks.field.clear',
        level: 'debug',
        data: {
          form_name: formName,
          field_name: String(fieldName),
        },
      });

      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[String(fieldName)];
        return newErrors;
      });
    },
    [formName],
  );

  const getFieldError = useCallback(
    (fieldName: keyof T): string | undefined => {
      return errors[String(fieldName)];
    },
    [errors],
  );

  const hasFieldError = useCallback(
    (fieldName: keyof T): boolean => {
      return Boolean(errors[String(fieldName)]);
    },
    [errors],
  );

  const getMetrics = useCallback((): ValidationMetrics => {
    // Calculate average validation time
    if (performanceTimes.current.length > 0) {
      metricsRef.current.averageValidationTime =
        performanceTimes.current.reduce((a, b) => a + b, 0) / performanceTimes.current.length;
    }

    addBreadcrumb({
      message: `Form validation metrics retrieved${formName ? ` for ${formName}` : ''}`,
      category: 'validation_hooks.metrics',
      level: 'info',
      data: {
        form_name: formName,
        metrics: metricsRef.current,
      },
    });

    return { ...metricsRef.current };
  }, [formName]);

  const resetMetrics = useCallback(() => {
    const previousMetrics = { ...metricsRef.current };

    metricsRef.current = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageValidationTime: 0,
      fieldValidations: 0,
      formSubmissions: 0,
      asyncValidations: 0,
      performanceMetrics: {
        avgFormValidationTime: 0,
        avgFieldValidationTime: 0,
        avgAsyncValidationTime: 0,
      },
      errorPatterns: {},
    };

    performanceTimes.current = [];

    addBreadcrumb({
      message: `Form validation metrics reset${formName ? ` for ${formName}` : ''}`,
      category: 'validation_hooks.metrics',
      level: 'info',
      data: {
        form_name: formName,
        previous_metrics: previousMetrics,
        reset_timestamp: new Date().toISOString(),
      },
    });

    SentryLogger.info(`Form validation metrics reset${formName ? ` for ${formName}` : ''}`, {
      form_name: formName,
      previous_metrics: previousMetrics,
      reset_timestamp: new Date().toISOString(),
    });
  }, [formName]);

  return {
    validate,
    validateField,
    clearErrors,
    clearFieldError,
    getFieldError,
    hasFieldError,
    getMetrics,
    resetMetrics,
    errors,
    isValid,
    hasValidated,
    hasErrors: Object.keys(errors).length > 0,
    formName,
    totalValidations: metricsRef.current.totalValidations,
    successRate:
      metricsRef.current.totalValidations > 0
        ? (metricsRef.current.successfulValidations / metricsRef.current.totalValidations) * 100
        : 0,
  };
}

// Hook for real-time field validation
export function useFieldValidation<T>(
  schema: z.ZodSchema<T>,
  initialValue?: T,
  validateOnChange = true,
) {
  const [value, setValue] = useState<T | undefined>(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);

  const validate = useCallback(
    (valueToValidate: unknown = value): boolean => {
      const result = safeValidate(schema, valueToValidate, 'field validation');
      setHasValidated(true);

      if (result.success) {
        setError(null);
        setIsValid(true);
        return true;
      } else {
        setError(result.errors[0]?.message || 'Invalid value');
        setIsValid(false);
        return false;
      }
    },
    [schema, value],
  );

  const updateValue = useCallback(
    (newValue: T) => {
      setValue(newValue);
      if (validateOnChange) {
        validate(newValue);
      }
    },
    [validate, validateOnChange],
  );

  const clearError = useCallback(() => {
    setError(null);
    setIsValid(false);
    setHasValidated(false);
  }, []);

  return {
    value,
    setValue: updateValue,
    error,
    isValid,
    hasValidated,
    validate,
    clearError,
    hasError: Boolean(error),
  };
}

// Hook for async validation with Sentry monitoring (useful for API calls)
export function useAsyncValidation<T extends Record<string, unknown>>(
  schema: z.ZodObject<z.ZodRawShape, 'strip', z.ZodTypeAny, T>,
  validationName?: string,
) {
  const [isValidating, setIsValidating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValid, setIsValid] = useState(false);

  // Performance and metrics tracking
  const metricsRef = useRef<ValidationMetrics>({
    totalValidations: 0,
    successfulValidations: 0,
    failedValidations: 0,
    averageValidationTime: 0,
    fieldValidations: 0,
    formSubmissions: 0,
    asyncValidations: 0,
    performanceMetrics: {
      avgFormValidationTime: 0,
      avgFieldValidationTime: 0,
      avgAsyncValidationTime: 0,
    },
    errorPatterns: {},
  });

  const performanceTimes = useRef<number[]>([]);

  // Initialize Sentry context for async validation
  useEffect(() => {
    if (validationName) {
      addBreadcrumb({
        message: `Async validation hook initialized: ${validationName}`,
        category: 'validation_hooks.async',
        level: 'info',
        data: {
          validation_name: validationName,
          schema_fields: Object.keys(schema.shape),
          field_count: Object.keys(schema.shape).length,
        },
      });

      SentryDataCollection.setContext('current_async_validation', {
        validation_name: validationName,
        schema_fields: Object.keys(schema.shape),
        field_count: Object.keys(schema.shape).length,
        initialized_at: new Date().toISOString(),
      });
    }
  }, [validationName, schema]);

  // Helper function to handle sync validation failure
  const handleSyncValidationFailure = useCallback(
    (syncResult: ValidationError, syncDuration: number, totalDuration: number): ValidationError => {
      const errors = syncResult.errors || [];
      setErrors(formatValidationErrors(errors));
      setIsValid(false);
      metricsRef.current.failedValidations++;

      trackValidationPerformance(
        'async_validation_sync_failed',
        totalDuration,
        false,
        errors.length,
        {
          validation_name: validationName,
          sync_duration: syncDuration,
          error_count: errors.length,
          phase: 'synchronous',
        },
      );

      addBreadcrumb({
        message: `Async validation sync phase failed${validationName ? ` for ${validationName}` : ''}`,
        category: 'validation_hooks.async.sync_failed',
        level: 'warning',
        data: {
          validation_name: validationName,
          sync_duration: syncDuration,
          total_duration: totalDuration,
          error_count: errors.length,
          errors: errors.slice(0, 3),
        },
      });

      SentryLogger.warn(
        `Async validation sync phase failed${validationName ? ` for ${validationName}` : ''}`,
        {
          validation_name: validationName,
          sync_duration: syncDuration,
          total_duration: totalDuration,
          error_count: errors.length,
          validation_errors: errors,
        },
      );

      return syncResult;
    },
    [validationName],
  );

  // Helper function to handle async validation failure
  const handleAsyncValidationFailure = useCallback(
    (
      asyncErrors: ValidationErrorDetail[],
      syncDuration: number,
      asyncDuration: number,
      totalDuration: number,
    ) => {
      setErrors(formatValidationErrors(asyncErrors));
      setIsValid(false);
      metricsRef.current.failedValidations++;

      trackValidationPerformance(
        'async_validation_async_failed',
        totalDuration,
        false,
        asyncErrors.length,
        {
          validation_name: validationName,
          sync_duration: syncDuration,
          async_duration: asyncDuration,
          error_count: asyncErrors.length,
          phase: 'asynchronous',
        },
      );

      addBreadcrumb({
        message: `Async validation async phase failed${validationName ? ` for ${validationName}` : ''}`,
        category: 'validation_hooks.async.async_failed',
        level: 'warning',
        data: {
          validation_name: validationName,
          sync_duration: syncDuration,
          async_duration: asyncDuration,
          total_duration: totalDuration,
          error_count: asyncErrors.length,
          errors: asyncErrors.slice(0, 3),
        },
      });

      SentryLogger.warn(
        `Async validation async phase failed${validationName ? ` for ${validationName}` : ''}`,
        {
          validation_name: validationName,
          sync_duration: syncDuration,
          async_duration: asyncDuration,
          total_duration: totalDuration,
          error_count: asyncErrors.length,
          validation_errors: asyncErrors,
        },
      );

      return {
        success: false as const,
        data: null,
        errors: asyncErrors,
      };
    },
    [validationName],
  );

  // Helper function to handle successful validation
  const handleValidationSuccess = useCallback(
    (
      validData: T,
      syncDuration: number,
      asyncDuration: number,
      totalDuration: number,
    ): ValidationResult<T> => {
      trackValidationPerformance('async_validation_success', totalDuration, true, 0, {
        validation_name: validationName,
        sync_duration: syncDuration,
        async_duration: asyncDuration,
        phase: 'complete',
      });

      addBreadcrumb({
        message: `Async validation completed successfully${validationName ? ` for ${validationName}` : ''}`,
        category: 'validation_hooks.async.success',
        level: 'info',
        data: {
          validation_name: validationName,
          sync_duration: syncDuration,
          async_duration: asyncDuration,
          total_duration: totalDuration,
        },
      });

      SentryLogger.info(
        `Async validation completed successfully${validationName ? ` for ${validationName}` : ''}`,
        {
          validation_name: validationName,
          sync_duration: syncDuration,
          async_duration: asyncDuration,
          total_duration: totalDuration,
          metrics: metricsRef.current,
        },
      );

      performanceTimes.current.push(totalDuration);
      setErrors({});
      setIsValid(true);
      metricsRef.current.successfulValidations++;

      return {
        success: true as const,
        data: validData,
        errors: null,
      };
    },
    [validationName],
  );

  // Helper function to handle validation exceptions
  const handleValidationException = useCallback(
    (error: unknown, totalDuration: number) => {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed';
      const validationError: ValidationErrorDetail = {
        field: 'async',
        message: errorMessage,
        code: 'async_error',
      };

      metricsRef.current.failedValidations++;

      SentryDataCollection.captureException(error as Error, {
        operation: 'async_validation_exception',
        validation_name: validationName,
        duration: totalDuration,
        schema_fields: Object.keys(schema.shape),
      });

      SentryLogger.error(
        `Unexpected error during async validation${validationName ? ` for ${validationName}` : ''}`,
        {
          error: error as Error,
          validation_name: validationName,
          duration: totalDuration,
          schema_fields: Object.keys(schema.shape),
        },
      );

      logger.error(
        `Unexpected error during async validation${validationName ? ` for ${validationName}` : ''}`,
        error as Error,
        {
          context: { validationName, duration: totalDuration },
        },
      );

      setErrors({ async: errorMessage });
      setIsValid(false);

      return {
        success: false as const,
        data: null,
        errors: [validationError],
      };
    },
    [validationName, schema],
  );

  const validateAsync = useCallback(
    async (
      data: unknown,
      asyncValidator?: (validData: T) => Promise<ValidationErrorDetail[]>,
    ): Promise<ValidationResult<T>> => {
      const startTime = Date.now();
      setIsValidating(true);

      addBreadcrumb({
        message: `Starting async validation${validationName ? ` for ${validationName}` : ''}`,
        category: 'validation_hooks.async.start',
        level: 'info',
        data: {
          validation_name: validationName,
          has_data: !!data,
          has_async_validator: !!asyncValidator,
          data_keys:
            data && typeof data === 'object' ? Object.keys(data as Record<string, unknown>) : [],
        },
      });

      try {
        // First, run synchronous validation
        const syncStartTime = Date.now();
        const syncResult = safeValidate(
          schema,
          data,
          validationName ? `async validation: ${validationName}` : 'async validation',
        );
        const syncDuration = Date.now() - syncStartTime;

        metricsRef.current.totalValidations++;
        metricsRef.current.asyncValidations++;

        if (!syncResult.success) {
          const totalDuration = Date.now() - startTime;
          return handleSyncValidationFailure(syncResult, syncDuration, totalDuration);
        }

        // If sync validation passes and async validator is provided, run it
        if (asyncValidator) {
          const asyncStartTime = Date.now();

          addBreadcrumb({
            message: `Running async validator${validationName ? ` for ${validationName}` : ''}`,
            category: 'validation_hooks.async.validator',
            level: 'debug',
            data: {
              validation_name: validationName,
              sync_duration: syncDuration,
            },
          });

          const asyncErrors = await asyncValidator(syncResult.data as T);
          const asyncDuration = Date.now() - asyncStartTime;
          const totalDuration = Date.now() - startTime;

          if (asyncErrors.length > 0) {
            return handleAsyncValidationFailure(
              asyncErrors,
              syncDuration,
              asyncDuration,
              totalDuration,
            );
          }

          return handleValidationSuccess(
            syncResult.data as T,
            syncDuration,
            asyncDuration,
            totalDuration,
          );
        }

        // If no async validator, handle success with sync-only validation
        const totalDuration = Date.now() - startTime;
        return handleValidationSuccess(syncResult.data as T, syncDuration, 0, totalDuration);
      } catch (error) {
        const totalDuration = Date.now() - startTime;
        return handleValidationException(error, totalDuration);
      } finally {
        setIsValidating(false);
      }
    },
    [
      schema,
      validationName,
      handleSyncValidationFailure,
      handleAsyncValidationFailure,
      handleValidationSuccess,
      handleValidationException,
    ],
  );

  const clearErrors = useCallback(() => {
    addBreadcrumb({
      message: `Clearing async validation errors${validationName ? ` for ${validationName}` : ''}`,
      category: 'validation_hooks.async.clear',
      level: 'info',
      data: {
        validation_name: validationName,
        previous_error_count: Object.keys(errors).length,
      },
    });

    setErrors({});
    setIsValid(false);
  }, [validationName, errors]);

  const getMetrics = useCallback((): ValidationMetrics => {
    // Calculate average validation time
    if (performanceTimes.current.length > 0) {
      metricsRef.current.averageValidationTime =
        performanceTimes.current.reduce((a, b) => a + b, 0) / performanceTimes.current.length;
      metricsRef.current.performanceMetrics.avgAsyncValidationTime =
        metricsRef.current.averageValidationTime;
    }

    addBreadcrumb({
      message: `Async validation metrics retrieved${validationName ? ` for ${validationName}` : ''}`,
      category: 'validation_hooks.async.metrics',
      level: 'info',
      data: {
        validation_name: validationName,
        metrics: metricsRef.current,
      },
    });

    return { ...metricsRef.current };
  }, [validationName]);

  return {
    validateAsync,
    clearErrors,
    getMetrics,
    errors,
    isValid,
    isValidating,
    hasErrors: Object.keys(errors).length > 0,
    validationName,
    totalValidations: metricsRef.current.totalValidations,
    successRate:
      metricsRef.current.totalValidations > 0
        ? (metricsRef.current.successfulValidations / metricsRef.current.totalValidations) * 100
        : 0,
    asyncValidations: metricsRef.current.asyncValidations,
  };
}

// Hook for validating arrays of items
export function useArrayValidation<T>(schema: z.ZodSchema<T>) {
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [isValid, setIsValid] = useState(false);

  const validateArray = useCallback(
    (items: unknown[]): ValidationResult<T[]> => {
      const validatedItems: T[] = [];
      const newErrors: Record<number, string> = {};

      items.forEach((item, index) => {
        const result = safeValidate(schema, item, `array item ${index}`);
        if (result.success) {
          validatedItems.push(result.data);
        } else {
          newErrors[index] = result.errors[0]?.message || 'Invalid item';
        }
      });

      setErrors(newErrors);
      setIsValid(Object.keys(newErrors).length === 0);

      if (Object.keys(newErrors).length > 0) {
        return {
          success: false,
          data: null,
          errors: Object.entries(newErrors).map(([index, message]) => ({
            field: `[${index}]`,
            message,
            code: 'validation_error',
          })),
        };
      }

      return {
        success: true,
        data: validatedItems,
        errors: null,
      };
    },
    [schema],
  );

  const validateItem = useCallback(
    (item: unknown, index: number): boolean => {
      const result = safeValidate(schema, item, `array item ${index}`);

      setErrors((prev) => {
        const newErrors = { ...prev };
        if (result.success) {
          delete newErrors[index];
        } else {
          newErrors[index] = result.errors[0]?.message || 'Invalid item';
        }
        return newErrors;
      });

      return result.success;
    },
    [schema],
  );

  const clearErrors = useCallback(() => {
    setErrors({});
    setIsValid(false);
  }, []);

  const clearItemError = useCallback((index: number) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[index];
      return newErrors;
    });
  }, []);

  const getItemError = useCallback(
    (index: number): string | undefined => {
      return errors[index];
    },
    [errors],
  );

  const hasItemError = useCallback(
    (index: number): boolean => {
      return Boolean(errors[index]);
    },
    [errors],
  );

  return {
    validateArray,
    validateItem,
    clearErrors,
    clearItemError,
    getItemError,
    hasItemError,
    errors,
    isValid,
    hasErrors: Object.keys(errors).length > 0,
  };
}

// Hook for conditional validation
export function useConditionalValidation<T>(schema: z.ZodSchema<T>, condition: () => boolean) {
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);

  const validate = useCallback(
    (data: unknown): ValidationResult<T> | null => {
      if (!condition()) {
        setError(null);
        setIsValid(true);
        return null; // Skip validation
      }

      const result = safeValidate(schema, data, 'conditional validation');

      if (result.success) {
        setError(null);
        setIsValid(true);
      } else {
        setError(result.errors[0]?.message || 'Validation failed');
        setIsValid(false);
      }

      return result;
    },
    [schema, condition],
  );

  const clearError = useCallback(() => {
    setError(null);
    setIsValid(false);
  }, []);

  return {
    validate,
    clearError,
    error,
    isValid,
    hasError: Boolean(error),
    shouldValidate: condition(),
  };
}

// Global validation metrics aggregation
export const getGlobalValidationMetrics = (): {
  message: string;
  categories: string[];
  service_info: Record<string, unknown>;
} => {
  const globalMetrics = {
    message: 'Global validation hooks metrics retrieved',
    categories: [
      'validation_hooks.global.metrics',
      'performance.validation',
      'error_tracking.validation',
    ],
    service_info: {
      service: 'ValidationHooks',
      capabilities: [
        'form_validation',
        'field_validation',
        'async_validation',
        'array_validation',
        'conditional_validation',
        'real_time_validation',
        'performance_tracking',
        'error_monitoring',
      ],
      monitoring_features: [
        'performance_tracking',
        'validation_metrics',
        'error_categorization',
        'breadcrumb_tracking',
        'user_interaction_tracking',
      ],
      timestamp: new Date().toISOString(),
    },
  };

  addBreadcrumb({
    message: globalMetrics.message,
    category: 'validation_hooks.global.metrics',
    level: 'info',
    data: globalMetrics.service_info,
  });

  SentryLogger.info('Global validation hooks metrics retrieved', globalMetrics.service_info);

  return globalMetrics;
};

// Export validation hooks performance utility
export const createValidationPerformanceTracker = (hookName: string) => {
  return {
    trackOperation: (
      operation: string,
      duration: number,
      success: boolean,
      metadata?: Record<string, unknown>,
    ) => {
      trackValidationPerformance(`${hookName}_${operation}`, duration, success, undefined, {
        hook_name: hookName,
        ...metadata,
      });
    },
    addBreadcrumb: (message: string, data?: Record<string, unknown>) => {
      addBreadcrumb({
        message: `${hookName}: ${message}`,
        category: `validation_hooks.${hookName}`,
        level: 'info',
        data: {
          hook_name: hookName,
          ...data,
        },
      });
    },
  };
};

// Default export to satisfy Expo Router (this file should not be a route)
export default function HooksRouterPlaceholder() {
  return null;
}
