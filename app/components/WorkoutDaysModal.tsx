import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { IconButton, Switch, Text } from 'react-native-paper';
import { COLORS, SPACING } from '../constants/theme';
import supabase from '../services/supabase';
import { validationService } from '../services/validationService';
import { useAuth } from '../store/AuthContext';
import { logger } from '../utils/logger';
import { SentryDataCollection, SentryLogger, SentryAutoInstrumentation } from '../services/sentry';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Standardized day mapping: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
const DAY_MAPPING = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
} as const;

export default function WorkoutDaysModal({ visible, onClose }: Props) {
  const { user } = useAuth();
  const [workoutDays, setWorkoutDays] = useState<number[]>([]);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const modalAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  // Track component mount/unmount
  React.useEffect(() => {
    if (visible) {
      try {
        SentryDataCollection.addBreadcrumb({
          message: 'WorkoutDaysModal opened',
          category: 'ui-lifecycle',
          level: 'info',
          data: {
            component: 'WorkoutDaysModal',
            action: 'modal_open',
            user_id: user?.id,
            platform: Platform.OS,
          },
        });
      } catch (error) {
        SentryDataCollection.captureException(error as Error, {
          component: 'WorkoutDaysModal',
          action: 'modal_open_tracking',
          platform: Platform.OS,
        });
      }
    }
  }, [visible, user?.id]);

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
            useNativeDriver: true,
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
    }),
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
        useNativeDriver: true,
      }).start();
      // Clear validation error when modal opens
      setValidationError('');
    }
  }, [visible]);

  // Validate workout days selection
  const validateWorkoutDays = (daysToValidate: number[]) => {
    try {
      if (!user?.id) {
        const errorMessage = 'User not authenticated';
        setValidationError(errorMessage);

        // Track authentication error
        SentryDataCollection.addBreadcrumb({
          message: 'Workout days validation failed: User not authenticated',
          category: 'validation.error',
          level: 'warning',
          data: {
            component: 'WorkoutDaysModal',
            action: 'validation_auth_error',
            attempted_days_count: daysToValidate.length,
            platform: Platform.OS,
          },
        });

        return false;
      }

      const validationData = {
        userId: user.id,
        workoutDays: daysToValidate,
      };

      const validationResult = validationService.validateWorkoutDaysPreference(validationData);

      if (!validationResult.success) {
        const errorMessage = validationResult.errors.map((e) => e.message).join(', ');
        setValidationError(errorMessage);

        // Track validation failure
        SentryDataCollection.addBreadcrumb({
          message: 'Workout days validation failed',
          category: 'validation.error',
          level: 'warning',
          data: {
            component: 'WorkoutDaysModal',
            action: 'validation_failed',
            user_id: user.id,
            attempted_days: daysToValidate,
            validation_errors: validationResult.errors,
            platform: Platform.OS,
          },
        });

        logger.warn('Workout days validation failed', {
          context: { validationData, errors: validationResult.errors },
        });
        return false;
      }

      // Track successful validation
      SentryDataCollection.addBreadcrumb({
        message: 'Workout days validation successful',
        category: 'validation.success',
        level: 'info',
        data: {
          component: 'WorkoutDaysModal',
          action: 'validation_success',
          user_id: user.id,
          validated_days: daysToValidate,
          days_count: daysToValidate.length,
          platform: Platform.OS,
        },
      });

      setValidationError('');
      return true;
    } catch (error) {
      const errorMessage = 'Validation error occurred';
      setValidationError(errorMessage);

      SentryDataCollection.captureException(error as Error, {
        component: 'WorkoutDaysModal',
        action: 'validation_exception',
        user_id: user?.id,
        attempted_days: daysToValidate,
        platform: Platform.OS,
      });

      SentryLogger.error('Error in WorkoutDaysModal validation', {
        error: error as Error,
        component: 'WorkoutDaysModal',
        user_id: user?.id,
        attempted_days: daysToValidate,
      });

      return false;
    }
  };

  // Handle closing with animation
  const handleClose = () => {
    try {
      // Track modal close
      SentryAutoInstrumentation.trackUserInteraction(
        'close_modal',
        'close_button',
        'workout_days_modal',
        {
          current_workout_days: workoutDays,
          days_count: workoutDays.length,
          user_id: user?.id,
          platform: Platform.OS,
        },
      );

      SentryDataCollection.addBreadcrumb({
        message: 'User closed WorkoutDaysModal',
        category: 'user-interaction',
        level: 'info',
        data: {
          component: 'WorkoutDaysModal',
          action: 'modal_close',
          current_workout_days: workoutDays,
          days_count: workoutDays.length,
          user_id: user?.id,
          platform: Platform.OS,
        },
      });

      Animated.timing(modalAnim, {
        toValue: Dimensions.get('window').height,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onClose();
      });
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'WorkoutDaysModal',
        action: 'close_handler',
        user_id: user?.id,
        platform: Platform.OS,
      });

      SentryLogger.error('Error in WorkoutDaysModal close handler', {
        error: error as Error,
        component: 'WorkoutDaysModal',
        user_id: user?.id,
      });

      // Still try to close the modal even if tracking fails
      try {
        Animated.timing(modalAnim, {
          toValue: Dimensions.get('window').height,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          onClose();
        });
      } catch (closeError) {
        SentryDataCollection.captureException(closeError as Error, {
          component: 'WorkoutDaysModal',
          action: 'close_execution',
          platform: Platform.OS,
        });
        // Fallback direct close
        onClose();
      }
    }
  };

  // Convert legacy string array to numeric array
  const convertLegacyWorkoutDays = (legacyDays: string[]): number[] => {
    return legacyDays
      .map((day) => {
        // Handle both string numbers and day names
        if (/^\d+$/.test(day)) {
          // If it's a string number, convert to number and adjust for 0-6 range
          const dayNum = parseInt(day);
          // Convert from 1-7 range to 0-6 range if needed
          return dayNum >= 1 && dayNum <= 7 ? dayNum - 1 : dayNum;
        } else {
          // If it's a day name, use the mapping
          return DAY_MAPPING[day as keyof typeof DAY_MAPPING];
        }
      })
      .filter((dayNum) => dayNum !== undefined && dayNum >= 0 && dayNum <= 6)
      .sort((a, b) => a - b);
  };

  // Helper function to load from Supabase
  const loadFromSupabase = async (): Promise<number[] | null> => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('user_profile_details')
        .select('workout_days')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Error loading workout days from database', error, {
          context: { userId: user.id },
        });
        return null;
      }

      if (!data || !data.workout_days || !Array.isArray(data.workout_days)) {
        return [];
      }

      if (data.workout_days.length === 0) {
        return [];
      }

      if (typeof data.workout_days[0] === 'string') {
        // Legacy format - convert to numeric
        const convertedDays = convertLegacyWorkoutDays(data.workout_days);
        logger.info('Converting legacy workout days', {
          context: { oldFormat: data.workout_days, newFormat: convertedDays },
        });

        // Update database with new format
        if (convertedDays.length > 0) {
          await saveWorkoutDays(convertedDays);
        }
        return convertedDays;
      }

      // New numeric format - ensure values are in 0-6 range
      // Only convert if we detect 1-7 format (presence of 7 indicates old format)
      const hasOldFormat = data.workout_days.some((day: number) => day === 7);

      const numericDays = data.workout_days
        .map((day: number) => {
          // Only convert if we detected old 1-7 format
          if (hasOldFormat && day >= 1 && day <= 7) {
            return day - 1;
          }
          return day;
        })
        .filter((day: number) => day >= 0 && day <= 6);

      // Only update database if we actually converted from old format
      if (
        hasOldFormat &&
        numericDays.some((day: number, index: number) => day !== data.workout_days[index])
      ) {
        logger.info('Converting numeric workout days from 1-7 to 0-6 range', {
          context: { oldFormat: data.workout_days, newFormat: numericDays },
        });
        await saveWorkoutDays(numericDays);
      }

      return numericDays.sort((a: number, b: number) => a - b);
    } catch (error) {
      logger.error('Failed to load workout days from Supabase', error as Error, {
        context: { userId: user.id },
      });
      return null;
    }
  };

  // Helper function to load from AsyncStorage
  const loadFromAsyncStorage = async (): Promise<number[] | null> => {
    try {
      // Try new numeric format first
      const savedDays = await AsyncStorage.getItem('workout-days-numeric');
      if (savedDays) {
        const parsedDays = JSON.parse(savedDays);

        // If user is logged in, sync to database
        if (user?.id && parsedDays.length > 0) {
          await saveWorkoutDays(parsedDays);
        }
        return parsedDays;
      }

      // Fallback to legacy string format
      const legacySavedDays = await AsyncStorage.getItem('workout-days');
      if (legacySavedDays) {
        const legacyDays = JSON.parse(legacySavedDays);
        const numericDays = convertLegacyWorkoutDays(legacyDays);

        // Save in new format
        await AsyncStorage.setItem('workout-days-numeric', JSON.stringify(numericDays));

        // If user is logged in, sync to database
        if (user?.id && numericDays.length > 0) {
          await saveWorkoutDays(numericDays);
        }
        return numericDays;
      }

      return null;
    } catch (error) {
      logger.error('Failed to load workout days from AsyncStorage', error as Error);
      return null;
    }
  };

  // Load saved workout days from Supabase and AsyncStorage
  const loadWorkoutDays = async () => {
    try {
      // Track load attempt
      SentryDataCollection.addBreadcrumb({
        message: 'Loading workout days',
        category: 'data.load',
        level: 'info',
        data: {
          component: 'WorkoutDaysModal',
          action: 'load_workout_days_start',
          user_id: user?.id,
          platform: Platform.OS,
        },
      });

      // First try to get from Supabase (source of truth)
      const supabaseDays = await loadFromSupabase();
      if (supabaseDays !== null) {
        setWorkoutDays(supabaseDays);
        // Update AsyncStorage to keep in sync
        await AsyncStorage.setItem('workout-days-numeric', JSON.stringify(supabaseDays));

        // Track successful Supabase load
        SentryDataCollection.addBreadcrumb({
          message: 'Workout days loaded from Supabase',
          category: 'data.load',
          level: 'info',
          data: {
            component: 'WorkoutDaysModal',
            action: 'load_supabase_success',
            user_id: user?.id,
            days_count: supabaseDays.length,
            loaded_days: supabaseDays,
            platform: Platform.OS,
          },
        });
        return;
      }

      // Fallback to AsyncStorage if Supabase fails or user is not logged in
      const asyncStorageDays = await loadFromAsyncStorage();
      if (asyncStorageDays !== null) {
        setWorkoutDays(asyncStorageDays);

        // Track AsyncStorage fallback
        SentryDataCollection.addBreadcrumb({
          message: 'Workout days loaded from AsyncStorage',
          category: 'data.load',
          level: 'info',
          data: {
            component: 'WorkoutDaysModal',
            action: 'load_async_storage_success',
            user_id: user?.id,
            days_count: asyncStorageDays.length,
            loaded_days: asyncStorageDays,
            platform: Platform.OS,
          },
        });
        return;
      }

      // No saved data found, initialize with empty array
      setWorkoutDays([]);

      // Track empty initialization
      SentryDataCollection.addBreadcrumb({
        message: 'No workout days found, initialized with empty array',
        category: 'data.load',
        level: 'info',
        data: {
          component: 'WorkoutDaysModal',
          action: 'load_empty_initialization',
          user_id: user?.id,
          platform: Platform.OS,
        },
      });
    } catch (error) {
      console.error('Failed to load workout days:', error);

      // Track load error
      SentryDataCollection.captureException(error as Error, {
        component: 'WorkoutDaysModal',
        action: 'load_workout_days_error',
        user_id: user?.id,
        platform: Platform.OS,
      });

      SentryLogger.error('Failed to load workout days in WorkoutDaysModal', {
        error: error as Error,
        component: 'WorkoutDaysModal',
        user_id: user?.id,
      });

      // Initialize with empty array on error
      setWorkoutDays([]);
    }
  };

  // Save workout days to both Supabase and AsyncStorage
  const saveWorkoutDays = async (daysToSave: number[]) => {
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
          const { error: insertError } = await supabase.from('user_profile_details').insert({
            user_id: user.id,
            workout_days: daysToSave,
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
    try {
      const dayNumber = DAY_MAPPING[day as keyof typeof DAY_MAPPING];
      if (dayNumber === undefined) {
        SentryLogger.warn('Invalid day provided to toggleWorkoutDay', {
          component: 'WorkoutDaysModal',
          invalid_day: day,
          user_id: user?.id,
        });
        return;
      }

      const previousDays = [...workoutDays];
      const isAdding = !workoutDays.includes(dayNumber);
      const updatedDays = isAdding
        ? [...workoutDays, dayNumber].sort((a, b) => a - b)
        : workoutDays.filter((d) => d !== dayNumber);

      // Track toggle attempt
      SentryAutoInstrumentation.trackUserInteraction(
        'toggle_workout_day',
        'day_switch',
        'workout_days_modal',
        {
          day: day,
          day_number: dayNumber,
          action: isAdding ? 'add' : 'remove',
          previous_days: previousDays,
          updated_days: updatedDays,
          user_id: user?.id,
          platform: Platform.OS,
        },
      );

      // Validate the updated workout days before saving
      if (!validateWorkoutDays(updatedDays)) {
        // Track validation failure
        SentryDataCollection.addBreadcrumb({
          message: `Workout day toggle validation failed for ${day}`,
          category: 'user-interaction',
          level: 'warning',
          data: {
            component: 'WorkoutDaysModal',
            action: 'toggle_validation_failed',
            day: day,
            attempted_days: updatedDays,
            user_id: user?.id,
            platform: Platform.OS,
          },
        });
        return; // Don't update if validation fails
      }

      // Track successful toggle
      SentryDataCollection.addBreadcrumb({
        message: `Workout day ${isAdding ? 'added' : 'removed'}: ${day}`,
        category: 'user-interaction',
        level: 'info',
        data: {
          component: 'WorkoutDaysModal',
          action: 'toggle_workout_day_success',
          day: day,
          day_number: dayNumber,
          action_type: isAdding ? 'add' : 'remove',
          final_days: updatedDays,
          days_count: updatedDays.length,
          user_id: user?.id,
          platform: Platform.OS,
        },
      });

      setWorkoutDays(updatedDays);
      await saveWorkoutDays(updatedDays);
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'WorkoutDaysModal',
        action: 'toggle_workout_day_error',
        day: day,
        user_id: user?.id,
        platform: Platform.OS,
      });

      SentryLogger.error('Error toggling workout day in WorkoutDaysModal', {
        error: error as Error,
        component: 'WorkoutDaysModal',
        day: day,
        user_id: user?.id,
      });
    }
  };

  // Check if a day is selected
  const isDaySelected = (day: string): boolean => {
    const dayNumber = DAY_MAPPING[day as keyof typeof DAY_MAPPING];
    return dayNumber !== undefined ? workoutDays.includes(dayNumber) : false;
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
              style={[styles.modalContainer, { transform: [{ translateY: modalAnim }] }]}
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
                        Choose which days you plan to work out. The app will schedule your exercises
                        on these days.
                      </Text>

                      {validationError ? (
                        <View style={styles.errorContainer}>
                          <MaterialCommunityIcons
                            name="alert-circle-outline"
                            size={16}
                            color={COLORS.error}
                          />
                          <Text style={styles.errorText}>{validationError}</Text>
                        </View>
                      ) : null}

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
                        These settings will be used to automatically schedule exercises in your
                        workout plans. If a plan has multiple days per week, exercises will be
                        scheduled on your selected workout days.
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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: 14,
    marginLeft: 8,
    lineHeight: 18,
  },
});
