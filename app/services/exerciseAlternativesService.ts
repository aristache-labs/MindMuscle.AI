import supabase from './supabase';
import {
  captureError,
  captureDatabaseError,
  captureAPIError,
  capturePerformanceError,
  simpleErrorHandler,
} from './sentry';
import * as Sentry from '@sentry/react-native';

interface Exercise {
  id: string;
  name: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  difficulty: string;
  equipment: string;
  requires_weight: boolean;
  muscle_group: string;
  image_url?: string;
}

interface ExerciseAlternative extends Exercise {
  // Smart defaults based on current exercise and exercise properties
  exercise_id: string; // Add exercise_id for compatibility
  sets: number;
  reps_range: string;
  rest_time: number;
  order: number;
  workout_day: number;
  // Recommendation metadata
  recommendation_type: 'recommended' | 'other';
  similarity_score: number;
}

interface CurrentExercise {
  exercise_id: string;
  sets: number;
  reps_range: string;
  rest_time: number;
  order: number;
  workout_day: number;
  primary_muscles?: string[];
  difficulty?: string;
  equipment?: string;
  requires_weight?: boolean;
}

interface ExerciseCache {
  all: Exercise[];
  lastUpdated: number;
}

// Helper to get cached exercises (reuse existing cache system)
const getCachedExercises = (): ExerciseCache | null => {
  return Sentry.startSpan(
    {
      name: 'getCachedExercises',
      op: 'cache.read',
      attributes: { service: 'exerciseAlternatives' },
    },
    (span) => {
      try {
        simpleErrorHandler.setComponent('exerciseAlternativesService');

        const cache = (global as { exercisesCache?: ExerciseCache }).exercisesCache;
        if (!cache) {
          span.setAttributes({ cache_status: 'miss' });
          return null;
        }

        // Check if cache is expired (30 minutes)
        const CACHE_EXPIRY = 30 * 60 * 1000;
        const now = Date.now();
        const cacheAge = now - cache.lastUpdated;

        if (cacheAge > CACHE_EXPIRY) {
          console.log('Exercise cache expired, will refresh from API');
          span.setAttributes({
            cache_status: 'expired',
            age_minutes: Math.round(cacheAge / 60000),
          });
          return null;
        }

        span.setAttributes({
          cache_status: 'hit',
          exercise_count: cache.all?.length || 0,
          age_minutes: Math.round(cacheAge / 60000),
        });

        return cache;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        captureError(errorObj, {
          category: 'storage_error',
          component: 'exerciseAlternativesService',
          operation: 'getCachedExercises',
        });

        span.setAttributes({ cache_status: 'error', error_message: errorObj.message });
        console.warn('Error accessing exercise cache:', error);
        return null;
      }
    },
  );
};

// Helper to fetch exercises for specific muscle group with caching
const getExercisesForMuscleGroup = async (primaryMuscle: string): Promise<Exercise[]> => {
  return await Sentry.startSpan(
    {
      name: 'getExercisesForMuscleGroup',
      op: 'db.query',
      attributes: {
        service: 'exerciseAlternatives',
        muscle_group: primaryMuscle,
      },
    },
    async (span) => {
      try {
        // Try cache first
        const cache = getCachedExercises();
        if (cache?.all) {
          console.log(`🚀 Using cached exercises for muscle group: ${primaryMuscle}`);

          // Filter cached exercises by primary muscle
          const filteredExercises = cache.all.filter(
            (exercise: Exercise) =>
              exercise.primary_muscles && exercise.primary_muscles.includes(primaryMuscle),
          );

          span.setAttributes({
            data_source: 'cache',
            exercise_count: filteredExercises.length,
            total_cached: cache.all.length,
          });

          return filteredExercises;
        }

        // Fallback to API call for specific muscle group
        console.log(`📡 Fetching exercises from API for muscle group: ${primaryMuscle}`);

        const startTime = Date.now();
        const { data: exercises, error } = await supabase
          .from('exercises')
          .select('*')
          .contains('primary_muscles', [primaryMuscle])
          .order('name');

        const queryDuration = Date.now() - startTime;

        if (error) {
          console.error(`❌ Error fetching exercises for ${primaryMuscle}:`, error);

          captureDatabaseError(
            new Error(`Failed to fetch exercises for muscle group: ${error.message}`),
            'exercises',
            'select_by_muscle_group',
          );

          span.setAttributes({
            query_status: 'error',
            error_message: error.message,
          });

          throw error;
        }

        const exerciseCount = exercises?.length || 0;

        // Log performance if query is slow
        if (queryDuration > 2000) {
          capturePerformanceError(
            `Slow exercise query for muscle group: ${primaryMuscle}`,
            'database_query_duration',
            queryDuration,
          );
        }

        span.setAttributes({
          data_source: 'api',
          query_status: 'success',
          exercise_count: exerciseCount,
          query_duration_ms: queryDuration,
        });

        return exercises || [];
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));

        captureAPIError(errorObj, 'exercises', 'supabase');

        span.setAttributes({
          query_status: 'error',
          error_message: errorObj.message,
        });

        throw errorObj;
      }
    },
  );
};

