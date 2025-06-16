import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { apiClient } from './apiClient';
import supabase from './supabase';
import {
  captureAPIError,
  captureNetworkError,
  capturePerformanceError,
  captureValidationError,
  setContext,
  setTag,
} from './sentry';
import { addBreadcrumb, captureMessage } from './sentry/simpleErrorHandler';

// Define proper types for realtime data
export interface DatabaseRecord {
  id: string;
  created_at: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface RealtimeSubscription {
  id: string;
  channel: string;
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  isActive: boolean;
  createdAt: Date;
}

export interface NotificationPayload {
  id: string;
  userId: string;
  type: 'workout_reminder' | 'achievement_unlocked' | 'progress_update' | 'coaching_insight';
  title: string;
  message: string;
  data?: Record<string, string | number | boolean>;
  priority: 'low' | 'normal' | 'high';
  scheduledFor?: Date;
  createdAt: Date;
}

export interface RealtimeStats {
  activeSubscriptions: number;
  totalMessages: number;
  connectionUptime: number;
  lastHeartbeat: Date;
}

export interface WorkoutSessionUpdate extends DatabaseRecord {
  user_id: string;
  plan_id?: string;
  workout_day?: number;
  duration?: number;
  total_volume?: number;
  status: string;
}

export interface AchievementUpdate extends DatabaseRecord {
  user_id: string;
  achievement_id: string;
  achievement_name: string;
  category: string;
  unlocked_at: string;
}

export interface MeasurementUpdate extends DatabaseRecord {
  user_id: string;
  category: string;
  value: number;
  unit: string;
  measured_at: string;
}

class RealtimeService {
  private static instance: RealtimeService;
  private subscriptions = new Map<string, RealtimeSubscription>();
  private channels = new Map<string, RealtimeChannel>();
  private connectionStartTime: Date | null = null;
  private messageCount = 0;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    // Set up Sentry context for realtime service
    setContext('realtime_service', {
      service: 'RealtimeService',
      version: '1.0.0',
      features: ['subscriptions', 'notifications', 'heartbeat', 'cleanup'],
    });
    setTag('service.type', 'realtime');

    addBreadcrumb('RealtimeService initialized', 'system', {
      timestamp: new Date().toISOString(),
    });

    this.setupHeartbeat();
  }

  public static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  /**
   * Subscribe to real-time changes on a specific table
   */
  async subscribeToTable(
    table: string,
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
    filter?: string,
  ): Promise<string> {
    const startTime = Date.now();
    const subscriptionId = `${table}_${event}_${Date.now()}`;
    const channelName = `${table}_changes`;

    addBreadcrumb('Starting realtime subscription', 'subscription', {
      subscriptionId,
      table,
      event,
      filter,
      operation: 'subscribeToTable',
    });

    setContext('realtime_subscription', {
      subscriptionId,
      table,
      event,
      filter,
      startTime: new Date(startTime).toISOString(),
    });

    try {
      // Validate input parameters
      if (!table || typeof table !== 'string') {
        const validationError = new Error('Valid table name is required');
        captureValidationError(validationError, 'table', table);
        throw validationError;
      }

      if (!['INSERT', 'UPDATE', 'DELETE', '*'].includes(event)) {
        const validationError = new Error('Valid event type is required');
        captureValidationError(validationError, 'event', event);
        throw validationError;
      }

      logger.info('Creating realtime subscription', {
        context: { subscriptionId, table, event, filter },
      });

      // Create or get existing channel
      let channel = this.channels.get(channelName);
      if (!channel) {
        addBreadcrumb('Creating new realtime channel', 'channel', {
          channelName,
          table,
          subscriptionId,
        });

        channel = supabase.channel(channelName);
        this.channels.set(channelName, channel);
      } else {
        addBreadcrumb('Reusing existing realtime channel', 'channel', {
          channelName,
          table,
          subscriptionId,
        });
      }

      // Setup postgres changes listener with enhanced error tracking
      // Note: Using type assertion due to Supabase realtime API type limitations
      (
        channel as unknown as {
          on: (
            event: string,
            config: {
              event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
              schema: string;
              table: string;
              filter?: string;
            },
            callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
          ) => void;
        }
      ).on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table,
          filter,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const messageStartTime = Date.now();
          this.messageCount++;

          addBreadcrumb('Realtime message received', 'message', {
            subscriptionId,
            table,
            event,
            payloadType: payload.eventType,
            messageCount: this.messageCount,
          });

          logger.debug('Realtime message received', {
            context: { table, event, payloadType: payload.eventType },
          });

          try {
            callback(payload);

            const messageProcessTime = Date.now() - messageStartTime;

            // Track slow message processing
            if (messageProcessTime > 1000) {
              // 1 second
              capturePerformanceError(
                'Slow realtime message processing',
                'message_processing_time',
                messageProcessTime,
              );
            }

            addBreadcrumb('Realtime message processed successfully', 'message', {
              subscriptionId,
              table,
              processingTime: messageProcessTime,
            });
          } catch (error) {
            const messageProcessTime = Date.now() - messageStartTime;

            logger.error('Error in realtime callback', error as Error, {
              context: { subscriptionId, table, event },
            });

            captureAPIError(error as Error, `realtime_callback_${table}`, 'realtime');

            addBreadcrumb('Realtime message processing failed', 'error', {
              subscriptionId,
              table,
              event,
              processingTime: messageProcessTime,
              error: (error as Error).message,
            });
          }
        },
      );

