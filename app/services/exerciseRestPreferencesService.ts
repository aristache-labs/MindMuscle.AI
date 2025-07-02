import supabase from './supabase';
import { SentryDataCollection } from './sentry';

export interface UserRestTimePreferences {
  [exerciseId: string]: number; // exercise_id -> rest_time_seconds
}

/**
 * Service for managing user exercise rest time preferences
 * Stores custom rest times in user_profile_details.exercise_rest_preferences JSONB column
 */
export class ExerciseRestPreferencesService {
  /**
   * Get user's rest time preferences for all exercises
   */
  static async getUserRestPreferences(userId: string): Promise<UserRestTimePreferences> {
    console.log('🔍 getUserRestPreferences called:', { userId });

    try {
      const { data, error } = await supabase
        .from('user_profile_details')
        .select('exercise_rest_preferences')
        .eq('user_id', userId)
        .maybeSingle();

      console.log('🔍 Database query result:', {
        userId,
        data,
        error,
        hasData: !!data,
        preferencesCount: data?.exercise_rest_preferences
          ? Object.keys(data.exercise_rest_preferences).length
          : 0,
      });

      if (error) {
        console.error('❌ Database error in getUserRestPreferences:', {
          userId,
          error,
        });
        SentryDataCollection.captureException(error as Error, {
          context: 'getUserRestPreferences',
          user_id: userId,
        });
        console.error('Error fetching user rest preferences:', error);
        return {};
      }

      const preferences = (data?.exercise_rest_preferences as UserRestTimePreferences) || {};
      console.log('✅ Returning user preferences:', {
        userId,
        preferences,
        exerciseCount: Object.keys(preferences).length,
      });

      return preferences;
    } catch (error) {
      console.error('❌ Exception in getUserRestPreferences:', {
        userId,
        error,
      });
      SentryDataCollection.captureException(error as Error, {
        context: 'getUserRestPreferences',
        user_id: userId,
      });
      console.error('Error in getUserRestPreferences:', error);
      return {};
    }
  }

  /**
   * Get rest time preference for a specific exercise
   */
  static async getExerciseRestPreference(
    userId: string,
    exerciseId: string,
  ): Promise<number | null> {
    console.log('🔍 getExerciseRestPreference called:', {
      userId,
      exerciseId,
    });

    try {
      const preferences = await this.getUserRestPreferences(userId);
      const result = preferences[exerciseId] || null;

      console.log('🔍 Exercise preference result:', {
        userId,
        exerciseId,
        result,
        allPreferences: preferences,
        hasPreference: result !== null,
      });

      return result;
    } catch (error) {
      console.error('❌ Exception in getExerciseRestPreference:', {
        userId,
        exerciseId,
        error,
      });
      SentryDataCollection.captureException(error as Error, {
        context: 'getExerciseRestPreference',
        user_id: userId,
        exercise_id: exerciseId,
      });
      return null;
    }
  }