/**
 * Adjusts reps based on difficulty comparison
 */
function adjustRepsForDifficulty(
  reps_range: string,
  currentDifficulty: string | undefined,
  newDifficulty: string,
): string {
  if (newDifficulty === 'Beginner' && currentDifficulty === 'Advanced') {
    // Easier exercise - might do more reps
    const [min, max] = reps_range.split('-').map(Number);
    if (!Number.isNaN(min) && !Number.isNaN(max)) {
      return `${min + 2}-${max + 2}`;
    }
  } else if (newDifficulty === 'Advanced' && currentDifficulty === 'Beginner') {
    // Harder exercise - might do fewer reps
    const [min, max] = reps_range.split('-').map(Number);
    if (!Number.isNaN(min) && !Number.isNaN(max) && min > 2 && max > 2) {
      return `${min - 2}-${max - 2}`;
    }
  }
  return reps_range;
}

/**
 * Adjusts rest time based on muscle group
 */
function adjustRestTimeForMuscleGroup(baseRestTime: number, primaryMuscles: string[]): number {
  if (primaryMuscles.includes('Quads') || primaryMuscles.includes('Hamstrings')) {
    // Leg exercises typically need more rest
    return Math.max(baseRestTime, 90);
  } else if (primaryMuscles.includes('Abs') || primaryMuscles.includes('Calves')) {
    // Smaller muscle groups need less rest
    return Math.min(baseRestTime, 60);
  }
  return baseRestTime;
}

/**
 * Adjusts reps for weight requirement changes
 */
function adjustRepsForWeightRequirement(
  reps_range: string,
  currentRequiresWeight: boolean | undefined,
  newRequiresWeight: boolean,
): string {
  if (newRequiresWeight !== currentRequiresWeight) {
    if (!newRequiresWeight && currentRequiresWeight) {
      // Switching from weighted to bodyweight - increase reps
      const [min, max] = reps_range.split('-').map(Number);
      if (!Number.isNaN(min) && !Number.isNaN(max)) {
        return `${min + 3}-${max + 5}`;
      }
    } else if (newRequiresWeight && !currentRequiresWeight) {
      // Switching from bodyweight to weighted - decrease reps
      const [min, max] = reps_range.split('-').map(Number);
      if (!Number.isNaN(min) && !Number.isNaN(max) && min > 3 && max > 5) {
        return `${min - 3}-${max - 5}`;
      }
    }
  }
  return reps_range;
}

/**
 * Generates smart defaults for workout parameters based on exercise properties
 */
function generateSmartDefaults(
  exercise: Exercise,
  currentExercise: CurrentExercise,
): { sets: number; reps_range: string; rest_time: number } {
  // Use current exercise as base, but adjust based on new exercise properties
  const sets = currentExercise.sets;
  let reps_range = currentExercise.reps_range;
  let rest_time = currentExercise.rest_time;

  // Adjust based on difficulty
  reps_range = adjustRepsForDifficulty(reps_range, currentExercise.difficulty, exercise.difficulty);

  // Adjust rest time based on exercise type
  rest_time = adjustRestTimeForMuscleGroup(rest_time, exercise.primary_muscles);

  // Bodyweight vs weighted adjustments
  reps_range = adjustRepsForWeightRequirement(
    reps_range,
    currentExercise.requires_weight,
    exercise.requires_weight,
  );

  return { sets, reps_range, rest_time };
}

/**
 * Calculates popularity score based on exercise characteristics
 */
