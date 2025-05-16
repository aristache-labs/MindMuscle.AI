import supabase from './supabase';
import { supabaseUrl } from './supabase';
import { STORAGE_BUCKETS } from '../components/SplashScreenManager';
import { ref, uploadBytes, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
// Import debug helpers
import { createComponentLogger } from '../utils/debugHelpers';

// Create a logger for workout plans
const logger = createComponentLogger('WORKOUT_PLAN');

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
  created_at: string;
  updated_at: string;
}

// Update the ExerciseSet interface to match our new structure
export interface ExerciseHistory {
  id?: string;
  session_id: string;
  exercise_id: string;
  sets_completed: number;
  total_volume: number;
  sets_data: Array<{
    set: number;
    weight: number;
    reps: number;
  }>;
  notes?: string;
}

// Update the interface for offline workout data
interface OfflineWorkoutData {
  sessions: WorkoutSession[];
  exerciseHistory: ExerciseHistory[];
}

// Add new interface for user exercise history entry
export interface UserExerciseHistory {
  id?: string;
  user_id: string;
  exercise_id: string;
  session_id: string;
  weight: number;
  reps: number;
  set_number: number;
  completed_at: string;
  personal_record: boolean;
  notes?: string;
}

// Add new interface for personal record
export interface PersonalRecord {
  id?: string;
  user_id: string;
  exercise_id: string;
  weight: number;
  reps: number;
  date: string;
  notes?: string;
}

