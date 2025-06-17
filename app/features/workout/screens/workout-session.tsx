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
import { useAuth, UserProfile } from '../../../store/AuthContext';

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
  useWorkoutWarmup,
} from '../hooks';
import { ExerciseData, ExerciseSet } from '../types';

// Helper function to initialize Sentry for workout session
function initializeSentryForWorkout(params: {
  user: UserProfile | null;
  planId: string;
  workoutDay: number;
  cycleWeek: number;
  weekName: string;
  forceStart: boolean;
  forceResume: boolean;
}) {
  const { user, planId, workoutDay, cycleWeek, weekName, forceStart, forceResume } = params;
  try {
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

    if (user) {
      SentryDataCollection.setUser({
        id: user.id,
        email: user.email,
      });
    }

    SentryDataCollection.setContext('workout_session', {
      plan_id: planId,
      workout_day: workoutDay,
      cycle_week: cycleWeek,
      week_name: weekName,
      force_start: forceStart,
      force_resume: forceResume,
      session_type: forceResume ? 'resume' : forceStart ? 'forced_start' : 'normal_start',
    });

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
}

// Component for rendering the next exercise preview
function NextExercisePreview({
  getNextExerciseContent,
  shouldShowCompleteWorkout,
  completeWorkout,
  handleNextExercisePress,
  lastExerciseValues,
}: {
  getNextExerciseContent: () => {
    name: string;
    sets: number;
    reps: number;
    imageUrl?: string;
    requiresWeight?: boolean;
    exerciseId?: string;
    primaryMuscle?: string;
  } | null;
  shouldShowCompleteWorkout: boolean;
  completeWorkout: () => void;
  handleNextExercisePress: () => void;
  lastExerciseValues: Record<string, Record<number, { weight: string; reps: string }>>;
}) {
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
}

// Component for workout completion state
function WorkoutCompletionView({ router }: { router: { replace: (path: string) => void } }) {
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      router.replace('/');
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [router]);

  return (
    <View style={[styles.container, styles.loadingContainer]}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Workout completed! Returning to plan...</Text>
    </View>
  );
}

// Component for loading state
function LoadingView() {
  return (
    <View style={[styles.container, styles.loadingContainer]}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Loading workout...</Text>
    </View>
  );
}

// Function to render the appropriate workout view based on current state
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderWorkoutView(props: any) {
  // Early returns for different states
  if (props.isLoading) return <LoadingView />;
  if (props.isWorkoutCompleted && props.completedWorkoutData) {
    return <WorkoutCompletionView router={props.router} />;
  }

  // Render main workout view
  return renderMainWorkoutView(props);
}

