import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import exerciseService, { Exercise, ExerciseCategory } from '../../services/exerciseService';
import { captureAPIError, captureUIError, SentryReactProfiler } from '../../services/sentry';
import * as Sentry from '@sentry/react-native';
import { FloatingSearchUI } from './components/FloatingSearchUI';
import { StepRenderer } from './components/StepRenderer';
import { useFavoriteLogic, useSearchState } from './hooks';
import { styles } from './styles';
import { AddExerciseModalProps, ExerciseConfiguration, SelectedExercise } from './types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AddExerciseModal({
  visible,
  onClose,
  onAddExercises,
  currentWorkoutExercises = [],
}: AddExerciseModalProps) {
  const insets = useSafeAreaInsets();

  // Create a set of existing exercise IDs for quick lookup
  const existingExerciseIds = useMemo(() => {
    const idSet = new Set<string>();
    currentWorkoutExercises.forEach((exercise) => {
      // Check both id and exercise_id fields to handle different exercise formats
      if (exercise.id) idSet.add(exercise.id);
      if (exercise.exercise_id) idSet.add(exercise.exercise_id);
    });
    return idSet;
  }, [currentWorkoutExercises]);

  // Helper function to check if an exercise is already in the workout
  const isExerciseAlreadyAdded = useCallback(
    (exerciseId: string) => {
      return existingExerciseIds.has(exerciseId);
    },
    [existingExerciseIds],
  );

  const [currentStep, setCurrentStep] = useState(1);
  const [currentView, setCurrentView] = useState<'front' | 'back'>('front');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>('');
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);

  const [showFavorites, setShowFavorites] = useState(false);
  const [showAllExercises, setShowAllExercises] = useState(false);

  // Track modal lifecycle and errors
  useEffect(() => {
    if (visible) {
      // Track modal opening
      Sentry.addBreadcrumb({
        message: 'Add Exercise Modal Opened',
        category: 'user.interaction',
        level: 'info',
        data: {
          timestamp: new Date().toISOString(),
          initialStep: currentStep,
        },
      });

      // Track component lifecycle
      SentryReactProfiler.trackComponentLifecycle('AddExerciseModal', 'mount');
    } else {
      // Track modal closing
      Sentry.addBreadcrumb({
        message: 'Add Exercise Modal Closed',
        category: 'user.interaction',
        level: 'info',
        data: {
          timestamp: new Date().toISOString(),
          finalStep: currentStep,
          selectedExercisesCount: selectedExercises.length,
          selectedMuscleGroup,
        },
      });

      // Track component lifecycle
      SentryReactProfiler.trackComponentLifecycle('AddExerciseModal', 'unmount');
    }
  }, [visible, currentStep, selectedExercises.length, selectedMuscleGroup]);

  // Track step changes
  useEffect(() => {
    if (visible && currentStep > 1) {
      Sentry.addBreadcrumb({
        message: `Step Changed to ${currentStep}`,
        category: 'user.navigation',
        level: 'info',
        data: {
          step: currentStep,
          muscleGroup: selectedMuscleGroup,
          exerciseCount: selectedExerciseIds.size,
          showFavorites,
          showAllExercises,
        },
      });
    }
  }, [
    currentStep,
    visible,
    selectedMuscleGroup,
    selectedExerciseIds.size,
    showFavorites,
    showAllExercises,
  ]);

  // Handle search from step 1 - navigate to step 2 with all exercises
  const handleSearchFromStep1 = useCallback(() => {
    setShowAllExercises(true);
    setSelectedMuscleGroup(''); // Clear muscle group selection
    setShowFavorites(false); // Turn off favorites
    setCurrentStep(2);
    // Keep selected exercises when searching from step 1
  }, []);

  // Search state
  const searchState = useSearchState(handleSearchFromStep1);

  // Favorite logic
  const favoriteLogic = useFavoriteLogic({
    currentStep,
    showFavorites,
    selectedMuscleGroup,
    setShowFavorites,
    setCurrentStep,
    setSelectedMuscleGroup,
    setSelectedExerciseIds,
  });

  // Animations
  const modalAnimation = useSharedValue(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const resetModalState = useCallback(() => {
    modalAnimation.value = withTiming(0, { duration: 300 });
    setCurrentStep(1);
    setSelectedMuscleGroup('');
    setSelectedExerciseIds(new Set());
    setSelectedExercises([]);
    setCurrentView('front');
    setShowFavorites(false);
    setShowAllExercises(false);
    // Clear search when modal closes - called directly without dependencies
    searchState.setSearchQuery('');
    searchState.setIsSearchActive(false);
    searchState.setShouldActivateSearchOnStep2(false);
    searchState.searchWidthAnim.setValue(40);
    searchState.contentOffsetAnim.setValue(0);
  }, [modalAnimation]); // Only depend on modalAnimation which is stable

  useEffect(() => {
    if (visible) {
      modalAnimation.value = withSpring(1, { damping: 20, stiffness: 300 });

      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      resetModalState();
    }
  }, [visible, modalAnimation, pulseAnim, resetModalState]);

  const modalStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            modalAnimation.value,
            [0, 1],
            [SCREEN_HEIGHT * 0.5, 0],
            Extrapolation.CLAMP,
          ),
        },
        {
          scale: interpolate(modalAnimation.value, [0, 1], [0.95, 1], Extrapolation.CLAMP),
        },
      ],
      opacity: modalAnimation.value,
    };
  });

  const backdropStyle = useAnimatedStyle(() => {
    return {
      opacity: modalAnimation.value * 0.6,
    };
  });

  const handleMuscleSelect = useCallback(
    async (muscleName: string) => {
      try {
        // Track muscle group selection
        Sentry.addBreadcrumb({
          message: 'Muscle Group Selected',
          category: 'user.interaction',
          level: 'info',
          data: {
            muscleGroup: muscleName,
            previousStep: currentStep,
            timestamp: new Date().toISOString(),
          },
        });

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        setSelectedMuscleGroup(muscleName);
        setCurrentStep(2);
      } catch (error) {
        // Capture haptics or other errors
        captureUIError(error as Error, 'AddExerciseModal.handleMuscleSelect', 'add-exercise-modal');

        // Still proceed with muscle selection even if haptics fail
        setSelectedMuscleGroup(muscleName);
        setCurrentStep(2);
      }
    },
    [currentStep],
  );

  const handleExerciseToggle = useCallback(
    (exerciseId: string) => {
      try {
        // Don't allow selecting exercises that are already in the workout
        if (isExerciseAlreadyAdded(exerciseId)) {
          Sentry.addBreadcrumb({
            message: 'Attempted to select already added exercise',
            category: 'user.interaction',
            level: 'info',
            data: {
              exerciseId,
              action: 'exercise_already_added',
            },
          });
          return;
        }

        setSelectedExerciseIds((prev) => {
          const newSet = new Set(prev);
          const wasSelected = newSet.has(exerciseId);

          if (wasSelected) {
            newSet.delete(exerciseId);
          } else {
            newSet.add(exerciseId);
          }

          // Track exercise selection/deselection
          Sentry.addBreadcrumb({
            message: `Exercise ${wasSelected ? 'Deselected' : 'Selected'}`,
            category: 'user.interaction',
            level: 'info',
            data: {
              exerciseId,
              action: wasSelected ? 'deselect' : 'select',
              totalSelected: newSet.size,
              muscleGroup: selectedMuscleGroup,
              step: currentStep,
            },
          });

          return newSet;
        });
      } catch (error) {
        captureUIError(
          error as Error,
          'AddExerciseModal.handleExerciseToggle',
          'add-exercise-modal',
        );
      }
    },
    [selectedMuscleGroup, currentStep, isExerciseAlreadyAdded],
  );

  const handleStep2Next = useCallback(async () => {
    const startTime = Date.now();

    try {
      // Track progression to configuration step
      Sentry.addBreadcrumb({
        message: 'Proceeding to Exercise Configuration',
        category: 'user.navigation',
        level: 'info',
        data: {
          selectedCount: selectedExerciseIds.size,
          muscleGroup: selectedMuscleGroup,
          showFavorites,
          showAllExercises,
        },
      });

      setCurrentStep(3);

      let exerciseData: Exercise[] = [];

      if (showFavorites) {
        // If we're in favorites mode, get all favorite exercises
        Sentry.addBreadcrumb({
          message: 'Loading Favorite Exercises for Configuration',
          category: 'api.request',
          level: 'info',
        });

        exerciseData = await exerciseService.getFavoriteExercises();
      } else if (showAllExercises) {
        // If we're showing all exercises (from search), load all categories
        Sentry.addBreadcrumb({
          message: 'Loading All Exercises for Configuration (from search)',
          category: 'api.request',
          level: 'info',
        });

        const allCategories: ExerciseCategory[] = [
          'Chest',
          'Biceps',
          'Triceps',
          'Abs',
          'Shoulders',
          'Lats',
          'Quads',
          'Hamstrings',
          'Glutes',
          'Calves',
          'Forearms',
          'Lower_back',
          'Traps',
          'Obliques',
          'Adductors',
          'Abductors',
          'Cardio',
        ];

        for (const category of allCategories) {
          try {
            const categoryExercises = await exerciseService.getExercisesByCategory(category);
            exerciseData = [...exerciseData, ...categoryExercises];
          } catch (error) {
            console.warn(`Failed to load exercises for category ${category}:`, error);
          }
        }
      } else {
        // We need to determine if the selected exercises span multiple muscle groups
        // If so, load exercises from all categories to ensure we get all selected exercises
        const selectedIds = Array.from(selectedExerciseIds);

        // First, try loading from the current muscle group
        let categoryKey = selectedMuscleGroup;
        if (selectedMuscleGroup === 'Lower back') {
          categoryKey = 'Lower_back';
        }

        Sentry.addBreadcrumb({
          message: 'Loading Category Exercises for Configuration',
          category: 'api.request',
          level: 'info',
          data: {
            category: categoryKey,
            originalMuscleGroup: selectedMuscleGroup,
            selectedCount: selectedIds.length,
          },
        });

        exerciseData = await exerciseService.getExercisesByCategory(
          categoryKey as ExerciseCategory,
        );

        // Check if all selected exercises are found in the current category
        const foundExerciseIds = exerciseData.map((ex) => ex.id);
        const missingExerciseIds = selectedIds.filter((id) => !foundExerciseIds.includes(id));

        // If there are missing exercises, they're from other muscle groups
        // Load all categories to find them
        if (missingExerciseIds.length > 0) {
          Sentry.addBreadcrumb({
            message: 'Loading exercises from all categories (multi-group selection detected)',
            category: 'api.request',
            level: 'info',
            data: {
              missingCount: missingExerciseIds.length,
              totalSelected: selectedIds.length,
              currentCategory: categoryKey,
            },
          });

          const allCategories: ExerciseCategory[] = [
            'Chest',
            'Biceps',
            'Triceps',
            'Abs',
            'Shoulders',
            'Lats',
            'Quads',
            'Hamstrings',
            'Glutes',
            'Calves',
            'Forearms',
            'Lower_back',
            'Traps',
            'Obliques',
            'Adductors',
            'Abductors',
            'Cardio',
          ];

          // Load exercises from all categories (excluding the one we already loaded)
          for (const category of allCategories) {
            if (category !== categoryKey) {
              try {
                const categoryExercises = await exerciseService.getExercisesByCategory(category);
                exerciseData = [...exerciseData, ...categoryExercises];
              } catch (error) {
                console.warn(`Failed to load exercises for category ${category}:`, error);
              }
            }
          }
        }
      }

      const selected = exerciseData
        .filter((ex) => selectedExerciseIds.has(ex.id))
        .map((ex) => ({
          ...ex,
          sets: 3, // Default sets
          reps_range: '8-10', // Default reps
        }));

      setSelectedExercises(selected);

      // Track successful progression
      const duration = Date.now() - startTime;
      Sentry.addBreadcrumb({
        message: 'Exercise Configuration Data Loaded Successfully',
        category: 'api.success',
        level: 'info',
        data: {
          exercisesLoaded: exerciseData.length,
          selectedForConfiguration: selected.length,
          loadDuration: duration,
        },
      });
    } catch (error) {
      console.error('Error loading exercise data:', error);

      // Capture API error with detailed context
      captureAPIError(error as Error, 'exercise-configuration-load', 'AddExerciseModal');

      Sentry.addBreadcrumb({
        message: 'Failed to Load Exercise Configuration Data',
        category: 'api.error',
        level: 'error',
        data: {
          error: (error as Error).message,
          muscleGroup: selectedMuscleGroup,
          showFavorites,
          selectedCount: selectedExerciseIds.size,
        },
      });
    }
  }, [selectedMuscleGroup, selectedExerciseIds, showFavorites, showAllExercises]);

  const handleAddAll = useCallback(
    (exercisesToAdd: SelectedExercise[]) => {
      // Transform SelectedExercise to ExerciseConfiguration
      const exerciseConfigurations: ExerciseConfiguration[] = exercisesToAdd.map((exercise) => ({
        exerciseId: exercise.id,
        name: exercise.name,
        sets: exercise.sets,
        reps_range: exercise.reps_range,
        image_url: exercise.image_url,
        muscle_group: exercise.muscle_group || selectedMuscleGroup,
        primary_muscles: exercise.primary_muscles,
        requires_weight: exercise.requires_weight,
      }));

      onAddExercises(exerciseConfigurations);
      onClose();
    },
    [onAddExercises, onClose, selectedMuscleGroup],
  );

  const handleBack = useCallback(() => {
    if (currentStep === 2) {
      // If we're showing all exercises (from search), go back to step 1
      if (showAllExercises) {
        setShowAllExercises(false);
        setCurrentStep(1);
        // Keep selected exercises when going back from search
        // Clear search when going back
        searchState.setSearchQuery('');
        searchState.setIsSearchActive(false);
        searchState.setShouldActivateSearchOnStep2(false);
        return;
      }

      // If we're showing favorites, turn off favorites mode and go back to step 1
      if (showFavorites) {
        setShowFavorites(false);
        setCurrentStep(1);
        setSelectedMuscleGroup('');
        // Keep selected exercises when going back from favorites
      } else {
        // Regular back behavior: go to step 1
        setCurrentStep(1);
        setSelectedMuscleGroup('');
        // Keep selected exercises when going back to muscle group selection
      }
    } else if (currentStep === 3) {
      setCurrentStep(2);
      setSelectedExercises([]);
    }
  }, [currentStep, showFavorites, showAllExercises, selectedMuscleGroup, searchState]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const getStepTitle = () => {
    if (showFavorites && currentStep === 2) {
      if (selectedMuscleGroup) {
        return `Favorite ${selectedMuscleGroup} Exercises`;
      }
      return 'Favorite Exercises';
    }

    if (showAllExercises && currentStep === 2) {
      return 'All Exercises';
    }

    switch (currentStep) {
      case 1:
        return 'Select Muscle Group';
      case 2:
        return `${selectedMuscleGroup} Exercises`;
      case 3:
        return 'Configure Exercises';
      default:
        return 'Add Exercises';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={currentStep === 1 && !showFavorites ? handleClose : handleBack}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.backdrop, backdropStyle]}>
            <TouchableOpacity style={styles.backdrop} onPress={handleClose} activeOpacity={1} />
          </Animated.View>

          <Animated.View style={[styles.modalContainer, modalStyle]}>
            <View style={styles.container}>
              {/* Adding glowing corners */}
              <View style={styles.topGlowLeft} />
              <View style={styles.topGlowRight} />
              {/* Header */}
              <View style={[styles.header, { paddingTop: Math.max(insets.top - 50, 5) }]}>
                <View style={styles.headerLeft}>
                  <TouchableOpacity
                    onPress={currentStep === 1 && !showFavorites ? handleClose : handleBack}
                    style={styles.headerButton}
                  >
                    <Ionicons
                      name={currentStep === 1 && !showFavorites ? 'close' : 'arrow-back'}
                      size={24}
                      color={COLORS.text}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.headerCenter}>
                  <Text style={styles.headerTitle}>{getStepTitle()}</Text>
                  <View style={styles.stepIndicator}>
                    {[1, 2, 3].map((step) => (
                      <View
                        key={step}
                        style={[styles.stepDot, currentStep >= step && styles.stepDotActive]}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.headerRight}>
                  {/* Only show favorite button on steps 1 and 2 */}
                  {currentStep !== 3 && (
                    <TouchableOpacity
                      style={styles.headerButton}
                      onPress={favoriteLogic.handleFavoritePress}
                    >
                      <Ionicons
                        name={showFavorites ? 'star' : 'star-outline'}
                        size={24}
                        color={showFavorites ? '#FFD700' : COLORS.text}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Content */}
              <View style={styles.content}>
                <Animated.View
                  style={[
                    styles.animatedContentContainer,
                    {
                      transform: [
                        {
                          translateY: searchState.contentOffsetAnim,
                        },
                      ],
                    },
                  ]}
                >
                  <StepRenderer
                    currentStep={currentStep}
                    showFavorites={showFavorites}
                    showAllExercises={showAllExercises}
                    currentView={currentView}
                    setCurrentView={setCurrentView}
                    handleMuscleSelect={handleMuscleSelect}
                    pulseAnim={pulseAnim}
                    selectedMuscleGroup={selectedMuscleGroup}
                    selectedExerciseIds={selectedExerciseIds}
                    handleExerciseToggle={handleExerciseToggle}
                    handleStep2Next={handleStep2Next}
                    searchState={searchState}
                    selectedExercises={selectedExercises}
                    handleAddAll={handleAddAll}
                    isExerciseAlreadyAdded={isExerciseAlreadyAdded}
                  />
                </Animated.View>
              </View>
            </View>
          </Animated.View>

          {/* Floating Search UI - show on steps 1 and 2 */}
          {(currentStep === 1 || currentStep === 2) && (
            <FloatingSearchUI
              searchState={searchState}
              stepTitle={getStepTitle()}
              currentStep={currentStep}
            />
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
