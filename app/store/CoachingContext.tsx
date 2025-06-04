import AsyncStorage from '@react-native-async-storage/async-storage';
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
      loadCoachingHistory();
      loadUserProfile();
    }
  }, [user]);

  const loadCoachingHistory = async () => {
    try {
      const sessions = await AICoachingService.getInstance().getCoachingHistory();
      setState((prev) => ({ ...prev, sessions }));
    } catch {
      setState((prev) => ({ ...prev, error: 'Failed to load coaching history' }));
    }
  };

  const loadUserProfile = async () => {
    try {
      const profileString = await AsyncStorage.getItem('userProfile');
      if (profileString) {
        const validationResult = await validationService.validateCoachingUserProfile(
          JSON.parse(profileString),
        );
        if (validationResult.success) {
          setState((prev) => ({
            ...prev,
            context: {
              ...prev.context,
              userProfile: validationResult.data,
            },
          }));
        } else {
          logger.warn('Invalid user profile data in CoachingContext, using default', {
            context: { errors: validationResult.errors },
          });
          // Optionally, save the default profile back to storage if it was invalid
          await AsyncStorage.setItem('userProfile', JSON.stringify(defaultContext.userProfile));
        }
      }
    } catch (error) {
      logger.error('Error loading user profile in CoachingContext', error as Error);
      // Optionally, reset to default and save if there was a parsing or other error
      await AsyncStorage.setItem('userProfile', JSON.stringify(defaultContext.userProfile)).catch(
        (e) => logger.error('Failed to save default profile after error', e),
      );
    }
  };

  const getCoachingResponse = async (prompt: string, type: CoachingSession['type']) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await AICoachingService.getInstance().getCoachingResponse(
        prompt,
        state.context,
        type,
      );
      await loadCoachingHistory(); // Refresh history after new session
      return response;
    } catch (error) {
      setState((prev) => ({ ...prev, error: 'Failed to get coaching response' }));
      throw error;
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const updateContext = (newContext: Partial<AICoachingContextData>) => {
    setState((prev) => ({
      ...prev,
      context: { ...prev.context, ...newContext },
    }));
  };

  const updateUserProfile = async (profile: Partial<AICoachingContextData['userProfile']>) => {
    const newProfile = { ...state.context.userProfile, ...profile };
    // Validate before saving
    const validationResult = await validationService.validateCoachingUserProfile(newProfile);
    if (validationResult.success) {
      setState((prev) => ({
        ...prev,
        context: {
          ...prev.context,
          userProfile: validationResult.data,
        },
      }));
      await AsyncStorage.setItem('userProfile', JSON.stringify(validationResult.data));
    } else {
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
  };

  const saveFeedback = async (sessionId: string, feedback: string, rating: number) => {
    try {
      await AICoachingService.getInstance().saveFeedback(sessionId, feedback, rating);
      await loadCoachingHistory(); // Refresh history after feedback
    } catch {
      setState((prev) => ({ ...prev, error: 'Failed to save feedback' }));
      throw new Error('Failed to save feedback');
    }
  };

  const clearError = () => {
    setState((prev) => ({ ...prev, error: null }));
  };

  const toggleCoaching = () => {
    setIsCoachingEnabled(!isCoachingEnabled);
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
