import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
    return prisma.user.create({
      data: {
        ...data,
        preferences: data.preferences
          ? {
              create: data.preferences,
            }
          : undefined,
        stats: {
          create: {},
        },
      },
      include: {
        preferences: true,
        stats: true,
      },
    });
  },

  getUserByEmail: async (email: string) => {
    return prisma.user.findUnique({
      where: { email },
      include: {
        preferences: true,
        stats: true,
      },
    });
  },

  // Exercise operations
  createExercise: async (data: {
    name: string;
    description: string;
    type: string;
    difficulty: string;
    muscleGroups: string[];
    equipment: string[];
    instructions: string[];
    videoUrl?: string;
    thumbnailUrl?: string;
    isCustom?: boolean;
    createdBy?: string;
  }) => {
    return prisma.exercise.create({
      data,
    });
  },

  getExercises: async (filters?: {
    type?: string;
    difficulty?: string;
    muscleGroups?: string[];
    equipment?: string[];
    isCustom?: boolean;
    createdBy?: string;
  }) => {
    return prisma.exercise.findMany({
      where: filters,
    });
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
    return prisma.workout.create({
      data: {
        ...data,
        exercises: {
          create: data.exercises,
        },
      },
      include: {
        exercises: {
          include: {
            exercise: true,
          },
        },
      },
    });
  },

  getWorkouts: async (filters?: {
    type?: string;
    difficulty?: string;
    isCustom?: boolean;
    createdBy?: string;
  }) => {
    return prisma.workout.findMany({
      where: filters,
      include: {
        exercises: {
          include: {
            exercise: true,
          },
        },
      },
    });
  },

  // Workout Progress operations
  startWorkout: async (data: {
    workoutId: string;
    userId: string;
  }) => {
    return prisma.workoutProgress.create({
      data: {
        workoutId: data.workoutId,
        userId: data.userId,
      },
      include: {
        workout: {
          include: {
            exercises: {
              include: {
                exercise: true,
              },
            },
          },
        },
      },
    });
  },

  completeWorkout: async (id: string) => {
    return prisma.workoutProgress.update({
      where: { id },
      data: {
        completedAt: new Date(),
      },
    });
  },

  // Achievement operations
  unlockAchievement: async (data: {
    name: string;
    description: string;
    icon: string;
    userStatsId: string;
  }) => {
    return prisma.achievement.create({
      data: {
        ...data,
        unlockedAt: new Date(),
      },
    });
  },

  // Stats operations
  updateUserStats: async (userId: string, data: {
    workoutsCompleted?: number;
    totalWorkoutTime?: number;
    streakDays?: number;
    level?: number;
    experience?: number;
  }) => {
    return prisma.userStats.update({
      where: {
        userId,
      },
      data,
    });
  },
}; 