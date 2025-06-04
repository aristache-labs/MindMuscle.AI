import { useCallback, useState, useRef, useEffect } from 'react';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { safeValidate, ValidationResult } from '../validation/utils';
import { useSentryDataCollection } from './useSentryDataCollection';

interface ValidationState {
  errors: Record<string, string>;
  isValid: boolean;
  hasValidated: boolean;
  isValidating: boolean;
}

interface UseValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
}

// Validation metrics for monitoring
interface ValidationMetrics {
  initTime: number;
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  fieldValidations: number;
  formSubmissions: number;
  successfulSubmissions: number;
  performanceMetrics: {
    avgValidationTime: number;
    avgFieldValidationTime: number;
    avgSubmissionTime: number;
  };
  errorPatterns: Record<string, number>;
}

export function useValidation<T extends Record<string, unknown>>(
  schema: z.ZodObject<z.ZodRawShape>,
  options: UseValidationOptions = {},
) {
  const { validateOnChange = false, validateOnBlur = true, debounceMs = 300 } = options;

  // Initialize Sentry monitoring
  const { setContext, addBreadcrumb, captureException, trackUserAction, setTag } =
    useSentryDataCollection({
      componentName: 'useValidation',
    });

  const [state, setState] = useState<ValidationState>({
    errors: {},
    isValid: false,
    hasValidated: false,
    isValidating: false,
  });

  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Validation metrics tracking
  const validationMetrics = useRef<ValidationMetrics>({
    initTime: Date.now(),
    totalValidations: 0,
    successfulValidations: 0,
    failedValidations: 0,
    fieldValidations: 0,
    formSubmissions: 0,
    successfulSubmissions: 0,
    performanceMetrics: {
      avgValidationTime: 0,
      avgFieldValidationTime: 0,
      avgSubmissionTime: 0,
    },
    errorPatterns: {},
  });

  const performanceTimes = useRef<{
    validations: number[];
    fieldValidations: number[];
    submissions: number[];
  }>({
    validations: [],
    fieldValidations: [],
    submissions: [],
  });

  // Initialize monitoring context
  useEffect(() => {
    setContext('validation_hook', {
      schema_keys: Object.keys(schema.shape).join(', '),
      validate_on_change: validateOnChange,
      validate_on_blur: validateOnBlur,
      debounce_ms: debounceMs,
      init_time: validationMetrics.current.initTime,
    });

    setTag('validation_strategy', validateOnChange ? 'on_change' : 'on_blur');

    addBreadcrumb({
      message: 'Validation hook initialized',
      category: 'validation',
      level: 'info',
      data: {
        schema_field_count: Object.keys(schema.shape).length,
        validation_options: {
          on_change: validateOnChange,
          on_blur: validateOnBlur,
          debounce_ms: debounceMs,
        },
      },
    });
  }, [schema, validateOnChange, validateOnBlur, debounceMs]);

  // Update performance metrics
  const updatePerformanceMetrics = useCallback(() => {
    const { validations, fieldValidations, submissions } = performanceTimes.current;

    validationMetrics.current.performanceMetrics = {
      avgValidationTime:
        validations.length > 0 ? validations.reduce((a, b) => a + b, 0) / validations.length : 0,
      avgFieldValidationTime:
        fieldValidations.length > 0
          ? fieldValidations.reduce((a, b) => a + b, 0) / fieldValidations.length
          : 0,
      avgSubmissionTime:
        submissions.length > 0 ? submissions.reduce((a, b) => a + b, 0) / submissions.length : 0,
    };

    // Keep only last 100 measurements to prevent memory leaks
    if (validations.length > 100) performanceTimes.current.validations = validations.slice(-100);
    if (fieldValidations.length > 100)
      performanceTimes.current.fieldValidations = fieldValidations.slice(-100);
    if (submissions.length > 100) performanceTimes.current.submissions = submissions.slice(-100);
  }, []);

  // Track error patterns
  const trackErrorPattern = useCallback(
    (errors: Array<{ field: string; message: string; code?: string }>) => {
      errors.forEach((error) => {
        const pattern = `${error.field}:${error.message}`;
        validationMetrics.current.errorPatterns[pattern] =
          (validationMetrics.current.errorPatterns[pattern] || 0) + 1;
      });

      // Report common error patterns
      const sortedPatterns = Object.entries(validationMetrics.current.errorPatterns)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      if (sortedPatterns.length > 0) {
        setContext('validation_error_patterns', {
          most_common_errors: sortedPatterns
            .map(([pattern, count]) => `${pattern}:${count}`)
            .join(', '),
        });
      }
    },
    [setContext],
  );

  const validate = useCallback(
    (data: unknown): ValidationResult<T> => {
      const validationStartTime = Date.now();

      setState((prev) => ({ ...prev, isValidating: true }));

      addBreadcrumb({
        message: 'Form validation started',
        category: 'validation',
        level: 'debug',
        data: {
          data_keys:
            typeof data === 'object' && data
              ? Object.keys(data as Record<string, unknown>).join(', ')
              : '',
        },
      });

      try {
        const result = safeValidate(schema, data, 'form validation') as ValidationResult<T>;
        const validationDuration = Date.now() - validationStartTime;

        validationMetrics.current.totalValidations += 1;
        performanceTimes.current.validations.push(validationDuration);

        if (result.success) {
          validationMetrics.current.successfulValidations += 1;

          addBreadcrumb({
            message: 'Form validation successful',
            category: 'validation',
            level: 'info',
            data: {
              validation_duration_ms: validationDuration,
              field_count: Object.keys(result.data).length,
            },
          });
        } else {
          validationMetrics.current.failedValidations += 1;
          trackErrorPattern(result.errors);

          addBreadcrumb({
            message: 'Form validation failed',
            category: 'validation',
            level: 'warning',
            data: {
              validation_duration_ms: validationDuration,
              error_count: result.errors.length,
              error_fields: result.errors.map((e) => e.field).join(', '),
            },
          });
        }

        setState((prev) => ({
          ...prev,
          hasValidated: true,
          isValidating: false,
          isValid: result.success,
          errors: result.success
            ? {}
            : result.errors.reduce(
                (acc, error) => {
                  if (!acc[error.field]) {
                    acc[error.field] = error.message;
                  }
                  return acc;
                },
                {} as Record<string, string>,
              ),
        }));

        updatePerformanceMetrics();

        // Update performance context
        setContext('validation_performance', {
          total_validations: validationMetrics.current.totalValidations,
          success_rate:
            validationMetrics.current.totalValidations > 0
              ? (validationMetrics.current.successfulValidations /
                  validationMetrics.current.totalValidations) *
                100
              : 0,
          avg_validation_time_ms: validationMetrics.current.performanceMetrics.avgValidationTime,
          last_validation_duration_ms: validationDuration,
        });

        return result;
      } catch (error) {
        const validationDuration = Date.now() - validationStartTime;

        captureException(error as Error, {
          operation: 'form_validation',
          validation_duration_ms: validationDuration,
          schema_keys: Object.keys(schema.shape).join(', '),
        });

        setState((prev) => ({
          ...prev,
          hasValidated: true,
          isValidating: false,
          isValid: false,
          errors: { general: 'Validation error occurred' },
        }));

        return {
          success: false,
          data: null,
          errors: [
            { field: 'general', message: 'Validation error occurred', code: 'VALIDATION_ERROR' },
          ],
        };
      }
    },
    [schema, trackErrorPattern, updatePerformanceMetrics, setContext],
  );

  const validateField = useCallback(
    (fieldName: string, value: unknown, allData?: unknown): boolean => {
      const fieldValidationStartTime = Date.now();

      addBreadcrumb({
        message: 'Field validation started',
        category: 'validation',
        level: 'debug',
        data: {
          field_name: fieldName,
          has_all_data: !!allData,
        },
      });

      try {
        validationMetrics.current.fieldValidations += 1;

        // Try to validate just this field
        const fieldSchema = schema.shape[fieldName];
        if (fieldSchema) {
          const fieldResult = fieldSchema.safeParse(value);
          const fieldValidationDuration = Date.now() - fieldValidationStartTime;

          performanceTimes.current.fieldValidations.push(fieldValidationDuration);

          setState((prev) => ({
            ...prev,
            errors: {
              ...prev.errors,
              [fieldName]: fieldResult.success
                ? ''
                : fieldResult.error.errors[0]?.message || 'Invalid value',
            },
          }));

          if (!fieldResult.success) {
            addBreadcrumb({
              message: 'Field validation failed',
              category: 'validation',
              level: 'warning',
              data: {
                field_name: fieldName,
                error_message: fieldResult.error.errors[0]?.message || 'Invalid value',
                validation_duration_ms: fieldValidationDuration,
              },
            });

            trackErrorPattern([
              {
                field: fieldName,
                message: fieldResult.error.errors[0]?.message || 'Invalid value',
                code: 'FIELD_VALIDATION_ERROR',
              },
            ]);
          } else {
            addBreadcrumb({
              message: 'Field validation successful',
              category: 'validation',
              level: 'debug',
              data: {
                field_name: fieldName,
                validation_duration_ms: fieldValidationDuration,
              },
            });
          }

          updatePerformanceMetrics();
          return fieldResult.success;
        }

        // If we can't validate just the field, validate the whole form
        if (allData) {
          const result = validate(allData);
          return result.success;
        }

        return true;
      } catch (error) {
        const fieldValidationDuration = Date.now() - fieldValidationStartTime;

        logger.error('Field validation error', error as Error, {
          context: { fieldName, value },
        });

        captureException(error as Error, {
          operation: 'field_validation',
          field_name: fieldName,
          validation_duration_ms: fieldValidationDuration,
        });

        return false;
      }
    },
    [schema, validate, trackErrorPattern, updatePerformanceMetrics],
  );

  const validateWithDebounce = useCallback(
    (data: unknown) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      addBreadcrumb({
        message: 'Debounced validation scheduled',
        category: 'validation',
        level: 'debug',
        data: {
          debounce_ms: debounceMs,
        },
      });

      const timer = setTimeout(() => {
        validate(data);
      }, debounceMs);

      setDebounceTimer(timer);
    },
    [validate, debounceMs, debounceTimer],
  );

  const clearErrors = useCallback(() => {
    addBreadcrumb({
      message: 'Validation errors cleared',
      category: 'validation',
      level: 'debug',
    });

    setState((prev) => ({
      ...prev,
      errors: {},
      isValid: false,
      hasValidated: false,
    }));
  }, []);

  const clearFieldError = useCallback((fieldName: string) => {
    addBreadcrumb({
      message: 'Field error cleared',
      category: 'validation',
      level: 'debug',
      data: { field_name: fieldName },
    });

    setState((prev) => ({
      ...prev,
      errors: {
        ...prev.errors,
        [fieldName]: '',
      },
    }));
  }, []);

  const setFieldError = useCallback((fieldName: string, error: string) => {
    addBreadcrumb({
      message: 'Field error set manually',
      category: 'validation',
      level: 'warning',
      data: {
        field_name: fieldName,
        error_message: error,
      },
    });

    setState((prev) => ({
      ...prev,
      errors: {
        ...prev.errors,
        [fieldName]: error,
      },
      isValid: false,
    }));
  }, []);

  // Helper to get field props for form inputs
  const getFieldProps = useCallback(
    (fieldName: string, value: unknown, allData?: unknown) => ({
      error: state.errors[fieldName],
      hasError: Boolean(state.errors[fieldName]),
      onBlur: validateOnBlur ? () => validateField(fieldName, value, allData) : undefined,
      onChange: validateOnChange
        ? (newValue: unknown) => validateField(fieldName, newValue, allData)
        : undefined,
    }),
    [state.errors, validateOnBlur, validateOnChange, validateField],
  );

  // Helper to validate and submit form
  const validateAndSubmit = useCallback(
    async <TResult>(
      data: unknown,
      onSubmit: (validData: T) => Promise<TResult> | TResult,
    ): Promise<TResult | null> => {
      const submissionStartTime = Date.now();

      validationMetrics.current.formSubmissions += 1;

      trackUserAction('form_submission_attempted', {
        field_count:
          typeof data === 'object' && data
            ? Object.keys(data as Record<string, unknown>).length
            : 0,
      });

      addBreadcrumb({
        message: 'Form submission started',
        category: 'form-submission',
        level: 'info',
        data: {
          submission_attempt: validationMetrics.current.formSubmissions,
        },
      });

      const result = validate(data);

      if (result.success) {
        try {
          const submitResult = await onSubmit(result.data);
          const submissionDuration = Date.now() - submissionStartTime;

          validationMetrics.current.successfulSubmissions += 1;
          performanceTimes.current.submissions.push(submissionDuration);
          updatePerformanceMetrics();

          addBreadcrumb({
            message: 'Form submission successful',
            category: 'form-submission',
            level: 'info',
            data: {
              submission_duration_ms: submissionDuration,
              success_rate:
                (validationMetrics.current.successfulSubmissions /
                  validationMetrics.current.formSubmissions) *
                100,
            },
          });

          trackUserAction('form_submission_successful', {
            submission_duration_ms: submissionDuration,
          });

          setContext('form_submission_performance', {
            total_submissions: validationMetrics.current.formSubmissions,
            successful_submissions: validationMetrics.current.successfulSubmissions,
            success_rate:
              (validationMetrics.current.successfulSubmissions /
                validationMetrics.current.formSubmissions) *
              100,
            avg_submission_time_ms: validationMetrics.current.performanceMetrics.avgSubmissionTime,
          });

          return submitResult;
        } catch (error) {
          const submissionDuration = Date.now() - submissionStartTime;

          logger.error('Form submission error', error as Error, {
            context: { data: result.data },
          });

          captureException(error as Error, {
            operation: 'form_submission',
            submission_duration_ms: submissionDuration,
            validation_successful: true,
          });

          throw error;
        }
      } else {
        const submissionDuration = Date.now() - submissionStartTime;

        addBreadcrumb({
          message: 'Form submission failed due to validation errors',
          category: 'form-submission',
          level: 'warning',
          data: {
            submission_duration_ms: submissionDuration,
            validation_error_count: result.errors.length,
            error_fields: result.errors.map((e) => e.field).join(', '),
          },
        });

        trackUserAction('form_submission_failed', {
          reason: 'validation_errors',
          error_count: result.errors.length,
        });
      }

      return null;
    },
    [validate, updatePerformanceMetrics, setContext, trackUserAction],
  );

  // Get validation metrics
  const getValidationMetrics = useCallback(() => {
    return {
      ...validationMetrics.current,
      hookLifetime: Date.now() - validationMetrics.current.initTime,
    };
  }, []);

  // Cleanup and report metrics on unmount
  useEffect(() => {
    return () => {
      const finalMetrics = getValidationMetrics();

      addBreadcrumb({
        message: 'Validation hook unmounted',
        category: 'validation',
        level: 'info',
        data: {
          hook_lifetime_ms: finalMetrics.hookLifetime,
          total_validations: finalMetrics.totalValidations,
          successful_validations: finalMetrics.successfulValidations,
          failed_validations: finalMetrics.failedValidations,
          field_validations: finalMetrics.fieldValidations,
          form_submissions: finalMetrics.formSubmissions,
          successful_submissions: finalMetrics.successfulSubmissions,
          validation_success_rate:
            finalMetrics.totalValidations > 0
              ? (finalMetrics.successfulValidations / finalMetrics.totalValidations) * 100
              : 0,
          submission_success_rate:
            finalMetrics.formSubmissions > 0
              ? (finalMetrics.successfulSubmissions / finalMetrics.formSubmissions) * 100
              : 0,
          avg_validation_time_ms: finalMetrics.performanceMetrics.avgValidationTime,
          avg_field_validation_time_ms: finalMetrics.performanceMetrics.avgFieldValidationTime,
          avg_submission_time_ms: finalMetrics.performanceMetrics.avgSubmissionTime,
        },
      });
    };
  }, [getValidationMetrics]);

  return {
    // State
    errors: state.errors,
    isValid: state.isValid,
    hasValidated: state.hasValidated,
    isValidating: state.isValidating,

    // Methods
    validate,
    validateField,
    validateWithDebounce,
    clearErrors,
    clearFieldError,
    setFieldError,
    getFieldProps,
    validateAndSubmit,

    // Computed properties
    hasErrors: Object.keys(state.errors).some((key) => state.errors[key]),
    errorCount: Object.keys(state.errors).filter((key) => state.errors[key]).length,

    // Monitoring
    getValidationMetrics,
  };
}

// Example usage:
// import { useValidation } from '../hooks/useValidation';
// import { LoginFormSchema } from '../validation/schemas';
//
// const loginValidation = useValidation(LoginFormSchema, {
//   validateOnBlur: true,
//   validateOnChange: false,
// });

// Default export to satisfy Expo Router (this file should not be a route)
export default function UseValidationRouterPlaceholder() {
  return null;
}
