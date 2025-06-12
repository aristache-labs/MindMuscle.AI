import { z } from 'zod';
import { logger } from '../utils/logger';
import { ApiResponse, HttpError, RateLimitError } from './httpClient';
import { validationService } from './validationService';
// Add Sentry imports
import { captureError } from './sentry';
import { addBreadcrumb } from './sentry/simpleErrorHandler';

// Response transformation types
export interface ResponseTransformer<TInput = unknown, TOutput = unknown> {
  transform: (data: TInput) => TOutput | Promise<TOutput>;
  validate?: z.ZodSchema<TOutput>;
  errorHandler?: (error: Error, data: TInput) => TOutput | Promise<TOutput>;
}

// Error categorization
export enum ApiErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  RATE_LIMIT = 'rate_limit',
  SERVER = 'server',
  CLIENT = 'client',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown',
}

// Categorized API error
export interface CategorizedApiError {
  category: ApiErrorCategory;
  originalError: Error;
  message: string;
  retryable: boolean;
  retryAfter?: number;
  context?: Record<string, unknown>;
}

// Response processing options
export interface ResponseProcessingOptions {
  transformers?: ResponseTransformer[];
  validateSchema?: z.ZodSchema<unknown>;
  errorHandlers?: Record<ApiErrorCategory, (error: CategorizedApiError) => unknown>;
  cacheKey?: string;
  cacheTtl?: number;
  metadata?: Record<string, unknown>;
}

// Processed API response
export interface ProcessedApiResponse<T = unknown> extends ApiResponse<T> {
  processed: true;
  transformations: string[];
  validationPassed: boolean;
  errorCategory?: ApiErrorCategory;
  retryable?: boolean;
}

export class ApiResponseHandler {
  private transformers = new Map<string, ResponseTransformer>();
  private errorHandlers = new Map<ApiErrorCategory, (error: CategorizedApiError) => unknown>();

  constructor() {
    this.setupDefaultErrorHandlers();
  }

  // Register a response transformer
  registerTransformer(name: string, transformer: ResponseTransformer): void {
    this.transformers.set(name, transformer);
    logger.debug('Response transformer registered', { context: { name } });
  }

  // Register an error handler
  registerErrorHandler(
    category: ApiErrorCategory,
    handler: (error: CategorizedApiError) => unknown,
  ): void {
    this.errorHandlers.set(category, handler);
    logger.debug('Error handler registered', { context: { category } });
  }

  /**
   * Helper method to categorize RateLimitError
   */
  private categorizeRateLimitError(error: RateLimitError): {
    category: ApiErrorCategory;
    retryable: boolean;
    retryAfter?: number;
  } {
    return {
      category: ApiErrorCategory.RATE_LIMIT,
      retryable: true,
      retryAfter: error.retryAfter,
    };
  }

  /**
   * Helper method to categorize HTTP status codes
   */
  private categorizeHttpStatus(status: number): {
    category: ApiErrorCategory;
    retryable: boolean;
  } {
    if (status === 401) {
      return { category: ApiErrorCategory.AUTHENTICATION, retryable: false };
    }

    if (status === 403) {
      return { category: ApiErrorCategory.AUTHORIZATION, retryable: false };
    }

    if (status >= 400 && status < 500) {
      return this.categorizeClientError(status);
    }

    if (status >= 500) {
      return { category: ApiErrorCategory.SERVER, retryable: true };
    }

    return { category: ApiErrorCategory.UNKNOWN, retryable: false };
  }

  /**
   * Helper method to categorize client errors (4xx)
   */
  private categorizeClientError(status: number): {
    category: ApiErrorCategory;
    retryable: boolean;
  } {
    if (status === 408 || status === 429) {
      return { category: ApiErrorCategory.TIMEOUT, retryable: true };
    }

    if (status === 422) {
      return { category: ApiErrorCategory.VALIDATION, retryable: false };
    }

    return { category: ApiErrorCategory.CLIENT, retryable: false };
  }

