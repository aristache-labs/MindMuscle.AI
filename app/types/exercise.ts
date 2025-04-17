export interface Exercise {
  id: string;
  name: string;
  category: string;
  equipment: string;
  difficulty: string;
  description: string;
  instructions: string[];
  muscles: string[];
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseSet {
  id: string;
  reps: number;
  weight: number;
  notes?: string;
}

export interface ExerciseInWorkout {
  id: string;
  exerciseId: string;
  name: string;
  sets: ExerciseSet[];
  notes?: string;
}

export default Exercise; 