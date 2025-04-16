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

export type Workout = {
  id: string;
  name: string;
  date: string;
  exercises: WorkoutExercise[];
  notes?: string;
  duration?: number; // in minutes
  createdAt: string;
  updatedAt: string;
}; 