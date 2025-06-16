import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Modal, Pressable, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, IconButton } from 'react-native-paper';
import * as Sentry from '@sentry/react-native';
import { ExerciseData } from './ExerciseGraphs';

interface ExerciseGraphModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (exerciseData: Partial<ExerciseData>) => void;
  exercise?: ExerciseData;
}

const ExerciseGraphModal: React.FC<ExerciseGraphModalProps> = ({
  visible,
  onClose,
  onSave,
  exercise,
}) => {
  const [name, setName] = useState(exercise?.name || '');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState(exercise?.unit || '');

  // Track component lifecycle with Sentry
  useEffect(() => {
    if (visible) {
      try {
        Sentry.addBreadcrumb({
          message: 'ExerciseGraphModal opened',
          category: 'component',
          level: 'info',
          data: {
            mode: exercise ? 'update' : 'create',
            exerciseId: exercise?.id,
            exerciseName: exercise?.name,
            hasExistingData: !!exercise?.data?.length,
          },
        });
      } catch (error) {
        console.warn('Failed to log Sentry breadcrumb for ExerciseGraphModal open:', error);
      }
    }

    return () => {
      if (visible) {
        try {
          Sentry.addBreadcrumb({
            message: 'ExerciseGraphModal closed',
            category: 'component',
            level: 'info',
            data: {
              exerciseId: exercise?.id,
              exerciseName: exercise?.name,
            },
          });
        } catch (error) {
          console.warn('Failed to log Sentry breadcrumb for ExerciseGraphModal close:', error);
        }
      }
    };
  }, [visible, exercise]);

  const handleClose = () => {
    try {
      Sentry.addBreadcrumb({
        message: 'Exercise graph modal close button pressed',
        category: 'user.interaction',
        level: 'info',
        data: {
          exerciseId: exercise?.id,
          hasUnsavedChanges:
            name !== (exercise?.name || '') || value !== '' || unit !== (exercise?.unit || ''),
        },
      });

      onClose();
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'ExerciseGraphModal',
          action: 'handleClose',
        },
        extra: {
          exerciseId: exercise?.id,
        },
      });
      console.error('Error in ExerciseGraphModal handleClose:', error);

      // Still close the modal even if logging fails
      onClose();
    }
  };

  const handleNameChange = (text: string) => {
    try {
      setName(text);

      if (text.length > 0 && text.length % 10 === 0) {
        Sentry.addBreadcrumb({
          message: 'Exercise name input progress',
          category: 'user.interaction',
          level: 'info',
          data: {
            nameLength: text.length,
            exerciseId: exercise?.id,
          },
        });
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'ExerciseGraphModal',
          action: 'handleNameChange',
        },
      });
      console.error('Error in ExerciseGraphModal handleNameChange:', error);

      // Still update the state
      setName(text);
    }
  };

  const handleValueChange = (text: string) => {
    try {
      setValue(text);

      // Log when user enters a valid number
      const numValue = parseFloat(text);
      if (!isNaN(numValue) && text.length > 0) {
        Sentry.addBreadcrumb({
          message: 'Exercise value entered',
          category: 'user.interaction',
          level: 'info',
          data: {
            value: numValue,
            exerciseId: exercise?.id,
            isValidNumber: true,
          },
        });
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'ExerciseGraphModal',
          action: 'handleValueChange',
        },
      });
      console.error('Error in ExerciseGraphModal handleValueChange:', error);

      // Still update the state
      setValue(text);
    }
  };

  const handleUnitChange = (text: string) => {
    try {
      setUnit(text);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'ExerciseGraphModal',
          action: 'handleUnitChange',
        },
      });
      console.error('Error in ExerciseGraphModal handleUnitChange:', error);

      // Still update the state
      setUnit(text);
    }
  };

  const handleSave = () => {
    try {
      Sentry.addBreadcrumb({
        message: 'Exercise graph save button pressed',
        category: 'user.interaction',
        level: 'info',
        data: {
          exerciseId: exercise?.id,
          nameLength: name.trim().length,
          valueInput: value,
          unitLength: unit.trim().length,
          mode: exercise ? 'update' : 'create',
        },
      });

      if (!name.trim()) {
        Sentry.addBreadcrumb({
          message: 'Exercise save validation failed - empty name',
          category: 'validation',
          level: 'warning',
          data: {
            nameLength: name.length,
            exerciseId: exercise?.id,
          },
        });

        Alert.alert('Validation Error', 'Please enter an exercise name');
        return;
      }

      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        Sentry.addBreadcrumb({
          message: 'Exercise save validation failed - invalid number',
          category: 'validation',
          level: 'warning',
          data: {
            valueInput: value,
            exerciseId: exercise?.id,
          },
        });

        Alert.alert('Validation Error', 'Please enter a valid number');
        return;
      }

      const newData = {
        date: new Date().toISOString().split('T')[0],
        value: numValue,
      };

      const exerciseData = {
        id: exercise?.id,
        name: name.trim(),
        unit: unit.trim(),
        data: exercise ? [...exercise.data, newData] : [newData],
      };

      Sentry.addBreadcrumb({
        message: 'Exercise data saved successfully',
        category: 'data.save',
        level: 'info',
        data: {
          exerciseId: exercise?.id,
          exerciseName: name.trim(),
          value: numValue,
          unit: unit.trim(),
          totalDataPoints: exerciseData.data?.length || 0,
          mode: exercise ? 'update' : 'create',
        },
      });

      onSave(exerciseData);

      // Reset form
      setName('');
      setValue('');
      setUnit('');
      onClose();
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'ExerciseGraphModal',
          action: 'handleSave',
        },
        extra: {
          exerciseId: exercise?.id,
          nameInput: name.substring(0, 50), // First 50 chars for debugging
          valueInput: value,
          unitInput: unit.substring(0, 20), // First 20 chars for debugging
        },
      });
      console.error('Error in ExerciseGraphModal handleSave:', error);

      // Show error to user
      Alert.alert('Error', 'An error occurred while saving. Please try again.');
    }
  };

  const handleModalPress = (event: { stopPropagation?: () => void }) => {
    try {
      // Stop event propagation to prevent closing when clicking inside modal
      event?.stopPropagation?.();
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'ExerciseGraphModal',
          action: 'handleModalPress',
        },
      });
      console.error('Error in ExerciseGraphModal handleModalPress:', error);
    }
  };

  const handleOverlayPress = () => {
    try {
      Sentry.addBreadcrumb({
        message: 'Exercise graph modal overlay pressed',
        category: 'user.interaction',
        level: 'info',
        data: {
          exerciseId: exercise?.id,
        },
      });

      onClose();
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'ExerciseGraphModal',
          action: 'handleOverlayPress',
        },
        extra: {
          exerciseId: exercise?.id,
        },
      });
      console.error('Error in ExerciseGraphModal handleOverlayPress:', error);

      // Still close the modal
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.modalOverlay} onPress={handleOverlayPress}>
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalContent} onPress={handleModalPress}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{exercise ? 'Update Exercise' : 'Add Exercise'}</Text>
              <IconButton
                icon="close"
                iconColor="#fff"
                size={24}
                style={styles.closeButton}
                onPress={handleClose}
              />
            </View>

            <ScrollView style={styles.form}>
              <TextInput
                label="Exercise Name"
                value={name}
                onChangeText={handleNameChange}
                mode="outlined"
                style={styles.input}
                disabled={!!exercise}
              />

              <TextInput
                label="Value"
                value={value}
                onChangeText={handleValueChange}
                mode="outlined"
                style={styles.input}
                keyboardType="numeric"
              />

              <TextInput
                label="Unit (e.g., kg, lbs)"
                value={unit}
                onChangeText={handleUnitChange}
                mode="outlined"
                style={styles.input}
                disabled={!!exercise}
              />

              <Button mode="contained" onPress={handleSave} style={styles.saveButton}>
                Save
              </Button>
            </ScrollView>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    maxWidth: 340,
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    margin: 0,
  },
  form: {
    maxHeight: 400,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#2A2A2A',
  },
  saveButton: {
    marginTop: 8,
    backgroundColor: '#6B4EFF',
  },
});

export default ExerciseGraphModal;
