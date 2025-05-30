import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../constants/theme';

interface WorkoutWarmupModalProps {
  visible: boolean;
  exerciseName?: string;
  onComplete: () => void;
  onSkip: () => void;
}

export default function WorkoutWarmupModal({
  visible,
  exerciseName,
  onComplete,
  onSkip,
}: WorkoutWarmupModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => {}}
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
              {/* Header with Icon */}
              <View style={styles.modalHeader}>
                <View style={styles.warmupIconContainer}>
                  <Ionicons name="flame" size={32} color={COLORS.text} />
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.modalTitle}>Exercise Warmup</Text>
                  <Text style={styles.modalSubtitle}>
                    Prepare your muscles for {exerciseName || 'the workout'}
                  </Text>
                </View>
              </View>
              
              {/* Instructions */}
              <View style={styles.warmupInstructionsContainer}>
                <Text style={styles.instructionsTitle}>Warmup Protocol:</Text>
                
                <View style={styles.instructionsList}>
                  <View style={styles.instructionItem}>
                    <View style={styles.instructionNumber}>
                      <Text style={styles.instructionNumberText}>1</Text>
                    </View>
                    <View style={styles.instructionContent}>
                      <Text style={styles.instructionText}>5 reps with light weight</Text>
                      <Text style={styles.instructionSubtext}>Focus on form and range of motion</Text>
                    </View>
                  </View>
                  
                  <View style={styles.instructionItem}>
                    <View style={styles.instructionNumber}>
                      <Text style={styles.instructionNumberText}>2</Text>
                    </View>
                    <View style={styles.instructionContent}>
                      <Text style={styles.instructionText}>3 reps with medium weight</Text>
                      <Text style={styles.instructionSubtext}>Gradually increase intensity</Text>
                    </View>
                  </View>
                </View>
              </View>
              
              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.skipButton}
                  onPress={onSkip}
                >
                  <Text style={styles.skipButtonText}>Skip</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.modalButton}
                  onPress={onComplete}
                >
                  <View style={styles.buttonContent}>
                    <Ionicons name="checkmark" size={20} color={COLORS.primary} style={styles.buttonIcon} />
                    <Text style={styles.modalButtonText}>Complete</Text>
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
  warmupIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 30,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  headerTextContainer: {
    alignItems: 'center',
    width: '100%',
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: COLORS.text,
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.9,
  },
  warmupInstructionsContainer: {
    width: '100%',
    marginBottom: SPACING.xl,
  },
  instructionsTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  instructionsList: {
    width: '100%',
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  instructionNumber: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  instructionNumberText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  instructionContent: {
    flex: 1,
  },
  instructionText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  instructionSubtext: {
    color: COLORS.text,
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: SPACING.md,
  },
  skipButton: {
    backgroundColor: 'rgba(30, 35, 45, 0.8)',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    flex: 1,
    alignItems: 'center',
  },
  skipButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: 'rgba(30, 35, 45, 0.8)',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    flex: 1,
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonIcon: {
    marginRight: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  modalButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
}); 