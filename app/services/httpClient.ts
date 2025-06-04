import { z } from 'zod';
import { safeAsyncWithRetry } from '../utils/asyncErrorHandler';
import { logger } from '../utils/logger';
import { captureAPIError, captureNetworkError } from './sentry/globalErrorHandler';
import { validationService } from './validationService';

// HTTP Client Configuration
export interface HttpClientConfig {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  maxRetryDelay?: number;
  retryCondition?: (error: HttpError) => boolean;
  headers?: Record<string, string>;
  validateResponse?: boolean;
}

// HTTP Error Constructor Options
export interface HttpErrorOptions {
  message: string;
  status: number;
  statusText: string;
  url: string;
  method: string;
  response?: Response;
  data?: unknown;
}

// Rate Limit Error Constructor Options
export interface RateLimitErrorOptions extends HttpErrorOptions {
  retryAfter?: number;
}

// HTTP Error Types
export class HttpError extends Error {
  public status: number;
  public statusText: string;
  public url: string;
  public method: string;
  public response?: Response;
  public data?: unknown;

  constructor(options: HttpErrorOptions) {
    super(options.message);
    this.name = 'HttpError';
    this.status = options.status;
    this.statusText = options.statusText;
    this.url = options.url;
    this.method = options.method;
    this.response = options.response;
    this.data = options.data;
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }

  get isNetworkError(): boolean {
    return this.status === 0 || this.status === -1;
  }

  get isRetryable(): boolean {
    // Retry on server errors, network errors, and specific client errors
    return this.isServerError || this.isNetworkError || this.status === 408 || this.status === 429;
  }
}

// Rate Limiting Error
export class RateLimitError extends HttpError {
  public retryAfter?: number;

  constructor(options: RateLimitErrorOptions) {
    super(options);
    this.name = 'RateLimitError';
    this.retryAfter = options.retryAfter;
  }
}

// Request/Response Interceptor Types
export interface RequestInterceptor {
  onRequest?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
  onRequestError?: (error: Error) => Error | Promise<Error>;
}

export interface ResponseInterceptor {
  onResponse?: (
    response: ApiResponse<unknown>,
  ) => ApiResponse<unknown> | Promise<ApiResponse<unknown>>;
  onResponseError?: (error: HttpError) => HttpError | Promise<HttpError>;
}

// Request Configuration
export interface RequestConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retries?: number;
  validateResponse?: boolean;
  schema?: z.ZodSchema<unknown>;
  transformResponse?: (data: unknown) => unknown;
  metadata?: Record<string, unknown>;
}

// Standardized API Response
export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
  method: string;
  timestamp: number;
  duration: number;
  cached?: boolean;
  metadata?: Record<string, unknown>;
}

// Response Cache Entry
interface CacheEntry<T = unknown> {
  data: ApiResponse<T>;
  timestamp: number;
  ttl: number;
  key: string;
}

// HTTP Client Class
export class HttpClient {
  private config: Required<HttpClientConfig>;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private cache = new Map<string, CacheEntry>();
  private rateLimitState = new Map<string, { count: number; resetTime: number }>();