  /**
   * Helper method to categorize HttpError
   */
  private categorizeHttpError(error: HttpError): {
    category: ApiErrorCategory;
    retryable: boolean;
    context?: Record<string, unknown>;
  } {
    const { category, retryable } = error.isNetworkError
      ? { category: ApiErrorCategory.NETWORK, retryable: true }
      : this.categorizeHttpStatus(error.status);

    return {
      category,
      retryable,
      context: {
        status: error.status,
        statusText: error.statusText,
        url: error.url,
        method: error.method,
      },
    };
  }

  /**
   * Helper method to categorize generic errors by message content
   */
  private categorizeGenericError(error: Error): {
    category: ApiErrorCategory;
    retryable: boolean;
  } {
    const message = error.message.toLowerCase();

    if (message.includes('network')) {
      return { category: ApiErrorCategory.NETWORK, retryable: true };
    }

    if (message.includes('timeout')) {
      return { category: ApiErrorCategory.TIMEOUT, retryable: true };
    }

    if (message.includes('validation')) {
      return { category: ApiErrorCategory.VALIDATION, retryable: false };
    }

    return { category: ApiErrorCategory.UNKNOWN, retryable: false };
  }

  // Categorize API errors
  categorizeError(error: Error): CategorizedApiError {
    try {
      addBreadcrumb('Categorizing API error', 'api_response_handler', {
        errorType: error.constructor.name,
        errorMessage: error.message,
      });

      let category: ApiErrorCategory;
      let retryable = false;
      let retryAfter: number | undefined;
      let context: Record<string, unknown> | undefined;

      if (error instanceof RateLimitError) {
        const result = this.categorizeRateLimitError(error);
        category = result.category;
        retryable = result.retryable;
        retryAfter = result.retryAfter;
      } else if (error instanceof HttpError) {
        const result = this.categorizeHttpError(error);
        category = result.category;
        retryable = result.retryable;
        context = result.context;
      } else {
        const result = this.categorizeGenericError(error);
        category = result.category;
        retryable = result.retryable;
      }

      addBreadcrumb('Successfully categorized API error', 'api_response_handler', {
        category,
        retryable,
      });

      return {
        category,
        originalError: error,
        message: error.message,
        retryable,
        retryAfter,
        context,
      };
    } catch (categorizationError) {
      logger.error('Error categorizing API error', categorizationError as Error, {
        context: { originalError: error.message },
      });
      captureError(categorizationError as Error, {
        category: 'api_error',
        component: 'apiResponseHandler',
      });

      // Return a fallback categorization
      return {
        category: ApiErrorCategory.UNKNOWN,
        originalError: error,
        message: error.message,
        retryable: false,
      };
    }
  }

  // Apply response transformations
  async applyTransformations<T>(
    data: unknown,
    transformerNames: string[] = [],
  ): Promise<{ data: T; transformations: string[] }> {
    let transformedData = data;
    const appliedTransformations: string[] = [];

    for (const name of transformerNames) {
      const transformer = this.transformers.get(name);
      if (!transformer) {
        logger.warn('Transformer not found', { context: { name } });
        continue;
      }

      try {
        transformedData = await transformer.transform(transformedData);
        appliedTransformations.push(name);

        // Validate if schema is provided
        if (transformer.validate) {
          const validationResult = validationService.validateApiResponse(
            transformer.validate,
            transformedData,
            `transformer:${name}`,
          );
          transformedData = validationResult;
        }

        logger.debug('Transformation applied successfully', {
          context: { transformer: name, dataType: typeof transformedData },
        });
      } catch (error) {
        logger.error('Transformation failed', error as Error, {
          context: { transformer: name, data: transformedData },
        });

        // Use error handler if available
        if (transformer.errorHandler) {
          try {
            transformedData = await transformer.errorHandler(error as Error, transformedData);
            appliedTransformations.push(`${name}:error-handled`);
          } catch (handlerError) {
            logger.error('Transformation error handler failed', handlerError as Error, {
              context: { transformer: name },
            });
            throw error;
          }
        } else {
          throw error;
        }
      }
    }

    return {
      data: transformedData as T,
      transformations: appliedTransformations,
    };
  }

