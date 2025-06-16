import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { logger } from '../utils/logger';
import AICoachingService, {
  CoachingContext as AICoachingContextData,
  CoachingSession,
} from '../services/aiCoaching';
import { validationService } from '../services/validationService';
import { useAuth } from './AuthContext';

interface CoachingState {
  sessions: CoachingSession[];
  context: AICoachingContextData;
  isLoading: boolean;
  error: string | null;
}

interface CoachingContextType extends CoachingState {
  getCoachingResponse: (prompt: string, type: CoachingSession['type']) => Promise<string>;
  updateContext: (newContext: Partial<AICoachingContextData>) => void;
  clearError: () => void;
  saveFeedback: (sessionId: string, feedback: string, rating: number) => Promise<void>;
  updateUserProfile: (profile: Partial<AICoachingContextData['userProfile']>) => void;
  isCoachingEnabled: boolean;
  toggleCoaching: () => void;
}

const defaultContext: AICoachingContextData = {
  fitnessLevel: 'beginner',
  goals: [],
  preferences: [],
  recentWorkouts: [],
  userProfile: {
    age: 25,
    gender: 'male',
    weight: 70,
    height: 175,
    medicalConditions: [],
  },
};

const CoachingContextInstance = createContext<CoachingContextType | undefined>(undefined);

