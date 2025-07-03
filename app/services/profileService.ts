import { User } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from '../utils/logger';
import {
  ProfileUpdateSchema,
  UserProfileSchema,
  ProfileCompletionCheckSchema,
  CreateDefaultProfileDetailsSchema,
  UserProfileDetails,
  ProfileCompletionCheck,
} from '../validation/schemas';
import { apiClient } from './apiClient';
import { CachePriority } from './enhancedCacheManager';
import { captureException } from './sentry';
import { SentryDataCollection } from './sentry/dataCollection';
import { SentryLogger } from './sentry/logger';
import supabase from './supabase';
import { validationService } from './validationService';

export interface Profile {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
  avatar_url?: string;
  user_metadata?: Record<string, unknown>;
}

export interface ProfileUpdateRequest {
  full_name?: string;
  avatar_url?: string;
  preferences?: Record<string, unknown>;
}

export interface ProfileStats {
  profileCompleteness: number;
  lastUpdated: Date;
  accountAge: number; // days
  hasAvatar: boolean;
  hasPreferences: boolean;
}

export interface ProfileServiceMetrics {
  profileFetches: number;
  profileUpdates: number;
  cacheHitRate: number;
  averageResponseTime: number;
  errorRate: number;
}

// API response schemas
const ProfileResponseSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  full_name: z.string().optional(),
  avatar_url: z.string().url().optional().or(z.literal('')),
  created_at: z.string(),
  updated_at: z.string(),
  user_metadata: z.record(z.unknown()).optional(),
});

const ProfilesListResponseSchema = z.array(ProfileResponseSchema);

class ProfileService {
  private static readonly CACHE_TTL = 300000; // 5 minutes
  private static readonly PROFILE_TABLE = 'profiles';
  private static metrics: ProfileServiceMetrics = {
    profileFetches: 0,
    profileUpdates: 0,
    cacheHitRate: 0,
    averageResponseTime: 0,
    errorRate: 0,
  };
  private static performanceTimers: Map<string, number> = new Map();

  /**
   * Start performance timer for an operation
   */
  private static startTimer(operation: string): void {
    this.performanceTimers.set(operation, Date.now());
  }

  /**
   * End performance timer and update metrics
   */
  private static endTimer(operation: string): number {
    const startTime = this.performanceTimers.get(operation);
    if (!startTime) return 0;

    const duration = Date.now() - startTime;
    this.performanceTimers.delete(operation);

    // Update average response time
    this.metrics.averageResponseTime = (this.metrics.averageResponseTime + duration) / 2;

    return duration;
  }

  /**
   * Update error rate metrics
   */
  private static updateErrorRate(hasError: boolean): void {
    const totalOperations = this.metrics.profileFetches + this.metrics.profileUpdates;
    if (totalOperations === 0) return;

    if (hasError) {
      this.metrics.errorRate =
        (this.metrics.errorRate * totalOperations + 1) / (totalOperations + 1);
    } else {
      this.metrics.errorRate = (this.metrics.errorRate * totalOperations) / (totalOperations + 1);
    }
  }

  /**
   * Transform and validate profile data from API response
   */
  private static transformProfile(profileData: unknown): Profile | null {
    const validationResult = validationService.validateApiResponse(
      ProfileResponseSchema,
      profileData,
      'profile',
    );

    if (!validationResult) {
      logger.warn('Invalid profile data received from API', {
        context: { profileData },
      });
      return null;
    }

    return {
      id: validationResult.id,
      email: validationResult.email || '',
      name: validationResult.full_name || '',
      created_at: validationResult.created_at,
      updated_at: validationResult.updated_at,
      avatar_url: validationResult.avatar_url || undefined,
      user_metadata: validationResult.user_metadata,
    };
  }

  /**
   * Calculate profile completeness score
   */
  private static calculateProfileCompleteness(profile: Profile): number {
    let score = 0;
    const totalFields = 5;

    if (profile.name && profile.name.trim() !== '') score++;
    if (profile.email && profile.email.trim() !== '') score++;
    if (profile.avatar_url) score++;
    if (profile.user_metadata && Object.keys(profile.user_metadata).length > 0) score++;
    if (profile.created_at) score++;

    return Math.round((score / totalFields) * 100);
  }

