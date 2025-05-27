import supabase from './supabase';

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

/**
 * Generates smart defaults for workout parameters based on exercise properties
 */
function generateSmartDefaults(
  exercise: Exercise, 
  currentExercise: CurrentExercise
): { sets: number; reps_range: string; rest_time: number } {
  // Use current exercise as base, but adjust based on new exercise properties
  let sets = currentExercise.sets;
  let reps_range = currentExercise.reps_range;
  let rest_time = currentExercise.rest_time;

  // Adjust based on difficulty
  if (exercise.difficulty === 'Beginner' && currentExercise.difficulty === 'Advanced') {
    // Easier exercise - might do more reps
    const [min, max] = reps_range.split('-').map(Number);
    if (!isNaN(min) && !isNaN(max)) {
      reps_range = `${min + 2}-${max + 2}`;
    }
  } else if (exercise.difficulty === 'Advanced' && currentExercise.difficulty === 'Beginner') {
    // Harder exercise - might do fewer reps
    const [min, max] = reps_range.split('-').map(Number);
    if (!isNaN(min) && !isNaN(max) && min > 2 && max > 2) {
      reps_range = `${min - 2}-${max - 2}`;
    }
  }

  // Adjust rest time based on exercise type
  if (exercise.primary_muscles.includes('Quads') || exercise.primary_muscles.includes('Hamstrings')) {
    // Leg exercises typically need more rest
    rest_time = Math.max(rest_time, 90);
  } else if (exercise.primary_muscles.includes('Abs') || exercise.primary_muscles.includes('Calves')) {
    // Smaller muscle groups need less rest
    rest_time = Math.min(rest_time, 60);
  }

  // Bodyweight vs weighted adjustments
  if (exercise.requires_weight !== currentExercise.requires_weight) {
    if (!exercise.requires_weight && currentExercise.requires_weight) {
      // Switching from weighted to bodyweight - increase reps
      const [min, max] = reps_range.split('-').map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        reps_range = `${min + 3}-${max + 5}`;
      }
    } else if (exercise.requires_weight && !currentExercise.requires_weight) {
      // Switching from bodyweight to weighted - decrease reps
      const [min, max] = reps_range.split('-').map(Number);
      if (!isNaN(min) && !isNaN(max) && min > 3 && max > 5) {
        reps_range = `${min - 3}-${max - 5}`;
      }
    }
  }

  return { sets, reps_range, rest_time };
}

/**
 * Calculates similarity score for exercise recommendation ranking
 */
function calculateSimilarityScore(exercise: Exercise, currentExercise: CurrentExercise): number {
  let score = 0;

  // Primary muscle match (highest weight)
  const currentPrimaryMuscles = currentExercise.primary_muscles || [];
  const exercisePrimaryMuscles = exercise.primary_muscles || [];
  
  const primaryMuscleMatch = exercisePrimaryMuscles.some(muscle => 
    currentPrimaryMuscles.includes(muscle)
  );
  if (primaryMuscleMatch) score += 50;

  // Equipment similarity
  if (exercise.equipment === currentExercise.equipment) score += 20;

  // Difficulty similarity
  if (exercise.difficulty === currentExercise.difficulty) score += 15;

  // Weight requirement match
  if (exercise.requires_weight === currentExercise.requires_weight) score += 10;

  // Penalty for very different difficulty levels
  const difficultyLevels = { 'Beginner': 1, 'Intermediate': 2, 'Advanced': 3 };
  const currentLevel = difficultyLevels[currentExercise.difficulty as keyof typeof difficultyLevels] || 2;
  const exerciseLevel = difficultyLevels[exercise.difficulty as keyof typeof difficultyLevels] || 2;
  const difficultyDiff = Math.abs(currentLevel - exerciseLevel);
  score -= difficultyDiff * 5;

  return Math.max(0, score);
}

/**
 * Fetches exercise alternatives for a given exercise, filtered by primary muscle group
 */
