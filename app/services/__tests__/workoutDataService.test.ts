import { validationService } from '../validationService';

describe('WorkoutDataService Validation', () => {
  describe('validateFetchWorkoutData', () => {
    it('should validate valid fetch workout data', async () => {
      const validData = {
        planId: 'plan-123',
        workoutDay: 1,
        userId: 'user-123',
        cycleWeek: 1,
        isRedoWorkout: false,
      };

      const result = await validationService.validateFetchWorkoutData(validData);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
    });

    it('should reject invalid fetch workout data', async () => {
      const invalidData = {
        planId: '', // Invalid: empty string
        workoutDay: 0, // Invalid: must be positive
        userId: 'user-123',
        cycleWeek: -1, // Invalid: must be positive
      };

      const result = await validationService.validateFetchWorkoutData(invalidData);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('validateCheckWorkoutCompletion', () => {
    it('should validate valid check workout completion data', async () => {
      const validData = {
        userId: 'user-123',
        planId: 'plan-123',
        workoutDay: 1,
      };

      const result = await validationService.validateCheckWorkoutCompletion(validData);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
    });

    it('should reject invalid check workout completion data', async () => {
      const invalidData = {
        userId: '', // Invalid: empty string
        planId: 'plan-123',
        workoutDay: 0, // Invalid: must be positive
      };

      const result = await validationService.validateCheckWorkoutCompletion(invalidData);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('validateFetchLastExerciseRecords', () => {
    it('should validate valid fetch last exercise records data', async () => {
      const validData = {
        userId: 'user-123',
        exercises: [
          {
            id: 'exercise-1',
            name: 'Push-ups',
            sets: 3,
            reps_range: '8-12',
            workout_day: 1,
            exercise_id: 'ex-123',
            requires_weight: false,
          },
        ],
      };

      const result = await validationService.validateFetchLastExerciseRecords(validData);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
    });

    it('should reject invalid fetch last exercise records data', async () => {
      const invalidData = {
        userId: '', // Invalid: empty string
        exercises: [], // Invalid: empty array
      };

      const result = await validationService.validateFetchLastExerciseRecords(invalidData);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('validateGetLastCompletedWorkoutStructure', () => {
    it('should validate valid get last completed workout structure data', async () => {
      const validData = {
        userId: 'user-123',
        planId: 'plan-123',
        workoutDay: 1,
        cycleWeek: 1,
      };

      const result = await validationService.validateGetLastCompletedWorkoutStructure(validData);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
    });

    it('should reject invalid get last completed workout structure data', async () => {
      const invalidData = {
        userId: '', // Invalid: empty string
        planId: 'plan-123',
        workoutDay: 0, // Invalid: must be positive
        cycleWeek: -1, // Invalid: must be positive
      };

      const result = await validationService.validateGetLastCompletedWorkoutStructure(invalidData);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('validateCheckWorkoutCompletionForCycleWeek', () => {
    it('should validate valid check workout completion for cycle week data', async () => {
      const validData = {
        userId: 'user-123',
        planId: 'plan-123',
        workoutDay: 1,
        cycleWeek: 1,
      };

      const result = await validationService.validateCheckWorkoutCompletionForCycleWeek(validData);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validData);
    });

    it('should reject invalid check workout completion for cycle week data', async () => {
      const invalidData = {
        userId: '', // Invalid: empty string
        planId: 'plan-123',
        workoutDay: 0, // Invalid: must be positive
        cycleWeek: -1, // Invalid: must be positive
      };

      const result =
        await validationService.validateCheckWorkoutCompletionForCycleWeek(invalidData);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });
});
