import { logger } from '../utils/logger';
import { apiClient } from './apiClient';
// Add Sentry imports
import {
  captureError,
  captureMessage,
  captureDatabaseError,
  captureValidationError,
  captureAPIError,
  capturePerformanceError,
} from './sentry';
import { addBreadcrumb } from './sentry/simpleErrorHandler';

// Define proper types for analytics data
export interface WorkoutSessionData {
  duration?: number;
  total_volume?: number;
  created_at: string;
  user_id: string;
}

export interface ExerciseRecordData {
  exercise_id: string;
  exercise_name?: string;
  weight?: number;
  reps?: number;
  sets?: number;
  created_at: string;
  user_id: string;
}

export interface MeasurementData {
  category: string;
  value: number;
  measured_at: string;
  user_id: string;
}

export interface AnalyticsEvent {
  id: string;
  userId: string;
  eventType:
    | 'workout_started'
    | 'workout_completed'
    | 'exercise_performed'
    | 'measurement_taken'
    | 'achievement_unlocked'
    | 'app_opened'
    | 'feature_used';
  eventData: Record<string, string | number | boolean>;
  timestamp: Date;
  sessionId?: string;
  deviceInfo?: {
    platform: string;
    version: string;
    model?: string;
  };
}

export interface WorkoutAnalytics {
  totalWorkouts: number;
  totalDuration: number;
  averageDuration: number;
  totalVolume: number;
  averageVolume: number;
  favoriteExercises: Array<{ exerciseId: string; count: number; name: string }>;
  workoutFrequency: {
    weekly: number;
    monthly: number;
  };
  progressTrends: {
    volumeTrend: 'increasing' | 'decreasing' | 'stable';
    durationTrend: 'increasing' | 'decreasing' | 'stable';
    frequencyTrend: 'increasing' | 'decreasing' | 'stable';
  };
}

export interface UserEngagementMetrics {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  averageSessionDuration: number;
  retentionRate: {
    day1: number;
    day7: number;
    day30: number;
  };
  featureUsage: Record<string, number>;
}

export interface PerformanceMetrics {
  strengthProgress: {
    exerciseId: string;
    exerciseName: string;
    initialMax: number;
    currentMax: number;
    improvement: number;
    improvementPercentage: number;
  }[];
  measurementProgress: {
    category: string;
    initialValue: number;
    currentValue: number;
    change: number;
    changePercentage: number;
  }[];
  consistencyScore: number;
  goalAchievementRate: number;
}

class AnalyticsService {
  private static instance: AnalyticsService;
  private sessionId: string | null = null;
  private sessionStartTime: Date | null = null;

  private constructor() {
    this.initializeSession();
  }

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Initialize a new analytics session
   */
  private initializeSession(): void {
    try {
      this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.sessionStartTime = new Date();

      addBreadcrumb('Analytics session initialized', 'analytics', {
        sessionId: this.sessionId,
      });

      logger.info('Analytics session initialized', {
        context: { sessionId: this.sessionId },
      });
    } catch (error) {
      logger.error('Error initializing analytics session', error as Error);
      captureError(error as Error, {
        category: 'javascript_error',
        component: 'AnalyticsService',
      });
    }
  }

  /**
   * Track an analytics event
   */
  async trackEvent(
    userId: string,
    eventType: AnalyticsEvent['eventType'],
    eventData: Record<string, string | number | boolean> = {},
    deviceInfo?: AnalyticsEvent['deviceInfo'],
  ): Promise<void> {
    try {
      addBreadcrumb('Starting analytics event tracking', 'analytics', {
        userId,
        eventType,
        sessionId: this.sessionId,
      });

      const event: Omit<AnalyticsEvent, 'id'> = {
        userId,
        eventType,
        eventData,
        timestamp: new Date(),
        sessionId: this.sessionId || undefined,
        deviceInfo,
      };

      // Basic validation
      if (!userId || !eventType) {
        const error = new Error('Invalid analytics event data: missing userId or eventType');
        logger.warn('Invalid analytics event data', {
          context: { userId, eventType },
        });
        captureValidationError(error, 'eventData');
        return;
      }

      // Send event to analytics backend
      await apiClient.post(
        '/rest/v1/analytics_events',
        {
          ...event,
          id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        },
        {
          auth: { required: true },
          cache: { enabled: false },
        },
      );

      addBreadcrumb('Analytics event tracked successfully', 'analytics', {
        userId,
        eventType,
        sessionId: this.sessionId,
      });

      logger.debug('Analytics event tracked', {
        context: { userId, eventType, sessionId: this.sessionId },
      });
    } catch (error) {
      logger.error('Error tracking analytics event', error as Error, {
        context: { userId, eventType },
      });
      captureAPIError(error as Error, '/rest/v1/analytics_events');
      // Don't throw - analytics failures shouldn't break the app
    }
  }

