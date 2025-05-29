import { SharedValue } from 'react-native-reanimated';

export interface ExerciseSet {
  id: string;
  setNumber: number;
  weight: string;
  reps: string;
  isCompleted: boolean;
}

export interface Recommendation {
  weight: number;
  reps: number;
  sets: number;
}

export interface DragDropItem {
  id: string;
  exercise_id: string;
  name: string;
  sets: number;
  reps_range: string;
  image_url?: string;
  primary_muscles?: string[];
  order: number;
  workout_day: number;
  requires_weight?: boolean;
}

export type ItemPositions = {
  [key: string]: {
    updatedIndex: number;
    updatedTop: number;
  };
};

export type NullableString = null | string;

export interface DragDropListProps {
  data: DragDropItem[];
  onReorder: (reorderedData: DragDropItem[]) => void;
  itemHeight: number;
  renderItem: (item: DragDropItem, index: number, isDragging: boolean) => React.ReactNode;
  keyExtractor: (item: DragDropItem) => string;
}

export interface DragDropItemProps {
  item: DragDropItem;
  index: number;
  itemHeight: number;
  isDragging: SharedValue<0 | 1>;
  draggedItemId: SharedValue<NullableString>;
  currentItemPositions: SharedValue<ItemPositions>;
  renderItem: (item: DragDropItem, index: number, isDragging: boolean) => React.ReactNode;
}
