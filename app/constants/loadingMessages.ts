/**
 * Shared loading messages used across the app
 * This centralizes all loading text to avoid duplication
 */
export const LOADING_MESSAGES = {
  // Core system messages
  START: 'Starting up...',
  STATIC_ASSETS: 'Loading static assets...',
  REMOTE_ASSETS: 'Loading remote assets...',
  IMAGES: 'Caching important images...',
  DATA: 'Preloading essential data...',
  CONTENT: 'Loading content...',
  OFFLINE: 'Offline mode',
  ALMOST_READY: 'Almost ready...',
  READY: 'Ready!',
  COMPLETE: 'Setup complete!',
  LIMITED: 'Ready (with limited resources)',
  
  // User-facing messages
  DEFAULT: 'Welcome to MindMuscle.AI',
  DEFAULT_WORKOUT: 'Preparing your workout...',
  AUTHENTICATED: 'Preparing your workout experience...',
  GETTING_READY: 'Getting things ready...',
  
  // User-specific content loading
  USER_CONTENT: 'Loading your personal content...',
  PROGRESS_PHOTOS: 'Caching your progress photos...',
  FAVORITE_EXERCISES: 'Preparing your favorite exercises...',
  WORKOUT_HISTORY: 'Loading your workout history...',
  
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

// Define a default export to satisfy Expo Router
export default LOADING_MESSAGES; 