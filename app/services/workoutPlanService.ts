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
  title: string;
  image_url: string | null;
  subcategory_id: string;
  difficulty: string;  // Mapped from difficulty_level in transformResponse
  estimated_duration?: number;  // From database
  duration_weeks: number;  // Calculated/mapped from other data
  days_per_week: number;   // Extracted from subcategory_identifier
  display_order: number;
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
  }
};

export default workoutPlanService; 