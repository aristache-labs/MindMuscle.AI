import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from '@services/auth';
import OpenAI from 'openai';
import { logger } from '../utils/logger';
import {
  CoachingResponseSchema,
  type CoachingRequest,
  type CoachingResponse,
} from '../validation/apiSchemas';
import { apiClient } from './apiClient';
import { validationService } from './validationService';
import {
  captureError,
  captureAPIError,
  captureValidationError,
  captureNetworkError,
} from './sentry';
import { addBreadcrumb } from './sentry/simpleErrorHandler';

// Type definitions for API data
interface ValidationError {
  message: string;
  path?: string[];
  code?: string;
}

interface WorkoutData {
  id: string;
  created_at: string;
  user_id: string;
  duration?: number;
  exercises?: unknown[];
}

interface MeasurementData {
  id: string;
  user_id: string;
  category: 'WEIGHT' | 'MUSCLE' | 'BODY_FAT' | string;
  value: number;
  measured_at: string;
  unit?: string;
}

export interface CoachingSession {
  id: string;
  userId: string;
  timestamp: Date;
  type: 'workout' | 'nutrition' | 'mindset';
  prompt: string;
  response: string;
  feedback?: string;
  rating?: number;
}

export interface CoachingContext {
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  preferences: string[];
  recentWorkouts: string[];
  userProfile: {
    age: number;
    gender: string;
    weight: number;
    height: number;
    medicalConditions?: string[];
  };
}

export interface CoachingInsight {
  id: string;
  userId: string;
  type: 'performance' | 'progress' | 'recommendation' | 'motivation';
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  isRead: boolean;
}

class AICoachingService {
  private static instance: AICoachingService;
  private coachingHistory: CoachingSession[] = [];
  private openai: OpenAI;
  private systemPrompt: string;

