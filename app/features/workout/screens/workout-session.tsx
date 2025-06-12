import React, { useCallback, useEffect } from 'react';
// TODO: Refactoring in progress - complexity has been reduced by moving logic to custom hooks
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AddExerciseModal from '../../../components/AddExerciseModal';
import CustomizeExerciseModal from '../../../components/CustomizeExerciseModal';
import ExerciseDetailsModal from '../../../components/ExerciseDetailsModal';
import ExerciseListModal from '../../../components/ExerciseListModal';
import OptimizedImage from '../../../components/OptimizedImage';
import { SentryDataCollection, SentryLogger } from '../../../services/sentry';
import { useAuth } from '../../../store/AuthContext';

import { BORDER_RADIUS, COLORS, SPACING } from '../../../constants/theme';
import {
  WorkoutExerciseCard,
  WorkoutExerciseSetRow,
  WorkoutExitModal,
  WorkoutHeader,
  WorkoutTimerTabs,
  WorkoutWarmupModal,
} from '../components';
import {
  useExerciseSelection,
  useExerciseSets,
  useWorkoutCompletion,
  useWorkoutData,
  useWorkoutExitHandling,
  useWorkoutInitialization,
  useWorkoutKeyboardHandling,
  useWorkoutNavigation,
  useWorkoutRender,
  useWorkoutState,
  useWorkoutTimer,
} from '../hooks';
import { ExerciseData, ExerciseSet } from '../types';