  /**
   * Track workout start
   */
  async trackWorkoutStart(
    userId: string,
    workoutData: {
      planId?: string;
      workoutDay?: number;
      exerciseCount: number;
    },
  ): Promise<void> {
    await this.trackEvent(userId, 'workout_started', workoutData);
  }

  /**
   * Track workout completion
   */
  async trackWorkoutCompletion(
    userId: string,
    workoutData: {
      planId?: string;
      workoutDay?: number;
      duration: number;
      totalVolume: number;
      exercisesCompleted: number;
    },
  ): Promise<void> {
    await this.trackEvent(userId, 'workout_completed', workoutData);
  }

  /**
   * Track exercise performance
   */
  async trackExercisePerformance(
    userId: string,
    exerciseData: {
      exerciseId: string;
      exerciseName: string;
      sets: number;
      reps: number;
      weight?: number;
      duration?: number;
      personalRecord?: boolean;
    },
  ): Promise<void> {
    await this.trackEvent(userId, 'exercise_performed', exerciseData);
  }

  /**
   * Track measurement
   */
  async trackMeasurement(
    userId: string,
    measurementData: {
      category: string;
      value: number;
      unit: string;
      improvement?: boolean;
    },
  ): Promise<void> {
    await this.trackEvent(userId, 'measurement_taken', measurementData);
  }

