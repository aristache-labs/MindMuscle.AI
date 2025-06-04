import { z } from 'zod';
import { logger } from '../utils/logger';
import {
  ApiErrorCategory,
  apiResponseHandler,
  ProcessedApiResponse,
  ResponseProcessingOptions,
} from './apiResponseHandler';
import { CachePriority, enhancedCacheManager } from './enhancedCacheManager';
import {
  HttpClient,
  HttpClientConfig,
  HttpError,
  RateLimitError,
  RequestConfig,
} from './httpClient';
import supabase from './supabase';

// API client configuration
export interface ApiClientConfig extends HttpClientConfig {
  enableCaching?: boolean;
  enableResponseProcessing?: boolean;
  enableAuthentication?: boolean;
  enableRateLimiting?: boolean;
  defaultCacheTtl?: number;
  defaultCachePriority?: CachePriority;
}

// Request options for API client
export interface ApiRequestOptions extends Partial<RequestConfig> {
  cache?: {
    enabled?: boolean;
    key?: string;
    ttl?: number;
    tags?: string[];
    priority?: CachePriority;
  };
  processing?: ResponseProcessingOptions;
  auth?: {
    required?: boolean;
    token?: string;
  };
  rateLimit?: {
    enabled?: boolean;
    key?: string;
  };
}

// API client response
export interface ApiClientResponse<T = unknown> extends ProcessedApiResponse<T> {
  fromCache: boolean;
  rateLimited: boolean;
  authenticated: boolean;
}

export class ApiClient {
  private httpClient: HttpClient;
  private config: Required<ApiClientConfig>;
  private authToken?: string;

  constructor(config: ApiClientConfig = {}) {
    this.config = {
      baseURL: '',
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      maxRetryDelay: 10000,
      retryCondition: (error: HttpError) => error.isRetryable,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      validateResponse: true,
      enableCaching: true,
      enableResponseProcessing: true,
      enableAuthentication: true,
      enableRateLimiting: true,
      defaultCacheTtl: 300000, // 5 minutes
      defaultCachePriority: CachePriority.NORMAL,
      ...config,
    };

    this.httpClient = new HttpClient(this.config);
    this.setupInterceptors();
    this.initializeAuth();
  }

  // Initialize authentication
  private async initializeAuth(): Promise<void> {
    if (!this.config.enableAuthentication) {
      logger.debug('API client authentication disabled');
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        this.setAuthToken(session.access_token);
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange((event, session) => {
        if (session?.access_token) {
          this.setAuthToken(session.access_token);
        } else {
          this.clearAuthToken();
        }
      });
    } catch (error) {
      logger.warn('Failed to initialize authentication', {
        context: { error: (error as Error).message },
      });
    }
  }

  // Set authentication token
  setAuthToken(token: string): void {
    this.authToken = token;
    logger.debug('Auth token set');
  }

  // Clear authentication token
  clearAuthToken(): void {
    this.authToken = undefined;
    logger.debug('Auth token cleared');
  }

  // Setup request/response interceptors
  private setupInterceptors(): void {
    // Only setup interceptors if authentication is enabled
    if (!this.config.enableAuthentication) {
      return;
    }

    // Request interceptor for authentication
    this.httpClient.addRequestInterceptor({
      onRequest: async (config) => {
        // Always add auth token if available for Supabase requests
        if (this.config.enableAuthentication && this.authToken) {
          config.headers = {
            ...config.headers,
            Authorization: `Bearer ${this.authToken}`,
          };
        }
        return config;
      },
    });

    // Response interceptor for error handling
    this.httpClient.addResponseInterceptor({
      onResponseError: async (error) => {
        if (error.status === 401 && this.config.enableAuthentication) {
          // Token might be expired, try to refresh
          await this.handleAuthError();
        }
        return error;
      },
    });
  }

