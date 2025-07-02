// Workout Utils
// Export workout utility functions here when they are created

export * from './exerciseSetUtils';

/**
 * Validates if a value represents actual meaningful workout history data
 * and should be displayed in "Last xxx" labels.
 *
 * @param value - The history value to validate (weight, reps, etc.)
 * @returns true if the value is meaningful history data, false otherwise
 */
export const hasValidHistoryValue = (value: string | undefined): boolean => {
  if (!value) return false;

  // Trim whitespace and check if it's empty
  const trimmedValue = value.trim();
  if (!trimmedValue) return false;

  // Check for common placeholder values that should not be shown as "Last"
  const placeholders = ['--', '-', '0', 'N/A', 'n/a'];
  if (placeholders.includes(trimmedValue)) return false;

  // For numeric values, ensure they're valid numbers greater than 0
  const numericValue = parseFloat(trimmedValue);
  if (!isNaN(numericValue) && numericValue <= 0) return false;

  return true;
};

export default function disablewarn() {
  return null;
}
