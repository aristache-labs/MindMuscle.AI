import { useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, FlatList, ScrollView, View } from 'react-native';
import { Appbar, Button, FAB, IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ExerciseDetailsModal from '../../../components/ExerciseDetailsModal';
import MyPlanCalendar from '../../../components/myplanCalendar';
import PlanOverviewModal from '../../../components/PlanOverviewModal';
import { COLORS, SPACING } from '../../../constants/theme';
import workoutPlanService from '../../../services/workoutPlanService';
import { useAuth } from '../../../store/AuthContext';
import {
  CompletedWorkoutView,
  DateSelectionLoadingComponent,
  ExerciseItem,
  LockedWeekComponent,
  NoPlanView,
  PausedWorkoutModal,
  RestDayComponent,
  WorkoutHeader,
  WorkoutStatsRow,
} from '../components';
import {
  useCalendarData,
  useDateSelection,
  usePlanData,
  usePlanState,
  useWorkoutActions,
} from '../hooks';
import { styles } from '../styles';
import {
  CompletedWorkoutData,
  CycleProgress,
  Exercise,
  LockedWeekInfo,
  MyPlanScreenProps,
  PausedWorkout,
  Plan,
  WorkoutDay,
} from '../types';
import { calculateWorkoutStats, updatePausedWorkoutWithCustomizations } from '../utils';

// Loading Screen Component
const LoadingScreen: React.FC<{ embedded: boolean }> = ({ embedded }) => {
  const router = useRouter();

  return (
    <View style={[styles.container, styles.loadingContainer]}>
      {!embedded && (
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.push('/(tabs)')} />
          <Appbar.Content title="My Plan" />
        </Appbar.Header>
      )}
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
};

// No Plan Screen Component
const NoPlanScreen: React.FC<{ embedded: boolean }> = ({ embedded }) => {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {!embedded && (
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.push('/(tabs)')} />
          <Appbar.Content title="My Plan" />
        </Appbar.Header>
      )}
      <NoPlanView />
    </View>
  );
};

// Helper function to determine if paused workout matches current day
const isPausedWorkoutActive = (
  hasPausedWorkout: boolean,
  pausedWorkout: PausedWorkout | null,
  activeDay: number | null,
): boolean => {
  return hasPausedWorkout && pausedWorkout !== null && pausedWorkout.workoutDay === activeDay;
};

// Helper function to get exercises to display
const getExercisesToDisplay = (
  hasPausedWorkout: boolean,
  pausedWorkout: PausedWorkout | null,
  activeDay: number | null,
  workoutDay: WorkoutDay | null,
): Exercise[] => {
  const isPausedActive = isPausedWorkoutActive(hasPausedWorkout, pausedWorkout, activeDay);
  return isPausedActive ? pausedWorkout!.exercises : workoutDay?.exercises || [];
};

// Helper function to get workout stats to display
const getWorkoutStatsToDisplay = (
  hasPausedWorkout: boolean,
  pausedWorkout: PausedWorkout | null,
  activeDay: number | null,
  workoutDay: WorkoutDay | null,
) => {
  const isPausedActive = isPausedWorkoutActive(hasPausedWorkout, pausedWorkout, activeDay);

  if (isPausedActive) {
    const pausedWorkoutStats = calculateWorkoutStats(pausedWorkout!.exercises);
    return {
      exercises: pausedWorkoutStats.exerciseCount,
      duration: pausedWorkoutStats.duration,
      calories: pausedWorkoutStats.calories,
    };
  }

  return {
    exercises: workoutDay?.total_exercises || 0,
    duration: workoutDay?.estimated_duration || 0,
    calories: workoutDay?.total_calories || 0,
  };
};