function calculatePopularityScore(exercise: Exercise): number {
  let popularityScore = 0;

  // Common equipment gets higher popularity
  const commonEquipment = ['Barbell', 'Dumbbell', 'Bodyweight', 'Cable', 'Machine'];
  if (commonEquipment.includes(exercise.equipment)) {
    popularityScore += 20;
  }

  // Beginner and Intermediate exercises are more popular
  if (exercise.difficulty === 'Beginner') {
    popularityScore += 15;
  } else if (exercise.difficulty === 'Intermediate') {
    popularityScore += 10;
  }

  // Common exercise names (basic movements)
  const commonExerciseKeywords = [
    'squat',
    'deadlift',
    'bench',
    'press',
    'row',
    'curl',
    'extension',
    'raise',
    'fly',
    'pulldown',
    'pushup',
    'pullup',
    'dip',
    'lunge',
    'crunch',
    'plank',
    'leg press',
    'chest press',
  ];

  const exerciseNameLower = exercise.name.toLowerCase();
  const hasCommonKeyword = commonExerciseKeywords.some((keyword) =>
    exerciseNameLower.includes(keyword),
  );

  if (hasCommonKeyword) {
    popularityScore += 15;
  }

  return popularityScore;
}

/**
 * Calculates similarity score for exercise recommendation ranking
 */
function calculateSimilarityScore(exercise: Exercise, currentExercise: CurrentExercise): number {
  let score = 0;

  // Primary muscle match (highest weight)
  const currentPrimaryMuscles = currentExercise.primary_muscles || [];
  const exercisePrimaryMuscles = exercise.primary_muscles || [];

  const primaryMuscleMatch = exercisePrimaryMuscles.some((muscle) =>
    currentPrimaryMuscles.includes(muscle),
  );
  if (primaryMuscleMatch) score += 40; // Reduced from 50 to allow more variety

  // Equipment similarity
  if (exercise.equipment === currentExercise.equipment) score += 15; // Reduced from 20

  // Difficulty similarity
  if (exercise.difficulty === currentExercise.difficulty) score += 10; // Reduced from 15

  // Weight requirement match
  if (exercise.requires_weight === currentExercise.requires_weight) score += 8; // Reduced from 10

  // Penalty for very different difficulty levels (reduced penalty)
  const difficultyLevels = { Beginner: 1, Intermediate: 2, Advanced: 3 };
  const currentLevel =
    difficultyLevels[currentExercise.difficulty as keyof typeof difficultyLevels] || 2;
  const exerciseLevel = difficultyLevels[exercise.difficulty as keyof typeof difficultyLevels] || 2;
  const difficultyDiff = Math.abs(currentLevel - exerciseLevel);
  score -= difficultyDiff * 3; // Reduced penalty from 5 to 3

  // Add popularity score to overall score
  score += calculatePopularityScore(exercise);

  return Math.max(0, score);
}

/**
 * Categorizes exercises into recommended and other based on smart distribution
 */
function categorizeExercises(
  processedExercises: ExerciseAlternative[],
  primaryMuscle: string,
): { recommended: ExerciseAlternative[]; other: ExerciseAlternative[] } {
  const recommended: ExerciseAlternative[] = [];
  const other: ExerciseAlternative[] = [];

  if (processedExercises.length === 0) {
    return { recommended: [], other: [] };
  }

  // Dynamic categorization strategy for better distribution
  if (processedExercises.length <= 4) {
    // For small sets, put top 50% in recommended, rest in other
    const splitIndex = Math.ceil(processedExercises.length / 2);

    for (let i = 0; i < processedExercises.length; i++) {
      const exercise = processedExercises[i];
      if (i < splitIndex) {
        exercise.recommendation_type = 'recommended';
        recommended.push(exercise);
      } else {
        exercise.recommendation_type = 'other';
        other.push(exercise);
      }
    }
  } else {
    // For larger sets, use a more sophisticated approach
    const totalExercises = processedExercises.length;
    const highestScore = processedExercises[0]?.similarity_score || 0;
    const lowestScore = processedExercises[processedExercises.length - 1]?.similarity_score || 0;
    const scoreRange = highestScore - lowestScore;

    // Calculate dynamic threshold based on score distribution
    const dynamicThreshold = highestScore - scoreRange * 0.4; // Top 40% of score range

    // Ensure we have at least 30% in recommended and at least 20% in other
    const minRecommended = Math.ceil(totalExercises * 0.3);
    const maxRecommended = Math.floor(totalExercises * 0.8);

    // First pass: categorize by dynamic threshold
    for (let i = 0; i < processedExercises.length; i++) {
      const exercise = processedExercises[i];
      if (exercise.similarity_score >= dynamicThreshold) {
        exercise.recommendation_type = 'recommended';
        recommended.push(exercise);
      } else {
        exercise.recommendation_type = 'other';
        other.push(exercise);
      }
    }

    // Adjust if distribution is too skewed
    if (recommended.length < minRecommended) {
      // Move some from other to recommended
      const needToMove = minRecommended - recommended.length;
      const toMove = other.splice(0, needToMove);
      toMove.forEach((ex) => {
        ex.recommendation_type = 'recommended';
        recommended.push(ex);
      });
    } else if (recommended.length > maxRecommended) {
      // Move some from recommended to other
      const toMove = recommended.splice(maxRecommended);
      toMove.forEach((ex) => {
        ex.recommendation_type = 'other';
        other.push(ex);
      });
    }

    // Ensure other category has at least some exercises if we have enough total
    if (other.length === 0 && totalExercises > 2) {
      const toMove = recommended.pop();
      if (toMove) {
        toMove.recommendation_type = 'other';
        other.push(toMove);
      }
    }
  }

  console.log(`✅ Final categorization for ${primaryMuscle} (SMART SPLIT):`, {
    recommended: recommended.length,
    other: other.length,
    total: recommended.length + other.length,
    distribution: `${Math.round((recommended.length / (recommended.length + other.length)) * 100)}% recommended, ${Math.round((other.length / (recommended.length + other.length)) * 100)}% other`,
    recommendedNames: recommended.slice(0, 3).map((ex) => ex.name),
    otherNames: other.slice(0, 3).map((ex) => ex.name),
  });

  return { recommended, other };
}

