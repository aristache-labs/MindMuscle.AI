import { logger } from '../utils/logger';
import supabase from './supabase';
import { validationService } from './validationService';
// Add Sentry imports
import {
  captureError,
  captureMessage,
  captureDatabaseError,
  captureValidationError,
} from './sentry';
import { addBreadcrumb } from './sentry/simpleErrorHandler';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  subtitle?: string;
  requirement: string;
  icon: string;
  icon_background_color?: string;
  total_progress?: number;
  created_at: string;
  updated_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  is_completed: boolean;
  completed_at?: string | null;
  current_progress: number;
  created_at: string;
  updated_at: string;
  achievement?: Achievement;
}

export const achievementService = {
  // Get all achievements
  async getAllAchievements(): Promise<Achievement[]> {
    try {
      addBreadcrumb('Starting to fetch all achievements', 'achievements', {
        operation: 'getAllAchievements',
      });

      const { data, error } = await supabase.from('achievements').select('*').order('created_at');

      if (error) {
        logger.error('Error fetching achievements', error, {
          context: { operation: 'getAllAchievements' },
        });
        captureDatabaseError(new Error(error.message), 'achievements');
        throw error;
      }

      // Validate each achievement
      const validatedAchievements: Achievement[] = [];
      for (const achievement of data || []) {
        const validationResult = validationService.validateAchievement(achievement);
        if (validationResult.success) {
          // Cast to Achievement since validation passed and database should have all required fields
          validatedAchievements.push(validationResult.data as Achievement);
        } else {
          logger.warn('Invalid achievement data received from database', {
            context: {
              achievementId: achievement?.id,
              errors: validationResult.errors,
            },
          });
          captureValidationError(
            new Error('Invalid achievement data from database'),
            'achievement',
          );
        }
      }

      logger.info('Achievements fetched successfully', {
        context: { count: validatedAchievements.length },
      });

      addBreadcrumb('Successfully fetched achievements', 'achievements', {
        count: validatedAchievements.length,
      });

      return validatedAchievements;
    } catch (error) {
      logger.error('Failed to fetch achievements', error as Error, {
        context: { operation: 'getAllAchievements' },
      });
      captureError(error as Error, {
        category: 'database_error',
        component: 'achievementService',
      });
      throw error;
    }
  },

  // Get user's achievements
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    try {
      // Validate user ID
      if (!userId || typeof userId !== 'string') {
        const error = new Error('Valid user ID is required');
        captureValidationError(error, 'userId');
        throw error;
      }

      addBreadcrumb('Starting to fetch user achievements', 'achievements', {
        userId,
        operation: 'getUserAchievements',
      });

      const { data, error } = await supabase
        .from('user_achievements')
        .select(
          `
        *,
        achievement:achievements(*)
      `,
        )
        .eq('user_id', userId)
        .order('created_at');

      if (error) {
        logger.error('Error fetching user achievements', error, {
          context: { userId, operation: 'getUserAchievements' },
        });
        captureDatabaseError(new Error(error.message), 'user_achievements', 'select');
        throw error;
      }

      // Validate each user achievement
      const validatedUserAchievements: UserAchievement[] = [];
      for (const userAchievement of data || []) {
        const validationResult = validationService.validateUserAchievement(userAchievement);
        if (validationResult.success) {
          // Cast to UserAchievement since validation passed and database should have all required fields
          validatedUserAchievements.push(validationResult.data as UserAchievement);
        } else {
          logger.warn('Invalid user achievement data received from database', {
            context: {
              userId,
              userAchievementId: userAchievement?.id,
              errors: validationResult.errors,
            },
          });
          captureValidationError(
            new Error('Invalid user achievement data from database'),
            'userAchievement',
          );
        }
      }

      logger.info('User achievements fetched successfully', {
        context: { userId, count: validatedUserAchievements.length },
      });

      addBreadcrumb('Successfully fetched user achievements', 'achievements', {
        userId,
        count: validatedUserAchievements.length,
      });

      return validatedUserAchievements;
    } catch (error) {
      logger.error('Failed to fetch user achievements', error as Error, {
        context: { userId, operation: 'getUserAchievements' },
      });
      captureError(error as Error, {
        category: 'database_error',
        component: 'achievementService',
        userId,
      });
      throw error;
    }
  },

  // Get user's completed achievements
  async getUserCompletedAchievements(userId: string): Promise<UserAchievement[]> {
    try {
      // Validate user ID
      if (!userId || typeof userId !== 'string') {
        const error = new Error('Valid user ID is required');
        captureValidationError(error, 'userId');
        throw error;
      }

      addBreadcrumb('Starting to fetch user completed achievements', 'achievements', {
        userId,
        operation: 'getUserCompletedAchievements',
      });

      const { data, error } = await supabase
        .from('user_achievements')
        .select(
          `
        *,
        achievement:achievements(*)
      `,
        )
        .eq('user_id', userId)
        .eq('is_completed', true)
        .order('completed_at', { ascending: false });

      if (error) {
        logger.error('Error fetching user completed achievements', error, {
          context: { userId, operation: 'getUserCompletedAchievements' },
        });
        captureDatabaseError(new Error(error.message), 'user_achievements', 'select');
        throw error;
      }

      // Validate each completed achievement
      const validatedCompletedAchievements: UserAchievement[] = [];
      for (const userAchievement of data || []) {
        const validationResult = validationService.validateUserAchievement(userAchievement);
        if (validationResult.success) {
          // Cast to UserAchievement since validation passed and database should have all required fields
          validatedCompletedAchievements.push(validationResult.data as UserAchievement);
        } else {
          logger.warn('Invalid completed achievement data received from database', {
            context: {
              userId,
              userAchievementId: userAchievement?.id,
              errors: validationResult.errors,
            },
          });
          captureValidationError(
            new Error('Invalid completed achievement data from database'),
            'completedAchievement',
          );
        }
      }

      logger.info('User completed achievements fetched successfully', {
        context: { userId, count: validatedCompletedAchievements.length },
      });

      addBreadcrumb('Successfully fetched user completed achievements', 'achievements', {
        userId,
        count: validatedCompletedAchievements.length,
      });

      return validatedCompletedAchievements;
    } catch (error) {
      logger.error('Failed to fetch user completed achievements', error as Error, {
        context: { userId, operation: 'getUserCompletedAchievements' },
      });
      captureError(error as Error, {
        category: 'database_error',
        component: 'achievementService',
        userId,
      });
      throw error;
    }
  },

  // Initialize achievements for a new user
  async initializeUserAchievements(userId: string): Promise<void> {
    try {
      // Validate user ID
      if (!userId || typeof userId !== 'string') {
        const error = new Error('Valid user ID is required');
        captureValidationError(error, 'userId');
        throw error;
      }

      addBreadcrumb('Starting to initialize user achievements', 'achievements', {
        userId,
        operation: 'initializeUserAchievements',
      });

      const achievements = await this.getAllAchievements();

      const userAchievements = achievements.map((achievement) => ({
        user_id: userId,
        achievement_id: achievement.id,
        is_completed: false,
        current_progress: 0,
      }));

      // Validate each user achievement before insertion
      for (const userAchievement of userAchievements) {
        const validationResult = validationService.validateUserAchievement(userAchievement);
        if (!validationResult.success) {
          const errorMessage = `User achievement validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;
          logger.error('User achievement validation failed', new Error(errorMessage), {
            context: { userId, userAchievement, errors: validationResult.errors },
          });
          captureValidationError(new Error(errorMessage), 'userAchievement');
          throw new Error(errorMessage);
        }
      }

      const { error } = await supabase.from('user_achievements').insert(userAchievements);

      if (error) {
        logger.error('Error initializing user achievements', error, {
          context: { userId, achievementCount: userAchievements.length },
        });
        captureDatabaseError(new Error(error.message), 'user_achievements', 'insert');
        throw error;
      }

      logger.info('User achievements initialized successfully', {
        context: { userId, achievementCount: userAchievements.length },
      });

      addBreadcrumb('Successfully initialized user achievements', 'achievements', {
        userId,
        achievementCount: userAchievements.length,
      });
    } catch (error) {
      logger.error('Failed to initialize user achievements', error as Error, {
        context: { userId, operation: 'initializeUserAchievements' },
      });
      captureError(error as Error, {
        category: 'database_error',
        component: 'achievementService',
        userId,
      });
      throw error;
    }
  },

  // Update achievement progress
  async updateProgress(userId: string, achievementId: string, progress: number): Promise<void> {
    try {
      // Validate input data
      const updateData = { userId, achievementId, progress };
      const validationResult = validationService.validateUpdateAchievementProgress(updateData);

      if (!validationResult.success) {
        const errorMessage = `Achievement progress update validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;
        logger.error('Achievement progress update validation failed', new Error(errorMessage), {
          context: { updateData, errors: validationResult.errors },
        });
        captureValidationError(new Error(errorMessage), 'progressUpdate');
        throw new Error(errorMessage);
      }

      addBreadcrumb('Starting to update achievement progress', 'achievements', {
        userId,
        achievementId,
        progress,
        operation: 'updateProgress',
      });

      const { data: achievement } = await supabase
        .from('achievements')
        .select('total_progress')
        .eq('id', achievementId)
        .single();

      const isCompleted = achievement?.total_progress
        ? progress >= achievement.total_progress
        : false;

      const { error } = await supabase
        .from('user_achievements')
        .update({
          current_progress: progress,
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq('user_id', userId)
        .eq('achievement_id', achievementId);

      if (error) {
        logger.error('Error updating achievement progress', error, {
          context: { userId, achievementId, progress, isCompleted },
        });
        captureDatabaseError(new Error(error.message), 'user_achievements', 'update');
        throw error;
      }

      logger.info('Achievement progress updated successfully', {
        context: { userId, achievementId, progress, isCompleted },
      });

      addBreadcrumb('Successfully updated achievement progress', 'achievements', {
        userId,
        achievementId,
        progress,
        isCompleted,
      });

      if (isCompleted) {
        captureMessage('Achievement completed!', 'info');
      }
    } catch (error) {
      logger.error('Failed to update achievement progress', error as Error, {
        context: { userId, achievementId, progress, operation: 'updateProgress' },
      });
      captureError(error as Error, {
        category: 'database_error',
        component: 'achievementService',
        userId,
      });
      throw error;
    }
  },

  // Complete an achievement directly
  async completeAchievement(userId: string, achievementId: string): Promise<void> {
    try {
      // Validate input data
      if (!userId || typeof userId !== 'string') {
        const error = new Error('Valid user ID is required');
        captureValidationError(error, 'userId');
        throw error;
      }
      if (!achievementId || typeof achievementId !== 'string') {
        const error = new Error('Valid achievement ID is required');
        captureValidationError(error, 'achievementId');
        throw error;
      }

      addBreadcrumb('Starting to complete achievement', 'achievements', {
        userId,
        achievementId,
        operation: 'completeAchievement',
      });

      const { error } = await supabase
        .from('user_achievements')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('achievement_id', achievementId);

      if (error) {
        logger.error('Error completing achievement', error, {
          context: { userId, achievementId },
        });
        captureDatabaseError(new Error(error.message), 'user_achievements', 'update');
        throw error;
      }

      logger.info('Achievement completed successfully', {
        context: { userId, achievementId },
      });

      addBreadcrumb('Successfully completed achievement', 'achievements', {
        userId,
        achievementId,
      });

      captureMessage('Achievement completed!', 'info');
    } catch (error) {
      logger.error('Failed to complete achievement', error as Error, {
        context: { userId, achievementId, operation: 'completeAchievement' },
      });
      captureError(error as Error, {
        category: 'database_error',
        component: 'achievementService',
        userId,
      });
      throw error;
    }
  },

  // Get random achievements that user hasn't completed
  async getRandomAchievements(userId: string, count: number): Promise<Achievement[]> {
    try {
      // Validate input data
      if (!userId || typeof userId !== 'string') {
        const error = new Error('Valid user ID is required');
        captureValidationError(error, 'userId');
        throw error;
      }
      if (!count || count <= 0 || count > 50) {
        const error = new Error('Count must be between 1 and 50');
        captureValidationError(error, 'count');
        throw error;
      }

      addBreadcrumb('Starting to fetch random achievements', 'achievements', {
        userId,
        count,
        operation: 'getRandomAchievements',
      });

      // First get all achievements
      const allAchievements = await this.getAllAchievements();

      // Then get user's achievements to filter out completed ones
      const userAchievements = await this.getUserAchievements(userId);
      const completedAchievementIds = new Set(
        userAchievements.filter((ua) => ua.is_completed).map((ua) => ua.achievement_id),
      );

      // Filter out completed achievements and shuffle
      const availableAchievements = allAchievements
        .filter((a) => !completedAchievementIds.has(a.id))
        .sort(() => Math.random() - 0.5);

      // Return the requested number of achievements
      const randomAchievements = availableAchievements.slice(0, count);

      logger.info('Random achievements fetched successfully', {
        context: { userId, requestedCount: count, returnedCount: randomAchievements.length },
      });

      addBreadcrumb('Successfully fetched random achievements', 'achievements', {
        userId,
        requestedCount: count,
        returnedCount: randomAchievements.length,
      });

      return randomAchievements;
    } catch (error) {
      logger.error('Failed to get random achievements', error as Error, {
        context: { userId, count, operation: 'getRandomAchievements' },
      });
      captureError(error as Error, {
        category: 'database_error',
        component: 'achievementService',
        userId,
      });
      throw error;
    }
  },
};

export default achievementService;
