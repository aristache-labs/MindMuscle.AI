import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
  Animated,
  ScrollView,
  PanResponder
} from 'react-native';
import { Text, IconButton, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../services/supabase';
import { useAuth } from '../store/AuthContext';
import { COLORS, SPACING } from '../constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Standardized day mapping: 1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday, 7=Saturday
const DAY_MAPPING = {
  'Sunday': 1,
  'Monday': 2,
  'Tuesday': 3,
  'Wednesday': 4,
  'Thursday': 5,
  'Friday': 6,
  'Saturday': 7
} as const;

const REVERSE_DAY_MAPPING = {
  1: 'Sunday',
  2: 'Monday',
  3: 'Tuesday',
  4: 'Wednesday',
  5: 'Thursday',
  6: 'Friday',
  7: 'Saturday'
} as const;

export default function WorkoutDaysModal({ visible, onClose }: Props) {
  const { user } = useAuth();
  const [workoutDays, setWorkoutDays] = useState<number[]>([]);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const [isSaving, setIsSaving] = useState(false);
  const modalAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  
  // Create pan responder for drag-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward drags
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // Move the modal according to the gesture
        if (gestureState.dy > 0) {
          modalAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If dragged down enough, dismiss the modal
        if (gestureState.dy > 150) {
          Animated.timing(modalAnim, {
            toValue: Dimensions.get('window').height,
            duration: 300,
            useNativeDriver: true
          }).start(() => {
            onClose();
          });
        } else {
          // Otherwise snap back to top
          Animated.spring(modalAnim, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        }
      },
    })
  ).current;

  // Animation effects for modal appearance/disappearance
  useEffect(() => {
    if (visible) {
      loadWorkoutDays();
      // Reset position and animate in
      modalAnim.setValue(Dimensions.get('window').height);
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      }).start();
    }
  }, [visible]);

  // Handle closing with animation
  const handleClose = () => {
    Animated.timing(modalAnim, {
      toValue: Dimensions.get('window').height,
      duration: 300,
      useNativeDriver: true
    }).start(() => {
      onClose();
    });
  };

  // Convert legacy string array to numeric array
  const convertLegacyWorkoutDays = (legacyDays: string[]): number[] => {
    return legacyDays
      .map(day => {
        // Handle both string numbers and day names
        if (/^\d+$/.test(day)) {
          // If it's a string number, convert to number
          return parseInt(day, 10);
        } else {
          // If it's a day name, use the mapping
          return DAY_MAPPING[day as keyof typeof DAY_MAPPING];
        }
      })
      .filter(dayNum => dayNum !== undefined && dayNum >= 1 && dayNum <= 7)
      .sort((a, b) => a - b);
  };

  // Load saved workout days from Supabase and AsyncStorage
  const loadWorkoutDays = async () => {
    try {
      if (user?.id) {
        // First try to get from Supabase (source of truth)
        const { data, error } = await supabase
          .from('user_profile_details')
          .select('workout_days')
          .eq('user_id', user.id)
          .single();

        if (!error && data) {
          let savedDays: number[] = [];
          
          // Handle both legacy string format and new numeric format
          if (data.workout_days && Array.isArray(data.workout_days)) {
            if (data.workout_days.length > 0) {
              if (typeof data.workout_days[0] === 'string') {
                // Legacy format - convert to numeric
                savedDays = convertLegacyWorkoutDays(data.workout_days);
                console.log('Converting legacy workout days:', data.workout_days, 'to:', savedDays);
                
                // Update database with new format
                if (savedDays.length > 0) {
                  await saveWorkoutDays(savedDays, false); // Don't trigger loading again
                }
              } else {
                // New numeric format
                savedDays = data.workout_days.sort((a: number, b: number) => a - b);
              }
            }
          } else if (!data.workout_days) {
            // No workout days set yet, initialize with empty array
            savedDays = [];
          }
          
          setWorkoutDays(savedDays);
          
          // Update AsyncStorage to keep in sync
          await AsyncStorage.setItem('workout-days-numeric', JSON.stringify(savedDays));
          return;
        } else if (error && error.code !== 'PGRST116') {
          // PGRST116 is "not found" error, which is expected for new users
          console.error('Error loading workout days from database:', error);
        }
      }

      // Fallback to AsyncStorage if Supabase fails or user is not logged in
      // Try new numeric format first
      let savedDays = await AsyncStorage.getItem('workout-days-numeric');
      if (savedDays) {
        const parsedDays = JSON.parse(savedDays);
        setWorkoutDays(parsedDays);
        
        // If user is logged in, sync to database
        if (user?.id && parsedDays.length > 0) {
          await saveWorkoutDays(parsedDays, false);
        }
        return;
      }
      
      // Fallback to legacy string format
      const legacySavedDays = await AsyncStorage.getItem('workout-days');
      if (legacySavedDays) {
        const legacyDays = JSON.parse(legacySavedDays);
        const numericDays = convertLegacyWorkoutDays(legacyDays);
        setWorkoutDays(numericDays);
        
        // Save in new format
        await AsyncStorage.setItem('workout-days-numeric', JSON.stringify(numericDays));
        
        // If user is logged in, sync to database
        if (user?.id && numericDays.length > 0) {
          await saveWorkoutDays(numericDays, false);
        }
      } else {
        // No saved data found, initialize with empty array
        setWorkoutDays([]);
      }
    } catch (error) {
      console.error('Failed to load workout days:', error);
      // Initialize with empty array on error
      setWorkoutDays([]);
    }
  };

  // Save workout days to both Supabase and AsyncStorage
  const saveWorkoutDays = async (daysToSave: number[], updateState: boolean = true) => {
    try {
      setIsSaving(true);
      
      // Save to AsyncStorage for offline access (new numeric format)
      await AsyncStorage.setItem('workout-days-numeric', JSON.stringify(daysToSave));
      
      if (user?.id) {
        // Update the database with numeric values
        const { error } = await supabase
          .from('user_profile_details')
          .update({ workout_days: daysToSave })
          .eq('user_id', user.id);
          
        if (error) {
          console.error('Error updating workout days:', error);
          
          // If update fails, try insert (in case profile doesn't exist)
          const { error: insertError } = await supabase
            .from('user_profile_details')
            .insert({
              user_id: user.id,
              workout_days: daysToSave
            });
            
          if (insertError) {
            console.error('Error inserting workout days:', insertError);
          } else {
            console.log('Workout days inserted successfully:', daysToSave);
          }
        } else {
          console.log('Workout days updated successfully:', daysToSave);
        }
      }
    } catch (error) {
      console.error('Failed to save workout days:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle a workout day and save immediately
  const toggleWorkoutDay = async (day: string) => {
    const dayNumber = DAY_MAPPING[day as keyof typeof DAY_MAPPING];
    if (!dayNumber) return;
    
    const updatedDays = workoutDays.includes(dayNumber)
      ? workoutDays.filter(d => d !== dayNumber)
      : [...workoutDays, dayNumber].sort((a, b) => a - b);
    
    setWorkoutDays(updatedDays);
    await saveWorkoutDays(updatedDays);
  };

  // Check if a day is selected
  const isDaySelected = (day: string): boolean => {
    const dayNumber = DAY_MAPPING[day as keyof typeof DAY_MAPPING];
    return dayNumber ? workoutDays.includes(dayNumber) : false;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <Animated.View 
              style={[
                styles.modalContainer, 
                { transform: [{ translateY: modalAnim }] }
              ]}
            >
              <View style={styles.container}>
                <View style={styles.topGlowLeft} />
                <View style={styles.topGlowRight} />
                
                {/* Drag handle */}
                <View style={styles.dragHandleContainer} {...panResponder.panHandlers}>
                  <View style={styles.dragHandle} />
                </View>
                
                <View style={styles.header}>
                  <IconButton
                    icon="close"
                    iconColor={COLORS.text}
                    size={24}
                    style={styles.closeButton}
                    onPress={handleClose}
                  />
                  <Text style={styles.title}>Workout Days</Text>
                </View>
                
                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <MaterialCommunityIcons
                        name="calendar-check-outline"
                        size={20}
                        color={COLORS.text}
                      />
                      <Text style={styles.sectionHeaderText}>Select Your Workout Days</Text>
                    </View>
                    
                    <View style={styles.workoutDaysContainer}>
                      <Text style={styles.workoutDaysDescription}>
                        Choose which days you plan to work out. The app will schedule your exercises on these days.
                      </Text>
                      
                      <View style={styles.daysContainer}>
                        {days.map((day) => (
                          <View key={day} style={styles.dayRow}>
                            <Text style={styles.dayText}>{day}</Text>
                            <Switch
                              value={isDaySelected(day)}
                              onValueChange={() => toggleWorkoutDay(day)}
                              disabled={isSaving}
                              color={COLORS.primary}
                            />
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={styles.infoSection}>
                    <View style={styles.infoItem}>
                      <MaterialCommunityIcons
                        name="information-outline"
                        size={24}
                        color={COLORS.primary}
                      />
                      <Text style={styles.infoText}>
                        These settings will be used to automatically schedule exercises in your workout plans.
                        If a plan has multiple days per week, exercises will be scheduled on your selected workout days.
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    height: SCREEN_HEIGHT,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
    height: '85%',
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
  dragHandleContainer: {
    width: '100%',
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 0.2,
    borderBottomColor: COLORS.primary,
    backgroundColor: COLORS.background,
  },
  closeButton: {
    margin: 0,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginRight: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6c47ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#6c47ff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(108, 71, 255, 0.3)',
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 8,
  },
  workoutDaysContainer: {
    padding: 20,
  },
  workoutDaysDescription: {
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  daysContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  dayText: {
    fontSize: 16,
    color: COLORS.text,
  },
  infoSection: {
    marginTop: 20,
    padding: 5,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: SPACING.md,
  },
  infoText: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    lineHeight: 20,
  },
}); 