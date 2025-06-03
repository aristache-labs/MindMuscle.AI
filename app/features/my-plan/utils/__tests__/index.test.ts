import { Exercise } from '../../types';
import { calculateWorkoutStats, formatDurationAsHMM } from '../index';

describe('My Plan Utils', () => {
  describe('formatDurationAsHMM', () => {
    it('should format duration string correctly', () => {
      expect(formatDurationAsHMM('01:30:45')).toBe('1:30');
      expect(formatDurationAsHMM('00:45:30')).toBe('0:45');
      expect(formatDurationAsHMM('02:00:00')).toBe('2:00');
      expect(formatDurationAsHMM('00:05:30')).toBe('0:05');
    });

    it('should handle edge cases', () => {
      expect(formatDurationAsHMM('00:00:30')).toBe('0:00');
      expect(formatDurationAsHMM('00:00:00')).toBe('0:00');
      expect(formatDurationAsHMM('')).toBe('0:00');
    });

    it('should handle invalid input gracefully', () => {
      expect(formatDurationAsHMM('invalid')).toBe('0:00');
      expect(formatDurationAsHMM('25')).toBe('0:00');
    });
  });

  describe('calculateWorkoutStats', () => {
    const mockExercises: Exercise[] = [
      {
        id: '1',
        name: 'Push-ups',
        sets: 3,
        reps_range: '10-15',
        workout_day: 1,
        exercise_id: 'ex1',
        image_url: '',
        primary_muscles: ['chest'],
      },
      {
        id: '2',
        name: 'Squats',
        sets: 4,
        reps_range: '12-20',
        workout_day: 1,
        exercise_id: 'ex2',
        image_url: '',
        primary_muscles: ['quadriceps'],
      },
    ];

    it('should calculate workout stats correctly', () => {
      const stats = calculateWorkoutStats(mockExercises);

      expect(stats.exerciseCount).toBe(2);
      expect(stats.duration).toBeGreaterThan(0);
      expect(stats.calories).toBeGreaterThan(0);
    });

    it('should handle empty exercise array', () => {
      const stats = calculateWorkoutStats([]);

      expect(stats.exerciseCount).toBe(0);
      expect(stats.duration).toBe(0);
      expect(stats.calories).toBe(0); // No exercises = no calories burned
    });

    it('should return consistent structure', () => {
      const stats = calculateWorkoutStats(mockExercises);

      expect(stats).toHaveProperty('exerciseCount');
      expect(stats).toHaveProperty('duration');
      expect(stats).toHaveProperty('calories');
      expect(typeof stats.exerciseCount).toBe('number');
      expect(typeof stats.duration).toBe('number');
      expect(typeof stats.calories).toBe('number');
    });
  });
});