  private constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    });

    this.systemPrompt = `You are an expert fitness and wellness coach. Your responses should be:
    - Personalized based on the user's context
    - Actionable and specific
    - Evidence-based
    - Encouraging and supportive
    - Concise but informative
    - Focused on the user's goals and preferences
    
    User context:
    - Fitness level: {fitnessLevel}
    - Goals: {goals}
    - Preferences: {preferences}
    - Recent workouts: {recentWorkouts}
    - Age: {age}
    - Gender: {gender}
    - Weight: {weight} kg
    - Height: {height} cm
    - Medical conditions: {medicalConditions}`;
  }

  public static getInstance(): AICoachingService {
    if (!AICoachingService.instance) {
      AICoachingService.instance = new AICoachingService();
    }
    return AICoachingService.instance;
  }

  public async getCoachingResponse(
    prompt: string,
    context: CoachingContext,
    type: CoachingSession['type'],
  ): Promise<string> {
    try {
      addBreadcrumb('Starting AI coaching request', 'ai_coaching', {
        type,
        promptLength: prompt.length,
      });

      const auth = await getAuth();
      if (!auth?.user) {
        const error = new Error('User not authenticated');
        captureError(error as Error);
        throw error;
      }

      // Prepare coaching request data
      const coachingRequestData: CoachingRequest = {
        prompt,
        context: {
          userId: auth.user.id,
          fitnessLevel: context.fitnessLevel,
          goals: context.goals,
          preferences: context.preferences,
          recentWorkouts: context.recentWorkouts,
          userProfile: {
            ...context.userProfile,
            gender: context.userProfile.gender as 'male' | 'female' | 'other',
          },
        },
        type,
      };

      // Try API client with schema validation first
      try {
        addBreadcrumb('Attempting API client request', 'ai_coaching', {
          userId: auth.user.id,
          type,
        });

        const response = await apiClient.requestWithValidation(
          {
            url: '/api/v1/coaching/chat',
            method: 'POST',
            body: JSON.stringify(coachingRequestData),
            headers: {
              'Content-Type': 'application/json',
            },
          },
          CoachingResponseSchema,
          {
            cache: { enabled: false }, // Don't cache AI responses
            auth: { required: true },
          },
        );

        const apiResponse = response.data as CoachingResponse;
        const coachingMessage = apiResponse.data.message;

        const session: CoachingSession = {
          id: Date.now().toString(),
          userId: auth.user.id,
          timestamp: new Date(),
          type,
          prompt,
          response: coachingMessage,
        };

        await this.saveSession(session);

        logger.info('Coaching response generated successfully via API client', {
          context: {
            userId: auth.user.id,
            type,
            promptLength: prompt.length,
            responseLength: coachingMessage.length,
            fromCache: response.fromCache,
            validationPassed: response.processed,
          },
        });

        addBreadcrumb('AI coaching response generated via API', 'ai_coaching', {
          userId: auth.user.id,
          type,
          responseLength: coachingMessage.length,
          fromCache: response.fromCache,
        });

        return coachingMessage;
      } catch (apiError) {
        logger.warn('API client failed for coaching request, falling back to direct OpenAI call', {
          context: {
            userId: auth.user.id,
            type,
            error: (apiError as Error).message,
          },
        });

        captureAPIError(apiError as Error, '/api/v1/coaching/chat');

        addBreadcrumb('API client failed, using fallback', 'ai_coaching', {
          userId: auth.user.id,
          type,
          error: (apiError as Error).message,
        });

        // Fallback to direct OpenAI call
        return this.getCoachingResponseFallback(prompt, context, type, auth.user.id);
      }
    } catch (error) {
      logger.error('Error getting coaching response', error as Error, {
        context: { type, promptLength: prompt.length },
      });
      captureError(error as Error);
      throw error;
    }
  }

  // Fallback method using direct OpenAI call
  private async getCoachingResponseFallback(
    prompt: string,
    context: CoachingContext,
    type: CoachingSession['type'],
    userId: string,
  ): Promise<string> {
    try {
      addBreadcrumb('Starting OpenAI fallback request', 'ai_coaching', {
        userId,
        type,
        promptLength: prompt.length,
      });

      // Validate input data using existing validation
      const validationData = { prompt, context, type };
      const validationResult = validationService.validateCoachingRequest(validationData);

      if (!validationResult.success) {
        const errorMessage = `Coaching request validation failed: ${validationResult.errors?.map((e: ValidationError) => e.message).join(', ')}`;
        logger.error('Coaching request validation failed', new Error(errorMessage), {
          context: { validationData, errors: validationResult.errors },
        });
        captureValidationError(new Error(errorMessage));
        throw new Error(errorMessage);
      }

      const formattedPrompt = this.systemPrompt
        .replace('{fitnessLevel}', context.fitnessLevel)
        .replace('{goals}', context.goals.join(', '))
        .replace('{preferences}', context.preferences.join(', '))
        .replace('{recentWorkouts}', context.recentWorkouts.join(', '))
        .replace('{age}', context.userProfile.age.toString())
        .replace('{gender}', context.userProfile.gender)
        .replace('{weight}', context.userProfile.weight.toString())
        .replace('{height}', context.userProfile.height.toString())
        .replace(
          '{medicalConditions}',
          context.userProfile.medicalConditions?.join(', ') || 'none',
        );

      addBreadcrumb('Making OpenAI API call', 'ai_coaching', {
        userId,
        type,
        model: 'gpt-4-turbo-preview',
      });

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: formattedPrompt },
          { role: 'user', content: `Type: ${type}\nQuestion: ${prompt}` },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const response =
        completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

      const session: CoachingSession = {
        id: Date.now().toString(),
        userId,
        timestamp: new Date(),
        type,
        prompt,
        response,
      };

      await this.saveSession(session);

      logger.info('Coaching response generated successfully via fallback', {
        context: {
          userId,
          type,
          promptLength: prompt.length,
          responseLength: response.length,
        },
      });

      addBreadcrumb('OpenAI fallback response generated', 'ai_coaching', {
        userId,
        type,
        responseLength: response.length,
      });

      return response;
    } catch (error) {
      logger.error('Error getting coaching response', error as Error, {
        context: { type, promptLength: prompt.length },
      });

      if (error instanceof Error && error.message.includes('network')) {
        captureNetworkError(error as Error);
      } else {
        captureAPIError(error as Error);
      }

      throw error;
    }
  }

  public async generatePersonalizedInsights(userId: string): Promise<CoachingInsight[]> {
    try {
      addBreadcrumb('Starting personalized insights generation', 'ai_coaching', {
        userId,
      });

      // Get user's recent workout data and progress
      const workoutData = await apiClient.get(
        `/rest/v1/workout_sessions?user_id=eq.${userId}&order=created_at.desc&limit=10`,
        {
          cache: { enabled: true, ttl: 300000, tags: ['workout-sessions', `user:${userId}`] },
          auth: { required: true },
        },
      );

      const measurementData = await apiClient.get(
        `/rest/v1/user_measurements?user_id=eq.${userId}&order=measured_at.desc&limit=20`,
        {
          cache: { enabled: true, ttl: 300000, tags: ['measurements', `user:${userId}`] },
          auth: { required: true },
        },
      );

      // Generate AI insights based on data
      const insights: CoachingInsight[] = [];

      if (workoutData.data && Array.isArray(workoutData.data) && workoutData.data.length > 0) {
        const recentWorkouts = workoutData.data.slice(0, 5);
        const workoutFrequency = this.calculateWorkoutFrequency(recentWorkouts);

        if (workoutFrequency < 3) {
          insights.push({
            id: `frequency-${Date.now()}`,
            userId,
            type: 'motivation',
            title: 'Boost Your Workout Frequency',
            content: `You've been working out ${workoutFrequency} times per week. Try to aim for at least 3-4 sessions for optimal results!`,
            priority: 'medium',
            createdAt: new Date(),
            isRead: false,
          });
        }
      }

      if (
        measurementData.data &&
        Array.isArray(measurementData.data) &&
        measurementData.data.length > 0
      ) {
        const progressTrend = this.analyzeMeasurementTrend(measurementData.data);
        if (progressTrend.isPositive) {
          insights.push({
            id: `progress-${Date.now()}`,
            userId,
            type: 'progress',
            title: 'Great Progress!',
            content: `Your measurements show positive changes! Keep up the excellent work.`,
            priority: 'high',
            createdAt: new Date(),
            isRead: false,
          });
        }
      }

      logger.info('Personalized insights generated', {
        context: { userId, insightCount: insights.length },
      });

      addBreadcrumb('Personalized insights generated', 'ai_coaching', {
        userId,
        insightCount: insights.length,
      });

      return insights;
    } catch (error) {
      logger.error('Error generating personalized insights', error as Error, {
        context: { userId },
      });
      captureError(error as Error);
      return [];
    }
  }

  public async saveFeedback(sessionId: string, feedback: string, rating: number): Promise<void> {
    try {
      addBreadcrumb('Saving coaching feedback', 'ai_coaching', {
        sessionId,
        rating,
      });

      // Validate feedback data
      const feedbackData = { sessionId, feedback, rating };
      const validationResult = validationService.validateCoachingFeedback(feedbackData);

      if (!validationResult.success) {
        const errorMessage = `Coaching feedback validation failed: ${validationResult.errors?.map((e: ValidationError) => e.message).join(', ')}`;
        logger.error('Coaching feedback validation failed', new Error(errorMessage), {
          context: { feedbackData, errors: validationResult.errors },
        });
        captureValidationError(new Error(errorMessage));
        throw new Error(errorMessage);
      }

      const sessionIndex = this.coachingHistory.findIndex((s) => s.id === sessionId);
      if (sessionIndex !== -1) {
        this.coachingHistory[sessionIndex] = {
          ...this.coachingHistory[sessionIndex],
          feedback,
          rating,
        };
        await AsyncStorage.setItem('coachingHistory', JSON.stringify(this.coachingHistory));

        logger.info('Coaching feedback saved successfully', {
          context: { sessionId, rating },
        });

        addBreadcrumb('Coaching feedback saved', 'ai_coaching', {
          sessionId,
          rating,
        });
      }
    } catch (error) {
      logger.error('Error saving feedback', error as Error, {
        context: { sessionId, rating },
      });
      captureError(error as Error);
      throw error;
    }
  }

  private async saveSession(session: CoachingSession): Promise<void> {
    try {
      addBreadcrumb('Saving coaching session', 'ai_coaching', {
        sessionId: session.id,
        type: session.type,
      });

      this.coachingHistory.push(session);
      await AsyncStorage.setItem('coachingHistory', JSON.stringify(this.coachingHistory));

      logger.info('Coaching session saved successfully', {
        context: { sessionId: session.id, type: session.type },
      });
    } catch (error) {
      logger.error('Error saving coaching session', error as Error, {
        context: { sessionId: session.id },
      });
      captureError(error as Error);
      throw error;
    }
  }

  public async getCoachingHistory(): Promise<CoachingSession[]> {
    try {
      addBreadcrumb('Retrieving coaching history', 'ai_coaching');

      const auth = await getAuth();
      if (!auth?.user) {
        const error = new Error('User not authenticated');
        captureError(error as Error);
        throw error;
      }

      const history = await AsyncStorage.getItem('coachingHistory');
      if (history) {
        this.coachingHistory = JSON.parse(history);
        // Filter sessions for the current user
        this.coachingHistory = this.coachingHistory.filter(
          (session) => session.userId === auth.user?.id,
        );
      }

      logger.info('Coaching history retrieved successfully', {
        context: { userId: auth.user.id, sessionCount: this.coachingHistory.length },
      });

      addBreadcrumb('Coaching history retrieved', 'ai_coaching', {
        userId: auth.user.id,
        sessionCount: this.coachingHistory.length,
      });

      return this.coachingHistory;
    } catch (error) {
      logger.error('Error getting coaching history', error as Error);
      captureError(error as Error, {
        category: 'storage_error',
        component: 'AICoachingService',
      });
      return [];
    }
  }

  public async syncCoachingData(): Promise<void> {
    try {
      addBreadcrumb('Starting coaching data sync', 'ai_coaching');

      const auth = await getAuth();
      if (!auth?.user) {
        const error = new Error('User not authenticated');
        captureError(error, {
          category: 'auth_error',
          component: 'AICoachingService',
        });
        throw error;
      }

      // Sync coaching sessions to backend
      const localHistory = await this.getCoachingHistory();
      const unsyncedSessions = localHistory.filter((session) => !session.id.includes('synced'));

      if (unsyncedSessions.length > 0) {
        await apiClient.post(
          '/rest/v1/coaching_sessions',
          {
            sessions: unsyncedSessions,
          },
          {
            auth: { required: true },
            cache: { enabled: false },
          },
        );

        logger.info('Coaching data synced successfully', {
          context: { userId: auth.user.id, syncedCount: unsyncedSessions.length },
        });

        addBreadcrumb('Coaching data synced', 'ai_coaching', {
          userId: auth.user.id,
          syncedCount: unsyncedSessions.length,
        });
      }
    } catch (error) {
      logger.error('Error syncing coaching data', error as Error);
      captureError(error as Error, {
        category: 'api_error',
        component: 'AICoachingService',
      });
      // Don't throw - sync failures shouldn't break the app
    }
  }

  private calculateWorkoutFrequency(workouts: WorkoutData[]): number {
    if (!workouts || workouts.length === 0) return 0;

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentWorkouts = workouts.filter((workout) => new Date(workout.created_at) >= oneWeekAgo);

    return recentWorkouts.length;
  }

  private analyzeMeasurementTrend(measurements: MeasurementData[]): {
    isPositive: boolean;
    trend: string;
  } {
    if (!measurements || measurements.length < 2) {
      return { isPositive: false, trend: 'insufficient_data' };
    }

    // Simple trend analysis - compare latest vs previous measurements
    const latest = measurements[0];
    const previous = measurements[1];

    // For weight, decreasing might be positive (depends on goals)
    // For muscle measurements, increasing is generally positive
    const isPositive =
      latest.category === 'WEIGHT'
        ? latest.value <= previous.value
        : latest.value >= previous.value;

    return {
      isPositive,
      trend: latest.value > previous.value ? 'increasing' : 'decreasing',
    };
  }
}

export default AICoachingService;
