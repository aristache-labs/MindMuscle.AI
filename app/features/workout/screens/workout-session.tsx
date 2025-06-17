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

// Component for empty workout state
function EmptyWorkoutView({ onAddExercise }: { onAddExercise: () => void }) {
  return (
    <View style={[styles.container, styles.emptyWorkoutContainer]}>
      <View style={styles.emptyWorkoutContent}>
        <Ionicons name="fitness-outline" size={64} color={COLORS.placeholder} />
        <Text style={styles.emptyWorkoutTitle}>No Exercises in Workout</Text>
        <Text style={styles.emptyWorkoutSubtitle}>
          Your workout is empty. Add some exercises to get started.
        </Text>
        <TouchableOpacity style={styles.addExerciseButton} onPress={onAddExercise}>
          <Ionicons name="add-circle" size={24} color={COLORS.background} />
          <Text style={styles.addExerciseButtonText}>Add Exercises</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Function to render the appropriate workout view based on current state
function renderWorkoutView(props: Record<string, unknown>) {
  // Early returns for different states
  if (props.isLoading) return <LoadingView />;
  if (props.isWorkoutCompleted)
    return <WorkoutCompletionView router={props.router as { replace: (path: string) => void }} />;

  // Check if we have exercises, if not show empty state with header
  if (!props.workoutExercises || (props.workoutExercises as ExerciseData[]).length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />

        <WorkoutHeader
          insets={props.insets as { top: number; bottom: number; left: number; right: number }}
          currentExerciseIndex={0}
          totalExercises={0}
          cycleWeek={props.cycleWeek as number}
          weekName={props.weekName as string}
          onBackPress={props.handleBackPress as () => void}
          onExerciseListPress={props.handleAddExercise as () => void}
        />

        <WorkoutTimerTabs
          workoutDuration={props.workoutDuration as number}
          totalVolume={0}
          totalReps={0}
          formatTime={props.formatTime as (seconds: number) => string}
        />

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <EmptyWorkoutView onAddExercise={props.handleAddExercise as () => void} />
        </View>

        {renderWorkoutModals(props)}
      </View>
    );
  }

  return renderMainWorkoutView(props);
}

// Helper function to render exercise sets content
function renderExerciseSetsContent(props: Record<string, unknown>) {
  if (!props.currentExercise || !props.currentSets) {
    return null;
  }

  // Type assertion is safe here because of the null check above
  const currentExercise = props.currentExercise as ExerciseData;

  return (
    <>
      <View style={styles.setsContainer}>
        {(props.currentSets as ExerciseSet[]).map((set: ExerciseSet, index: number) => {
          const activeSetIndex = (props.calculateActiveSetIndex as (sets: ExerciseSet[]) => number)(
            props.currentSets as ExerciseSet[],
          );
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
              focusedInputs={props.focusedInputs as Record<string, boolean>}
              userEnteredValues={props.userEnteredValues as Record<string, boolean>}
              exerciseCustomized={props.exerciseCustomized as Record<string, boolean>}
              lastExerciseValues={
                props.lastExerciseValues as Record<
                  string,
                  Record<number, { weight: string; reps: string }>
                >
              }
              currentRecommendation={
                props.currentRecommendation as { recommended_weight?: number } | null
              }
              textInputRefreshKey={props.textInputRefreshKey as number}
              onWeightChange={
                props.handleWeightChange as (
                  exerciseId: string,
                  setIndex: number,
                  weight: string,
                ) => void
              }
              onRepsChange={
                props.handleRepsChange as (
                  exerciseId: string,
                  setIndex: number,
                  reps: string,
                ) => void
              }
              onSetComplete={
                props.handleSetComplete as (exerciseId: string, setIndex: number) => void
              }
              onRedoSet={props.handleRedoSet as (exerciseId: string, setIndex: number) => void}
              onInputFocus={props.handleInputFocus as (inputId: string) => void}
              onInputBlur={props.handleInputBlur as (inputId: string) => void}
              getSuggestedValue={
                props.getSuggestedValue as (
                  exerciseId: string,
                  setNumber: number,
                  type: 'weight' | 'reps',
                ) => string | null
              }
            />
          );
        })}
      </View>

      <Button
        mode="contained"
        style={styles.logAllButton}
        labelStyle={styles.logAllButtonText}
        onPress={() => (props.handleLogAllSets as (exerciseId: string) => void)(currentExercise.id)}
      >
        Log All Sets
      </Button>

      <TouchableOpacity
        style={styles.customizeLink}
        onPress={props.handleCustomizeExercisePress as () => void}
      >
        <Text style={styles.customizeLinkText}>Customize Exercise</Text>
      </TouchableOpacity>
    </>
  );
}