// Helper component for active workout day view
const ActiveWorkoutDayView: React.FC<{
  activeDay: number;
  getWorkoutDayByNumber: (day: number | null) => WorkoutDay | null;
  isWorkoutCompleted: boolean;
  completedWorkoutData: CompletedWorkoutData | null;
  onRedoWorkout: () => void;
  selectedDate: Date;
  plan: Plan;
  cycleProgress: CycleProgress | null;
  onPlanOverviewPress: () => void;
  onEditPlanPress: () => void;
  hasPausedWorkout: boolean;
  pausedWorkout: PausedWorkout | null;
  renderExerciseItem: ({ item, index }: { item: Exercise; index: number }) => React.ReactElement;
}> = ({
  activeDay,
  getWorkoutDayByNumber,
  isWorkoutCompleted,
  completedWorkoutData,
  onRedoWorkout,
  selectedDate,
  plan,
  cycleProgress,
  onPlanOverviewPress,
  onEditPlanPress,
  hasPausedWorkout,
  pausedWorkout,
  renderExerciseItem,
}) => {
  const workoutDay = getWorkoutDayByNumber(activeDay);

  if (isWorkoutCompleted) {
    return (
      <CompletedWorkoutView
        completedWorkoutData={completedWorkoutData}
        workoutDay={workoutDay}
        onRedoWorkout={onRedoWorkout}
      />
    );
  }

  const exercisesToDisplay = getExercisesToDisplay(
    hasPausedWorkout,
    pausedWorkout,
    activeDay,
    workoutDay,
  );

  const statsToDisplay = getWorkoutStatsToDisplay(
    hasPausedWorkout,
    pausedWorkout,
    activeDay,
    workoutDay,
  );

  return (
    <>
      <WorkoutHeader
        selectedDate={selectedDate}
        planSubtitle={plan.subtitle}
        cycleProgress={cycleProgress}
        onPlanOverviewPress={onPlanOverviewPress}
        onEditPlanPress={onEditPlanPress}
      />

      <View style={styles.workoutContainer}>
        <WorkoutStatsRow
          exercises={statsToDisplay.exercises}
          duration={statsToDisplay.duration}
          calories={statsToDisplay.calories}
        />

        <View style={styles.exercisesContainer}>
          <FlatList
            data={exercisesToDisplay}
            keyExtractor={(item) => item.id}
            renderItem={renderExerciseItem}
            scrollEnabled={false}
          />
        </View>
      </View>
    </>
  );
};

// Workout Content Component
const WorkoutContent: React.FC<{
  isDateSelectionLoading: boolean;
  isViewingLockedWeek: boolean;
  lockedWeekInfo: LockedWeekInfo | null;
  activeDay: number | null;
  getWorkoutDayByNumber: (day: number | null) => WorkoutDay | null;
  isWorkoutCompleted: boolean;
  completedWorkoutData: CompletedWorkoutData | null;
  selectedDate: Date;
  plan: Plan;
  cycleProgress: CycleProgress | null;
  renderExerciseItem: ({ item, index }: { item: Exercise; index: number }) => React.ReactElement;
  onBackToCurrentWeek: () => void;
  onRedoWorkout: () => void;
  onPlanOverviewPress: () => void;
  onEditPlanPress: () => void;
  hasPausedWorkout: boolean;
  pausedWorkout: PausedWorkout | null;
}> = ({
  isDateSelectionLoading,
  isViewingLockedWeek,
  lockedWeekInfo,
  activeDay,
  getWorkoutDayByNumber,
  isWorkoutCompleted,
  completedWorkoutData,
  selectedDate,
  plan,
  cycleProgress,
  renderExerciseItem,
  onBackToCurrentWeek,
  onRedoWorkout,
  onPlanOverviewPress,
  onEditPlanPress,
  hasPausedWorkout,
  pausedWorkout,
}) => {
  if (isDateSelectionLoading) {
    return <DateSelectionLoadingComponent />;
  }

  if (isViewingLockedWeek) {
    return (
      <LockedWeekComponent
        lockedWeekInfo={lockedWeekInfo}
        onBackToCurrentWeek={onBackToCurrentWeek}
      />
    );
  }

  const hasActiveWorkoutDay = activeDay !== null && getWorkoutDayByNumber(activeDay);

  if (hasActiveWorkoutDay) {
    return (
      <ActiveWorkoutDayView
        activeDay={activeDay!}
        getWorkoutDayByNumber={getWorkoutDayByNumber}
        isWorkoutCompleted={isWorkoutCompleted}
        completedWorkoutData={completedWorkoutData}
        onRedoWorkout={onRedoWorkout}
        selectedDate={selectedDate}
        plan={plan}
        cycleProgress={cycleProgress}
        onPlanOverviewPress={onPlanOverviewPress}
        onEditPlanPress={onEditPlanPress}
        hasPausedWorkout={hasPausedWorkout}
        pausedWorkout={pausedWorkout}
        renderExerciseItem={renderExerciseItem}
      />
    );
  }

  return <RestDayComponent selectedDate={selectedDate} />;
};

