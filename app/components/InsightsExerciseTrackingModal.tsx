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
import exerciseService, { Exercise } from '../services/exerciseService';
import { captureUIError, SentryReactProfiler } from '../services/sentry';
import * as Sentry from '@sentry/react-native';
import supabase from '../services/supabase';
import { SentryDataCollection, SentryLogger } from '../services/sentry';
import { FloatingSearchUI } from './AddExerciseModal/components/FloatingSearchUI';
import { Step1MuscleSelection } from './AddExerciseModal/components/Step1MuscleSelection';
import { Step2ExerciseSelection } from './AddExerciseModal/components/Step2ExerciseSelection';
import { StepAllExercises } from './AddExerciseModal/components/StepAllExercises';
import { StepFavorites } from './AddExerciseModal/components/StepFavorites';
import { useFavoriteLogic, useSearchState } from './AddExerciseModal/hooks';
import { styles as addExerciseModalStyles } from './AddExerciseModal/styles';

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
        setSelectedExerciseIds(new Set());
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

  const handleExerciseToggle = useCallback((exerciseId: string) => {
    try {
      setSelectedExerciseIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(exerciseId)) {
          newSet.delete(exerciseId);
        } else {
          newSet.add(exerciseId);
        }

        Sentry.addBreadcrumb({
          message: 'Exercise Selection Toggled in Insights Modal',
          category: 'user.interaction',
          level: 'info',
          data: {
            exerciseId,
            action: newSet.has(exerciseId) ? 'selected' : 'deselected',
            totalSelected: newSet.size,
          },
        });

        return newSet;
      });

      // Haptic feedback
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // Haptics might not be available on all devices
      }
    } catch (error) {
      captureUIError(
        error as Error,
        'InsightsExerciseTrackingModal.handleExerciseToggle',
        'insights-modal',
      );
    }
  }, []);

  const handleSaveSelection = async () => {
    if (selectedExerciseIds.size === 0) {
      return;
    }

    try {
      SentryDataCollection.addBreadcrumb({
        message: 'Saving tracked exercises selection from insights modal',
        category: 'data.save',
        level: 'info',
        data: {
          userId,
          selectedCount: selectedExerciseIds.size,
          selectedExerciseIds: Array.from(selectedExerciseIds),
          selectedMuscleGroup,
        },
      });

      // Insert selected exercises into user_tracked_exercises table
      const trackingRecords = Array.from(selectedExerciseIds).map((exerciseId) => ({
        user_id: userId,
        exercise_id: exerciseId,
      }));

      const { error } = await supabase.from('user_tracked_exercises').insert(trackingRecords);

      if (error) {
        throw error;
      }

      // Get the full exercise objects for the selected exercises
      const allExercises = await exerciseService.getAllExercises();
      const selectedExercises = allExercises.filter((exercise) =>
        selectedExerciseIds.has(exercise.id),
      );

      SentryDataCollection.addBreadcrumb({
        message: 'Successfully saved tracked exercises from insights modal',
        category: 'data.save',
        level: 'info',
        data: {
          userId,
          savedCount: selectedExercises.length,
          exerciseNames: selectedExercises.map((ex) => ex.name).slice(0, 5),
        },
      });

      onExercisesSelected(selectedExercises);
      onClose();
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'InsightsExerciseTrackingModal',
        action: 'save_tracked_exercises',
        userId,
        selectedCount: selectedExerciseIds.size,
      });
      SentryLogger.error('Failed to save tracked exercises from insights modal', {
        error: error as Error,
        userId,
        selectedCount: selectedExerciseIds.size,
      });
    }
  };

  const handleStep2Next = useCallback(() => {
    // For insights tracking, we skip configuration and save directly
    handleSaveSelection();
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

  const getStepTitle = () => {
    if (showFavorites) return 'Favorite Exercises';
    if (showAllExercises) return 'All Exercises';
    if (currentStep === 1) return 'Select Muscle Group';
    if (currentStep === 2) return selectedMuscleGroup || 'Select Exercises';
    return 'Track Exercises';
  };

  const renderStepContent = () => {
    if (showFavorites) {
      return (
        <StepFavorites
          selectedExercises={selectedExerciseIds}
          onExerciseToggle={handleExerciseToggle}
          onNext={handleStep2Next}
          selectedMuscleGroup={selectedMuscleGroup}
          searchState={searchState}
          isExerciseAlreadyAdded={isExerciseAlreadyAdded}
        />
      );
    }

    if (showAllExercises) {
      return (
        <StepAllExercises
          selectedExercises={selectedExerciseIds}
          onExerciseToggle={handleExerciseToggle}
          onNext={handleStep2Next}
          searchState={searchState}
          isExerciseAlreadyAdded={isExerciseAlreadyAdded}
        />
      );
    }

    switch (currentStep) {
      case 1:
        return (
          <Step1MuscleSelection
            currentView={currentView}
            setCurrentView={setCurrentView}
            onMuscleSelect={handleMuscleSelect}
            pulseAnim={pulseAnim}
            searchState={searchState}
          />
        );
      case 2:
        return (
          <Step2ExerciseSelection
            selectedMuscleGroup={selectedMuscleGroup}
            selectedExercises={selectedExerciseIds}
            onExerciseToggle={handleExerciseToggle}
            onNext={handleStep2Next}
            searchState={searchState}
            isExerciseAlreadyAdded={isExerciseAlreadyAdded}
          />
        );
      default:
        return null;
    }
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
        <View style={addExerciseModalStyles.modalContainer}>
          {/* Backdrop */}
          <Animated.View style={[addExerciseModalStyles.backdrop, animatedBackdropStyle]} />

          {/* Modal Content */}
          <Animated.View
            style={[
              addExerciseModalStyles.modalContainer,
              animatedModalStyle,
              { paddingTop: insets.top + 20 },
            ]}
          >
            {/* Header */}
            <View style={addExerciseModalStyles.header}>
              <TouchableOpacity
                onPress={() => {
                  if (currentStep > 1 && !showFavorites && !showAllExercises) {
                    setCurrentStep(1);
                    setSelectedMuscleGroup('');
                    setSelectedExerciseIds(new Set());
                    searchState.clearSearch();
                  } else if (showFavorites || showAllExercises) {
                    setShowFavorites(false);
                    setShowAllExercises(false);
                    setCurrentStep(1);
                    searchState.clearSearch();
                  } else {
                    handleClose();
                  }
                }}
                style={addExerciseModalStyles.headerButton}
              >
                <Ionicons
                  name={
                    currentStep > 1 || showFavorites || showAllExercises ? 'arrow-back' : 'close'
                  }
                  size={24}
                  color={COLORS.text}
                />
              </TouchableOpacity>

              <View style={addExerciseModalStyles.headerCenter}>
                <Text style={addExerciseModalStyles.headerTitle}>{getStepTitle()}</Text>
                <Text style={{ color: COLORS.secondary, fontSize: 12, textAlign: 'center' }}>
                  Select exercises to track their progress
                </Text>
              </View>

              <View style={addExerciseModalStyles.headerRight}>
                {currentStep === 1 && (
                  <TouchableOpacity
                    onPress={favoriteLogic.handleFavoritePress}
                    style={addExerciseModalStyles.headerButton}
                  >
                    <Ionicons name="heart" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Floating Search */}
            <FloatingSearchUI
              searchState={searchState}
              stepTitle={getStepTitle()}
              currentStep={currentStep}
            />

            {/* Step Content */}
            <View style={addExerciseModalStyles.content}>{renderStepContent()}</View>

            {/* Save Button (only show when exercises are selected) */}
            {selectedExerciseIds.size > 0 && (
              <View style={addExerciseModalStyles.stepActions}>
                <TouchableOpacity
                  style={addExerciseModalStyles.nextButton}
                  onPress={handleSaveSelection}
                >
                  <Text style={addExerciseModalStyles.nextButtonText}>
                    Add {selectedExerciseIds.size} Exercise
                    {selectedExerciseIds.size !== 1 ? 's' : ''} to Tracking
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
