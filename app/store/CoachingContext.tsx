import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AICoachingService, { CoachingSession, CoachingContext } from '../services/aiCoaching';
import { useAuth } from './AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CoachingState {
  sessions: CoachingSession[];
  context: CoachingContext;
  isLoading: boolean;
  error: string | null;
}

interface CoachingContextType extends CoachingState {
  getCoachingResponse: (prompt: string, type: CoachingSession['type']) => Promise<string>;
  updateContext: (newContext: Partial<CoachingContext>) => void;
  clearError: () => void;
  saveFeedback: (sessionId: string, feedback: string, rating: number) => Promise<void>;
  updateUserProfile: (profile: Partial<CoachingContext['userProfile']>) => void;
  isCoachingEnabled: boolean;
  toggleCoaching: () => void;
}

const defaultContext: CoachingContext = {
  fitnessLevel: 'beginner',
  goals: [],
  preferences: [],
  recentWorkouts: [],
  userProfile: {
    age: 25,
    gender: 'male',
    weight: 70,
    height: 175,
    medicalConditions: []
  }
};

const CoachingContextInstance = createContext<CoachingContextType | undefined>(undefined);

export const CoachingProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [state, setState] = useState<CoachingState>({
    sessions: [],
    context: defaultContext,
    isLoading: false,
    error: null
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
      setState(prev => ({ ...prev, sessions }));
    } catch (error) {
      setState(prev => ({ ...prev, error: 'Failed to load coaching history' }));
    }
  };

  const loadUserProfile = async () => {
    try {
      const profile = await AsyncStorage.getItem('userProfile');
      if (profile) {
        setState(prev => ({
          ...prev,
          context: {
            ...prev.context,
            userProfile: JSON.parse(profile)
          }
        }));
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const getCoachingResponse = async (prompt: string, type: CoachingSession['type']) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await AICoachingService.getInstance().getCoachingResponse(
        prompt,
        state.context,
        type
      );
      await loadCoachingHistory(); // Refresh history after new session
      return response;
    } catch (error) {
      setState(prev => ({ ...prev, error: 'Failed to get coaching response' }));
      throw error;
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const updateContext = (newContext: Partial<CoachingContext>) => {
    setState(prev => ({
      ...prev,
      context: { ...prev.context, ...newContext }
    }));
  };

  const updateUserProfile = async (profile: Partial<CoachingContext['userProfile']>) => {
    const newProfile = { ...state.context.userProfile, ...profile };
    setState(prev => ({
      ...prev,
      context: {
        ...prev.context,
        userProfile: newProfile
      }
    }));
    await AsyncStorage.setItem('userProfile', JSON.stringify(newProfile));
  };

  const saveFeedback = async (sessionId: string, feedback: string, rating: number) => {
    try {
      await AICoachingService.getInstance().saveFeedback(sessionId, feedback, rating);
      await loadCoachingHistory(); // Refresh history after feedback
    } catch (error) {
      setState(prev => ({ ...prev, error: 'Failed to save feedback' }));
      throw error;
    }
  };

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
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
        toggleCoaching
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