// Action Button Component
const ActionButton: React.FC<{
  activeDay: number | null;
  getWorkoutDayByNumber: (day: number | null) => WorkoutDay | null;
  isViewingLockedWeek: boolean;
  isWorkoutCompleted: boolean;
  hasPausedWorkout: boolean;
  pausedWorkout: PausedWorkout | null;
  onStartWorkout: () => void;
  onResumeWorkout: () => void;
  onRedoWorkout: () => void;
}> = ({
  activeDay,
  getWorkoutDayByNumber,
  isViewingLockedWeek,
  isWorkoutCompleted,
  hasPausedWorkout,
  pausedWorkout,
  onStartWorkout,
  onResumeWorkout,
  onRedoWorkout,
}) => {
  if (activeDay === null || !getWorkoutDayByNumber(activeDay) || isViewingLockedWeek) {
    return null;
  }

  if (isWorkoutCompleted) {
    return (
      <Button
        mode="contained"
        style={styles.redoButton}
        labelStyle={styles.redoButtonText}
        onPress={onRedoWorkout}
        icon="refresh"
      >
        REDO WORKOUT
      </Button>
    );
  }

  if (hasPausedWorkout && pausedWorkout && pausedWorkout.workoutDay === activeDay) {
    return (
      <FAB
        style={[styles.fab, { backgroundColor: '#FF9800' }]}
        icon="play-pause"
        label="RESUME WORKOUT"
        onPress={onResumeWorkout}
        color={COLORS.text}
      />
    );
  }

  return (
    <FAB
      style={styles.fab}
      icon="play"
      label="START WORKOUT"
      onPress={onStartWorkout}
      color={COLORS.text}
    />
  );
};

