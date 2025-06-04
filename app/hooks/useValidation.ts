import { useCallback, useState } from 'react';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { safeValidate, ValidationResult } from '../validation/utils';

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

export function useValidation<T extends Record<string, any>>(
  schema: z.ZodObject<any>,
  options: UseValidationOptions = {},
) {
  const { validateOnChange = false, validateOnBlur = true, debounceMs = 300 } = options;

  const [state, setState] = useState<ValidationState>({
    errors: {},
    isValid: false,
    hasValidated: false,
    isValidating: false,
  });

  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const validate = useCallback(
    (data: unknown): ValidationResult<T> => {
      setState((prev) => ({ ...prev, isValidating: true }));

      const result = safeValidate(schema, data, 'form validation') as ValidationResult<T>;

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

      return result;
    },
    [schema],
  );

  const validateField = useCallback(
    (fieldName: string, value: unknown, allData?: unknown): boolean => {
      try {
        // Try to validate just this field
        const fieldSchema = schema.shape[fieldName];
        if (fieldSchema) {
          const fieldResult = fieldSchema.safeParse(value);

          setState((prev) => ({
            ...prev,
            errors: {
              ...prev.errors,
              [fieldName]: fieldResult.success
                ? ''
                : fieldResult.error.errors[0]?.message || 'Invalid value',
            },
          }));

          return fieldResult.success;
        }

        // If we can't validate just the field, validate the whole form
        if (allData) {
          const result = validate(allData);
          return result.success;
        }

        return true;
      } catch (error) {
        logger.error('Field validation error', error as Error, {
          context: { fieldName, value },
        });
        return false;
      }
    },
    [schema, validate],
  );

  const validateWithDebounce = useCallback(
    (data: unknown) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      const timer = setTimeout(() => {
        validate(data);
      }, debounceMs);

      setDebounceTimer(timer);
    },
    [validate, debounceMs, debounceTimer],
  );

  const clearErrors = useCallback(() => {
    setState((prev) => ({
      ...prev,
      errors: {},
      isValid: false,
      hasValidated: false,
    }));
  }, []);

  const clearFieldError = useCallback((fieldName: string) => {
    setState((prev) => ({
      ...prev,
      errors: {
        ...prev.errors,
        [fieldName]: '',
      },
    }));
  }, []);

  const setFieldError = useCallback((fieldName: string, error: string) => {
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
      const result = validate(data);

      if (result.success) {
        try {
          return await onSubmit(result.data);
        } catch (error) {
          logger.error('Form submission error', error as Error, {
            context: { data: result.data },
          });
          throw error;
        }
      }

      return null;
    },
    [validate],
  );

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
    hasErrors: Object.values(state.errors).some((error) => Boolean(error)),
    errorCount: Object.values(state.errors).filter((error) => Boolean(error)).length,
    firstError: Object.values(state.errors).find((error) => Boolean(error)) || null,
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
