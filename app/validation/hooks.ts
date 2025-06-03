import { useCallback, useState } from 'react';
import { z } from 'zod';
import {
  ValidationErrorDetail,
  ValidationResult,
  formatValidationErrors,
  safeValidate,
} from './utils';

// Hook for form validation
export function useFormValidation<T extends Record<string, unknown>>(
  schema: z.ZodObject<z.ZodRawShape, 'strip', z.ZodTypeAny, T>,
) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValid, setIsValid] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);

  const validate = useCallback(
    (data: unknown): ValidationResult<T> => {
      const result = safeValidate(schema, data, 'form validation');
      setHasValidated(true);

      if (result.success) {
        setErrors({});
        setIsValid(true);
        return {
          success: true,
          data: result.data as T,
          errors: null,
        };
      } else {
        setErrors(formatValidationErrors(result.errors));
        setIsValid(false);
        return result;
      }
    },
    [schema],
  );

  const validateField = useCallback(
    (fieldName: keyof T, value: unknown): boolean => {
      const fieldSchema = schema.shape[fieldName as string];
      if (!fieldSchema) {
        return false;
      }

      const result = safeValidate(fieldSchema, value, `field ${String(fieldName)}`);

      setErrors((prev) => {
        const newErrors = { ...prev };
        if (result.success) {
          delete newErrors[String(fieldName)];
        } else {
          newErrors[String(fieldName)] = result.errors[0]?.message || 'Invalid value';
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
    setHasValidated(false);
  }, []);

  const clearFieldError = useCallback((fieldName: keyof T) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[String(fieldName)];
      return newErrors;
    });
  }, []);

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

  return {
    validate,
    validateField,
    clearErrors,
    clearFieldError,
    getFieldError,
    hasFieldError,
    errors,
    isValid,
    hasValidated,
    hasErrors: Object.keys(errors).length > 0,
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

// Hook for async validation (useful for API calls)
export function useAsyncValidation<T extends Record<string, unknown>>(
  schema: z.ZodObject<z.ZodRawShape, 'strip', z.ZodTypeAny, T>,
) {
  const [isValidating, setIsValidating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValid, setIsValid] = useState(false);

  const validateAsync = useCallback(
    async (
      data: unknown,
      asyncValidator?: (validData: T) => Promise<ValidationErrorDetail[]>,
    ): Promise<ValidationResult<T>> => {
      setIsValidating(true);

      try {
        // First, run synchronous validation
        const syncResult = safeValidate(schema, data, 'async validation');

        if (!syncResult.success) {
          setErrors(formatValidationErrors(syncResult.errors));
          setIsValid(false);
          return syncResult;
        }

        // If sync validation passes and async validator is provided, run it
        if (asyncValidator) {
          const asyncErrors = await asyncValidator(syncResult.data as T);
          if (asyncErrors.length > 0) {
            setErrors(formatValidationErrors(asyncErrors));
            setIsValid(false);
            return {
              success: false,
              data: null,
              errors: asyncErrors,
            };
          }
        }

        setErrors({});
        setIsValid(true);
        return {
          success: true,
          data: syncResult.data as T,
          errors: null,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Validation failed';
        const validationError: ValidationErrorDetail = {
          field: 'async',
          message: errorMessage,
          code: 'async_error',
        };

        setErrors({ async: errorMessage });
        setIsValid(false);

        return {
          success: false,
          data: null,
          errors: [validationError],
        };
      } finally {
        setIsValidating(false);
      }
    },
    [schema],
  );

  const clearErrors = useCallback(() => {
    setErrors({});
    setIsValid(false);
  }, []);

  return {
    validateAsync,
    clearErrors,
    errors,
    isValid,
    isValidating,
    hasErrors: Object.keys(errors).length > 0,
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