export async function fetchExerciseAlternatives(
  currentExercise: CurrentExercise
): Promise<{
  recommended: ExerciseAlternative[];
  other: ExerciseAlternative[];
}> {
  try {
    if (!currentExercise.primary_muscles || currentExercise.primary_muscles.length === 0) {
      return { recommended: [], other: [] };
    }

    const primaryMuscle = currentExercise.primary_muscles[0];

    // Fetch all exercises for the same primary muscle group
    const { data: exercises, error } = await supabase
      .from('exercises')
      .select('*')
      .contains('primary_muscles', [primaryMuscle])
      .neq('id', currentExercise.exercise_id); // Exclude current exercise

    if (error) {
      console.error('Error fetching exercise alternatives:', error);
      return { recommended: [], other: [] };
    }

    if (!exercises || exercises.length === 0) {
      return { recommended: [], other: [] };
    }

    // Process exercises and add smart defaults
    const processedExercises: ExerciseAlternative[] = exercises.map(exercise => {
      const smartDefaults = generateSmartDefaults(exercise, currentExercise);
      const similarityScore = calculateSimilarityScore(exercise, currentExercise);
      
      return {
        ...exercise,
        exercise_id: exercise.id, // Map id to exercise_id for compatibility
        ...smartDefaults,
        order: currentExercise.order,
        workout_day: currentExercise.workout_day,
        recommendation_type: (similarityScore >= 70 ? 'recommended' : 'other') as 'recommended' | 'other',
        similarity_score: similarityScore,
      };
    });

    // Sort by similarity score (highest first)
    processedExercises.sort((a, b) => b.similarity_score - a.similarity_score);

    // Split into recommended and other alternatives
    const recommended = processedExercises
      .filter(ex => ex.recommendation_type === 'recommended')
      .slice(0, 8) as ExerciseAlternative[]; // Limit to top 8 recommended

    const other = processedExercises
      .filter(ex => ex.recommendation_type === 'other')
      .slice(0, 12) as ExerciseAlternative[]; // Limit to top 12 other alternatives

    return { recommended, other };

  } catch (error) {
    console.error('Error in fetchExerciseAlternatives:', error);
    return { recommended: [], other: [] };
  }
}

/**
 * Fetches exercise alternatives with enhanced filtering for better recommendations
 */
export async function fetchEnhancedExerciseAlternatives(
  currentExercise: CurrentExercise,
  userPreferences?: {
    preferredEquipment?: string[];
    maxDifficulty?: string;
    preferBodyweight?: boolean;
  }
): Promise<{
  recommended: ExerciseAlternative[];
  other: ExerciseAlternative[];
}> {
  try {
    const baseAlternatives = await fetchExerciseAlternatives(currentExercise);
    
    if (!userPreferences) {
      return baseAlternatives;
    }

    // Apply user preferences to boost/filter recommendations
    const applyPreferences = (exercises: ExerciseAlternative[]) => {
      return exercises.map(exercise => {
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
        const difficultyLevels = { 'Beginner': 1, 'Intermediate': 2, 'Advanced': 3 };
        const maxLevel = difficultyLevels[userPreferences.maxDifficulty as keyof typeof difficultyLevels] || 3;
        const exerciseLevel = difficultyLevels[exercise.difficulty as keyof typeof difficultyLevels] || 2;
        
        if (exerciseLevel > maxLevel) {
          adjustedScore -= 30; // Heavy penalty for too difficult exercises
        }

        return {
          ...exercise,
          similarity_score: adjustedScore,
          recommendation_type: (adjustedScore >= 70 ? 'recommended' : 'other') as 'recommended' | 'other'
        };
      }).sort((a, b) => b.similarity_score - a.similarity_score);
    };

    const allProcessed = applyPreferences([...baseAlternatives.recommended, ...baseAlternatives.other]);
    
    return {
      recommended: allProcessed.filter(ex => ex.recommendation_type === 'recommended').slice(0, 8) as ExerciseAlternative[],
      other: allProcessed.filter(ex => ex.recommendation_type === 'other').slice(0, 12) as ExerciseAlternative[]
    };

  } catch (error) {
    console.error('Error in fetchEnhancedExerciseAlternatives:', error);
    return { recommended: [], other: [] };
  }
}

export default {
  fetchExerciseAlternatives,
  fetchEnhancedExerciseAlternatives,
}; 