  /**
   * Get user profile by ID with caching and validation
   */
  async getProfile(userId: string): Promise<Profile | null> {
    if (!userId || typeof userId !== 'string') {
      const error = new Error('Valid user ID is required');

      SentryDataCollection.captureException(error, {
        operation: 'get_profile_validation',
        user_id: userId,
        validation_type: 'user_id_validation',
      });

      throw error;
    }

    const operationStartTime = Date.now();
    ProfileService.startTimer(`getProfile-${userId}`);

    // Set initial context for profile fetching
    SentryDataCollection.setContext('profile_operation', {
      operation: 'get_profile',
      user_id: userId,
      timestamp: new Date().toISOString(),
      status: 'starting',
    });

    SentryDataCollection.addBreadcrumb({
      message: 'Starting to fetch user profile',
      category: 'profile.fetch',
      level: 'info',
      data: {
        user_id: userId,
        operation: 'get_profile',
      },
    });

    try {
      logger.info('Fetching user profile', { context: { userId } });

      const apiStartTime = Date.now();

      SentryDataCollection.addBreadcrumb({
        message: 'Making API request to fetch profile',
        category: 'profile.api',
        level: 'debug',
        data: {
          user_id: userId,
          endpoint: `/rest/v1/${ProfileService.PROFILE_TABLE}`,
          cache_enabled: true,
        },
      });

      const response = await apiClient.get(
        `/rest/v1/${ProfileService.PROFILE_TABLE}?id=eq.${userId}`,
        {
          cache: {
            enabled: true,
            ttl: ProfileService.CACHE_TTL,
            tags: ['profiles', `user:${userId}`],
            priority: CachePriority.HIGH,
          },
          auth: { required: true },
          processing: {
            metadata: { operation: 'getProfile' },
          },
        },
      );

      const apiDuration = Date.now() - apiStartTime;
      ProfileService.metrics.profileFetches++;

      SentryDataCollection.addBreadcrumb({
        message: 'API request completed for profile fetch',
        category: 'profile.api',
        level: 'info',
        data: {
          user_id: userId,
          api_duration: apiDuration,
          from_cache: response.fromCache,
          cache_enabled: true,
        },
      });

      if (response.fromCache) {
        ProfileService.metrics.cacheHitRate =
          (ProfileService.metrics.cacheHitRate + 1) / ProfileService.metrics.profileFetches;
      }

      // Validate response structure
      const validationStartTime = Date.now();

      SentryDataCollection.addBreadcrumb({
        message: 'Starting profile data validation',
        category: 'profile.validation',
        level: 'debug',
        data: {
          user_id: userId,
          has_response_data: !!response.data,
        },
      });

      const validationResult = validationService.validateApiResponse(
        ProfilesListResponseSchema,
        response.data,
        'profiles list',
      );

      const validationDuration = Date.now() - validationStartTime;

      if (!validationResult || validationResult.length === 0) {
        const totalDuration = Date.now() - operationStartTime;

        SentryDataCollection.addBreadcrumb({
          message: 'No profile found for user',
          category: 'profile.fetch',
          level: 'info',
          data: {
            user_id: userId,
            validation_duration: validationDuration,
            total_duration: totalDuration,
          },
        });

        SentryDataCollection.setContext('profile_operation', {
          operation: 'get_profile',
          user_id: userId,
          status: 'not_found',
          total_duration: totalDuration,
          validation_duration: validationDuration,
          timestamp: new Date().toISOString(),
        });

        SentryLogger.database.query('profiles', 'get_profile', {
          user_id: userId,
          duration: totalDuration,
          result: 'not_found',
        });

        logger.info('No profile found for user', { context: { userId } });
        ProfileService.updateErrorRate(false);
        return null;
      }

      const transformStartTime = Date.now();
      const profile = ProfileService.transformProfile(validationResult[0]);
      const transformDuration = Date.now() - transformStartTime;

      if (!profile) {
        const totalDuration = Date.now() - operationStartTime;

        SentryDataCollection.captureException(new Error('Failed to transform profile data'), {
          operation: 'get_profile_transform',
          user_id: userId,
          duration: totalDuration,
          validation_duration: validationDuration,
          transform_duration: transformDuration,
        });

        SentryDataCollection.setContext('profile_operation', {
          operation: 'get_profile',
          user_id: userId,
          status: 'failed',
          error: 'transform_failed',
          total_duration: totalDuration,
          timestamp: new Date().toISOString(),
        });

        SentryLogger.database.error('profiles', 'get_profile', 'Failed to transform profile data', {
          user_id: userId,
          duration: totalDuration,
          transform_duration: transformDuration,
        });

        logger.warn('Failed to transform profile data', { context: { userId } });
        ProfileService.updateErrorRate(true);
        return null;
      }

      const totalDuration = Date.now() - operationStartTime;
      ProfileService.updateErrorRate(false);
      ProfileService.endTimer(`getProfile-${userId}`);

      SentryDataCollection.addBreadcrumb({
        message: 'Profile fetched and processed successfully',
        category: 'profile.fetch',
        level: 'info',
        data: {
          user_id: userId,
          profile_id: profile.id,
          validation_duration: validationDuration,
          transform_duration: transformDuration,
          total_duration: totalDuration,
          from_cache: response.fromCache,
        },
      });

      SentryDataCollection.setContext('profile_operation', {
        operation: 'get_profile',
        user_id: userId,
        profile_id: profile.id,
        status: 'completed',
        total_duration: totalDuration,
        validation_duration: validationDuration,
        transform_duration: transformDuration,
        from_cache: response.fromCache,
        timestamp: new Date().toISOString(),
      });

      SentryLogger.database.query('profiles', 'get_profile', {
        user_id: userId,
        profile_id: profile.id,
        duration: totalDuration,
        from_cache: response.fromCache,
      });

      logger.info('Profile fetched successfully', {
        context: { userId, profileId: profile.id },
      });

      return profile;
    } catch (error) {
      const totalDuration = Date.now() - operationStartTime;
      ProfileService.updateErrorRate(true);
      ProfileService.endTimer(`getProfile-${userId}`);

      SentryDataCollection.captureException(error as Error, {
        operation: 'get_profile',
        user_id: userId,
        duration: totalDuration,
      });

      SentryDataCollection.setContext('profile_operation', {
        operation: 'get_profile',
        user_id: userId,
        status: 'failed',
        error: (error as Error).message,
        duration: totalDuration,
        timestamp: new Date().toISOString(),
      });

      SentryLogger.database.error('profiles', 'get_profile', (error as Error).message, {
        user_id: userId,
        duration: totalDuration,
        error: error,
      });

      logger.error('Failed to fetch user profile', error as Error, {
        context: { userId, errorMessage: (error as Error).message, operation: 'getProfile' },
      });

      captureException(error as Error);

      throw error;
    }
  }