/**
 * Fetches exercise alternatives for a given exercise, showing ALL exercises for the SAME muscle group
 * Uses caching for optimal performance with large datasets
 */
export async function fetchExerciseAlternatives(currentExercise: CurrentExercise): Promise<{
  recommended: ExerciseAlternative[];
  other: ExerciseAlternative[];
}> {
  return await Sentry.startSpan(
    {
      name: 'fetchExerciseAlternatives',
      op: 'service.exercise_alternatives',
      attributes: {
        service: 'exerciseAlternatives',
        exercise_id: currentExercise.exercise_id,
      },
    },
    async (span) => {
      try {
        simpleErrorHandler.setComponent('exerciseAlternativesService');

        console.log('🔍 fetchExerciseAlternatives called with:', {
          exercise_id: currentExercise.exercise_id,
          primary_muscles: currentExercise.primary_muscles,
          difficulty: currentExercise.difficulty,
          equipment: currentExercise.equipment,
        });

        if (!currentExercise.primary_muscles || currentExercise.primary_muscles.length === 0) {
          const errorMessage = 'No primary muscles found for current exercise';
          console.log('❌ ' + errorMessage);

          simpleErrorHandler.captureMessage(errorMessage, 'warning', {
            category: 'validation_error',
            component: 'exerciseAlternativesService',
            exerciseId: currentExercise.exercise_id,
          });

          span.setAttributes({ result: 'no_primary_muscles' });
          return { recommended: [], other: [] };
        }

        const primaryMuscle = currentExercise.primary_muscles[0];
        console.log(`🎯 Fetching ALL exercises for muscle group: ${primaryMuscle}`);

        // Get ALL exercises for the same muscle group using cache for optimal performance
        const startTime = Date.now();
        const muscleGroupExercises = await getExercisesForMuscleGroup(primaryMuscle);
        const fetchDuration = Date.now() - startTime;

        if (!muscleGroupExercises || muscleGroupExercises.length === 0) {
          const errorMessage = `No exercises found for muscle group: ${primaryMuscle}`;
          console.log(`❌ ${errorMessage}`);

          simpleErrorHandler.captureMessage(errorMessage, 'warning', {
            category: 'database_error',
            component: 'exerciseAlternativesService',
            muscleGroup: primaryMuscle,
          });

          span.setAttributes({
            result: 'no_exercises_found',
            muscle_group: primaryMuscle,
          });

          return { recommended: [], other: [] };
        }

        console.log(
          `📊 Found ${muscleGroupExercises.length} exercises for ${primaryMuscle} muscle group`,
        );

        // Filter out current exercise and process all others in the same muscle group
        const availableExercises = muscleGroupExercises.filter(
          (exercise) => exercise.id !== currentExercise.exercise_id,
        );

        console.log(
          `🎯 ${availableExercises.length} ${primaryMuscle} exercises available after filtering current exercise`,
        );

        // Process ALL available exercises in the muscle group and add smart defaults
        const processingStartTime = Date.now();
        const processedExercises: ExerciseAlternative[] = availableExercises.map((exercise) => {
          const smartDefaults = generateSmartDefaults(exercise, currentExercise);
          const similarityScore = calculateSimilarityScore(exercise, currentExercise);

          return {
            ...exercise,
            exercise_id: exercise.id, // Map id to exercise_id for compatibility
            ...smartDefaults,
            order: currentExercise.order,
            workout_day: currentExercise.workout_day,
            recommendation_type: 'other' as 'recommended' | 'other', // Will be determined below
            similarity_score: similarityScore,
          };
        });
        const processingDuration = Date.now() - processingStartTime;

        // Sort by similarity score (highest first)
        processedExercises.sort((a, b) => b.similarity_score - a.similarity_score);

        console.log(`📊 Exercise categorization for ${primaryMuscle}:`, {
          totalExercises: processedExercises.length,
          topScores: processedExercises
            .slice(0, 5)
            .map((ex) => ({ name: ex.name, score: ex.similarity_score })),
          scoreRange: {
            highest: processedExercises[0]?.similarity_score || 0,
            lowest: processedExercises[processedExercises.length - 1]?.similarity_score || 0,
          },
        });

        // Use the categorization helper function
        const categorizationStartTime = Date.now();
        const result = categorizeExercises(processedExercises, primaryMuscle);
        const categorizationDuration = Date.now() - categorizationStartTime;

        const totalDuration = Date.now() - startTime;

        // Log performance metrics
        if (totalDuration > 5000) {
          capturePerformanceError(
            `Slow exercise alternatives fetch for muscle group: ${primaryMuscle}`,
            'service_duration',
            totalDuration,
          );
        }

        span.setAttributes({
          result: 'success',
          muscle_group: primaryMuscle,
          total_exercises: muscleGroupExercises.length,
          available_exercises: availableExercises.length,
          recommended_count: result.recommended.length,
          other_count: result.other.length,
          total_duration_ms: totalDuration,
          processing_duration_ms: processingDuration,
          categorization_duration_ms: categorizationDuration,
          fetch_duration_ms: fetchDuration,
        });

        return {
          recommended: result.recommended, // Show ALL recommended exercises for this muscle group
          other: result.other, // Show ALL other alternatives for this muscle group
        };
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));

        console.error('Error in fetchExerciseAlternatives:', error);

        captureError(errorObj, {
          category: 'api_error',
          component: 'exerciseAlternativesService',
          operation: 'fetchExerciseAlternatives',
          exerciseId: currentExercise.exercise_id,
          primaryMuscles: currentExercise.primary_muscles,
        });

        span.setAttributes({
          result: 'error',
          error_message: errorObj.message,
        });

        return { recommended: [], other: [] };
      }
    },
  );
}

