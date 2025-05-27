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

// Helper to get cached exercises (reuse existing cache system)
const getCachedExercises = () => {
  try {
    const cache = (global as any).exercisesCache;
    if (!cache) return null;
    
    // Check if cache is expired (30 minutes)
    const CACHE_EXPIRY = 30 * 60 * 1000;
    const now = Date.now();
    if (now - cache.lastUpdated > CACHE_EXPIRY) {
      console.log('Exercise cache expired, will refresh from API');
      return null;
    }
    
    return cache;
  } catch (error) {
    console.warn('Error accessing exercise cache:', error);
    return null;
  }
};

// Helper to fetch exercises for specific muscle group with caching
const getExercisesForMuscleGroup = async (primaryMuscle: string): Promise<Exercise[]> => {
  // Try cache first
  const cache = getCachedExercises();
  if (cache?.all) {
    console.log(`🚀 Using cached exercises for muscle group: ${primaryMuscle}`);
    // Filter cached exercises by primary muscle
    return cache.all.filter((exercise: Exercise) => 
      exercise.primary_muscles && exercise.primary_muscles.includes(primaryMuscle)
    );
  }
  
  // Fallback to API call for specific muscle group
  console.log(`📡 Fetching exercises from API for muscle group: ${primaryMuscle}`);
  const { data: exercises, error } = await supabase
    .from('exercises')
    .select('*')
    .contains('primary_muscles', [primaryMuscle])
    .order('name');

  if (error) {
    console.error(`❌ Error fetching exercises for ${primaryMuscle}:`, error);
    throw error;
  }

  return exercises || [];
};

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
    'squat', 'deadlift', 'bench', 'press', 'row', 'curl', 'extension', 
    'raise', 'fly', 'pulldown', 'pushup', 'pullup', 'dip', 'lunge', 
    'crunch', 'plank', 'leg press', 'chest press'
  ];
  
  const exerciseNameLower = exercise.name.toLowerCase();
  const hasCommonKeyword = commonExerciseKeywords.some(keyword => 
    exerciseNameLower.includes(keyword)
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
  
  const primaryMuscleMatch = exercisePrimaryMuscles.some(muscle => 
    currentPrimaryMuscles.includes(muscle)
  );
  if (primaryMuscleMatch) score += 40; // Reduced from 50 to allow more variety

  // Equipment similarity
  if (exercise.equipment === currentExercise.equipment) score += 15; // Reduced from 20

  // Difficulty similarity
  if (exercise.difficulty === currentExercise.difficulty) score += 10; // Reduced from 15

  // Weight requirement match
  if (exercise.requires_weight === currentExercise.requires_weight) score += 8; // Reduced from 10

  // Penalty for very different difficulty levels (reduced penalty)
  const difficultyLevels = { 'Beginner': 1, 'Intermediate': 2, 'Advanced': 3 };
  const currentLevel = difficultyLevels[currentExercise.difficulty as keyof typeof difficultyLevels] || 2;
  const exerciseLevel = difficultyLevels[exercise.difficulty as keyof typeof difficultyLevels] || 2;
  const difficultyDiff = Math.abs(currentLevel - exerciseLevel);
  score -= difficultyDiff * 3; // Reduced penalty from 5 to 3

  // Add popularity score to overall score
  score += calculatePopularityScore(exercise);

  return Math.max(0, score);
}

/**
 * Fetches exercise alternatives for a given exercise, showing ALL exercises for the SAME muscle group
 * Uses caching for optimal performance with large datasets
 */
