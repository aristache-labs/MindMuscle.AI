import { useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, FlatList, ScrollView, View } from 'react-native';
import { Appbar, Button, FAB, IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ExerciseDetailsModal from '../../../components/ExerciseDetailsModal';
import MyPlanCalendar from '../../../components/myplanCalendar';
import PlanOverviewModal from '../../../components/PlanOverviewModal';
import { COLORS, SPACING } from '../../../constants/theme';
import { SentryDataCollection, SentryLogger } from '../../../services/sentry';
import workoutPlanService from '../../../services/workoutPlanService';
import { useAuth } from '../../../store/AuthContext';
import {
  CompletedWorkoutView,
  DateSelectionLoadingComponent,
  ExerciseItem,
  LockedWeekComponent,
  PausedWorkoutModal,
  RestDayComponent,
  WorkoutHeader,
  WorkoutStatsRow,
} from '../components';
import NoPlanView from '../components/NoPlanView';
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
import supabase from '../../../services/supabase';

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

  // Sentry initialization for My Plan screen
  useEffect(() => {
    try {
      // Log my plan screen access
      SentryLogger.info('My Plan screen accessed', {
        user_id: user?.id,
        embedded_mode: embedded,
        timestamp: new Date().toISOString(),
      });

      // Add breadcrumb for screen navigation
      SentryDataCollection.addBreadcrumb({
        message: 'User navigated to My Plan screen',
        category: 'navigation',
        level: 'info',
        data: {
          screen: 'my-plan',
          embedded: embedded,
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

      // Set context for my plan analytics
      SentryDataCollection.setContext('my_plan_screen', {
        embedded_mode: embedded,
        feature_type: 'plan_management',
        user_has_plan: false, // Will be updated when plan data loads
      });
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'my_plan_screen_initialization',
        user_id: user?.id,
        embedded,
      });
    }
  }, [user, embedded]);

  // Use the plan state hook
  const {
    isLoading,
    plan,
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
  const {
    handleStartWorkout: originalHandleStartWorkout,
    handleResumeWorkout: originalHandleResumeWorkout,
    handleRedoWorkout: originalHandleRedoWorkout,
  } = useWorkoutActions({
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

  // Wrap workout actions with Sentry tracking
  const handleStartWorkout = useCallback(async () => {
    try {
      SentryLogger.info('User started workout from My Plan', {
        user_id: user?.id,
        plan_id: plan?.id,
        plan_title: plan?.title,
        workout_day: activeDay,
        selected_date: selectedDate?.toISOString(),
        action: 'start_workout',
      });

      SentryDataCollection.addBreadcrumb({
        message: 'User started workout from My Plan',
        category: 'user-action',
        level: 'info',
        data: {
          plan_id: plan?.id,
          workout_day: activeDay,
          action_type: 'start_workout',
        },
      });

      await originalHandleStartWorkout();
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'my_plan_start_workout',
        user_id: user?.id,
        plan_id: plan?.id,
        workout_day: activeDay,
      });
      throw error;
    }
  }, [originalHandleStartWorkout, user, plan, activeDay, selectedDate]);

  const handleResumeWorkout = useCallback(async () => {
    try {
      SentryLogger.info('User resumed paused workout from My Plan', {
        user_id: user?.id,
        plan_id: plan?.id,
        plan_title: plan?.title,
        workout_day: activeDay,
        paused_workout_day: pausedWorkout?.workoutDay,
        action: 'resume_workout',
      });

      SentryDataCollection.addBreadcrumb({
        message: 'User resumed paused workout',
        category: 'user-action',
        level: 'info',
        data: {
          plan_id: plan?.id,
          workout_day: activeDay,
          paused_workout_day: pausedWorkout?.workoutDay,
          action_type: 'resume_workout',
        },
      });

      await originalHandleResumeWorkout();
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'my_plan_resume_workout',
        user_id: user?.id,
        plan_id: plan?.id,
        workout_day: activeDay,
      });
      throw error;
    }
  }, [originalHandleResumeWorkout, user, plan, activeDay, pausedWorkout]);

  const handleRedoWorkout = useCallback(async () => {
    try {
      SentryLogger.info('User redoing completed workout from My Plan', {
        user_id: user?.id,
        plan_id: plan?.id,
        plan_title: plan?.title,
        workout_day: activeDay,
        selected_date: selectedDate?.toISOString(),
        action: 'redo_workout',
      });

      SentryDataCollection.addBreadcrumb({
        message: 'User redoing completed workout',
        category: 'user-action',
        level: 'info',
        data: {
          plan_id: plan?.id,
          workout_day: activeDay,
          action_type: 'redo_workout',
        },
      });

      await originalHandleRedoWorkout();
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'my_plan_redo_workout',
        user_id: user?.id,
        plan_id: plan?.id,
        workout_day: activeDay,
      });
      throw error;
    }
  }, [originalHandleRedoWorkout, user, plan, activeDay, selectedDate]);

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

  const handleBackToCurrentWeek = useCallback(async () => {
    if (!plan || !cycleProgress || userWorkoutDays.length === 0 || !user?.id) {
      return;
    }

    try {
      setIsViewingLockedWeek(false);
      setLockedWeekInfo(null);

      // Get the calendar dates with cycle week information
      const markedDatesObj = workoutPlanService.setupCalendarDatesProgressive(
        plan.start_date,
        plan.workoutDays.length,
        userWorkoutDays,
        { primary: '#7B69EE' },
      );

      // Get completed workouts for this plan
      const { data: completedWorkouts, error: completedError } = (await supabase
        .from('user_workout_history')
        .select('workout_day, completed_at, cycle_week')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id)) as {
        data: Array<{
          workout_day: number;
          completed_at: string;
          cycle_week: number;
        }> | null;
        error: Error | null;
      };

      if (completedError) {
        console.error('Error fetching completed workouts:', completedError);
        // Fallback to today's date
        const today = new Date();
        setSelectedDate(today);
        handleCalendarDateSelect(today, null, false);
        return;
      }

      // Get all workout dates sorted by date
      const allWorkouts = Object.entries(markedDatesObj)
        .map(([dateStr, dateInfo]) => ({
          date: new Date(dateStr),
          dateStr,
          workoutDayIndex: dateInfo.workoutDayIndex,
          cycleWeek: dateInfo.cycleWeek,
          weekName: dateInfo.weekName,
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      // Find the first unfinished workout from the beginning
      let targetWorkout: (typeof allWorkouts)[0] | null = null;

      for (const workout of allWorkouts) {
        // Check if this workout is completed
        const isCompleted = completedWorkouts?.some(
          (completed) =>
            completed.workout_day === workout.workoutDayIndex &&
            completed.cycle_week === workout.cycleWeek,
        );

        if (!isCompleted) {
          // Found first unfinished workout
          targetWorkout = workout;
          break;
        }
      }

      if (targetWorkout) {
        // Navigate to the first unfinished workout
        setSelectedDate(targetWorkout.date);
        await handleCalendarDateSelect(targetWorkout.date, targetWorkout.workoutDayIndex, true);
      } else {
        // All workouts are completed, go to the last workout
        if (allWorkouts.length > 0) {
          const lastWorkout = allWorkouts[allWorkouts.length - 1];
          setSelectedDate(lastWorkout.date);
          await handleCalendarDateSelect(lastWorkout.date, lastWorkout.workoutDayIndex, true);
        } else {
          // No workouts found, fallback to today
          const today = new Date();
          setSelectedDate(today);
          handleCalendarDateSelect(today, null, false);
        }
      }
    } catch (error) {
      console.error('Error navigating back to current week:', error);
      // Fallback to today's date
      const today = new Date();
      setSelectedDate(today);
      handleCalendarDateSelect(today, null, false);
    }
  }, [
    plan,
    cycleProgress,
    userWorkoutDays,
    user?.id,
    setSelectedDate,
    setIsViewingLockedWeek,
    setLockedWeekInfo,
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

  // Sentry tracking for plan data loading
  useEffect(() => {
    if (plan) {
      try {
        // Log successful plan loading
        SentryLogger.info('User plan loaded successfully', {
          user_id: user?.id,
          plan_id: plan.id,
          plan_title: plan.title,
          plan_subtitle: plan.subtitle,
          workout_days_count: plan.workoutDays?.length || 0,
          cycle_progress: cycleProgress
            ? {
                current_week: cycleProgress.currentWeek,
                week_name: cycleProgress.weekName,
                completed_workouts: cycleProgress.completedWorkouts,
                total_workouts_in_cycle: cycleProgress.totalWorkoutsInCycle,
                progress_percentage: cycleProgress.progressPercentage,
              }
            : null,
        });

        // Update context with plan information
        SentryDataCollection.setContext('my_plan_screen', {
          embedded_mode: embedded,
          feature_type: 'plan_management',
          user_has_plan: true,
          plan_id: plan.id,
          plan_title: plan.title,
          workout_days_count: plan.workoutDays?.length || 0,
        });

        // Set plan-related tags
        SentryDataCollection.setTag('user_active_plan', plan.id);
        SentryDataCollection.setTag('plan_type', plan.category_name || 'unknown');

        // Add breadcrumb for plan loading
        SentryDataCollection.addBreadcrumb({
          message: `User plan loaded: ${plan.title}`,
          category: 'data',
          level: 'info',
          data: {
            plan_id: plan.id,
            plan_title: plan.title,
            workout_days: plan.workoutDays?.length || 0,
          },
        });
      } catch (error) {
        SentryDataCollection.captureException(error as Error, {
          context: 'plan_data_tracking',
          user_id: user?.id,
          plan_id: plan?.id,
        });
      }
    }
  }, [plan, cycleProgress, user, embedded]);

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
