import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import { SentryLogger, SentryDataCollection } from '../services/sentry';
import { startTransaction, TransactionLike } from './sentryCompat';

// Sentry configuration for load time tracking
const SENTRY_CONFIG = {
  TRACE_NAMES: {
    LOAD_TRACKING: 'loadtime.tracking',
    PERFORMANCE_MILESTONE: 'loadtime.milestone',
    CACHE_OPERATION: 'loadtime.cache',
  },
  ERROR_CATEGORIES: {
    TRACKING_ERROR: 'tracking_error',
    MILESTONE_ERROR: 'milestone_error',
    PERFORMANCE_ERROR: 'performance_error',
  },
  BREADCRUMB_CATEGORIES: {
    TRACKING: 'tracking',
    MILESTONE: 'milestone',
    PERFORMANCE: 'performance',
    CACHE: 'cache',
  },
  THRESHOLDS: {
    SLOW_OPERATION: 1000,
    VERY_SLOW_OPERATION: 3000,
    CRITICAL_SLOW_OPERATION: 5000,
  },
} as const;

// Helper function to add Sentry breadcrumb
const addSentryBreadcrumb = (
  message: string,
  category: keyof typeof SENTRY_CONFIG.BREADCRUMB_CATEGORIES,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info',
): void => {
  try {
    Sentry.addBreadcrumb({
      message,
      category: SENTRY_CONFIG.BREADCRUMB_CATEGORIES[category],
      level,
      data: {
        component: 'loadTimeTracker',
        platform: Platform.OS,
        ...data,
      },
    });
  } catch (error) {
    console.warn('Failed to add Sentry breadcrumb:', error);
  }
};

// Helper function to capture Sentry exception with context
const captureSentryException = (
  error: Error,
  category: keyof typeof SENTRY_CONFIG.ERROR_CATEGORIES,
  context?: Record<string, unknown>,
): void => {
  try {
    Sentry.withScope((scope) => {
      scope.setTag('error_category', SENTRY_CONFIG.ERROR_CATEGORIES[category]);
      scope.setTag('component', 'loadTimeTracker');

      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          scope.setContext(
            key,
            typeof value === 'object' && value !== null
              ? (value as Record<string, unknown>)
              : { value },
          );
        });
      }

      scope.setLevel('error');
      Sentry.captureException(error);
    });
  } catch (sentryError) {
    console.warn('Failed to capture Sentry exception:', sentryError);
  }
};

// Helper function to start Sentry transaction
const startSentryTransaction = (
  name: keyof typeof SENTRY_CONFIG.TRACE_NAMES,
  description?: string,
): TransactionLike | null => {
  try {
    const transaction = startTransaction({
      name: SENTRY_CONFIG.TRACE_NAMES[name],
      op: description || SENTRY_CONFIG.TRACE_NAMES[name],
      tags: {
        component: 'loadTimeTracker',
        platform: Platform.OS,
      },
    });

    addSentryBreadcrumb(`Started ${name} transaction`, 'PERFORMANCE', {
      transactionName: SENTRY_CONFIG.TRACE_NAMES[name],
    });

    return transaction;
  } catch (error) {
    console.warn('Failed to start Sentry transaction:', error);
    return null;
  }
};

// Define interface for time tracking data
interface TimePoint {
  start?: number;
  end?: number;
  marks: Array<{
    time: number;
    duration: number;
    label: string;
    metadata?: Record<string, unknown>;
  }>;
  transaction?: TransactionLike | null;
  screen?: string;
  metadata?: Record<string, unknown>;
}

