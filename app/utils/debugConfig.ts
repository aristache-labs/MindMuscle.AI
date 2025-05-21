/**
 * Debug Configuration
 * 
 * Edit this file to enable/disable debugging for different components.
 * Set values to true to enable debugging, false to disable.
 */

export const DEBUG_CONFIG = {
  // Master switch - enables all debugging when true
  GLOBAL: false,
  
  // Component-specific debug flags
  SPLASH_SCREEN: false,
  IMAGE_PRELOADER: false,
  NETWORK: false,
  AUTH: false,
  WORKOUT: false,
  DATA_SYNC: false,
  PERFORMANCE: false,
  API: false,
  
  // Add workout-specific debug flags
  WORKOUT_PLAN: false,
  WORKOUT_SESSION: false,
  EXERCISE: false
};

/**
 * Type definition for debug flags
 */
export type DebugFlags = typeof DEBUG_CONFIG; 