export default function WorkoutSessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Extract params early so they can be used in callbacks
  const planId = params.planId as string;
  const workoutDay = parseInt(params.workoutDay as string);
  const cycleWeek = parseInt(params.cycleWeek as string) || 1;
  const weekName = (params.weekName as string) || 'Adaptation';

  // Get forceStart and forceResume parameters from URL
  const forceStart = params.forceStart === 'true';
  const forceResume = params.forceResume === 'true';

  // Sentry initialization for workout session
  useEffect(() => {
    try {
      // Log workout session access
      SentryLogger.info('Workout session screen accessed', {
        user_id: user?.id,
        plan_id: planId,
        workout_day: workoutDay,
        cycle_week: cycleWeek,
        week_name: weekName,
        force_start: forceStart,
        force_resume: forceResume,
        timestamp: new Date().toISOString(),
      });

      // Add breadcrumb for screen navigation
      SentryDataCollection.addBreadcrumb({
        message: 'User navigated to workout session screen',
        category: 'navigation',
        level: 'info',
        data: {
          screen: 'workout-session',
          plan_id: planId,
          workout_day: workoutDay,
          cycle_week: cycleWeek,
          week_name: weekName,
          user_authenticated: !!user,
        },
      });

      // Set user context for this session
      if (user) {
        SentryDataCollection.setUser({
          id: user.id,
          email: user.email,
        });
      }

      // Set context for workout session analytics
      SentryDataCollection.setContext('workout_session', {
        plan_id: planId,
        workout_day: workoutDay,
        cycle_week: cycleWeek,
        week_name: weekName,
        force_start: forceStart,
        force_resume: forceResume,
        session_type: forceResume ? 'resume' : forceStart ? 'forced_start' : 'normal_start',
      });

      // Set workout-related tags
      SentryDataCollection.setTag('active_workout_plan', planId);
      SentryDataCollection.setTag('workout_day', workoutDay.toString());
      SentryDataCollection.setTag('cycle_week', cycleWeek.toString());
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'workout_session_initialization',
        user_id: user?.id,
        plan_id: planId,
        workout_day: workoutDay,
      });
    }
  }, [user, planId, workoutDay, cycleWeek, weekName, forceStart, forceResume]);

  // Use the timer hook
  const {
    workoutDuration,
    startWorkoutTimer,
    stopWorkoutTimer,
    startRestTimer,
    clearAllTimers,
    setWorkoutStartTime,
    setWorkoutDuration,
    formatTime,
  } = useWorkoutTimer();

  // Use the keyboard handling hook (enhanced with workout-specific behavior)
  const { keyboardHeight, scrollViewRef, handleInputFocus, handleInputBlur } =
    useWorkoutKeyboardHandling();

  // Use the workout state hook for loading, exercise data, and completion state
  const {
    isLoading,
    exercises: workoutExercises,
    setExercises: setWorkoutExercises,
    exerciseSets: workoutExerciseSets,
    setExerciseSets: setWorkoutExerciseSets,
    currentExerciseIndex,
    setCurrentExerciseIndex,
    totalVolume,
    setTotalVolume,
    totalReps,
    setTotalReps,
    recommendations: workoutRecommendations,
    isWorkoutCompleted,
    setIsWorkoutCompleted,
    completedWorkoutData,
    setCompletedWorkoutData,
    originalCycleWeek,
    isResumingPausedWorkout,
    setIsResumingPausedWorkout,
    focusedInputs,
    setFocusedInputs,
    userEnteredValues,
    setUserEnteredValues,
    exerciseCustomized,
    setExerciseCustomized,
    textInputRefreshKey,
    setTextInputRefreshKey,
    // Warmup state
    showWarmup,
    setShowWarmup,
    warmupCompleted,
    setWarmupCompleted,
    // Function references
    fetchWorkoutData,
    checkWorkoutCompletionOnly,
    resumePausedWorkout,
    checkWorkoutCompletion,
  } = useWorkoutState({
    user,
    planId,
    workoutDay,
    cycleWeek,
    weekName,
    forceStart,
    forceResume,
    onWorkoutStarted: () => {
      // Optional callback when workout is started
    },
    setWorkoutStartTime,
    startWorkoutTimer,
    clearAllTimers,
    setWorkoutDuration,
  });

  // Use the workout data hook
  const {
    maxWeightData,
    absoluteMaxWeightData,
    lastExerciseValues,
    setLastExerciseValues,
    fetchLastExerciseRecords,
    fetchMaxWeightDataForAllExercises,
    fetchCycleWeekInfo,
    preFillWithSuggestedValues,
  } = useWorkoutData({
    user,
    exercises: workoutExercises,
    cycleWeek,
  });

  // Use the exercise sets hook
  const {
    handleSetComplete,
    handleRedoSet,
    handleLogAllSets,
    handleWeightChange,
    handleRepsChange,
    getSuggestedValue,
  } = useExerciseSets({
    exercises: workoutExercises,
    currentExerciseIndex,
    recommendations: workoutRecommendations,
    lastExerciseValues,
    totalVolume,
    totalReps,
    setTotalVolume,
    setTotalReps,
    exerciseSets: workoutExerciseSets,
    setExerciseSets: setWorkoutExerciseSets,
    userEnteredValues,
    setUserEnteredValues,
    exerciseCustomized,
    setExerciseCustomized,
    textInputRefreshKey,
    setTextInputRefreshKey,
    onStartRestTimer: startRestTimer,
    onCompleteWorkoutWithStateSync: (volume: number, reps: number) => {
      setTotalVolume(volume);
      setTotalReps(reps);
      completeWorkout();
    },
    onMoveToNextExercise: () => {
      moveToNextExercise();
    },
  });

  // Use the exercise selection hook
  const {
    showExerciseDetailsModal,
    showExerciseListModal,
    showCustomizeExerciseModal,
    showAddExerciseModal,
    isCustomizeMode,
    handleExerciseNamePress,
    handleExerciseDetailsModalClose,
    handleExerciseListPress,
    handleExerciseListModalClose,
    handleNextExercisePress,
    handleExerciseSelect,
    handleCustomizeExercisePress,
    handleCustomizeExerciseModalClose,
    handleToggleCustomizeMode,
    handleAddExerciseModalClose,
    handleAddExercises,
    handleCustomizeExerciseSave,
    handleExerciseChange,
    handleAddExercise,
    handleAddSuperset,
    handleAddCardio,
  } = useExerciseSelection({
    exercises: workoutExercises,
    setExercises: setWorkoutExercises,
    currentExerciseIndex,
    setCurrentExerciseIndex,
    exerciseSets: workoutExerciseSets,
    setExerciseSets: setWorkoutExerciseSets,
    lastExerciseValues,
    setLastExerciseValues,
    exerciseCustomized,
    setExerciseCustomized,
    userEnteredValues,
    setUserEnteredValues,
    focusedInputs,
    setFocusedInputs,
    textInputRefreshKey,
    setTextInputRefreshKey,
    userId: user?.id,
  });

  // Handle exercise reordering
  const handleReorderExercises = useCallback(
    (newOrder: ExerciseData[]) => {
      setWorkoutExercises(newOrder);

      // Update exercise sets to match the new order
      const newExerciseSets: Record<string, ExerciseSet[]> = {};
      newOrder.forEach((exercise) => {
        if (workoutExerciseSets[exercise.id]) {
          newExerciseSets[exercise.id] = workoutExerciseSets[exercise.id];
        }
      });
      setWorkoutExerciseSets(newExerciseSets);

      // Update other related state if needed
      const newExerciseCustomized: Record<string, boolean> = {};
      const newUserEnteredValues: Record<string, boolean> = {};
      const newLastExerciseValues: Record<
        string,
        Record<number, { weight: string; reps: string }>
      > = {};

      newOrder.forEach((exercise) => {
        if (exerciseCustomized[exercise.id]) {
          newExerciseCustomized[exercise.id] = exerciseCustomized[exercise.id];
        }
        if (userEnteredValues[exercise.id]) {
          newUserEnteredValues[exercise.id] = userEnteredValues[exercise.id];
        }
        if (lastExerciseValues[exercise.id]) {
          newLastExerciseValues[exercise.id] = lastExerciseValues[exercise.id];
        }
      });

      setExerciseCustomized(newExerciseCustomized);
      setUserEnteredValues(newUserEnteredValues);
      setLastExerciseValues(newLastExerciseValues);
    },
    [
      setWorkoutExercises,
      workoutExerciseSets,
      setWorkoutExerciseSets,
      exerciseCustomized,
      setExerciseCustomized,
      userEnteredValues,
      setUserEnteredValues,
      lastExerciseValues,
      setLastExerciseValues,
    ],
  );

  // Handle exercise removal
  const handleRemoveExercise = useCallback(
    (index: number) => {
      if (workoutExercises.length <= 1) {
        // Don't allow removing the last exercise
        return;
      }

      const exerciseToRemove = workoutExercises[index];

      // Remove the exercise from the exercises array
      const newExercises = workoutExercises.filter((_, i) => i !== index);
      setWorkoutExercises(newExercises);

      // Remove associated exercise sets
      const newExerciseSets = { ...workoutExerciseSets };
      delete newExerciseSets[exerciseToRemove.id];
      setWorkoutExerciseSets(newExerciseSets);

      // Remove associated state
      const newExerciseCustomized = { ...exerciseCustomized };
      delete newExerciseCustomized[exerciseToRemove.id];
      setExerciseCustomized(newExerciseCustomized);

      const newUserEnteredValues = { ...userEnteredValues };
      Object.keys(newUserEnteredValues).forEach((key) => {
        if (key.startsWith(exerciseToRemove.id)) {
          delete newUserEnteredValues[key];
        }
      });
      setUserEnteredValues(newUserEnteredValues);

      const newLastExerciseValues = { ...lastExerciseValues };
      delete newLastExerciseValues[exerciseToRemove.exercise_id];
      setLastExerciseValues(newLastExerciseValues);

      // Adjust current exercise index if necessary
      if (index <= currentExerciseIndex && currentExerciseIndex > 0) {
        setCurrentExerciseIndex(currentExerciseIndex - 1);
      } else if (currentExerciseIndex >= newExercises.length) {
        setCurrentExerciseIndex(newExercises.length - 1);
      }
    },
    [
      workoutExercises,
      workoutExerciseSets,
      exerciseCustomized,
      userEnteredValues,
      lastExerciseValues,
      currentExerciseIndex,
      setWorkoutExercises,
      setWorkoutExerciseSets,
      setExerciseCustomized,
      setUserEnteredValues,
      setLastExerciseValues,
      setCurrentExerciseIndex,
    ],
  );

  // Handle applying changes from the exercise list modal
  const handleApplyChanges = useCallback(
    (newExercises: ExerciseData[], removedIndices: number[]) => {
      try {
        // Store the original state for comparison
        const originalExercises = [...workoutExercises];

        // First, handle reordering if exercises have changed
        if (JSON.stringify(newExercises) !== JSON.stringify(originalExercises)) {
          handleReorderExercises(newExercises);
        }

        // Then handle removals in reverse order to maintain correct indices
        if (removedIndices.length > 0) {
          const sortedIndices = [...removedIndices].sort((a, b) => b - a);
          sortedIndices.forEach((index) => {
            if (index >= 0 && index < originalExercises.length) {
              handleRemoveExercise(index);
            }
          });
        }
      } catch (error) {
        console.error('Error applying exercise changes:', error);
      }
    },
    [workoutExercises, handleReorderExercises, handleRemoveExercise],
  );

  // Handle exercise details press from exercise list modal
  const handleExerciseDetailsPress = useCallback(() => {
    // Close the exercise list modal first
    handleExerciseListModalClose();

    // Set the exercise for the details modal
    // Since we're reusing the existing exercise details modal, we'll trigger it to show
    // But first we need to make sure the current exercise data is set correctly

    // For now, just trigger the details modal for the current exercise
    // This is a temporary solution - ideally we'd want to show details for the selected exercise
    handleExerciseNamePress();
  }, [handleExerciseListModalClose, handleExerciseNamePress]);

  // Warmup handlers
  const handleWarmupComplete = useCallback(() => {
    setWarmupCompleted(true);
    setShowWarmup(false);
    // The first set will automatically become active due to the logic in the render method
  }, [setWarmupCompleted, setShowWarmup]);

  const skipWarmup = useCallback(() => {
    handleWarmupComplete();
  }, [handleWarmupComplete]);

  // Use the workout completion hook
  const { completeWorkout: originalCompleteWorkout } = useWorkoutCompletion({
    user,
    planId,
    workoutDay,
    cycleWeek,
    weekName,
    exercises: workoutExercises,
    exerciseSets: workoutExerciseSets,
    workoutDuration,
    totalVolume,
    totalReps,
    originalCycleWeek,
    setIsWorkoutCompleted,
    setCompletedWorkoutData,
    stopWorkoutTimer,
    formatTime,
    fetchLastExerciseRecords,
    navigate: router.replace,
  });

  // Wrap completeWorkout with Sentry tracking
  const completeWorkout = useCallback(async () => {
    try {
      // Log workout completion attempt
      SentryLogger.info('User completing workout session', {
        user_id: user?.id,
        plan_id: planId,
        workout_day: workoutDay,
        cycle_week: cycleWeek,
        week_name: weekName,
        total_exercises: workoutExercises.length,
        workout_duration: workoutDuration,
        total_volume: totalVolume,
        total_reps: totalReps,
        is_resuming_paused: isResumingPausedWorkout,
        timestamp: new Date().toISOString(),
      });

      // Add breadcrumb for workout completion
      SentryDataCollection.addBreadcrumb({
        message: 'User completing workout session',
        category: 'user-action',
        level: 'info',
        data: {
          plan_id: planId,
          workout_day: workoutDay,
          cycle_week: cycleWeek,
          total_exercises: workoutExercises.length,
          workout_duration: workoutDuration,
          action_type: 'complete_workout',
        },
      });

      // Set workout completion tags
      SentryDataCollection.setTag('workout_completed', 'true');
      SentryDataCollection.setTag('workout_completion_method', 'manual');

      await originalCompleteWorkout();

      // Log successful workout completion
      SentryLogger.info('Workout session completed successfully', {
        user_id: user?.id,
        plan_id: planId,
        workout_day: workoutDay,
        cycle_week: cycleWeek,
        completion_status: 'success',
      });
    } catch (error) {
      // Log workout completion error
      SentryDataCollection.captureException(error as Error, {
        context: 'workout_completion',
        user_id: user?.id,
        plan_id: planId,
        workout_day: workoutDay,
        cycle_week: cycleWeek,
        total_exercises: workoutExercises.length,
        workout_duration: workoutDuration,
      });

      SentryLogger.error('Workout completion failed', {
        error: error,
        user_id: user?.id,
        plan_id: planId,
        workout_day: workoutDay,
      });

      throw error;
    }
  }, [
    originalCompleteWorkout,
    user,
    planId,
    workoutDay,
    cycleWeek,
    weekName,
    workoutExercises.length,
    workoutDuration,
    totalVolume,
    totalReps,
    isResumingPausedWorkout,
  ]);

  // Use the workout navigation hook
  const { moveToNextExercise } = useWorkoutNavigation({
    exercises: workoutExercises,
    exerciseSets: workoutExerciseSets,
    currentExerciseIndex,
    setCurrentExerciseIndex,
    onCompleteWorkout: () => completeWorkout(),
  });

  // Use the workout exit handling hook
  const {
    showExitModal,
    handleBackPress,
    handleExitWorkout,
    handlePauseWorkout,
    handleReturnToWorkout,
  } = useWorkoutExitHandling({
    user,
    planId,
    workoutDay,
    cycleWeek,
    weekName,
    exercises: workoutExercises,
    exerciseSets: workoutExerciseSets,
    workoutDuration,
    totalVolume,
    totalReps,
    currentExerciseIndex,
    originalCycleWeek,
    stopWorkoutTimer,
  });

  // Use the workout initialization hook to handle all setup effects
  useWorkoutInitialization({
    user,
    planId,
    workoutDay,
    cycleWeek,
    forceStart,
    forceResume,
    isLoading,
    isResumingPausedWorkout,
    setIsResumingPausedWorkout,
    setIsWorkoutCompleted,
    fetchWorkoutData,
    checkWorkoutCompletionOnly,
    checkWorkoutCompletion,
    resumePausedWorkout,
    setWorkoutStartTime,
    startWorkoutTimer,
    clearAllTimers,
    fetchLastExerciseRecords,
    fetchMaxWeightDataForAllExercises,
    fetchCycleWeekInfo,
    workoutExercises,
  });

  // Get the current exercise based on the current index
  const currentExercise = workoutExercises[currentExerciseIndex];

  // Debug log to track currentExerciseIndex changes
  useEffect(() => {
    console.log('WORKOUT SESSION: currentExerciseIndex changed to:', currentExerciseIndex);
    if (currentExercise) {
      console.log('WORKOUT SESSION: Current exercise is:', currentExercise.name);
    }
  }, [currentExerciseIndex, currentExercise?.name]);

  // Use the workout render hook for render-related calculations
  const {
    currentSets,
    calculateActiveSetIndex,
    shouldShowCompleteWorkout,
    getNextExerciseContent,
    progressPercentage,
  } = useWorkoutRender({
    workoutExercises,
    currentExerciseIndex,
    workoutExerciseSets,
    currentExercise,
    showWarmup,
    warmupCompleted,
  });

  // Current recommendation for the current exercise
  const currentRecommendation = currentExercise ? workoutRecommendations[currentExercise.id] : null;

  // Effect to update max weight data when sets are completed (for immediate graph updates)
  useEffect(() => {
    if (workoutExercises.length > 0 && user && !isLoading) {
      // Check if any sets have been completed by looking at the workoutExerciseSets state
      const hasCompletedSets = Object.values(workoutExerciseSets).some((sets) =>
        sets.some((set) => set.isCompleted),
      );

      if (hasCompletedSets) {
        // Debounce the update to avoid too many API calls
        const timeoutId = setTimeout(() => {
          fetchMaxWeightDataForAllExercises();
        }, 1000);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [
    workoutExerciseSets,
    workoutExercises.length,
    user?.id,
    isLoading,
    fetchMaxWeightDataForAllExercises,
  ]);

  // Effect to pre-fill sets with recommended values when they become available
  useEffect(() => {
    if (Object.keys(workoutRecommendations).length > 0 && !isResumingPausedWorkout) {
      preFillWithSuggestedValues(
        workoutRecommendations,
        workoutExerciseSets,
        setWorkoutExerciseSets,
        exerciseCustomized,
        isResumingPausedWorkout,
      );
    }
  }, [
    workoutRecommendations,
    lastExerciseValues,
    workoutExercises.length,
    isResumingPausedWorkout,
    preFillWithSuggestedValues,
    workoutExerciseSets,
    setWorkoutExerciseSets,
    exerciseCustomized,
  ]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading workout...</Text>
      </View>
    );
  }

  // If workout is completed, navigate back to the plan screen
  if (isWorkoutCompleted && completedWorkoutData) {
    // Use setTimeout to ensure the navigation happens after state updates
    setTimeout(() => {
      // Navigate back to home screen
      router.replace('/');
    }, 100);

    // Show a loading indicator while navigating
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Workout completed! Returning to plan...</Text>
      </View>
    );
  }

  // Render next exercise preview
  const renderNextExercise = () => {
    const nextExerciseContent = getNextExerciseContent();

    if (shouldShowCompleteWorkout) {
      return (
        <TouchableOpacity
          style={[styles.nextExerciseCard, styles.completeWorkoutCard]}
          onPress={() => completeWorkout()}
        >
          <Text style={styles.completeWorkoutText}>Complete Workout</Text>
          <Ionicons name="checkmark-circle" size={24} color={COLORS.text} />
        </TouchableOpacity>
      );
    }

    if (!nextExerciseContent) return null;

    return (
      <TouchableOpacity style={styles.nextExerciseCard} onPress={handleNextExercisePress}>
        <View style={styles.nextExerciseImageContainer}>
          {nextExerciseContent.imageUrl ? (
            <OptimizedImage
              source={{ uri: nextExerciseContent.imageUrl }}
              style={styles.nextExerciseImage}
              fallback={require('../../../../assets/exercises/placeholder.jpg')}
              resizeMode="cover"
              cachePolicy="immutable"
              showLoader={false}
              priority="normal"
              debugLabel={`NextExercise-${nextExerciseContent.name}`}
            />
          ) : (
            <View style={styles.nextExercisePlaceholder}>
              <Ionicons name="barbell-outline" size={24} color={COLORS.text} />
            </View>
          )}
        </View>

        <View style={styles.nextExerciseInfo}>
          <Text style={styles.nextExerciseName}>{nextExerciseContent.name}</Text>
          <Text style={styles.nextExerciseDetails}>
            {nextExerciseContent.sets} sets x {nextExerciseContent.reps} reps
            {nextExerciseContent.requiresWeight &&
              nextExerciseContent.exerciseId &&
              lastExerciseValues[nextExerciseContent.exerciseId]?.[1]?.weight &&
              ` x ${lastExerciseValues[nextExerciseContent.exerciseId][1].weight} kg`}
          </Text>
        </View>

        {/* Display primary muscle as text tag */}
        {nextExerciseContent.primaryMuscle && (
          <View style={styles.nextExerciseMuscleTag}>
            <Text style={styles.nextExerciseMuscleText}>{nextExerciseContent.primaryMuscle}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <WorkoutHeader
        insets={insets}
        currentExerciseIndex={currentExerciseIndex}
        totalExercises={workoutExercises.length}
        cycleWeek={cycleWeek}
        weekName={weekName}
        onBackPress={handleBackPress}
        onExerciseListPress={handleExerciseListPress}
      />

      <WorkoutTimerTabs
        workoutDuration={workoutDuration}
        totalVolume={totalVolume}
        totalReps={totalReps}
        formatTime={formatTime}
      />

      {/* Main Content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollViewContent,
            { paddingBottom: keyboardHeight > 0 ? 50 : 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <WorkoutExerciseCard
            exercise={currentExercise}
            maxWeightData={maxWeightData[currentExercise?.exercise_id] || []}
            absoluteMaxWeight={absoluteMaxWeightData[currentExercise?.exercise_id] || null}
            onExerciseNamePress={handleExerciseNamePress}
          />

          {/* Exercise Sets */}
          <View style={styles.setsContainer}>
            {currentSets.map((set: ExerciseSet, index: number) => {
              const activeSetIndex = calculateActiveSetIndex(currentSets);
              const isActive = index === activeSetIndex;
              const isCompleted = set.isCompleted;

              return (
                <WorkoutExerciseSetRow
                  key={set.id}
                  set={set}
                  setIndex={index}
                  exercise={currentExercise}
                  isActive={isActive}
                  isCompleted={isCompleted}
                  focusedInputs={focusedInputs}
                  userEnteredValues={userEnteredValues}
                  exerciseCustomized={exerciseCustomized}
                  lastExerciseValues={lastExerciseValues}
                  currentRecommendation={currentRecommendation}
                  textInputRefreshKey={textInputRefreshKey}
                  onWeightChange={handleWeightChange}
                  onRepsChange={handleRepsChange}
                  onSetComplete={handleSetComplete}
                  onRedoSet={handleRedoSet}
                  onInputFocus={handleInputFocus}
                  onInputBlur={handleInputBlur}
                  getSuggestedValue={getSuggestedValue}
                />
              );
            })}
          </View>

          {/* Log All Sets Button */}
          <Button
            mode="contained"
            style={styles.logAllButton}
            labelStyle={styles.logAllButtonText}
            onPress={() => handleLogAllSets(currentExercise.id)}
          >
            Log All Sets
          </Button>

          {/* Customize Exercise Link */}
          <TouchableOpacity style={styles.customizeLink} onPress={handleCustomizeExercisePress}>
            <Text style={styles.customizeLinkText}>Customize Exercise</Text>
          </TouchableOpacity>

          {/* Next Exercise Preview - moved inside ScrollView */}
          <View style={styles.nextExerciseSection}>
            <Text style={styles.nextExerciseLabel}>Next Exercise</Text>

            {renderNextExercise()}

            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Warmup Modal */}
      <WorkoutWarmupModal
        visible={showWarmup && !warmupCompleted}
        exerciseName={currentExercise?.name}
        onComplete={handleWarmupComplete}
        onSkip={skipWarmup}
      />

      {/* Exit Workout Modal */}
      <WorkoutExitModal
        visible={showExitModal}
        onEndWorkout={handleExitWorkout}
        onPauseWorkout={handlePauseWorkout}
        onReturnToWorkout={handleReturnToWorkout}
        onClose={() => handleReturnToWorkout()}
      />

      {/* Exercise Details Modal */}
      {currentExercise && (
        <ExerciseDetailsModal
          visible={showExerciseDetailsModal}
          onClose={handleExerciseDetailsModalClose}
          exerciseId={currentExercise.exercise_id}
          exerciseName={currentExercise.name}
          exerciseImage={currentExercise.image_url}
          primary_muscles={currentExercise.primary_muscles}
          secondary_muscles={[]} // Add secondary muscles if available in your data
        />
      )}

      {/* Customize Exercise Modal */}
      <CustomizeExerciseModal
        visible={showCustomizeExerciseModal}
        onClose={handleCustomizeExerciseModalClose}
        exercise={workoutExercises[currentExerciseIndex]}
        onSave={handleCustomizeExerciseSave}
        availableExercises={workoutExercises}
        onExerciseChange={handleExerciseChange}
      />

      {/* Exercise List Modal */}
      <ExerciseListModal
        visible={showExerciseListModal}
        onClose={handleExerciseListModalClose}
        exercises={workoutExercises}
        currentExerciseIndex={currentExerciseIndex}
        onExerciseSelect={handleExerciseSelect}
        onExerciseDetailsPress={handleExerciseDetailsPress}
        onReorderExercises={handleReorderExercises}
        onRemoveExercise={handleRemoveExercise}
        isCustomizeMode={isCustomizeMode}
        onToggleCustomizeMode={handleToggleCustomizeMode}
        onAddExercise={handleAddExercise}
        onAddSuperset={handleAddSuperset}
        onAddCardio={handleAddCardio}
        onApplyChanges={handleApplyChanges}
      />

      {/* Add Exercise Modal */}
      <AddExerciseModal
        visible={showAddExerciseModal}
        onClose={handleAddExerciseModalClose}
        onAddExercises={handleAddExercises}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingText: {
    color: COLORS.text,
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 24,
  },
  setsContainer: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.xs,
  },
  nextExerciseSection: {
    backgroundColor: COLORS.background,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  nextExerciseLabel: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  nextExerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.xs,
    justifyContent: 'space-between',
  },
  nextExerciseImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: SPACING.md,
  },
  nextExerciseImage: {
    width: '100%',
    height: '100%',
  },
  nextExercisePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextExerciseInfo: {
    flex: 1,
  },
  nextExerciseName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  nextExerciseDetails: {
    color: COLORS.text,
    fontSize: 14,
    opacity: 0.8,
  },
  nextExerciseMuscleTag: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
    alignSelf: 'center',
  },
  nextExerciseMuscleText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
  completeWorkoutCard: {
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  completeWorkoutText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: SPACING.md,
  },
  progressBarContainer: {
    marginTop: 0,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  logAllButton: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
  },
  logAllButtonText: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  customizeLink: {
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  customizeLinkText: {
    color: COLORS.primary,
    fontSize: 14,
  },
});
