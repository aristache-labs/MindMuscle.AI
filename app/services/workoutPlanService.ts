import supabase from './supabase';

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
    
    // Assign a default image if none is provided
    // Lowercase title to create a relevant image name if image_url is null
    let imageUrl = plan.image_url;
    if (!imageUrl) {
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
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching workout plans:', error);
      throw error;
    }

    // Transform each plan to match the interface
    return (data || []).map(this.transformResponse);
  },

  async getPlansBySubcategory(subcategoryId: string): Promise<WorkoutPlan[]> {
    // Create some sample workout plans if no subcategory ID is provided or if there's an error
    if (!subcategoryId) {
      console.log('No subcategory ID provided, returning sample plans');
      return this.getSampleWorkoutPlans();
    }

    try {
      console.log('Querying workout_plans with subcategory_identifier:', subcategoryId);
      
      const { data, error } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('subcategory_identifier', subcategoryId)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching workout plans by subcategory:', error);
        console.error('Error details:', error.message);
        // Return sample data as fallback
        return this.getSampleWorkoutPlans();
      }

      if (!data || data.length === 0) {
        console.log('No plans found for subcategory:', subcategoryId);
        // Try a secondary query approach
        const { data: secondaryData, error: secondaryError } = await supabase
          .from('workout_plans')
          .select('*')
          .eq('subcategory_id', subcategoryId)
          .order('display_order', { ascending: true });
          
        if (secondaryError || !secondaryData || secondaryData.length === 0) {
          console.log('Secondary query also failed or found no results');
          // Return sample data if no plans found
          return this.getSampleWorkoutPlans();
        }
        
        console.log(`Found ${secondaryData.length} plans using subcategory_id instead`);
        return secondaryData.map(this.transformResponse);
      }

      console.log(`Found ${data.length} plans for subcategory_identifier: ${subcategoryId}`);
      // Transform each plan to match the interface
      return data.map(this.transformResponse);
    } catch (error) {
      console.error('Exception in getPlansBySubcategory:', error);
      // Return sample data as fallback
      return this.getSampleWorkoutPlans();
    }
  },

  async getPlanById(planId: string): Promise<WorkoutPlan | null> {
    const { data, error } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (error) {
      console.error('Error fetching workout plan by ID:', error);
      throw error;
    }

    return data ? this.transformResponse(data) : null;
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  }
};

export default workoutPlanService; 