  // Handle authentication errors
  private async handleAuthError(): Promise<void> {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.refreshSession();
      if (error) throw error;

      if (session?.access_token) {
        this.setAuthToken(session.access_token);
        logger.info('Auth token refreshed successfully');
      } else {
        this.clearAuthToken();
        logger.warn('Failed to refresh auth token');
      }
    } catch (error) {
      logger.error('Auth token refresh failed', error as Error);
      this.clearAuthToken();
    }
  }

  // Generate cache key
  private generateCacheKey(config: RequestConfig, options: ApiRequestOptions): string {
    if (options.cache?.key) {
      return options.cache.key;
    }

    const { url, method = 'GET', body } = config;
    const bodyHash = body ? JSON.stringify(body) : '';
    const authHash = this.authToken ? this.authToken.slice(-8) : 'anonymous';

    return `api:${method}:${url}:${bodyHash}:${authHash}`;
  }

  // Check cache for response
  private async checkCache<T>(cacheKey: string): Promise<ApiClientResponse<T> | null> {
    if (!this.config.enableCaching) return null;

    const cached = await enhancedCacheManager.get<ProcessedApiResponse<T>>(cacheKey);
    if (!cached) return null;

    return {
      ...cached,
      fromCache: true,
      rateLimited: false,
      authenticated: !!this.authToken,
    };
  }

  // Cache response
  private async cacheResponse<T>(
    cacheKey: string,
    response: ProcessedApiResponse<T>,
    options: ApiRequestOptions,
  ): Promise<void> {
    if (!this.config.enableCaching || !options.cache?.enabled) return;

    const {
      ttl = this.config.defaultCacheTtl,
      tags = [],
      priority = this.config.defaultCachePriority,
    } = options.cache;

    await enhancedCacheManager.set(cacheKey, response, {
      ttl,
      tags,
      priority,
    });
  }

  // Main request method
  async request<T>(
    config: RequestConfig,
    options: ApiRequestOptions = {},
  ): Promise<ApiClientResponse<T>> {
    const startTime = Date.now();

    // Generate cache key
    const cacheKey = this.generateCacheKey(config, options);

    // Check cache first
    if (options.cache?.enabled !== false) {
      const cached = await this.checkCache<T>(cacheKey);
      if (cached) {
        logger.debug('API response served from cache', {
          context: { url: config.url, cacheKey },
        });
        return cached;
      }
    }

    // Note: Authentication is optional for most Supabase endpoints
    // The anon key is always sent, and auth token is added when available

    try {
      // Attach request options to config for interceptor access
      const configWithOptions = {
        ...config,
        requestOptions: options,
      };

      // Make HTTP request
      const response = await this.httpClient.request<unknown>(configWithOptions);

      // Process response if enabled
      let processedResponse: ProcessedApiResponse<T>;

      if (this.config.enableResponseProcessing && options.processing) {
        processedResponse = await apiResponseHandler.processResponse<T>(
          response,
          options.processing,
        );
      } else {
        processedResponse = {
          ...response,
          data: response.data as T,
          processed: true,
          transformations: [],
          validationPassed: true,
        };
      }

      // Create API client response
      const apiClientResponse: ApiClientResponse<T> = {
        ...processedResponse,
        fromCache: false,
        rateLimited: false,
        authenticated: !!this.authToken,
      };

      // Cache response
      await this.cacheResponse(cacheKey, processedResponse, options);

      logger.info('API request completed successfully', {
        context: {
          url: config.url,
          method: config.method,
          duration: Date.now() - startTime,
          fromCache: false,
        },
      });

      return apiClientResponse;
    } catch (error) {
      // Handle rate limiting
      if (error instanceof RateLimitError) {
        logger.warn('API request rate limited', {
          context: {
            url: config.url,
            retryAfter: error.retryAfter,
          },
        });

        // Return rate limited response
        return {
          data: null as T,
          status: 429,
          statusText: 'Too Many Requests',
          headers: {},
          url: config.url,
          method: config.method || 'GET',
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          processed: true,
          transformations: [],
          validationPassed: false,
          fromCache: false,
          rateLimited: true,
          authenticated: !!this.authToken,
          errorCategory: ApiErrorCategory.RATE_LIMIT,
          retryable: true,
        };
      }

      // Re-throw other errors
      throw error;
    }
  }

  // Convenience methods with enhanced options
  async get<T>(url: string, options: ApiRequestOptions = {}): Promise<ApiClientResponse<T>> {
    return this.request<T>(
      { url, method: 'GET' },
      {
        cache: { enabled: true, ...options.cache },
        ...options,
      },
    );
  }

  async post<T>(
    url: string,
    body?: unknown,
    options: ApiRequestOptions = {},
  ): Promise<ApiClientResponse<T>> {
    return this.request<T>(
      { url, method: 'POST', body },
      {
        cache: { enabled: false, ...options.cache },
        ...options,
      },
    );
  }

  async put<T>(
    url: string,
    body?: unknown,
    options: ApiRequestOptions = {},
  ): Promise<ApiClientResponse<T>> {
    return this.request<T>(
      { url, method: 'PUT', body },
      {
        cache: { enabled: false, ...options.cache },
        ...options,
      },
    );
  }

  async patch<T>(
    url: string,
    body?: unknown,
    options: ApiRequestOptions = {},
  ): Promise<ApiClientResponse<T>> {
    return this.request<T>(
      { url, method: 'PATCH', body },
      {
        cache: { enabled: false, ...options.cache },
        ...options,
      },
    );
  }

  async delete<T>(url: string, options: ApiRequestOptions = {}): Promise<ApiClientResponse<T>> {
    return this.request<T>(
      { url, method: 'DELETE' },
      {
        cache: { enabled: false, ...options.cache },
        ...options,
      },
    );
  }

  // Validated request with schema
  async requestWithValidation<T>(
    config: RequestConfig,
    schema: z.ZodSchema<T>,
    options: ApiRequestOptions = {},
  ): Promise<ApiClientResponse<T>> {
    const enhancedOptions: ApiRequestOptions = {
      ...options,
      processing: {
        validateSchema: schema,
        ...options.processing,
      },
    };

    return this.request<T>(config, enhancedOptions);
  }

  // Batch requests
  async batchRequests<T>(
    requests: Array<{ config: RequestConfig; options?: ApiRequestOptions }>,
    options: {
      concurrency?: number;
      failFast?: boolean;
    } = {},
  ): Promise<Array<ApiClientResponse<T> | Error>> {
    const { concurrency = 5, failFast = false } = options;
    const results: Array<ApiClientResponse<T> | Error> = [];

    // Process requests in batches
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);

      const batchPromises = batch.map(async ({ config, options: requestOptions }) => {
        try {
          return await this.request<T>(config, requestOptions);
        } catch (error) {
          if (failFast) throw error;
          return error as Error;
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          if (failFast) throw result.reason;
          results.push(result.reason);
        }
      }
    }

    return results;
  }

  // Cache management methods
  async invalidateCache(pattern?: RegExp | string[]): Promise<number> {
    if (Array.isArray(pattern)) {
      return enhancedCacheManager.invalidateByTags(pattern);
    } else if (pattern instanceof RegExp) {
      return enhancedCacheManager.invalidateByPattern(pattern);
    } else {
      await enhancedCacheManager.clear();
      return 0;
    }
  }

  // Get cache statistics
  getCacheStats() {
    return enhancedCacheManager.getStats();
  }

  // Get HTTP client statistics
  getHttpStats() {
    return this.httpClient.getCacheStats();
  }

  // Configure cache warming
  configureCacheWarming(strategies: string[]) {
    enhancedCacheManager.configureCacheWarming({
      enabled: true,
      strategies,
    });
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: Record<string, unknown>;
  }> {
    try {
      const startTime = Date.now();

      // Make a simple request to check connectivity
      await this.get('/health', {
        cache: { enabled: false },
        auth: { required: false },
      });

      const responseTime = Date.now() - startTime;
      const cacheStats = this.getCacheStats();

      return {
        status: 'healthy',
        details: {
          responseTime,
          authenticated: !!this.authToken,
          cacheHitRate: cacheStats.hitRate,
          cacheSize: cacheStats.totalEntries,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: (error as Error).message,
          authenticated: !!this.authToken,
        },
      };
    }
  }
}

// Default API client instance configured for Supabase
export const apiClient = new ApiClient({
  baseURL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    'X-Client-Info': 'mindmuscle-ai-react-native',
  },
  enableCaching: true,
  enableResponseProcessing: false, // Disable for now to avoid transformation issues
  enableAuthentication: false, // Disable to avoid conflicts with existing Supabase auth
  enableRateLimiting: false,
});

// Types are already exported above with their interface declarations

// Default export to satisfy Expo Router (this file should not be a route)
export default function ApiClientRouterPlaceholder() {
  return null;
}
