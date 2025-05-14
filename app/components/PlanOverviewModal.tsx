import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
  Animated,
  TouchableOpacity,
  Image
} from 'react-native';
import { Text, IconButton, Portal, Provider, Divider } from 'react-native-paper';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import { COLORS, SPACING } from '../constants/theme';
import { useAuth } from '../store/AuthContext';
import supabase from '../services/supabase';
import workoutPlanService, { PlanExercise } from '../services/workoutPlanService';
import OptimizedImage from '../components/OptimizedImage';
import { router } from 'expo-router';
import ExerciseDetailsModal from './ExerciseDetailsModal';

interface Exercise {
  id: string;
  name: string;
  sets?: number;
  reps?: string | number;
  duration?: number;
  image?: string;
  equipment?: string;
  muscle_group?: string;
  kg?: number;
}

interface WeekData {
  number: number;
  name: string;
  color: string;
  description: string;
  days: number;
  isActive?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  modalAnim?: Animated.Value;
  planTitle: string;
  planSubtitle?: string;
  weeks: WeekData[];
  currentWeek: number;
  onWeekPress?: (weekNumber: number) => void;
  onDayPress?: (weekNumber: number, dayNumber: number) => void;
  activePlanId?: string; // ID of the active plan
  planWorkoutFrequency?: number; // Number of workout days per week in the plan
}

