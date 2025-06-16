import { MuscleGroup } from './types';

export const muscleGroups: MuscleGroup[] = [
  // Front view muscles
  {
    id: 1,
    name: 'Shoulders',
    dotPosition: { top: '25%', left: '30%' },
    textPosition: { top: '23%', left: '1%' },
    view: 'front',
  },
  {
    id: 17,
    name: 'Cardio',
    dotPosition: { top: '20%', right: '25%' },
    textPosition: { top: '18%', right: '1%' },
    view: 'front',
    heartPosition: { top: '20%', right: '25%' },
  },
  {
    id: 2,
    name: 'Chest',
    dotPosition: { top: '32%', left: '40%' },
    textPosition: { top: '30%', left: '1%' },
    view: 'front',
  },
  {
    id: 3,
    name: 'Biceps',
    dotPosition: { top: '35%', right: '31%' },
    textPosition: { top: '33%', right: '1%' },
    view: 'front',
  },
  {
    id: 4,
    name: 'Forearms',
    dotPosition: { top: '42%', left: '22%' },
    textPosition: { top: '40%', left: '1%' },
    view: 'front',
  },
  {
    id: 5,
    name: 'Abs',
    dotPosition: { top: '41%', right: '47%' },
    textPosition: { top: '39%', right: '1%' },
    view: 'front',
  },
  {
    id: 6,
    name: 'Obliques',
    dotPosition: { top: '48%', left: '34%' },
    textPosition: { top: '46%', left: '1%' },
    view: 'front',
  },
  {
    id: 7,
    name: 'Quads',
    dotPosition: { top: '58%', left: '39%' },
    textPosition: { top: '56%', left: '1%' },
    view: 'front',
  },
  {
    id: 8,
    name: 'Adductors',
    dotPosition: { top: '60%', right: '47%' },
    textPosition: { top: '58%', right: '1%' },
    view: 'front',
  },
  // Back view muscles
  {
    id: 9,
    name: 'Traps',
    dotPosition: { top: '24%', left: '44%' },
    textPosition: { top: '22%', left: '1%' },
    view: 'back',
  },
  {
    id: 10,
    name: 'Triceps',
    dotPosition: { top: '34%', left: '25%' },
    textPosition: { top: '32%', left: '1%' },
    view: 'back',
  },
  {
    id: 11,
    name: 'Abductors',
    dotPosition: { top: '44%', left: '35%' },
    textPosition: { top: '42%', left: '1%' },
    view: 'back',
  },
  {
    id: 12,
    name: 'Lats',
    dotPosition: { top: '31%', right: '39%' },
    textPosition: { top: '29%', right: '1%' },
    view: 'back',
  },
  {
    id: 13,
    name: 'Lower back',
    dotPosition: { top: '42%', right: '44%' },
    textPosition: { top: '40%', right: '1%' },
    view: 'back',
  },
  {
    id: 14,
    name: 'Glutes',
    dotPosition: { top: '50%', right: '45%' },
    textPosition: { top: '48%', right: '1%' },
    view: 'back',
  },
  {
    id: 15,
    name: 'Hamstrings',
    dotPosition: { top: '58%', left: '36%' },
    textPosition: { top: '56%', left: '1%' },
    view: 'back',
  },
  {
    id: 16,
    name: 'Calves',
    dotPosition: { top: '70%', left: '34%' },
    textPosition: { top: '68%', left: '1%' },
    view: 'back',
  },
];

export const FALLBACK_IMAGE_OBJECT = {
  uri: null,
  testUri: '../../assets/exercises/placeholder.jpg',
};

// Default export to satisfy Expo Router (this file should not be a route)
export default function AddExerciseModalConstants() {
  return null;
}