export const CoachingProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [state, setState] = useState<CoachingState>({
    sessions: [],
    context: defaultContext,
    isLoading: false,
    error: null,
  });
  const [isCoachingEnabled, setIsCoachingEnabled] = useState(false);

  useEffect(() => {
    if (user) {
      Sentry.addBreadcrumb({
        message: 'User authenticated, loading coaching data',
        category: 'coaching.init',
        data: { userId: user.id },
        level: 'info',
      });
      loadCoachingHistory();
      loadUserProfile();
    }
  }, [user]);

  const loadCoachingHistory = async () => {
    const startTime = Date.now();

    try {
      Sentry.addBreadcrumb({
        message: 'Loading coaching history',
        category: 'coaching.history',
        data: { userId: user?.id },
        level: 'info',
      });

      const sessions = await AICoachingService.getInstance().getCoachingHistory();

      const duration = Date.now() - startTime;
      Sentry.addBreadcrumb({
        message: 'Successfully loaded coaching history',
        category: 'coaching.history',
        data: {
          userId: user?.id,
          sessionCount: sessions.length,
          duration,
        },
        level: 'info',
      });

      setState((prev) => ({ ...prev, sessions }));
    } catch (error) {
      const duration = Date.now() - startTime;

      Sentry.captureException(error, {
        tags: { operation: 'loadCoachingHistory' },
        extra: {
          userId: user?.id,
          duration,
        },
      });

      setState((prev) => ({ ...prev, error: 'Failed to load coaching history' }));
    }
  };

  const loadUserProfile = async () => {
    const startTime = Date.now();

    try {
      Sentry.addBreadcrumb({
        message: 'Loading user profile for coaching',
        category: 'coaching.profile',
        data: { userId: user?.id },
        level: 'info',
      });

      const profileString = await AsyncStorage.getItem('userProfile');

      if (profileString) {
        Sentry.addBreadcrumb({
          message: 'Found user profile in storage, validating',
          category: 'coaching.profile',
          level: 'debug',
        });

        const validationResult = await validationService.validateCoachingUserProfile(
          JSON.parse(profileString),
        );

        if (validationResult.success) {
          const duration = Date.now() - startTime;
          const profileData = validationResult.data as AICoachingContextData['userProfile'];

          Sentry.addBreadcrumb({
            message: 'Successfully loaded and validated user profile',
            category: 'coaching.profile',
            data: {
              userId: user?.id,
              profileAge: profileData.age,
              profileGender: profileData.gender,
              duration,
            },
            level: 'info',
          });

          setState((prev) => ({
            ...prev,
            context: {
              ...prev.context,
              userProfile: profileData,
            },
          }));
        } else {
          Sentry.addBreadcrumb({
            message: 'Invalid user profile data found, using default',
            category: 'coaching.profile',
            data: {
              userId: user?.id,
              validationErrors: validationResult.errors,
            },
            level: 'warning',
          });

          logger.warn('Invalid user profile data in CoachingContext, using default', {
            context: { errors: validationResult.errors },
          });

          // Optionally, save the default profile back to storage if it was invalid
          await AsyncStorage.setItem('userProfile', JSON.stringify(defaultContext.userProfile));
        }
      } else {
        const duration = Date.now() - startTime;

        Sentry.addBreadcrumb({
          message: 'No user profile found in storage, using default',
          category: 'coaching.profile',
          data: { userId: user?.id, duration },
          level: 'info',
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      Sentry.captureException(error, {
        tags: { operation: 'loadUserProfile' },
        extra: {
          userId: user?.id,
          duration,
        },
      });

      logger.error('Error loading user profile in CoachingContext', error as Error);

      // Optionally, reset to default and save if there was a parsing or other error
      await AsyncStorage.setItem('userProfile', JSON.stringify(defaultContext.userProfile)).catch(
        (e) => {
          Sentry.captureException(e, {
            tags: { operation: 'loadUserProfile', step: 'saveDefaultProfile' },
            extra: { userId: user?.id },
          });
          logger.error('Failed to save default profile after error', e);
        },
      );
    }
  };

  const getCoachingResponse = async (prompt: string, type: CoachingSession['type']) => {
    const startTime = Date.now();

    try {
      Sentry.addBreadcrumb({
        message: 'Getting coaching response',
        category: 'coaching.response',
        data: {
          userId: user?.id,
          promptLength: prompt.length,
          sessionType: type,
        },
        level: 'info',
      });

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await AICoachingService.getInstance().getCoachingResponse(
        prompt,
        state.context,
        type,
      );

      Sentry.addBreadcrumb({
        message: 'Received coaching response, refreshing history',
        category: 'coaching.response',
        data: {
          userId: user?.id,
          responseLength: response.length,
          sessionType: type,
        },
        level: 'debug',
      });

      await loadCoachingHistory(); // Refresh history after new session

      const duration = Date.now() - startTime;
      Sentry.addBreadcrumb({
        message: 'Successfully completed coaching response',
        category: 'coaching.response',
        data: {
          userId: user?.id,
          promptLength: prompt.length,
          responseLength: response.length,
          sessionType: type,
          duration,
        },
        level: 'info',
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      Sentry.captureException(error, {
        tags: { operation: 'getCoachingResponse' },
        extra: {
          userId: user?.id,
          promptLength: prompt.length,
          sessionType: type,
          duration,
        },
      });

      setState((prev) => ({ ...prev, error: 'Failed to get coaching response' }));
      throw error;
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const updateContext = (newContext: Partial<AICoachingContextData>) => {
    try {
      Sentry.addBreadcrumb({
        message: 'Updating coaching context',
        category: 'coaching.context',
        data: {
          userId: user?.id,
          updatedFields: Object.keys(newContext),
        },
        level: 'info',
      });

      setState((prev) => ({
        ...prev,
        context: { ...prev.context, ...newContext },
      }));

      Sentry.addBreadcrumb({
        message: 'Successfully updated coaching context',
        category: 'coaching.context',
        data: {
          userId: user?.id,
          updatedFields: Object.keys(newContext),
        },
        level: 'debug',
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'updateContext' },
        extra: {
          userId: user?.id,
          newContext,
        },
      });
    }
  };

  const updateUserProfile = async (profile: Partial<AICoachingContextData['userProfile']>) => {
    const startTime = Date.now();

    try {
      Sentry.addBreadcrumb({
        message: 'Updating user profile',
        category: 'coaching.profile',
        data: {
          userId: user?.id,
          updatedFields: Object.keys(profile),
        },
        level: 'info',
      });

      const newProfile = { ...state.context.userProfile, ...profile };

      // Validate before saving
      const validationResult = await validationService.validateCoachingUserProfile(newProfile);

      if (validationResult.success) {
        const profileData = validationResult.data as AICoachingContextData['userProfile'];

        Sentry.addBreadcrumb({
          message: 'User profile validated successfully, saving',
          category: 'coaching.profile',
          data: {
            userId: user?.id,
            profileAge: profileData.age,
            profileGender: profileData.gender,
          },
          level: 'debug',
        });

        setState((prev) => ({
          ...prev,
          context: {
            ...prev.context,
            userProfile: profileData,
          },
        }));

        await AsyncStorage.setItem('userProfile', JSON.stringify(profileData));

        const duration = Date.now() - startTime;
        Sentry.addBreadcrumb({
          message: 'Successfully updated user profile',
          category: 'coaching.profile',
          data: {
            userId: user?.id,
            updatedFields: Object.keys(profile),
            duration,
          },
          level: 'info',
        });
      } else {
        const duration = Date.now() - startTime;

        Sentry.captureException(new Error('User profile validation failed'), {
          tags: { operation: 'updateUserProfile', step: 'validation' },
          extra: {
            userId: user?.id,
            validationErrors: validationResult.errors,
            profileData: newProfile,
            duration,
          },
        });

        logger.error(
          'Failed to update user profile due to validation errors',
          new Error('Validation failed'),
          {
            context: { errors: validationResult.errors, profileData: newProfile },
          },
        );

        // Potentially set an error state to inform the user
        setState((prev) => ({ ...prev, error: 'Failed to save profile settings. Invalid data.' }));
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      Sentry.captureException(error, {
        tags: { operation: 'updateUserProfile' },
        extra: {
          userId: user?.id,
          profileUpdates: profile,
          duration,
        },
      });

      setState((prev) => ({ ...prev, error: 'Failed to save profile settings. Invalid data.' }));
    }
  };

  const saveFeedback = async (sessionId: string, feedback: string, rating: number) => {
    const startTime = Date.now();

    try {
      Sentry.addBreadcrumb({
        message: 'Saving coaching feedback',
        category: 'coaching.feedback',
        data: {
          userId: user?.id,
          sessionId,
          feedbackLength: feedback.length,
          rating,
        },
        level: 'info',
      });

      await AICoachingService.getInstance().saveFeedback(sessionId, feedback, rating);

      Sentry.addBreadcrumb({
        message: 'Feedback saved, refreshing coaching history',
        category: 'coaching.feedback',
        data: {
          userId: user?.id,
          sessionId,
          rating,
        },
        level: 'debug',
      });

      await loadCoachingHistory(); // Refresh history after feedback

      const duration = Date.now() - startTime;
      Sentry.addBreadcrumb({
        message: 'Successfully saved coaching feedback',
        category: 'coaching.feedback',
        data: {
          userId: user?.id,
          sessionId,
          feedbackLength: feedback.length,
          rating,
          duration,
        },
        level: 'info',
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      Sentry.captureException(error, {
        tags: { operation: 'saveFeedback' },
        extra: {
          userId: user?.id,
          sessionId,
          feedbackLength: feedback.length,
          rating,
          duration,
        },
      });

      setState((prev) => ({ ...prev, error: 'Failed to save feedback' }));
      throw new Error('Failed to save feedback');
    }
  };

  const clearError = () => {
    try {
      Sentry.addBreadcrumb({
        message: 'Clearing coaching error',
        category: 'coaching.error',
        data: { userId: user?.id },
        level: 'debug',
      });

      setState((prev) => ({ ...prev, error: null }));
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'clearError' },
        extra: { userId: user?.id },
      });
    }
  };

  const toggleCoaching = () => {
    try {
      const newState = !isCoachingEnabled;

      Sentry.addBreadcrumb({
        message: 'Toggling coaching state',
        category: 'coaching.toggle',
        data: {
          userId: user?.id,
          previousState: isCoachingEnabled,
          newState,
        },
        level: 'info',
      });

      setIsCoachingEnabled(newState);

      Sentry.addBreadcrumb({
        message: 'Successfully toggled coaching state',
        category: 'coaching.toggle',
        data: {
          userId: user?.id,
          newState,
        },
        level: 'debug',
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'toggleCoaching' },
        extra: {
          userId: user?.id,
          currentState: isCoachingEnabled,
        },
      });
    }
  };

  return (
    <CoachingContextInstance.Provider
      value={{
        ...state,
        getCoachingResponse,
        updateContext,
        updateUserProfile,
        saveFeedback,
        clearError,
        isCoachingEnabled,
        toggleCoaching,
      }}
    >
      {children}
    </CoachingContextInstance.Provider>
  );
};

export const useCoaching = () => {
  const context = useContext(CoachingContextInstance);
  if (context === undefined) {
    throw new Error('useCoaching must be used within a CoachingProvider');
  }
  return context;
};

export default CoachingProvider;
