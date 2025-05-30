import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Icon } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../../constants/theme';
import { PausedWorkoutInfo } from '../types';
import { styles } from '../styles';

interface PausedWorkoutModalProps {
  visible: boolean;
  pausedWorkoutInfo: PausedWorkoutInfo;
  onClose: () => void;
  onResumeWorkout: () => void;
  onStartNewWorkout: () => void;
}

const PausedWorkoutModal: React.FC<PausedWorkoutModalProps> = ({
  visible,
  pausedWorkoutInfo,
  onClose,
  onResumeWorkout,
  onStartNewWorkout,
}) => {
  if (!visible || !pausedWorkoutInfo.pausedDay) return null;

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.pausedModalContainer}>
          <LinearGradient
            colors={['#121418', '#0A0C10']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalGradient}
          >
            <View style={styles.pausedModalContent}>
              <Text style={styles.pausedModalTitle}>Workout In Progress</Text>

              <View style={styles.pausedModalIcon}>
                <Icon source="pause-circle" size={50} color="#FF9800" />
              </View>

              <Text style={styles.pausedModalMessage}>
                You have a paused workout for day {pausedWorkoutInfo.pausedDay}. Would you like to
                resume it or {pausedWorkoutInfo.mode === 'start' ? "start today's" : 'redo this'}{' '}
                workout?
              </Text>

              <View style={styles.pausedModalActions}>
                {/* Resume button */}
                <TouchableOpacity style={styles.pausedModalResumeButton} onPress={onResumeWorkout}>
                  <View style={styles.buttonContent}>
                    <Icon source="play-circle" size={24} color={COLORS.text} />
                    <Text style={styles.pausedModalButtonText}>Resume Workout</Text>
                  </View>
                </TouchableOpacity>

                {/* Start New/Redo button */}
                <TouchableOpacity style={styles.pausedModalStartButton} onPress={onStartNewWorkout}>
                  <View style={styles.buttonContent}>
                    <Icon source="dumbbell" size={24} color={COLORS.text} />
                    <Text style={styles.pausedModalButtonText}>
                      {pausedWorkoutInfo.mode === 'start'
                        ? 'Start This Workout'
                        : 'Redo This Workout'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Cancel button */}
                <TouchableOpacity style={styles.pausedModalCancelButton} onPress={onClose}>
                  <Text style={styles.pausedModalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

export default PausedWorkoutModal;
