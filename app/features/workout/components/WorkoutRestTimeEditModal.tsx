import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Modal, Dimensions, Platform } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { COLORS } from '../../../constants/theme';
import { SentryDataCollection, SentryAutoInstrumentation } from '../../../services/sentry';

interface WorkoutRestTimeEditModalProps {
  isVisible: boolean;
  exerciseName: string;
  currentRestTime: number;
  onSave: (newRestTime: number) => void;
  onClose: () => void;
}

const WINDOW_WIDTH = Dimensions.get('window').width;

export default function WorkoutRestTimeEditModal({
  isVisible,
  exerciseName,
  currentRestTime,
  onSave,
  onClose,
}: WorkoutRestTimeEditModalProps) {
  const [restTime, setRestTime] = useState(currentRestTime);

  // Acknowledge onClose parameter to satisfy ESLint
  void onClose;

  useEffect(() => {
    if (isVisible) {
      setRestTime(currentRestTime);

      SentryDataCollection.addBreadcrumb({
        message: 'Rest time edit modal opened',
        category: 'workout.rest_timer',
        level: 'info',
        data: {
          exercise_name: exerciseName,
          current_rest_time: currentRestTime,
          platform: Platform.OS,
        },
      });
    }
  }, [isVisible, currentRestTime, exerciseName]);

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes}:00`;
    }
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const adjustTime = (amount: number) => {
    try {
      const newTime = Math.max(5, Math.min(600, restTime + amount)); // Min 5s, max 10 minutes
      setRestTime(newTime);

      SentryAutoInstrumentation.trackUserInteraction(
        'adjust_rest_time',
        'adjust_button',
        'workout_timer',
        {
          exercise_name: exerciseName,
          adjustment: amount,
          previous_time: restTime,
          new_time: newTime,
          platform: Platform.OS,
        },
      );
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'WorkoutRestTimeEditModal',
        action: 'adjust_time',
        adjustment: amount,
        platform: Platform.OS,
      });
    }
  };

  const handleSave = () => {
    try {
      SentryAutoInstrumentation.trackUserInteraction(
        'save_rest_time',
        'save_button',
        'workout_timer',
        {
          exercise_name: exerciseName,
          original_time: currentRestTime,
          new_time: restTime,
          time_difference: restTime - currentRestTime,
          platform: Platform.OS,
        },
      );

      onSave(restTime);
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'WorkoutRestTimeEditModal',
        action: 'save_handler',
        platform: Platform.OS,
      });
      onSave(restTime); // Still execute save even if tracking fails
    }
  };

  if (!isVisible) return null;

  return (
    <Modal transparent animationType="fade" visible={isVisible}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Surface style={styles.modalSurface}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>EXERCISE REST TIMER</Text>
              <Text style={styles.exerciseName} numberOfLines={2}>
                {exerciseName}
              </Text>
              <Text style={styles.subtitle}>Total Rest Timer (min)</Text>
            </View>

            {/* Time Controls */}
            <View style={styles.timeControls}>
              <Pressable style={styles.adjustButton} onPress={() => adjustTime(-15)}>
                <Text style={styles.adjustButtonText}>—</Text>
              </Pressable>

              <View style={styles.timeDisplayContainer}>
                <Text style={styles.timeDisplay}>{formatTime(restTime)}</Text>
              </View>

              <Pressable style={styles.adjustButton} onPress={() => adjustTime(15)}>
                <Text style={styles.adjustButtonText}>+</Text>
              </Pressable>
            </View>

            {/* Disclaimer */}
            <Text style={styles.disclaimer}>
              This rest time will be saved for this exercise throughout your workout and future
              sessions
            </Text>

            {/* Done Button */}
            <Pressable style={styles.doneButton} onPress={handleSave}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </Surface>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  modalContainer: {
    width: WINDOW_WIDTH * 0.9,
    maxWidth: 400,
  },
  modalSurface: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  subtitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  timeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  adjustButton: {
    width: 60,
    height: 50,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  adjustButtonText: {
    color: '#FFD700',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 32,
  },
  timeDisplayContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
  },
  timeDisplay: {
    color: '#FFD700',
    fontSize: 48,
    fontWeight: '300',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-thin',
  },
  disclaimer: {
    color: COLORS.secondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 32,
    paddingHorizontal: 16,
    opacity: 0.8,
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