const STORAGE_KEYS = {
  OFFLINE_WORKOUTS: '@offline_workouts',
};

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
      logger.error('Error fetching workout plans:', error);
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
      logger.error('Error fetching workout subcategory:', error);
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
      logger.error('Error fetching workout subcategory by identifier:', error);
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
        logger.error('Error fetching workout plans by subcategory:', error);
        logger.error('Error details:', () => error.message);
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
      logger.error('Error in getPlansBySubcategory:', error);
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
      logger.error('Error fetching workout plan by ID:', error);
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
      logger.error('Error creating workout plan:', error);
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
      logger.error('Error updating workout plan:', error);
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
      logger.debug(`Loading exercises for plan ${planId}`, () => ({ workoutDay: workoutDay !== undefined ? workoutDay : 'all days' }));
      
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
        logger.error('Error fetching plan exercises:', error);
        return [];
      }

      if (!data || data.length === 0) {
        logger.debug('No exercises found with first query attempt, trying with alternate query...');
        
        // Try alternate approach - if no results found with current query
        let alternativeQuery = supabase
          .from('workout_plan_exercises')
          .select(`
            *,
            exercises(*)
          `)
          .eq('plan_id', planId)
          .order('order', { ascending: true });
          
        // Apply workout day filter if specified  
        if (workoutDay !== undefined) {
          alternativeQuery = alternativeQuery.eq('workout_day', workoutDay);
        }
        
        const { data: alternativeData, error: alternativeError } = await alternativeQuery;
          
        if (alternativeError) {
          logger.error('Error in alternate query:', alternativeError);
          return [];
        }
        
        if (!alternativeData || alternativeData.length === 0) {
          logger.debug('No exercises found with alternate query either');
          return [];
        }
        
        logger.debug(`Found ${alternativeData.length} exercises with alternate query`);
        
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
            order: ex.order || 0,
            workout_day: ex.workout_day !== undefined ? ex.workout_day : 0
          };
        });
      }
      
      logger.debug(`Found ${data.length} exercises with first query attempt`);
      
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
          order: ex.order || 0,
          workout_day: ex.workout_day !== undefined ? ex.workout_day : 0
        };
      });
    } catch (error) {
      logger.error('Exception in getPlanExercises:', error);
      return [];
    }
  },

  // New function to get available workout days for a plan
  async getPlanWorkoutDays(planId: string): Promise<number[]> {
    try {
      logger.debug(`Getting workout days for plan ${planId}`);
      
      // First try with the workout_day field
      const { data, error } = await supabase
        .from('workout_plan_exercises')
        .select('workout_day')
        .eq('plan_id', planId)
        .order('workout_day', { ascending: true });
        
      if (error) {
        logger.error('Error fetching workout days:', error);
        return [0]; // Default to day 0
      }
      
      // Extract unique workout days
      const uniqueDays = [...new Set(data.map(item => 
        item.workout_day !== undefined && item.workout_day !== null ? 
        item.workout_day : 0
      ))];
      
      logger.debug('Available workout days:', () => ({ days: uniqueDays }));
      
      // If no days found, return day 0 as default
      return uniqueDays.length > 0 ? uniqueDays : [0];
    } catch (error) {
      logger.error('Exception in getPlanWorkoutDays:', error);
      return [0]; // Default to day 0
    }
  },

  // Add a new function to upload plan images to Firebase
  async uploadPlanImage(imageUri: string, planId: string): Promise<string> {
    try {
      logger.debug(`Uploading plan image to Firebase Storage: ${planId}`);
      
      // Generate a unique file name with timestamp
      const timestamp = Date.now();
      const filePath = `${STORAGE_BUCKETS.PLANS}/${planId}/cover.jpg`;
      
      // Get Firebase storage bucket and API key from environment variables
      const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
      const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
      
      // Create a temporary Firebase upload URL - include the API key for auth
      const uploadURL = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o?name=${encodeURIComponent(filePath)}&key=${apiKey}`;
      
      // Use Expo FileSystem to upload directly
      logger.debug(`Starting direct upload to Firebase path: ${filePath}`);
      
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
        logger.error('Upload response:', uploadResponse);
        throw new Error(`Upload failed with status: ${uploadResponse.status}`);
      }
      
      // Parse the response to get the download token
      let responseData;
      try {
        responseData = JSON.parse(uploadResponse.body);
      } catch (parseError) {
        logger.error('Error parsing response:', parseError);
        logger.log('Raw response body:', uploadResponse.body);
        throw new Error('Failed to parse server response');
      }
      
      // Check if the download token exists
      const downloadToken = responseData.downloadTokens;
      if (!downloadToken) {
        logger.error('No download token in response:', responseData);
        throw new Error('No download token in response');
      }
      
      // Construct the download URL with both token and API key
      const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}&key=${apiKey}`;
      
      logger.debug(`File uploaded successfully, download URL: ${downloadURL}`);
      return downloadURL;
    } catch (error) {
      logger.error('Error uploading plan image:', error);
      throw error;
    }
  },

  // Add a function to delete plan images
  async deletePlanImage(planId: string): Promise<void> {
    try {
      logger.debug(`Deleting plan image from Firebase Storage: ${planId}`);
      
      const filePath = `${STORAGE_BUCKETS.PLANS}/${planId}/cover.jpg`;
      const fileRef = ref(storage, filePath);
      
      try {
        await deleteObject(fileRef);
        logger.debug(`Successfully deleted file: ${filePath}`);
      } catch (storageError) {
        logger.error(`Error deleting file from Firebase Storage: ${storageError}`);
        // Continue even if deletion fails
      }
    } catch (error) {
      logger.error('Error deleting plan image:', error);
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
        logger.error('Error fetching active plans by section:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getActivePlansBySection:', error);
      return [];
    }
  },

  // Get offline workout data with robust validation
  async getOfflineWorkoutData(): Promise<OfflineWorkoutData> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_WORKOUTS);
      
      if (!data) {
        return { sessions: [], exerciseHistory: [] };
      }
      
      let parsedData: OfflineWorkoutData;
      
      try {
        parsedData = JSON.parse(data);
      } catch (parseError) {
        logger.error('Error parsing offline workout data:', parseError);
        // If JSON is corrupted, return empty data
        return { sessions: [], exerciseHistory: [] };
      }
      
      // Ensure the structure is valid
      if (!parsedData || typeof parsedData !== 'object') {
        return { sessions: [], exerciseHistory: [] };
      }
      
      // Ensure sessions array exists and is valid
      if (!Array.isArray(parsedData.sessions)) {
        parsedData.sessions = [];
      }
      
      // Ensure exerciseHistory array exists and is valid
      if (!Array.isArray(parsedData.exerciseHistory)) {
        parsedData.exerciseHistory = [];
      }
      
      // Validate each exercise history item
      parsedData.exerciseHistory = parsedData.exerciseHistory.map(history => {
        // Ensure sets_data is always an array
        if (!history.sets_data || !Array.isArray(history.sets_data)) {
          history.sets_data = [];
        }
        
        // Ensure each set has required properties
        history.sets_data = history.sets_data.filter(set => {
          if (!set || typeof set !== 'object') return false;
          // Convert null/undefined values to defaults
          set.set = set.set || 0;
          set.weight = set.weight || 0;
          set.reps = set.reps || 0;
          return true;
        });
        
        // Recalculate sets_completed and total_volume
        history.sets_completed = history.sets_data.length;
        history.total_volume = history.sets_data.reduce(
          (sum, set) => sum + ((set?.weight || 0) * (set?.reps || 0)), 
          0
        );
        
        return history;
      });
      
      return parsedData;
    } catch (error) {
      logger.error('Error getting offline workout data:', error);
      // Return empty data on any error
      return { sessions: [], exerciseHistory: [] };
    }
  },

  // Save offline workout data with validation
  async saveOfflineWorkoutData(data: OfflineWorkoutData): Promise<void> {
    try {
      // Create a validated copy of the data to ensure we never save corrupt data
      const validatedData: OfflineWorkoutData = {
        sessions: Array.isArray(data.sessions) ? data.sessions : [],
        exerciseHistory: []
      };
      
      // Validate each exercise history item
      if (Array.isArray(data.exerciseHistory)) {
        validatedData.exerciseHistory = data.exerciseHistory.map(history => {
          // Ensure we have a valid item
          if (!history || typeof history !== 'object') {
            return {
              session_id: '',
              exercise_id: '',
              sets_completed: 0,
              total_volume: 0,
              sets_data: []
            };
          }
          
          // Ensure required fields exist
          const validHistory = {
            ...history,
            session_id: history.session_id || '',
            exercise_id: history.exercise_id || '',
            sets_completed: 0,
            total_volume: 0,
            sets_data: [] as Array<{set: number; weight: number; reps: number}>
          };
          
          // Ensure sets_data is valid
          if (Array.isArray(history.sets_data)) {
            validHistory.sets_data = history.sets_data
              .filter(set => set && typeof set === 'object')
              .map(set => ({
                set: typeof set.set === 'number' ? set.set : 0,
                weight: typeof set.weight === 'number' ? set.weight : 0,
                reps: typeof set.reps === 'number' ? set.reps : 0
              }));
              
            // Recalculate total values
            validHistory.sets_completed = validHistory.sets_data.length;
            validHistory.total_volume = validHistory.sets_data.reduce(
              (sum, set) => sum + (set.weight * set.reps), 0
            );
          }
          
          return validHistory;
        });
      }
      
      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_WORKOUTS, JSON.stringify(validatedData));
    } catch (error) {
      logger.error('Error saving offline workout data:', error);
    }
  },

  // Clean offline workout data
  async cleanOfflineWorkoutData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_WORKOUTS);
    } catch (error) {
      logger.error('Error cleaning offline workout data:', error);
    }
  },

  // Clean stale offline data older than 7 days
  async cleanStaleOfflineData(): Promise<void> {
    try {
      const offlineData = await this.getOfflineWorkoutData();
      
      if (offlineData.sessions.length === 0 && offlineData.exerciseHistory.length === 0) {
        return;
      }
      
      // Calculate cutoff date (7 days ago)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      const cutoffTimestamp = cutoffDate.toISOString();
      
      // Filter out sessions older than 7 days
      const freshSessions = offlineData.sessions.filter(session => {
        return session.created_at && session.created_at > cutoffTimestamp;
      });
      
      // If no sessions were removed, return early
      if (freshSessions.length === offlineData.sessions.length) {
        return;
      }
      
      // Keep only exercise history associated with remaining sessions
      const validSessionIds = new Set(freshSessions.map(s => s.id));
      const freshExerciseHistory = offlineData.exerciseHistory.filter(history => {
        return validSessionIds.has(history.session_id);
      });
      
      // Save the filtered data
      await this.saveOfflineWorkoutData({
        sessions: freshSessions,
        exerciseHistory: freshExerciseHistory
      });
      
      logger.log(`Cleaned stale offline data: removed ${offlineData.sessions.length - freshSessions.length} sessions and ${offlineData.exerciseHistory.length - freshExerciseHistory.length} exercise records`);
    } catch (error) {
      logger.error('Error cleaning stale offline data:', error);
    }
  },

  // Start a workout session with offline support
  async startWorkout(activePlanId: string, userId: string): Promise<WorkoutSession | null> {
    try {
      // Verify authentication first
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        logger.error('Authentication error in startWorkout:', authError);
        throw new Error('Authentication required');
      }

      // Generate a UUID for the session
      let sessionId: string;
      try {
        sessionId = await Crypto.randomUUID();
      } catch (uuidError) {
        // Fallback if randomUUID fails
        sessionId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      }

      const workoutSession: WorkoutSession = {
        id: sessionId,
        user_id: userId,
        active_plan_id: activePlanId,
        start_time: new Date().toISOString(),
        status: 'in_progress',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      logger.log('Creating workout session:', workoutSession);

      // Try to create the session
      const { data: createdSession, error: insertError } = await supabase
        .from('workout_sessions')
        .insert([workoutSession])
        .select()
        .single();

      if (insertError) {
        logger.error('Error creating workout session:', insertError);
        
        // Save to offline storage
        const offlineData = await this.getOfflineWorkoutData();
        offlineData.sessions.push(workoutSession);
        await this.saveOfflineWorkoutData(offlineData);
        
        // Also save in session-specific key
        const sessionKey = `offline_workout_session_${sessionId}`;
        await AsyncStorage.setItem(sessionKey, JSON.stringify(workoutSession));
        
        logger.log(`Saved workout session offline with ID: ${sessionId}`);
        return workoutSession;
      }

      // Verify the session was created
      const { data: verifySession, error: verifyError } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (verifyError || !verifySession) {
        logger.error('Error verifying session creation:', verifyError);
        throw new Error('Failed to verify session creation');
      }

      logger.log('Successfully created and verified session:', verifySession);
      return verifySession;
    } catch (error) {
      logger.error('Error in startWorkout:', error);
      throw error;
    }
  },

  // Update the logExerciseSet function signature
  async logExerciseSet(sessionId: string, exerciseId: string, setNumber: number, setData: { weight: number; reps: number }): Promise<void> {
    try {
      // Verify authentication first
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        logger.error('Authentication error in logExerciseSet:', authError);
        await this.logExerciseSetOffline(sessionId, exerciseId, setNumber, setData);
        return;
      }

      const userId = session.user.id;

      // Verify the session exists and belongs to the current user
      const { data: sessionData, error: sessionError } = await supabase
        .from('workout_sessions')
        .select('id, user_id')
        .eq('id', sessionId)
        .single();

      if (sessionError || !sessionData) {
        logger.error('Session not found or error:', sessionError);
        await this.logExerciseSetOffline(sessionId, exerciseId, setNumber, setData);
        return;
      }

      if (sessionData.user_id !== session.user.id) {
        logger.error('Session belongs to different user');
        throw new Error('Unauthorized');
      }

      // Check network status
      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected || !networkState.isInternetReachable) {
        logger.log('Offline detected, saving exercise set locally');
        await this.logExerciseSetOffline(sessionId, exerciseId, setNumber, setData);
        return;
      }

      // Try to update online
      // First check if record exists for this session + exercise
      const { data: existingRecord, error: queryError } = await supabase
        .from('workout_exercise_history')
        .select('id, sets_data')
        .eq('session_id', sessionId)
        .eq('exercise_id', exerciseId)
        .single();

      // Define the new set data
      const newSetData = {
        set: setNumber,
        weight: setData.weight,
        reps: setData.reps
      };

      if (!queryError && existingRecord) {
        // Record exists - update it with the new set
        let existingSetsData = existingRecord.sets_data || [];
        if (!Array.isArray(existingSetsData)) {
          existingSetsData = [];
        }

        // Find if this set already exists in the array
        const setIndex = existingSetsData.findIndex((s: any) => s.set === setNumber);
        if (setIndex >= 0) {
          // Update existing set
          existingSetsData[setIndex] = newSetData;
        } else {
          // Add new set
          existingSetsData.push(newSetData);
        }

        // Calculate total volume
        const totalVolume = existingSetsData.reduce(
          (sum: number, set: any) => sum + (set.weight * set.reps), 0
        );

        // Update record
        const { error: updateError } = await supabase
          .from('workout_exercise_history')
          .update({
            sets_completed: existingSetsData.length,
            total_volume: totalVolume,
            sets_data: existingSetsData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRecord.id);

        if (updateError) {
          logger.error('Error updating exercise history:', updateError);
          await this.logExerciseSetOffline(sessionId, exerciseId, setNumber, setData);
          return;
        }
      } else {
        // Record doesn't exist - create a new one
        const newRecord = {
          id: await Crypto.randomUUID(),
          session_id: sessionId,
          exercise_id: exerciseId,
          sets_completed: 1,
          total_volume: setData.weight * setData.reps,
          sets_data: [newSetData],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('workout_exercise_history')
          .insert([newRecord]);

        if (insertError) {
          logger.error('Error inserting exercise history:', insertError);
          await this.logExerciseSetOffline(sessionId, exerciseId, setNumber, setData);
          return;
        }
      }

      // Now also save to user_exercises_history for long-term tracking
      try {
        await this.logUserExerciseHistory(
          userId,
          exerciseId,
          sessionId,
          setNumber,
          setData.weight,
          setData.reps
        );
        
        // Also directly update personal records
        await this.checkAndUpdatePersonalRecord(
          userId,
          exerciseId,
          setData.weight,
          setData.reps
        );
        
        logger.debug('Successfully saved exercise data to history and personal records');
      } catch (historyError) {
        logger.error('Error saving to user_exercises_history:', historyError);
        // Continue execution, this is not critical for workout logging
      }

    } catch (error) {
      logger.error('Error in logExerciseSet:', error);
      // Save for offline sync
      await this.logExerciseSetOffline(sessionId, exerciseId, setNumber, setData);
    }
  },
  
  // Separate function for offline logging to reduce code duplication
  async logExerciseSetOffline(
    sessionId: string, 
    exerciseId: string, 
    setNumber: number, 
    setData: { weight: number; reps: number }
  ): Promise<void> {
    try {
      // Get the current offline queue for this specific session
      const queueKey = `offline_exercise_sets_${sessionId}`;
      const queueString = await AsyncStorage.getItem(queueKey) || '[]';
      const queue = JSON.parse(queueString);
      
      // Add new set to queue
      queue.push({
        session_id: sessionId,
        exercise_id: exerciseId,
        set_number: setNumber,
        weight: setData.weight,
        reps: setData.reps,
        timestamp: new Date().toISOString()
      });
      
      // Save updated queue
      await AsyncStorage.setItem(queueKey, JSON.stringify(queue));
      logger.log(`Saved exercise set to offline queue for session ${sessionId} (${queue.length} items queued)`);
    } catch (error) {
      logger.error('Error saving exercise set offline:', error);
    }
  },

  // Update the getWorkoutExerciseHistory function
  async getWorkoutExerciseHistory(sessionId: string): Promise<ExerciseHistory[]> {
    try {
      const { data, error } = await supabase
        .from('workout_exercise_history')
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
        .order('created_at', { ascending: true });
        
      if (error) {
        logger.error('Error fetching workout exercise history:', error);
        return [];
      }
      
      return data as ExerciseHistory[];
    } catch (error) {
      logger.error('Error in getWorkoutExerciseHistory:', error);
      return [];
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
        logger.error('Error fetching workout history:', error);
        return [];
      }
      
      return data as WorkoutSession[];
    } catch (error) {
      logger.error('Error in getWorkoutHistory:', error);
      return [];
    }
  },

  // Helper function to queue offline set data
  async queueOfflineSet(
    sessionId: string, 
    exerciseId: string, 
    setNumber: number, 
    data: { weight: number; reps: number }
  ): Promise<void> {
    try {
      // Get current offline queue
      const queueString = await AsyncStorage.getItem('offline_exercise_sets') || '[]';
      const queue = JSON.parse(queueString);
      
      // Add new set to queue
      queue.push({
        session_id: sessionId,
        exercise_id: exerciseId,
        set_number: setNumber,
        weight: data.weight,
        reps: data.reps,
        timestamp: new Date().toISOString()
      });
      
      // Save updated queue
      await AsyncStorage.setItem('offline_exercise_sets', JSON.stringify(queue));
      logger.log('Exercise set queued for offline sync');
    } catch (error) {
      logger.error('Error queueing offline exercise set:', error);
    }
  },

  // Add this function if it doesn't exist
  async syncOfflineSets(): Promise<boolean> {
    try {
      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        logger.error('Error getting user for syncing offline sets:', userError);
        return false;
      }
      
      const userId = userData.user?.id;
      if (!userId) {
        logger.error('No user ID available for syncing offline sets');
        return false;
      }
      
      // Get offline queue
      const queueString = await AsyncStorage.getItem('offline_exercise_sets') || '[]';
      const queue = JSON.parse(queueString);
      
      if (queue.length === 0) {
        return true; // Nothing to sync
      }
      
      // Process each queued set
      const failedItems = [];
      for (const item of queue) {
        try {
          const { error } = await supabase.from('workout_exercise_history').insert({
            user_id: userId,
            session_id: item.session_id,
            exercise_id: item.exercise_id,
            set_number: item.set_number,
            weight: item.weight,
            reps: item.reps,
            created_at: item.timestamp
          });
          
          if (error) {
            logger.error(`Error syncing exercise history for ${item.exercise_id}: ${error.message}`, error);
            failedItems.push(item);
          }
        } catch (error) {
          logger.error('Error processing offline set:', error);
          failedItems.push(item);
        }
      }
      
      // Update queue with only failed items
      if (failedItems.length > 0) {
        await AsyncStorage.setItem('offline_exercise_sets', JSON.stringify(failedItems));
        return false; // Sync partially failed
      } else {
        await AsyncStorage.removeItem('offline_exercise_sets');
        return true; // Sync successful
      }
    } catch (error) {
      logger.error('Error syncing offline exercise sets:', error);
      return false;
    }
  },

  async syncOfflineExerciseData(): Promise<boolean> {
    try {
      // Get all AsyncStorage keys first to check if we have any data to sync
      const keys = await AsyncStorage.getAllKeys();
      const offlineSessionKeys = keys.filter(key => key.startsWith('offline_workout_session_'));
      const offlineQueueKeys = keys.filter(key => key.startsWith('offline_exercise_sets_'));
      
      // If there's no offline data, return early
      if (offlineSessionKeys.length === 0 && offlineQueueKeys.length === 0) {
        logger.log('No offline data to sync');
        return true;
      }

      // Verify authentication first
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        logger.error('Authentication error in syncOfflineExerciseData:', authError);
        return false;
      }
      
      // Get current user ID
      const userId = session.user.id;
      if (!userId) {
        logger.error('Cannot sync offline data without a user ID');
        return false;
      }
      
      logger.log(`Starting sync for user ${userId} with ${offlineSessionKeys.length} sessions and ${offlineQueueKeys.length} exercise queues`);
      
      // Create a map to store session creation status
      const sessionCreationStatus = new Map<string, boolean>();
      
      // First, process all sessions
      for (const sessionKey of offlineSessionKeys) {
        const sessionString = await AsyncStorage.getItem(sessionKey);
        if (!sessionString) {
          logger.log(`No data found for session key ${sessionKey}`);
          continue;
        }
        
        try {
          const sessionObj = JSON.parse(sessionString);
          if (!sessionObj || !sessionObj.id) {
            logger.log(`Invalid session data for key ${sessionKey}`);
            continue;
          }

          // Ensure required session fields are present
          const sessionToCreate = {
            id: sessionObj.id,
            user_id: userId,
            active_plan_id: sessionObj.active_plan_id || null,
            start_time: sessionObj.start_time || new Date().toISOString(),
            end_time: sessionObj.end_time || null,
            total_duration: sessionObj.total_duration || 0,
            calories_burned: sessionObj.calories_burned || 0,
            status: sessionObj.status || 'in_progress',
            notes: sessionObj.notes || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          // Check if session already exists
          const { data: existingSession, error: checkError } = await supabase
            .from('workout_sessions')
            .select('id, user_id')
            .eq('id', sessionToCreate.id)
            .single();
            
          if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" error
            logger.error(`Error checking session ${sessionToCreate.id}:`, checkError);
            sessionCreationStatus.set(sessionToCreate.id, false);
            continue;
          }
            
          if (!existingSession) {
            // Session doesn't exist, create it
            logger.log(`Creating session ${sessionToCreate.id}...`);
            const { error: insertError } = await supabase
              .from('workout_sessions')
              .insert(sessionToCreate);
              
            if (insertError) {
              logger.error(`Failed to create session ${sessionToCreate.id}:`, insertError);
              sessionCreationStatus.set(sessionToCreate.id, false);
              continue; // Skip to next session if creation fails
            }
            
            // Verify the session was created
            const { data: verifySession, error: verifyError } = await supabase
              .from('workout_sessions')
              .select('id, user_id')
              .eq('id', sessionToCreate.id)
              .single();
              
            if (verifyError || !verifySession) {
              logger.error(`Failed to verify session ${sessionToCreate.id}:`, verifyError);
              sessionCreationStatus.set(sessionToCreate.id, false);
              continue;
            }
            
            logger.log(`Successfully created and verified session ${sessionToCreate.id}`);
            sessionCreationStatus.set(sessionToCreate.id, true);
          } else {
            // Session exists, verify ownership
            if (existingSession.user_id !== userId) {
              logger.error(`Session ${sessionToCreate.id} belongs to different user`);
              sessionCreationStatus.set(sessionToCreate.id, false);
              continue;
            }
            logger.log(`Session ${sessionToCreate.id} already exists and belongs to current user`);
            sessionCreationStatus.set(sessionToCreate.id, true);
          }
        } catch (e) {
          logger.error('Error processing offline session:', e);
          if (e instanceof Error) {
            logger.error('Error details:', e.message);
          }
        }
      }
      
      // Give a small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Now process exercise data
      let allSuccess = true;
      
      // Process each queue
      for (const queueKey of offlineQueueKeys) {
        const queueString = await AsyncStorage.getItem(queueKey) || '[]';
        let queue = JSON.parse(queueString);
        
        if (queue.length === 0) {
          await AsyncStorage.removeItem(queueKey);
          continue;
        }
        
        // Extract the session ID from the key
        const sessionId = queueKey.replace('offline_exercise_sets_', '');
        logger.log(`Processing queue for session ${sessionId} with ${queue.length} items`);

        // Skip if session creation failed or status unknown
        if (!sessionCreationStatus.get(sessionId)) {
          logger.log(`Skipping exercise data for session ${sessionId} - session not verified`);
          continue;
        }

        // Double check session exists and belongs to user
        const { data: sessionData, error: sessionError } = await supabase
          .from('workout_sessions')
          .select('id, user_id')
          .eq('id', sessionId)
          .single();

        if (sessionError || !sessionData) {
          logger.error(`Session ${sessionId} not found or error:`, sessionError);
          continue;
        }

        if (sessionData.user_id !== userId) {
          logger.error(`Session ${sessionId} belongs to different user, removing queue`);
          await AsyncStorage.removeItem(queueKey);
          continue;
        }

        // Group items by exercise_id
        const exerciseGroups: {[key: string]: any[]} = {};
        for (const item of queue) {
          if (!exerciseGroups[item.exercise_id]) {
            exerciseGroups[item.exercise_id] = [];
          }
          exerciseGroups[item.exercise_id].push(item);
        }

        const failedItems = [];
        
        // Process each exercise group
        for (const [exerciseId, items] of Object.entries(exerciseGroups)) {
          try {
            logger.log(`Processing ${items.length} sets for exercise ${exerciseId}`);
            
            // Format data according to the expected table structure
            const sets_data = items.map(item => ({
              set: item.set_number,
              weight: item.weight,
              reps: item.reps
            }));

            // Calculate total volume
            const total_volume = sets_data.reduce(
              (sum, set) => sum + (set.weight * set.reps), 0
            );

            // Generate a new UUID for the record
            const historyId = await Crypto.randomUUID();

            // Create the exercise history record
            const historyRecord = {
              id: historyId,
              session_id: sessionId,
              exercise_id: exerciseId,
              sets_completed: sets_data.length,
              total_volume: total_volume,
              sets_data: sets_data,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            // Try to insert new record
            const { error: insertError } = await supabase
              .from('workout_exercise_history')
              .insert(historyRecord);

            if (insertError) {
              logger.error(`Error inserting exercise history: ${JSON.stringify(insertError)}`);
              logger.error('Failed record:', JSON.stringify(historyRecord));
              failedItems.push(...items);
              allSuccess = false;
            } else {
              logger.log(`Successfully inserted exercise history for ${exerciseId}`);
            }
          } catch (error) {
            logger.error(`Error processing exercise ${exerciseId}:`, error);
            failedItems.push(...items);
            allSuccess = false;
          }
        }
        
        // Update queue with failed items or remove it
        if (failedItems.length > 0) {
          await AsyncStorage.setItem(queueKey, JSON.stringify(failedItems));
        } else {
          await AsyncStorage.removeItem(queueKey);
        }
      }
      
      // Clean up offline session data if everything synced
      if (allSuccess) {
        for (const sessionKey of offlineSessionKeys) {
          await AsyncStorage.removeItem(sessionKey);
        }
      }
      
      return allSuccess;
    } catch (error) {
      logger.error('Error syncing offline exercise data:', error);
      if (error instanceof Error) {
        logger.error('Error details:', error.message);
      }
      return false;
    }
  },

  // Sync offline data with server - with improved error handling and validation
  async syncOfflineData(): Promise<void> {
    try {
      const offlineData = await this.getOfflineWorkoutData();
      
      if (offlineData.sessions.length === 0 && offlineData.exerciseHistory.length === 0) {
        logger.log('No offline data to sync');
        return;
      }

      logger.log(`Syncing offline data: ${offlineData.sessions.length} sessions, ${offlineData.exerciseHistory.length} exercise records`);
      
      let syncedSessions = 0;
      let syncedExercises = 0;
      let failedSessions = 0;
      let failedExercises = 0;
      
      // Keep track of successfully synced session IDs
      const syncedSessionIds = new Set<string>();
      
      // Sync sessions first
      for (const session of offlineData.sessions) {
        try {
          // Verify that the session has all required fields before attempting to sync
          if (!session.id || !session.user_id || !session.start_time) {
            logger.error(`Skipping invalid session: ${session.id}`);
            failedSessions++;
            continue;
          }
          
          // First check if session already exists to prevent duplicate sync attempts
          const { data: existingSession, error: checkError } = await supabase
            .from('workout_sessions')
            .select('id')
            .eq('id', session.id)
            .single();
            
          if (!checkError && existingSession) {
            // Session already exists, mark as synced
            syncedSessionIds.add(session.id);
            syncedSessions++;
            logger.log(`Session ${session.id} already exists, skipping`);
            continue;
          }
          
          // Verify current authenticated user matches session user_id
          const { data: { session: authSession }, error: authError } = await supabase.auth.getSession();
          if (authError || !authSession) {
            logger.error(`Authentication error for session ${session.id}:`, authError);
            failedSessions++;
            continue;
          }
          
          if (authSession.user.id !== session.user_id) {
            logger.error(`Session ${session.id} belongs to different user, skipping`);
            failedSessions++;
            continue;
          }
          
          // Proceed with upsert
          const { error } = await supabase
            .from('workout_sessions')
            .upsert([session]);

          if (error) {
            logger.error(`Error syncing session ${session.id}:`, error);
            failedSessions++;
          } else {
            syncedSessionIds.add(session.id);
            syncedSessions++;
            logger.log(`Successfully synced session ${session.id}`);
          }
        } catch (sessionError) {
          logger.error(`Exception syncing session ${session.id}:`, sessionError);
          failedSessions++;
        }
      }

      // Only sync exercise history for sessions that were successfully synced
      for (const history of offlineData.exerciseHistory) {
        try {
          // Skip if session_id is missing or if the session wasn't successfully synced
          if (!history.session_id || !syncedSessionIds.has(history.session_id)) {
            logger.log(`Skipping exercise history for non-synced session: ${history.session_id}`);
            failedExercises++;
            continue;
          }
          
          // Skip if exercise_id is missing
          if (!history.exercise_id) {
            logger.log('Skipping exercise history with missing exercise_id');
            failedExercises++;
            continue;
          }
          
          // Validate and ensure each exercise history has a valid sets_data array
          if (!history.sets_data || !Array.isArray(history.sets_data)) {
            logger.log(`Fixing invalid sets_data for exercise ${history.exercise_id}`);
            history.sets_data = [];
          }
          
          // Ensure each item in sets_data is a valid object with required properties
          history.sets_data = history.sets_data.filter(item => {
            if (!item || typeof item !== 'object') {
              logger.log('Removing invalid set data item');
              return false;
            }
            return true;
          });
          
          // Fix any null or undefined values in each set
          history.sets_data = history.sets_data.map(item => ({
            set: typeof item.set === 'number' ? item.set : 0,
            weight: typeof item.weight === 'number' ? item.weight : 0,
            reps: typeof item.reps === 'number' ? item.reps : 0
          }));
          
          // Recalculate sets_completed and total_volume to ensure consistency
          history.sets_completed = history.sets_data.length;
          history.total_volume = history.sets_data.reduce(
            (sum, set) => sum + (set.weight * set.reps), 
            0
          );
          
          // If history data is empty, skip syncing
          if (history.sets_data.length === 0) {
            logger.log(`Skipping empty exercise history for ${history.exercise_id}`);
            syncedExercises++; // Count as synced since we're intentionally skipping
            continue;
          }
          
          const { error } = await supabase
            .from('workout_exercise_history')
            .upsert([history]);

          if (error) {
            logger.error(`Error syncing exercise history for ${history.exercise_id}:`, error);
            failedExercises++;
          } else {
            syncedExercises++;
          }
        } catch (historyError) {
          logger.error(`Exception syncing exercise history for ${history.exercise_id}:`, historyError);
          failedExercises++;
        }
      }

      // Log sync results
      logger.log(`Sync results: ${syncedSessions}/${offlineData.sessions.length} sessions synced, ${syncedExercises}/${offlineData.exerciseHistory.length} exercise records synced`);
      
      // If all items synced successfully or failed permanently, clear the cache
      // Otherwise, keep failed items for retry
      if (failedSessions === 0 && failedExercises === 0) {
        // All synced successfully, clear all cached data
        await this.saveOfflineWorkoutData({ sessions: [], exerciseHistory: [] });
        logger.log('All data synced successfully. Offline cache cleared.');
      } else if (syncedSessions > 0 || syncedExercises > 0) {
        // Some items synced, keep only the failed ones and remove exercises with invalid session ids
        const remainingSessions = offlineData.sessions.filter((_, index) => index >= syncedSessions);
        
        // Only keep exercise history records that have valid session IDs in the remaining sessions
        const validSessionIds = new Set(remainingSessions.map(s => s.id));
        const remainingExercises = offlineData.exerciseHistory
          .filter((_, index) => index >= syncedExercises)
          .filter(history => validSessionIds.has(history.session_id));
        
        await this.saveOfflineWorkoutData({ 
          sessions: remainingSessions, 
          exerciseHistory: remainingExercises 
        });
        logger.log(`Partial sync completed. Keeping ${remainingSessions.length} sessions and ${remainingExercises.length} exercise records for retry.`);
      }
      
      // Perform a cleanup of any stale data (older than 7 days)
      await this.cleanStaleOfflineData();
    } catch (error) {
      logger.error('Error syncing offline data:', error);
      // Don't throw the error - just log it
    }
  },

  // Add new method for saving to user_exercises_history
  async logUserExerciseHistory(
    userId: string,
    exerciseId: string,
    sessionId: string,
    setNumber: number,
    weight: number,
    reps: number,
    notes?: string
  ): Promise<boolean> {
    try {
      logger.debug('Logging user exercise history', () => ({
        userId,
        exerciseId,
        sessionId,
        setNumber,
        weight,
        reps
      }));

      // Check if this entry already exists
      const { data: existingEntry, error: queryError } = await supabase
        .from('user_exercises_history')
        .select('id')
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId)
        .eq('session_id', sessionId)
        .eq('set_number', setNumber)
        .maybeSingle();

      const now = new Date().toISOString();
      
      // Wrap database operations in a try-catch to handle specific database errors
      try {
        if (existingEntry) {
          // Update existing entry
          const { error: updateError } = await supabase
            .from('user_exercises_history')
            .update({
              weight,
              reps,
              notes,
              updated_at: now
            })
            .eq('id', existingEntry.id);
            
            if (updateError) {
              // Check for stack depth limit error
              if (updateError.message && updateError.message.includes('stack depth limit exceeded')) {
                logger.warn('Database stack depth limit exceeded - this may indicate complex database triggers');
                // Return true to prevent further error propagation
                return true;
              }
              
              logger.error('Error updating user exercise history:', updateError);
              return false;
            }
        } else {
          // Insert new entry - the personal_record flag will be set by the database trigger
          const { error: insertError } = await supabase
            .from('user_exercises_history')
            .insert([{
              user_id: userId,
              exercise_id: exerciseId,
              session_id: sessionId,
              weight,
              reps,
              set_number: setNumber,
              completed_at: now,
              notes,
              created_at: now,
              updated_at: now
            }]);
            
            if (insertError) {
              // Check for stack depth limit error
              if (insertError.message && insertError.message.includes('stack depth limit exceeded')) {
                logger.warn('Database stack depth limit exceeded - this may indicate complex database triggers');
                // Return true to prevent further error propagation
                return true;
              }
              
              logger.error('Error inserting user exercise history:', insertError);
              return false;
            }
        }
      } catch (dbError: any) {
        // Specifically handle database stack depth errors
        if (dbError.message && dbError.message.includes('stack depth limit exceeded')) {
          logger.warn('Database stack depth limit exceeded when saving exercise history');
          // Return true to prevent further error propagation
          return true;
        }
        throw dbError; // re-throw any other error for the outer catch block
      }

      // Check and update personal records - wrap in try-catch to handle errors independently
      try {
        await this.checkAndUpdatePersonalRecord(userId, exerciseId, weight, reps);
      } catch (prError: any) {
        // Log but don't fail if personal record update fails
        logger.error('Error updating personal records:', prError);
      }
      
      return true;
    } catch (error) {
      logger.error('Error in logUserExerciseHistory:', error);
      return false;
    }
  },

  // Add method for checking and updating personal records
  async checkAndUpdatePersonalRecord(
    userId: string,
    exerciseId: string,
    weight: number,
    reps: number
  ): Promise<void> {
    try {
      // First, check if this is actually a personal record
      const { data: existingRecords, error: queryError } = await supabase
        .from('personal_records')
        .select('*')
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId)
        .eq('reps', reps)
        .order('weight', { ascending: false })
        .maybeSingle();

      const now = new Date();
      const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // If no record exists or new weight is greater, update the personal record
      if (!existingRecords || (existingRecords && weight > existingRecords.weight)) {
        try {
          if (existingRecords) {
            // Update existing record
            const { error: updateError } = await supabase
              .from('personal_records')
              .update({
                weight,
                date: today,
                updated_at: now.toISOString()
              })
              .eq('id', existingRecords.id);
              
            if (updateError) {
              // Check for stack depth limit error
              if (updateError.message && updateError.message.includes('stack depth limit exceeded')) {
                logger.warn('Database stack depth limit exceeded when updating personal record');
                return;
              }
              
              logger.error('Error updating personal record:', updateError);
            } else {
              logger.debug('Updated personal record', () => ({
                exerciseId,
                reps,
                previousWeight: existingRecords.weight,
                newWeight: weight
              }));
            }
          } else {
            // Insert new record
            const { error: insertError } = await supabase
              .from('personal_records')
              .insert([{
                user_id: userId,
                exercise_id: exerciseId,
                weight,
                reps,
                date: today,
                created_at: now.toISOString(),
                updated_at: now.toISOString()
              }]);
              
            if (insertError) {
              // Check for stack depth limit error
              if (insertError.message && insertError.message.includes('stack depth limit exceeded')) {
                logger.warn('Database stack depth limit exceeded when inserting personal record');
                return;
              }
              
              logger.error('Error inserting personal record:', insertError);
            } else {
              logger.debug('Created new personal record', () => ({
                exerciseId,
                reps,
                weight
              }));
            }
          }
        } catch (dbError: any) {
          // Specifically handle database stack depth errors
          if (dbError.message && dbError.message.includes('stack depth limit exceeded')) {
            logger.warn('Database stack depth limit exceeded in personal records operation');
            return;
          }
          throw dbError; // re-throw other errors
        }
      }
    } catch (error) {
      logger.error('Error checking/updating personal record:', error);
    }
  },

  // Add method to get user exercise history
  async getUserExerciseHistory(
    userId: string,
    exerciseId: string,
    limit: number = 10
  ): Promise<UserExerciseHistory[]> {
    try {
      const { data, error } = await supabase
        .from('user_exercises_history')
        .select('*')
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId)
        .order('completed_at', { ascending: false })
        .limit(limit);
        
      if (error) {
        logger.error('Error fetching user exercise history:', error);
        return [];
      }
      
      return data as UserExerciseHistory[];
    } catch (error) {
      logger.error('Error in getUserExerciseHistory:', error);
      return [];
    }
  },

  // Add method to get personal records for a user
  async getUserPersonalRecords(
    userId: string,
    exerciseId?: string
  ): Promise<PersonalRecord[]> {
    try {
      let query = supabase
        .from('personal_records')
        .select(`
          *,
          exercises(name, muscle_group, image_url)
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
        
      // If exercise ID is provided, filter by it
      if (exerciseId) {
        query = query.eq('exercise_id', exerciseId);
      }
      
      const { data, error } = await query;
        
      if (error) {
        logger.error('Error fetching personal records:', error);
        return [];
      }
      
      return data as PersonalRecord[];
    } catch (error) {
      logger.error('Error in getUserPersonalRecords:', error);
      return [];
    }
  },

  // Add method to get max weight lifted for an exercise
  async getMaxWeightLifted(
    userId: string,
    exerciseId: string
  ): Promise<{ weight: number; reps: number; date: string } | null> {
    try {
      const { data, error } = await supabase
        .from('personal_records')
        .select('weight, reps, date')
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId)
        .order('weight', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (error) {
        logger.error('Error fetching max weight lifted:', error);
        return null;
      }
      
      // Return null if no data found
      if (!data) {
        logger.debug(`No personal records found for exercise ${exerciseId}`);
        return null;
      }
      
      return {
        weight: data.weight,
        reps: data.reps,
        date: data.date
      };
    } catch (error) {
      logger.error('Error in getMaxWeightLifted:', error);
      return null;
    }
  },
};

export default workoutPlanService; 