// Enhanced performance tracking utility with Sentry integration
export const loadTimeTracker = {
  timePoints: new Map<string, TimePoint>(),

  /**
   * Start load time tracking for a specific operation
   * @param id Unique identifier for the tracking session
   * @param screen Optional screen identifier
   * @param metadata Optional metadata to attach to the tracking session
   */
  startLoadTimeTracking: (
    id: string,
    screen?: string,
    metadata?: Record<string, unknown>,
  ): void => {
    const transaction = startSentryTransaction('LOAD_TRACKING', `Load tracking: ${id}`);

    try {
      console.log(`[LoadTracker] Starting tracking for ${id}`);

      addSentryBreadcrumb(`Performance tracking started: ${id}`, 'TRACKING', {
        screen: screen || 'unknown',
        trackingId: id,
        timestamp: new Date().toISOString(),
        metadata,
      });

      const timePoint: TimePoint = {
        start: Date.now(),
        marks: [],
        transaction,
        screen: screen || 'unknown',
        metadata,
      };

      loadTimeTracker.timePoints.set(id, timePoint);

      // Log to Sentry logger
      SentryLogger.info(`Load time tracking started: ${id}`, {
        screen: screen || 'unknown',
        trackingId: id,
        metadata,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      captureSentryException(err, 'TRACKING_ERROR', {
        operation: 'startLoadTimeTracking',
        trackingId: id,
        screen: screen || 'unknown',
        metadata,
      });

      console.error(`[LoadTracker] Error starting tracking for ${id}:`, error);
    } finally {
      if (transaction) {
        transaction.finish();
      }
    }
  },

  /**
   * End load time tracking and capture performance metrics
   * @param id Unique identifier for the tracking session
   * @param additionalData Optional additional data to include in the report
   */
  endLoadTimeTracking: (id: string, additionalData?: Record<string, unknown>): void => {
    const timePoint = loadTimeTracker.timePoints.get(id);

    if (!timePoint) {
      const warning = `Attempted to end tracking for non-existent ID: ${id}`;
      console.warn(`[LoadTracker] ${warning}`);

      addSentryBreadcrumb(warning, 'TRACKING', { trackingId: id }, 'warning');

      SentryDataCollection.captureMessage(warning, 'warning');
      return;
    }

    const transaction = startSentryTransaction('LOAD_TRACKING', `Complete load tracking: ${id}`);

    try {
      timePoint.end = Date.now();
      const totalDuration = timePoint.end - (timePoint.start || 0);

      console.log(`[LoadTracker] Completed tracking for ${id}: ${totalDuration}ms`);

      // Determine performance severity
      const performanceLevel = loadTimeTracker.getPerformanceLevel(totalDuration);
      const performanceData = {
        screen: timePoint.screen || 'unknown',
        trackingId: id,
        totalDuration,
        marks: timePoint.marks,
        marksCount: timePoint.marks.length,
        performanceLevel,
        metadata: timePoint.metadata,
        additionalData,
      };

      // Log performance data to Sentry with appropriate level
      if (performanceLevel === 'critical') {
        SentryLogger.error(`Critical performance issue: ${id}`, performanceData);
      } else if (performanceLevel === 'slow') {
        SentryLogger.warn(`Slow performance detected: ${id}`, performanceData);
      } else {
        SentryLogger.info(`Performance tracking completed: ${id}`, performanceData);
      }

      // Add comprehensive breadcrumb
      addSentryBreadcrumb(
        `Performance tracking completed: ${id}`,
        'PERFORMANCE',
        {
          ...performanceData,
          timestamp: new Date().toISOString(),
        },
        performanceLevel === 'critical'
          ? 'error'
          : performanceLevel === 'slow'
            ? 'warning'
            : 'info',
      );

      // Capture performance issues based on thresholds
      if (totalDuration > SENTRY_CONFIG.THRESHOLDS.CRITICAL_SLOW_OPERATION) {
        SentryDataCollection.captureMessage(
          `Critical performance issue: ${id} took ${totalDuration}ms`,
          'error',
        );
      } else if (totalDuration > SENTRY_CONFIG.THRESHOLDS.VERY_SLOW_OPERATION) {
        SentryDataCollection.captureMessage(
          `Very slow performance detected: ${id} took ${totalDuration}ms`,
          'warning',
        );
      } else if (totalDuration > SENTRY_CONFIG.THRESHOLDS.SLOW_OPERATION) {
        SentryDataCollection.captureMessage(
          `Slow performance detected: ${id} took ${totalDuration}ms`,
          'info',
        );
      }

      // Clean up transaction
      if (timePoint.transaction) {
        timePoint.transaction.setData('totalDuration', totalDuration);
        timePoint.transaction.setData('marksCount', timePoint.marks.length);
        timePoint.transaction.setStatus('ok');
        timePoint.transaction.finish();
      }

      // Keep tracking data for potential analysis
      // Note: Consider implementing automatic cleanup after a certain time
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      captureSentryException(err, 'TRACKING_ERROR', {
        operation: 'endLoadTimeTracking',
        trackingId: id,
        screen: timePoint.screen,
        additionalData,
      });

      console.error(`[LoadTracker] Error ending tracking for ${id}:`, error);
    } finally {
      if (transaction) {
        transaction.finish();
      }
    }
  },

  /**
   * Mark a milestone in the load time tracking
   * @param id Unique identifier for the tracking session
   * @param label Description of the milestone
   * @param metadata Optional metadata for the milestone
   */
  markLoadTime: (id: string, label: string, metadata?: Record<string, unknown>): void => {
    const timePoint = loadTimeTracker.timePoints.get(id);

    if (!timePoint) {
      const warning = `Attempted to mark milestone for non-existent tracking ID: ${id}`;
      console.warn(`[LoadTracker] ${warning}`);

      addSentryBreadcrumb(warning, 'MILESTONE', { trackingId: id, label }, 'warning');
      return;
    }

    const transaction = startSentryTransaction('PERFORMANCE_MILESTONE', `Milestone: ${label}`);

    try {
      const now = Date.now();
      const duration =
        timePoint.marks.length > 0
          ? now - timePoint.marks[timePoint.marks.length - 1].time
          : now - (timePoint.start || 0);

      const mark = {
        time: now,
        duration,
        label,
        metadata,
      };

      timePoint.marks.push(mark);
      console.log(`[LoadTracker] ${id} - ${label}: ${duration}ms`);

      // Determine milestone performance level
      const milestoneLevel = loadTimeTracker.getMilestonePerformanceLevel(duration);
      const milestoneData = {
        screen: timePoint.screen || 'unknown',
        trackingId: id,
        label,
        duration,
        milestoneLevel,
        totalMarks: timePoint.marks.length,
        metadata,
      };

      // Add Sentry breadcrumb for performance milestones
      addSentryBreadcrumb(
        `Performance milestone: ${label}`,
        'MILESTONE',
        {
          ...milestoneData,
          timestamp: new Date().toISOString(),
        },
        milestoneLevel === 'slow' ? 'warning' : 'info',
      );

      // Log milestone with appropriate level
      if (milestoneLevel === 'slow') {
        SentryLogger.warn(`Slow milestone detected: ${label}`, milestoneData);
      } else {
        SentryLogger.info(`Performance milestone: ${label}`, milestoneData);
      }

      // Flag slow operations
      if (duration > SENTRY_CONFIG.THRESHOLDS.SLOW_OPERATION) {
        SentryDataCollection.captureMessage(
          `Slow milestone detected: ${label} took ${duration}ms in ${id}`,
          'warning',
        );
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      captureSentryException(err, 'MILESTONE_ERROR', {
        operation: 'markLoadTime',
        trackingId: id,
        label,
        metadata,
      });

      console.error(`[LoadTracker] Error marking milestone ${label} for ${id}:`, error);
    } finally {
      if (transaction) {
        transaction.finish();
      }
    }
  },

  /**
   * Get performance statistics for a tracking session
   * @param id Unique identifier for the tracking session
   * @returns Performance statistics or null if not found
   */
  getPerformanceStats: (
    id: string,
  ): {
    totalDuration: number;
    marksCount: number;
    averageMarkDuration: number;
    slowestMark: { label: string; duration: number } | null;
    performanceLevel: string;
  } | null => {
    try {
      const timePoint = loadTimeTracker.timePoints.get(id);

      if (!timePoint || !timePoint.end) {
        return null;
      }

      const totalDuration = timePoint.end - (timePoint.start || 0);
      const marksCount = timePoint.marks.length;
      const averageMarkDuration =
        marksCount > 0
          ? timePoint.marks.reduce((sum, mark) => sum + mark.duration, 0) / marksCount
          : 0;

      const slowestMark =
        timePoint.marks.length > 0
          ? timePoint.marks.reduce((slowest, current) =>
              current.duration > slowest.duration ? current : slowest,
            )
          : null;

      const performanceLevel = loadTimeTracker.getPerformanceLevel(totalDuration);

      return {
        totalDuration,
        marksCount,
        averageMarkDuration,
        slowestMark: slowestMark
          ? { label: slowestMark.label, duration: slowestMark.duration }
          : null,
        performanceLevel,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      captureSentryException(err, 'PERFORMANCE_ERROR', {
        operation: 'getPerformanceStats',
        trackingId: id,
      });

      console.error(`[LoadTracker] Error getting performance stats for ${id}:`, error);
      return null;
    }
  },

  /**
   * Clear tracking data for a specific ID
   * @param id Unique identifier for the tracking session
   */
  clearTracking: (id: string): void => {
    try {
      const timePoint = loadTimeTracker.timePoints.get(id);

      if (timePoint) {
        // Clean up any ongoing transaction
        if (timePoint.transaction) {
          timePoint.transaction.setStatus('cancelled');
          timePoint.transaction.finish();
        }

        loadTimeTracker.timePoints.delete(id);

        addSentryBreadcrumb(`Tracking data cleared: ${id}`, 'CACHE', {
          trackingId: id,
          screen: timePoint.screen,
        });

        console.log(`[LoadTracker] Cleared tracking data for ${id}`);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      captureSentryException(err, 'TRACKING_ERROR', {
        operation: 'clearTracking',
        trackingId: id,
      });

      console.error(`[LoadTracker] Error clearing tracking for ${id}:`, error);
    }
  },

  /**
   * Clear all tracking data
   */
  clearAllTracking: (): void => {
    try {
      const trackedIds = Array.from(loadTimeTracker.timePoints.keys());

      // Clean up any ongoing transactions
      loadTimeTracker.timePoints.forEach((timePoint) => {
        if (timePoint.transaction) {
          timePoint.transaction.setStatus('cancelled');
          timePoint.transaction.finish();
        }
      });

      loadTimeTracker.timePoints.clear();

      addSentryBreadcrumb('All tracking data cleared', 'CACHE', {
        clearedCount: trackedIds.length,
        trackedIds,
      });

      console.log(`[LoadTracker] Cleared all tracking data (${trackedIds.length} sessions)`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      captureSentryException(err, 'TRACKING_ERROR', {
        operation: 'clearAllTracking',
      });

      console.error('[LoadTracker] Error clearing all tracking:', error);
    }
  },

  /**
   * Get the current number of active tracking sessions
   */
  getActiveTrackingCount: (): number => {
    try {
      return loadTimeTracker.timePoints.size;
    } catch (error) {
      console.error('[LoadTracker] Error getting active tracking count:', error);
      return 0;
    }
  },

  /**
   * Determine performance level based on duration
   * @param duration Duration in milliseconds
   * @returns Performance level string
   */
  getPerformanceLevel: (duration: number): 'good' | 'slow' | 'critical' => {
    if (duration > SENTRY_CONFIG.THRESHOLDS.CRITICAL_SLOW_OPERATION) {
      return 'critical';
    } else if (duration > SENTRY_CONFIG.THRESHOLDS.VERY_SLOW_OPERATION) {
      return 'slow';
    }
    return 'good';
  },

  /**
   * Determine milestone performance level based on duration
   * @param duration Duration in milliseconds
   * @returns Milestone performance level string
   */
  getMilestonePerformanceLevel: (duration: number): 'good' | 'slow' => {
    return duration > SENTRY_CONFIG.THRESHOLDS.SLOW_OPERATION ? 'slow' : 'good';
  },
};

// Default export to satisfy Expo Router (this file should not be a route)
export default function LoadTimeTrackerRouterPlaceholder() {
  return null;
}