// Function to render the main workout interface
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderMainWorkoutView(props: any) {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <WorkoutHeader
        insets={props.insets}
        currentExerciseIndex={props.currentExerciseIndex}
        totalExercises={props.workoutExercises.length}
        cycleWeek={props.cycleWeek}
        weekName={props.weekName}
        onBackPress={props.handleBackPress}
        onExerciseListPress={props.handleExerciseListPress}
      />

      <WorkoutTimerTabs
        workoutDuration={props.workoutDuration}
        totalVolume={props.totalVolume}
        totalReps={props.totalReps}
        formatTime={props.formatTime}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={props.scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollViewContent,
            { paddingBottom: props.keyboardHeight > 0 ? 50 : 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <WorkoutExerciseCard
            exercise={props.currentExercise}
            maxWeightData={props.maxWeightData[props.currentExercise?.exercise_id] || []}
            absoluteMaxWeight={
              props.absoluteMaxWeightData[props.currentExercise?.exercise_id] || null
            }
            onExerciseNamePress={props.handleExerciseNamePressOverride}
          />

          <View style={styles.setsContainer}>
            {props.currentSets.map((set: ExerciseSet, index: number) => {
              const activeSetIndex = props.calculateActiveSetIndex(props.currentSets);
              const isActive = index === activeSetIndex;
              const isCompleted = set.isCompleted;

              return (
                <WorkoutExerciseSetRow
                  key={set.id}
                  set={set}
                  setIndex={index}
                  exercise={props.currentExercise}
                  isActive={isActive}
                  isCompleted={isCompleted}
                  focusedInputs={props.focusedInputs}
                  userEnteredValues={props.userEnteredValues}
                  exerciseCustomized={props.exerciseCustomized}
                  lastExerciseValues={props.lastExerciseValues}
                  currentRecommendation={props.currentRecommendation}
                  textInputRefreshKey={props.textInputRefreshKey}
                  onWeightChange={props.handleWeightChange}
                  onRepsChange={props.handleRepsChange}
                  onSetComplete={props.handleSetComplete}
                  onRedoSet={props.handleRedoSet}
                  onInputFocus={props.handleInputFocus}
                  onInputBlur={props.handleInputBlur}
                  getSuggestedValue={props.getSuggestedValue}
                />
              );
            })}
          </View>

          <Button
            mode="contained"
            style={styles.logAllButton}
            labelStyle={styles.logAllButtonText}
            onPress={() => props.handleLogAllSets(props.currentExercise.id)}
          >
            Log All Sets
          </Button>

          <TouchableOpacity
            style={styles.customizeLink}
            onPress={props.handleCustomizeExercisePress}
          >
            <Text style={styles.customizeLinkText}>Customize Exercise</Text>
          </TouchableOpacity>

          <View style={styles.nextExerciseSection}>
            <Text style={styles.nextExerciseLabel}>Next Exercise</Text>

            <NextExercisePreview
              getNextExerciseContent={props.getNextExerciseContent}
              shouldShowCompleteWorkout={props.shouldShowCompleteWorkout}
              completeWorkout={props.completeWorkout}
              handleNextExercisePress={props.handleNextExercisePress}
              lastExerciseValues={props.lastExerciseValues}
            />

            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressBarFill, { width: `${props.progressPercentage}%` }]} />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <WorkoutWarmupModal
        visible={props.showWarmup && !props.warmupCompleted}
        exerciseName={props.currentExercise?.name}
        onComplete={props.handleWarmupComplete}
        onSkip={props.skipWarmup}
      />

      <WorkoutExitModal
        visible={props.showExitModal}
        onEndWorkout={props.handleExitWorkout}
        onPauseWorkout={props.handlePauseWorkout}
        onReturnToWorkout={props.handleReturnToWorkout}
        onClose={() => props.handleReturnToWorkout()}
      />

      {(props.selectedExerciseForDetails || props.currentExercise) && (
        <ExerciseDetailsModal
          visible={props.showExerciseDetailsModal}
          onClose={() => {
            props.handleExerciseDetailsModalClose();
            props.setSelectedExerciseForDetails(null);
          }}
          exerciseId={(props.selectedExerciseForDetails || props.currentExercise)?.exercise_id}
          exerciseName={(props.selectedExerciseForDetails || props.currentExercise)?.name}
          exerciseImage={(props.selectedExerciseForDetails || props.currentExercise)?.image_url}
          primary_muscles={
            (props.selectedExerciseForDetails || props.currentExercise)?.primary_muscles
          }
          secondary_muscles={[]}
        />
      )}

      <CustomizeExerciseModal
        visible={props.showCustomizeExerciseModal}
        onClose={props.handleCustomizeExerciseModalClose}
        exercise={props.workoutExercises[props.currentExerciseIndex]}
        onSave={props.handleCustomizeExerciseSave}
        availableExercises={props.workoutExercises}
        onExerciseChange={props.handleExerciseChange}
      />

      <ExerciseListModal
        visible={props.showExerciseListModal}
        onClose={props.handleExerciseListModalClose}
        exercises={props.workoutExercises}
        currentExerciseIndex={props.currentExerciseIndex}
        onExerciseSelect={props.handleExerciseSelect}
        onExerciseDetailsPress={props.handleExerciseDetailsPress}
        onReorderExercises={props.handleReorderExercises}
        onRemoveExercise={props.handleRemoveExercise}
        isCustomizeMode={props.isCustomizeMode}
        onToggleCustomizeMode={props.handleToggleCustomizeMode}
        onAddExercise={props.handleAddExercise}
        onAddSuperset={props.handleAddSuperset}
        onAddCardio={props.handleAddCardio}
        onApplyChanges={props.handleApplyChanges}
        pendingAddedExercises={props.pendingAddedExercises}
      />

      <AddExerciseModal
        visible={props.showAddExerciseModal}
        onClose={props.handleAddExerciseModalClose}
        onAddExercises={props.handleAddExercises}
      />
    </View>
  );
}

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
  const forceStart = params.forceStart === 'true';
  const forceResume = params.forceResume === 'true';

  // Initialize Sentry for workout session
  useEffect(() => {
    initializeSentryForWorkout({
      user,
      planId,
      workoutDay,
      cycleWeek,
      weekName,
      forceStart,
      forceResume,
    });
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
    focusedInputs,
    setFocusedInputs,
    userEnteredValues,
    setUserEnteredValues,
    exerciseCustomized,
    setExerciseCustomized,
    textInputRefreshKey,
    setTextInputRefreshKey,
    lastExerciseValues: workoutStateLastExerciseValues,
    // Note: setWorkoutStateLastExerciseValues removed - no longer needed after fixing circular sync
    // Warmup state
    showWarmup,
    setShowWarmup,
    warmupCompleted,
    setWarmupCompleted,
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
  } = useWorkoutData({
    user,
    exercises: workoutExercises,
    cycleWeek,
    externalLastExerciseValues: workoutStateLastExerciseValues,
    isResumingPausedWorkout,
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
      completeWorkout(volume, reps);
    },
    onMoveToNextExercise: () => {
      moveToNextExercise();
    },
  });

  // Use the exercise selection hook
  const {
    showExerciseDetailsModal,
    setShowExerciseDetailsModal,
    showExerciseListModal,
    showCustomizeExerciseModal,
    showAddExerciseModal,
    isCustomizeMode,
    pendingAddedExercises,
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
    handleApplyPendingExercises,
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
    setLastExerciseValues,
    setExerciseCustomized,
    setUserEnteredValues,
    setFocusedInputs,
    setTextInputRefreshKey,
    userId: user?.id,
    onMoveToNextExercise: () => {
      moveToNextExercise();
    },
    onCompleteWorkout: () => {
      completeWorkout();
    },
  });

  // Use the warmup handling hook
  const { handleWarmupComplete, skipWarmup } = useWorkoutWarmup({
    onWarmupCompleted: () => {
      setWarmupCompleted(true);
      setShowWarmup(false);
    },
  });

  // State for tracking which exercise's details to show
  const [selectedExerciseForDetails, setSelectedExerciseForDetails] =
    React.useState<ExerciseData | null>(null);

  // Handle exercise details press from exercise list modal
  const handleExerciseDetailsPress = useCallback(
    (exercise: ExerciseData) => {
      // Close the exercise list modal first
      handleExerciseListModalClose();

      // Set the exercise for the details modal
      setSelectedExerciseForDetails(exercise);

      // Show the exercise details modal
      setShowExerciseDetailsModal(true);
    },
    [handleExerciseListModalClose, setShowExerciseDetailsModal],
  );

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

      // Recalculate totals from scratch after removal for accuracy
      // This prevents issues with subtraction logic and ensures consistency

      // Calculate what the totals should be after removing this exercise
      const remainingExercises = workoutExercises.filter((_, i) => i !== index);
      const remainingExerciseSets = { ...workoutExerciseSets };
      delete remainingExerciseSets[exerciseToRemove.id];

      // Recalculate totals from all remaining exercises
      let newTotalVolume = 0;
      let newTotalReps = 0;

      remainingExercises.forEach((exercise) => {
        const sets = remainingExerciseSets[exercise.id] || [];
        let exerciseVolume = 0;
        let exerciseReps = 0;

        sets.forEach((set) => {
          if (set.isCompleted) {
            const weight =
              exercise?.requires_weight !== false
                ? set.weight === '-' || set.weight === ''
                  ? 0
                  : parseFloat(set.weight)
                : 0;
            const reps = set.reps === '-' || set.reps === '' ? 0 : parseFloat(set.reps);
            const setVolume =
              exercise?.requires_weight !== false ? parseFloat((weight * reps).toFixed(1)) : 0;

            if (exercise?.requires_weight !== false) {
              exerciseVolume += setVolume;
            }
            exerciseReps += reps;
          }
        });

        newTotalVolume += exerciseVolume;
        newTotalReps += exerciseReps;
      });

      // Update totals with recalculated values (this is more reliable than subtraction)
      setTotalVolume(newTotalVolume);
      setTotalReps(newTotalReps);

      // Remove the exercise from the exercises array
      setWorkoutExercises(remainingExercises);

      // Remove associated exercise sets
      setWorkoutExerciseSets(remainingExerciseSets);

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
      if (index < currentExerciseIndex) {
        // If we deleted an exercise before the current one, move current index back by 1
        setCurrentExerciseIndex(currentExerciseIndex - 1);
      } else if (index === currentExerciseIndex) {
        // If we deleted the current exercise, stay at the same index to move to next exercise
        // But if this was the last exercise, move to the previous one
        if (currentExerciseIndex >= remainingExercises.length) {
          setCurrentExerciseIndex(Math.max(0, remainingExercises.length - 1));
        }
        // Otherwise, keep the same index (which now points to the next exercise)
      }
      // If index > currentExerciseIndex, no adjustment needed
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
      setTotalVolume,
      setTotalReps,
    ],
  );

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
    forceStart,
    setIsWorkoutCompleted,
    setCompletedWorkoutData,
    stopWorkoutTimer,
    formatTime,
    fetchLastExerciseRecords,
    navigate: router.replace,
  });

  // Use the workout navigation hook for moveToNextExercise
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
    exerciseCustomized,
    userEnteredValues,
    focusedInputs,
  });

  // Handle applying changes from the exercise list modal
  const handleApplyChanges = useCallback(
    (newExercises: ExerciseData[], removedIndices: number[], addedExercises?: ExerciseData[]) => {
      try {
        // Store the original state for comparison
        const originalExercises = [...workoutExercises];

        // First, apply pending added exercises if any
        if (addedExercises && addedExercises.length > 0) {
          handleApplyPendingExercises();
        }

        // Handle removals by using the final exercise list from the modal
        // This avoids index conflicts that occur when removing exercises one by one
        if (removedIndices.length > 0) {
          // Calculate which exercises were removed
          const exercisesToRemove = removedIndices
            .map((index) => originalExercises[index])
            .filter(Boolean);

          // Recalculate totals by subtracting removed exercise volumes
          let volumeToSubtract = 0;
          let repsToSubtract = 0;

          exercisesToRemove.forEach((exercise) => {
            const sets = workoutExerciseSets[exercise.id] || [];
            sets.forEach((set) => {
              if (set.isCompleted) {
                const weight =
                  exercise?.requires_weight !== false
                    ? set.weight === '-' || set.weight === ''
                      ? 0
                      : parseFloat(set.weight)
                    : 0;
                const reps = set.reps === '-' || set.reps === '' ? 0 : parseFloat(set.reps);
                const setVolume =
                  exercise?.requires_weight !== false ? parseFloat((weight * reps).toFixed(1)) : 0;

                if (exercise?.requires_weight !== false) {
                  volumeToSubtract += setVolume;
                }
                repsToSubtract += reps;
              }
            });
          });

          // Update totals
          setTotalVolume((prev) => Math.max(0, prev - volumeToSubtract));
          setTotalReps((prev) => Math.max(0, prev - repsToSubtract));

          // Set the new exercises list directly from the modal
          setWorkoutExercises(newExercises);

          // Remove associated exercise sets for removed exercises
          const newExerciseSets = { ...workoutExerciseSets };
          exercisesToRemove.forEach((exercise) => {
            delete newExerciseSets[exercise.id];
          });
          setWorkoutExerciseSets(newExerciseSets);

          // Remove associated state for removed exercises
          const newExerciseCustomized = { ...exerciseCustomized };
          const newUserEnteredValues = { ...userEnteredValues };
          const newLastExerciseValues = { ...lastExerciseValues };

          exercisesToRemove.forEach((exercise) => {
            delete newExerciseCustomized[exercise.id];
            delete newLastExerciseValues[exercise.exercise_id];

            // Remove user entered values that start with the exercise ID
            Object.keys(newUserEnteredValues).forEach((key) => {
              if (key.startsWith(exercise.id)) {
                delete newUserEnteredValues[key];
              }
            });
          });

          setExerciseCustomized(newExerciseCustomized);
          setUserEnteredValues(newUserEnteredValues);
          setLastExerciseValues(newLastExerciseValues);

          // Adjust current exercise index if necessary
          const removedCount = removedIndices.filter(
            (index) => index < currentExerciseIndex,
          ).length;
          if (removedCount > 0) {
            setCurrentExerciseIndex((prev) => Math.max(0, prev - removedCount));
          } else if (removedIndices.includes(currentExerciseIndex)) {
            // Current exercise was removed - stay at same index (move to next) or move to previous if it was the last
            setCurrentExerciseIndex((prev) => Math.max(0, Math.min(prev, newExercises.length - 1)));
          }
        } else {
          // No removals, just handle reordering if exercises have changed
          if (JSON.stringify(newExercises) !== JSON.stringify(originalExercises)) {
            handleReorderExercises(newExercises);
          }
        }
      } catch (error) {
        console.error('Error applying exercise changes:', error);
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
      setTotalVolume,
      setTotalReps,
      handleReorderExercises,
      handleApplyPendingExercises,
    ],
  );

  // Get the current exercise based on the current index
  const currentExercise = workoutExercises[currentExerciseIndex];

  // Override handleExerciseNamePress to set the current exercise as selected
  const handleExerciseNamePressOverride = useCallback(() => {
    setSelectedExerciseForDetails(currentExercise);
    setShowExerciseDetailsModal(true);
  }, [currentExercise, setShowExerciseDetailsModal]);

  // Use the workout initialization hook to handle all setup effects
  useWorkoutInitialization({
    user,
    cycleWeek,
    isLoading,
    isResumingPausedWorkout,
    clearAllTimers,
    fetchLastExerciseRecords,
    fetchMaxWeightDataForAllExercises,
    fetchCycleWeekInfo,
    workoutExercises,
  });

  // REMOVED: Circular sync that was causing infinite loops when deleting exercises
  // The useWorkoutData hook already manages lastExerciseValues state properly
  // Syncing it back to workoutState creates circular dependencies

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

  // Render the appropriate view based on current state
  return renderWorkoutView({
    isLoading,
    isWorkoutCompleted,
    completedWorkoutData,
    router,
    insets,
    currentExerciseIndex,
    workoutExercises,
    cycleWeek,
    weekName,
    handleBackPress,
    handleExerciseListPress,
    workoutDuration,
    totalVolume,
    totalReps,
    formatTime,
    keyboardHeight,
    scrollViewRef,
    currentExercise,
    maxWeightData,
    absoluteMaxWeightData,
    handleExerciseNamePressOverride,
    currentSets,
    calculateActiveSetIndex,
    focusedInputs,
    userEnteredValues,
    exerciseCustomized,
    lastExerciseValues,
    currentRecommendation,
    textInputRefreshKey,
    handleWeightChange,
    handleRepsChange,
    handleSetComplete,
    handleRedoSet,
    handleInputFocus,
    handleInputBlur,
    getSuggestedValue,
    handleLogAllSets,
    handleCustomizeExercisePress,
    getNextExerciseContent,
    shouldShowCompleteWorkout,
    completeWorkout,
    handleNextExercisePress,
    progressPercentage,
    showWarmup,
    warmupCompleted,
    handleWarmupComplete,
    skipWarmup,
    showExitModal,
    handleExitWorkout,
    handlePauseWorkout,
    handleReturnToWorkout,
    selectedExerciseForDetails,
    showExerciseDetailsModal,
    handleExerciseDetailsModalClose,
    setSelectedExerciseForDetails,
    showCustomizeExerciseModal,
    handleCustomizeExerciseModalClose,
    handleCustomizeExerciseSave,
    handleExerciseChange,
    showExerciseListModal,
    handleExerciseListModalClose,
    handleExerciseSelect,
    handleExerciseDetailsPress,
    handleReorderExercises,
    handleRemoveExercise,
    isCustomizeMode,
    handleToggleCustomizeMode,
    handleAddExercise,
    handleAddSuperset,
    handleAddCardio,
    handleApplyChanges,
    showAddExerciseModal,
    handleAddExerciseModalClose,
    handleAddExercises,
    pendingAddedExercises,
  });
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