// Helper function to render workout modals
function renderWorkoutModals(props: Record<string, unknown>) {
  return (
    <>
      <WorkoutWarmupModal
        visible={(props.showWarmup as boolean) && !(props.warmupCompleted as boolean)}
        exerciseName={(props.currentExercise as ExerciseData | null)?.name}
        onComplete={props.handleWarmupComplete as () => void}
        onSkip={props.skipWarmup as () => void}
      />

      <WorkoutExitModal
        visible={props.showExitModal as boolean}
        onEndWorkout={props.handleExitWorkout as () => void}
        onPauseWorkout={props.handlePauseWorkout as () => void}
        onReturnToWorkout={props.handleReturnToWorkout as () => void}
        onClose={() => (props.handleReturnToWorkout as () => void)()}
      />

      {((props.selectedExerciseForDetails as ExerciseData | null) ||
        (props.currentExercise as ExerciseData | null)) && (
        <ExerciseDetailsModal
          visible={props.showExerciseDetailsModal as boolean}
          onClose={() => {
            (props.handleExerciseDetailsModalClose as () => void)();
            (props.setSelectedExerciseForDetails as (exercise: ExerciseData | null) => void)(null);
          }}
          exerciseId={
            (
              (props.selectedExerciseForDetails as ExerciseData | null) ||
              (props.currentExercise as ExerciseData | null)
            )?.exercise_id || ''
          }
          exerciseName={
            (
              (props.selectedExerciseForDetails as ExerciseData | null) ||
              (props.currentExercise as ExerciseData | null)
            )?.name || ''
          }
          exerciseImage={
            (
              (props.selectedExerciseForDetails as ExerciseData | null) ||
              (props.currentExercise as ExerciseData | null)
            )?.image_url
          }
          primary_muscles={
            (
              (props.selectedExerciseForDetails as ExerciseData | null) ||
              (props.currentExercise as ExerciseData | null)
            )?.primary_muscles
          }
          secondary_muscles={[]}
        />
      )}

      <CustomizeExerciseModal
        visible={props.showCustomizeExerciseModal as boolean}
        onClose={props.handleCustomizeExerciseModalClose as () => void}
        exercise={(props.workoutExercises as ExerciseData[])[props.currentExerciseIndex as number]}
        onSave={
          props.handleCustomizeExerciseSave as (updatedExercise: {
            sets: number;
            reps_range: string;
          }) => void
        }
        availableExercises={props.workoutExercises as ExerciseData[]}
        onExerciseChange={props.handleExerciseChange as (newExercise: unknown) => void}
      />

      <ExerciseListModal
        visible={props.showExerciseListModal as boolean}
        onClose={props.handleExerciseListModalClose as () => void}
        exercises={props.workoutExercises as ExerciseData[]}
        currentExerciseIndex={props.currentExerciseIndex as number}
        onExerciseSelect={props.handleExerciseSelect as (index: number) => void}
        onExerciseDetailsPress={
          props.handleExerciseDetailsPress as (exercise: ExerciseData) => void
        }
        onReorderExercises={props.handleReorderExercises as (newOrder: ExerciseData[]) => void}
        onRemoveExercise={props.handleRemoveExercise as (index: number) => void}
        isCustomizeMode={props.isCustomizeMode as boolean}
        onToggleCustomizeMode={props.handleToggleCustomizeMode as () => void}
        onAddExercise={props.handleAddExercise as () => void}
        onAddSuperset={props.handleAddSuperset as () => void}
        onAddCardio={props.handleAddCardio as () => void}
        onApplyChanges={
          props.handleApplyChanges as (
            exercises: ExerciseData[],
            removedIndices: number[],
            addedExercises?: ExerciseData[],
          ) => void
        }
        pendingAddedExercises={props.pendingAddedExercises as ExerciseData[]}
      />

      <AddExerciseModal
        visible={props.showAddExerciseModal as boolean}
        onClose={props.handleAddExerciseModalClose as () => void}
        onAddExercises={
          props.handleAddExercises as (
            exerciseConfigurations: Array<{
              exerciseId: string;
              name: string;
              sets: number;
              reps_range: string;
              image_url?: string;
              muscle_group: string;
              primary_muscles?: string[];
              requires_weight?: boolean;
            }>,
          ) => void
        }
      />
    </>
  );
}