  constructor(config: HttpClientConfig = {}) {
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
      ...config,
    };
  }

  // Add request interceptor
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  // Add response interceptor
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  // Generate cache key
  private generateCacheKey(config: RequestConfig): string {
    const { url, method = 'GET', body } = config;
    const bodyHash = body ? JSON.stringify(body) : '';
    return `${method}:${url}:${bodyHash}`;
  }

  // Check cache
  private getCachedResponse<T>(key: string): ApiResponse<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return { ...entry.data, cached: true } as ApiResponse<T>;
  }

  // Set cache
  private setCachedResponse<T>(key: string, response: ApiResponse<T>, ttl: number = 300000): void {
    this.cache.set(key, {
      data: response,
      timestamp: Date.now(),
      ttl,
      key,
    });
  }

  // Check rate limiting
  private checkRateLimit(url: string): void {
    const domain = new URL(url).hostname;
    const state = this.rateLimitState.get(domain);

    if (state && Date.now() < state.resetTime) {
      throw new RateLimitError({
        message: 'Rate limit exceeded',
        status: 429,
        statusText: 'Too Many Requests',
        url,
        method: 'GET',
        retryAfter: Math.ceil((state.resetTime - Date.now()) / 1000),
      });
    }
  }

  // Update rate limit state
  private updateRateLimit(url: string, response: Response): void {
    const domain = new URL(url).hostname;
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');

    if (remaining === '0' && reset) {
      const resetTime = parseInt(reset) * 1000;
      this.rateLimitState.set(domain, {
        count: 0,
        resetTime,
      });
    }
  }

  // Apply request interceptors
  private async applyRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
    let processedConfig = config;

    for (const interceptor of this.requestInterceptors) {
      if (interceptor.onRequest) {
        try {
          processedConfig = await interceptor.onRequest(processedConfig);
        } catch (error) {
          if (interceptor.onRequestError) {
            throw await interceptor.onRequestError(error as Error);
          }
          throw error;
        }
      }
    }

    return processedConfig;
  }

  // Apply response interceptors
  private async applyResponseInterceptors<T>(response: ApiResponse<T>): Promise<ApiResponse<T>> {
    let processedResponse = response;

    for (const interceptor of this.responseInterceptors) {
      if (interceptor.onResponse) {
        try {
          processedResponse = (await interceptor.onResponse(processedResponse)) as ApiResponse<T>;
        } catch (error) {
          if (interceptor.onResponseError) {
            throw await interceptor.onResponseError(error as HttpError);
          }
          throw error;
        }
      }
    }

    return processedResponse;
  }

  // Transform headers
  private transformHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  // Validate response data
  private validateResponseData<T>(data: unknown, schema?: z.ZodSchema<T>, endpoint?: string): T {
    if (schema) {
      return validationService.validateApiResponse(schema, data, endpoint);
    }
    return data as T;
  }

  // Handle cached response for GET requests
  private handleCachedResponse<T>(
    config: RequestConfig,
    fullUrl: string,
    method: string,
  ): ApiResponse<T> | null {
    if (method === 'GET') {
      const cacheKey = this.generateCacheKey(config);
      const cached = this.getCachedResponse<T>(cacheKey);
      if (cached) {
        logger.info('Using cached API response', {
          context: { url: fullUrl, method, cached: true },
        });
        return cached;
      }
    }
    return null;
  }

  // Prepare request configuration
  private prepareRequestInit(config: RequestConfig, method: string): RequestInit {
    const requestInit: RequestInit = {
      method,
      headers: {
        ...this.config.headers,
        ...config.headers,
      },
      signal: this.createTimeoutSignal(config.timeout || this.config.timeout),
    };

    if (config.body && method !== 'GET') {
      requestInit.body =
        typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
    }

    return requestInit;
  }

  // Create a timeout signal compatible with React Native
  // Note: AbortSignal.timeout() is not available in React Native, so we use AbortController
  private createTimeoutSignal(timeout: number): AbortSignal {
    const controller = new AbortController();

    // Set timeout to abort the request
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    // Clean up timeout if request completes normally
    const originalSignal = controller.signal;
    const cleanup = () => clearTimeout(timeoutId);

    // Add cleanup listener
    originalSignal.addEventListener('abort', cleanup, { once: true });

    return originalSignal;
  }

  // Handle HTTP response errors
  private async handleHttpError(
    response: Response,
    fullUrl: string,
    method: string,
  ): Promise<void> {
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '60');
      throw new RateLimitError({
        message: 'Rate limit exceeded',
        status: 429,
        statusText: 'Too Many Requests',
        url: fullUrl,
        method,
        retryAfter,
        response,
      });
    }

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }

      const error = new HttpError({
        message: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
        statusText: response.statusText,
        url: fullUrl,
        method,
        response,
        data: errorData,
      });

      captureAPIError(error, fullUrl, 'HttpClient');
      throw error;
    }
  }

  // Parse response data based on content type
  private async parseResponseData(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return await response.json();
    } else if (contentType.includes('text/')) {
      return await response.text();
    } else {
      return await response.blob();
    }
  }

  // Process and validate response data
  private processResponseData<T>(responseData: unknown, config: RequestConfig, fullUrl: string): T {
    let processedData = responseData;

    // Transform response if needed
    if (config.transformResponse) {
      processedData = config.transformResponse(processedData);
    }

    // Validate response data
    if (config.validateResponse !== false && this.config.validateResponse) {
      processedData = this.validateResponseData(processedData, config.schema, fullUrl);
    }

    return processedData as T;
  }

  // Create API response object
  private createApiResponse<T>(
    responseData: T,
    response: Response,
    fullUrl: string,
    method: string,
    startTime: number,
    config: RequestConfig,
  ): ApiResponse<T> {
    return {
      data: responseData,
      status: response.status,
      statusText: response.statusText,
      headers: this.transformHeaders(response.headers),
      url: fullUrl,
      method,
      timestamp: Date.now(),
      duration: Date.now() - startTime,
      metadata: config.metadata,
    };
  }

  // Handle caching for GET responses
  private handleResponseCaching<T>(
    method: string,
    config: RequestConfig,
    apiResponse: ApiResponse<T>,
  ): void {
    if (method === 'GET') {
      const cacheKey = this.generateCacheKey(config);
      this.setCachedResponse(cacheKey, apiResponse);
    }
  }

  // Handle network errors
  private handleNetworkError(
    error: unknown,
    fullUrl: string,
    method: string,
    startTime: number,
  ): never {
    const duration = Date.now() - startTime;

    if (error instanceof HttpError || error instanceof RateLimitError) {
      throw error;
    }

    // Check if error is due to request timeout (AbortError)
    const isTimeoutError =
      error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'));

    const errorMessage = isTimeoutError
      ? `Request timeout after ${duration}ms`
      : `Network error: ${error instanceof Error ? error.message : String(error)}`;

    const statusText = isTimeoutError ? 'Request Timeout' : 'Network Error';
    const status = isTimeoutError ? 408 : 0;

    // Handle network errors
    const networkError = new HttpError({
      message: errorMessage,
      status,
      statusText,
      url: fullUrl,
      method,
    });

    captureNetworkError(networkError, fullUrl, method);

    logger.error('Network request failed', networkError, {
      context: { url: fullUrl, method, duration, isTimeout: isTimeoutError },
    });

    throw networkError;
  }

  // Main execution method (refactored for reduced complexity)
  private async executeRequest<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    const fullUrl = config.url.startsWith('http')
      ? config.url
      : `${this.config.baseURL}${config.url}`;
    const method = config.method || 'GET';

    // Check rate limiting
    this.checkRateLimit(fullUrl);

    // Check cache for GET requests
    const cachedResponse = this.handleCachedResponse<T>(config, fullUrl, method);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Prepare request
    const requestInit = this.prepareRequestInit(config, method);

    try {
      const response = await fetch(fullUrl, requestInit);
      const duration = Date.now() - startTime;

      // Update rate limit state
      this.updateRateLimit(fullUrl, response);

      // Handle HTTP errors
      await this.handleHttpError(response, fullUrl, method);

      // Parse response data
      const responseData = await this.parseResponseData(response);

      // Process and validate response data
      const processedData = this.processResponseData<T>(responseData, config, fullUrl);

      // Create API response
      const apiResponse = this.createApiResponse(
        processedData,
        response,
        fullUrl,
        method,
        startTime,
        config,
      );

      // Handle caching
      this.handleResponseCaching(method, config, apiResponse);

      logger.info('API request completed successfully', {
        context: { url: fullUrl, method, status: response.status, duration },
      });

      return apiResponse;
    } catch (error) {
      this.handleNetworkError(error, fullUrl, method, startTime);
    }
  }

  // Main request method with retry logic
  async request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    // Apply request interceptors
    const processedConfig = await this.applyRequestInterceptors(config);

    // Execute request with retry logic
    const response = await safeAsyncWithRetry(() => this.executeRequest<T>(processedConfig), {
      maxRetries: processedConfig.retries || this.config.retries,
      initialDelay: this.config.retryDelay,
      maxDelay: this.config.maxRetryDelay,
      shouldRetry: (error: unknown) => {
        if (error instanceof HttpError) {
          return this.config.retryCondition(error);
        }
        return false;
      },
      errorPrefix: 'HTTP request failed',
      context: { url: processedConfig.url, method: processedConfig.method },
      rethrow: true,
    });

    if (!response) {
      throw new Error('Request failed after all retries');
    }

    // Apply response interceptors
    return this.applyResponseInterceptors(response);
  }

  // Convenience methods
  async get<T>(url: string, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'GET' });
  }

  async post<T>(
    url: string,
    body?: unknown,
    config?: Partial<RequestConfig>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'POST', body });
  }

  async put<T>(
    url: string,
    body?: unknown,
    config?: Partial<RequestConfig>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'PUT', body });
  }

  async patch<T>(
    url: string,
    body?: unknown,
    config?: Partial<RequestConfig>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'PATCH', body });
  }

  async delete<T>(url: string, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: 'DELETE' });
  }

  // Cache management
  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

// Default HTTP client instance
export const httpClient = new HttpClient();

// Types and classes are already exported above with their declarations

// Default export to satisfy Expo Router (this file should not be a route)
export default function HttpClientRouterPlaceholder() {
  return null;
}
