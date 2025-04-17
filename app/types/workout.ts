import { ExerciseInWorkout } from './exercise';

export interface Workout {
  id: string;
  name: string;
  date: string;
  duration?: number;
  notes?: string;
  exercises: ExerciseInWorkout[];
  createdAt: string;
  updatedAt: string;
}

export default Workout;

export type WorkoutSet = {
  id: string;
  exerciseId: string;
  reps: number;
  weight: number;
  notes?: string;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string;
  sets: WorkoutSet[];
  notes?: string;
}; 