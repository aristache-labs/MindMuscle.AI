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
  id?: string;
  setNumber?: number;
  reps?: string;
  weight?: string;
  notes?: string;
  isCompleted?: boolean;
}

export interface ExerciseInWorkout {
  id: string;
  exerciseId: string;
  name: string;
  sets: ExerciseSet[];
  notes?: string;
}

// Dummy component to satisfy Expo Router's requirements
const ExerciseTypes = () => null;
export default ExerciseTypes;
