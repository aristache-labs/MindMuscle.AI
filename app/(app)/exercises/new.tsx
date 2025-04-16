import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput, Button, Chip, useTheme, Snackbar, ActivityIndicator } from 'react-native-paper';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { exerciseService } from '../../services/exerciseService';

const NewExerciseScreen = () => {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [equipment, setEquipment] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState<string[]>(['']);
  const [muscles, setMuscles] = useState<string[]>([]);
  const [newMuscle, setNewMuscle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const handleAddInstruction = () => {
    setInstructions([...instructions, '']);
  };

  const handleUpdateInstruction = (index: number, value: string) => {
    const newInstructions = [...instructions];
    newInstructions[index] = value;
    setInstructions(newInstructions);
  };

  const handleAddMuscle = () => {
    if (newMuscle.trim() && !muscles.includes(newMuscle.trim())) {
      setMuscles([...muscles, newMuscle.trim()]);
      setNewMuscle('');
    }
  };

  const handleRemoveMuscle = (muscleToRemove: string) => {
    setMuscles(muscles.filter(muscle => muscle !== muscleToRemove));
  };

  const validateForm = () => {
    if (!name.trim()) {
      setError('Exercise name is required');
      return false;
    }
    if (!category.trim()) {
      setError('Category is required');
      return false;
    }
    if (!equipment.trim()) {
      setError('Equipment is required');
      return false;
    }
    if (!difficulty.trim()) {
      setError('Difficulty is required');
      return false;
    }
    if (!description.trim()) {
      setError('Description is required');
      return false;
    }
    if (instructions.some(instruction => !instruction.trim())) {
      setError('All instruction steps must be filled');
      return false;
    }
    if (muscles.length === 0) {
      setError('At least one target muscle is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      setSnackbarVisible(true);
      return;
    }

    try {
      setIsSubmitting(true);
      const now = new Date().toISOString();
      
      await exerciseService.createExercise({
        name: name.trim(),
        category: category.trim(),
        equipment: equipment.trim(),
        difficulty: difficulty.trim(),
        description: description.trim(),
        instructions: instructions.map(instruction => instruction.trim()),
        muscles,
        createdAt: now,
        updatedAt: now,
      });

      router.back();
    } catch (err) {
      setError('Error creating exercise');
      setSnackbarVisible(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Creating exercise...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.content}>
          <Text variant="headlineMedium" style={styles.title}>
            New Exercise
          </Text>

          <TextInput
            label="Exercise Name"
            value={name}
            onChangeText={setName}
            style={styles.input}
            error={!name.trim()}
          />

          <TextInput
            label="Category"
            value={category}
            onChangeText={setCategory}
            style={styles.input}
            error={!category.trim()}
          />

          <TextInput
            label="Equipment"
            value={equipment}
            onChangeText={setEquipment}
            style={styles.input}
            error={!equipment.trim()}
          />

          <TextInput
            label="Difficulty"
            value={difficulty}
            onChangeText={setDifficulty}
            style={styles.input}
            error={!difficulty.trim()}
          />

          <TextInput
            label="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            style={styles.input}
            error={!description.trim()}
          />

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Instructions
          </Text>
          {instructions.map((instruction, index) => (
            <TextInput
              key={index}
              label={`Step ${index + 1}`}
              value={instruction}
              onChangeText={(value) => handleUpdateInstruction(index, value)}
              multiline
              numberOfLines={2}
              style={styles.input}
              error={!instruction.trim()}
            />
          ))}
          <Button
            mode="outlined"
            onPress={handleAddInstruction}
            style={styles.addButton}
          >
            Add Step
          </Button>

          <Text variant="titleMedium" style={styles.sectionTitle}>
            Target Muscles
          </Text>
          <View style={styles.musclesContainer}>
            {muscles.map((muscle, index) => (
              <Chip
                key={index}
                onClose={() => handleRemoveMuscle(muscle)}
                style={styles.muscleChip}
              >
                {muscle}
              </Chip>
            ))}
          </View>
          <View style={styles.addMuscleContainer}>
            <TextInput
              label="Add Muscle"
              value={newMuscle}
              onChangeText={setNewMuscle}
              style={styles.muscleInput}
            />
            <Button
              mode="contained"
              onPress={handleAddMuscle}
              style={styles.addMuscleButton}
            >
              Add
            </Button>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.submitButton}
          disabled={isSubmitting}
        >
          Create Exercise
        </Button>
      </View>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        action={{
          label: 'Dismiss',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {error}
      </Snackbar>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
  },
  title: {
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 16,
  },
  addButton: {
    marginBottom: 24,
  },
  musclesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  muscleChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  addMuscleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  muscleInput: {
    flex: 1,
  },
  addMuscleButton: {
    minWidth: 80,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  submitButton: {
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
});

export default NewExerciseScreen; 