  // Process API response
  async processResponse<T>(
    response: ApiResponse<unknown>,
    options: ResponseProcessingOptions = {},
  ): Promise<ProcessedApiResponse<T>> {
    const startTime = Date.now();
    let processedData = response.data;
    let transformations: string[] = [];
    let validationPassed = true;

    try {
      // Apply transformations
      if (options.transformers && options.transformers.length > 0) {
        const transformerNames = options.transformers.map((_, index) => `custom-${index}`);

        // Register custom transformers temporarily
        options.transformers.forEach((transformer, index) => {
          this.registerTransformer(`custom-${index}`, transformer);
        });

        const transformResult = await this.applyTransformations<T>(processedData, transformerNames);

        processedData = transformResult.data;
        transformations = transformResult.transformations;

        // Clean up temporary transformers
        transformerNames.forEach((name) => this.transformers.delete(name));
      }

      // Validate with schema
      if (options.validateSchema) {
        try {
          processedData = validationService.validateApiResponse(
            options.validateSchema,
            processedData,
            response.url,
          );
        } catch (error) {
          validationPassed = false;
          logger.error('Response validation failed', error as Error, {
            context: { url: response.url, data: processedData },
          });
          throw error;
        }
      }

      const processedResponse: ProcessedApiResponse<T> = {
        ...response,
        data: processedData as T,
        processed: true,
        transformations,
        validationPassed,
        metadata: {
          ...response.metadata,
          ...options.metadata,
          processingDuration: Date.now() - startTime,
        },
      };

      logger.info('Response processed successfully', {
        context: {
          url: response.url,
          transformations: transformations.length,
          validationPassed,
          processingDuration: Date.now() - startTime,
        },
      });

      return processedResponse;
    } catch (error) {
      const categorizedError = this.categorizeError(error as Error);

      // Try error handler
      const errorHandler =
        options.errorHandlers?.[categorizedError.category] ||
        this.errorHandlers.get(categorizedError.category);

      if (errorHandler) {
        try {
          const handledData = await errorHandler(categorizedError);

          const processedResponse: ProcessedApiResponse<T> = {
            ...response,
            data: handledData as T,
            processed: true,
            transformations: [...transformations, 'error-handled'],
            validationPassed: false,
            errorCategory: categorizedError.category,
            retryable: categorizedError.retryable,
            metadata: {
              ...response.metadata,
              ...options.metadata,
              processingDuration: Date.now() - startTime,
              errorHandled: true,
              originalError: categorizedError.message,
            },
          };

          logger.warn('Response error handled', {
            context: {
              url: response.url,
              errorCategory: categorizedError.category,
              errorHandled: true,
            },
          });

          return processedResponse;
        } catch (handlerError) {
          logger.error('Error handler failed', handlerError as Error, {
            context: { category: categorizedError.category },
          });
        }
      }

      // Re-throw if no handler or handler failed
      throw error;
    }
  }

  // Setup default error handlers
  private setupDefaultErrorHandlers(): void {
    // Authentication error handler
    this.registerErrorHandler(ApiErrorCategory.AUTHENTICATION, (error) => {
      logger.warn('Authentication error detected', {
        context: { message: error.message },
      });
      return { error: 'Authentication required', code: 'AUTH_REQUIRED' };
    });

    // Rate limit error handler
    this.registerErrorHandler(ApiErrorCategory.RATE_LIMIT, (error) => {
      logger.warn('Rate limit exceeded', {
        context: { retryAfter: error.retryAfter },
      });
      return {
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT',
        retryAfter: error.retryAfter,
      };
    });

    // Network error handler
    this.registerErrorHandler(ApiErrorCategory.NETWORK, (error) => {
      logger.warn('Network error detected', {
        context: { message: error.message },
      });
      return { error: 'Network error', code: 'NETWORK_ERROR' };
    });

    // Server error handler
    this.registerErrorHandler(ApiErrorCategory.SERVER, (error) => {
      logger.error('Server error detected', error.originalError, {
        context: { message: error.message },
      });
      return { error: 'Server error', code: 'SERVER_ERROR' };
    });

    // Validation error handler
    this.registerErrorHandler(ApiErrorCategory.VALIDATION, (error) => {
      logger.warn('Validation error detected', {
        context: { message: error.message },
      });
      return { error: 'Validation failed', code: 'VALIDATION_ERROR' };
    });
  }

