import supabase from './supabase';
import { supabaseUrl } from './supabase';

// Updated interface to match the actual database schema
export interface WorkoutPlan {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  subcategory_id: string;
  difficulty: string;  // Mapped from difficulty_level in transformResponse
  estimated_duration?: number;  // From database
  duration_weeks: number;  // Calculated/mapped from other data
  days_per_week: number;   // Extracted from subcategory_identifier
  display_order: number;
  accent_color?: string;
  created_at: string;
  updated_at: string;
  identifier?: string;
  subcategory_identifier?: string;
  subcategory_title?: string; // Added field for subcategory title
  subcategory_subtitle?: string; // Added field for subcategory subtitle
}

// Interface for raw database response
interface RawWorkoutPlan {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  subcategory_id: string;
  difficulty_level: string;
  estimated_duration: number;
  accent_color: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  identifier: string;
  subcategory_identifier: string;
  subcategory_title?: string;
}

// Workout subcategory interface
export interface WorkoutSubcategory {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  identifier: string;
  accent_color?: string;
  subtitle?: string; // Add subtitle field
}

// Interface for plan exercise
export interface PlanExercise {
  id: string;
  exercise_id: string;
  name: string;
  image_url?: string;
  sets: number;
  reps: string; // range like '8-10'
  equipment?: string;
  muscle_group?: string;
  primary_muscles?: string[];
  secondary_muscles?: string[];
  instructions?: string[];
  rest_time?: number; // in seconds
  order: number;
}

