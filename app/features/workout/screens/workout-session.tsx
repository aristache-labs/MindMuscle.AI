import React, { useEffect } from 'react';
// TODO: Refactoring in progress - complexity has been reduced by moving logic to custom hooks
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../store/AuthContext';
import OptimizedImage from '../../../components/OptimizedImage';
import ExerciseDetailsModal from '../../../components/ExerciseDetailsModal';
import CustomizeExerciseModal from '../../../components/CustomizeExerciseModal';

import { COLORS, SPACING, BORDER_RADIUS } from '../../../constants/theme';
import {
  useWorkoutTimer,
  useExerciseSets,
  useWorkoutData,
  useWorkoutCompletion,
  useWorkoutNavigation,
  useExerciseSelection,
  useWorkoutState,
  useWorkoutExitHandling,
  useWorkoutWarmup,
  useWorkoutInitialization,
  useWorkoutKeyboardHandling,
  useWorkoutRender,
} from '../hooks';
import {
  WorkoutHeader,
  WorkoutTimerTabs,
  WorkoutExerciseCard,
  WorkoutExerciseSetRow,
  WorkoutWarmupModal,
  WorkoutExitModal,
} from '../components';
import { ExerciseSet } from '../types';

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

  // Use the timer hook
  const {
    workoutDuration,
    startWorkoutTimer,
    stopWorkoutTimer,
    startRestTimer,
    clearAllTimers,
    setWorkoutStartTime,
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
    showExerciseListModal: _showExerciseListModal,
    showCustomizeExerciseModal,
    initialSelectedExercise: _initialSelectedExercise,
    handleExerciseNamePress,
    handleExerciseDetailsModalClose,
    handleExerciseListPress,
    handleExerciseListModalClose: _handleExerciseListModalClose,
    handleNextExercisePress,
    handleExerciseSelect,
    handleCustomizeExercisePress,
    handleCustomizeExerciseFromList: _handleCustomizeExerciseFromList,
    handleCustomizeExerciseModalClose,
    handleCustomizeExerciseSave,
    handleExerciseChange,
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

  // Use the workout warmup hook
  const { showWarmup, warmupCompleted, handleWarmupComplete, skipWarmup } = useWorkoutWarmup({
    onWarmupCompleted: () => {
      // The first set will automatically become active due to the logic in the render method
    },
  });

  // Use the workout completion hook
  const { completeWorkout } = useWorkoutCompletion({
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

  // Use the workout navigation hook
  const { currentExerciseIndex: _navCurrentExerciseIndex, moveToNextExercise } =
    useWorkoutNavigation({
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
