import supabase from './supabase';

export interface PlanExercise {
  id: string;
  name: string;
  sets?: number;
  reps_range?: string;
  image_url?: string;
  primary_muscles?: string[];
  secondary_muscles?: string[];
  exercise_id?: string;
  workout_day?: number;
  order?: number;
}

export interface WorkoutPlan {
  id: string;
  title: string;
  subtitle?: string;
  difficulty_level?: string;
  category_name?: string;
  estimated_duration?: number;
  workout_frequency?: number;
  exercises: PlanExercise[];
}

/**
 * Fetches workout plan details by ID
 * @param planId The ID of the workout plan to fetch
 * @returns The workout plan details or null if not found
 */
const getWorkoutPlanById = async (planId: string): Promise<WorkoutPlan | null> => {
  try {
    // Fetch the plan data
    const { data: planData, error: planError } = await supabase
      .from('workout_plans')
      .select('*, workout_subcategories!workout_plans_subcategory_id_fkey(title, category_identifier, subtitle)')
      .eq('id', planId)
      .single();
      
    if (planError) throw planError;
    
    // Fetch the category name
    let categoryName = '';
    if (planData?.workout_subcategories?.category_identifier) {
      const { data: categoryData, error: categoryError } = await supabase
        .from('workout_categories')
        .select('name')
        .eq('identifier', planData.workout_subcategories.category_identifier)
        .single();
        
      if (!categoryError && categoryData) {
        categoryName = categoryData.name;
      }
    }
    
    // Fetch the exercises for this plan
    const { data: exercisesData, error: exercisesError } = await supabase
      .from('workout_plan_exercises')
      .select(`
        id,
        sets,
        reps_range,
        exercise_id,
        workout_day,
        exercise_name,
        order,
        exercises:exercise_id (
          id,
          name,
          image_url,
          primary_muscles,
          secondary_muscles
        )
      `)
      .eq('plan_id', planId)
      .order('workout_day', { ascending: true })
      .order('order', { ascending: true });
      
    if (exercisesError) throw exercisesError;
    
    // Process exercise data
    const exercises: PlanExercise[] = exercisesData.map((item: any) => ({
      id: item.id,
      name: item.exercise_name || item.exercises?.name || 'Unknown Exercise',
      sets: item.sets,
      reps_range: item.reps_range,
      image_url: item.exercises?.image_url,
      primary_muscles: item.exercises?.primary_muscles,
      secondary_muscles: item.exercises?.secondary_muscles,
      workout_day: item.workout_day || 0,
      exercise_id: item.exercises?.id,
      order: item.order
    }));
    
    // Format the data
    const workoutPlan: WorkoutPlan = {
      id: planData.id,
      title: planData.title,
      difficulty_level: planData.difficulty_level,
      estimated_duration: planData.estimated_duration,
      category_name: categoryName || 'Workout Plan',
      subtitle: planData.workout_subcategories?.subtitle,
      workout_frequency: planData.workout_frequency || 0,
      exercises
    };
    
    return workoutPlan;
  } catch (err) {
    console.error('Error fetching workout plan:', err);
    return null;
  }
};

export default {
  getWorkoutPlanById
}; 