import { validationService } from '../../app/services/validationService';
import {
  CompleteWorkoutOptionsSchema,
  ExerciseRecordSchema,
  WorkoutHistoryRecordSchema,
} from '../../app/validation/schemas';

describe('Workout Data Validation', () => {
  describe('WorkoutHistoryRecordSchema', () => {
    it('should validate a valid workout history record', () => {
      const validRecord = {
        user_id: 'user-123',
        plan_id: 'plan-456',
        workout_day: 1,
        cycle_week: 2,
        week_name: 'Week 2',
        workout_duration: '45:30',
        calories_burned: 350,
        total_volume: 1500,
        total_reps: 120,
        completed_at: '2024-01-15T10:30:00Z',
        exercises_count: 5,
        exercise_structure: '[]',
      };

      const result = WorkoutHistoryRecordSchema.safeParse(validRecord);
      expect(result.success).toBe(true);
    });

    it('should reject workout history with invalid data', () => {
      const invalidRecord = {
        user_id: '',
        plan_id: 'plan-456',
        workout_day: 0, // Invalid: must be positive
        cycle_week: -1, // Invalid: must be positive
        week_name: '', // Invalid: must not be empty
        workout_duration: '', // Invalid: must not be empty
        calories_burned: -100, // Invalid: must be non-negative
        total_volume: -50, // Invalid: must be non-negative
        total_reps: -10, // Invalid: must be non-negative
        completed_at: 'invalid-date',
        exercises_count: 0, // Invalid: must be positive
      };

      const result = WorkoutHistoryRecordSchema.safeParse(invalidRecord);
      expect(result.success).toBe(false);
    });
  });

  describe('ExerciseRecordSchema', () => {
    it('should validate a valid exercise record', () => {
      const validRecord = {
        workout_history_id: 'history-123',
        exercise_id: 'exercise-456',
        workout_plan_exercise_id: 'plan-exercise-789',
        set_number: 1,
        weight: 50,
        reps: 12,
        completed: true,
      };

      const result = ExerciseRecordSchema.safeParse(validRecord);
      expect(result.success).toBe(true);
    });

    it('should reject exercise record with invalid data', () => {
      const invalidRecord = {
        workout_history_id: '',
        exercise_id: '',
        workout_plan_exercise_id: '',
        set_number: 0, // Invalid: must be positive
        weight: -10, // Invalid: must be non-negative
        reps: -5, // Invalid: must be non-negative
        completed: 'not-boolean', // Invalid: must be boolean
      };

      const result = ExerciseRecordSchema.safeParse(invalidRecord);
      expect(result.success).toBe(false);
    });
  });

  describe('CompleteWorkoutOptionsSchema', () => {
    it('should validate valid complete workout options', () => {
      const validOptions = {
        userId: 'user-123',
        planId: 'plan-456',
        workoutDay: 1,
        cycleWeek: 2,
        weekName: 'Week 2',
        exercises: [
          {
            id: 'exercise-1',
            name: 'Push-ups',
            sets: 3,
            reps_range: '10-15',
            image_url: 'https://example.com/pushup.jpg',
            workout_day: 1,
            muscle_group: 'Chest',
            requires_weight: false,
          },
        ],
        exerciseSets: {
          'exercise-1': [
            {
              id: 'set-1',
              setNumber: 1,
              isCompleted: true,
              weight: '0',
              reps: '12',
            },
          ],
        },
        workoutDuration: 2700, // 45 minutes in seconds
        totalVolume: 1500,
        totalReps: 120,
        isRedoWorkout: false,
      };

      const result = CompleteWorkoutOptionsSchema.safeParse(validOptions);
      expect(result.success).toBe(true);
    });

    it('should reject complete workout options with invalid data', () => {
      const invalidOptions = {
        userId: '',
        planId: '',
        workoutDay: 0, // Invalid: must be positive
        cycleWeek: 0, // Invalid: must be positive
        weekName: '', // Invalid: must not be empty
        exercises: [], // Valid but empty
        exerciseSets: {},
        workoutDuration: 0, // Invalid: must be positive
        totalVolume: -100, // Invalid: must be non-negative
        totalReps: -50, // Invalid: must be non-negative
      };

      const result = CompleteWorkoutOptionsSchema.safeParse(invalidOptions);
      expect(result.success).toBe(false);
    });
  });

  describe('ValidationService Methods', () => {
    it('should validate workout history record using service', async () => {
      const validRecord = {
        user_id: 'user-123',
        plan_id: 'plan-456',
        workout_day: 1,
        cycle_week: 2,
        week_name: 'Week 2',
        workout_duration: '45:30',
        calories_burned: 350,
        total_volume: 1500,
        total_reps: 120,
        completed_at: '2024-01-15T10:30:00Z',
        exercises_count: 5,
      };

      const result = await validationService.validateWorkoutHistoryRecord(validRecord);
      expect(result.success).toBe(true);
    });

    it('should validate exercise record using service', async () => {
      const validRecord = {
        workout_history_id: 'history-123',
        exercise_id: 'exercise-456',
        workout_plan_exercise_id: 'plan-exercise-789',
        set_number: 1,
        weight: 50,
        reps: 12,
        completed: true,
      };

      const result = await validationService.validateExerciseRecord(validRecord);
      expect(result.success).toBe(true);
    });

    it('should validate complete workout options using service', async () => {
      const validOptions = {
        userId: 'user-123',
        planId: 'plan-456',
        workoutDay: 1,
        cycleWeek: 2,
        weekName: 'Week 2',
        exercises: [
          {
            id: 'exercise-1',
            name: 'Push-ups',
            sets: 3,
            reps_range: '10-15',
            image_url: 'https://example.com/pushup.jpg',
            workout_day: 1,
            muscle_group: 'Chest',
            requires_weight: false,
          },
        ],
        exerciseSets: {
          'exercise-1': [
            {
              id: 'set-1',
              setNumber: 1,
              isCompleted: true,
              weight: '0',
              reps: '12',
            },
          ],
        },
        workoutDuration: 2700,
        totalVolume: 1500,
        totalReps: 120,
      };

      const result = await validationService.validateCompleteWorkoutOptions(validOptions);
      expect(result.success).toBe(true);
    });
  });
});
