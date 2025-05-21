import logger from './logger';
import { DebugFlags } from './debugConfig';
import React from 'react';

/**
 * Helper function for conditional debug logging in components
 * Example usage:
 * debug('SPLASH_SCREEN', 'Loading complete', () => `Loaded ${items.length} items`);
 * 
 * This will only execute the callback if debugging is enabled for that component
 */
export function debug(
  component: keyof DebugFlags, 
  message: string, 
  detailsCallback?: () => string | Record<string, unknown>
): void {
  if (logger.isDebugging(component)) {
    const details = detailsCallback ? detailsCallback() : undefined;
    if (typeof details === 'string') {
      logger.debugComponent(component, `${message}: ${details}`);
    } else if (details) {
      logger.debugComponent(component, message, { context: details });
    } else {
      logger.debugComponent(component, message);
    }
  }
}

/**
 * Helper function to create component-specific debug loggers
 * Example usage:
 * 
 * const log = createComponentLogger('IMAGE_PRELOADER');
 * log.debug('Loading image', () => `URL: ${imageUrl}`);
 * log.info('Image loaded');
 * log.warn('Image load failed', error);
 */
export function createComponentLogger(component: keyof DebugFlags) {
  return {
    debug: (message: string, detailsCallback?: () => string | Record<string, unknown>) => 
      debug(component, message, detailsCallback),
      
    info: (message: string, options?: { context?: Record<string, unknown> }) => 
      logger.info(`[${String(component)}] ${message}`, options),
      
    // Add log as an alias for info to fix TypeScript errors
    log: (message: string, data?: unknown) => {
      // Simple case - just log the message
      if (data === undefined) {
        logger.info(`[${String(component)}] ${message}`);
        return;
      }
      
      // If data is a valid options object with context property
      if (data && typeof data === 'object' && data !== null && 'context' in data && 
          data.context && typeof data.context === 'object') {
        logger.info(`[${String(component)}] ${message}`, 
                   { context: data.context as Record<string, unknown> });
      } 
      // For any other type of data, convert to a string in the context
      else {
        logger.info(`[${String(component)}] ${message}`, { 
          context: { details: typeof data === 'object' ? JSON.stringify(data) : String(data) } 
        });
      }
    },
      
    warn: (message: string, error?: unknown) => {
      if (error instanceof Error) {
        logger.warn(`[${String(component)}] ${message}`, { 
          context: {
            message: error.message,
            stack: error.stack
          }
        });
      } else {
        logger.warn(`[${String(component)}] ${message}`, { 
          context: { error: String(error) }
        });
      }
    },
    
    error: (message: string, error?: unknown, options?: { context?: Record<string, unknown> }) => {
      if (error instanceof Error) {
        logger.error(`[${String(component)}] ${message}`, error, options);
      } else if (error !== undefined) {
        // If error is not an Error instance but some other type, create an Error object
        const errorObj = new Error(typeof error === 'object' ? JSON.stringify(error) : String(error));
        logger.error(`[${String(component)}] ${message}`, errorObj, options);
      } else {
        // No error provided
        logger.error(`[${String(component)}] ${message}`, undefined, options);
      }
    },

    // Check if debugging is enabled for this component
    isDebugging: () => logger.isDebugging(component)
  };
}

// Pre-create common loggers for convenience
export const loggers = {
  splashScreen: createComponentLogger('SPLASH_SCREEN'),
  imagePreloader: createComponentLogger('IMAGE_PRELOADER'),
  network: createComponentLogger('NETWORK'),
  auth: createComponentLogger('AUTH'),
  workout: createComponentLogger('WORKOUT'),
  dataSync: createComponentLogger('DATA_SYNC'),
  performance: createComponentLogger('PERFORMANCE'),
  api: createComponentLogger('API')
};

// Default export to satisfy Expo Router
export default function DebugHelpers() {
  return null;
} 