import { useState, useCallback, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import workoutPlanService from '../../../services/workoutPlanService';
import type { ExerciseData, MaxWeightDataPoint, ExerciseSet } from '../types';
import type { UserProfile } from '../../../store/AuthContext';
import type { RecommendationData } from './useExerciseSets';

export interface UseWorkoutDataParams {
  user: UserProfile | null;
  exercises: ExerciseData[];
  cycleWeek: number;
  externalLastExerciseValues?: Record<string, Record<number, { weight: string; reps: string }>>;
  isResumingPausedWorkout?: boolean;
}

export interface UseWorkoutDataReturn {
  maxWeightData: Record<string, MaxWeightDataPoint[]>;
  setMaxWeightData: Dispatch<SetStateAction<Record<string, MaxWeightDataPoint[]>>>;
  absoluteMaxWeightData: Record<string, { weight: number; reps: number; date: string }>;
  setAbsoluteMaxWeightData: Dispatch<
    SetStateAction<Record<string, { weight: number; reps: number; date: string }>>
  >;
  lastExerciseValues: Record<string, Record<number, { weight: string; reps: string }>>;
  setLastExerciseValues: Dispatch<
    SetStateAction<Record<string, Record<number, { weight: string; reps: string }>>>
  >;
  cycleWeekInfo: {
    weekNumber: number;
    weekName: string;
    weightAdjustmentPercentage: number;
    repsAdjustmentPercentage: number;
  } | null;
  setCycleWeekInfo: Dispatch<
    SetStateAction<{
      weekNumber: number;
      weekName: string;
      weightAdjustmentPercentage: number;
      repsAdjustmentPercentage: number;
    } | null>
  >;

  // Functions
  fetchLastExerciseRecords: () => Promise<void>;
  fetchMaxWeightDataForAllExercises: () => Promise<void>;
  fetchMaxWeightData: () => Promise<void>;
  fetchCycleWeekInfo: () => Promise<void>;
  preFillWithSuggestedValues: (
    recommendations: Record<string, RecommendationData>,
    exerciseSets: Record<string, ExerciseSet[]>,
    setExerciseSets: Dispatch<SetStateAction<Record<string, ExerciseSet[]>>>,
    exerciseCustomized: Record<string, boolean>,
    isResumingPausedWorkout: boolean,
    exerciseSetsLocked?: boolean,
  ) => void;
}

export const useWorkoutData = (params: UseWorkoutDataParams): UseWorkoutDataReturn => {
  const { user, exercises, cycleWeek, externalLastExerciseValues, isResumingPausedWorkout } =
    params;

  // State for max weight graph data
  const [maxWeightData, setMaxWeightData] = useState<Record<string, MaxWeightDataPoint[]>>({});
  const [absoluteMaxWeightData, setAbsoluteMaxWeightData] = useState<
    Record<string, { weight: number; reps: number; date: string }>
  >({});
  const [lastExerciseValues, setLastExerciseValues] = useState<
    Record<string, Record<number, { weight: string; reps: string }>>
  >(externalLastExerciseValues || {});
  const [cycleWeekInfo, setCycleWeekInfo] = useState<{
    weekNumber: number;
    weekName: string;
    weightAdjustmentPercentage: number;
    repsAdjustmentPercentage: number;
  } | null>(null);

  // Effect to sync external lastExerciseValues during resume
  useEffect(() => {
    if (externalLastExerciseValues && Object.keys(externalLastExerciseValues).length > 0) {
      console.log('RESUME: Syncing external lastExerciseValues:', externalLastExerciseValues);
      setLastExerciseValues(externalLastExerciseValues);
    }
  }, [externalLastExerciseValues]);

  // Function to fetch last exercise records for all exercises
  const fetchLastExerciseRecords = useCallback(async () => {
    if (!user) return;
    if (exercises.length === 0) {
      return;
    }

    // Don't fetch if we're resuming and already have external values
    if (
      isResumingPausedWorkout &&
      externalLastExerciseValues &&
      Object.keys(externalLastExerciseValues).length > 0
    ) {
      console.log('RESUME: Skipping fetchLastExerciseRecords - using external values');
      return;
    }

    try {
      // Use the service function to fetch last exercise records
      const lastValues = await workoutPlanService.fetchLastExerciseRecords(user.id, exercises);

      if (Object.keys(lastValues).length > 0) {
        setLastExerciseValues(lastValues);
      }
    } catch {
      // Error in fetchLastExerciseRecords
    }
  }, [user?.id, exercises, isResumingPausedWorkout, externalLastExerciseValues]);

  // Function to fetch max weight data for all exercises
  const fetchMaxWeightDataForAllExercises = useCallback(async () => {
    if (!user || exercises.length === 0) return;

    try {
      const newMaxWeightData: Record<string, MaxWeightDataPoint[]> = {};
      const newAbsoluteMaxWeightData: Record<
        string,
        { weight: number; reps: number; date: string }
      > = {};

      // Fetch data for all exercises that require weight
      const promises = exercises
        .filter((exercise) => exercise.exercise_id && exercise.requires_weight !== false)
        .map(async (exercise) => {
          try {
            const [trendingData, absoluteMaxData] = await Promise.all([
              workoutPlanService.fetchExerciseMaxWeightData(user.id, exercise.exercise_id, 6),
              workoutPlanService.fetchExerciseAbsoluteMaxWeight(user.id, exercise.exercise_id),
            ]);

            if (trendingData.length > 0) {
              newMaxWeightData[exercise.exercise_id] = trendingData;
            }

            if (absoluteMaxData) {
              newAbsoluteMaxWeightData[exercise.exercise_id] = absoluteMaxData;
            }
          } catch (error) {
            console.error(
              `Error fetching max weight data for exercise ${exercise.exercise_id}:`,
              error,
            );
          }
        });

      await Promise.all(promises);

      // Update state with all the fetched data
      setMaxWeightData((prev) => ({ ...prev, ...newMaxWeightData }));
      setAbsoluteMaxWeightData((prev) => ({ ...prev, ...newAbsoluteMaxWeightData }));
    } catch (error) {
      console.error('Error fetching max weight data for all exercises:', error);
    }
  }, [user?.id, exercises]);

  // Function to fetch max weight data for current exercise (for immediate updates)
  const fetchMaxWeightData = useCallback(async () => {
    if (!user || exercises.length === 0) return;

    try {
      // Fetch data for all exercises that require weight
      const promises = exercises
        .filter((exercise) => exercise.exercise_id && exercise.requires_weight !== false)
        .map(async (exercise) => {
          try {
            const [trendingData, absoluteMaxData] = await Promise.all([
              workoutPlanService.fetchExerciseMaxWeightData(user.id, exercise.exercise_id, 6),
              workoutPlanService.fetchExerciseAbsoluteMaxWeight(user.id, exercise.exercise_id),
            ]);

            if (trendingData.length > 0) {
              setMaxWeightData((prev) => ({
                ...prev,
                [exercise.exercise_id]: trendingData,
              }));
            }

            if (absoluteMaxData) {
              setAbsoluteMaxWeightData((prev) => ({
                ...prev,
                [exercise.exercise_id]: absoluteMaxData,
              }));
            }
          } catch (error) {
            console.error(
              `Error fetching max weight data for exercise ${exercise.exercise_id}:`,
              error,
            );
          }
        });

      await Promise.all(promises);
    } catch (error) {
      console.error('Error fetching max weight data:', error);
    }
  }, [user?.id, exercises]);

  // Function to fetch cycle week info
  const fetchCycleWeekInfo = useCallback(async (): Promise<void> => {
    try {
      const info = await workoutPlanService.getCycleWeekInfo(cycleWeek);
      setCycleWeekInfo(info);
    } catch (error) {
      console.error('Error fetching cycle week info:', error);
    }
  }, [cycleWeek]);

  // Function to pre-fill sets with suggested values
  const preFillWithSuggestedValues = useCallback(
    (
      recommendations: Record<string, RecommendationData>,
      exerciseSets: Record<string, ExerciseSet[]>,
      setExerciseSets: Dispatch<SetStateAction<Record<string, ExerciseSet[]>>>,
      exerciseCustomized: Record<string, boolean>,
      isResumingPausedWorkout: boolean,
      exerciseSetsLocked?: boolean,
    ) => {
      // Don't pre-fill if resuming paused workout or if sets are locked during restoration
      if (isResumingPausedWorkout || exerciseSetsLocked) {
        console.log('PRE-FILL: Skipping pre-fill - resuming paused workout or sets locked:', {
          isResumingPausedWorkout,
          exerciseSetsLocked,
        });
        return;
      }

      setExerciseSets((prev: Record<string, ExerciseSet[]>) => {
        const updatedSets = { ...prev };
        let hasChanges = false;

        exercises.forEach((exercise) => {
          const recommendation = recommendations[exercise.id];
          if (recommendation && updatedSets[exercise.id]) {
            // Don't pre-fill if exercise was customized
            const isCustomized = exerciseCustomized[exercise.id];
            if (isCustomized) {
              return;
            }

            // Check if exercise sets already have values (indicating this might be a resumed workout)
            const currentSets = updatedSets[exercise.id] || [];
            const hasExistingValues = currentSets.some(
              (set: ExerciseSet) =>
                (set.weight && set.weight !== '' && set.weight !== '-') ||
                (set.reps && set.reps !== '' && set.reps !== '-') ||
                set.isCompleted,
            );

            // Skip pre-filling if exercise already has values (resumed workout scenario)
            if (hasExistingValues) {
              return;
            }

            updatedSets[exercise.id].forEach((set: ExerciseSet, index: number) => {
              // Only fill empty sets that aren't completed
              if (!set.isCompleted) {
                const suggestedWeight = recommendation.recommended_weight?.toString() || '-';
                const suggestedReps = recommendation.recommended_reps?.toString() || '-';

                // Check if existing set value is empty or placeholder before overwriting
                const currentWeight = set.weight?.trim();
                const currentReps = set.reps?.trim();

                if (
                  (currentWeight === '' || currentWeight === '-' || currentWeight === null) &&
                  recommendation.recommended_weight !== undefined &&
                  recommendation.recommended_weight !== null
                ) {
                  updatedSets[exercise.id][index].weight = suggestedWeight;
                  hasChanges = true;
                }
                if (
                  (currentReps === '' || currentReps === '-' || currentReps === null) &&
                  recommendation.recommended_reps !== undefined &&
                  recommendation.recommended_reps !== null
                ) {
                  updatedSets[exercise.id][index].reps = suggestedReps;
                  hasChanges = true;
                }
              }
            });
          }
        });

        return hasChanges ? updatedSets : prev;
      });
    },
    [exercises],
  );

  return {
    maxWeightData,
    setMaxWeightData,
    absoluteMaxWeightData,
    setAbsoluteMaxWeightData,
    lastExerciseValues,
    setLastExerciseValues,
    cycleWeekInfo,
    setCycleWeekInfo,
    fetchLastExerciseRecords,
    fetchMaxWeightDataForAllExercises,
    fetchMaxWeightData,
    fetchCycleWeekInfo,
    preFillWithSuggestedValues,
  };
};
export default function disablewarn() {
  return null;
}
