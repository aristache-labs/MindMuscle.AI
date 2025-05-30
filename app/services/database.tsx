import { createContext, useContext } from 'react';
import supabase from './supabase';

export const db = {
  // User operations
  createUser: async (data: {
    email: string;
    name: string;
    hashedPassword: string;
    preferences?: {
      goal: string;
      measurementUnit: string;
    };
  }) => {
    // Create user in auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.hashedPassword,
    });

    if (authError) throw authError;

    // Create user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user?.id,
        email: data.email,
        name: data.name,
      })
      .select()
      .single();

    if (userError) throw userError;

    // Create preferences if provided
    if (data.preferences) {
      const { error: prefError } = await supabase.from('user_preferences').insert({
        user_id: userData.id,
        goal: data.preferences.goal,
        measurement_unit: data.preferences.measurementUnit,
      });

      if (prefError) throw prefError;
    }

    // Create stats
    const { error: statsError } = await supabase.from('user_stats').insert({
      user_id: userData.id,
    });

    if (statsError) throw statsError;

    return userData;
  },

  getUserByEmail: async (email: string) => {
    const { data, error } = await supabase
      .from('users')
      .select(
        `
        *,
        preferences:user_preferences(*),
        stats:user_stats(*)
      `,
      )
      .eq('email', email)
      .single();

    if (error) throw error;
    return data;
  },

  // Exercise operations
  createExercise: async (data: {
    name: string;
    description: string;
    type: string;
    difficulty: string;
    muscleGroups: string;
    equipment: string;
    instructions: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    isCustom?: boolean;
  }) => {
    const { data: exercise, error } = await supabase
      .from('exercises')
      .insert({
        name: data.name,
        description: data.description,
        type: data.type,
        difficulty: data.difficulty,
        muscle_groups: data.muscleGroups,
        equipment: data.equipment,
        instructions: data.instructions,
        video_url: data.videoUrl,
        thumbnail_url: data.thumbnailUrl,
        is_custom: data.isCustom || false,
      })
      .select()
      .single();

    if (error) throw error;
    return exercise;
  },

  getExercises: async (filters?: {
    type?: string;
    difficulty?: string;
    muscleGroups?: string;
    equipment?: string;
    isCustom?: boolean;
  }) => {
    let query = supabase.from('exercises').select('*');

    if (filters) {
      if (filters.type) query = query.eq('type', filters.type);
      if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);
      if (filters.muscleGroups) query = query.ilike('muscle_groups', `%${filters.muscleGroups}%`);
      if (filters.equipment) query = query.ilike('equipment', `%${filters.equipment}%`);
      if (filters.isCustom !== undefined) query = query.eq('is_custom', filters.isCustom);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Workout operations
  createWorkout: async (data: {
    name: string;
    description: string;
    type: string;
    difficulty: string;
    duration: number;
    calories: number;
    isCustom?: boolean;
    createdBy?: string;
    exercises: {
      exerciseId: string;
      sets: number;
      reps?: number;
      weight?: number;
      duration?: number;
      distance?: number;
      order: number;
    }[];
  }) => {
    // Create workout
    const { data: workout, error } = await supabase
      .from('workouts')
      .insert({
        name: data.name,
        description: data.description,
        type: data.type,
        difficulty: data.difficulty,
        duration: data.duration,
        calories: data.calories,
        is_custom: data.isCustom || false,
        created_by: data.createdBy,
      })
      .select()
      .single();

    if (error) throw error;

    // Add exercises to workout
    const workoutExercises = data.exercises.map((ex) => ({
      workout_id: workout.id,
      exercise_id: ex.exerciseId,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
      duration: ex.duration,
      order: ex.order,
    }));

    const { error: exercisesError } = await supabase
      .from('workout_exercises')
      .insert(workoutExercises);

    if (exercisesError) throw exercisesError;

    // Return workout with exercises
    const { data: completeWorkout, error: fetchError } = await supabase
      .from('workouts')
      .select(
        `
        *,
        exercises:workout_exercises(
          *,
          exercise:exercises(*)
        )
      `,
      )
      .eq('id', workout.id)
      .single();

    if (fetchError) throw fetchError;
    return completeWorkout;
  },

  getWorkouts: async (filters?: {
    type?: string;
    difficulty?: string;
    isCustom?: boolean;
    createdBy?: string;
  }) => {
    let query = supabase.from('workouts').select(`
        *,
        exercises:workout_exercises(
          *,
          exercise:exercises(*)
        )
      `);

    if (filters) {
      if (filters.type) query = query.eq('type', filters.type);
      if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);
      if (filters.isCustom !== undefined) query = query.eq('is_custom', filters.isCustom);
      if (filters.createdBy) query = query.eq('created_by', filters.createdBy);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Workout Progress operations
  startWorkout: async (data: { workoutId: string; userId: string }) => {
    const { data: progress, error } = await supabase
      .from('workout_progress')
      .insert({
        workout_id: data.workoutId,
        user_id: data.userId,
        start_time: new Date().toISOString(),
        status: 'IN_PROGRESS',
      })
      .select(
        `
        *,
        workout:workouts(
          *,
          exercises:workout_exercises(
            *,
            exercise:exercises(*)
          )
        )
      `,
      )
      .single();

    if (error) throw error;
    return progress;
  },

  completeWorkout: async (id: string) => {
    const { data, error } = await supabase
      .from('workout_progress')
      .update({
        status: 'COMPLETED',
        end_time: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Achievement operations
  unlockAchievement: async (data: {
    name: string;
    description: string;
    icon: string;
    userStatsId: string;
    type: string;
    user: { connect: { id: string } };
  }) => {
    const { data: achievement, error } = await supabase
      .from('achievements')
      .insert({
        name: data.name,
        description: data.description,
        icon: data.icon,
        type: data.type,
        user_id: data.user.connect.id,
      })
      .select()
      .single();

    if (error) throw error;
    return achievement;
  },

  // Stats operations
  updateUserStats: async (
    userId: string,
    data: {
      workoutsCompleted?: number;
      totalWorkoutTime?: number;
      streakDays?: number;
      level?: number;
      experience?: number;
    },
  ) => {
    const { data: stats, error } = await supabase
      .from('user_stats')
      .update({
        total_workouts: data.workoutsCompleted,
        total_time: data.totalWorkoutTime,
        streak_days: data.streakDays,
        level: data.level,
        experience: data.experience,
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return stats;
  },
};

type DatabaseContextType = typeof db;

const DatabaseContext = createContext<DatabaseContextType | null>(null);

export const DatabaseProvider = ({ children }: { children: React.ReactNode }) => {
  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};

export default DatabaseProvider;
