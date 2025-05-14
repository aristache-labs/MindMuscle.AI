import supabase from './supabase';
import { supabaseUrl } from './supabase';
import { STORAGE_BUCKETS } from '../components/SplashScreenManager';
import { ref, uploadBytes, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import * as FileSystem from 'expo-file-system';

// Simple function to generate a unique ID without using crypto
function generateUniqueId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// Updated interface to match the actual database schema
export interface WorkoutPlan {
  id: string;
  title?: string;
  description?: string;
  image_url?: string;
  subcategory_id?: string;
  subcategory_name?: string;
  subcategory_subtitle?: string;
  category_id?: string;
  category_name?: string;
  identifier?: string;
  workout_frequency?: number; // Number of workout days per week
  difficulty: string;  // Mapped from difficulty_level in transformResponse
  estimated_duration?: number;  // From database
  duration_weeks: number;  // Calculated/mapped from other data
  days_per_week: number;   // Extracted from subcategory_identifier
  display_order: number;
  created_at: string;
  updated_at: string;
  subcategory_identifier?: string;
  subcategory_title?: string; // Added field for subcategory title
}

// Interface for raw database response
interface RawWorkoutPlan {
  id: string;
  title: string;
  image_url: string | null;
  subcategory_id: string;
  difficulty_level: string;
  estimated_duration: number;
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
  workout_day?: number; // Added workout day for multi-day plans
}

// Interface for workout session
export interface WorkoutSession {
  id: string;
  user_id: string;
  active_plan_id: string;
  start_time: string;
  end_time?: string;
  total_duration?: number; // in seconds
  calories_burned?: number;
  status: 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
}

// Interface for exercise set tracking
export interface ExerciseSet {
  exercise_id: string;
  set_number: number;
  weight?: number;
  reps: number;
  completed: boolean;
  notes?: string;
}

const workoutPlanService = {
  // Transform database response to match the WorkoutPlan interface
  transformResponse(plan: RawWorkoutPlan): WorkoutPlan {
    // Extract days per week from subcategory_identifier (format: something_X_days?_week)
    const daysMatch = plan.subcategory_identifier.match(/(\d+)_days?_week/);
    const daysPerWeek = daysMatch ? parseInt(daysMatch[1], 10) : 3; // Default to 3 if not found
    
    // Calculate duration_weeks based on estimated_duration
    const durationWeeks = 4; // Default to 4 weeks for all plans
    
    // Process image URL if it exists
    let imageUrl = plan.image_url;
    
    // If we have an image URL from the database that doesn't start with http,
    // but isn't one of our fallback images, it's in the plans bucket
    if (imageUrl && !imageUrl.startsWith('http') && 
        !['fullbody.jpg', 'dumbbell.jpg', 'pushup.jpg', 'squat.jpg', 'yoga.jpg', 'placeholder.jpg'].includes(imageUrl)) {
      
      // For Firebase storage, construct the URL directly
      const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
      const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
      const filePath = `${STORAGE_BUCKETS.PLANS}/${imageUrl}`;
      imageUrl = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(filePath)}?alt=media&key=${apiKey}`;
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
        workout_subcategories:subcategory_id (title, subtitle, accent_color)
      `)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching workout plans:', error);
      return []; // Return empty array instead of throwing error
    }

    // Transform data to include subcategory title
    const plansWithSubcategory = data?.map(plan => ({
      ...plan,
      subcategory_title: plan.workout_subcategories?.title || '',
      subcategory_subtitle: plan.workout_subcategories?.subtitle || '',
      accent_color: plan.workout_subcategories?.accent_color || ''
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
          workout_subcategories:subcategory_id (title, subtitle, accent_color)
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
            workout_subcategories:subcategory_id (title, subtitle, accent_color)
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
          subcategory_subtitle: plan.workout_subcategories?.subtitle || (subcategory?.subtitle || ''),
          accent_color: plan.workout_subcategories?.accent_color || ''
        }));

        return plansWithSubcategory.map(this.transformResponse);
      }

      // Transform data to include subcategory title and subtitle
      const plansWithSubcategory = data.map(plan => ({
        ...plan,
        subcategory_title: plan.workout_subcategories?.title || (subcategory?.title || ''),
        subcategory_subtitle: plan.workout_subcategories?.subtitle || (subcategory?.subtitle || ''),
        accent_color: plan.workout_subcategories?.accent_color || ''
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
        workout_subcategories:subcategory_id (title, subtitle, accent_color)
      `)
      .eq('id', planId)
      .single();

    if (error) {
      console.error('Error fetching workout plan by ID:', error);
      throw error;
    }

    if (!data) return null;

    // Add subcategory title and subtitle to plan data
    const planWithSubcategory = {
      ...data,
      subcategory_title: data.workout_subcategories?.title || '',
      subcategory_subtitle: data.workout_subcategories?.subtitle || '',
      accent_color: data.workout_subcategories?.accent_color || ''
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

  async getPlanExercises(planId: string, workoutDay?: number): Promise<PlanExercise[]> {
    try {
      // Build the query
      let query = supabase
        .from('workout_plan_exercises')
        .select(`
          *,
          exercises(*)
        `)
        .eq('plan_id', planId)
        .order('order', { ascending: true });
      
      // If a specific workout day is requested, filter by it
      if (workoutDay !== undefined) {
        query = query.eq('workout_day', workoutDay);
      }
      
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching plan exercises:', error);
        return [];
      }

      if (!data || data.length === 0) {
        // Try newer naming convention for order field if the first attempt returns no data
        const { data: alternativeData, error: alternativeError } = await supabase
          .from('workout_plan_exercises')
          .select(`
            *,
            exercises(*)
          `)
          .eq('plan_id', planId)
          .order('order_position', { ascending: true });
          
        if (alternativeError || !alternativeData || alternativeData.length === 0) {
          return [];
        }
        
        // Map the exercise data
        return alternativeData.map(ex => {
          const exerciseDetails = ex.exercises || {};
          return {
            id: ex.id,
            exercise_id: ex.exercise_id,
            name: ex.exercise_name || exerciseDetails.name || 'Unknown Exercise',
            image_url: exerciseDetails.image_url || null,
            sets: ex.sets || 3,
            reps: ex.reps_range || ex.reps || '8-12',
            equipment: exerciseDetails.equipment || 'None',
            muscle_group: exerciseDetails.muscle_group || 'General',
            primary_muscles: exerciseDetails.primary_muscles || [],
            secondary_muscles: exerciseDetails.secondary_muscles || [],
            instructions: exerciseDetails.instructions || [],
            rest_time: ex.rest_time || 60,
            order: ex.order_position || ex.order || 0,
            workout_day: ex.workout_day || 1
          };
        });
      }
      
      // Map the exercise data
      return data.map(ex => {
        const exerciseDetails = ex.exercises || {};
        return {
          id: ex.id,
          exercise_id: ex.exercise_id,
          name: ex.exercise_name || exerciseDetails.name || 'Unknown Exercise',
          image_url: exerciseDetails.image_url || null,
          sets: ex.sets || 3,
          reps: ex.reps_range || ex.reps || '8-12',
          equipment: exerciseDetails.equipment || 'None',
          muscle_group: exerciseDetails.muscle_group || 'General',
          primary_muscles: exerciseDetails.primary_muscles || [],
          secondary_muscles: exerciseDetails.secondary_muscles || [],
          instructions: exerciseDetails.instructions || [],
          rest_time: ex.rest_time || 60,
          order: ex.order_position || ex.order || 0,
          workout_day: ex.workout_day || 1
        };
      });
    } catch (error) {
      console.error('Exception in getPlanExercises:', error);
      return [];
    }
  },

  // New function to get available workout days for a plan
  async getPlanWorkoutDays(planId: string): Promise<number[]> {
    try {
      const { data, error } = await supabase
        .from('workout_plan_exercises')
        .select('workout_day')
        .eq('plan_id', planId)
        .order('workout_day', { ascending: true });
        
      if (error || !data) {
        console.error('Error fetching workout days:', error);
        return [1]; // Default to day 1
      }
      
      // Extract unique workout days
      const uniqueDays = [...new Set(data.map(item => item.workout_day || 1))];
      
      // If no days found, return day 1 as default
      return uniqueDays.length > 0 ? uniqueDays : [1];
    } catch (error) {
      console.error('Exception in getPlanWorkoutDays:', error);
      return [1]; // Default to day 1
    }
  },

  // Add a new function to upload plan images to Firebase
  async uploadPlanImage(imageUri: string, planId: string): Promise<string> {
    try {
      console.log(`Uploading plan image to Firebase Storage: ${planId}`);
      
      // Generate a unique file name with timestamp
      const timestamp = Date.now();
      const filePath = `${STORAGE_BUCKETS.PLANS}/${planId}/cover.jpg`;
      
      // Get Firebase storage bucket and API key from environment variables
      const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
      const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
      
      // Create a temporary Firebase upload URL - include the API key for auth
      const uploadURL = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o?name=${encodeURIComponent(filePath)}&key=${apiKey}`;
      
      // Use Expo FileSystem to upload directly
      console.log(`Starting direct upload to Firebase path: ${filePath}`);
      
      // We'll check if the file is local or remote
      let fileToUpload = imageUri;
      
      // If it's a remote URL, we need to download it first
      if (imageUri.startsWith('http')) {
        const tempLocalUri = FileSystem.cacheDirectory + 'cover.jpg';
        const { uri: downloadedUri } = await FileSystem.downloadAsync(imageUri, tempLocalUri);
        fileToUpload = downloadedUri;
      }
      
      // Upload using FileSystem uploadAsync
      const uploadResponse = await FileSystem.uploadAsync(uploadURL, fileToUpload, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': 'image/jpeg',
        }
      });
      
      if (uploadResponse.status !== 200) {
        console.error('Upload response:', uploadResponse);
        throw new Error(`Upload failed with status: ${uploadResponse.status}`);
      }
      
      // Parse the response to get the download token
      let responseData;
      try {
        responseData = JSON.parse(uploadResponse.body);
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        console.log('Raw response body:', uploadResponse.body);
        throw new Error('Failed to parse server response');
      }
      
      // Check if the download token exists
      const downloadToken = responseData.downloadTokens;
      if (!downloadToken) {
        console.error('No download token in response:', responseData);
        throw new Error('No download token in response');
      }
      
      // Construct the download URL with both token and API key
      const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}&key=${apiKey}`;
      
      console.log(`File uploaded successfully, download URL: ${downloadURL}`);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading plan image:', error);
      throw error;
    }
  },

  // Add a function to delete plan images
  async deletePlanImage(planId: string): Promise<void> {
    try {
      console.log(`Deleting plan image from Firebase Storage: ${planId}`);
      
      const filePath = `${STORAGE_BUCKETS.PLANS}/${planId}/cover.jpg`;
      const fileRef = ref(storage, filePath);
      
      try {
        await deleteObject(fileRef);
        console.log(`Successfully deleted file: ${filePath}`);
      } catch (storageError) {
        console.error(`Error deleting file from Firebase Storage: ${storageError}`);
        // Continue even if deletion fails
      }
    } catch (error) {
      console.error('Error deleting plan image:', error);
      throw error;
    }
  },

  // Get active plans by section
  async getActivePlansBySection(section: 'default_plan' | 'single_workout' | 'ai_coaching' | 'custom_plan'): Promise<any[]> {
    if (!supabase.auth.getSession()) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('user_active_plans')
        .select(`
          id,
          plan_id,
          name,
          subtitle,
          exercise_count,
          duration,
          calories,
          accent_color,
          is_active,
          date_added,
          source_type,
          section,
          source_identifier,
          ai_prompt,
          custom_description,
          user_active_plan_exercises(*)
        `)
        .eq('section', section)
        .eq('is_active', true)
        .order('date_added', { ascending: false });

      if (error) {
        console.error('Error fetching active plans by section:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getActivePlansBySection:', error);
      return [];
    }
  },

  // Start a workout session
  async startWorkout(activePlanId: string, userId: string): Promise<WorkoutSession | null> {
    try {
      const now = new Date().toISOString();
      
      // Create a new workout session
      const { data, error } = await supabase
        .from('workout_sessions')
        .insert([
          {
            user_id: userId,
            active_plan_id: activePlanId,
            start_time: now,
            status: 'in_progress'
          }
        ])
        .select()
        .single();
        
      if (error) {
        console.error('Error starting workout session:', error);
        return null;
      }
      
      return data as WorkoutSession;
    } catch (error) {
      console.error('Error in startWorkout:', error);
      return null;
    }
  },
  
  // Complete a workout session
  async completeWorkout(sessionId: string, data: { 
    totalDuration?: number, 
    caloriesBurned?: number, 
    notes?: string 
  }): Promise<WorkoutSession | null> {
    try {
      const now = new Date().toISOString();
      
      const { data: updatedSession, error } = await supabase
        .from('workout_sessions')
        .update({
          end_time: now,
          total_duration: data.totalDuration,
          calories_burned: data.caloriesBurned,
          notes: data.notes,
          status: 'completed'
        })
        .eq('id', sessionId)
        .select()
        .single();
        
      if (error) {
        console.error('Error completing workout session:', error);
        return null;
      }
      
      return updatedSession as WorkoutSession;
    } catch (error) {
      console.error('Error in completeWorkout:', error);
      return null;
    }
  },
  
  // Log exercise set during workout
  async logExerciseSet(
    sessionId: string, 
    exerciseData: {
      exercise_id: string,
      set_number: number,
      weight?: number,
      reps: number,
      notes?: string
    }
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('workout_exercise_sets')
        .insert([
          {
            session_id: sessionId,
            exercise_id: exerciseData.exercise_id,
            set_number: exerciseData.set_number,
            weight: exerciseData.weight,
            reps: exerciseData.reps,
            completed: true,
            notes: exerciseData.notes
          }
        ]);
        
      if (error) {
        console.error('Error logging exercise set:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error in logExerciseSet:', error);
      return false;
    }
  },
  
  // Get workout history for a user
  async getWorkoutHistory(userId: string, limit: number = 10): Promise<WorkoutSession[]> {
    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(`
          *,
          user_active_plans(
            name,
            subtitle,
            exercise_count,
            duration,
            calories
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('start_time', { ascending: false })
        .limit(limit);
        
      if (error) {
        console.error('Error fetching workout history:', error);
        return [];
      }
      
      return data as WorkoutSession[];
    } catch (error) {
      console.error('Error in getWorkoutHistory:', error);
      return [];
    }
  },
  
  // Get detailed exercise history for a completed workout
  async getWorkoutExerciseSets(sessionId: string): Promise<ExerciseSet[]> {
    try {
      const { data, error } = await supabase
        .from('workout_exercise_sets')
        .select(`
          *,
          exercises(
            name,
            image_url,
            muscle_group,
            primary_muscles
          )
        `)
        .eq('session_id', sessionId)
        .order('set_number', { ascending: true });
        
      if (error) {
        console.error('Error fetching workout exercise sets:', error);
        return [];
      }
      
      return data as ExerciseSet[];
    } catch (error) {
      console.error('Error in getWorkoutExerciseSets:', error);
      return [];
    }
  }
};

export default workoutPlanService; 