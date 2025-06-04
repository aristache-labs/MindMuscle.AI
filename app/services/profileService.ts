import { User } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { ProfileUpdateSchema, UserProfileSchema } from '../validation/schemas';
import { apiClient } from './apiClient';
import { CachePriority } from './enhancedCacheManager';
import { captureException } from './sentry';
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
      throw new Error('Valid user ID is required');
    }

    ProfileService.startTimer(`getProfile-${userId}`);

    try {
      logger.info('Fetching user profile', { context: { userId } });

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

      ProfileService.metrics.profileFetches++;

      if (response.fromCache) {
        ProfileService.metrics.cacheHitRate =
          (ProfileService.metrics.cacheHitRate + 1) / ProfileService.metrics.profileFetches;
      }

      // Validate response structure
      const validationResult = validationService.validateApiResponse(
        ProfilesListResponseSchema,
        response.data,
        'profiles list',
      );

      if (!validationResult || validationResult.length === 0) {
        logger.info('No profile found for user', { context: { userId } });
        ProfileService.updateErrorRate(false);
        return null;
      }

      const profile = ProfileService.transformProfile(validationResult[0]);

      if (!profile) {
        logger.warn('Failed to transform profile data', { context: { userId } });
        ProfileService.updateErrorRate(true);
        return null;
      }

      ProfileService.updateErrorRate(false);
      ProfileService.endTimer(`getProfile-${userId}`);

      logger.info('Profile fetched successfully', {
        context: { userId, profileId: profile.id },
      });

      return profile;
    } catch (error) {
      ProfileService.updateErrorRate(true);
      ProfileService.endTimer(`getProfile-${userId}`);

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
      throw new Error('Valid user ID is required');
    }

    // Validate update data
    const validationResult = validationService.validateWithSchema(
      ProfileUpdateSchema,
      updates,
      'profile update',
    );

    if (!validationResult.success) {
      throw new Error(`Invalid profile update data: ${validationResult.errors.join(', ')}`);
    }

    ProfileService.startTimer(`updateProfile-${userId}`);

    try {
      logger.info('Updating user profile', { context: { userId, updates } });

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

      ProfileService.metrics.profileUpdates++;

      // Validate response structure
      const responseValidation = validationService.validateApiResponse(
        ProfilesListResponseSchema,
        response.data,
        'profile update response',
      );

      if (!responseValidation || responseValidation.length === 0) {
        throw new Error('No profile returned from update operation');
      }

      const profile = ProfileService.transformProfile(responseValidation[0]);

      if (!profile) {
        throw new Error('Failed to transform updated profile data');
      }

      // Invalidate related caches
      await apiClient.invalidateCache([`user:${userId}`, 'profiles']);

      const duration = ProfileService.endTimer(`updateProfile-${userId}`);
      logger.info('Profile updated successfully', {
        context: { userId, duration, updates },
      });

      ProfileService.updateErrorRate(false);
      return profile;
    } catch (error) {
      const duration = ProfileService.endTimer(`updateProfile-${userId}`);
      ProfileService.updateErrorRate(true);

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
      throw new Error('Valid user object is required');
    }

    ProfileService.startTimer(`createProfile-${user.id}`);

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
      logger.info('Profile created successfully', {
        context: { userId: user.id, duration },
      });

      ProfileService.updateErrorRate(false);
      return profile;
    } catch (error) {
      const duration = ProfileService.endTimer(`createProfile-${user.id}`);
      ProfileService.updateErrorRate(true);

      logger.error('Error creating profile', error as Error, {
        context: { userId: user.id, duration, operation: 'createProfile' },
      });

      captureException(error as Error, {
        tags: { service: 'profileService', operation: 'createProfile' },
        extra: { userId: user.id, duration, userMetadata: user.user_metadata },
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