  /**
   * Update user profile with validation and caching
   */
  async updateProfile(userId: string, updates: ProfileUpdateRequest): Promise<Profile> {
    if (!userId || typeof userId !== 'string') {
      const error = new Error('Valid user ID is required');

      SentryDataCollection.captureException(error, {
        operation: 'update_profile_validation',
        user_id: userId,
        validation_type: 'user_id_validation',
      });

      throw error;
    }

    const operationStartTime = Date.now();

    // Set initial context for profile update
    SentryDataCollection.setContext('profile_operation', {
      operation: 'update_profile',
      user_id: userId,
      update_fields: Object.keys(updates),
      timestamp: new Date().toISOString(),
      status: 'starting',
    });

    SentryDataCollection.addBreadcrumb({
      message: 'Starting profile update',
      category: 'profile.update',
      level: 'info',
      data: {
        user_id: userId,
        update_fields: Object.keys(updates),
        has_full_name: 'full_name' in updates,
        has_avatar_url: 'avatar_url' in updates,
        has_preferences: 'preferences' in updates,
      },
    });

    // Validate update data
    const validationStartTime = Date.now();

    SentryDataCollection.addBreadcrumb({
      message: 'Starting profile update data validation',
      category: 'profile.validation',
      level: 'debug',
      data: {
        user_id: userId,
        update_fields: Object.keys(updates),
      },
    });

    const validationResult = validationService.validateWithSchema(
      ProfileUpdateSchema,
      updates,
      'profile update',
    );

    const validationDuration = Date.now() - validationStartTime;

    if (!validationResult.success) {
      const error = new Error(`Invalid profile update data: ${validationResult.errors.join(', ')}`);

      SentryDataCollection.captureException(error, {
        operation: 'update_profile_validation',
        user_id: userId,
        validation_errors: validationResult.errors,
        duration: validationDuration,
      });

      SentryDataCollection.setContext('profile_operation', {
        operation: 'update_profile',
        user_id: userId,
        status: 'failed',
        error: 'validation_failed',
        validation_duration: validationDuration,
        timestamp: new Date().toISOString(),
      });

      SentryLogger.database.error('profiles', 'update_profile', error.message, {
        user_id: userId,
        validation_errors: validationResult.errors,
        duration: validationDuration,
      });

      throw error;
    }

    SentryDataCollection.addBreadcrumb({
      message: 'Profile update validation completed successfully',
      category: 'profile.validation',
      level: 'debug',
      data: {
        user_id: userId,
        validation_duration: validationDuration,
      },
    });

    ProfileService.startTimer(`updateProfile-${userId}`);

    try {
      logger.info('Updating user profile', { context: { userId, updates } });

      const apiStartTime = Date.now();

      SentryDataCollection.addBreadcrumb({
        message: 'Making API request to update profile',
        category: 'profile.api',
        level: 'info',
        data: {
          user_id: userId,
          endpoint: `/rest/v1/${ProfileService.PROFILE_TABLE}`,
          update_fields: Object.keys(updates),
        },
      });

      const response = await apiClient.patch(
        `/rest/v1/${ProfileService.PROFILE_TABLE}?id=eq.${userId}`,
        validationResult.data,
        {
          cache: {
            enabled: false, // Don't cache update responses
            tags: ['profiles', `user:${userId}`], // For cache invalidation
          },
          auth: { required: true },
          processing: {
            metadata: { operation: 'updateProfile' },
          },
        },
      );

      const apiDuration = Date.now() - apiStartTime;
      ProfileService.metrics.profileUpdates++;

      SentryDataCollection.addBreadcrumb({
        message: 'API request completed for profile update',
        category: 'profile.api',
        level: 'info',
        data: {
          user_id: userId,
          api_duration: apiDuration,
          update_fields: Object.keys(updates),
        },
      });

      // Validate response structure
      const responseValidationStartTime = Date.now();

      SentryDataCollection.addBreadcrumb({
        message: 'Starting profile update response validation',
        category: 'profile.validation',
        level: 'debug',
        data: {
          user_id: userId,
          has_response_data: !!response.data,
        },
      });

      const responseValidation = validationService.validateApiResponse(
        ProfilesListResponseSchema,
        response.data,
        'profile update response',
      );

      const responseValidationDuration = Date.now() - responseValidationStartTime;

      if (!responseValidation || responseValidation.length === 0) {
        const error = new Error('No profile returned from update operation');

        SentryDataCollection.captureException(error, {
          operation: 'update_profile_response_validation',
          user_id: userId,
          api_duration: apiDuration,
          response_validation_duration: responseValidationDuration,
        });

        throw error;
      }

      const transformStartTime = Date.now();
      const profile = ProfileService.transformProfile(responseValidation[0]);
      const transformDuration = Date.now() - transformStartTime;

      if (!profile) {
        const error = new Error('Failed to transform updated profile data');

        SentryDataCollection.captureException(error, {
          operation: 'update_profile_transform',
          user_id: userId,
          api_duration: apiDuration,
          transform_duration: transformDuration,
        });

        throw error;
      }

      // Invalidate related caches
      const cacheInvalidationStartTime = Date.now();

      SentryDataCollection.addBreadcrumb({
        message: 'Invalidating profile caches',
        category: 'profile.cache',
        level: 'debug',
        data: {
          user_id: userId,
          cache_tags: [`user:${userId}`, 'profiles'],
        },
      });

      await apiClient.invalidateCache([`user:${userId}`, 'profiles']);

      const cacheInvalidationDuration = Date.now() - cacheInvalidationStartTime;
      const totalDuration = Date.now() - operationStartTime;
      const duration = ProfileService.endTimer(`updateProfile-${userId}`);

      SentryDataCollection.addBreadcrumb({
        message: 'Profile update completed successfully',
        category: 'profile.update',
        level: 'info',
        data: {
          user_id: userId,
          profile_id: profile.id,
          total_duration: totalDuration,
          api_duration: apiDuration,
          validation_duration: validationDuration,
          response_validation_duration: responseValidationDuration,
          transform_duration: transformDuration,
          cache_invalidation_duration: cacheInvalidationDuration,
          update_fields: Object.keys(updates),
        },
      });

      SentryDataCollection.setContext('profile_operation', {
        operation: 'update_profile',
        user_id: userId,
        profile_id: profile.id,
        status: 'completed',
        total_duration: totalDuration,
        api_duration: apiDuration,
        validation_duration: validationDuration,
        response_validation_duration: responseValidationDuration,
        transform_duration: transformDuration,
        cache_invalidation_duration: cacheInvalidationDuration,
        update_fields: Object.keys(updates),
        timestamp: new Date().toISOString(),
      });

      SentryLogger.database.query('profiles', 'update_profile', {
        user_id: userId,
        profile_id: profile.id,
        duration: totalDuration,
        update_fields: Object.keys(updates),
      });

      logger.info('Profile updated successfully', {
        context: { userId, duration, updates },
      });

      ProfileService.updateErrorRate(false);
      return profile;
    } catch (error) {
      const totalDuration = Date.now() - operationStartTime;
      const duration = ProfileService.endTimer(`updateProfile-${userId}`);
      ProfileService.updateErrorRate(true);

      SentryDataCollection.captureException(error as Error, {
        operation: 'update_profile',
        user_id: userId,
        update_fields: Object.keys(updates),
        duration: totalDuration,
      });

      SentryDataCollection.setContext('profile_operation', {
        operation: 'update_profile',
        user_id: userId,
        status: 'failed',
        error: (error as Error).message,
        duration: totalDuration,
        update_fields: Object.keys(updates),
        timestamp: new Date().toISOString(),
      });

      SentryLogger.database.error('profiles', 'update_profile', (error as Error).message, {
        user_id: userId,
        update_fields: Object.keys(updates),
        duration: totalDuration,
        error: error,
      });

      logger.error('Error updating profile', error as Error, {
        context: { userId, updates, duration, operation: 'updateProfile' },
      });

      captureException(error as Error, {
        tags: { service: 'profileService', operation: 'updateProfile' },
        extra: { userId, updates, duration },
      });

      throw error;
    }
  }

