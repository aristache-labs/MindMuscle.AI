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
import { COLORS } from '../constants/theme';
import exerciseService, { Exercise, ExerciseCategory } from '../services/exerciseService';
import { captureUIError, SentryReactProfiler, captureAPIError } from '../services/sentry';
import * as Sentry from '@sentry/react-native';
import supabase from '../services/supabase';
import { SentryDataCollection, SentryLogger } from '../services/sentry';
import { FloatingSearchUI } from './AddExerciseModal/components/FloatingSearchUI';
import { StepRenderer } from './AddExerciseModal/components/StepRenderer';
import { useFavoriteLogic, useSearchState } from './AddExerciseModal/hooks';
import { styles } from './AddExerciseModal/styles';
import { SelectedExercise } from './AddExerciseModal/types';

interface InsightsExerciseTrackingModalProps {
  visible: boolean;
  onClose: () => void;
  onExercisesSelected: (exercises: Exercise[]) => void;
  userId: string;
  currentTrackedExerciseIds: string[];
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function InsightsExerciseTrackingModal({
  visible,
  onClose,
  onExercisesSelected,
  userId,
  currentTrackedExerciseIds,
}: InsightsExerciseTrackingModalProps) {
  const insets = useSafeAreaInsets();

  // Create a set of existing exercise IDs for quick lookup
  const existingExerciseIds = useMemo(() => {
    return new Set(currentTrackedExerciseIds);
  }, [currentTrackedExerciseIds]);

  // Helper function to check if an exercise is already being tracked
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
  const [selectedExercises] = useState<SelectedExercise[]>([]);
  const [accumulatedExercises, setAccumulatedExercises] = useState<Exercise[]>([]);

  const [showFavorites, setShowFavorites] = useState(false);
  const [showAllExercises, setShowAllExercises] = useState(false);

  // Track modal lifecycle and errors
  useEffect(() => {
    if (visible) {
      // Track modal opening
      Sentry.addBreadcrumb({
        message: 'Insights Exercise Tracking Modal Opened',
        category: 'user.interaction',
        level: 'info',
        data: {
          timestamp: new Date().toISOString(),
          initialStep: currentStep,
          currentTrackedCount: currentTrackedExerciseIds.length,
        },
      });

      // Track component lifecycle
      SentryReactProfiler.trackComponentLifecycle('InsightsExerciseTrackingModal', 'mount');
    } else {
      // Track modal closing
      Sentry.addBreadcrumb({
        message: 'Insights Exercise Tracking Modal Closed',
        category: 'user.interaction',
        level: 'info',
        data: {
          timestamp: new Date().toISOString(),
          finalStep: currentStep,
          selectedExercisesCount: selectedExerciseIds.size,
          selectedMuscleGroup,
        },
      });

      // Track component lifecycle
      SentryReactProfiler.trackComponentLifecycle('InsightsExerciseTrackingModal', 'unmount');
    }
  }, [
    visible,
    currentStep,
    selectedExerciseIds.size,
    selectedMuscleGroup,
    currentTrackedExerciseIds.length,
  ]);

  // Track step changes
  useEffect(() => {
    if (visible && currentStep > 1) {
      Sentry.addBreadcrumb({
        message: 'Insights Modal Step Changed',
        category: 'user.interaction',
        level: 'info',
        data: {
          step: currentStep,
          selectedMuscleGroup,
          showFavorites,
          showAllExercises,
          selectedExercisesCount: selectedExerciseIds.size,
        },
      });
    }
  }, [
    currentStep,
    selectedMuscleGroup,
    showFavorites,
    showAllExercises,
    selectedExerciseIds.size,
    visible,
  ]);

  // Animation values
  const slideAnim = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Search state
  const searchState = useSearchState(() => {
    setShowAllExercises(true);
    setCurrentStep(2);
  });

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

  // Start pulsing animation for muscle markers
  useEffect(() => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => pulse());
    };
    pulse();
  }, []);

  // Modal animations
  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const animatedModalStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          slideAnim.value,
          [0, SCREEN_HEIGHT],
          [0, SCREEN_HEIGHT],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Handle modal visibility changes
  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 300 });
      slideAnim.value = withSpring(0, {
        damping: 20,
        stiffness: 90,
      });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      slideAnim.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
    }
  }, [visible]);

  // Reset modal state when closed
  useEffect(() => {
    if (!visible) {
      setCurrentStep(1);
      setCurrentView('front');
      setSelectedMuscleGroup('');
      setSelectedExerciseIds(new Set());
      setAccumulatedExercises([]);
      setShowFavorites(false);
      setShowAllExercises(false);
      searchState.clearSearch();
    }
  }, [visible]);

  const handleMuscleSelect = useCallback(
    (muscle: string) => {
      try {
        Sentry.addBreadcrumb({
          message: 'Muscle Group Selected in Insights Modal',
          category: 'user.interaction',
          level: 'info',
          data: {
            muscleGroup: muscle,
            previousStep: currentStep,
          },
        });

        setSelectedMuscleGroup(muscle);
        setCurrentStep(2);
        setShowFavorites(false);
        setShowAllExercises(false);
        searchState.clearSearch();

        // Haptic feedback
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {
          // Haptics might not be available on all devices
        }
      } catch (error) {
        captureUIError(
          error as Error,
          'InsightsExerciseTrackingModal.handleMuscleSelect',
          'insights-modal',
        );
      }
    },
    [currentStep, searchState],
  );

  const handleExerciseToggle = useCallback(
    (exerciseId: string) => {
      try {
        // Haptic feedback
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {
          // Haptics might not be available on all devices
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
          'InsightsExerciseTrackingModal.handleExerciseToggle',
          'insights-modal',
        );
      }
    },
    [selectedMuscleGroup, currentStep],
  );

  const handleStep2Next = useCallback(async () => {
    const startTime = Date.now();

    try {
      // Track progression to save selected exercises immediately
      Sentry.addBreadcrumb({
        message: 'Saving Selected Exercises from Insights Modal',
        category: 'user.navigation',
        level: 'info',
        data: {
          selectedCount: selectedExerciseIds.size,
          muscleGroup: selectedMuscleGroup,
          showFavorites,
          showAllExercises,
        },
      });

      if (selectedExerciseIds.size === 0) {
        return;
      }

      // Get exercise data for validation
      let exerciseData: Exercise[] = [];

      if (showFavorites) {
        exerciseData = await exerciseService.getFavoriteExercises();
      } else if (showAllExercises) {
        // Load all categories for all exercises view
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
        // Load specific muscle group
        let categoryKey = selectedMuscleGroup;
        if (selectedMuscleGroup === 'Lower back') {
          categoryKey = 'Lower_back';
        }
        exerciseData = await exerciseService.getExercisesByCategory(
          categoryKey as ExerciseCategory,
        );
      }

      // Check if we have multi-group selections by testing the initial filter
      const initialFilteredCount = exerciseData.filter((exercise) =>
        selectedExerciseIds.has(exercise.id),
      ).length;

      // If we have selected exercises but the filtered count is less than selected count,
      // it means we have exercises from multiple muscle groups - load ALL exercises
      if (initialFilteredCount < selectedExerciseIds.size && selectedExerciseIds.size > 0) {
        // Load all categories to find exercises from multiple muscle groups
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

        exerciseData = [];
        for (const category of allCategories) {
          try {
            const categoryExercises = await exerciseService.getExercisesByCategory(category);
            exerciseData = [...exerciseData, ...categoryExercises];
          } catch (error) {
            console.warn(`Failed to load exercises for category ${category}:`, error);
          }
        }
      }

      // Filter to only include selected exercises
      const selectedExerciseObjects = exerciseData.filter((exercise) =>
        selectedExerciseIds.has(exercise.id),
      );

      // Add current selection to accumulated exercises
      setAccumulatedExercises((prev) => {
        const existingIds = new Set(prev.map((ex) => ex.id));
        const newExercises = selectedExerciseObjects.filter(
          (ex) => !existingIds.has(ex.id) && !isExerciseAlreadyAdded(ex.id),
        );
        const updated = [...prev, ...newExercises];

        return updated;
      });

      // Save all accumulated exercises (including current selection) immediately
      const existingIds = new Set(accumulatedExercises.map((ex) => ex.id));
      const newExercises = selectedExerciseObjects.filter(
        (ex) => !existingIds.has(ex.id) && !isExerciseAlreadyAdded(ex.id),
      );
      const allExercisesToSave = [...accumulatedExercises, ...newExercises];

      if (allExercisesToSave.length > 0) {
        await handleSaveAllAccumulated(allExercisesToSave);
      }
    } catch (error) {
      captureAPIError(error as Error, 'insights-exercise-loading', 'InsightsExerciseTrackingModal');
      SentryLogger.error('Failed to process selected exercises', {
        error: error as Error,
        duration: Date.now() - startTime,
      });
    }
  }, [selectedExerciseIds, selectedMuscleGroup, showFavorites, showAllExercises, searchState]);

  const handleSaveAllAccumulated = useCallback(
    async (exercisesToSave: Exercise[] = accumulatedExercises) => {
      if (exercisesToSave.length === 0) {
        return;
      }

      try {
        SentryDataCollection.addBreadcrumb({
          message: 'Saving all accumulated tracked exercises from insights modal',
          category: 'data.save',
          level: 'info',
          data: {
            userId,
            selectedCount: exercisesToSave.length,
            selectedExerciseIds: exercisesToSave.map((ex) => ex.id),
          },
        });

        // Insert all accumulated exercises into user_tracked_exercises table
        const trackingRecords = exercisesToSave.map((exercise) => ({
          user_id: userId,
          exercise_id: exercise.id,
        }));

        const { error } = await supabase.from('user_tracked_exercises').insert(trackingRecords);

        if (error) {
          throw error;
        }

        SentryDataCollection.addBreadcrumb({
          message: 'Successfully saved all accumulated tracked exercises from insights modal',
          category: 'data.save',
          level: 'info',
          data: {
            userId,
            savedCount: exercisesToSave.length,
            exerciseNames: exercisesToSave.map((ex) => ex.name).slice(0, 5),
          },
        });

        onExercisesSelected(exercisesToSave);
        onClose(); // Close modal after successful save
      } catch (error) {
        SentryDataCollection.captureException(error as Error, {
          component: 'InsightsExerciseTrackingModal',
          action: 'save_accumulated_tracked_exercises',
          userId,
          selectedCount: exercisesToSave.length,
        });
        SentryLogger.error('Failed to save all accumulated tracked exercises from insights modal', {
          error: error as Error,
          userId,
          selectedCount: exercisesToSave.length,
        });
      }
    },
    [accumulatedExercises, userId, onExercisesSelected, onClose],
  );

  const handleSaveSelection = async (exercises: Exercise[]) => {
    if (exercises.length === 0) {
      return;
    }

    try {
      SentryDataCollection.addBreadcrumb({
        message: 'Saving tracked exercises selection from insights modal',
        category: 'data.save',
        level: 'info',
        data: {
          userId,
          selectedCount: exercises.length,
          selectedExerciseIds: exercises.map((ex) => ex.id),
          selectedMuscleGroup,
        },
      });

      // Insert selected exercises into user_tracked_exercises table
      const trackingRecords = exercises.map((exercise) => ({
        user_id: userId,
        exercise_id: exercise.id,
      }));

      const { error } = await supabase.from('user_tracked_exercises').insert(trackingRecords);

      if (error) {
        throw error;
      }

      SentryDataCollection.addBreadcrumb({
        message: 'Successfully saved tracked exercises from insights modal',
        category: 'data.save',
        level: 'info',
        data: {
          userId,
          savedCount: exercises.length,
          exerciseNames: exercises.map((ex) => ex.name).slice(0, 5),
        },
      });

      onExercisesSelected(exercises);
      onClose(); // Close modal after successful save
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'InsightsExerciseTrackingModal',
        action: 'save_tracked_exercises',
        userId,
        selectedCount: exercises.length,
      });
      SentryLogger.error('Failed to save tracked exercises from insights modal', {
        error: error as Error,
        userId,
        selectedCount: exercises.length,
      });
    }
  };

  // For insights tracking, we don't need step 3 configuration
  const handleAddAll = useCallback((exercises: SelectedExercise[]) => {
    // Convert SelectedExercise to Exercise and save
    const basicExercises: Exercise[] = exercises.map((ex) => ({
      id: ex.id,
      name: ex.name,
      image_url: ex.image_url || '',
      muscle_group: ex.muscle_group,
      primary_muscles: ex.primary_muscles || [],
      requires_weight: ex.requires_weight || false,
      description: '',
      equipment: '',
      difficulty: 'Beginner',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    handleSaveSelection(basicExercises);
  }, []);

  const handleClose = useCallback(() => {
    try {
      Sentry.addBreadcrumb({
        message: 'Insights Exercise Tracking Modal Close Requested',
        category: 'user.interaction',
        level: 'info',
        data: {
          step: currentStep,
          selectedCount: selectedExerciseIds.size,
        },
      });
      onClose();
    } catch (error) {
      captureUIError(error as Error, 'InsightsExerciseTrackingModal.handleClose', 'insights-modal');
    }
  }, [currentStep, selectedExerciseIds.size, onClose]);

  const handleBackPress = useCallback(() => {
    if (currentStep > 1 && !showFavorites && !showAllExercises) {
      setCurrentStep(1);
      setSelectedMuscleGroup('');
      // Don't reset selectedExerciseIds here - preserve selections when going back
      searchState.clearSearch();
    } else if (showFavorites || showAllExercises) {
      setShowFavorites(false);
      setShowAllExercises(false);
      setCurrentStep(1);
      searchState.clearSearch();
    } else {
      handleClose();
    }
  }, [currentStep, showFavorites, showAllExercises, searchState]);

  const getStepTitle = () => {
    if (showFavorites) return 'Favorite Exercises';
    if (showAllExercises) return 'All Exercises';
    if (currentStep === 1) return 'Select Muscle Group';
    if (currentStep === 2) return selectedMuscleGroup || 'Select Exercises';
    return 'Track Exercises';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {/* Backdrop */}
          <Animated.View style={[styles.backdrop, animatedBackdropStyle]} />

          {/* Modal Content */}
          <Animated.View
            style={[
              {
                width: '100%',
                height: '100%',
                backgroundColor: COLORS.background,
                paddingTop: insets.top,
              },
              animatedModalStyle,
            ]}
          >
            {/* Main Content */}
            <View style={styles.container}>
              {/* Top Glow Effects */}
              <View style={styles.topGlowLeft} />
              <View style={styles.topGlowRight} />
              {/* Header */}
              <View style={[styles.header, { paddingTop: 10 }]}>
                <View style={styles.headerLeft}>
                  <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
                    <Ionicons
                      name={
                        currentStep > 1 || showFavorites || showAllExercises
                          ? 'arrow-back'
                          : 'close'
                      }
                      size={24}
                      color={COLORS.text}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.headerCenter}>
                  <Text style={styles.headerTitle}>{getStepTitle()}</Text>
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
                    buttonText="Add"
                  />
                </Animated.View>
              </View>
            </View>
          </Animated.View>

          {/* Floating Search UI - show on steps 1 and 2 */}
          {(currentStep === 1 || currentStep === 2) && (
            <View
              style={{
                position: 'absolute',
                top: insets.top - 50,
                left: 0,
                right: 0,
                zIndex: 150,
              }}
            >
              <FloatingSearchUI
                searchState={searchState}
                stepTitle={getStepTitle()}
                currentStep={currentStep}
              />
            </View>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