/**
 * Applies user preferences to exercise scoring
 */
function applyUserPreferences(
  exercises: ExerciseAlternative[],
  userPreferences: {
    preferredEquipment?: string[];
    maxDifficulty?: string;
    preferBodyweight?: boolean;
  },
): ExerciseAlternative[] {
  return exercises
    .map((exercise) => {
      let adjustedScore = exercise.similarity_score;

      // Boost score for preferred equipment
      if (userPreferences.preferredEquipment?.includes(exercise.equipment)) {
        adjustedScore += 15;
      }

      // Boost score for bodyweight preference
      if (userPreferences.preferBodyweight && !exercise.requires_weight) {
        adjustedScore += 10;
      }

      // Filter out exercises above max difficulty
      const difficultyLevels = { Beginner: 1, Intermediate: 2, Advanced: 3 };
      const maxLevel =
        difficultyLevels[userPreferences.maxDifficulty as keyof typeof difficultyLevels] || 3;
      const exerciseLevel =
        difficultyLevels[exercise.difficulty as keyof typeof difficultyLevels] || 2;

      if (exerciseLevel > maxLevel) {
        adjustedScore -= 30; // Heavy penalty for too difficult exercises
      }

      return {
        ...exercise,
        similarity_score: adjustedScore,
        recommendation_type: 'other' as 'recommended' | 'other', // Will be determined below
      };
    })
    .sort((a, b) => b.similarity_score - a.similarity_score);
}