  /**
   * Create a new user profile
   */
  async createProfile(user: User): Promise<Profile> {
    if (!user || !user.id) {
      const error = new Error('Valid user object is required');

      SentryDataCollection.captureException(error, {
        operation: 'create_profile_validation',
        user_id: user?.id,
        validation_type: 'user_object_validation',
      });

      throw error;
    }

    const operationStartTime = Date.now();
    ProfileService.startTimer(`createProfile-${user.id}`);

    // Set initial context for profile creation
    SentryDataCollection.setContext('profile_operation', {
      operation: 'create_profile',
      user_id: user.id,
      has_email: !!user.email,
      has_metadata: !!user.user_metadata,
      timestamp: new Date().toISOString(),
      status: 'starting',
      start_time: operationStartTime,
    });

    SentryDataCollection.addBreadcrumb({
      message: 'Starting profile creation',
      category: 'profile.create',
      level: 'info',
      data: {
        user_id: user.id,
        has_email: !!user.email,
        has_metadata: !!user.user_metadata,
        metadata_keys: user.user_metadata ? Object.keys(user.user_metadata) : [],
      },
    });

    try {
      const profileData = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.name || user.user_metadata?.full_name || '',
        avatar_url: user.user_metadata?.avatar_url || '',
        user_metadata: user.user_metadata || {},
      };

      // Validate profile data before creation
      const validationResult = validationService.validateWithSchema(
        UserProfileSchema.omit({ created_at: true, updated_at: true }),
        profileData,
        'profile creation',
      );

      if (!validationResult.success) {
        throw new Error(`Invalid profile creation data: ${validationResult.errors.join(', ')}`);
      }

      logger.info('Creating new user profile', { context: { userId: user.id } });

      const response = await apiClient.post(
        `/rest/v1/${ProfileService.PROFILE_TABLE}`,
        validationResult.data,
        {
          cache: {
            enabled: false, // Don't cache creation responses
            tags: ['profiles', `user:${user.id}`],
          },
          auth: { required: true },
          processing: {
            metadata: { operation: 'createProfile' },
          },
        },
      );

      // Validate response structure
      const responseValidation = validationService.validateApiResponse(
        ProfilesListResponseSchema,
        response.data,
        'profile creation response',
      );

      if (!responseValidation || responseValidation.length === 0) {
        throw new Error('No profile returned from creation operation');
      }

      const profile = ProfileService.transformProfile(responseValidation[0]);

      if (!profile) {
        throw new Error('Failed to transform created profile data');
      }

      const duration = ProfileService.endTimer(`createProfile-${user.id}`);
      const operationDuration = Date.now() - operationStartTime;

      // Update Sentry context with completion details
      SentryDataCollection.setContext('profile_operation', {
        operation: 'create_profile',
        user_id: user.id,
        status: 'completed',
        duration: operationDuration,
        timer_duration: duration,
        timestamp: new Date().toISOString(),
      });

      SentryDataCollection.addBreadcrumb({
        message: 'Profile creation completed successfully',
        category: 'profile.create',
        level: 'info',
        data: {
          user_id: user.id,
          duration: operationDuration,
          timer_duration: duration,
        },
      });

      logger.info('Profile created successfully', {
        context: { userId: user.id, duration, operationDuration },
      });

      ProfileService.updateErrorRate(false);
      return profile;
    } catch (error) {
      const duration = ProfileService.endTimer(`createProfile-${user.id}`);
      const operationDuration = Date.now() - operationStartTime;
      ProfileService.updateErrorRate(true);

      // Update Sentry context with error details
      SentryDataCollection.setContext('profile_operation', {
        operation: 'create_profile',
        user_id: user.id,
        status: 'failed',
        duration: operationDuration,
        timer_duration: duration,
        error_message: (error as Error).message,
        timestamp: new Date().toISOString(),
      });

      SentryDataCollection.captureException(error as Error, {
        user_id: user.id,
        duration: operationDuration,
        timer_duration: duration,
        operation: 'createProfile',
        user_metadata: user.user_metadata,
        category: 'profile.create',
      });

      logger.error('Error creating profile', error as Error, {
        context: { userId: user.id, duration, operationDuration, operation: 'createProfile' },
      });

      captureException(error as Error, {
        tags: { service: 'profileService', operation: 'createProfile' },
        extra: { userId: user.id, duration, operationDuration, userMetadata: user.user_metadata },
      });

      throw error;
    }
  }

  /**
   * Get comprehensive profile statistics
   */
  async getProfileStats(userId: string): Promise<ProfileStats> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid user ID is required');
    }

    try {
      const profile = await this.getProfile(userId);

      if (!profile) {
        throw new Error('Profile not found');
      }

      const createdAt = new Date(profile.created_at);
      const updatedAt = new Date(profile.updated_at);
      const now = new Date();

      const accountAge = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const profileCompleteness = ProfileService.calculateProfileCompleteness(profile);

      return {
        profileCompleteness,
        lastUpdated: updatedAt,
        accountAge,
        hasAvatar: !!profile.avatar_url,
        hasPreferences: !!(profile.user_metadata && Object.keys(profile.user_metadata).length > 0),
      };
    } catch (error) {
      logger.error('Error fetching profile stats', error as Error, {
        context: { userId, operation: 'getProfileStats' },
      });
      throw error;
    }
  }

  /**
   * Delete user profile (with confirmation)
   */
  async deleteProfile(userId: string, confirmation: string): Promise<void> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid user ID is required');
    }

    if (confirmation !== 'DELETE_PROFILE_CONFIRM') {
      throw new Error('Profile deletion requires explicit confirmation');
    }

    ProfileService.startTimer(`deleteProfile-${userId}`);

    try {
      logger.warn('Deleting user profile', { context: { userId } });

      await apiClient.delete(`/rest/v1/${ProfileService.PROFILE_TABLE}?id=eq.${userId}`, {
        auth: { required: true },
        processing: {
          metadata: { operation: 'deleteProfile' },
        },
      });

      // Invalidate all user-related caches
      await apiClient.invalidateCache([`user:${userId}`, 'profiles']);

      const duration = ProfileService.endTimer(`deleteProfile-${userId}`);
      logger.warn('Profile deleted successfully', {
        context: { userId, duration },
      });

      ProfileService.updateErrorRate(false);
    } catch (error) {
      const duration = ProfileService.endTimer(`deleteProfile-${userId}`);
      ProfileService.updateErrorRate(true);

      logger.error('Error deleting profile', error as Error, {
        context: { userId, duration, operation: 'deleteProfile' },
      });

      captureException(error as Error, {
        tags: { service: 'profileService', operation: 'deleteProfile' },
        extra: { userId, duration },
      });

      throw error;
    }
  }

  /**
   * Batch update multiple profiles (admin function)
   */
  async batchUpdateProfiles(
    updates: Array<{ userId: string; data: ProfileUpdateRequest }>,
  ): Promise<{ success: Profile[]; failed: Array<{ userId: string; error: string }> }> {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error('Valid updates array is required');
    }

    const results = {
      success: [] as Profile[],
      failed: [] as Array<{ userId: string; error: string }>,
    };

    const batchPromises = updates.map(async ({ userId, data }) => {
      try {
        const profile = await this.updateProfile(userId, data);
        results.success.push(profile);
      } catch (error) {
        results.failed.push({
          userId,
          error: (error as Error).message,
        });
      }
    });

    await Promise.allSettled(batchPromises);

    logger.info('Batch profile update completed', {
      context: {
        total: updates.length,
        successful: results.success.length,
        failed: results.failed.length,
      },
    });

    return results;
  }

  /**
   * Get service performance metrics
   */
  getMetrics(): ProfileServiceMetrics {
    return { ...ProfileService.metrics };
  }

  /**
   * Reset service metrics
   */
  resetMetrics(): void {
    ProfileService.metrics = {
      profileFetches: 0,
      profileUpdates: 0,
      cacheHitRate: 0,
      averageResponseTime: 0,
      errorRate: 0,
    };
    ProfileService.performanceTimers.clear();
  }

  /**
   * Preload profile data for better performance
   */
  async preloadProfile(userId: string): Promise<void> {
    try {
      await this.getProfile(userId);
      logger.debug('Profile preloaded successfully', { context: { userId } });
    } catch (error) {
      logger.debug('Profile preload failed', {
        context: { userId, error: (error as Error).message },
      });
    }
  }

  /**
   * Sync profile with authentication provider
   */
  async syncWithAuth(userId: string): Promise<Profile> {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user || user.id !== userId) {
        throw new Error('Authentication sync failed');
      }

      const updates: ProfileUpdateRequest = {};
      let hasUpdates = false;

      // Check for updated email
      if (user.email) {
        const currentProfile = await this.getProfile(userId);
        if (currentProfile && currentProfile.email !== user.email) {
          // Note: email updates might need special handling
          logger.info('Email change detected during sync', {
            context: { userId, oldEmail: currentProfile.email, newEmail: user.email },
          });
        }
      }

      // Check for updated metadata
      if (user.user_metadata) {
        if (user.user_metadata.full_name) {
          updates.full_name = user.user_metadata.full_name;
          hasUpdates = true;
        }
        if (user.user_metadata.avatar_url) {
          updates.avatar_url = user.user_metadata.avatar_url;
          hasUpdates = true;
        }
      }

      if (hasUpdates) {
        return await this.updateProfile(userId, updates);
      }

      const existingProfile = await this.getProfile(userId);
      if (!existingProfile) {
        throw new Error('Profile not found after sync');
      }

      return existingProfile;
    } catch (error) {
      logger.error('Error syncing profile with auth', error as Error, {
        context: { userId, operation: 'syncWithAuth' },
      });
      throw error;
    }
  }
}

