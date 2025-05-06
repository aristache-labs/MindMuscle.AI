import { Platform } from 'react-native';

// Constants for tracking
const DEBUG_LOAD_TIME = true;
const trackers: Record<string, { startTime: number; logs: [string, number][] }> = {};

/**
 * Starts a load time tracker for a specific screen or component
 * @param screenName Name of the screen or component to track
 */
export const startLoadTimeTracking = (screenName: string): void => {
  if (!DEBUG_LOAD_TIME) return;
  
  trackers[screenName] = {
    startTime: Date.now(),
    logs: []
  };
  
  console.log(`⏱️ [${screenName}] Load time tracking started`);
};

/**
 * Marks a milestone in the loading process
 * @param screenName Name of the screen or component being tracked
 * @param milestone Description of the milestone reached
 */
export const markLoadTime = (screenName: string, milestone: string): void => {
  if (!DEBUG_LOAD_TIME || !trackers[screenName]) return;
  
  const tracker = trackers[screenName];
  const currentTime = Date.now();
  const elapsed = currentTime - tracker.startTime;
  
  tracker.logs.push([milestone, elapsed]);
  
  console.log(`⏱️ [${screenName}] ${milestone}: ${elapsed}ms`);
};

/**
 * Ends load time tracking and logs a summary
 * @param screenName Name of the screen or component being tracked
 */
export const endLoadTimeTracking = (screenName: string): void => {
  if (!DEBUG_LOAD_TIME || !trackers[screenName]) return;
  
  const tracker = trackers[screenName];
  const currentTime = Date.now();
  const totalTime = currentTime - tracker.startTime;
  
  console.log(`⏱️ [${screenName}] Total load time: ${totalTime}ms`);
  console.log(`⏱️ [${screenName}] Load time breakdown:`, tracker.logs);
  
  // Clean up
  delete trackers[screenName];
};

export default {
  startLoadTimeTracking,
  markLoadTime,
  endLoadTimeTracking
}; 