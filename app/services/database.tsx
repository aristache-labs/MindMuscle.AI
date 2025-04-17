import { PrismaClient } from '@prisma/client';
import React, { createContext, useContext } from 'react';

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
    muscleGroups: string;
    equipment: string;
    instructions: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    isCustom?: boolean;
  }) => {
    return prisma.exercise.create({
      data: {
        ...data,
        createdBy: undefined,
      },
    });
  },

  getExercises: async (filters?: {
    type?: string;
    difficulty?: string;
    muscleGroups?: string;
    equipment?: string;
    isCustom?: boolean;
  }) => {
    return prisma.exercise.findMany({
      where: filters ? {
        ...filters,
        createdBy: undefined,
      } : undefined,
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
        startTime: new Date(),
        status: 'IN_PROGRESS',
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
        status: 'COMPLETED',
      },
    });
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
    return prisma.achievement.create({
      data: {
        ...data,
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

type DatabaseContextType = typeof db;

const DatabaseContext = createContext<DatabaseContextType | null>(null);

export const DatabaseProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <DatabaseContext.Provider value={db}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};

export default DatabaseProvider; 