// Export singleton instance
const profileService = new ProfileService();
export default profileService;

/**
 * Checks if a user has completed their profile setup
 * @param userId - The user's ID
 * @returns Promise with completion status and missing fields
 */
/**
 * Helper function to get missing profile fields
 */
function getMissingProfileFields(profile: UserProfileDetails | null): string[] {
  const missingFields: string[] = [];

  if (!profile?.date_of_birth) missingFields.push('date_of_birth');
  if (!profile?.gender) missingFields.push('gender');
  if (!profile?.height_cm || profile.height_cm <= 0) missingFields.push('height_cm');
  if (!profile?.weight_kg || profile.weight_kg <= 0) missingFields.push('weight_kg');

  return missingFields;
}

/**
 * Helper function to create profile completion result
 */
function createProfileCompletionResult(
  userId: string,
  profile: UserProfileDetails | null,
  missingFields: string[],
  hasProfileRecord: boolean,
): ProfileCompletionCheck {
  return {
    user_id: userId,
    has_profile_details: hasProfileRecord,
    has_basic_info: !!(profile?.date_of_birth && profile?.gender),
    has_measurements: !!(profile?.height_cm && profile?.weight_kg),
    has_preferences: !!(profile?.preferred_weight_unit && profile?.preferred_height_unit),
    completion_percentage: Math.round(((4 - missingFields.length) / 4) * 100),
    missing_fields: missingFields,
  };
}

