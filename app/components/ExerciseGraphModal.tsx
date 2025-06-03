import React, { useState } from 'react';
import { StyleSheet, View, Modal, Pressable, ScrollView } from 'react-native';
import { Text, TextInput, Button, IconButton } from 'react-native-paper';
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

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter an exercise name');
      return;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      alert('Please enter a valid number');
      return;
    }

    const newData = {
      date: new Date().toISOString().split('T')[0],
      value: numValue,
    };

    onSave({
      id: exercise?.id,
      name: name.trim(),
      unit: unit.trim(),
      data: exercise ? [...exercise.data, newData] : [newData],
    });

    // Reset form
    setName('');
    setValue('');
    setUnit('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{exercise ? 'Update Exercise' : 'Add Exercise'}</Text>
              <IconButton
                icon="close"
                iconColor="#fff"
                size={24}
                style={styles.closeButton}
                onPress={onClose}
              />
            </View>

            <ScrollView style={styles.form}>
              <TextInput
                label="Exercise Name"
                value={name}
                onChangeText={setName}
                mode="outlined"
                style={styles.input}
                disabled={!!exercise}
              />

              <TextInput
                label="Value"
                value={value}
                onChangeText={setValue}
                mode="outlined"
                style={styles.input}
                keyboardType="numeric"
              />

              <TextInput
                label="Unit (e.g., kg, lbs)"
                value={unit}
                onChangeText={setUnit}
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
