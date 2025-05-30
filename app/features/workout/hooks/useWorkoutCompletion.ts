import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../../store/AuthContext';
import workoutPlanService from '../../../services/workoutPlanService';
import type { ExerciseData, ExerciseSet } from '../types';

export interface UseWorkoutCompletionParams {
  planId: string;
  workoutDay: number;
  cycleWeek: number;
  weekName: string;
  exercises: ExerciseData[];
  exerciseSets: Record<string, ExerciseSet[]>;
  totalVolume: number;
  totalReps: number;
  workoutDuration: number;
  workoutStartTime: Date | null;
  onNavigateHome: () => void;
}

export interface WorkoutCompletionData {
  completedExercises: number;
  duration: string;
  caloriesBurned: number;
  totalVolume: number;
  totalReps: number;
  completedAt: string;
  weekName: string;
  cycleWeek: number;
}

export interface UseWorkoutCompletionReturn {
  isCompleting: boolean;
  completedWorkoutData: WorkoutCompletionData | null;
  completeWorkout: (overrideVolume?: number, overrideReps?: number) => Promise<void>;
  completeWorkoutWithStateSync: (volume: number, reps: number, finalExerciseSets: Record<string, ExerciseSet[]>) => Promise<void>;
  redoWorkout: () => Promise<void>;
  isWorkoutCompleted: boolean;
  setIsWorkoutCompleted: (completed: boolean) => void;
}

export const useWorkoutCompletion = (params: UseWorkoutCompletionParams): UseWorkoutCompletionReturn => {
  const {
    planId,
    workoutDay,
    cycleWeek,
    weekName,
    exercises,
    exerciseSets,
    totalVolume,
    totalReps,
    workoutDuration,
    workoutStartTime,
    onNavigateHome
  } = params;

  const { user } = useAuth();
  const [isCompleting, setIsCompleting] = useState(false);
  const [isWorkoutCompleted, setIsWorkoutCompleted] = useState(false);
  const [completedWorkoutData, setCompletedWorkoutData] = useState<WorkoutCompletionData | null>(null);

  const calculateWorkoutStats = useCallback((
    finalVolume: number,
    finalReps: number,
    finalDuration: number
  ): WorkoutCompletionData => {
    // Calculate completed exercises
    const completedExercises = exercises.filter(exercise => {
      const sets = exerciseSets[exercise.id] || [];
      return sets.length > 0 && sets.some(set => set.isCompleted);
    }).length;

    // Estimate calories burned (rough calculation: 0.5 calories per kg lifted + base metabolic rate)
    const estimatedCalories = Math.round((finalVolume * 0.5) + (finalDuration / 60) * 5);

    // Format duration
    const formatDuration = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = seconds % 60;

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
      } else {
        return `${remainingSeconds}s`;
      }
    };

    return {
      completedExercises,
      duration: formatDuration(finalDuration),
      caloriesBurned: estimatedCalories,
      totalVolume: finalVolume,
      totalReps: finalReps,
      completedAt: new Date().toISOString(),
      weekName,
      cycleWeek
    };
  }, [exercises, exerciseSets, weekName, cycleWeek]);

  const saveWorkoutToDatabase = useCallback(async (
    finalVolume: number,
    finalReps: number,
    finalDuration: number,
    finalExerciseSets: Record<string, ExerciseSet[]>
  ) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      // Save workout data using the service
      await workoutPlanService.saveCompletedWorkout({
        userId: user.id,
        planId,
        workoutDay,
        cycleWeek,
        weekName,
        exercises,
        exerciseSets: finalExerciseSets,
        totalVolume: finalVolume,
        totalReps: finalReps,
        duration: finalDuration,
        completedAt: new Date().toISOString()
      });

      // Update active plan progress
      await workoutPlanService.updatePlanProgress(user.id, planId, workoutDay, cycleWeek);

    } catch (error) {
      console.error('Error saving workout:', error);
      throw error;
    }
  }, [user, planId, workoutDay, cycleWeek, weekName, exercises]);

  const completeWorkout = useCallback(async (overrideVolume?: number, overrideReps?: number) => {
    if (isCompleting) return;
    
    setIsCompleting(true);

    try {
      const finalVolume = overrideVolume !== undefined ? overrideVolume : totalVolume;
      const finalReps = overrideReps !== undefined ? overrideReps : totalReps;
      const finalDuration = workoutDuration;

      // Save to database
      await saveWorkoutToDatabase(finalVolume, finalReps, finalDuration, exerciseSets);

      // Calculate and set completion data
      const completionData = calculateWorkoutStats(finalVolume, finalReps, finalDuration);
      setCompletedWorkoutData(completionData);
      setIsWorkoutCompleted(true);

    } catch (error) {
      console.error('Error completing workout:', error);
      Alert.alert(
        'Error',
        'Failed to save workout. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCompleting(false);
    }
  }, [isCompleting, totalVolume, totalReps, workoutDuration, exerciseSets, saveWorkoutToDatabase, calculateWorkoutStats]);

  const completeWorkoutWithStateSync = useCallback(async (
    volume: number,
    reps: number,
    finalExerciseSets: Record<string, ExerciseSet[]>
  ) => {
    if (isCompleting) return;
    
    setIsCompleting(true);

    try {
      const finalDuration = workoutDuration;

      // Save to database with the provided state
      await saveWorkoutToDatabase(volume, reps, finalDuration, finalExerciseSets);

      // Calculate and set completion data
      const completionData = calculateWorkoutStats(volume, reps, finalDuration);
      setCompletedWorkoutData(completionData);
      setIsWorkoutCompleted(true);

    } catch (error) {
      console.error('Error completing workout with state sync:', error);
      Alert.alert(
        'Error',
        'Failed to save workout. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCompleting(false);
    }
  }, [isCompleting, workoutDuration, saveWorkoutToDatabase, calculateWorkoutStats]);

  const redoWorkout = useCallback(async () => {
    try {
      // Reset completion state
      setIsWorkoutCompleted(false);
      setCompletedWorkoutData(null);
      setIsCompleting(false);

      // Navigate back to workout (this would need to be implemented in the parent)
      // The parent component should handle resetting all state when this is called
      
    } catch (error) {
      console.error('Error redoing workout:', error);
      Alert.alert(
        'Error',
        'Failed to restart workout. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  return {
    isCompleting,
    completedWorkoutData,
    completeWorkout,
    completeWorkoutWithStateSync,
    redoWorkout,
    isWorkoutCompleted,
    setIsWorkoutCompleted,
  };
}; 