/**
 * Helper function to handle profile completion errors
 */
function handleProfileCompletionError(
  err: unknown,
  userId: string,
): {
  isComplete: boolean;
  missingFields: string[];
  hasProfileRecord: boolean;
} {
  let error: Error;

  if (err instanceof Error) {
    error = err;
  } else if (err && typeof err === 'object' && 'message' in err) {
    error = new Error(`Supabase error: ${JSON.stringify(err)}`);
  } else {
    error = new Error(String(err));
  }

  console.error('Error checking profile completion:', error.message);
  console.error('Full error details:', err);

  SentryDataCollection.captureException(error, {
    tags: { operation: 'checkProfileCompletion' },
    extra: { userId, originalError: err },
  });

  // Validate error result with schema (but don't use the result)
  try {
    const errorResult = createProfileCompletionResult(
      userId,
      null,
      ['date_of_birth', 'gender', 'height_cm', 'weight_kg'],
      false,
    );
    ProfileCompletionCheckSchema.parse(errorResult);
  } catch (validationError) {
    console.warn('Schema validation failed for error result:', validationError);
  }

  return {
    isComplete: false,
    missingFields: ['date_of_birth', 'gender', 'height_cm', 'weight_kg'],
    hasProfileRecord: false,
  };
}

export async function checkProfileCompletion(userId: string): Promise<{
  isComplete: boolean;
  missingFields: string[];
  hasProfileRecord: boolean;
}> {
  try {
    const { data: profile, error } = await supabase
      .from('user_profile_details')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected for new users
      throw error;
    }

    if (!profile) {
      // For users without profile record, validate the empty result structure
      const missingFields = ['date_of_birth', 'gender', 'height_cm', 'weight_kg'];
      const result = createProfileCompletionResult(userId, null, missingFields, false);

      // Validate the result with the schema (but don't use the result)
      ProfileCompletionCheckSchema.parse(result);

      return {
        isComplete: false,
        missingFields,
        hasProfileRecord: false,
      };
    }

    // Check which required fields are missing
    const missingFields = getMissingProfileFields(profile);

    const result = createProfileCompletionResult(userId, profile, missingFields, true);

    // Validate the result with the schema (but don't use the result)
    ProfileCompletionCheckSchema.parse(result);

    return {
      isComplete: missingFields.length === 0,
      missingFields,
      hasProfileRecord: true,
    };
  } catch (err: unknown) {
    return handleProfileCompletionError(err, userId);
  }
}