  /**
   * Track achievement unlock
   */
  async trackAchievement(
    userId: string,
    achievementData: {
      achievementId: string;
      achievementName: string;
      category: string;
    },
  ): Promise<void> {
    await this.trackEvent(userId, 'achievement_unlocked', achievementData);
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(
    userId: string,
    feature: string,
    action: string,
    metadata?: Record<string, string | number | boolean>,
  ): Promise<void> {
    await this.trackEvent(userId, 'feature_used', {
      feature,
      action,
      ...metadata,
    });
  }

  /**
   * Get comprehensive workout analytics for a user
   */
  async getWorkoutAnalytics(
    userId: string,
    timeframe: 'week' | 'month' | 'year' = 'month',
  ): Promise<WorkoutAnalytics> {
    try {
      addBreadcrumb('Starting workout analytics calculation', 'analytics', {
        userId,
        timeframe,
      });
      const endDate = new Date();
      const startDate = new Date();

      switch (timeframe) {
        case 'week':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(endDate.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      // Get workout sessions data
      const workoutResponse = await apiClient.get<WorkoutSessionData[]>(
        `/rest/v1/workout_sessions?user_id=eq.${userId}&created_at=gte.${startDate.toISOString()}&created_at=lte.${endDate.toISOString()}`,
        {
          cache: { enabled: true, ttl: 300000, tags: ['analytics', `user:${userId}`, 'workouts'] },
          auth: { required: true },
        },
      );

      const workouts = Array.isArray(workoutResponse.data) ? workoutResponse.data : [];

      // Calculate analytics
      const totalWorkouts = workouts.length;
      const totalDuration = workouts.reduce(
        (sum: number, w: WorkoutSessionData) => sum + (w.duration || 0),
        0,
      );
      const totalVolume = workouts.reduce(
        (sum: number, w: WorkoutSessionData) => sum + (w.total_volume || 0),
        0,
      );

      // Get exercise frequency data
      const exerciseResponse = await apiClient.get<ExerciseRecordData[]>(
        `/rest/v1/user_exercise_records?user_id=eq.${userId}&created_at=gte.${startDate.toISOString()}`,
        {
          cache: { enabled: true, ttl: 300000, tags: ['analytics', `user:${userId}`, 'exercises'] },
          auth: { required: true },
        },
      );

      const exerciseRecords = Array.isArray(exerciseResponse.data) ? exerciseResponse.data : [];
      const exerciseFrequency = new Map<string, { count: number; name: string }>();

      exerciseRecords.forEach((record: ExerciseRecordData) => {
        const key = record.exercise_id;
        if (exerciseFrequency.has(key)) {
          exerciseFrequency.get(key)!.count++;
        } else {
          exerciseFrequency.set(key, { count: 1, name: record.exercise_name || 'Unknown' });
        }
      });

      const favoriteExercises = Array.from(exerciseFrequency.entries())
        .map(([exerciseId, data]) => ({ exerciseId, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate trends (simplified)
      const recentWorkouts = workouts.slice(-10);
      const olderWorkouts = workouts.slice(0, -10);

      const recentAvgVolume =
        recentWorkouts.reduce(
          (sum: number, w: WorkoutSessionData) => sum + (w.total_volume || 0),
          0,
        ) / Math.max(recentWorkouts.length, 1);
      const olderAvgVolume =
        olderWorkouts.reduce(
          (sum: number, w: WorkoutSessionData) => sum + (w.total_volume || 0),
          0,
        ) / Math.max(olderWorkouts.length, 1);

      const volumeTrend =
        recentAvgVolume > olderAvgVolume * 1.1
          ? 'increasing'
          : recentAvgVolume < olderAvgVolume * 0.9
            ? 'decreasing'
            : 'stable';

      const analytics: WorkoutAnalytics = {
        totalWorkouts,
        totalDuration,
        averageDuration: totalWorkouts > 0 ? totalDuration / totalWorkouts : 0,
        totalVolume,
        averageVolume: totalWorkouts > 0 ? totalVolume / totalWorkouts : 0,
        favoriteExercises,
        workoutFrequency: {
          weekly: timeframe === 'week' ? totalWorkouts : Math.round(totalWorkouts / 4),
          monthly: timeframe === 'month' ? totalWorkouts : Math.round(totalWorkouts / 12),
        },
        progressTrends: {
          volumeTrend,
          durationTrend: 'stable', // Simplified for now
          frequencyTrend: 'stable', // Simplified for now
        },
      };

      addBreadcrumb('Workout analytics calculated successfully', 'analytics', {
        userId,
        timeframe,
        totalWorkouts,
        totalDuration,
      });

      logger.info('Workout analytics calculated', {
        context: { userId, timeframe, totalWorkouts, totalDuration },
      });

      return analytics;
    } catch (error) {
      logger.error('Error calculating workout analytics', error as Error, {
        context: { userId, timeframe },
      });
      captureError(error as Error, {
        category: 'api_error',
        component: 'AnalyticsService',
        userId,
      });
      throw error;
    }
  }

  /**
   * Get user performance metrics
   */
  async getPerformanceMetrics(userId: string): Promise<PerformanceMetrics> {
    try {
      // Get strength progress data
      const strengthResponse = await apiClient.get<ExerciseRecordData[]>(
        `/rest/v1/user_exercise_records?user_id=eq.${userId}&order=created_at.asc`,
        {
          cache: { enabled: true, ttl: 300000, tags: ['analytics', `user:${userId}`, 'strength'] },
          auth: { required: true },
        },
      );

      const strengthRecords = Array.isArray(strengthResponse.data) ? strengthResponse.data : [];

      // Calculate strength progress per exercise
      const exerciseProgress = new Map<string, { name: string; records: ExerciseRecordData[] }>();
      strengthRecords.forEach((record: ExerciseRecordData) => {
        const key = record.exercise_id;
        if (!exerciseProgress.has(key)) {
          exerciseProgress.set(key, { name: record.exercise_name || 'Unknown', records: [] });
        }
        exerciseProgress.get(key)!.records.push(record);
      });

      const strengthProgress = Array.from(exerciseProgress.entries())
        .map(([exerciseId, data]) => {
          const records = data.records.sort(
            (a: ExerciseRecordData, b: ExerciseRecordData) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
          );
          const initialMax = Math.max(
            ...records.slice(0, 5).map((r: ExerciseRecordData) => r.weight || 0),
          );
          const currentMax = Math.max(
            ...records.slice(-5).map((r: ExerciseRecordData) => r.weight || 0),
          );
          const improvement = currentMax - initialMax;
          const improvementPercentage = initialMax > 0 ? (improvement / initialMax) * 100 : 0;

          return {
            exerciseId,
            exerciseName: data.name,
            initialMax,
            currentMax,
            improvement,
            improvementPercentage,
          };
        })
        .filter((p) => p.improvement > 0)
        .sort((a, b) => b.improvementPercentage - a.improvementPercentage)
        .slice(0, 10);

      // Get measurement progress
      const measurementResponse = await apiClient.get<MeasurementData[]>(
        `/rest/v1/user_measurements?user_id=eq.${userId}&order=measured_at.asc`,
        {
          cache: {
            enabled: true,
            ttl: 300000,
            tags: ['analytics', `user:${userId}`, 'measurements'],
          },
          auth: { required: true },
        },
      );

      const measurements = Array.isArray(measurementResponse.data) ? measurementResponse.data : [];
      const measurementsByCategory = new Map<string, MeasurementData[]>();

      measurements.forEach((m: MeasurementData) => {
        if (!measurementsByCategory.has(m.category)) {
          measurementsByCategory.set(m.category, []);
        }
        measurementsByCategory.get(m.category)!.push(m);
      });

      const measurementProgress = Array.from(measurementsByCategory.entries()).map(
        ([category, categoryMeasurements]) => {
          const sortedMeasurements = categoryMeasurements.sort(
            (a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime(),
          );
          const initialValue = sortedMeasurements[0]?.value || 0;
          const currentValue = sortedMeasurements[sortedMeasurements.length - 1]?.value || 0;
          const change = currentValue - initialValue;
          const changePercentage = initialValue > 0 ? (change / initialValue) * 100 : 0;

          return {
            category,
            initialValue,
            currentValue,
            change,
            changePercentage,
          };
        },
      );

      // Calculate consistency score (simplified)
      const consistencyScore = Math.min(100, (strengthRecords.length / 30) * 100);

      // Calculate goal achievement rate (placeholder)
      const goalAchievementRate = 75; // This would be calculated based on actual goals

      return {
        strengthProgress,
        measurementProgress,
        consistencyScore,
        goalAchievementRate,
      };
    } catch (error) {
      logger.error('Error calculating performance metrics', error as Error, {
        context: { userId },
      });
      throw error;
    }
  }

  /**
   * Get user engagement metrics (admin only)
   */
  async getUserEngagementMetrics(
    timeframe: 'day' | 'week' | 'month' = 'week',
  ): Promise<UserEngagementMetrics> {
    try {
      // This would typically require admin privileges
      const endDate = new Date();
      const startDate = new Date();

      switch (timeframe) {
        case 'day':
          startDate.setDate(endDate.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(endDate.getMonth() - 1);
          break;
      }

      // Get analytics events for engagement calculation
      const eventsResponse = await apiClient.get<AnalyticsEvent[]>(
        `/rest/v1/analytics_events?timestamp=gte.${startDate.toISOString()}&timestamp=lte.${endDate.toISOString()}`,
        {
          cache: { enabled: true, ttl: 600000, tags: ['analytics', 'engagement'] },
          auth: { required: true },
        },
      );

      const events = Array.isArray(eventsResponse.data) ? eventsResponse.data : [];

      // Calculate engagement metrics
      const uniqueUsers = new Set(events.map((e) => e.userId));
      const sessions = new Map<string, { start: Date; end: Date }>();

      events.forEach((event) => {
        if (event.sessionId) {
          if (!sessions.has(event.sessionId)) {
            sessions.set(event.sessionId, { start: event.timestamp, end: event.timestamp });
          } else {
            const session = sessions.get(event.sessionId)!;
            if (event.timestamp < session.start) session.start = event.timestamp;
            if (event.timestamp > session.end) session.end = event.timestamp;
          }
        }
      });

      const sessionDurations = Array.from(sessions.values()).map(
        (session) => session.end.getTime() - session.start.getTime(),
      );

      const averageSessionDuration =
        sessionDurations.length > 0
          ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
          : 0;

      // Feature usage calculation
      const featureUsage: Record<string, number> = {};
      events
        .filter((e) => e.eventType === 'feature_used')
        .forEach((e) => {
          const feature = e.eventData.feature as string;
          if (feature) {
            featureUsage[feature] = (featureUsage[feature] || 0) + 1;
          }
        });

      return {
        dailyActiveUsers: uniqueUsers.size,
        weeklyActiveUsers: uniqueUsers.size, // Simplified
        monthlyActiveUsers: uniqueUsers.size, // Simplified
        averageSessionDuration: averageSessionDuration / 1000 / 60, // Convert to minutes
        retentionRate: {
          day1: 85, // Placeholder values
          day7: 65,
          day30: 45,
        },
        featureUsage,
      };
    } catch (error) {
      logger.error('Error calculating engagement metrics', error as Error);
      throw error;
    }
  }

  /**
   * End current session
   */
  async endSession(userId: string): Promise<void> {
    if (this.sessionId && this.sessionStartTime) {
      const sessionDuration = Date.now() - this.sessionStartTime.getTime();

      await this.trackEvent(userId, 'app_opened', {
        sessionDuration: Math.round(sessionDuration / 1000), // in seconds
        sessionEnd: true,
      });

      logger.info('Analytics session ended', {
        context: { sessionId: this.sessionId, duration: sessionDuration },
      });
    }

    this.sessionId = null;
    this.sessionStartTime = null;
  }

  /**
   * Get current session information
   */
  getSessionInfo(): { sessionId: string | null; startTime: Date | null; duration: number } {
    const duration = this.sessionStartTime ? Date.now() - this.sessionStartTime.getTime() : 0;

    return {
      sessionId: this.sessionId,
      startTime: this.sessionStartTime,
      duration,
    };
  }
}

// Export singleton instance
export const analyticsService = AnalyticsService.getInstance();
export default analyticsService;
