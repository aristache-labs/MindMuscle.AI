import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Appbar, Button, Divider, IconButton, FAB } from 'react-native-paper';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useAuth } from '../store/AuthContext';
import supabase from '../services/supabase';
import OptimizedImage from '../components/OptimizedImage';
import { format, addDays, isSameDay, startOfWeek, getDay } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth } = Dimensions.get('window');

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps_range: string;
  image_url?: string;
  primary_muscles?: string[];
  exercise_name?: string;
  workout_day: number;
  exercise_id?: string;
}

interface WorkoutDay {
  day: number;
  exercises: Exercise[];
  total_exercises: number;
  estimated_duration: number;
  total_calories: number;
}

interface Plan {
  id: string;
  title: string;
  difficulty_level?: string;
  subtitle?: string;
  category_name?: string;
  workoutDays: WorkoutDay[];
  current_day: number;
  start_date: string;
}

interface MyPlanScreenProps {
  embedded?: boolean;
}

export default function MyPlanScreen({ embedded = false }: MyPlanScreenProps) {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Calendar state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [markedDates, setMarkedDates] = useState<any>({});
  const [activeDay, setActiveDay] = useState<number | null>(null);
  
  // Use a simple date array for the weekly calendar view
  const [weekDays, setWeekDays] = useState<Date[]>([]);
  
  // Fetch the user's active plan
  const fetchActivePlan = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get the user's active plan
      const { data: activePlanData, error: activePlanError } = await supabase
        .from('user_active_plans')
        .select(`
          *,
          workout_plans(
            id, 
            title, 
            difficulty_level, 
            workout_subcategories!workout_plans_subcategory_id_fkey(
              subtitle,
              title
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();
      
      if (activePlanError) {
        if (activePlanError.code === 'PGRST116') {
          // No active plan found
          setPlan(null);
          setIsLoading(false);
          return;
        }
        throw activePlanError;
      }
      
      if (!activePlanData) {
        setPlan(null);
        setIsLoading(false);
        return;
      }
      
      // Fetch the exercises for this plan
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('workout_plan_exercises')
        .select(`
          id,
          sets,
          reps_range,
          exercise_id,
          workout_day,
          exercise_name,
          exercises:exercise_id (
            id,
            name,
            image_url,
            primary_muscles
          )
        `)
        .eq('plan_id', activePlanData.plan_id)
        .order('workout_day', { ascending: true })
        .order('order', { ascending: true });
        
      if (exercisesError) throw exercisesError;
      
      // Group exercises by workout day
      const exercisesByDay: { [key: number]: Exercise[] } = {};
      exercisesData.forEach((item: any) => {
        const day = item.workout_day || 0;
        if (!exercisesByDay[day]) {
          exercisesByDay[day] = [];
        }
        
        exercisesByDay[day].push({
          id: item.id,
          name: item.exercise_name || item.exercises?.name,
          sets: item.sets,
          reps_range: item.reps_range,
          image_url: item.exercises?.image_url,
          primary_muscles: item.exercises?.primary_muscles,
          workout_day: day,
          exercise_id: item.exercises?.id
        });
      });
      
      // Convert to array of workout days with per-day statistics
      const workoutDays = Object.keys(exercisesByDay).map(dayKey => {
        const dayNum = parseInt(dayKey, 10);
        const dayExercises = exercisesByDay[dayNum];
        
        // Calculate per-day statistics based on actual exercise data
        const exerciseCount = dayExercises.length;
        
        // Calculate estimated duration based on sets, reps, and rest time
        let totalDuration = 0;
        dayExercises.forEach(exercise => {
          const sets = exercise.sets || 3;
          const repRange = exercise.reps_range || '8-12';
          
          // Parse rep range to get average reps (e.g., "8-12" -> 10)
          let avgReps = 10; // Default
          if (repRange.includes('-')) {
            const [min, max] = repRange.split('-').map(num => parseInt(num, 10));
            if (!isNaN(min) && !isNaN(max)) {
              avgReps = Math.floor((min + max) / 2);
            }
          } else if (!isNaN(parseInt(repRange, 10))) {
            avgReps = parseInt(repRange, 10);
          }
          
          // Estimate time per rep at ~2-3 seconds
          const timePerSet = avgReps * 2.5; // seconds
          
          // Rest time between sets (typically 60-90 seconds)
          const restTime = 75; // seconds
          
          // Total time for this exercise (all sets + rest between sets)
          const exerciseTime = (sets * timePerSet) + (restTime * (sets - 1));
          
          // Add to total duration (convert to minutes)
          totalDuration += exerciseTime / 60;
        });
        
        // Round up to nearest minute
        const estimatedDuration = Math.ceil(totalDuration);
        
        // Calculate calories based on duration with a more realistic formula
        // Moderate exercise burns approximately 7-10 calories per minute depending on intensity
        const calorieRate = 8.5; // calories per minute for moderate-high intensity workout
        const estimatedCalories = Math.round(estimatedDuration * calorieRate);
        
        return {
          day: dayNum,
          exercises: dayExercises,
          total_exercises: exerciseCount,
          estimated_duration: estimatedDuration,
          total_calories: estimatedCalories
        };
      }).sort((a, b) => a.day - b.day);
      
      // Format the data
      const formattedPlan: Plan = {
        id: activePlanData.workout_plans.id,
        title: activePlanData.workout_plans.title,
        difficulty_level: activePlanData.workout_plans.difficulty_level,
        subtitle: activePlanData.workout_plans.workout_subcategories?.subtitle || "Total Body Circuit",
        category_name: activePlanData.workout_plans.workout_subcategories?.title,
        workoutDays: workoutDays,
        current_day: activePlanData.current_day,
        start_date: activePlanData.start_date
      };
      
      setPlan(formattedPlan);
      
      // Setup initial active day
      const currentDay = activePlanData.current_day % workoutDays.length;
      setActiveDay(currentDay);
      
      // Setup calendar marked dates
      setupCalendarDates(activePlanData.start_date, workoutDays.length);
      
    } catch (err: any) {
      console.error('Error fetching active plan:', err);
      setError('Failed to load your plan.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);
  
  // Setup calendar marked dates based on workout frequency
  const setupCalendarDates = (startDate: string, totalDays: number) => {
    const start = new Date(startDate);
    const markedDatesObj: any = {};
    
    // Mark today's date
    const today = format(new Date(), 'yyyy-MM-dd');
    markedDatesObj[today] = {
      selected: true,
      selectedColor: COLORS.primary,
    };
    
    // Mark workout days
    for (let i = 0; i < totalDays; i++) {
      const date = format(addDays(start, i), 'yyyy-MM-dd');
      markedDatesObj[date] = {
        ...markedDatesObj[date],
        marked: true,
        dotColor: COLORS.primary
      };
      
      // If this is today, merge with today's style
      if (date === today) {
        markedDatesObj[date] = {
          ...markedDatesObj[date],
          selected: true,
          selectedColor: COLORS.primary,
        };
      }
    }
    
    setMarkedDates(markedDatesObj);
  };
  
  // Handle date selection on calendar
  const handleDateSelect = (day: any) => {
    const selectedDate = new Date(day.dateString);
    setSelectedDate(selectedDate);
    
    // Find which workout day this corresponds to
    if (plan && plan.start_date) {
      const startDate = new Date(plan.start_date);
      const diffDays = Math.floor((selectedDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays >= 0 && diffDays < plan.workoutDays.length) {
        setActiveDay(diffDays);
      } else {
        setActiveDay(null);
      }
    }
  };
  
  const handleStartWorkout = () => {
    // TODO: Implement starting the workout
    console.log('Starting workout for day:', activeDay);
  };
  
  // Setup weekly calendar days
  const setupWeeklyCalendar = useCallback(() => {
    const today = new Date();
    // Get the start of the current week (Monday)
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
    
    // Create array of 7 days starting from Monday
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(startOfCurrentWeek, i));
    }
    setWeekDays(days);
    
    // Set the active day based on the current day of the week
    const currentDayOfWeek = getDay(today);
    // Convert Sunday (0) to position 6, otherwise subtract 1 to get 0-indexed position
    const adjustedDayIndex = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
    setSelectedDate(today);
    
    // If we have a plan, find which workout day corresponds to today
    if (plan) {
      handleDateSelect({ dateString: format(today, 'yyyy-MM-dd') });
    }
  }, [plan]);
  
  // Function to get day abbreviation
  const getDayAbbreviation = (date: Date) => {
    const dayOfWeek = getDay(date);
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    return days[dayOfWeek];
  };
  
  // Function to check if a date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return isSameDay(date, today);
  };
  
  // Function to check if date is selected
  const isSelected = (date: Date) => {
    return isSameDay(date, selectedDate);
  };
  
  // Function to handle date selection from weekly calendar
  const handleWeekDayPress = (date: Date) => {
    setSelectedDate(date);
    handleDateSelect({ dateString: format(date, 'yyyy-MM-dd') });
  };
  
  // Setup weekly calendar on initial load and when plan changes
  useEffect(() => {
    if (plan) {
      setupWeeklyCalendar();
    }
  }, [plan, setupWeeklyCalendar]);
  
  // Call fetchActivePlan on component mount
  useEffect(() => {
    fetchActivePlan();
  }, [fetchActivePlan]);
  
  const renderExerciseItem = ({ item }: { item: Exercise }) => (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseLeftContent}>
        <OptimizedImage
          source={item.image_url ? { uri: item.image_url } : require('../../assets/exercises/placeholder.jpg')}
          style={styles.exerciseImage}
          fallback={require('../../assets/exercises/placeholder.jpg')}
          resizeMode="cover"
          cachePolicy="immutable"
          showLoader={false}
        />
        <View style={styles.exerciseDetails}>
          <Text style={styles.exerciseName}>{item.name}</Text>
          <Text style={styles.exerciseSets}>{item.sets} sets x {item.reps_range} reps</Text>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        {!embedded && (
          <Appbar.Header>
            <Appbar.BackAction onPress={() => router.back()} />
            <Appbar.Content title="My Plan" />
          </Appbar.Header>
        )}
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.container}>
        {!embedded && (
          <Appbar.Header>
            <Appbar.BackAction onPress={() => router.back()} />
            <Appbar.Content title="My Plan" />
          </Appbar.Header>
        )}
        <View style={styles.noPlanContainer}>
          <Text style={styles.noPlanTitle}>No Active Plan</Text>
          <Text style={styles.noPlanText}>
            You currently don't have an active workout plan. Visit the Plans section to choose a plan.
          </Text>
          <Button 
            mode="contained" 
            style={styles.browseButton}
            onPress={() => router.push('/discover')}
          >
            BROWSE PLANS
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: embedded ? 0 : insets.top }]}>
      {!embedded && (
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="My Plan" />
          <IconButton
            icon="crown"
            iconColor="#FFD700"
            size={24}
            onPress={() => console.log('Premium feature')}
          />
        </Appbar.Header>
      )}
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[
          styles.scrollContent,
          { 
            paddingBottom: insets.bottom + 100, // Include bottom insets for FAB spacing
            paddingTop: embedded ? SPACING.xxl * 2.5 : SPACING.xl // Increased padding in both modes
          }
        ]}
      >
        {/* Weekly Calendar */}
        <View style={[
          styles.weeklyCalendarContainer,
          embedded && { marginTop: SPACING.md } // Additional margin when embedded in tabs
        ]}>
          <View style={styles.weekDaysRow}>
            {weekDays.map((day, index) => (
              <TouchableOpacity 
                key={index} 
                style={[
                  styles.weekDay, 
                  isSelected(day) && styles.selectedWeekDay
                ]}
                onPress={() => handleWeekDayPress(day)}
              >
                <Text style={[
                  styles.weekDayText, 
                  isSelected(day) && styles.selectedWeekDayText
                ]}>
                  {getDayAbbreviation(day)}
                </Text>
                <Text style={[
                  styles.weekDayNumber, 
                  isSelected(day) && styles.selectedWeekDayText
                ]}>
                  {format(day, 'd')}
                </Text>
                {/* Add a dot indicator for workout days */}
                {markedDates[format(day, 'yyyy-MM-dd')]?.marked && (
                  <View style={[
                    styles.dayIndicator,
                    isSelected(day) && styles.selectedDayIndicator
                  ]} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        {/* Today's Workout Header */}
        {activeDay !== null && activeDay < plan.workoutDays.length ? (
          <>
            <View style={styles.todaysWorkoutHeader}>
              <Text style={styles.todaysWorkoutTitle}>TODAY'S WORKOUT</Text>
              <Text style={styles.workoutName}>{plan.subtitle || "Unknown"}</Text>
            </View>
            
            {/* Workout Stats and Exercises Container */}
            <View style={styles.workoutContainer}>
              {/* Workout Stats */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <IconButton icon="flash" size={16} iconColor={COLORS.primary} style={styles.statIcon} />
                  <Text style={styles.statLabel}>{plan.workoutDays[activeDay].total_exercises} Exercises</Text>
                </View>
                <View style={styles.statItem}>
                  <IconButton icon="clock-outline" size={16} iconColor={COLORS.primary} style={styles.statIcon} />
                  <Text style={styles.statLabel}>{plan.workoutDays[activeDay].estimated_duration} Min</Text>
                </View>
                <View style={styles.statItem}>
                  <IconButton icon="fire" size={16} iconColor={COLORS.primary} style={styles.statIcon} />
                  <Text style={styles.statLabel}>{plan.workoutDays[activeDay].total_calories} Cal</Text>
                </View>
              </View>
              
              {/* Exercise List */}
              <View style={styles.exercisesContainer}>
                <FlatList
                  data={plan.workoutDays[activeDay].exercises}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item, index }) => (
                    <View style={[
                      styles.exerciseCard,
                      index === plan.workoutDays[activeDay].exercises.length - 1 && { borderBottomWidth: 0 }
                    ]}>
                      <View style={styles.exerciseLeftContent}>
                        <OptimizedImage
                          source={item.image_url ? { uri: item.image_url } : require('../../assets/exercises/placeholder.jpg')}
                          style={styles.exerciseImage}
                          fallback={require('../../assets/exercises/placeholder.jpg')}
                          resizeMode="cover"
                          cachePolicy="immutable"
                          showLoader={false}
                        />
                        <View style={styles.exerciseDetails}>
                          <Text style={styles.exerciseName}>{item.name}</Text>
                          <Text style={styles.exerciseSets}>{item.sets} sets × {item.reps_range} reps</Text>
                        </View>
                      </View>
                      {/* Muscle group tag */}
                      {item.primary_muscles && item.primary_muscles.length > 0 && (
                        <View style={[
                          styles.muscleTag, 
                          { backgroundColor: getMuscleTagColor(item.primary_muscles[0]) }
                        ]}>
                          <Text style={styles.muscleTagText}>
                            {getMuscleTagName(item.primary_muscles[0])}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  scrollEnabled={false}
                />
              </View>
            </View>
          </>
        ) : (
          <View style={styles.noWorkoutContainer}>
            <Text style={styles.noWorkoutText}>
              No workout scheduled for this day.
            </Text>
          </View>
        )}
      </ScrollView>
      
      {/* Start Workout FAB */}
      {activeDay !== null && activeDay < plan.workoutDays.length && (
        <FAB
          style={styles.fab}
          icon="play"
          label="START WORKOUT"
          onPress={handleStartWorkout}
          color={COLORS.background}
        />
      )}
    </View>
  );
}

// Helper function to get muscle tag color
const getMuscleTagColor = (muscle: string) => {
  const colors: { [key: string]: string } = {
    chest: '#00CCFF',
    back: '#FF6666',
    biceps: '#FF66CC',
    triceps: '#CC99FF',
    shoulders: '#99CCFF',
    legs: '#FFCC66',
    glutes: '#FFCC66',
    abs: '#66FF99',
    default: '#AAAAAA'
  };
  
  const key = muscle.toLowerCase();
  return colors[key] || colors.default;
};

// Helper function to get muscle tag display name
const getMuscleTagName = (muscle: string) => {
  const muscleNames: { [key: string]: string } = {
    chest: 'Chest',
    back: 'Back',
    biceps: 'Biceps',
    triceps: 'Triceps',
    shoulders: 'Shoulders',
    legs: 'Legs',
    quads: 'Legs',
    hamstrings: 'Legs',
    calves: 'Legs',
    glutes: 'Glutes',
    abs: 'Abs',
    core: 'Abs'
  };
  
  const key = muscle.toLowerCase();
  return muscleNames[key] || muscle;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPlanContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  noPlanTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  noPlanText: {
    fontSize: 16,
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  browseButton: {
    marginTop: SPACING.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Space for FAB
  },
  weeklyCalendarContainer: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekDay: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 68,
    borderRadius: 25,
    paddingVertical: SPACING.sm,
  },
  selectedWeekDay: {
    backgroundColor: COLORS.primary,
    elevation: 5,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 4,
  },
  weekDayNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  selectedWeekDayText: {
    color: COLORS.text,
  },
  dayIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 4,
  },
  selectedDayIndicator: {
    backgroundColor: COLORS.text,
  },
  workoutContainer: {
    backgroundColor: 'rgba(30, 30, 40, 0.6)',
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  todaysWorkoutHeader: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  todaysWorkoutTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  workoutName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
  },
  statIcon: {
    margin: 0,
    padding: 0,
  },
  statLabel: {
    color: COLORS.text,
    fontSize: 14,
  },
  exercisesContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  exerciseLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  exerciseImage: {
    width: 70,
    height: 70,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.md,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  exerciseDetails: {
    flex: 1,
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  exerciseSets: {
    color: COLORS.secondary,
    fontSize: 14,
  },
  muscleTag: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: SPACING.xs,
    minWidth: 65,
    alignItems: 'center',
  },
  muscleTagText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    left: 0,
    alignSelf: 'center',
    backgroundColor: '#7B69EE',
    elevation: 8,
    borderRadius: 30,
  },
  noWorkoutContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  noWorkoutText: {
    fontSize: 16,
    color: COLORS.secondary,
    textAlign: 'center',
  },
}); 