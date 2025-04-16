import AsyncStorage from '@react-native-async-storage/async-storage';
import { Workout, WorkoutExercise, WorkoutSet } from '../types/workout';

const WORKOUTS_STORAGE_KEY = '@workouts';

export const workoutService = {
  async getAllWorkouts(): Promise<Workout[]> {
    try {
      const workoutsJson = await AsyncStorage.getItem(WORKOUTS_STORAGE_KEY);
      return workoutsJson ? JSON.parse(workoutsJson) : [];
    } catch (error) {
      console.error('Error fetching workouts:', error);
      throw error;
    }
  },

  async getWorkoutById(id: string): Promise<Workout | null> {
    try {
      const workouts = await this.getAllWorkouts();
      return workouts.find(workout => workout.id === id) || null;
    } catch (error) {
      console.error('Error fetching workout:', error);
      throw error;
    }
  },

  async createWorkout(workout: Omit<Workout, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workout> {
    try {
      const workouts = await this.getAllWorkouts();
      const now = new Date().toISOString();
      
      const newWorkout: Workout = {
        ...workout,
        id: Date.now().toString(),
        createdAt: now,
        updatedAt: now,
      };
      
      await AsyncStorage.setItem(
        WORKOUTS_STORAGE_KEY,
        JSON.stringify([...workouts, newWorkout])
      );
      
      return newWorkout;
    } catch (error) {
      console.error('Error creating workout:', error);
      throw error;
    }
  },

  async updateWorkout(id: string, workout: Partial<Workout>): Promise<Workout> {
    try {
      const workouts = await this.getAllWorkouts();
      const index = workouts.findIndex(w => w.id === id);
      
      if (index === -1) {
        throw new Error('Workout not found');
      }
      
      const updatedWorkout = {
        ...workouts[index],
        ...workout,
        updatedAt: new Date().toISOString(),
      };
      
      workouts[index] = updatedWorkout;
      
      await AsyncStorage.setItem(WORKOUTS_STORAGE_KEY, JSON.stringify(workouts));
      return updatedWorkout;
    } catch (error) {
      console.error('Error updating workout:', error);
      throw error;
    }
  },

  async deleteWorkout(id: string): Promise<void> {
    try {
      const workouts = await this.getAllWorkouts();
      const filteredWorkouts = workouts.filter(w => w.id !== id);
      
      await AsyncStorage.setItem(
        WORKOUTS_STORAGE_KEY,
        JSON.stringify(filteredWorkouts)
      );
    } catch (error) {
      console.error('Error deleting workout:', error);
      throw error;
    }
  },

  async addExerciseToWorkout(workoutId: string, exercise: Omit<WorkoutExercise, 'id' | 'sets'>): Promise<Workout> {
    try {
      const workout = await this.getWorkoutById(workoutId);
      if (!workout) {
        throw new Error('Workout not found');
      }

      const newExercise: WorkoutExercise = {
        ...exercise,
        id: Date.now().toString(),
        sets: [],
      };

      const updatedWorkout = {
        ...workout,
        exercises: [...workout.exercises, newExercise],
        updatedAt: new Date().toISOString(),
      };

      return await this.updateWorkout(workoutId, updatedWorkout);
    } catch (error) {
      console.error('Error adding exercise to workout:', error);
      throw error;
    }
  },

  async addSetToExercise(workoutId: string, exerciseId: string, set: Omit<WorkoutSet, 'id'>): Promise<Workout> {
    try {
      const workout = await this.getWorkoutById(workoutId);
      if (!workout) {
        throw new Error('Workout not found');
      }

      const exerciseIndex = workout.exercises.findIndex(e => e.id === exerciseId);
      if (exerciseIndex === -1) {
        throw new Error('Exercise not found in workout');
      }

      const newSet: WorkoutSet = {
        ...set,
        id: Date.now().toString(),
      };

      const updatedExercises = [...workout.exercises];
      updatedExercises[exerciseIndex] = {
        ...updatedExercises[exerciseIndex],
        sets: [...updatedExercises[exerciseIndex].sets, newSet],
      };

      const updatedWorkout = {
        ...workout,
        exercises: updatedExercises,
        updatedAt: new Date().toISOString(),
      };

      return await this.updateWorkout(workoutId, updatedWorkout);
    } catch (error) {
      console.error('Error adding set to exercise:', error);
      throw error;
    }
  },

  async getWorkoutsByDateRange(startDate: string, endDate: string): Promise<Workout[]> {
    try {
      const workouts = await this.getAllWorkouts();
      return workouts.filter(workout => {
        const workoutDate = new Date(workout.date);
        return workoutDate >= new Date(startDate) && workoutDate <= new Date(endDate);
      });
    } catch (error) {
      console.error('Error fetching workouts by date range:', error);
      throw error;
    }
  },

  async updateSet(workoutId: string, exerciseId: string, setId: string, set: WorkoutSet): Promise<Workout> {
    try {
      const workout = await this.getWorkoutById(workoutId);
      if (!workout) {
        throw new Error('Workout not found');
      }

      const exerciseIndex = workout.exercises.findIndex(e => e.id === exerciseId);
      if (exerciseIndex === -1) {
        throw new Error('Exercise not found in workout');
      }

      const setIndex = workout.exercises[exerciseIndex].sets.findIndex(s => s.id === setId);
      if (setIndex === -1) {
        throw new Error('Set not found in exercise');
      }

      const updatedExercises = [...workout.exercises];
      updatedExercises[exerciseIndex] = {
        ...updatedExercises[exerciseIndex],
        sets: [
          ...updatedExercises[exerciseIndex].sets.slice(0, setIndex),
          set,
          ...updatedExercises[exerciseIndex].sets.slice(setIndex + 1),
        ],
      };

      const updatedWorkout = {
        ...workout,
        exercises: updatedExercises,
        updatedAt: new Date().toISOString(),
      };

      return await this.updateWorkout(workoutId, updatedWorkout);
    } catch (error) {
      console.error('Error updating set:', error);
      throw error;
    }
  },
}; 