import * as Sentry from '@sentry/react-native';
import { SentryLogger, SentryDataCollection } from '../services/sentry';

// Enhanced performance tracking utility with Sentry integration
export const loadTimeTracker = {
  timePoints: new Map<
    string,
    { start?: number; end?: number; marks: { time: number; duration: number; label: string }[] }
  >(),

  startLoadTimeTracking: (id: string) => {
    console.log(`[LoadTracker] Starting tracking for ${id}`);

    // Add Sentry breadcrumb for performance tracking start
    Sentry.addBreadcrumb({
      message: `Performance tracking started: ${id}`,
      category: 'performance.tracking',
      level: 'info',
      data: {
        screen: 'exercises-list',
        trackingId: id,
        timestamp: new Date().toISOString(),
      },
    });

    loadTimeTracker.timePoints.set(id, {
      start: Date.now(),
      marks: [],
    });
  },

  endLoadTimeTracking: (id: string) => {
    const timePoint = loadTimeTracker.timePoints.get(id);
    if (timePoint) {
      timePoint.end = Date.now();
      const totalDuration = timePoint.end - (timePoint.start || 0);
      console.log(`[LoadTracker] Completed tracking for ${id}: ${totalDuration}ms`);

      // Log performance data to Sentry
      SentryLogger.info(`Performance tracking completed: ${id}`, {
        screen: 'exercises-list',
        trackingId: id,
        totalDuration,
        marks: timePoint.marks,
      });

      // If performance is poor, capture as an issue
      if (totalDuration > 3000) {
        SentryDataCollection.captureMessage(
          `Slow performance detected in exercises-list: ${id} took ${totalDuration}ms`,
          'warning',
        );
      }
    }
  },

  markLoadTime: (id: string, label: string) => {
    const timePoint = loadTimeTracker.timePoints.get(id);
    if (timePoint) {
      const now = Date.now();
      const duration =
        timePoint.marks.length > 0
          ? now - timePoint.marks[timePoint.marks.length - 1].time
          : now - (timePoint.start || 0);

      const mark = { time: now, duration, label };
      timePoint.marks.push(mark);
      console.log(`[LoadTracker] ${id} - ${label}: ${duration}ms`);

      // Add Sentry breadcrumb for performance milestones
      Sentry.addBreadcrumb({
        message: `Performance milestone: ${label}`,
        category: 'performance.milestone',
        level: 'info',
        data: {
          screen: 'exercises-list',
          trackingId: id,
          label,
          duration,
          timestamp: new Date().toISOString(),
        },
      });

      // Flag slow operations
      if (duration > 1000) {
        SentryLogger.warn(`Slow operation detected: ${label}`, {
          screen: 'exercises-list',
          trackingId: id,
          label,
          duration,
        });
      }
    }
  },
};
