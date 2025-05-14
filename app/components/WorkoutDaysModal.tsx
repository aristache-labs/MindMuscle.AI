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

export default function WorkoutDaysModal({ visible, onClose }: Props) {
  const { user } = useAuth();
  const [workoutDays, setWorkoutDays] = useState<string[]>([]);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
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

        if (!error && data?.workout_days) {
          const savedDays = Array.isArray(data.workout_days) ? data.workout_days : [];
          setWorkoutDays(savedDays);
          
          // Update AsyncStorage to keep in sync
          await AsyncStorage.setItem('workout-days', JSON.stringify(savedDays));
          return;
        }
      }

      // Fallback to AsyncStorage if Supabase fails or user is not logged in
      const savedDays = await AsyncStorage.getItem('workout-days');
      if (savedDays) {
        setWorkoutDays(JSON.parse(savedDays));
      }
    } catch (error) {
      console.error('Failed to load workout days:', error);
    }
  };

  // Save workout days to both Supabase and AsyncStorage
  const saveWorkoutDays = async (daysToSave: string[]) => {
    try {
      setIsSaving(true);
      
      // Save to AsyncStorage for offline access
      await AsyncStorage.setItem('workout-days', JSON.stringify(daysToSave));
      
      if (user?.id) {
        // Use the dedicated database function to update workout days
        const { data, error } = await supabase
          .rpc('update_user_workout_days', {
            p_user_id: user.id,
            p_workout_days: daysToSave
          });
          
        if (error) {
          console.error('Error updating workout days:', error);
        } else {
          console.log('Workout days updated successfully:', data);
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
    const updatedDays = workoutDays.includes(day)
      ? workoutDays.filter(d => d !== day)
      : [...workoutDays, day];
    
    setWorkoutDays(updatedDays);
    await saveWorkoutDays(updatedDays);
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
                              value={workoutDays.includes(day)}
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
  }
}); 