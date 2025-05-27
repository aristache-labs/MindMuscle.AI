import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../constants/theme';

interface WorkoutExitModalProps {
  visible: boolean;
  onEndWorkout: () => void;
  onPauseWorkout: () => void;
  onReturnToWorkout: () => void;
  onClose: () => void;
}

export default function WorkoutExitModal({
  visible,
  onEndWorkout,
  onPauseWorkout,
  onReturnToWorkout,
  onClose,
}: WorkoutExitModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#121418', '#0A0C10']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalGradient}
          >
            <View style={styles.modalContent}>
              {/* Header with just title */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Exit Workout?</Text>
              </View>
              
              {/* Action Buttons */}
              <View style={styles.modalActions}>
                {/* End Workout Button */}
                <TouchableOpacity 
                  style={styles.modalButton}
                  onPress={onEndWorkout}
                >
                  <View style={styles.buttonContent}>
                    <Ionicons name="close-circle" size={24} color="#FF5252" style={styles.buttonIcon} />
                    <View style={styles.buttonTextContainer}>
                      <Text style={styles.buttonTitle}>End Workout</Text>
                      <Text style={styles.buttonSubtitle}>Discard progress</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                
                {/* Pause Workout Button */}
                <TouchableOpacity 
                  style={styles.modalButton}
                  onPress={onPauseWorkout}
                >
                  <View style={styles.buttonContent}>
                    <Ionicons name="pause-circle" size={24} color="#FFC107" style={styles.buttonIcon} />
                    <View style={styles.buttonTextContainer}>
                      <Text style={styles.buttonTitle}>Pause Workout</Text>
                      <Text style={styles.buttonSubtitle}>Save progress for later</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                
                {/* Return Button */}
                <TouchableOpacity 
                  style={[styles.modalButton, styles.returnButton]}
                  onPress={onReturnToWorkout}
                >
                  <View style={styles.buttonContent}>
                    <Ionicons name="arrow-back-circle" size={24} color={COLORS.primary} style={styles.buttonIcon} />
                    <View style={styles.buttonTextContainer}>
                      <Text style={styles.buttonTitle}>Return to Workout</Text>
                      <Text style={styles.buttonSubtitle}>Continue current session</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  modalContainer: {
    backgroundColor: 'transparent',
    borderRadius: BORDER_RADIUS.lg,
    width: '90%',
    maxWidth: 400,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    borderWidth: 0.2,
    borderColor: COLORS.primary,
  },
  modalGradient: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
  },
  modalContent: {
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
    width: '100%',
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  modalActions: {
    width: '100%',
    gap: SPACING.md,
    alignItems: 'center',
  },
  modalButton: {
    backgroundColor: 'rgba(30, 35, 45, 0.8)',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    width: '90%',
    alignSelf: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: SPACING.md,
    marginLeft: SPACING.xs,
  },
  buttonTextContainer: {
    alignItems: 'center',
    width: '60%',
  },
  buttonTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  buttonSubtitle: {
    color: COLORS.text,
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  returnButton: {
    // Background color is already in modalButton
  },
}); 