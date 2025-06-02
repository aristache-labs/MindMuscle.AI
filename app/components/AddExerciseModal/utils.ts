import { MuscleGroup } from './types';

// Helper functions for muscle group positioning
export const getPositionValue = (
  position: { left?: string; right?: string },
  defaultValue = '0',
) => {
  if (position.right) {
    return 100 - parseFloat(position.right);
  }
  return parseFloat(position.left || defaultValue);
};

export const calculateClickableZoneWidth = (muscle: MuscleGroup) => {
  const textPos = getPositionValue(muscle.textPosition);
  const dotPos = getPositionValue(muscle.dotPosition);
  return Math.abs(textPos - dotPos) + 5;
};

export const calculateClickableZoneLeft = (muscle: MuscleGroup) => {
  if (muscle.textPosition.right) {
    return (
      100 -
      Math.max(parseFloat(muscle.textPosition.right), parseFloat(muscle.dotPosition.right || '0'))
    );
  }
  return Math.min(
    parseFloat(muscle.dotPosition.left || '100'),
    parseFloat(muscle.textPosition.left || '100'),
  );
};

export const calculateDottedLineWidth = (muscle: MuscleGroup) => {
  const textPos = getPositionValue(muscle.textPosition);
  const dotPos = getPositionValue(muscle.dotPosition);
  return Math.abs(textPos - dotPos);
};

export const calculateDottedLineLeft = (muscle: MuscleGroup) => {
  return calculateClickableZoneLeft(muscle);
};
