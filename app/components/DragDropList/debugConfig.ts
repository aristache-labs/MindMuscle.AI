/**
 * Centralized debug configuration for Drag & Drop components
 *
 * Set ENABLE_DRAG_DROP_DEBUG to true to enable detailed logging
 * Set to false for production or when debugging is not needed
 */

// Main debug toggle - change this to enable/disable all drag & drop logging
export const ENABLE_DRAG_DROP_DEBUG = true; // Disabled for better performance

// Individual component debug flags (all controlled by main toggle)
export const DEBUG_DRAG_DROP_LIST = ENABLE_DRAG_DROP_DEBUG;
export const DEBUG_DRAG_DROP_ITEM = ENABLE_DRAG_DROP_DEBUG;
export const DEBUG_DRAG_DROP_UTILS = ENABLE_DRAG_DROP_DEBUG;

// Debug logging frequencies (when debug is enabled)
export const DEBUG_FREQUENCIES = {
  // How often to log shared value changes (every Nth change)
  SHARED_VALUE_LOG_FREQUENCY: 50,

  // How often to log render events (percentage: 0.01 = 1%)
  RENDER_LOG_FREQUENCY: 0.01,

  // How often to log position changes during drag (every Nth pixel)
  POSITION_CHANGE_LOG_FREQUENCY: 100,

  // How often to log drag onChange events (every Nth pixel)
  DRAG_CHANGE_LOG_FREQUENCY: 40,

  // How often to log style updates (every Nth pixel)
  STYLE_UPDATE_LOG_FREQUENCY: 50,
};

/**
 * Utility function to create debug loggers
 */
export const createDebugLogger = (componentName: string, enabled: boolean) => {
  return (message: string, data?: unknown) => {
    if (enabled) {
      console.log(`[${componentName}] ${message}`, data || '');
    }
  };
};

/**
 * Quick way to enable debug logging for development
 * Call this function to enable all drag & drop debug logging
 */
export const enableDragDropDebug = () => {
  console.log('🐛 Drag & Drop debug logging enabled');
  // Note: This won't work at runtime due to const exports
  // You need to change ENABLE_DRAG_DROP_DEBUG above and restart
};

/**
 * Instructions for enabling debug logging:
 *
 * 1. Change ENABLE_DRAG_DROP_DEBUG to true above
 * 2. Restart your development server
 * 3. Debug logs will appear in console with prefixes:
 *    - [DragDropList] - Main list component events
 *    - [DragDropItem] - Individual item drag events
 *    - [DragDropUtils] - Position calculations and reordering
 *
 * To disable: Change ENABLE_DRAG_DROP_DEBUG to false and restart
 */
