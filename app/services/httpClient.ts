import { z } from 'zod';
import * as Sentry from '@sentry/react-native';
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
  private pendingRequests = new Map<string, Promise<ApiResponse<unknown>>>();
  private sentryBreadcrumbThrottle = new Map<string, number>();

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

    // Initialize Sentry monitoring for HTTP client
    Sentry.addBreadcrumb({
      message: 'HTTP Client initialized',
      category: 'http.client',
      level: 'info',
      data: {
        baseURL: this.config.baseURL,
        timeout: this.config.timeout,
        retries: this.config.retries,
      },
    });
  }

  // Throttle Sentry breadcrumbs to prevent spam
  private shouldAddSentryBreadcrumb(key: string, throttleMs: number = 1000): boolean {
    const now = Date.now();
    const lastTime = this.sentryBreadcrumbThrottle.get(key) || 0;

    if (now - lastTime > throttleMs) {
      this.sentryBreadcrumbThrottle.set(key, now);
      return true;
    }

    return false;
  }

  // Generate request deduplication key
  private generateRequestKey(config: RequestConfig): string {
    const { url, method = 'GET', body } = config;
    const bodyHash = body ? JSON.stringify(body) : '';
    return `${method}:${url}:${bodyHash}`;
  }

  // Check for pending duplicate requests
  private getPendingRequest<T>(key: string): Promise<ApiResponse<T>> | null {
    const pending = this.pendingRequests.get(key);
    return pending as Promise<ApiResponse<T>> | null;
  }

  // Set pending request
  private setPendingRequest<T>(key: string, promise: Promise<ApiResponse<T>>): void {
    this.pendingRequests.set(key, promise as Promise<ApiResponse<unknown>>);

    // Clean up after request completes
    promise.finally(() => {
      this.pendingRequests.delete(key);
    });
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

  // Apply request interceptors with Sentry monitoring
  private async applyRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
    let processedConfig = config;

    Sentry.addBreadcrumb({
      message: 'Applying request interceptors',
      category: 'http.interceptor',
      level: 'debug',
      data: {
        interceptorCount: this.requestInterceptors.length,
        url: config.url,
        method: config.method,
      },
    });

    for (const interceptor of this.requestInterceptors) {
      if (interceptor.onRequest) {
        try {
          processedConfig = await interceptor.onRequest(processedConfig);
        } catch (error) {
          Sentry.withScope((scope) => {
            scope.setTag('error.type', 'request_interceptor_error');
            scope.setLevel('warning');
            scope.setContext('interceptor_error', {
              url: config.url,
              method: config.method,
              interceptorType: 'request',
            });
            Sentry.captureException(error);
          });

          if (interceptor.onRequestError) {
            throw await interceptor.onRequestError(error as Error);
          }
          throw error;
        }
      }
    }

    return processedConfig;
  }

  // Apply response interceptors with Sentry monitoring
  private async applyResponseInterceptors<T>(response: ApiResponse<T>): Promise<ApiResponse<T>> {
    let processedResponse = response;

    Sentry.addBreadcrumb({
      message: 'Applying response interceptors',
      category: 'http.interceptor',
      level: 'debug',
      data: {
        interceptorCount: this.responseInterceptors.length,
        url: response.url,
        method: response.method,
        status: response.status,
      },
    });

    for (const interceptor of this.responseInterceptors) {
      if (interceptor.onResponse) {
        try {
          processedResponse = (await interceptor.onResponse(processedResponse)) as ApiResponse<T>;
        } catch (error) {
          Sentry.withScope((scope) => {
            scope.setTag('error.type', 'response_interceptor_error');
            scope.setLevel('warning');
            scope.setContext('interceptor_error', {
              url: response.url,
              method: response.method,
              status: response.status,
              interceptorType: 'response',
            });
            Sentry.captureException(error);
          });

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
        // Throttle cache hit breadcrumbs
        const cacheHitKey = `cache_hit:${fullUrl}`;
        if (this.shouldAddSentryBreadcrumb(cacheHitKey, 5000)) {
          logger.info('Using cached API response', {
            context: { url: fullUrl, method, cached: true },
          });
        }
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

    // Enhanced Sentry error capture for network errors
    Sentry.withScope((scope) => {
      scope.setTag('error.type', 'network_error');
      scope.setTag('http.method', method);
      scope.setTag('network.timeout', isTimeoutError.toString());
      scope.setLevel('error');

      scope.setContext('network_error', {
        url: fullUrl,
        method,
        duration,
        isTimeout: isTimeoutError,
        originalError: error instanceof Error ? error.message : String(error),
      });

      Sentry.captureException(networkError);
    });

    Sentry.addBreadcrumb({
      message: `Network error for HTTP ${method}`,
      category: 'http.network_error',
      level: 'error',
      data: {
        url: fullUrl,
        method,
        duration,
        isTimeout: isTimeoutError,
        errorMessage,
      },
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

    // Add Sentry context and monitoring (throttled)
    this.addSentryContext(config, method, fullUrl);
    this.addSentryPerformanceContext(method, fullUrl, startTime);

    // Check rate limiting
    this.checkRateLimit(fullUrl);

    // Check cache for GET requests
    const cachedResponse = this.handleCachedResponse<T>(config, fullUrl, method);
    if (cachedResponse) {
      // Track cached response in Sentry (throttled)
      const cacheKey = `cache_served:${method}:${fullUrl}`;
      if (this.shouldAddSentryBreadcrumb(cacheKey, 3000)) {
        Sentry.addBreadcrumb({
          message: `HTTP ${method} served from cache`,
          category: 'http.cache',
          level: 'info',
          data: {
            url: fullUrl,
            method,
            cached: true,
          },
        });
      }
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

      // Complete Sentry performance tracking (throttled)
      this.finishSentryPerformanceTracking(apiResponse);

      // Throttle success logging
      const successLogKey = `success_log:${fullUrl}`;
      if (this.shouldAddSentryBreadcrumb(successLogKey, 2000)) {
        logger.info('API request completed successfully', {
          context: { url: fullUrl, method, status: response.status, duration },
        });
      }

      return apiResponse;
    } catch (error) {
      // Enhanced error handling with Sentry (throttled)
      if (error instanceof HttpError) {
        this.captureSentryError(error, {
          duration: Date.now() - startTime,
          requestConfig: {
            timeout: config.timeout || this.config.timeout,
            retries: config.retries || this.config.retries,
            validateResponse: config.validateResponse,
          },
        });
        this.finishSentryPerformanceTracking({} as ApiResponse<T>, error);
      }

      this.handleNetworkError(error, fullUrl, method, startTime);
    }
  }

  // Main request method with retry logic
  async request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    const requestId = Math.random().toString(36).substring(7);
    const requestKey = this.generateRequestKey(config);

    // Check for pending duplicate requests (deduplication)
    const pendingRequest = this.getPendingRequest<T>(requestKey);
    if (pendingRequest) {
      // Return the existing pending request instead of making a new one
      if (this.shouldAddSentryBreadcrumb(`dedup:${requestKey}`, 5000)) {
        Sentry.addBreadcrumb({
          message: 'HTTP request deduplicated',
          category: 'http.deduplication',
          level: 'debug',
          data: {
            requestId,
            url: config.url,
            method: config.method || 'GET',
          },
        });
      }
      return pendingRequest;
    }

    // Throttle Sentry breadcrumbs for request initiation
    if (this.shouldAddSentryBreadcrumb(`start:${requestKey}`, 1000)) {
      Sentry.addBreadcrumb({
        message: 'HTTP request initiated',
        category: 'http.request.start',
        level: 'info',
        data: {
          requestId,
          url: config.url,
          method: config.method || 'GET',
          hasBody: !!config.body,
          retries: config.retries || this.config.retries,
        },
      });
    }

    Sentry.setContext('http_request_config', {
      requestId,
      url: config.url,
      method: config.method || 'GET',
      timeout: config.timeout || this.config.timeout,
      retries: config.retries || this.config.retries,
      validateResponse: config.validateResponse,
    });

    // Create the request promise
    const requestPromise = this.executeRequestWithRetry<T>(config, requestId);

    // Store the pending request for deduplication
    this.setPendingRequest(requestKey, requestPromise);

    return requestPromise;
  }

  // Separate method for executing request with retry logic
  private async executeRequestWithRetry<T>(
    config: RequestConfig,
    requestId: string,
  ): Promise<ApiResponse<T>> {
    try {
      // Apply request interceptors
      const processedConfig = await this.applyRequestInterceptors(config);

      // Execute request with retry logic
      const response = await safeAsyncWithRetry(() => this.executeRequest<T>(processedConfig), {
        maxRetries: processedConfig.retries || this.config.retries,
        initialDelay: this.config.retryDelay,
        maxDelay: this.config.maxRetryDelay,
        shouldRetry: (error: unknown) => {
          if (error instanceof HttpError) {
            const shouldRetry = this.config.retryCondition(error);

            // Throttle retry decision breadcrumbs
            const retryKey = `retry:${processedConfig.url}:${error.status}`;
            if (this.shouldAddSentryBreadcrumb(retryKey, 3000)) {
              Sentry.addBreadcrumb({
                message: `HTTP request retry decision: ${shouldRetry ? 'retry' : 'no retry'}`,
                category: 'http.retry',
                level: 'info',
                data: {
                  requestId,
                  url: processedConfig.url,
                  method: processedConfig.method,
                  status: error.status,
                  shouldRetry,
                  isRetryable: error.isRetryable,
                },
              });
            }

            return shouldRetry;
          }
          return false;
        },
        errorPrefix: 'HTTP request failed',
        context: { requestId, url: processedConfig.url, method: processedConfig.method },
        rethrow: true,
      });

      if (!response) {
        const error = new Error('Request failed after all retries');
        Sentry.withScope((scope) => {
          scope.setTag('error.type', 'request_exhausted');
          scope.setLevel('error');
          scope.setContext('retry_exhausted', {
            requestId,
            url: processedConfig.url,
            method: processedConfig.method,
            maxRetries: processedConfig.retries || this.config.retries,
          });
          Sentry.captureException(error);
        });
        throw error;
      }

      // Apply response interceptors
      const finalResponse = await this.applyResponseInterceptors(response);

      // Throttle success breadcrumbs
      const successKey = `success:${finalResponse.url}`;
      if (this.shouldAddSentryBreadcrumb(successKey, 2000)) {
        Sentry.addBreadcrumb({
          message: 'HTTP request completed successfully',
          category: 'http.request.success',
          level: 'info',
          data: {
            requestId,
            url: finalResponse.url,
            method: finalResponse.method,
            status: finalResponse.status,
            duration: finalResponse.duration,
            cached: finalResponse.cached,
          },
        });
      }

      return finalResponse;
    } catch (error) {
      Sentry.withScope((scope) => {
        scope.setTag('error.type', 'request_failed');
        scope.setLevel('error');
        scope.setContext('request_failure', {
          requestId,
          url: config.url,
          method: config.method || 'GET',
          error: error instanceof Error ? error.message : String(error),
        });
        Sentry.captureException(error);
      });

      // Throttle error breadcrumbs
      const errorKey = `request_error:${config.url}`;
      if (this.shouldAddSentryBreadcrumb(errorKey, 5000)) {
        Sentry.addBreadcrumb({
          message: 'HTTP request failed',
          category: 'http.request.error',
          level: 'error',
          data: {
            requestId,
            url: config.url,
            method: config.method || 'GET',
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }

      throw error;
    }
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

  // Cache management with Sentry monitoring
  clearCache(): void {
    const cacheSize = this.cache.size;
    this.cache.clear();

    // Clear throttle maps as well
    this.sentryBreadcrumbThrottle.clear();

    Sentry.addBreadcrumb({
      message: 'HTTP cache cleared',
      category: 'http.cache',
      level: 'info',
      data: {
        previousSize: cacheSize,
        currentSize: 0,
      },
    });
  }

  getCacheSize(): number {
    const size = this.cache.size;

    // Throttle cache size breadcrumbs
    if (this.shouldAddSentryBreadcrumb('cache_size_check', 10000)) {
      Sentry.addBreadcrumb({
        message: 'HTTP cache size requested',
        category: 'http.cache',
        level: 'debug',
        data: {
          size,
        },
      });
    }

    return size;
  }

  getCacheStats(): { size: number; entries: string[] } {
    const stats = {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };

    // Throttle cache stats breadcrumbs
    if (this.shouldAddSentryBreadcrumb('cache_stats_check', 15000)) {
      Sentry.addBreadcrumb({
        message: 'HTTP cache stats requested',
        category: 'http.cache',
        level: 'debug',
        data: {
          size: stats.size,
          entryCount: stats.entries.length,
        },
      });
    }

    return stats;
  }

  // Track HTTP performance with Sentry
  private addSentryPerformanceContext(method: string, url: string, startTime: number): void {
    Sentry.setContext('http_performance', {
      url,
      method,
      startTime,
      'http.method': method,
      'http.url': url,
    });
  }

  // Complete Sentry performance tracking
  private finishSentryPerformanceTracking(response: ApiResponse<unknown>, error?: HttpError): void {
    if (error) {
      Sentry.setContext('http_error_response', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
      });
    } else {
      Sentry.setContext('http_success_response', {
        status: response.status,
        statusText: response.statusText,
        duration: response.duration,
        cached: response.cached,
      });

      Sentry.addBreadcrumb({
        message: `HTTP ${response.method} completed successfully`,
        category: 'http.response',
        level: 'info',
        data: {
          url: response.url,
          status: response.status,
          duration: response.duration,
          cached: response.cached,
        },
      });
    }
  }

  // Add Sentry context for HTTP requests
  private addSentryContext(config: RequestConfig, method: string, fullUrl: string): void {
    const contextKey = `${method}:${fullUrl}`;

    // Only add context if not throttled
    if (this.shouldAddSentryBreadcrumb(contextKey, 2000)) {
      Sentry.setContext('http_request', {
        url: fullUrl,
        method,
        headers: config.headers,
        timeout: config.timeout || this.config.timeout,
        retries: config.retries || this.config.retries,
      });

      Sentry.addBreadcrumb({
        message: `HTTP ${method} request initiated`,
        category: 'http.request',
        level: 'info',
        data: {
          url: fullUrl,
          method,
          hasBody: !!config.body,
          validateResponse: config.validateResponse,
        },
      });
    }
  }

  // Capture HTTP errors with Sentry (with throttling)
  private captureSentryError(error: HttpError, context: Record<string, unknown>): void {
    const errorKey = `error:${error.method}:${error.url}:${error.status}`;

    // Always capture errors, but throttle breadcrumbs
    Sentry.withScope((scope) => {
      scope.setTag('error.type', 'http_error');
      scope.setTag('http.status_code', error.status.toString());
      scope.setTag('http.method', error.method);
      scope.setLevel('error');

      scope.setContext('http_error', {
        url: error.url,
        method: error.method,
        status: error.status,
        statusText: error.statusText,
        isClientError: error.isClientError,
        isServerError: error.isServerError,
        isNetworkError: error.isNetworkError,
        isRetryable: error.isRetryable,
        ...context,
      } as Record<string, unknown>);

      if (error.data) {
        scope.setContext('response_data', error.data as Record<string, unknown>);
      }

      Sentry.captureException(error);
    });

    // Throttle breadcrumbs for repeated errors
    if (this.shouldAddSentryBreadcrumb(errorKey, 5000)) {
      Sentry.addBreadcrumb({
        message: `HTTP ${error.method} failed`,
        category: 'http.error',
        level: 'error',
        data: {
          url: error.url,
          status: error.status,
          statusText: error.statusText,
          message: error.message,
        },
      });
    }
  }
}

// Default HTTP client instance
export const httpClient = new HttpClient();

// Types and classes are already exported above with their declarations

// Default export to satisfy Expo Router (this file should not be a route)
export default function HttpClientRouterPlaceholder() {
  return null;
}
