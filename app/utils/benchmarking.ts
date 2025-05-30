import Reactotron from 'reactotron-react-native';

/**
 * Benchmarking utilities for performance monitoring using Reactotron
 * Only works in development mode when Reactotron is connected
 */

interface BenchmarkInstance {
  step: (label: string) => void;
  stop: (label: string) => void;
}

class BenchmarkUtility {
  /**
   * Start a new benchmark session
   * @param name - Name of the benchmark for identification in Reactotron
   * @returns Benchmark instance with step and stop methods
   */
  start(name: string): BenchmarkInstance {
    if (__DEV__ && Reactotron && Reactotron.benchmark) {
      const bench = Reactotron.benchmark(name);
      return {
        step: (label: string) => bench.step(label),
        stop: (label: string) => bench.stop(label),
      };
    }

    // Return no-op functions in production or when Reactotron is not available
    return {
      step: () => {},
      stop: () => {},
    };
  }

  /**
   * Benchmark a synchronous function
   * @param name - Name of the benchmark
   * @param fn - Function to benchmark
   * @returns Result of the function
   */
  sync<T>(name: string, fn: () => T): T {
    const bench = this.start(name);
    const result = fn();
    bench.stop('Complete');
    return result;
  }

  /**
   * Benchmark an asynchronous function
   * @param name - Name of the benchmark
   * @param fn - Async function to benchmark
   * @returns Promise with the result of the function
   */
  async async<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const bench = this.start(name);
    try {
      const result = await fn();
      bench.stop('Complete');
      return result;
    } catch (error) {
      bench.stop('Error');
      throw error;
    }
  }

  /**
   * Benchmark a function with multiple steps
   * @param name - Name of the benchmark
   * @param steps - Array of step functions with labels
   * @returns Array of results from each step
   */
  async steps<T>(
    name: string,
    steps: Array<{ label: string; fn: () => Promise<T> | T }>,
  ): Promise<T[]> {
    const bench = this.start(name);
    const results: T[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const result = await step.fn();
      results.push(result);

      if (i === steps.length - 1) {
        bench.stop(step.label);
      } else {
        bench.step(step.label);
      }
    }

    return results;
  }

  /**
   * Higher-order function to automatically benchmark any function
   * @param name - Name of the benchmark
   * @param fn - Function to wrap with benchmarking
   * @returns Wrapped function that will be benchmarked when called
   */
  wrap<T extends (...args: any[]) => any>(name: string, fn: T): T {
    return ((...args: Parameters<T>) => {
      if (fn.constructor.name === 'AsyncFunction') {
        return this.async(name, () => fn(...args));
      } else {
        return this.sync(name, () => fn(...args));
      }
    }) as T;
  }
}

// Create and export singleton instance
export const benchmark = new BenchmarkUtility();

// Export individual methods for convenience
export const { start: startBenchmark, sync: benchmarkSync, async: benchmarkAsync } = benchmark;

// Export utility functions for common use cases
export const withBenchmark = benchmark.wrap.bind(benchmark);

/**
 * Decorator function for class methods (experimental)
 * Usage: @benchmarkMethod('methodName')
 */
export function benchmarkMethod(name?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const benchmarkName = name || `${target.constructor.name}.${propertyName}`;

    descriptor.value = function (...args: any[]) {
      return benchmark.sync(benchmarkName, () => method.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Async decorator function for class methods (experimental)
 * Usage: @benchmarkAsyncMethod('methodName')
 */
export function benchmarkAsyncMethod(name?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const benchmarkName = name || `${target.constructor.name}.${propertyName}`;

    descriptor.value = function (...args: any[]) {
      return benchmark.async(benchmarkName, () => method.apply(this, args));
    };

    return descriptor;
  };
}

export default benchmark; 