const workoutPlanService = {
  // Transform database response to match the WorkoutPlan interface
  transformResponse(plan: RawWorkoutPlan): WorkoutPlan {
    // Extract days per week from subcategory_identifier (format: something_X_days?_week)
    const daysMatch = plan.subcategory_identifier.match(/(\d+)_days?_week/);
    const daysPerWeek = daysMatch ? parseInt(daysMatch[1], 10) : 3; // Default to 3 if not found
    
    // Calculate duration_weeks based on estimated_duration (this is just an example)
    // In a real app, you might want to use different logic or store this in the database
    const durationWeeks = 4; // Default to 4 weeks for all plans
    
    // Process image URL if it exists
    let imageUrl = plan.image_url;
    
    // If we have an image URL from the database that doesn't start with http,
    // but isn't one of our fallback images, it might be a public Supabase storage URL
    if (imageUrl && !imageUrl.startsWith('http') && 
        !['fullbody.jpg', 'dumbbell.jpg', 'pushup.jpg', 'squat.jpg', 'yoga.jpg', 'placeholder.jpg'].includes(imageUrl)) {
      
      // Assume it's in Supabase storage and construct the full URL
      // This URL format may need adjustment based on your actual Supabase storage setup
      imageUrl = `${supabaseUrl}/storage/v1/object/public/images/${imageUrl}`;
    }
    // If no image URL, assign a default image based on title
    else if (!imageUrl) {
      if (plan.title.toLowerCase().includes('strength')) {
        imageUrl = 'squat.jpg';
      } else if (plan.title.toLowerCase().includes('lean')) {
        imageUrl = 'dumbbell.jpg';
      } else if (plan.title.toLowerCase().includes('beginner')) {
        imageUrl = 'pushup.jpg';
      } else {
        imageUrl = 'fullbody.jpg'; // Default image
      }
    }
    
    return {
      ...plan,
      difficulty: plan.difficulty_level,
      duration_weeks: durationWeeks,
      days_per_week: daysPerWeek,
      image_url: imageUrl
    };
  },

  async getAllPlans(): Promise<WorkoutPlan[]> {
    const { data, error } = await supabase
      .from('workout_plans')
      .select(`
        *,
        workout_subcategories:subcategory_id (title)
      `)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching workout plans:', error);
      return []; // Return empty array instead of throwing error
    }

    // Transform data to include subcategory title
    const plansWithSubcategory = data?.map(plan => ({
      ...plan,
      subcategory_title: plan.workout_subcategories?.title || ''
    })) || [];

    // Transform each plan to match the interface
    return plansWithSubcategory.map(this.transformResponse);
  },

  async getSubcategoryById(subcategoryId: string): Promise<WorkoutSubcategory | null> {
    const { data, error } = await supabase
      .from('workout_subcategories')
      .select('*')
      .eq('id', subcategoryId)
      .single();

    if (error) {
      console.error('Error fetching workout subcategory:', error);
      return null;
    }

    return data as WorkoutSubcategory;
  },

  async getSubcategoryByIdentifier(identifier: string): Promise<WorkoutSubcategory | null> {
    const { data, error } = await supabase
      .from('workout_subcategories')
      .select('*')
      .eq('identifier', identifier)
      .single();

    if (error) {
      console.error('Error fetching workout subcategory by identifier:', error);
      return null;
    }

    return data as WorkoutSubcategory;
  },

  async getPlansBySubcategory(subcategoryId: string): Promise<WorkoutPlan[]> {
    // Return empty array if no subcategory ID is provided
    if (!subcategoryId) {
      return [];
    }

    try {
      // First try to get the subcategory details to include the title
      const subcategory = await this.getSubcategoryByIdentifier(subcategoryId);
      
      const { data, error } = await supabase
        .from('workout_plans')
        .select(`
          *,
          workout_subcategories:subcategory_id (title)
        `)
        .eq('subcategory_identifier', subcategoryId)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching workout plans by subcategory:', error);
        console.error('Error details:', error.message);
        // Return empty array instead of sample data
        return [];
      }

      if (!data || data.length === 0) {
        // Try a secondary query approach
        const { data: secondaryData, error: secondaryError } = await supabase
          .from('workout_plans')
          .select(`
            *,
            workout_subcategories:subcategory_id (title)
          `)
          .eq('subcategory_id', subcategoryId)
          .order('display_order', { ascending: true });
          
        if (secondaryError || !secondaryData || secondaryData.length === 0) {
          // Return empty array instead of sample data
          return [];
        }
        
        // Transform data to include subcategory title and subtitle
        const plansWithSubcategory = secondaryData.map(plan => ({
          ...plan,
          subcategory_title: plan.workout_subcategories?.title || (subcategory?.title || ''),
          subcategory_subtitle: plan.workout_subcategories?.subtitle || (subcategory?.subtitle || '')
        }));

        return plansWithSubcategory.map(this.transformResponse);
      }

      // Transform data to include subcategory title and subtitle
      const plansWithSubcategory = data.map(plan => ({
        ...plan,
        subcategory_title: plan.workout_subcategories?.title || (subcategory?.title || ''),
        subcategory_subtitle: plan.workout_subcategories?.subtitle || (subcategory?.subtitle || '')
      }));

      // Transform each plan to match the interface
      return plansWithSubcategory.map(this.transformResponse);
    } catch (error) {
      console.error('Error in getPlansBySubcategory:', error);
      // Return empty array instead of sample data
      return [];
    }
  },

  async getPlanById(planId: string): Promise<WorkoutPlan | null> {
    const { data, error } = await supabase
      .from('workout_plans')
      .select(`
        *,
        workout_subcategories:subcategory_id (title)
      `)
      .eq('id', planId)
      .single();

    if (error) {
      console.error('Error fetching workout plan by ID:', error);
      throw error;
    }

    if (!data) return null;

    // Add subcategory title to plan data
    const planWithSubcategory = {
      ...data,
      subcategory_title: data.workout_subcategories?.title || ''
    };

    return this.transformResponse(planWithSubcategory);
  },

  async createPlan(plan: Omit<WorkoutPlan, 'id' | 'created_at' | 'updated_at'>): Promise<WorkoutPlan> {
    const { data, error } = await supabase
      .from('workout_plans')
      .insert([plan])
      .select()
      .single();

    if (error) {
      console.error('Error creating workout plan:', error);
      throw error;
    }

    return this.transformResponse(data);
  },

  async updatePlan(planId: string, updates: Partial<WorkoutPlan>): Promise<WorkoutPlan> {
    const { data, error } = await supabase
      .from('workout_plans')
      .update(updates)
      .eq('id', planId)
      .select()
      .single();

    if (error) {
      console.error('Error updating workout plan:', error);
      throw error;
    }

    return this.transformResponse(data);
  },

  // Helper method to provide sample workout plans as fallback
  getSampleWorkoutPlans(): WorkoutPlan[] {
    const projectId = 'jhdcpgriosdjjyakwfhu'; // Using the provided project ID
    
    return [
      {
        id: `${projectId}-001`,
        title: 'Beginner Workout',
        description: 'A complete workout plan for beginners',
        image_url: 'fullbody.jpg',
        subcategory_id: 'full-body-workouts',
        difficulty: 'beginner',
        duration_weeks: 4,
        days_per_week: 3,
        display_order: 1,
        subcategory_title: 'Full Body Split',
        subcategory_subtitle: '3 Days a Week',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: `${projectId}-002`,
        title: 'Intermediate Training',
        description: 'Step up your fitness with this intermediate plan',
        image_url: 'dumbbell.jpg',
        subcategory_id: 'full-body-workouts',
        difficulty: 'intermediate',
        duration_weeks: 6,
        days_per_week: 4,
        display_order: 2,
        subcategory_title: 'Full Body Split',
        subcategory_subtitle: '4 Days a Week',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: `${projectId}-003`,
        title: 'Advanced Strength',
        description: 'Push your limits with advanced exercises',
        image_url: 'pushup.jpg',
        subcategory_id: 'full-body-workouts',
        difficulty: 'advanced',
        duration_weeks: 8, 
        days_per_week: 5,
        display_order: 3,
        subcategory_title: 'Full Body Split',
        subcategory_subtitle: '5 Days a Week',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  },

  async getPlanExercises(planId: string): Promise<PlanExercise[]> {
    try {
      // Ensure planId is properly formatted
      if (!planId || typeof planId !== 'string') {
        return [];
      }

      // Use a direct query approach with proper joining
      const { data, error } = await supabase
        .from('workout_plan_exercises')
        .select(`
          id, 
          plan_id,
          exercise_id,
          sets,
          reps_range,
          rest_time,
          "order",
          exercises(
            id,
            name,
            image_url,
            muscle_group,
            equipment,
            primary_muscles,
            secondary_muscles
          )
        `)
        .eq('plan_id', planId)
        .order('"order"', { ascending: true });

      if (error) {
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Transform the data to match the PlanExercise interface
      const result: PlanExercise[] = [];

      for (const item of data) {
        // Safe access to nested exercise data
        const exerciseData = item.exercises as any;
        
        const planExercise: PlanExercise = {
          id: item.id,
          exercise_id: item.exercise_id,
          name: exerciseData?.name || 'Unknown Exercise',
          image_url: exerciseData?.image_url,
          sets: item.sets || 3,
          reps: item.reps_range || '8-10',
          rest_time: item.rest_time || 60,
          order: item.order || 0,
          equipment: exerciseData?.equipment,
          muscle_group: exerciseData?.muscle_group,
          primary_muscles: exerciseData?.primary_muscles || [],
          secondary_muscles: exerciseData?.secondary_muscles || [],
        };
        result.push(planExercise);
      }

      return result;
    } catch (error) {
      return [];
    }
  }
};

export default workoutPlanService; 