const MyPlanScreen: React.FC<MyPlanScreenProps> = ({ embedded = false }) => {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Use the plan state hook
  const {
    isLoading,
    plan,
    error: _error,
    userWorkoutDays,
    selectedDate,
    activeDay,
    completedWorkoutDays,
    pausedWorkoutDays,
    isWorkoutCompleted,
    completedWorkoutData,
    pausedWorkout,
    hasPausedWorkout,
    showPausedWorkoutModal,
    pausedWorkoutInfo,
    cycleProgress,
    isViewingLockedWeek,
    lockedWeekInfo,
    isDateSelectionLoading,
    isManualDateSelection,
    hasAppliedCustomizations: _hasAppliedCustomizations,
    exerciseDetailsModalVisible,
    selectedExercise,
    planOverviewModalVisible,
    setIsLoading,
    setPlan,
    setError,
    setUserWorkoutDays,
    setSelectedDate,
    setActiveDay,
    setCompletedWorkoutDays,
    setPausedWorkoutDays,
    setIsWorkoutCompleted,
    setCompletedWorkoutData,
    setPausedWorkout,
    setHasPausedWorkout,
    setShowPausedWorkoutModal,
    setPausedWorkoutInfo,
    setCycleProgress,
    setIsViewingLockedWeek,
    setLockedWeekInfo,
    setIsDateSelectionLoading,
    setIsManualDateSelection,
    setHasAppliedCustomizations,
    setExerciseDetailsModalVisible,
    setSelectedExercise,
    setPlanOverviewModalVisible,
    getWorkoutDayByNumber,
  } = usePlanState();

  // Use the plan data hook
  const { fetchUserWorkoutDays, fetchActivePlan } = usePlanData({
    userWorkoutDays,
    setPlan,
    setCycleProgress,
    setActiveDay,
    setSelectedDate,
    setIsLoading,
    setError,
  });

  // Use the calendar data hook
  const { updateCalendarWorkoutStatus } = useCalendarData({
    plan,
    userWorkoutDays,
    setCompletedWorkoutDays,
    setPausedWorkoutDays,
  });

  // Use the date selection hook
  const { handleCalendarDateSelect } = useDateSelection({
    plan,
    userWorkoutDays,
    cycleProgress,
    setSelectedDate,
    setActiveDay,
    setIsWorkoutCompleted,
    setCompletedWorkoutData,
    setHasPausedWorkout,
    setPausedWorkout,
    setIsViewingLockedWeek,
    setLockedWeekInfo,
    setIsDateSelectionLoading,
    setIsManualDateSelection,
  });

  // Function to update paused workout with current exercise customizations
  const updatePausedWorkoutWithCustomizationsCallback = useCallback(
    async (pausedWorkoutData: PausedWorkout) => {
      if (!user) {
        throw new Error('User not authenticated');
      }
      if (!plan) {
        throw new Error('No active plan found');
      }
      return await updatePausedWorkoutWithCustomizations(
        pausedWorkoutData,
        user,
        plan,
        workoutPlanService,
      );
    },
    [user, plan],
  );

  // Use the workout actions hook
  const { handleStartWorkout, handleResumeWorkout, handleRedoWorkout } = useWorkoutActions({
    plan,
    activeDay,
    selectedDate,
    userWorkoutDays,
    pausedWorkout,
    hasPausedWorkout,
    setIsLoading,
    setPausedWorkout,
    setHasPausedWorkout,
    setShowPausedWorkoutModal,
    setPausedWorkoutInfo,
    setHasAppliedCustomizations,
    updatePausedWorkoutWithCustomizations: updatePausedWorkoutWithCustomizationsCallback,
  });

  // Modal handlers
  const handleExerciseNamePress = useCallback(
    (exercise: Exercise) => {
      setSelectedExercise({
        id: exercise.exercise_id || exercise.id,
        name: exercise.name,
        image_url: exercise.image_url,
        primary_muscles: exercise.primary_muscles,
        secondary_muscles: [],
        exercise_id: exercise.exercise_id || exercise.id,
      });
      setExerciseDetailsModalVisible(true);
    },
    [setSelectedExercise, setExerciseDetailsModalVisible],
  );

  const handleExerciseDetailsModalClose = useCallback(() => {
    setExerciseDetailsModalVisible(false);
    setSelectedExercise(null);
  }, [setExerciseDetailsModalVisible, setSelectedExercise]);

  const handlePlanOverviewPress = useCallback(() => {
    setPlanOverviewModalVisible(true);
  }, [setPlanOverviewModalVisible]);

  const handlePlanOverviewModalClose = useCallback(() => {
    setPlanOverviewModalVisible(false);
  }, [setPlanOverviewModalVisible]);

  const handleEditPlanPress = useCallback(() => {
    console.log('Edit plan pressed');
  }, []);

  const handleBackToCurrentWeek = useCallback(() => {
    const today = new Date();
    setSelectedDate(today);
    setIsViewingLockedWeek(false);
    setLockedWeekInfo(null);

    if (plan && userWorkoutDays.length > 0) {
      handleCalendarDateSelect(today, null, false);
    }
  }, [
    setSelectedDate,
    setIsViewingLockedWeek,
    setLockedWeekInfo,
    plan,
    userWorkoutDays,
    handleCalendarDateSelect,
  ]);

  const handlePausedWorkoutResumeAction = useCallback(async () => {
    setShowPausedWorkoutModal(false);
    await handleResumeWorkout();
  }, [setShowPausedWorkoutModal, handleResumeWorkout]);

  const handlePausedWorkoutStartNewAction = useCallback(async () => {
    setShowPausedWorkoutModal(false);
    if (pausedWorkoutInfo.mode === 'redo') {
      await handleRedoWorkout();
    } else {
      await handleStartWorkout();
    }
  }, [setShowPausedWorkoutModal, pausedWorkoutInfo.mode, handleRedoWorkout, handleStartWorkout]);

  // Render exercise item
  const renderExerciseItem = useCallback(
    ({ item, index }: { item: Exercise; index: number }) => {
      const workoutDay = getWorkoutDayByNumber(activeDay);
      const totalExercises = workoutDay?.exercises?.length || 0;

      return (
        <ExerciseItem
          item={item}
          index={index}
          totalExercises={totalExercises}
          hasPausedWorkout={hasPausedWorkout}
          pausedWorkout={pausedWorkout}
          onExerciseNamePress={handleExerciseNamePress}
        />
      );
    },
    [getWorkoutDayByNumber, activeDay, hasPausedWorkout, pausedWorkout, handleExerciseNamePress],
  );

  // INITIALIZATION EFFECTS
  useEffect(() => {
    const initializeData = async () => {
      if (!user?.id) return;

      // First fetch user workout days
      const workoutDays = await fetchUserWorkoutDays();
      setUserWorkoutDays(workoutDays);
    };

    initializeData();
  }, [user?.id, fetchUserWorkoutDays, setUserWorkoutDays]);

  // PLAN FETCH EFFECT
  useEffect(() => {
    if (user?.id && userWorkoutDays.length > 0) {
      fetchActivePlan();
    }
  }, [user?.id, userWorkoutDays.length, fetchActivePlan]);

  // CALENDAR UPDATE EFFECT
  useEffect(() => {
    const updateCalendarData = async () => {
      if (!plan?.id || !user?.id || userWorkoutDays.length === 0) return;
      if (isManualDateSelection) return;

      try {
        await updateCalendarWorkoutStatus();
      } catch (err) {
        console.error('Error updating calendar data:', err);
      }
    };

    if (plan?.id && user?.id && userWorkoutDays.length > 0) {
      updateCalendarData();
    }
  }, [
    plan?.id,
    user?.id,
    userWorkoutDays.length,
    activeDay,
    selectedDate,
    isManualDateSelection,
    updateCalendarWorkoutStatus,
  ]);

  // Main render
  if (isLoading) {
    return <LoadingScreen embedded={embedded} />;
  }

  if (!plan) {
    return <NoPlanScreen embedded={embedded} />;
  }

  return (
    <View style={[styles.container, { paddingTop: embedded ? 0 : insets.top }]}>
      {/* Header */}
      {!embedded && (
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.push('/(tabs)')} />
          <Appbar.Content title="My Plan" />
          <IconButton
            icon="crown"
            iconColor="#FFD700"
            size={24}
            onPress={() => console.log('Premium feature')}
          />
        </Appbar.Header>
      )}

      {/* Fixed Weekly Calendar */}
      <MyPlanCalendar
        plan={plan}
        userWorkoutDays={userWorkoutDays}
        onDateSelect={handleCalendarDateSelect}
        completedWorkoutDays={completedWorkoutDays}
        pausedWorkoutDays={pausedWorkoutDays}
        embedded={embedded}
        initialSelectedDate={selectedDate}
        _cycleProgress={cycleProgress}
      />

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + 150,
            paddingTop: SPACING.xs,
          },
        ]}
      >
        {/* Workout Content - Show different UI based on completion status */}
        <WorkoutContent
          isDateSelectionLoading={isDateSelectionLoading}
          isViewingLockedWeek={isViewingLockedWeek}
          lockedWeekInfo={lockedWeekInfo}
          activeDay={activeDay}
          getWorkoutDayByNumber={getWorkoutDayByNumber}
          isWorkoutCompleted={isWorkoutCompleted}
          completedWorkoutData={completedWorkoutData}
          selectedDate={selectedDate}
          plan={plan}
          cycleProgress={cycleProgress}
          renderExerciseItem={renderExerciseItem}
          onBackToCurrentWeek={handleBackToCurrentWeek}
          onRedoWorkout={handleRedoWorkout}
          onPlanOverviewPress={handlePlanOverviewPress}
          onEditPlanPress={handleEditPlanPress}
          hasPausedWorkout={hasPausedWorkout}
          pausedWorkout={pausedWorkout}
        />
      </ScrollView>

      {/* Start/Resume/Redo Workout FAB */}
      <ActionButton
        activeDay={activeDay}
        getWorkoutDayByNumber={getWorkoutDayByNumber}
        isViewingLockedWeek={isViewingLockedWeek}
        isWorkoutCompleted={isWorkoutCompleted}
        hasPausedWorkout={hasPausedWorkout}
        pausedWorkout={pausedWorkout}
        onStartWorkout={handleStartWorkout}
        onResumeWorkout={handleResumeWorkout}
        onRedoWorkout={handleRedoWorkout}
      />

      {/* Paused Workout Modal */}
      <PausedWorkoutModal
        visible={showPausedWorkoutModal}
        pausedWorkoutInfo={pausedWorkoutInfo}
        onClose={() => setShowPausedWorkoutModal(false)}
        onResumeWorkout={handlePausedWorkoutResumeAction}
        onStartNewWorkout={handlePausedWorkoutStartNewAction}
      />

      {/* Exercise Details Modal */}
      {selectedExercise && (
        <ExerciseDetailsModal
          visible={exerciseDetailsModalVisible}
          onClose={handleExerciseDetailsModalClose}
          exerciseId={selectedExercise.exercise_id || selectedExercise.id}
          exerciseName={selectedExercise.name}
          exerciseImage={selectedExercise.image_url}
          primary_muscles={selectedExercise.primary_muscles}
          secondary_muscles={selectedExercise.secondary_muscles}
        />
      )}

      {/* Plan Overview Modal */}
      {plan && cycleProgress && (
        <PlanOverviewModal
          visible={planOverviewModalVisible}
          onClose={handlePlanOverviewModalClose}
          planTitle={plan.title}
          planSubtitle={plan.subtitle}
          weeks={[
            {
              number: 1,
              name: 'Adaptation',
              color: '#4CAF50',
              description: 'Building foundation and proper form',
              days: plan.workoutDays.length,
            },
            {
              number: 2,
              name: 'Accumulation',
              color: '#2196F3',
              description: 'Increasing training volume and intensity',
              days: plan.workoutDays.length,
            },
            {
              number: 3,
              name: 'Intensification',
              color: '#FF9800',
              description: 'Peak intensity and strength focus',
              days: plan.workoutDays.length,
            },
            {
              number: 4,
              name: 'Realization',
              color: '#9C27B0',
              description: 'Testing limits and achieving PRs',
              days: plan.workoutDays.length,
            },
            {
              number: 5,
              name: 'Recovery',
              color: '#607D8B',
              description: 'Active recovery and preparation for next cycle',
              days: plan.workoutDays.length,
            },
          ]}
          currentWeek={cycleProgress.currentWeek}
          activePlanId={plan.id}
          planWorkoutFrequency={plan.workoutDays.length}
        />
      )}
    </View>
  );
};

export default MyPlanScreen;
