import React from 'react';
import { Animated } from 'react-native';
import { useSearchState } from '../hooks';
import { SelectedExercise } from '../types';
import {
  Step1MuscleSelection,
  Step2ExerciseSelection,
  Step3Configuration,
  StepAllExercises,
  StepFavorites,
} from './';

export const StepRenderer = ({
  currentStep,
  showFavorites,
  showAllExercises,
  currentView,
  setCurrentView,
  handleMuscleSelect,
  pulseAnim,
  selectedMuscleGroup,
  selectedExerciseIds,
  handleExerciseToggle,
  handleStep2Next,
  searchState,
  selectedExercises,
  handleAddAll,
  isExerciseAlreadyAdded,
  buttonText = 'Next',
}: {
  currentStep: number;
  showFavorites: boolean;
  showAllExercises: boolean;
  currentView: 'front' | 'back';
  setCurrentView: (view: 'front' | 'back') => void;
  handleMuscleSelect: (muscle: string) => void;
  pulseAnim: Animated.Value;
  selectedMuscleGroup: string;
  selectedExerciseIds: Set<string>;
  handleExerciseToggle: (exerciseId: string) => void;
  handleStep2Next: () => void;
  searchState: ReturnType<typeof useSearchState>;
  selectedExercises: SelectedExercise[];
  handleAddAll: (exercises: SelectedExercise[]) => void;
  isExerciseAlreadyAdded?: (exerciseId: string) => boolean;
  buttonText?: string;
}) => {
  if (currentStep === 1) {
    return (
      <Step1MuscleSelection
        currentView={currentView}
        setCurrentView={setCurrentView}
        onMuscleSelect={handleMuscleSelect}
        pulseAnim={pulseAnim}
        searchState={searchState}
      />
    );
  }

  if (currentStep === 2 && !showFavorites) {
    // Show all exercises if coming from search on step 1
    if (showAllExercises) {
      return (
        <StepAllExercises
          selectedExercises={selectedExerciseIds}
          onExerciseToggle={handleExerciseToggle}
          onNext={handleStep2Next}
          searchState={searchState}
          isExerciseAlreadyAdded={isExerciseAlreadyAdded}
          buttonText={buttonText}
        />
      );
    }

    return (
      <Step2ExerciseSelection
        selectedMuscleGroup={selectedMuscleGroup}
        selectedExercises={selectedExerciseIds}
        onExerciseToggle={handleExerciseToggle}
        onNext={handleStep2Next}
        searchState={searchState}
        isExerciseAlreadyAdded={isExerciseAlreadyAdded}
        buttonText={buttonText}
      />
    );
  }

  if (currentStep === 2 && showFavorites) {
    return (
      <StepFavorites
        selectedExercises={selectedExerciseIds}
        onExerciseToggle={handleExerciseToggle}
        onNext={handleStep2Next}
        selectedMuscleGroup={selectedMuscleGroup}
        searchState={searchState}
        isExerciseAlreadyAdded={isExerciseAlreadyAdded}
        buttonText={buttonText}
      />
    );
  }

  if (currentStep === 3) {
    return <Step3Configuration selectedExercises={selectedExercises} onAddAll={handleAddAll} />;
  }

  return null;
};
