/**
 * Shared loading messages used across the app
 * This centralizes all loading text to avoid duplication
 */
export const LOADING_MESSAGES = {
  // Core system messages
  START: 'Starting up...',
  STATIC_ASSETS: 'Loading static assets...',
  IMAGES: 'Caching important images...',
  DATA: 'Preloading essential data...',
  OFFLINE: 'Offline mode',
  ALMOST_READY: 'Almost ready...',
  READY: 'Ready!',
  LIMITED: 'Ready (with limited resources)',
  
  // User-facing messages
  DEFAULT: 'Welcome to MindMuscle.AI',
  DEFAULT_WORKOUT: 'Preparing your workout...',
  AUTHENTICATED: 'Preparing your workout experience...',
  GETTING_READY: 'Getting things ready...',
  
  // Rotating messages for loading screen
  ROTATION: [
    'Loading exercises...',
    'Just a moment...',
    'AI is working...',
    'Calculating your gains...',
    'Getting pumped up...',
    'Almost there...',
    'Hold on tight...',
    'Finalizing...',
  ]
}; 