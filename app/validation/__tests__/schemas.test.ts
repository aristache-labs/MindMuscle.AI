import {
  ExerciseConfigurationSchema,
  ExerciseSchema,
  GeneralExerciseSchema,
  LoginFormSchema,
  MeasurementSchema,
  RegisterFormSchema,
  UserProfileSchema,
} from '../schemas';

describe('Validation Schemas', () => {
  describe('GeneralExerciseSchema', () => {
    it('should validate a valid general exercise', () => {
      const validExercise = {
        id: 'exercise-123',
        name: 'Push-ups',
        description: 'A basic bodyweight exercise',
        muscle_group: 'Chest',
        primary_muscles: ['Chest', 'Triceps'],
        secondary_muscles: ['Shoulders'],
        equipment: 'None',
        difficulty: 'Beginner',
        instructions: ['Start in plank position', 'Lower body', 'Push back up'],
        image_url: 'https://example.com/pushup.jpg',
        video_url: 'https://example.com/pushup.mp4',
        requires_weight: false,
        is_favorite: false,
        category: 'Strength',
      };

      const result = GeneralExerciseSchema.safeParse(validExercise);
      expect(result.success).toBe(true);
    });

    it('should reject exercise with missing required fields', () => {
      const invalidExercise = {
        name: 'Push-ups',
        // missing id
      };

      const result = GeneralExerciseSchema.safeParse(invalidExercise);
      expect(result.success).toBe(false);
    });
  });

  describe('ExerciseSchema (Workout Exercise)', () => {
    it('should validate a valid workout exercise', () => {
      const validExercise = {
        id: 'exercise-123',
        name: 'Push-ups',
        sets: 3,
        reps_range: '10-15',
        workout_day: 1,
        muscle_group: 'Chest',
        primary_muscles: ['Chest', 'Triceps'],
        requires_weight: false,
      };

      const result = ExerciseSchema.safeParse(validExercise);
      expect(result.success).toBe(true);
    });

    it('should reject exercise with invalid reps range', () => {
      const invalidExercise = {
        id: 'exercise-123',
        name: 'Push-ups',
        sets: 3,
        reps_range: 'invalid-range', // Invalid format
        workout_day: 1,
        muscle_group: 'Chest',
        requires_weight: false,
      };

      const result = ExerciseSchema.safeParse(invalidExercise);
      expect(result.success).toBe(false);
    });
  });

  describe('ExerciseConfigurationSchema', () => {
    it('should validate a valid exercise configuration', () => {
      const validConfig = {
        exerciseId: 'exercise-123',
        name: 'Push-ups',
        sets: 3,
        reps_range: '10-15',
        muscle_group: 'Chest',
        primary_muscles: ['Chest', 'Triceps'],
        requires_weight: false,
      };

      const result = ExerciseConfigurationSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should reject configuration with invalid sets', () => {
      const invalidConfig = {
        exerciseId: 'exercise-123',
        name: 'Push-ups',
        sets: 0, // Invalid: must be positive
        reps_range: '10-15',
        muscle_group: 'Chest',
        primary_muscles: ['Chest'],
        requires_weight: false,
      };

      const result = ExerciseConfigurationSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('LoginFormSchema', () => {
    it('should validate a valid login form', () => {
      const validLogin = {
        email: 'user@example.com',
        password: 'securePassword123',
      };

      const result = LoginFormSchema.safeParse(validLogin);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidLogin = {
        email: 'invalid-email',
        password: 'securePassword123',
      };

      const result = LoginFormSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const invalidLogin = {
        email: 'user@example.com',
        password: '123', // Too short
      };

      const result = LoginFormSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
    });
  });

  describe('RegisterFormSchema', () => {
    it('should validate a valid registration form', () => {
      const validRegister = {
        email: 'user@example.com',
        password: 'securePassword123',
        confirmPassword: 'securePassword123',
        fullName: 'John Doe',
      };

      const result = RegisterFormSchema.safeParse(validRegister);
      expect(result.success).toBe(true);
    });

    it('should reject mismatched passwords', () => {
      const invalidRegister = {
        email: 'user@example.com',
        password: 'securePassword123',
        confirmPassword: 'differentPassword',
        fullName: 'John Doe',
      };

      const result = RegisterFormSchema.safeParse(invalidRegister);
      expect(result.success).toBe(false);
    });

    it('should reject empty names', () => {
      const invalidRegister = {
        email: 'user@example.com',
        password: 'securePassword123',
        confirmPassword: 'securePassword123',
        fullName: '', // Empty
      };

      const result = RegisterFormSchema.safeParse(invalidRegister);
      expect(result.success).toBe(false);
    });
  });

  describe('UserProfileSchema', () => {
    it('should validate a valid user profile', () => {
      const validProfile = {
        id: 'user-123',
        email: 'user@example.com',
        full_name: 'John Doe',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const result = UserProfileSchema.safeParse(validProfile);
      expect(result.success).toBe(true);
    });

    it('should validate minimal user profile', () => {
      const minimalProfile = {
        id: 'user-123',
      };

      const result = UserProfileSchema.safeParse(minimalProfile);
      expect(result.success).toBe(true);
    });
  });

  describe('MeasurementSchema', () => {
    it('should validate a valid measurement', () => {
      const validMeasurement = {
        user_id: 'user-123',
        measurement_type: 'weight',
        value: 75.5,
        unit: 'kg',
        measured_at: '2023-01-01T00:00:00Z',
      };

      const result = MeasurementSchema.safeParse(validMeasurement);
      expect(result.success).toBe(true);
    });

    it('should reject negative measurement value', () => {
      const invalidMeasurement = {
        user_id: 'user-123',
        measurement_type: 'weight',
        value: -10, // Invalid: negative value
        unit: 'kg',
        measured_at: '2023-01-01T00:00:00Z',
      };

      const result = MeasurementSchema.safeParse(invalidMeasurement);
      expect(result.success).toBe(false);
    });

    it('should reject invalid measurement type', () => {
      const invalidMeasurement = {
        user_id: 'user-123',
        measurement_type: 'invalid_type', // Invalid type
        value: 75.5,
        unit: 'kg',
        measured_at: '2023-01-01T00:00:00Z',
      };

      const result = MeasurementSchema.safeParse(invalidMeasurement);
      expect(result.success).toBe(false);
    });
  });
});
