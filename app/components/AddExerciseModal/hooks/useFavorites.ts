import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

export const useFavoriteLogic = ({
  currentStep,
  showFavorites,
  selectedMuscleGroup,
  setShowFavorites,
  setCurrentStep,
  setSelectedMuscleGroup,
  setSelectedExerciseIds,
}: {
  currentStep: number;
  showFavorites: boolean;
  selectedMuscleGroup: string;
  setShowFavorites: (show: boolean) => void;
  setCurrentStep: (step: number) => void;
  setSelectedMuscleGroup: (group: string) => void;
  setSelectedExerciseIds: (ids: Set<string>) => void;
}) => {
  const handleFavoritePress = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics might not be available
    }

    if (showFavorites) {
      // If currently showing favorites, turn it off
      setShowFavorites(false);

      // If we have a selected muscle group (step 2), stay on step 2 and keep the muscle group
      // If we don't have a selected muscle group (came from step 1 favorites), go back to step 1
      if (selectedMuscleGroup) {
        // Stay on step 2 with the same muscle group - this will show normal muscle group exercises
        setCurrentStep(2);
        // Keep the selectedMuscleGroup as is
      } else {
        // No muscle group selected, so we came from step 1 favorites - go back to step 1
        setCurrentStep(1);
      }

      // Keep selected exercises when exiting favorites mode
    } else {
      // If not showing favorites, turn it on and go to step 2
      setShowFavorites(true);
      setCurrentStep(2);

      // If we're on step 1 (no muscle group selected), clear muscle group to show all favorites
      // If we're on step 2 (muscle group selected), keep the muscle group to show filtered favorites
      if (currentStep === 1) {
        setSelectedMuscleGroup('');
      }
      // Keep the current selectedMuscleGroup if we're on step 2

      // Keep selected exercises when entering favorites mode
    }
  }, [
    showFavorites,
    selectedMuscleGroup,
    currentStep,
    setShowFavorites,
    setCurrentStep,
    setSelectedMuscleGroup,
    setSelectedExerciseIds,
  ]);

  return { handleFavoritePress };
};
