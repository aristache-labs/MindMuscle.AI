import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator, Text, Alert } from 'react-native';
import { Button, IconButton, Divider } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import supabase from '../services/supabase';
import { useAuth } from '../store/AuthContext';

export default function WorkoutSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  const sessionId = params.sessionId as string;
  const planId = params.planId as string;
  const planName = params.planName as string || 'Workout';
  
  const [isLoading, setIsLoading] = useState(true);
  const [exercises, setExercises] = useState<any[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [sessionData, setSessionData] = useState<any>(null);
  const [timerActive, setTimerActive] = useState(false);
  const [restTime, setRestTime] = useState(60); // Default rest time in seconds
  const [countdown, setCountdown] = useState(0);

  // Fetch session data and exercises
  useEffect(() => {
    async function fetchSessionData() {
      if (!sessionId || !user) return;
      
      try {
        setIsLoading(true);
        
        // Fetch session data
        const { data: session, error: sessionError } = await supabase
          .from('workout_sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('user_id', user.id)
          .single();
          
        if (sessionError) {
          console.error('Error fetching session:', sessionError);
          Alert.alert('Error', 'Failed to load workout session');
          router.back();
          return;
        }
        
        setSessionData(session);
        
        // Fetch exercises for this session's plan
        const { data: exercisesData, error: exercisesError } = await supabase
          .from('user_active_plan_exercises')
          .select(`
            *,
            exercises(*)
          `)
          .eq('active_plan_id', planId)
          .order('order_position', { ascending: true });
          
        if (exercisesError) {
          console.error('Error fetching exercises:', exercisesError);
          Alert.alert('Error', 'Failed to load exercises');
        } else if (exercisesData) {
          // Map and transform exercise data
          const formattedExercises = exercisesData.map(ex => {
            const exerciseDetails = ex.exercises || {};
            return {
              ...ex,
              name: ex.name || exerciseDetails.name || 'Unknown Exercise',
              muscle_group: exerciseDetails.muscle_group || 'General',
              primary_muscles: exerciseDetails.primary_muscles || [],
              weight: ex.weight || '',
              completed_sets: 0,
            };
          });
          
          setExercises(formattedExercises);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error in fetchSessionData:', error);
        setIsLoading(false);
        Alert.alert('Error', 'Failed to load workout session data');
      }
    }
    
    fetchSessionData();
  }, [sessionId, user, planId]);

  const handleEndSession = async () => {
    try {
      if (!sessionId || !user) return;
      
      // Update session end time
      const { error } = await supabase
        .from('workout_sessions')
        .update({ 
          ended_at: new Date().toISOString(),
          status: 'completed'
        })
        .eq('id', sessionId);
        
      if (error) {
        console.error('Error ending session:', error);
        Alert.alert('Error', 'Failed to end workout session');
        return;
      }
      
      // Navigate back to My Plan with completion status (using tabs navigation)
      router.push({
        pathname: "/index",
        params: { workoutCompleted: 'true' }
      });
    } catch (error) {
      console.error('Error in handleEndSession:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };
  
  const handleCompletedSet = (exerciseIndex: number) => {
    // Update the completed sets for the current exercise
    const updatedExercises = [...exercises];
    if (updatedExercises[exerciseIndex].completed_sets < updatedExercises[exerciseIndex].sets) {
      updatedExercises[exerciseIndex].completed_sets += 1;
      setExercises(updatedExercises);
      
      // If all sets are completed, move to the next exercise
      if (updatedExercises[exerciseIndex].completed_sets >= updatedExercises[exerciseIndex].sets) {
        if (exerciseIndex < exercises.length - 1) {
          // Start rest timer before moving to next exercise
          startRestTimer(updatedExercises[exerciseIndex].rest_time || 60);
        } else {
          // This was the last exercise - ask if they want to complete the workout
          Alert.alert(
            'Workout Complete',
            'Great job! You completed all exercises. End the workout?',
            [
              {
                text: 'Continue',
                style: 'cancel',
              },
              {
                text: 'End Workout',
                onPress: handleEndSession
              }
            ]
          );
        }
      } else {
        // Start rest timer between sets
        startRestTimer(updatedExercises[exerciseIndex].rest_time || 60);
      }
    }
  };
  
  const startRestTimer = (time: number) => {
    setRestTime(time);
    setCountdown(time);
    setTimerActive(true);
    
    // Timer logic would go here
  };
  
  const handleBackPress = () => {
    Alert.alert(
      'End Workout?',
      'Are you sure you want to end this workout? Your progress will be saved.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'End Workout',
          onPress: handleEndSession
        }
      ]
    );
  };

  const getCurrentExercise = () => {
    if (exercises.length === 0 || currentExerciseIndex >= exercises.length) {
      return null;
    }
    return exercises[currentExerciseIndex];
  };

  const currentExercise = getCurrentExercise();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={28}
          onPress={handleBackPress}
          iconColor={COLORS.text}
          style={styles.backButton}
        />
        <Text style={styles.headerTitle}>{planName}</Text>
        <View style={{ width: 40 }} />
      </View>
      <Divider style={styles.divider} />
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading workout...</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
        >
          {timerActive ? (
            <View style={styles.timerContainer}>
              <Text style={styles.timerTitle}>Rest Time</Text>
              <Text style={styles.timerCount}>{countdown}s</Text>
              <Button mode="contained" onPress={() => setTimerActive(false)}>
                SKIP REST
              </Button>
            </View>
          ) : currentExercise ? (
            <View style={styles.exerciseContainer}>
              <Text style={styles.exerciseName}>{currentExercise.name}</Text>
              <Text style={styles.exerciseDetail}>
                {currentExercise.sets} sets × {currentExercise.reps} reps
                {currentExercise.weight ? ` × ${currentExercise.weight}kg` : ''}
              </Text>
              
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                  Set {currentExercise.completed_sets + 1} of {currentExercise.sets}
                </Text>
                <View style={styles.progressBar}>
                  {Array.from({ length: currentExercise.sets }).map((_, index) => (
                    <View 
                      key={`set-${index}`}
                      style={[
                        styles.progressItem,
                        index < currentExercise.completed_sets && styles.progressItemCompleted
                      ]}
                    />
                  ))}
                </View>
              </View>
              
              <Button 
                mode="contained" 
                style={styles.completeButton}
                onPress={() => handleCompletedSet(currentExerciseIndex)}
              >
                COMPLETE SET
              </Button>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No exercises found</Text>
            </View>
          )}
          
          {/* Exercise list preview */}
          <View style={styles.listContainer}>
            <Text style={styles.listTitle}>Workout Progress</Text>
            {exercises.map((exercise, index) => (
              <View 
                key={`exercise-${index}`}
                style={[
                  styles.listItem,
                  index === currentExerciseIndex && styles.listItemActive
                ]}
              >
                <View style={styles.listItemLeft}>
                  <Text style={styles.listItemName}>{exercise.name}</Text>
                  <Text style={styles.listItemDetail}>
                    {exercise.completed_sets}/{exercise.sets} sets completed
                  </Text>
                </View>
                <View style={styles.listItemRight}>
                  {exercise.completed_sets >= exercise.sets ? (
                    <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.success} />
                  ) : index === currentExerciseIndex ? (
                    <MaterialCommunityIcons name="circle-outline" size={24} color={COLORS.primary} />
                  ) : (
                    <MaterialCommunityIcons name="circle-outline" size={24} color={COLORS.secondary} />
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      
      <View style={[styles.footer, { paddingBottom: insets.bottom || SPACING.md }]}>
        <Button 
          mode="contained" 
          style={styles.endButton}
          onPress={handleEndSession}
        >
          END WORKOUT
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    height: 56,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  backButton: {
    margin: 0,
  },
  divider: {
    height: 0.2,
    backgroundColor: COLORS.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.md,
  },
  exerciseContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 0.2,
    borderColor: `${COLORS.primary}80`,
  },
  exerciseName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  exerciseDetail: {
    fontSize: 16,
    color: COLORS.secondary,
    marginBottom: SPACING.md,
  },
  progressContainer: {
    marginBottom: SPACING.md,
  },
  progressText: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  progressBar: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  progressItem: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.surface,
    marginHorizontal: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  progressItemCompleted: {
    backgroundColor: COLORS.primary,
  },
  completeButton: {
    marginTop: SPACING.md,
  },
  timerContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  timerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  timerCount: {
    fontSize: 40,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginVertical: SPACING.md,
  },
  listContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  listItem: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: `${COLORS.primary}40`,
  },
  listItemActive: {
    backgroundColor: `${COLORS.primary}20`,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.xs,
  },
  listItemLeft: {
    flex: 1,
  },
  listItemRight: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemName: {
    fontSize: 16,
    color: COLORS.text,
  },
  listItemDetail: {
    fontSize: 14,
    color: COLORS.secondary,
  },
  footer: {
    padding: SPACING.md,
    borderTopWidth: 0.2,
    borderTopColor: `${COLORS.primary}80`,
  },
  endButton: {
    backgroundColor: COLORS.error,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    color: COLORS.text,
    fontSize: 16,
  },
}); 