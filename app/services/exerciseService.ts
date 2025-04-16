import AsyncStorage from '@react-native-async-storage/async-storage';
import { Exercise } from '../types/exercise';

const EXERCISES_STORAGE_KEY = '@exercises';

export const exerciseService = {
  async getAllExercises(): Promise<Exercise[]> {
    try {
      const exercisesJson = await AsyncStorage.getItem(EXERCISES_STORAGE_KEY);
      return exercisesJson ? JSON.parse(exercisesJson) : [];
    } catch (error) {
      console.error('Error fetching exercises:', error);
      throw error;
    }
  },

  async getExerciseById(id: string): Promise<Exercise | null> {
    try {
      const exercises = await this.getAllExercises();
      return exercises.find(exercise => exercise.id === id) || null;
    } catch (error) {
      console.error('Error fetching exercise:', error);
      throw error;
    }
  },

  async createExercise(exercise: Omit<Exercise, 'id'>): Promise<Exercise> {
    try {
      const exercises = await this.getAllExercises();
      const newExercise: Exercise = {
        ...exercise,
        id: Date.now().toString(), // Simple ID generation, replace with UUID if needed
      };
      
      await AsyncStorage.setItem(
        EXERCISES_STORAGE_KEY,
        JSON.stringify([...exercises, newExercise])
      );
      
      return newExercise;
    } catch (error) {
      console.error('Error creating exercise:', error);
      throw error;
    }
  },

  async updateExercise(id: string, exercise: Partial<Exercise>): Promise<Exercise> {
    try {
      const exercises = await this.getAllExercises();
      const index = exercises.findIndex(e => e.id === id);
      
      if (index === -1) {
        throw new Error('Exercise not found');
      }
      
      const updatedExercise = { ...exercises[index], ...exercise };
      exercises[index] = updatedExercise;
      
      await AsyncStorage.setItem(EXERCISES_STORAGE_KEY, JSON.stringify(exercises));
      return updatedExercise;
    } catch (error) {
      console.error('Error updating exercise:', error);
      throw error;
    }
  },

  async deleteExercise(id: string): Promise<void> {
    try {
      const exercises = await this.getAllExercises();
      const filteredExercises = exercises.filter(e => e.id !== id);
      
      await AsyncStorage.setItem(
        EXERCISES_STORAGE_KEY,
        JSON.stringify(filteredExercises)
      );
    } catch (error) {
      console.error('Error deleting exercise:', error);
      throw error;
    }
  },

  async searchExercises(query: string): Promise<Exercise[]> {
    try {
      const exercises = await this.getAllExercises();
      const lowerQuery = query.toLowerCase();
      
      return exercises.filter(exercise => 
        exercise.name.toLowerCase().includes(lowerQuery) ||
        exercise.category.toLowerCase().includes(lowerQuery) ||
        exercise.equipment.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      console.error('Error searching exercises:', error);
      throw error;
    }
  }
}; 