  // Get error statistics
  getErrorStats(): Record<ApiErrorCategory, number> {
    // This would typically be implemented with persistent storage
    // For now, return empty stats
    return Object.values(ApiErrorCategory).reduce(
      (acc, category) => {
        acc[category] = 0;
        return acc;
      },
      {} as Record<ApiErrorCategory, number>,
    );
  }

  // Clear all registered transformers and handlers
  clear(): void {
    this.transformers.clear();
    this.errorHandlers.clear();
    this.setupDefaultErrorHandlers();
    logger.info('API response handler cleared and reset');
  }
}

// Default instance
export const apiResponseHandler = new ApiResponseHandler();

// Common response transformers
export const commonTransformers = {
  // Transform snake_case to camelCase
  snakeToCamel: {
    transform: (data: unknown) => {
      if (typeof data !== 'object' || data === null) return data;

      const transform = (obj: Record<string, unknown>): Record<string, unknown> => {
        const result: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(obj)) {
          const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

          if (Array.isArray(value)) {
            result[camelKey] = value.map((item) =>
              typeof item === 'object' && item !== null
                ? transform(item as Record<string, unknown>)
                : item,
            );
          } else if (typeof value === 'object' && value !== null) {
            result[camelKey] = transform(value as Record<string, unknown>);
          } else {
            result[camelKey] = value;
          }
        }

        return result;
      };

      return Array.isArray(data)
        ? data.map((item) =>
            typeof item === 'object' && item !== null
              ? transform(item as Record<string, unknown>)
              : item,
          )
        : transform(data as Record<string, unknown>);
    },
  } as ResponseTransformer,

  // Transform dates from strings to Date objects
  parseDates: {
    transform: (data: unknown) => {
      if (typeof data !== 'object' || data === null) return data;

      const dateFields = [
        'created_at',
        'updated_at',
        'createdAt',
        'updatedAt',
        'date',
        'timestamp',
      ];
      const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

      const transform = (obj: Record<string, unknown>): Record<string, unknown> => {
        const result: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(obj)) {
          if (dateFields.includes(key) && typeof value === 'string' && dateRegex.test(value)) {
            result[key] = new Date(value);
          } else if (Array.isArray(value)) {
            result[key] = value.map((item) =>
              typeof item === 'object' && item !== null
                ? transform(item as Record<string, unknown>)
                : item,
            );
          } else if (typeof value === 'object' && value !== null) {
            result[key] = transform(value as Record<string, unknown>);
          } else {
            result[key] = value;
          }
        }

        return result;
      };

      return Array.isArray(data)
        ? data.map((item) =>
            typeof item === 'object' && item !== null
              ? transform(item as Record<string, unknown>)
              : item,
          )
        : transform(data as Record<string, unknown>);
    },
  } as ResponseTransformer,

  // Remove null values
  removeNulls: {
    transform: (data: unknown) => {
      if (typeof data !== 'object' || data === null) return data;

      const transform = (obj: Record<string, unknown>): Record<string, unknown> => {
        const result: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(obj)) {
          if (value === null) continue;

          if (Array.isArray(value)) {
            result[key] = value
              .filter((item) => item !== null)
              .map((item) =>
                typeof item === 'object' && item !== null
                  ? transform(item as Record<string, unknown>)
                  : item,
              );
          } else if (typeof value === 'object') {
            result[key] = transform(value as Record<string, unknown>);
          } else {
            result[key] = value;
          }
        }

        return result;
      };

      return Array.isArray(data)
        ? data
            .filter((item) => item !== null)
            .map((item) =>
              typeof item === 'object' && item !== null
                ? transform(item as Record<string, unknown>)
                : item,
            )
        : transform(data as Record<string, unknown>);
    },
  } as ResponseTransformer,
};

// Register common transformers
Object.entries(commonTransformers).forEach(([name, transformer]) => {
  apiResponseHandler.registerTransformer(name, transformer);
});

// Types and enums are already exported above with their declarations

// Default export to satisfy Expo Router (this file should not be a route)
export default function ApiResponseHandlerRouterPlaceholder() {
  return null;
}