// Helper function to render the main workout content
function renderWorkoutContent(props: Record<string, unknown>) {
  return (
    <ScrollView
      ref={props.scrollViewRef as React.RefObject<ScrollView>}
      style={styles.scrollView}
      contentContainerStyle={[
        styles.scrollViewContent,
        { paddingBottom: (props.keyboardHeight as number) > 0 ? 50 : 24 },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {(props.currentExercise as ExerciseData | null) && (
        <WorkoutExerciseCard
          exercise={props.currentExercise as ExerciseData}
          maxWeightData={
            (props.maxWeightData as Record<string, { date: string; value: number }[]>)[
              (props.currentExercise as ExerciseData)?.exercise_id
            ] || []
          }
          absoluteMaxWeight={
            (
              props.absoluteMaxWeightData as Record<
                string,
                { weight: number; reps: number; date: string }
              >
            )[(props.currentExercise as ExerciseData)?.exercise_id] || null
          }
          onExerciseNamePress={props.handleExerciseNamePressOverride as () => void}
        />
      )}

      {renderExerciseSetsContent(props)}

      <View style={styles.nextExerciseSection}>
        <Text style={styles.nextExerciseLabel}>Next Exercise</Text>

        <NextExercisePreview
          getNextExerciseContent={
            props.getNextExerciseContent as () => {
              name: string;
              sets: number;
              reps: number;
              imageUrl?: string;
              requiresWeight?: boolean;
              exerciseId?: string;
              primaryMuscle?: string;
            } | null
          }
          shouldShowCompleteWorkout={props.shouldShowCompleteWorkout as boolean}
          completeWorkout={props.completeWorkout as () => void}
          handleNextExercisePress={props.handleNextExercisePress as () => void}
          lastExerciseValues={
            props.lastExerciseValues as Record<
              string,
              Record<number, { weight: string; reps: string }>
            >
          }
        />

        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressBarFill, { width: `${props.progressPercentage as number}%` }]}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// Function to render the main workout interface
function renderMainWorkoutView(props: Record<string, unknown>) {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <WorkoutHeader
        insets={props.insets as { top: number; bottom: number; left: number; right: number }}
        currentExerciseIndex={props.currentExerciseIndex as number}
        totalExercises={(props.workoutExercises as ExerciseData[]).length}
        cycleWeek={props.cycleWeek as number}
        weekName={props.weekName as string}
        onBackPress={props.handleBackPress as () => void}
        onExerciseListPress={props.handleExerciseListPress as () => void}
      />

      <WorkoutTimerTabs
        workoutDuration={props.workoutDuration as number}
        totalVolume={props.totalVolume as number}
        totalReps={props.totalReps as number}
        formatTime={props.formatTime as (seconds: number) => string}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {renderWorkoutContent(props)}
      </KeyboardAvoidingView>

      {renderWorkoutModals(props)}
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
    async (
      newExercises: ExerciseData[],
      removedIndices: number[],
      addedExercises?: ExerciseData[],
    ) => {
      try {
        // Store the original state for comparison
        const originalExercises = [...workoutExercises];

        // First, apply pending added exercises if any
        if (addedExercises && addedExercises.length > 0) {
          // Apply the pending exercises from useExerciseSelection hook
          await handleApplyPendingExercises();

          // Always initialize sets for all added exercises as a safety net
          // This ensures that even if handleApplyPendingExercises didn't process them
          // or there were timing issues with state updates, the sets will still be created
          const addedExercisesToInitialize = addedExercises;

          console.log(
            'handleApplyChanges: Added exercises:',
            addedExercises.map((e) => ({ id: e.id, name: e.name, sets: e.sets })),
          );
          console.log(
            'handleApplyChanges: Exercises needing initialization:',
            addedExercisesToInitialize.map((e) => ({ id: e.id, name: e.name, sets: e.sets })),
          );

          if (addedExercisesToInitialize.length > 0) {
            // Fetch historical data for the added exercises if user is available
            let exerciseHistory: Record<
              string,
              Record<number, { weight: string; reps: string }>
            > = {};
            if (user?.id) {
              try {
                const { fetchLastExerciseRecords } = await import(
                  '../../../services/workoutDataService'
                );
                exerciseHistory = await fetchLastExerciseRecords(
                  user.id,
                  addedExercisesToInitialize,
                );
              } catch (error) {
                console.warn('Failed to fetch exercise history for added exercises:', error);
                // Continue without historical data
              }
            }

            // Initialize exercise sets for newly added exercises that don't have sets yet
            setWorkoutExerciseSets((prev) => {
              const newSets = { ...prev };
              addedExercisesToInitialize.forEach((exercise) => {
                if (!newSets[exercise.id]) {
                  const historyData = exerciseHistory[exercise.exercise_id] || {};

                  const sets = Array.from({ length: exercise.sets }, (_, index) => {
                    const setNumber = index + 1;
                    const lastWeight = historyData[setNumber]?.weight || '';
                    const lastReps = historyData[setNumber]?.reps || exercise.reps_range;

                    return {
                      id: `${exercise.id}-set-${index + 1}`,
                      setNumber: setNumber,
                      weight: exercise.requires_weight !== false ? lastWeight : '',
                      reps: lastReps,
                      isCompleted: false,
                    };
                  });

                  newSets[exercise.id] = sets;
                  console.log(
                    `handleApplyChanges: Initialized ${sets.length} sets for exercise ${exercise.name} (${exercise.id})`,
                  );
                }
              });
              return newSets;
            });

            // Update last exercise values for recommendation system
            if (Object.keys(exerciseHistory).length > 0) {
              setLastExerciseValues((prev) => ({
                ...prev,
                ...exerciseHistory,
              }));
            }
          }
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
          if (newExercises.length !== originalExercises.length) {
            setWorkoutExercises(newExercises);
          } else if (JSON.stringify(newExercises) !== JSON.stringify(originalExercises)) {
            // Pure re-order with the same length – use the dedicated handler
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
      user,
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
  emptyWorkoutContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyWorkoutContent: {
    alignItems: 'center',
    maxWidth: 300,
  },
  emptyWorkoutTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptyWorkoutSubtitle: {
    color: COLORS.placeholder,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
  },
  addExerciseButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '600',
  },
});
