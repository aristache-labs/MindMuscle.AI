import { useState, useCallback } from 'react';
import type { ExerciseData, ExerciseSet } from '../types';

export interface UseWorkoutStateParams {
  planId: string;
  workoutDay: number;
  cycleWeek: number;
  weekName: string;
}

export interface UseWorkoutStateReturn {
  // Workout state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  exercises: ExerciseData[];
  setExercises: React.Dispatch<React.SetStateAction<ExerciseData[]>>;
  currentExerciseIndex: number;
  setCurrentExerciseIndex: React.Dispatch<React.SetStateAction<number>>;
  exerciseSets: Record<string, ExerciseSet[]>;
  setExerciseSets: React.Dispatch<React.SetStateAction<Record<string, ExerciseSet[]>>>;
  
  // Totals
  totalVolume: number;
  setTotalVolume: React.Dispatch<React.SetStateAction<number>>;
  totalReps: number;
  setTotalReps: React.Dispatch<React.SetStateAction<number>>;
  
  // Recommendations and data
  recommendations: Record<string, any>;
  setRecommendations: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  lastExerciseValues: Record<string, Record<number, { weight: string, reps: string }>>;
  setLastExerciseValues: React.Dispatch<React.SetStateAction<Record<string, Record<number, { weight: string, reps: string }>>>>;
  
  // User interaction state
  focusedInputs: Record<string, boolean>;
  setFocusedInputs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  userEnteredValues: Record<string, boolean>;
  setUserEnteredValues: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  exerciseCustomized: Record<string, boolean>;
  setExerciseCustomized: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  
  // Modal states
  showWarmup: boolean;
  setShowWarmup: (show: boolean) => void;
  warmupCompleted: boolean;
  setWarmupCompleted: (completed: boolean) => void;
  showExitModal: boolean;
  setShowExitModal: (show: boolean) => void;
  showExerciseDetailsModal: boolean;
  setShowExerciseDetailsModal: (show: boolean) => void;
  showExerciseListModal: boolean;
  setShowExerciseListModal: (show: boolean) => void;
  showCustomizeExerciseModal: boolean;
  setShowCustomizeExerciseModal: (show: boolean) => void;
  
  // Keyboard and UI state
  keyboardHeight: number;
  setKeyboardHeight: (height: number) => void;
  activeInputPosition: number;
  setActiveInputPosition: (position: number) => void;
  textInputRefreshKey: number;
  setTextInputRefreshKey: (key: number) => void;
  
  // Workout completion state
  isWorkoutCompleted: boolean;
  setIsWorkoutCompleted: (completed: boolean) => void;
  workoutState: 'in_progress' | 'completing' | 'completed';
  setWorkoutState: React.Dispatch<React.SetStateAction<'in_progress' | 'completing' | 'completed'>>;
  
  // Helper functions
  getCurrentExercise: () => ExerciseData | undefined;
  getCurrentSets: () => ExerciseSet[];
  resetWorkoutState: () => void;
}

export const useWorkoutState = (params: UseWorkoutStateParams): UseWorkoutStateReturn => {
  // Core workout state
  const [isLoading, setIsLoading] = useState(true);
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [exerciseSets, setExerciseSets] = useState<Record<string, ExerciseSet[]>>({});
  
  // Totals
  const [totalVolume, setTotalVolume] = useState<number>(0);
  const [totalReps, setTotalReps] = useState<number>(0);
  
  // Recommendations and data
  const [recommendations, setRecommendations] = useState<Record<string, any>>({});
  const [lastExerciseValues, setLastExerciseValues] = useState<Record<string, Record<number, { weight: string, reps: string }>>>({});
  
  // User interaction state
  const [focusedInputs, setFocusedInputs] = useState<Record<string, boolean>>({});
  const [userEnteredValues, setUserEnteredValues] = useState<Record<string, boolean>>({});
  const [exerciseCustomized, setExerciseCustomized] = useState<Record<string, boolean>>({});
  
  // Modal states
  const [showWarmup, setShowWarmup] = useState(true);
  const [warmupCompleted, setWarmupCompleted] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showExerciseDetailsModal, setShowExerciseDetailsModal] = useState(false);
  const [showExerciseListModal, setShowExerciseListModal] = useState(false);
  const [showCustomizeExerciseModal, setShowCustomizeExerciseModal] = useState(false);
  
  // Keyboard and UI state
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [activeInputPosition, setActiveInputPosition] = useState(0);
  const [textInputRefreshKey, setTextInputRefreshKey] = useState(0);
  
  // Workout completion state
  const [isWorkoutCompleted, setIsWorkoutCompleted] = useState(false);
  const [workoutState, setWorkoutState] = useState<'in_progress' | 'completing' | 'completed'>('in_progress');
  
  // Helper functions
  const getCurrentExercise = useCallback(() => {
    return exercises[currentExerciseIndex];
  }, [exercises, currentExerciseIndex]);
  
  const getCurrentSets = useCallback(() => {
    const currentExercise = getCurrentExercise();
    return currentExercise ? exerciseSets[currentExercise.id] || [] : [];
  }, [getCurrentExercise, exerciseSets]);
  
  const resetWorkoutState = useCallback(() => {
    setCurrentExerciseIndex(0);
    setTotalVolume(0);
    setTotalReps(0);
    setUserEnteredValues({});
    setExerciseCustomized({});
    setIsWorkoutCompleted(false);
    setWorkoutState('in_progress');
    setTextInputRefreshKey(prev => prev + 1);
    
    // Reset all sets to not completed and empty values
    setExerciseSets(prev => {
      const resetSets = { ...prev };
      Object.keys(resetSets).forEach(exerciseId => {
        resetSets[exerciseId] = resetSets[exerciseId].map(set => ({
          ...set,
          isCompleted: false,
          weight: '',
          reps: ''
        }));
      });
      return resetSets;
    });
  }, []);
  
  return {
    // Core state
    isLoading,
    setIsLoading,
    exercises,
    setExercises,
    currentExerciseIndex,
    setCurrentExerciseIndex,
    exerciseSets,
    setExerciseSets,
    
    // Totals
    totalVolume,
    setTotalVolume,
    totalReps,
    setTotalReps,
    
    // Recommendations and data
    recommendations,
    setRecommendations,
    lastExerciseValues,
    setLastExerciseValues,
    
    // User interaction state
    focusedInputs,
    setFocusedInputs,
    userEnteredValues,
    setUserEnteredValues,
    exerciseCustomized,
    setExerciseCustomized,
    
    // Modal states
    showWarmup,
    setShowWarmup,
    warmupCompleted,
    setWarmupCompleted,
    showExitModal,
    setShowExitModal,
    showExerciseDetailsModal,
    setShowExerciseDetailsModal,
    showExerciseListModal,
    setShowExerciseListModal,
    showCustomizeExerciseModal,
    setShowCustomizeExerciseModal,
    
    // Keyboard and UI state
    keyboardHeight,
    setKeyboardHeight,
    activeInputPosition,
    setActiveInputPosition,
    textInputRefreshKey,
    setTextInputRefreshKey,
    
    // Workout completion state
    isWorkoutCompleted,
    setIsWorkoutCompleted,
    workoutState,
    setWorkoutState,
    
    // Helper functions
    getCurrentExercise,
    getCurrentSets,
    resetWorkoutState,
  };
}; 