export default function PlanOverviewModal({ 
  visible, 
  onClose, 
  planTitle, 
  planSubtitle,
  weeks, 
  currentWeek,
  onWeekPress,
  onDayPress,
  activePlanId,
  planWorkoutFrequency = 3 // Default to 3 days per week if not provided
}: Props) {
  // Generate our own animation value
  const [modalAnim] = useState(() => new Animated.Value(0));
  const [selectedDay, setSelectedDay] = useState<{weekNumber: number, dayNumber: number} | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(false);
  const { user } = useAuth();
  
  // New state for the exercise details modal
  const [exerciseDetailsVisible, setExerciseDetailsVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  
  // Create a local state for weeks to avoid directly mutating props
  const [localWeeks, setLocalWeeks] = useState<WeekData[]>([]);
  
  // Initialize local weeks when weeks prop changes or when modal becomes visible
  useEffect(() => {
    if (visible && weeks && weeks.length > 0) {
      // Create a deep copy of weeks to avoid mutating props
      const updatedWeeks = weeks.map(week => ({
        ...week,
        // Ensure days is at least planWorkoutFrequency
        days: Math.max(week.days || 0, planWorkoutFrequency)
      }));
      
      setLocalWeeks(updatedWeeks);
    }
  }, [weeks, visible, planWorkoutFrequency]);

  // Run animation when visibility changes
  useEffect(() => {
    if (visible) {
      Animated.spring(modalAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      
      // Reset selected day when modal closes
      setSelectedDay(null);
    }
  }, [visible, modalAnim]);
  
  // Calculate translateY based on animation value
  const translateY = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Dimensions.get('window').height, 0],
  });

  // Function to handle exercise press - updated to show modal instead of navigating
  const handleExercisePress = (exercise: Exercise) => {
    console.log('Exercise pressed:', exercise);
    // Set the selected exercise and show the modal
    setSelectedExercise(exercise);
    setExerciseDetailsVisible(true);
    console.log('Modal should be visible now. Selected exercise:', exercise.id);
  };

  // Function to handle day press and fetch exercises
  const handleDayPress = async (weekNumber: number, dayNumber: number) => {
    setSelectedDay({ weekNumber, dayNumber });
    
    if (onDayPress) {
      onDayPress(weekNumber, dayNumber);
    }
    
    // Fetch exercises for the selected day
    if (activePlanId && user) {
      setIsLoadingExercises(true);
      try {
        // Fetch exercises for this active plan (fetch all exercises, filter by day later)
        const { data, error } = await supabase
          .from('user_active_plan_exercises')
          .select(`
            *,
            exercises(*)
          `)
          .eq('active_plan_id', activePlanId)
          .order('order_position', { ascending: true });
            
        if (error) {
          console.error('Error fetching plan exercises:', error);
          setExercises([]);
        } else if (data) {
          // Transform data to match Exercise interface
          const allExercises = data.map((ex, index) => {
            const exerciseDetails = ex.exercises || {};
            
            // Match the same workout day calculation as in my-plan.tsx
            // Based on index % frequency
            const workout_day = index % planWorkoutFrequency;
            
            return {
              id: exerciseDetails.id || ex.id, // Use the actual exercise ID from the exercises table
              name: ex.exercise_name || exerciseDetails.name || 'Unknown Exercise',
              sets: ex.sets || 3,
              reps: ex.reps_range || ex.reps || '8-12',
              equipment: exerciseDetails.equipment || 'None',
              muscle_group: exerciseDetails.muscle_group || 'General',
              image: exerciseDetails.image_url,
              order_position: ex.order_position || 0,
              workout_day: workout_day,
              kg: ex.weight || 0
            };
          });
          
          // Filter exercises by day
          // Day 1 corresponds to workout_day 0, Day 2 to workout_day 1, etc.
          const dayOffset = dayNumber - 1; // Convert 1-based day number to 0-based offset
          const filteredExercises = allExercises.filter(ex => 
            ex.workout_day === dayOffset && 
            ex.name !== 'Chest Barbell, Brench' // Filter out the incorrect exercise
          );
          
          setExercises(filteredExercises);
        }
      } catch (err) {
        console.error('Exception fetching plan exercises:', err);
        setExercises([]);
      } finally {
        setIsLoadingExercises(false);
      }
    }
  };

  // Custom close handler to reset state before closing
  const handleClose = () => {
    setSelectedDay(null);
    onClose();
  };

  // Early return after all hooks have been called
  if (!visible) return null;

  return (
    <Provider>
      <Portal>
        <Modal
          visible={visible && !exerciseDetailsVisible}
          transparent={true}
          animationType="none"
          onRequestClose={handleClose}
          statusBarTranslucent={true}
        >
          <View style={styles.overlay}>
            <Animated.View style={[styles.modalContainer, { transform: [{ translateY }] }]}>
              <View style={styles.container}>
                <View style={styles.topGlowLeft} />
                <View style={styles.topGlowRight} />
                <View style={styles.header}>
                  <Text style={styles.title}>{"PLAN OVERVIEW"}</Text>
                  <IconButton
                    icon="close"
                    iconColor="#fff"
                    size={24}
                    style={styles.closeButton}
                    onPress={handleClose}
                  />
                </View>
                
                {planTitle ? (
                  <Text style={styles.planTitle}>{planTitle}</Text>
                ) : null}
                
                {planSubtitle ? (
                  <Text style={styles.planSubtitle}>{planSubtitle}</Text>
                ) : null}
                
                <GestureHandlerRootView style={styles.gestureRoot}>
                  <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollViewContent}
                    bounces={true}
                    showsVerticalScrollIndicator={false}
                  >
                    {selectedDay ? (
                      // Show exercises for selected day
                      <View style={styles.exercisesContainer}>
                        <View style={styles.exercisesHeader}>
                          <Text style={styles.exercisesTitle}>
                            {`Week ${selectedDay.weekNumber} - Day ${selectedDay.dayNumber}`}
                          </Text>
                          <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => setSelectedDay(null)}
                          >
                            <Text style={styles.backButtonText}>{"Back to Overview"}</Text>
                          </TouchableOpacity>
                        </View>
                        
                        <View style={styles.exercisesList}>
                          {isLoadingExercises ? (
                            <View style={styles.loadingContainer}>
                              <Text style={styles.loadingText}>{"Loading exercises..."}</Text>
                            </View>
                          ) : exercises.length > 0 ? (
                            exercises.map((exercise, index) => {
                              return (
                                <TouchableOpacity
                                  key={`exercise-${exercise.id}-${index}`}
                                  style={styles.exerciseItem}
                                  onPress={() => handleExercisePress(exercise)}
                                  activeOpacity={0.7}
                                >
                                  <View style={styles.exerciseRow}>
                                    <View style={styles.exerciseImageContainer}>
                                      <OptimizedImage
                                        source={exercise.image ? { uri: exercise.image } : require('../../assets/exercises/placeholder.jpg')}
                                        style={styles.exerciseImage}
                                        fallback={require('../../assets/exercises/placeholder.jpg')}
                                      />
                                    </View>
                                    <View style={styles.exerciseContent}>
                                      <Text style={styles.exerciseName}>
                                        {exercise.name}
                                      </Text>
                                      <View style={styles.exerciseDetails}>
                                        {exercise.sets ? (
                                          <Text style={styles.exerciseDetail}>
                                            {`${exercise.sets} sets`}
                                          </Text>
                                        ) : null}
                                        {exercise.reps ? (
                                          <Text style={styles.exerciseDetail}>
                                            {`${exercise.reps} reps`}
                                          </Text>
                                        ) : null}
                                        {exercise.kg && exercise.kg > 0 ? (
                                          <Text style={styles.exerciseDetail}>
                                            {`${exercise.kg} kg`}
                                          </Text>
                                        ) : null}
                                      </View>
                                    </View>
                                  </View>
                                  {index < exercises.length - 1 ? (
                                    <Divider style={styles.exerciseDivider} />
                                  ) : null}
                                </TouchableOpacity>
                              );
                            })
                          ) : (
                            <Text style={styles.noExercisesText}>
                              {"No exercises found for this day."}
                            </Text>
                          )}
                        </View>
                      </View>
                    ) : (
                      // Show timeline view
                      <View style={styles.timeline}>
                        {localWeeks.length > 0 ? <View style={styles.timelineLine} /> : null}
                        
                        {localWeeks.map((week, index) => {
                          return (
                            <View key={`week-${week.number}`} style={styles.weekContainer}>
                              {/* Timeline dot */}
                              <View style={styles.timelineLeft}>
                                <View 
                                  style={[
                                    styles.timelineDot, 
                                    { backgroundColor: week.color },
                                    week.number === currentWeek && styles.activeTimelineDot
                                  ]} 
                                />
                              </View>
                              
                              {/* Week content */}
                              <View 
                                style={[
                                  styles.weekContent,
                                  week.number === currentWeek && styles.activeWeekContent
                                ]}
                              >
                                <View style={styles.weekHeader}>
                                  <View style={[styles.weekIndicator, { backgroundColor: week.color }]} />
                                  <Text style={styles.weekTitle}>{`Week ${week.number} - ${week.name}`}</Text>
                                </View>
                                
                                {week.description ? (
                                  <View style={styles.weekDescription}>
                                    <Text style={styles.descriptionText}>{week.description}</Text>
                                  </View>
                                ) : null}
                                
                                <ScrollView
                                  horizontal
                                  showsHorizontalScrollIndicator={false}
                                  contentContainerStyle={styles.daysScrollContent}
                                >
                                  {Array.from({ length: week.days }).map((_, i) => (
                                    <TouchableOpacity
                                      key={`day-${i+1}`}
                                      style={styles.dayButton}
                                      onPress={() => handleDayPress(week.number, i+1)}
                                    >
                                      <Text style={styles.dayButtonText}>{`Day ${i+1}`}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                    
                    {!selectedDay ? (
                      <Text style={styles.footerText}>
                        {"Once you complete your last workout on this plan we will generate your next plan based on your preferences, so you continue seeing results"}
                      </Text>
                    ) : null}
                  </ScrollView>
                </GestureHandlerRootView>
              </View>
            </Animated.View>
            

          </View>
        </Modal>
        
        {/* Exercise Details Modal - moved outside the main Modal */}
        {selectedExercise && (
          <ExerciseDetailsModal
            visible={exerciseDetailsVisible}
            onClose={() => {
              console.log('Closing exercise details modal');
              setExerciseDetailsVisible(false);
            }}
            exerciseId={selectedExercise.id}
            exerciseName={selectedExercise.name}
            exerciseImage={selectedExercise.image}
          />
        )}
      </Portal>
    </Provider>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    height: SCREEN_HEIGHT,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
    height: '94%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
  },
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 0,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { 
          width: 10, 
          height: 0,
        },
        shadowOpacity: 1,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  topGlowLeft: {
    position: 'absolute',
    top: -0.7,
    left: -0.2,
    width: 13,
    height: 13,
    borderTopLeftRadius: 12,
    backgroundColor: 'transparent',
    borderLeftWidth: 0.9,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 15,
    zIndex: 1,
  },
  topGlowRight: {
    position: 'absolute',
    top: -0.7,
    right: -0.2,
    width: 13,
    height: 13,
    borderTopRightRadius: 12,
    backgroundColor: 'transparent',
    borderRightWidth: 0.9,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 15,
    zIndex: 1,
  },
  gestureRoot: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderBottomWidth: 0.2,
    borderBottomColor: COLORS.primary,
    backgroundColor: COLORS.background,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    right: 8,
    margin: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  planTitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  planSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  timeline: {
    marginTop: 16,
    position: 'relative',
    paddingLeft: 0, // Remove padding to position elements properly
  },
  timelineLine: {
    position: 'absolute',
    width: 1,
    top: 90, // Start exactly at the blue dot
    bottom: 70, // End exactly at the green dot
    left: 30, // Center it through the dots
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 1,
  },
  timelineLineSegment: {
    position: 'absolute',
    width: 1,
    height: 70,
    left: 5.5, // Better center alignment with the dot
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 1,
  },
  weekContainer: {
    flexDirection: 'row',
    marginBottom: 0,
    position: 'relative',
    paddingTop: 10,
  },
  timelineLeft: {
    width: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginLeft: 24, // Position dots over the line
    zIndex: 2,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    marginTop: 0, // Adjusted for better vertical alignment
    zIndex: 2,
  },
  activeTimelineDot: {
    borderWidth: 1.5,
    borderColor: `rgba(255, 255, 255, 0.7)`,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  weekContent: {
    flex: 1,
    backgroundColor: '#242936',
    borderRadius: 12,
    padding: 16,
    marginLeft: 12,
  },
  activeWeekContent: {
    backgroundColor: '#24293E',
    borderWidth: 1,
    borderColor: '#1D6AE5', // Blue border for active week as shown in screenshot
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  weekIndicator: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: 8,
  },
  weekTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  weekDescription: {
    marginBottom: 10,
    marginTop: 2,
  },
  descriptionText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  daysScrollContainer: {
    position: 'relative',
  },
  daysScrollContent: {
    paddingVertical: 4,
    flexDirection: 'row',
  },
  dayButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayButton: {
    backgroundColor: '#333845',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 2,
    minWidth: 70,
    alignItems: 'center',
  },
  scrollIndicator: {
    position: 'absolute',
    right: 0,
    top: '50%',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    transform: [{ translateY: -10 }],
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 3,
  },
  dayButtonText: {
    fontSize: 14,
    color: '#fff',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 16,
    marginHorizontal: 16,
    fontStyle: 'italic',
  },
  // Exercise list styles
  exercisesContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exercisesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  backButtonText: {
    fontSize: 14,
    color: '#fff',
  },
  exercisesList: {
    backgroundColor: '#242936',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  exerciseItem: {
    marginBottom: 12,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  exerciseImage: {
    width: 60,
    height: 60,
  },
  exerciseContent: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  exerciseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  exerciseDetail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginRight: 12,
  },
  exerciseDivider: {
    backgroundColor: 'rgba(29, 106, 229, 0.38)',
    height: 1,
    marginVertical: 12,
  },
  noExercisesText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
  },

}); 