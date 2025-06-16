import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { DEBUG_CONFIG, DebugFlags } from './debugConfig';

// Global type declaration for React Native __DEV__ variable
declare const __DEV__: boolean;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  context?: Record<string, unknown>;
  tags?: Record<string, string>;
}

class Logger {
  private static instance: Logger;
  private isProduction: boolean;
  private debugFlags: DebugFlags = DEBUG_CONFIG;

  private constructor() {
    this.isProduction = !__DEV__;
    if (this.isProduction) {
      this.debugFlags = Object.keys(this.debugFlags).reduce((acc, key) => {
        acc[key as keyof DebugFlags] = false;
        return acc;
      }, {} as DebugFlags);
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public getDebugFlags(): DebugFlags {
    return { ...this.debugFlags };
  }

  public isDebugging(component?: keyof DebugFlags): boolean {
    if (this.debugFlags.GLOBAL) return true;

    if (component && component in this.debugFlags) {
      return this.debugFlags[component];
    }

    return false;
  }

  private formatMessage(level: LogLevel, message: string, options?: LoggerOptions): string {
    const timestamp = new Date().toISOString();
    const context = options?.context ? JSON.stringify(options.context) : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${context}`;
  }

  private log(level: LogLevel, message: string, options?: LoggerOptions): void {
    const formattedMessage = this.formatMessage(level, message, options);

    if (!this.isProduction) {
      switch (level) {
        case 'debug':
          console.debug(formattedMessage);
          break;
        case 'info':
          console.info(formattedMessage);
          break;
        case 'warn':
          console.warn(formattedMessage);
          break;
        case 'error':
          console.error(formattedMessage);
          break;
      }
    }

    if (level === 'error' && this.isProduction) {
      if (options?.context) {
        Sentry.setContext('error_context', options.context);
      }
      if (options?.tags) {
        Object.entries(options.tags).forEach(([key, value]) => {
          Sentry.setTag(key, value);
        });
      }
      Sentry.captureMessage(message);
    }
  }

  public debug(message: string, options?: LoggerOptions): void {
    if (this.isDebugging()) {
      this.log('debug', message, options);
    }
  }

  public debugComponent(
    component: keyof DebugFlags,
    message: string,
    options?: LoggerOptions,
  ): void {
    if (this.isDebugging(component)) {
      this.log('debug', `[${component}] ${message}`, options);
    }
  }

  public info(message: string, options?: LoggerOptions): void {
    this.log('info', message, options);
  }

  public warn(message: string, options?: LoggerOptions): void {
    this.log('warn', message, options);
  }

  public error(message: string, error?: Error, options?: LoggerOptions): void {
    if (error) {
      const context = {
        ...options?.context,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      };
      this.log('error', message, { ...options, context });

      if (this.isProduction) {
        Sentry.captureException(error);
      }
    } else {
      this.log('error', message, options);
    }
  }
}

export const logger = Logger.getInstance();

if (!__DEV__) {
  Sentry.init({
    dsn: Constants.expoConfig?.extra?.sentryDsn || '',
    enabled: true,
    debug: false,
    environment: Constants.expoConfig?.extra?.environment || 'production',
  });
}

export default logger;
