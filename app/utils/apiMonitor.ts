/* eslint-disable @typescript-eslint/no-explicit-any */
declare const Reactotron: any;

interface ApiRequest {
  url: string;
  method: string;
  data?: any;
  headers?: Record<string, string>;
}

interface ApiResponse {
  status: number;
  data?: any;
  error?: any;
  duration: number;
}

// API Monitor for Reactotron
class ApiMonitor {
  private isReactotronAvailable(): boolean {
    return __DEV__ && typeof Reactotron !== 'undefined' && Reactotron.apisauce;
  }

  // Monitor Supabase operations
  monitorSupabaseCall = async <T>(
    operation: string,
    table: string,
    query: () => Promise<T>,
    params?: any,
  ): Promise<T> => {
    const startTime = Date.now();
    const request: ApiRequest = {
      url: `supabase://${table}`,
      method: operation.toUpperCase(),
      data: params,
    };

    try {
      const result = await query();
      const duration = Date.now() - startTime;

      if (this.isReactotronAvailable()) {
        const response: ApiResponse = {
          status: 200,
          data: result,
          duration,
        };
        Reactotron.apisauce({ request, response, duration });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (this.isReactotronAvailable()) {
        const response: ApiResponse = {
          status: 500,
          error: error,
          duration,
        };
        Reactotron.apisauce({ request, response, duration });
      }

      throw error;
    }
  };

  // Monitor OpenAI API calls
  monitorOpenAICall = async <T>(
    endpoint: string,
    operation: () => Promise<T>,
    params?: any,
  ): Promise<T> => {
    const startTime = Date.now();
    const request: ApiRequest = {
      url: `openai://api/${endpoint}`,
      method: 'POST',
      data: params,
    };

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      if (this.isReactotronAvailable()) {
        const response: ApiResponse = {
          status: 200,
          data: result,
          duration,
        };
        Reactotron.apisauce({ request, response, duration });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (this.isReactotronAvailable()) {
        const response: ApiResponse = {
          status: 500,
          error: error,
          duration,
        };
        Reactotron.apisauce({ request, response, duration });
      }

      throw error;
    }
  };

  // Monitor generic fetch calls
  monitorFetch = async (
    url: string,
    options?: RequestInit,
  ): Promise<Response> => {
    const startTime = Date.now();
    const request: ApiRequest = {
      url,
      method: options?.method || 'GET',
      data: options?.body,
      headers: options?.headers as Record<string, string>,
    };

    try {
      const response = await fetch(url, options);
      const duration = Date.now() - startTime;

      if (this.isReactotronAvailable()) {
        const apiResponse: ApiResponse = {
          status: response.status,
          data: response.clone(), // Clone to avoid consuming the response
          duration,
        };
        Reactotron.apisauce({ request, response: apiResponse, duration });
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (this.isReactotronAvailable()) {
        const apiResponse: ApiResponse = {
          status: 0,
          error: error,
          duration,
        };
        Reactotron.apisauce({ request, response: apiResponse, duration });
      }

      throw error;
    }
  };

  // Log API call without monitoring (for manual logging)
  logApiCall = (
    method: string,
    url: string,
    data?: any,
    response?: any,
    duration?: number,
  ) => {
    if (this.isReactotronAvailable()) {
      const request: ApiRequest = { url, method, data };
      const apiResponse: ApiResponse = {
        status: response?.status || 200,
        data: response,
        duration: duration || 0,
      };
      Reactotron.apisauce({ request, response: apiResponse, duration });
    }
  };
}

export const apiMonitor = new ApiMonitor();
export default apiMonitor;