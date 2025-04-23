import * as Sentry from 'sentry-expo';
import Constants from 'expo-constants';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  context?: Record<string, unknown>;
  tags?: Record<string, string>;
}

class Logger {
  private static instance: Logger;
  private isProduction: boolean;

  private constructor() {
    this.isProduction = !__DEV__;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
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

    // Always send errors to Sentry in production
    if (level === 'error' && this.isProduction) {
      if (options?.context) {
        Sentry.Native.setContext('error_context', options.context);
      }
      if (options?.tags) {
        Object.entries(options.tags).forEach(([key, value]) => {
          Sentry.Native.setTag(key, value);
        });
      }
      Sentry.Native.captureMessage(message);
    }
  }

  public debug(message: string, options?: LoggerOptions): void {
    this.log('debug', message, options);
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
        Sentry.Native.captureException(error);
      }
    } else {
      this.log('error', message, options);
    }
  }
}

export const logger = Logger.getInstance();

// Initialize Sentry in production
if (!__DEV__) {
  Sentry.init({
    dsn: Constants.expoConfig?.extra?.sentryDsn || '',
    enabled: true,
    debug: false,
    environment: Constants.expoConfig?.extra?.environment || 'production',
  });
}

export default logger; 