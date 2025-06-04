import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { apiClient } from './apiClient';
import supabase from './supabase';

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
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {
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
    try {
      const subscriptionId = `${table}_${event}_${Date.now()}`;
      const channelName = `${table}_changes`;

      logger.info('Creating realtime subscription', {
        context: { subscriptionId, table, event, filter },
      });

      // Create or get existing channel
      let channel = this.channels.get(channelName);
      if (!channel) {
        channel = supabase.channel(channelName);
        this.channels.set(channelName, channel);
      }

      // Setup postgres changes listener
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
          this.messageCount++;
          logger.debug('Realtime message received', {
            context: { table, event, payloadType: payload.eventType },
          });

          try {
            callback(payload);
          } catch (error) {
            logger.error('Error in realtime callback', error as Error, {
              context: { subscriptionId, table, event },
            });
          }
        },
      );

      // Subscribe to the channel
      await channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Realtime subscription active', {
            context: { subscriptionId, table, event },
          });
          this.connectionStartTime = new Date();
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('Realtime subscription error', new Error('Channel error'), {
            context: { subscriptionId, table, event },
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

      logger.info('Realtime subscription created successfully', {
        context: { subscriptionId, table, event },
      });

      return subscriptionId;
    } catch (error) {
      logger.error('Error creating realtime subscription', error as Error, {
        context: { table, event },
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
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        logger.warn('Subscription not found for unsubscribe', {
          context: { subscriptionId },
        });
        return;
      }

      const channel = this.channels.get(subscription.channel);
      if (channel) {
        await channel.unsubscribe();
        this.channels.delete(subscription.channel);
      }

      subscription.isActive = false;
      this.subscriptions.delete(subscriptionId);

      logger.info('Realtime subscription removed', {
        context: { subscriptionId, table: subscription.table },
      });
    } catch (error) {
      logger.error('Error unsubscribing from realtime', error as Error, {
        context: { subscriptionId },
      });
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
    try {
      const notificationData: NotificationPayload = {
        ...notification,
        id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
      };

      // Validate notification data (basic validation)
      if (!notificationData.userId || !notificationData.type || !notificationData.title) {
        throw new Error('Invalid notification data: missing required fields');
      }

      // Store notification in database
      await apiClient.post('/rest/v1/notifications', notificationData, {
        auth: { required: true },
        cache: { enabled: false },
      });

      // Send real-time notification via channel
      const userChannel = supabase.channel(`user_${notification.userId}_notifications`);

      await userChannel.send({
        type: 'broadcast',
        event: 'notification',
        payload: notificationData,
      });

      logger.info('Real-time notification sent', {
        context: { userId: notification.userId, type: notification.type },
      });
    } catch (error) {
      logger.error('Error sending real-time notification', error as Error, {
        context: { userId: notification.userId, type: notification.type },
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
    this.heartbeatInterval = setInterval(() => {
      // Send heartbeat to maintain connection
      logger.debug('Realtime heartbeat', {
        context: { activeSubscriptions: this.subscriptions.size },
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Cleanup all subscriptions and connections
   */
  async cleanup(): Promise<void> {
    try {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      await this.unsubscribeAll();

      // Clear all channels
      for (const channel of this.channels.values()) {
        await channel.unsubscribe();
      }
      this.channels.clear();

      this.connectionStartTime = null;
      this.messageCount = 0;

      logger.info('Realtime service cleanup completed');
    } catch (error) {
      logger.error('Error during realtime service cleanup', error as Error);
    }
  }
}

// Export singleton instance
export const realtimeService = RealtimeService.getInstance();
export default realtimeService;