export async function fetchExerciseAlternatives(
  currentExercise: CurrentExercise
): Promise<{
  recommended: ExerciseAlternative[];
  other: ExerciseAlternative[];
}> {
  try {
    console.log('🔍 fetchExerciseAlternatives called with:', {
      exercise_id: currentExercise.exercise_id,
      primary_muscles: currentExercise.primary_muscles,
      difficulty: currentExercise.difficulty,
      equipment: currentExercise.equipment
    });

    if (!currentExercise.primary_muscles || currentExercise.primary_muscles.length === 0) {
      console.log('❌ No primary muscles found for current exercise');
      return { recommended: [], other: [] };
    }

    const primaryMuscle = currentExercise.primary_muscles[0];
    console.log(`🎯 Fetching ALL exercises for muscle group: ${primaryMuscle}`);

    // Get ALL exercises for the same muscle group using cache for optimal performance
    const muscleGroupExercises = await getExercisesForMuscleGroup(primaryMuscle);
    
    if (!muscleGroupExercises || muscleGroupExercises.length === 0) {
      console.log(`❌ No exercises found for muscle group: ${primaryMuscle}`);
      return { recommended: [], other: [] };
    }

    console.log(`📊 Found ${muscleGroupExercises.length} exercises for ${primaryMuscle} muscle group`);

    // Filter out current exercise and process all others in the same muscle group
    const availableExercises = muscleGroupExercises.filter(exercise => 
      exercise.id !== currentExercise.exercise_id
    );

    console.log(`🎯 ${availableExercises.length} ${primaryMuscle} exercises available after filtering current exercise`);

    // Process ALL available exercises in the muscle group and add smart defaults
    const processedExercises: ExerciseAlternative[] = availableExercises.map(exercise => {
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

    // Sort by similarity score (highest first)
    processedExercises.sort((a, b) => b.similarity_score - a.similarity_score);

    console.log(`📊 Exercise categorization for ${primaryMuscle}:`, {
      totalExercises: processedExercises.length,
      topScores: processedExercises.slice(0, 5).map(ex => ({ name: ex.name, score: ex.similarity_score })),
      scoreRange: {
        highest: processedExercises[0]?.similarity_score || 0,
        lowest: processedExercises[processedExercises.length - 1]?.similarity_score || 0
      }
    });
    
    // Smart categorization to ensure proper split between recommended and other
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
      let dynamicThreshold = highestScore - (scoreRange * 0.4); // Top 40% of score range
      
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
        toMove.forEach(ex => {
          ex.recommendation_type = 'recommended';
          recommended.push(ex);
        });
      } else if (recommended.length > maxRecommended) {
        // Move some from recommended to other
        const needToMove = recommended.length - maxRecommended;
        const toMove = recommended.splice(maxRecommended);
        toMove.forEach(ex => {
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
      recommendedNames: recommended.slice(0, 3).map(ex => ex.name),
      otherNames: other.slice(0, 3).map(ex => ex.name)
    });

    return { 
      recommended: recommended, // Show ALL recommended exercises for this muscle group
      other: other // Show ALL other alternatives for this muscle group
    };

  } catch (error) {
    console.error('Error in fetchExerciseAlternatives:', error);
    return { recommended: [], other: [] };
  }
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
          recommendation_type: 'other' as 'recommended' | 'other' // Will be determined below
        };
      }).sort((a, b) => b.similarity_score - a.similarity_score);
    };

    const allProcessed = applyPreferences([...baseAlternatives.recommended, ...baseAlternatives.other]);
    
    // Apply the same smart categorization logic for consistent distribution
    const recommended: ExerciseAlternative[] = [];
    const other: ExerciseAlternative[] = [];
    
    if (allProcessed.length === 0) {
      return { recommended: [], other: [] };
    }
    
    // Use the same dynamic categorization as the main function
    if (allProcessed.length <= 4) {
      // For small sets, put top 50% in recommended, rest in other
      const splitIndex = Math.ceil(allProcessed.length / 2);
      
      for (let i = 0; i < allProcessed.length; i++) {
        const exercise = allProcessed[i];
        if (i < splitIndex) {
          exercise.recommendation_type = 'recommended';
          recommended.push(exercise);
        } else {
          exercise.recommendation_type = 'other';
          other.push(exercise);
        }
      }
    } else {
      // For larger sets, use dynamic threshold approach
      const totalExercises = allProcessed.length;
      const highestScore = allProcessed[0]?.similarity_score || 0;
      const lowestScore = allProcessed[allProcessed.length - 1]?.similarity_score || 0;
      const scoreRange = highestScore - lowestScore;
      
      // Calculate dynamic threshold based on score distribution
      let dynamicThreshold = highestScore - (scoreRange * 0.4); // Top 40% of score range
      
      // Ensure we have at least 30% in recommended and at least 20% in other
      const minRecommended = Math.ceil(totalExercises * 0.3);
      const maxRecommended = Math.floor(totalExercises * 0.8);
      
      // First pass: categorize by dynamic threshold
      for (let i = 0; i < allProcessed.length; i++) {
        const exercise = allProcessed[i];
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
        toMove.forEach(ex => {
          ex.recommendation_type = 'recommended';
          recommended.push(ex);
        });
      } else if (recommended.length > maxRecommended) {
        // Move some from recommended to other
        const needToMove = recommended.length - maxRecommended;
        const toMove = recommended.splice(maxRecommended);
        toMove.forEach(ex => {
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
    
    const primaryMuscle = currentExercise.primary_muscles?.[0] || 'Unknown';
    console.log(`🎯 Enhanced categorization result for ${primaryMuscle} (SMART SPLIT):`, {
      recommended: recommended.length,
      other: other.length,
      total: recommended.length + other.length,
      distribution: `${Math.round((recommended.length / (recommended.length + other.length)) * 100)}% recommended, ${Math.round((other.length / (recommended.length + other.length)) * 100)}% other`,
      recommendedNames: recommended.slice(0, 3).map(ex => ex.name),
      otherNames: other.slice(0, 3).map(ex => ex.name)
    });

    return {
      recommended: recommended, // Show ALL recommended exercises for this muscle group
      other: other // Show ALL other alternatives for this muscle group
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