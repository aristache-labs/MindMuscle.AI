import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import workoutPlanService from '../../../services/workoutPlanService';
import type { ExerciseData, ExerciseSet } from '../types';
import type { UserProfile } from '../../../store/AuthContext'; // Import UserProfile

type UseWorkoutExitHandlingProps = {
  user: UserProfile | null; // Use UserProfile type
  planId: string;
  workoutDay: number;
  cycleWeek: number;
  weekName: string;
  exercises: ExerciseData[];
  exerciseSets: Record<string, ExerciseSet[]>;
  workoutDuration: number;
  totalVolume: number;
  totalReps: number;
  currentExerciseIndex: number;
  originalCycleWeek: number | null;
  stopWorkoutTimer: () => void;
};

export const useWorkoutExitHandling = ({
  user,
  planId,
  workoutDay,
  cycleWeek,
  weekName,
  exercises,
  exerciseSets,
  workoutDuration,
  totalVolume,
  totalReps,
  currentExerciseIndex,
  originalCycleWeek,
  stopWorkoutTimer,
}: UseWorkoutExitHandlingProps) => {
  const router = useRouter();
  const [showExitModal, setShowExitModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleBackPress = useCallback(() => {
    setShowExitModal(true);
  }, []);

  const handleExitWorkout = useCallback(() => {
    setShowExitModal(false);
    router.back();
  }, [router]);

  const handlePauseWorkout = useCallback(async () => {
    setShowExitModal(false);

    try {
      setIsLoading(true);

      // Log exercises before saving paused workout
      console.log('PAUSING WORKOUT - Current exercises:', JSON.stringify(exercises));

      // Check for any switched exercises
      const switchedExercises = exercises.filter(
        (ex: ExerciseData & { isChangedExercise?: boolean }) => ex.isChangedExercise === true,
      );
      if (switchedExercises.length > 0) {
        console.log(
          'PAUSING WORKOUT - Found switched exercises:',
          JSON.stringify(switchedExercises),
        );
        console.log(
          'PAUSING WORKOUT - Exercise sets for switched exercises:',
          JSON.stringify(
            switchedExercises.map((ex) => ({
              id: ex.id,
              sets: exerciseSets[ex.id],
            })),
          ),
        );
      }

      // Save the current workout state
      // No change needed for user.id, as UserProfile also has an id property.
      const success = await workoutPlanService.savePausedWorkout({
        userId: user?.id || '',
        planId,
        workoutDay,
        cycleWeek,
        weekName,
        exercises,
        exerciseSets,
        workoutDuration,
        totalVolume,
        totalReps,
        currentExerciseIndex,
        originalCycleWeek,
      });

      console.log('PAUSING WORKOUT - Saved paused workout successfully:', success);

      if (success) {
        Alert.alert(
          'Workout Paused',
          'Your workout has been saved. You can resume it later from the workout plan screen.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Stop the workout timer
                stopWorkoutTimer();

                // Navigate back to home screen
                router.replace('/');
              },
            },
          ],
        );
      } else {
        Alert.alert('Error', 'Failed to pause your workout. Please try again.', [{ text: 'OK' }]);
      }
    } catch {
      Alert.alert('Error', 'Failed to pause your workout. Please try again.', [{ text: 'OK' }]);
    } finally {
      setIsLoading(false);
    }
  }, [
    exercises,
    exerciseSets,
    user,
    planId,
    workoutDay,
    cycleWeek,
    weekName,
    workoutDuration,
    totalVolume,
    totalReps,
    currentExerciseIndex,
    originalCycleWeek,
    stopWorkoutTimer,
    router,
  ]);

  const handleReturnToWorkout = useCallback(() => {
    setShowExitModal(false);
  }, []);

  return {
    showExitModal,
    setShowExitModal,
    isLoading,
    handleBackPress,
    handleExitWorkout,
    handlePauseWorkout,
    handleReturnToWorkout,
  };
};

export default useWorkoutExitHandling;
