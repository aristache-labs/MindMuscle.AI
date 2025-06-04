import { validationService } from '../../../services/validationService';

describe('AddExerciseModal Validation', () => {
  describe('validateAddExerciseForm', () => {
    it('should validate valid exercise configurations', async () => {
      const validData = {
        exercises: [
          {
            exerciseId: 'exercise-123',
            name: 'Push-ups',
            sets: 3,
            reps_range: '8-12',
            image_url: 'https://example.com/pushup.jpg',
            muscle_group: 'Chest',
            primary_muscles: ['Chest', 'Triceps'],
            requires_weight: false,
          },
          {
            exerciseId: 'exercise-456',
            name: 'Squats',
            sets: 4,
            reps_range: '10-15',
            image_url: '',
            muscle_group: 'Legs',
            requires_weight: true,
          },
        ],
      };

      const result = await validationService.validateAddExerciseForm(validData);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
    });

    it('should reject empty exercise list', async () => {
      const invalidData = {
        exercises: [],
      };

      const result = await validationService.validateAddExerciseForm(invalidData);
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]?.message).toContain('At least one exercise must be selected');
    });

    it('should reject invalid exercise configuration', async () => {
      const invalidData = {
        exercises: [
          {
            exerciseId: '', // Invalid: empty ID
            name: '', // Invalid: empty name
            sets: 0, // Invalid: must be positive
            reps_range: 'invalid', // Invalid: wrong format
            image_url: 'not-a-url', // Invalid: not a URL
            muscle_group: '', // Invalid: empty
          },
        ],
      };

      const result = await validationService.validateAddExerciseForm(invalidData);
      expect(result.success).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should accept valid reps range formats', async () => {
      const validData = {
        exercises: [
          {
            exerciseId: 'exercise-123',
            name: 'Push-ups',
            sets: 3,
            reps_range: '8-12',
            muscle_group: 'Chest',
          },
        ],
      };

      const result = await validationService.validateAddExerciseForm(validData);
      expect(result.success).toBe(true);
    });

    it('should handle optional fields correctly', async () => {
      const validData = {
        exercises: [
          {
            exerciseId: 'exercise-123',
            name: 'Push-ups',
            sets: 3,
            reps_range: '8-12',
            muscle_group: 'Chest',
            // Optional fields omitted
          },
        ],
      };

      const result = await validationService.validateAddExerciseForm(validData);
      expect(result.success).toBe(true);
    });
  });
});