      // Subscribe to the channel with enhanced status tracking
      await channel.subscribe((status) => {
        addBreadcrumb('Realtime subscription status changed', 'subscription', {
          subscriptionId,
          table,
          event,
          status,
        });

        if (status === 'SUBSCRIBED') {
          logger.info('Realtime subscription active', {
            context: { subscriptionId, table, event },
          });

          this.connectionStartTime = new Date();
          const setupDuration = Date.now() - startTime;

          captureMessage('Realtime subscription established', 'info', {
            category: 'network_error',
            subscriptionId,
            table,
            event,
            setupDuration,
          });

          // Track slow subscription setup
          if (setupDuration > 5000) {
            // 5 seconds
            capturePerformanceError(
              'Slow realtime subscription setup',
              'subscription_setup_time',
              setupDuration,
            );
          }
        } else if (status === 'CHANNEL_ERROR') {
          const setupDuration = Date.now() - startTime;
          const channelError = new Error('Realtime channel error');

          logger.error('Realtime subscription error', channelError, {
            context: { subscriptionId, table, event },
          });

          captureNetworkError(channelError, `realtime_channel_${table}`, 'SUBSCRIBE', undefined);

          addBreadcrumb('Realtime subscription error', 'error', {
            subscriptionId,
            table,
            event,
            status,
            setupDuration,
          });
        } else if (status === 'CLOSED') {
          addBreadcrumb('Realtime subscription closed', 'subscription', {
            subscriptionId,
            table,
            event,
            status,
          });
        } else if (status === 'TIMED_OUT') {
          const timeoutError = new Error('Realtime subscription timed out');
          captureNetworkError(timeoutError, `realtime_timeout_${table}`, 'SUBSCRIBE', 408);

          addBreadcrumb('Realtime subscription timed out', 'error', {
            subscriptionId,
            table,
            event,
            status,
          });
        }
      });

      // Store subscription info
      const subscription: RealtimeSubscription = {
        id: subscriptionId,
        channel: channelName,
        table,
        event,
        callback,
        isActive: true,
        createdAt: new Date(),
      };

      this.subscriptions.set(subscriptionId, subscription);

      const totalDuration = Date.now() - startTime;

      logger.info('Realtime subscription created successfully', {
        context: { subscriptionId, table, event },
      });

      addBreadcrumb('Realtime subscription created successfully', 'subscription', {
        subscriptionId,
        table,
        event,
        totalDuration,
        activeSubscriptions: this.subscriptions.size,
      });

      captureMessage('Realtime subscription created', 'info', {
        category: 'network_error',
        subscriptionId,
        table,
        event,
        totalDuration,
        activeSubscriptions: this.subscriptions.size,
      });