/**
 * Creates a default profile record for a new user
 * @param userId - The user's ID
 * @returns Promise with the created profile data
 */
export async function createDefaultProfileRecord(userId: string): Promise<unknown> {
  try {
    // First check if profile already exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('user_profile_details')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected for new users
      throw checkError;
    }

    if (existingProfile) {
      console.log('Profile already exists for user:', userId);
      return existingProfile;
    }

    const defaultProfile = {
      user_id: userId,
      preferred_weight_unit: 'KG' as const,
      preferred_height_unit: 'CM' as const,
      workout_days: [],
    };

    // Validate the default profile data
    const validatedProfile = CreateDefaultProfileDetailsSchema.parse(defaultProfile);

    const { data, error } = await supabase
      .from('user_profile_details')
      .insert([validatedProfile])
      .select()
      .single();

    if (error) {
      // Handle duplicate key error gracefully - this can happen during race conditions
      if (error.code === '23505' && error.message.includes('user_profile_details_user_id_key')) {
        console.log('Profile already exists for user (race condition detected):', userId);

        // Fetch the existing profile that was created by another concurrent call
        const { data: existingData, error: fetchError } = await supabase
          .from('user_profile_details')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (fetchError) {
          throw fetchError;
        }

        return existingData;
      }

      throw error;
    }

    console.log('Created default profile record for user:', userId);

    return data;
  } catch (err: unknown) {
    let error: Error;

    if (err instanceof Error) {
      error = err;
    } else if (err && typeof err === 'object' && 'message' in err) {
      // Handle Supabase error objects
      error = new Error(`Supabase error: ${JSON.stringify(err)}`);
    } else {
      error = new Error(String(err));
    }

    console.error('Error creating default profile record:', error.message);
    console.error('Full error details:', err);

    SentryDataCollection.captureException(error, {
      tags: { operation: 'createDefaultProfileRecord' },
      extra: { userId, originalError: err },
    });

    throw error;
  }
}

/**
 * Checks if a user is a new user (just registered) based on profile completion
 * @param userId - The user's ID
 * @returns Promise<boolean> - true if user is new and needs profile setup
 */
export async function isNewUser(userId: string): Promise<boolean> {
  try {
    const completionStatus = await checkProfileCompletion(userId);
    return !completionStatus.hasProfileRecord || !completionStatus.isComplete;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('Error checking if user is new:', error);
    SentryDataCollection.captureException(error, {
      tags: { operation: 'isNewUser' },
      extra: { userId },
    });
    return true; // Assume new user on error for safety
  }
}
