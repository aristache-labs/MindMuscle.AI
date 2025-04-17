import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

interface WorkoutProgress {
  id: string;
  date: string;
  workoutId: string;
  exercises: {
    exerciseId: string;
    sets: {
      weight: number;
      reps: number;
      completed: boolean;
    }[];
  }[];
  duration: number; // in minutes
  notes?: string;
}

interface PersonalRecord {
  exerciseId: string;
  weight: number;
  reps: number;
  date: string;
}

interface ProgressMetrics {
  totalWorkouts: number;
  totalDuration: number;
  averageWorkoutDuration: number;
  personalRecords: PersonalRecord[];
  lastWorkoutDate: string | null;
  streak: number;
}

interface ProgressContextType {
  workoutProgress: WorkoutProgress[];
  metrics: ProgressMetrics;
  addWorkoutProgress: (progress: Omit<WorkoutProgress, 'id'>) => Promise<void>;
  updatePersonalRecord: (record: PersonalRecord) => Promise<void>;
  loading: boolean;
}

const defaultMetrics: ProgressMetrics = {
  totalWorkouts: 0,
  totalDuration: 0,
  averageWorkoutDuration: 0,
  personalRecords: [],
  lastWorkoutDate: null,
  streak: 0,
};

const ProgressContext = createContext<ProgressContextType>({
  workoutProgress: [],
  metrics: defaultMetrics,
  addWorkoutProgress: async () => {},
  updatePersonalRecord: async () => {},
  loading: true,
});

export const ProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workoutProgress, setWorkoutProgress] = useState<WorkoutProgress[]>([]);
  const [metrics, setMetrics] = useState<ProgressMetrics>(defaultMetrics);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const [storedProgress, storedMetrics] = await Promise.all([
        AsyncStorage.getItem('workoutProgress'),
        AsyncStorage.getItem('progressMetrics'),
      ]);

      if (storedProgress) {
        setWorkoutProgress(JSON.parse(storedProgress));
      }

      if (storedMetrics) {
        setMetrics(JSON.parse(storedMetrics));
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (progress: WorkoutProgress[]): ProgressMetrics => {
    const totalWorkouts = progress.length;
    const totalDuration = progress.reduce((sum, workout) => sum + workout.duration, 0);
    const averageWorkoutDuration = totalWorkouts > 0 ? totalDuration / totalWorkouts : 0;

    // Calculate personal records
    const personalRecords: PersonalRecord[] = [];
    progress.forEach(workout => {
      workout.exercises.forEach(exercise => {
        exercise.sets.forEach(set => {
          if (set.completed) {
            const existingRecord = personalRecords.find(
              pr => pr.exerciseId === exercise.exerciseId
            );
            if (!existingRecord || set.weight > existingRecord.weight) {
              personalRecords.push({
                exerciseId: exercise.exerciseId,
                weight: set.weight,
                reps: set.reps,
                date: workout.date,
              });
            }
          }
        });
      });
    });

    // Calculate streak
    let streak = 0;
    const today = new Date();
    const sortedDates = progress
      .map(w => new Date(w.date))
      .sort((a, b) => b.getTime() - a.getTime());

    if (sortedDates.length > 0) {
      let currentDate = new Date(today);
      let lastWorkoutDate = sortedDates[0];

      while (
        format(currentDate, 'yyyy-MM-dd') === format(lastWorkoutDate, 'yyyy-MM-dd') ||
        (currentDate.getTime() - lastWorkoutDate.getTime()) / (1000 * 60 * 60 * 24) === 1
      ) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
        const nextWorkout = sortedDates.find(
          date => format(date, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd')
        );
        if (!nextWorkout) break;
        lastWorkoutDate = nextWorkout;
      }
    }

    return {
      totalWorkouts,
      totalDuration,
      averageWorkoutDuration,
      personalRecords,
      lastWorkoutDate: progress[0]?.date || null,
      streak,
    };
  };

  const addWorkoutProgress = async (progress: Omit<WorkoutProgress, 'id'>) => {
    try {
      const newProgress: WorkoutProgress = {
        ...progress,
        id: Date.now().toString(),
      };

      const updatedProgress = [newProgress, ...workoutProgress];
      const updatedMetrics = calculateMetrics(updatedProgress);

      await Promise.all([
        AsyncStorage.setItem('workoutProgress', JSON.stringify(updatedProgress)),
        AsyncStorage.setItem('progressMetrics', JSON.stringify(updatedMetrics)),
      ]);

      setWorkoutProgress(updatedProgress);
      setMetrics(updatedMetrics);
    } catch (error) {
      console.error('Error adding workout progress:', error);
    }
  };

  const updatePersonalRecord = async (record: PersonalRecord) => {
    try {
      const updatedRecords = [...metrics.personalRecords];
      const existingIndex = updatedRecords.findIndex(
        pr => pr.exerciseId === record.exerciseId
      );

      if (existingIndex >= 0) {
        updatedRecords[existingIndex] = record;
      } else {
        updatedRecords.push(record);
      }

      const updatedMetrics = {
        ...metrics,
        personalRecords: updatedRecords,
      };

      await AsyncStorage.setItem('progressMetrics', JSON.stringify(updatedMetrics));
      setMetrics(updatedMetrics);
    } catch (error) {
      console.error('Error updating personal record:', error);
    }
  };

  return (
    <ProgressContext.Provider
      value={{
        workoutProgress,
        metrics,
        addWorkoutProgress,
        updatePersonalRecord,
        loading,
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
};

export const useProgress = () => useContext(ProgressContext);

export default ProgressProvider; 