      return subscriptionId;
    } catch (error) {
      const totalDuration = Date.now() - startTime;

      logger.error('Error creating realtime subscription', error as Error, {
        context: { table, event },
      });

      captureNetworkError(error as Error, `realtime_subscribe_${table}`, 'SUBSCRIBE', undefined);

      addBreadcrumb('Realtime subscription creation failed', 'error', {
        subscriptionId,
        table,
        event,
        totalDuration,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Subscribe to workout session updates for a user
   */
  async subscribeToWorkoutUpdates(
    userId: string,
    callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  ): Promise<string> {
    return this.subscribeToTable('workout_sessions', '*', callback, `user_id=eq.${userId}`);
  }

  /**
   * Subscribe to achievement updates for a user
   */
  async subscribeToAchievementUpdates(
    userId: string,
    callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  ): Promise<string> {
    return this.subscribeToTable('user_achievements', '*', callback, `user_id=eq.${userId}`);
  }

  /**
   * Subscribe to measurement updates for a user
   */
  async subscribeToMeasurementUpdates(
    userId: string,
    callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  ): Promise<string> {
    return this.subscribeToTable('user_measurements', '*', callback, `user_id=eq.${userId}`);
  }

  /**
   * Unsubscribe from a specific subscription
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const startTime = Date.now();

    addBreadcrumb('Starting realtime unsubscribe', 'subscription', {
      subscriptionId,
      operation: 'unsubscribe',
    });

    try {
      // Validate subscription ID
      if (!subscriptionId || typeof subscriptionId !== 'string') {
        const validationError = new Error('Valid subscription ID is required');
        captureValidationError(validationError, 'subscriptionId', subscriptionId);
        throw validationError;
      }

      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        logger.warn('Subscription not found for unsubscribe', {
          context: { subscriptionId },
        });

        addBreadcrumb('Subscription not found for unsubscribe', 'warning', {
          subscriptionId,
          activeSubscriptions: this.subscriptions.size,
        });

        return;
      }

      addBreadcrumb('Found subscription for unsubscribe', 'subscription', {
        subscriptionId,
        table: subscription.table,
        event: subscription.event,
        channel: subscription.channel,
        isActive: subscription.isActive,
      });

      const channel = this.channels.get(subscription.channel);
      if (channel) {
        addBreadcrumb('Unsubscribing from channel', 'channel', {
          subscriptionId,
          channelName: subscription.channel,
        });

        await channel.unsubscribe();
        this.channels.delete(subscription.channel);

        addBreadcrumb('Channel unsubscribed successfully', 'channel', {
          subscriptionId,
          channelName: subscription.channel,
        });
      }

      subscription.isActive = false;
      this.subscriptions.delete(subscriptionId);

      const duration = Date.now() - startTime;

      logger.info('Realtime subscription removed', {
        context: { subscriptionId, table: subscription.table },
      });

      addBreadcrumb('Realtime subscription removed successfully', 'subscription', {
        subscriptionId,
        table: subscription.table,
        duration,
        remainingSubscriptions: this.subscriptions.size,
      });

      captureMessage('Realtime subscription removed', 'info', {
        category: 'network_error',
        subscriptionId,
        table: subscription.table,
        duration,
        remainingSubscriptions: this.subscriptions.size,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Error unsubscribing from realtime', error as Error, {
        context: { subscriptionId },
      });

      captureNetworkError(
        error as Error,
        `realtime_unsubscribe_${subscriptionId}`,
        'UNSUBSCRIBE',
        undefined,
      );

      addBreadcrumb('Realtime unsubscribe failed', 'error', {
        subscriptionId,
        duration,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Unsubscribe from all active subscriptions
   */
  async unsubscribeAll(): Promise<void> {
    try {
      const subscriptionIds = Array.from(this.subscriptions.keys());

      for (const subscriptionId of subscriptionIds) {
        await this.unsubscribe(subscriptionId);
      }

      logger.info('All realtime subscriptions removed', {
        context: { removedCount: subscriptionIds.length },
      });
    } catch (error) {
      logger.error('Error unsubscribing from all realtime subscriptions', error as Error);
    }
  }

  /**
   * Send a real-time notification to a user
   */
  async sendNotification(
    notification: Omit<NotificationPayload, 'id' | 'createdAt'>,
  ): Promise<void> {
    const startTime = Date.now();
    const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    addBreadcrumb('Starting notification send', 'notification', {
      notificationId,
      userId: notification.userId,
      type: notification.type,
      priority: notification.priority,
      operation: 'sendNotification',
    });

    setContext('notification_send', {
      notificationId,
      userId: notification.userId,
      type: notification.type,
      priority: notification.priority,
      startTime: new Date(startTime).toISOString(),
    });

    try {
      const notificationData: NotificationPayload = {
        ...notification,
        id: notificationId,
        createdAt: new Date(),
      };

      // Validate notification data
      if (!notificationData.userId || !notificationData.type || !notificationData.title) {
        const validationError = new Error('Invalid notification data: missing required fields');
        captureValidationError(validationError, 'notificationData', {
          hasUserId: !!notificationData.userId,
          hasType: !!notificationData.type,
          hasTitle: !!notificationData.title,
        });
        throw validationError;
      }

      if (
        ![
          'workout_reminder',
          'achievement_unlocked',
          'progress_update',
          'coaching_insight',
        ].includes(notification.type)
      ) {
        const validationError = new Error('Invalid notification type');
        captureValidationError(validationError, 'notificationType', notification.type);
        throw validationError;
      }

      addBreadcrumb('Notification validation passed', 'validation', {
        notificationId,
        userId: notification.userId,
        type: notification.type,
        titleLength: notification.title.length,
        messageLength: notification.message.length,
      });

      // Store notification in database
      const dbStartTime = Date.now();
      await apiClient.post('/rest/v1/notifications', notificationData, {
        auth: { required: true },
        cache: { enabled: false },
      });

      const dbDuration = Date.now() - dbStartTime;
      addBreadcrumb('Notification stored in database', 'database', {
        notificationId,
        userId: notification.userId,
        duration: dbDuration,
      });

      // Send real-time notification via channel
      const channelStartTime = Date.now();
      const userChannel = supabase.channel(`user_${notification.userId}_notifications`);

      addBreadcrumb('Sending realtime notification via channel', 'channel', {
        notificationId,
        userId: notification.userId,
        channelName: `user_${notification.userId}_notifications`,
      });

      await userChannel.send({
        type: 'broadcast',
        event: 'notification',
        payload: notificationData,
      });

      const channelDuration = Date.now() - channelStartTime;
      const totalDuration = Date.now() - startTime;

      addBreadcrumb('Notification sent via realtime channel', 'channel', {
        notificationId,
        userId: notification.userId,
        channelDuration,
        totalDuration,
      });

      logger.info('Real-time notification sent', {
        context: { userId: notification.userId, type: notification.type },
      });

      // Track performance
      if (totalDuration > 3000) {
        // 3 seconds
        capturePerformanceError('Slow notification send', 'notification_duration', totalDuration);
      }

      captureMessage('Real-time notification sent successfully', 'info', {
        category: 'network_error',
        notificationId,
        userId: notification.userId,
        type: notification.type,
        priority: notification.priority,
        totalDuration,
        dbDuration,
        channelDuration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Error sending real-time notification', error as Error, {
        context: { userId: notification.userId, type: notification.type },
      });

      captureAPIError(error as Error, 'send_notification', 'realtime');

      addBreadcrumb('Notification send failed', 'error', {
        notificationId,
        userId: notification.userId,
        type: notification.type,
        duration,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Schedule a notification for later delivery
   */
  async scheduleNotification(
    notification: Omit<NotificationPayload, 'id' | 'createdAt'>,
    scheduledFor: Date,
  ): Promise<void> {
    try {
      const notificationData: NotificationPayload = {
        ...notification,
        id: `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        scheduledFor,
        createdAt: new Date(),
      };

      // Store scheduled notification
      await apiClient.post('/rest/v1/scheduled_notifications', notificationData, {
        auth: { required: true },
        cache: { enabled: false },
      });

      logger.info('Notification scheduled', {
        context: {
          userId: notification.userId,
          type: notification.type,
          scheduledFor: scheduledFor.toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error scheduling notification', error as Error, {
        context: { userId: notification.userId, type: notification.type },
      });
      throw error;
    }
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(userId: string, limit = 50): Promise<NotificationPayload[]> {
    try {
      const response = await apiClient.get<NotificationPayload[]>(
        `/rest/v1/notifications?user_id=eq.${userId}&order=created_at.desc&limit=${limit}`,
        {
          cache: { enabled: true, ttl: 60000, tags: ['notifications', `user:${userId}`] },
          auth: { required: true },
        },
      );

      const notifications = Array.isArray(response.data) ? response.data : [];

      logger.debug('User notifications retrieved', {
        context: { userId, count: notifications.length },
      });

      return notifications;
    } catch (error) {
      logger.error('Error retrieving user notifications', error as Error, {
        context: { userId },
      });
      throw error;
    }
  }

  /**
   * Mark a notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await apiClient.patch(
        `/rest/v1/notifications?id=eq.${notificationId}`,
        { read_at: new Date().toISOString() },
        {
          auth: { required: true },
          cache: { enabled: false },
        },
      );

      logger.debug('Notification marked as read', {
        context: { notificationId },
      });
    } catch (error) {
      logger.error('Error marking notification as read', error as Error, {
        context: { notificationId },
      });
      throw error;
    }
  }

  /**
   * Get realtime service statistics
   */
  getStats(): RealtimeStats {
    const uptime = this.connectionStartTime ? Date.now() - this.connectionStartTime.getTime() : 0;

    return {
      activeSubscriptions: this.subscriptions.size,
      totalMessages: this.messageCount,
      connectionUptime: uptime,
      lastHeartbeat: new Date(),
    };
  }

  /**
   * Setup heartbeat to maintain connection
   */
  private setupHeartbeat(): void {
    addBreadcrumb('Setting up realtime heartbeat', 'system', {
      interval: 30000,
      operation: 'setupHeartbeat',
    });

    this.heartbeatInterval = setInterval(() => {
      const stats = this.getStats();

      // Send heartbeat to maintain connection
      logger.debug('Realtime heartbeat', {
        context: {
          activeSubscriptions: this.subscriptions.size,
          totalMessages: this.messageCount,
          uptime: stats.connectionUptime,
        },
      });

      addBreadcrumb('Realtime heartbeat pulse', 'heartbeat', {
        activeSubscriptions: this.subscriptions.size,
        totalMessages: this.messageCount,
        uptime: stats.connectionUptime,
        timestamp: new Date().toISOString(),
      });

      // Track health metrics
      if (this.subscriptions.size > 20) {
        capturePerformanceError(
          'High number of realtime subscriptions',
          'subscription_count',
          this.subscriptions.size,
        );
      }

      if (stats.connectionUptime > 24 * 60 * 60 * 1000) {
        // 24 hours
        captureMessage('Long-running realtime connection', 'info', {
          category: 'network_error',
          uptime: stats.connectionUptime,
          activeSubscriptions: this.subscriptions.size,
          totalMessages: this.messageCount,
        });
      }
    }, 30000); // Every 30 seconds

    captureMessage('Realtime heartbeat established', 'info', {
      category: 'network_error',
      interval: 30000,
    });
  }

  /**
   * Cleanup all subscriptions and connections
   */
  async cleanup(): Promise<void> {
    const startTime = Date.now();

    addBreadcrumb('Starting realtime service cleanup', 'system', {
      activeSubscriptions: this.subscriptions.size,
      activeChannels: this.channels.size,
      totalMessages: this.messageCount,
      operation: 'cleanup',
    });

    setContext('realtime_cleanup', {
      activeSubscriptions: this.subscriptions.size,
      activeChannels: this.channels.size,
      startTime: new Date(startTime).toISOString(),
    });

    try {
      // Clear heartbeat interval
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;

        addBreadcrumb('Heartbeat interval cleared', 'system', {
          operation: 'cleanup',
        });
      }

      // Unsubscribe from all subscriptions
      const subscriptionCount = this.subscriptions.size;
      await this.unsubscribeAll();

      addBreadcrumb('All subscriptions unsubscribed', 'cleanup', {
        removedSubscriptions: subscriptionCount,
      });

      // Clear all channels
      const channelCount = this.channels.size;
      const channelCleanupStart = Date.now();

      for (const [channelName, channel] of this.channels.entries()) {
        try {
          await channel.unsubscribe();
          addBreadcrumb('Channel cleaned up', 'channel', {
            channelName,
          });
        } catch (error) {
          addBreadcrumb('Channel cleanup failed', 'error', {
            channelName,
            error: (error as Error).message,
          });
        }
      }

      this.channels.clear();

      const channelCleanupDuration = Date.now() - channelCleanupStart;
      addBreadcrumb('All channels cleared', 'cleanup', {
        clearedChannels: channelCount,
        duration: channelCleanupDuration,
      });

      // Reset service state
      const previousUptime = this.connectionStartTime
        ? Date.now() - this.connectionStartTime.getTime()
        : 0;
      const previousMessageCount = this.messageCount;

      this.connectionStartTime = null;
      this.messageCount = 0;

      const totalDuration = Date.now() - startTime;

      logger.info('Realtime service cleanup completed');

      addBreadcrumb('Realtime service cleanup completed', 'system', {
        totalDuration,
        clearedSubscriptions: subscriptionCount,
        clearedChannels: channelCount,
        previousUptime,
        previousMessageCount,
      });

      captureMessage('Realtime service cleanup completed successfully', 'info', {
        category: 'network_error',
        totalDuration,
        clearedSubscriptions: subscriptionCount,
        clearedChannels: channelCount,
        previousUptime,
        previousMessageCount,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Error during realtime service cleanup', error as Error);

      captureNetworkError(error as Error, 'realtime_cleanup', 'CLEANUP', undefined);

      addBreadcrumb('Realtime service cleanup failed', 'error', {
        duration,
        error: (error as Error).message,
        activeSubscriptions: this.subscriptions.size,
        activeChannels: this.channels.size,
      });

      throw error;
    }
  }
}

// Export singleton instance
export const realtimeService = RealtimeService.getInstance();

// Track service initialization
addBreadcrumb('RealtimeService singleton created', 'system', {
  timestamp: new Date().toISOString(),
  service: 'realtimeService',
});

captureMessage('RealtimeService initialized successfully', 'info', {
  category: 'network_error',
  service: 'realtimeService',
  features: ['subscriptions', 'notifications', 'heartbeat', 'cleanup'],
  heartbeatInterval: 30000,
});

export default realtimeService;
