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
      // If currently showing favorites, turn it off and go back to step 1
      setShowFavorites(false);
      setCurrentStep(1);
      setSelectedMuscleGroup('');
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
