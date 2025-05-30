import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { 
  useWorkoutState, 
  useWorkoutTimer, 
  useWorkoutNavigation, 
  useExerciseCustomization,
  useWorkoutCompletion,
  useExerciseSets 
} from '../hooks';

/**
 * Example component demonstrating how to use the new workout hooks together
 * This shows the simplified integration pattern for the main workout session component
 */
export function WorkoutSessionExample() {
  // Example route params (these would come from navigation)
  const planId = 'example-plan';
  const workoutDay = 1;
  const cycleWeek = 1;
  const weekName = 'Adaptation';

  // 1. Initialize main state management hook
  const workoutState = useWorkoutState({
    planId,
    workoutDay,
    cycleWeek,
    weekName
  });

  // 2. Initialize timer functionality
  const timer = useWorkoutTimer();

  // 3. Initialize navigation with workout completion callback
  const navigation = useWorkoutNavigation({
    exercises: workoutState.exercises,
    currentExerciseIndex: workoutState.currentExerciseIndex,
    setCurrentExerciseIndex: workoutState.setCurrentExerciseIndex,
    exerciseSets: workoutState.exerciseSets,
    onWorkoutComplete: () => completion.completeWorkout()
  });

  // 4. Initialize exercise customization
  const customization = useExerciseCustomization({
    exercises: workoutState.exercises,
    setExercises: workoutState.setExercises,
    exerciseSets: workoutState.exerciseSets,
    setExerciseSets: workoutState.setExerciseSets,
    exerciseCustomized: workoutState.exerciseCustomized,
    setExerciseCustomized: workoutState.setExerciseCustomized,
    userEnteredValues: workoutState.userEnteredValues,
    setUserEnteredValues: workoutState.setUserEnteredValues,
    textInputRefreshKey: workoutState.textInputRefreshKey,
    setTextInputRefreshKey: workoutState.setTextInputRefreshKey
  });

  // 5. Initialize workout completion
  const completion = useWorkoutCompletion({
    planId,
    workoutDay,
    cycleWeek,
    weekName,
    exercises: workoutState.exercises,
    exerciseSets: workoutState.exerciseSets,
    totalVolume: workoutState.totalVolume,
    totalReps: workoutState.totalReps,
    workoutDuration: timer.workoutDuration,
    workoutStartTime: timer.workoutStartTime,
    onNavigateHome: () => console.log('Navigate to home')
  });

  // 6. Initialize exercise sets management
  const exerciseSets = useExerciseSets({
    exercises: workoutState.exercises,
    currentExerciseIndex: workoutState.currentExerciseIndex,
    recommendations: workoutState.recommendations,
    lastExerciseValues: workoutState.lastExerciseValues,
    totalVolume: workoutState.totalVolume,
    totalReps: workoutState.totalReps,
    setTotalVolume: workoutState.setTotalVolume,
    setTotalReps: workoutState.setTotalReps,
    exerciseSets: workoutState.exerciseSets,
    setExerciseSets: workoutState.setExerciseSets,
    userEnteredValues: workoutState.userEnteredValues,
    setUserEnteredValues: workoutState.setUserEnteredValues,
    exerciseCustomized: workoutState.exerciseCustomized,
    setExerciseCustomized: workoutState.setExerciseCustomized,
    onStartRestTimer: timer.startRestTimer,
    onCompleteWorkoutWithStateSync: completion.completeWorkoutWithStateSync,
    onMoveToNextExercise: navigation.moveToNextExercise
  });

  // Get current exercise and progress
  const currentExercise = workoutState.getCurrentExercise();
  const progress = navigation.getWorkoutProgress();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Workout Session Example</Text>
      
      {/* Timer Display */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Timer</Text>
        <Text>Workout Duration: {timer.formatTime(timer.workoutDuration)}</Text>
        <Text>Rest Timer: {timer.formatRestTime(timer.restTimer)}</Text>
        <Text>Workout Active: {timer.workoutTimerActive ? 'Yes' : 'No'}</Text>
      </View>

      {/* Progress Display */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Progress</Text>
        <Text>Exercise: {workoutState.currentExerciseIndex + 1} of {workoutState.exercises.length}</Text>
        <Text>Completed: {progress.completed}/{progress.total} ({progress.percentage.toFixed(1)}%)</Text>
        <Text>Total Volume: {workoutState.totalVolume} kg</Text>
        <Text>Total Reps: {workoutState.totalReps}</Text>
      </View>

      {/* Current Exercise */}
      {currentExercise && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Exercise</Text>
          <Text>Name: {currentExercise.name}</Text>
          <Text>Sets: {currentExercise.sets}</Text>
          <Text>Reps: {currentExercise.reps_range}</Text>
          <Text>Customized: {customization.isExerciseCustomized(currentExercise.id) ? 'Yes' : 'No'}</Text>
        </View>
      )}

      {/* Available Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Actions</Text>
        <Text>• Start/Stop Timer: timer.startWorkoutTimer(), timer.stopWorkoutTimer()</Text>
        <Text>• Navigate: navigation.moveToNextExercise(), navigation.moveToPreviousExercise()</Text>
        <Text>• Customize: customization.customizeExercise(id, updates)</Text>
        <Text>• Set Actions: exerciseSets.handleSetComplete(), exerciseSets.handleLogAllSets()</Text>
        <Text>• Complete Workout: completion.completeWorkout()</Text>
      </View>

      {/* Loading State */}
      {workoutState.isLoading && (
        <View style={styles.loading}>
          <Text>Loading workout data...</Text>
        </View>
      )}

      {/* Completion State */}
      {completion.isWorkoutCompleted && completion.completedWorkoutData && (
        <View style={styles.completion}>
          <Text style={styles.sectionTitle}>Workout Completed!</Text>
          <Text>Duration: {completion.completedWorkoutData.duration}</Text>
          <Text>Exercises: {completion.completedWorkoutData.completedExercises}</Text>
          <Text>Calories: {completion.completedWorkoutData.caloriesBurned}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    padding: 12,
    marginVertical: 8,
    borderRadius: 8,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  loading: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  completion: {
    backgroundColor: '#e8f5e8',
    padding: 12,
    borderRadius: 8,
  },
});

export default WorkoutSessionExample; 