  /**
   * Save rest time preference for a specific exercise
   */
  static async saveExerciseRestPreference(
    userId: string,
    exerciseId: string,
    restTimeSeconds: number,
  ): Promise<boolean> {
    try {
      // Validate rest time (5 seconds to 10 minutes)
      if (restTimeSeconds < 5 || restTimeSeconds > 600) {
        throw new Error(
          `Invalid rest time: ${restTimeSeconds}. Must be between 5 and 600 seconds.`,
        );
      }

      // Get current preferences
      const currentPreferences = await this.getUserRestPreferences(userId);

      // Update the specific exercise preference
      const updatedPreferences = {
        ...currentPreferences,
        [exerciseId]: restTimeSeconds,
      };

      // Save back to database
      const { error } = await supabase
        .from('user_profile_details')
        .update({
          exercise_rest_preferences: updatedPreferences,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        // If update failed, try insert (profile might not exist)
        const { error: insertError } = await supabase.from('user_profile_details').insert({
          user_id: userId,
          exercise_rest_preferences: updatedPreferences,
        });

        if (insertError) {
          SentryDataCollection.captureException(insertError as Error, {
            context: 'saveExerciseRestPreference_insert',
            user_id: userId,
            exercise_id: exerciseId,
            rest_time_seconds: restTimeSeconds,
          });
          console.error('Error inserting user rest preference:', insertError);
          return false;
        }
      }

      SentryDataCollection.addBreadcrumb({
        message: 'Exercise rest time preference saved',
        category: 'user_preferences',
        level: 'info',
        data: {
          user_id: userId,
          exercise_id: exerciseId,
          rest_time_seconds: restTimeSeconds,
        },
      });

      return true;
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'saveExerciseRestPreference',
        user_id: userId,
        exercise_id: exerciseId,
        rest_time_seconds: restTimeSeconds,
      });
      console.error('Error saving exercise rest preference:', error);
      return false;
    }
  }

  /**
   * Remove rest time preference for a specific exercise (revert to default)
   */
  static async removeExerciseRestPreference(userId: string, exerciseId: string): Promise<boolean> {
    try {
      // Get current preferences
      const currentPreferences = await this.getUserRestPreferences(userId);

      // Remove the specific exercise preference
      const updatedPreferences = { ...currentPreferences };
      delete updatedPreferences[exerciseId];

      // Save back to database
      const { error } = await supabase
        .from('user_profile_details')
        .update({
          exercise_rest_preferences: updatedPreferences,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        SentryDataCollection.captureException(error as Error, {
          context: 'removeExerciseRestPreference',
          user_id: userId,
          exercise_id: exerciseId,
        });
        console.error('Error removing user rest preference:', error);
        return false;
      }

      SentryDataCollection.addBreadcrumb({
        message: 'Exercise rest time preference removed',
        category: 'user_preferences',
        level: 'info',
        data: {
          user_id: userId,
          exercise_id: exerciseId,
        },
      });

      return true;
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'removeExerciseRestPreference',
        user_id: userId,
        exercise_id: exerciseId,
      });
      console.error('Error removing exercise rest preference:', error);
      return false;
    }
  }

  /**
   * Get effective rest time for an exercise (user preference or default plan time)
   */
  static async getEffectiveRestTime(
    userId: string,
    exerciseId: string,
    defaultRestTime: number,
  ): Promise<number> {
    try {
      const userPreference = await this.getExerciseRestPreference(userId, exerciseId);
      return userPreference !== null ? userPreference : defaultRestTime;
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'getEffectiveRestTime',
        user_id: userId,
        exercise_id: exerciseId,
        default_rest_time: defaultRestTime,
      });
      // Return default time if anything goes wrong
      return defaultRestTime;
    }
  }

  /**
   * Bulk update multiple exercise rest preferences
   */
  static async saveBulkRestPreferences(
    userId: string,
    preferences: UserRestTimePreferences,
  ): Promise<boolean> {
    try {
      // Validate all rest times
      for (const [exerciseId, restTime] of Object.entries(preferences)) {
        if (restTime < 5 || restTime > 600) {
          throw new Error(
            `Invalid rest time for exercise ${exerciseId}: ${restTime}. Must be between 5 and 600 seconds.`,
          );
        }
      }

      // Get current preferences and merge
      const currentPreferences = await this.getUserRestPreferences(userId);
      const updatedPreferences = {
        ...currentPreferences,
        ...preferences,
      };

      // Save to database
      const { error } = await supabase
        .from('user_profile_details')
        .update({
          exercise_rest_preferences: updatedPreferences,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        // If update failed, try insert (profile might not exist)
        const { error: insertError } = await supabase.from('user_profile_details').insert({
          user_id: userId,
          exercise_rest_preferences: updatedPreferences,
        });

        if (insertError) {
          SentryDataCollection.captureException(insertError as Error, {
            context: 'saveBulkRestPreferences_insert',
            user_id: userId,
            preferences,
          });
          console.error('Error inserting bulk user rest preferences:', insertError);
          return false;
        }
      }

      SentryDataCollection.addBreadcrumb({
        message: 'Bulk exercise rest time preferences saved',
        category: 'user_preferences',
        level: 'info',
        data: {
          user_id: userId,
          preferences_count: Object.keys(preferences).length,
        },
      });

      return true;
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'saveBulkRestPreferences',
        user_id: userId,
        preferences,
      });
      console.error('Error saving bulk exercise rest preferences:', error);
      return false;
    }
  }
}

export default ExerciseRestPreferencesService;
