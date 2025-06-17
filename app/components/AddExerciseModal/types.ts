import { Animated } from 'react-native';
import { Exercise } from '../../services/exerciseService';

export interface SelectedExercise extends Exercise {
  sets: number;
  reps_range: string;
  requires_weight?: boolean;
}

export interface ExerciseConfiguration {
  exerciseId: string;
  name: string;
  sets: number;
  reps_range: string;
  image_url?: string;
  muscle_group: string;
  primary_muscles?: string[];
  requires_weight?: boolean;
}

export interface AddExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  onAddExercises: (exercises: ExerciseConfiguration[]) => void;
  currentWorkoutExercises?: Array<{ id: string; exercise_id?: string; name: string }>;
}

export interface MuscleGroup {
  id: number;
  name: string;
  dotPosition: {
    top: string;
    left?: string;
    right?: string;
  };
  textPosition: {
    top: string;
    left?: string;
    right?: string;
  };
  view: 'front' | 'back';
  heartPosition?: {
    top: string;
    left?: string;
    right?: string;
  };
}

export interface MuscleMarkerProps {
  muscle: MuscleGroup;
  pulseAnim: Animated.Value;
  onPress: (muscleName: string) => void;
}

// Default export to satisfy Expo Router (this file should not be a route)
export default function TypesRouterPlaceholder() {
  return null;
}