/**
 * Fetches exercise alternatives with enhanced filtering for better recommendations
 * Now shows ALL exercises for the same muscle group with user preference adjustments
 */
export async function fetchEnhancedExerciseAlternatives(
  currentExercise: CurrentExercise,
  userPreferences?: {
    preferredEquipment?: string[];
    maxDifficulty?: string;
    preferBodyweight?: boolean;
  },
): Promise<{
  recommended: ExerciseAlternative[];
  other: ExerciseAlternative[];
}> {
  return await Sentry.startSpan(
    {
      name: 'fetchEnhancedExerciseAlternatives',
      op: 'service.enhanced_exercise_alternatives',
      attributes: {
        service: 'exerciseAlternatives',
        exercise_id: currentExercise.exercise_id,
        has_preferences: !!userPreferences,
      },
    },
    async (span) => {
      try {
        simpleErrorHandler.setComponent('exerciseAlternativesService');

        const startTime = Date.now();
        const baseAlternatives = await fetchExerciseAlternatives(currentExercise);
        const baseFetchDuration = Date.now() - startTime;

        if (!userPreferences) {
          span.setAttributes({
            preferences_applied: 'none',
            recommended_count: baseAlternatives.recommended.length,
            other_count: baseAlternatives.other.length,
            base_fetch_duration_ms: baseFetchDuration,
          });

          return baseAlternatives;
        }

        // Apply user preferences to boost/filter recommendations
        const preferencesStartTime = Date.now();
        const allProcessed = applyUserPreferences(
          [...baseAlternatives.recommended, ...baseAlternatives.other],
          userPreferences,
        );
        const preferencesProcessingDuration = Date.now() - preferencesStartTime;

        if (allProcessed.length === 0) {
          const warningMessage = 'No exercises found after applying user preferences';

          simpleErrorHandler.captureMessage(warningMessage, 'warning', {
            category: 'validation_error',
            component: 'exerciseAlternativesService',
            exerciseId: currentExercise.exercise_id,
            userPreferences,
          });

          span.setAttributes({ result: 'no_exercises_after_preferences' });
          return { recommended: [], other: [] };
        }

        const primaryMuscle = currentExercise.primary_muscles?.[0] || 'Unknown';

        // Use the same categorization helper function for consistent distribution
        const categorizationStartTime = Date.now();
        const result = categorizeExercises(allProcessed, primaryMuscle);
        const categorizationDuration = Date.now() - categorizationStartTime;

        const totalDuration = Date.now() - startTime;

        console.log(`🎯 Enhanced categorization result for ${primaryMuscle} (SMART SPLIT):`, {
          recommended: result.recommended.length,
          other: result.other.length,
          total: result.recommended.length + result.other.length,
          distribution: `${Math.round((result.recommended.length / (result.recommended.length + result.other.length)) * 100)}% recommended, ${Math.round((result.other.length / (result.recommended.length + result.other.length)) * 100)}% other`,
          recommendedNames: result.recommended.slice(0, 3).map((ex) => ex.name),
          otherNames: result.other.slice(0, 3).map((ex) => ex.name),
        });

        // Log performance metrics
        if (totalDuration > 7000) {
          capturePerformanceError(
            `Slow enhanced exercise alternatives fetch for muscle group: ${primaryMuscle}`,
            'enhanced_service_duration',
            totalDuration,
          );
        }

        span.setAttributes({
          preferences_applied: 'yes',
          result: 'success',
          muscle_group: primaryMuscle,
          recommended_count: result.recommended.length,
          other_count: result.other.length,
          total_duration_ms: totalDuration,
          preferences_processing_ms: preferencesProcessingDuration,
          categorization_duration_ms: categorizationDuration,
          base_fetch_duration_ms: baseFetchDuration,
        });

        return {
          recommended: result.recommended, // Show ALL recommended exercises for this muscle group
          other: result.other, // Show ALL other alternatives for this muscle group
        };
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));

        console.error('Error in fetchEnhancedExerciseAlternatives:', error);

        captureError(errorObj, {
          category: 'api_error',
          component: 'exerciseAlternativesService',
          operation: 'fetchEnhancedExerciseAlternatives',
          exerciseId: currentExercise.exercise_id,
          userPreferences,
        });

        span.setAttributes({
          result: 'error',
          error_message: errorObj.message,
        });

        return { recommended: [], other: [] };
      }
    },
  );
}

export default {
  fetchExerciseAlternatives,
  fetchEnhancedExerciseAlternatives,
};
