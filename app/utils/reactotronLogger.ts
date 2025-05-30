/* eslint-disable @typescript-eslint/no-explicit-any */
declare const Reactotron: any;

interface ReactotronLogger {
  log: (message: string, data?: any) => void;
  warn: (message: string, data?: any) => void;
  error: (message: string, data?: any) => void;
  display: (config: { name: string; value: any; preview?: string }) => void;
  apiResponse: (request: any, response: any) => void;
  benchmark: (name: string) => () => void;
}

// Create a safe Reactotron logger that works in both dev and production
const createReactotronLogger = (): ReactotronLogger => {
  const isReactotronAvailable = __DEV__ && typeof Reactotron !== 'undefined';

  return {
    log: (message: string, data?: any) => {
      if (isReactotronAvailable) {
        Reactotron.log(message, data);
      } else if (__DEV__) {
        console.log(`[Reactotron] ${message}`, data);
      }
    },

    warn: (message: string, data?: any) => {
      if (isReactotronAvailable) {
        Reactotron.warn(message, data);
      } else if (__DEV__) {
        console.warn(`[Reactotron] ${message}`, data);
      }
    },

    error: (message: string, data?: any) => {
      if (isReactotronAvailable) {
        Reactotron.error(message, data);
      } else if (__DEV__) {
        console.error(`[Reactotron] ${message}`, data);
      }
    },

    display: (config: { name: string; value: any; preview?: string }) => {
      if (isReactotronAvailable) {
        Reactotron.display(config);
      } else if (__DEV__) {
        console.log(`[Reactotron Display] ${config.name}:`, config.value);
      }
    },

    apiResponse: (request: any, response: any) => {
      if (isReactotronAvailable) {
        Reactotron.apiResponse(request, response);
      } else if (__DEV__) {
        console.log('[Reactotron API]', { request, response });
      }
    },

    benchmark: (name: string) => {
      if (isReactotronAvailable) {
        return Reactotron.benchmark(name);
      } else {
        const start = Date.now();
        return () => {
          if (__DEV__) {
            console.log(`[Reactotron Benchmark] ${name}: ${Date.now() - start}ms`);
          }
        };
      }
    },
  };
};

export const ReactotronLog = createReactotronLogger();

// Helper functions for common debugging scenarios
export const logAuthState = (state: any) => {
  ReactotronLog.display({
    name: 'Auth State',
    value: state,
    preview: `User: ${state?.user?.email || 'Not logged in'}`,
  });
};

export const logWorkoutProgress = (workout: any) => {
  ReactotronLog.display({
    name: 'Workout Progress',
    value: workout,
    preview: `${workout?.name || 'Unknown'} - ${workout?.completedExercises || 0}/${workout?.totalExercises || 0}`,
  });
};

export const logApiCall = (endpoint: string, method: string, data?: any) => {
  ReactotronLog.log(`API Call: ${method} ${endpoint}`, data);
};

export const logSupabaseCall = (operation: string, table: string, params?: any) => {
  ReactotronLog.log(`Supabase ${operation}: ${table}`, params);
};

export const logOpenAICall = (endpoint: string, params?: any) => {
  ReactotronLog.log(`OpenAI API: ${endpoint}`, params);
};

export const logError = (context: string, error: any) => {
  ReactotronLog.error(`Error in ${context}`, {
    message: error?.message,
    stack: error?.stack,
    ...error,
  });
};

export default ReactotronLog;
