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



// Update the interface for offline workout data
interface OfflineWorkoutData {
  sessions: WorkoutSession[];
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
        return { sessions: [] };
      }
      
      let parsedData: OfflineWorkoutData;
      
      try {
        parsedData = JSON.parse(data);
      } catch (parseError) {
        logger.error('Error parsing offline workout data:', parseError);
        // If JSON is corrupted, return empty data
        return { sessions: [] };
      }
      
      // Ensure the structure is valid
      if (!parsedData || typeof parsedData !== 'object') {
        return { sessions: [] };
      }
      
      // Ensure sessions array exists and is valid
      if (!Array.isArray(parsedData.sessions)) {
        parsedData.sessions = [];
      }
      
      return parsedData;
    } catch (error) {
      logger.error('Error getting offline workout data:', error);
      // Return empty data on any error
      return { sessions: [] };
    }
  },

  // Save offline workout data with validation
  async saveOfflineWorkoutData(data: OfflineWorkoutData): Promise<void> {
    try {
      // Create a validated copy of the data to ensure we never save corrupt data
      const validatedData: OfflineWorkoutData = {
        sessions: Array.isArray(data.sessions) ? data.sessions : []
      };
      
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
      
      if (offlineData.sessions.length === 0) {
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
      
      // Save the filtered data
      await this.saveOfflineWorkoutData({
        sessions: freshSessions
      });
      
      logger.log(`Cleaned stale offline data: removed ${offlineData.sessions.length - freshSessions.length} sessions`);
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

  // Updated logExerciseSet function to avoid stack depth issues
  async logExerciseSet(sessionId: string, exerciseId: string, setNumber: number, setData: { weight: number; reps: number }): Promise<void> {
    try {
      // Get current user session
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        logger.error('Authentication error in logExerciseSet:', authError);
        await this.logExerciseSetOffline(sessionId, exerciseId, setNumber, setData);
        return;
      }
      
      const userId = session.user.id;
      const now = new Date().toISOString();

      // Check if we're online
      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected || !networkState.isInternetReachable) {
        logger.debug('Device is offline, saving set data for later sync');
        await this.logExerciseSetOffline(sessionId, exerciseId, setNumber, setData);
        return;
      }
      
      // OPERATION: Handle user_exercises_history table
      try {
        // Get exercise name
        const { data: exerciseData } = await supabase
          .from('exercises')
          .select('name')
          .eq('id', exerciseId)
          .single();

        const exerciseName = exerciseData?.name || 'Unknown Exercise';
        
        // Check if record already exists
        const { data: existingUserHistory, error: userHistoryError } = await supabase
          .from('user_exercises_history')
          .select('id')
          .eq('user_id', userId)
          .eq('exercise_id', exerciseId)
          .eq('session_id', sessionId)
          .eq('set_number', setNumber)
          .single();
          
        if (!userHistoryError && existingUserHistory) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('user_exercises_history')
            .update({
              weight: setData.weight,
              reps: setData.reps,
              updated_at: now
            })
            .eq('id', existingUserHistory.id);
            
          if (updateError) {
            logger.error('Error updating user_exercises_history:', updateError);
          } else {
            logger.debug(`Updated user exercise history for set ${setNumber}`);
          }
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from('user_exercises_history')
            .insert([{
              user_id: userId,
              exercise_id: exerciseId,
              exercise_name: exerciseName,
              session_id: sessionId,
              set_number: setNumber,
              weight: setData.weight,
              reps: setData.reps,
              completed_at: now,
              personal_record: false, // Will be updated separately
              created_at: now,
              updated_at: now
            }]);
            
          if (insertError) {
            logger.error('Error inserting user_exercises_history:', insertError);
          } else {
            logger.debug(`Created user exercise history for set ${setNumber}`);
          }
        }
      } catch (error) {
        logger.error('Error handling user_exercises_history:', error);
        // Continue with other operations even if this one fails
      }
      
      // OPERATION: Handle personal records
      try {
        await this.checkAndUpdatePersonalRecord(
          userId,
          exerciseId,
          setData.weight,
          setData.reps
        );
      } catch (prError) {
        logger.error('Error updating personal records:', prError);
        // Don't let PR errors stop the show
      }
    } catch (error) {
      logger.error('Error in logExerciseSet:', error);
      // Save for offline sync as a fallback
      await this.logExerciseSetOffline(sessionId, exerciseId, setNumber, setData);
    }
  },
  
  // Separate function for offline logging to user exercise history
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
          const { error } = await supabase.from('user_exercises_history').insert({
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

  // Fixed syncOfflineExerciseData function
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

            // Check if we already have a record for this exercise in this session
            const { data: existing, error: checkError } = await supabase
              .from('user_exercises_history')
              .select('id')
              .eq('session_id', sessionId)
              .eq('exercise_id', exerciseId)
              .single();

            if (!checkError && existing) {
              // We have an existing record - update it with all sets
              logger.log(`Updating existing record for exercise ${exerciseId}`);

              // Create an array of all sets
              const sets_data = items.map(item => ({
                set: item.set_number,
                weight: item.weight,
                reps: item.reps
              }));

              // Merge with existing sets, avoiding duplicates
              const existingSets = Array.isArray(existing.sets_data) ? existing.sets_data : [];
              const setIds = new Set(sets_data.map((s: any) => s.set));
              const filteredExistingSets = existingSets.filter((s: any) => !setIds.has(s.set));
              const mergedSets = [...filteredExistingSets, ...sets_data];

              // Calculate total volume
              const totalVolume = mergedSets.reduce(
                (sum: number, set: any) => sum + (set.weight * set.reps), 0
              );

              // Update the record
              const { error: updateError } = await supabase
                .from('user_exercises_history')
                .update({
                  updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);

              if (updateError) {
                logger.error(`Error updating exercise history: ${JSON.stringify(updateError)}`);
                failedItems.push(...items);
                allSuccess = false;
              } else {
                logger.log(`Successfully updated exercise history for ${exerciseId}`);

                // Update personal records for each set
                for (const item of items) {
                  try {
                    // Also sync to user_exercises_history table
                    await this.syncSetToUserExercisesHistory(
                      userId,
                      exerciseId,
                      sessionId,
                      item.set_number,
                      item.weight,
                      item.reps
                    );
                    
                    await this.checkAndUpdatePersonalRecord(
                      userId,
                      exerciseId,
                      item.weight,
                      item.reps
                    );
                  } catch (prError) {
                    logger.error(`Error updating personal record: ${prError}`);
                    // Don't fail the sync because of PR updates
                  }
                }
              }
            } else {
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
                .from('user_exercises_history')
                .insert({
                  user_id: userId,
                  exercise_id: exerciseId,
                  session_id: sessionId,
                  set_number: 1, // Default set number
                  weight: 0,     // Default weight
                  reps: 0,       // Default reps
                  completed_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
              if (insertError) {
                logger.error(`Error inserting exercise history: ${JSON.stringify(insertError)}`);
                                  logger.error('Failed to insert user exercise history');
                failedItems.push(...items);
                allSuccess = false;
              } else {
                logger.log(`Successfully inserted exercise history for ${exerciseId}`);

                // Update personal records for each set
                for (const item of items) {
                  try {
                    // Also sync to user_exercises_history table
                    await this.syncSetToUserExercisesHistory(
                      userId,
                      exerciseId,
                      sessionId,
                      item.set_number,
                      item.weight,
                      item.reps
                    );
                    
                    await this.checkAndUpdatePersonalRecord(
                      userId,
                      exerciseId,
                      item.weight,
                      item.reps
                    );
                  } catch (prError) {
                    logger.error(`Error updating personal record: ${prError}`);
                    // Don't fail the sync because of PR updates
                  }
                }
              }
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

  // Sync offline data with server with fixed return type
  async syncOfflineData(): Promise<boolean> {
    try {
      const offlineData = await this.getOfflineWorkoutData();
      
      if (offlineData.sessions.length === 0) {
        logger.log('No offline data to sync');
        return true;
      }

      logger.log(`Syncing offline data: ${offlineData.sessions.length} sessions`);
      
      let syncedSessions = 0;
      let failedSessions = 0;
      
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

      // Log sync results
      logger.log(`Sync results: ${syncedSessions}/${offlineData.sessions.length} sessions synced`);
      
      // If all items synced successfully or failed permanently, clear the cache
      // Otherwise, keep failed items for retry
      if (failedSessions === 0) {
        // All synced successfully, clear all cached data
        await this.saveOfflineWorkoutData({ sessions: [] });
        logger.log('All data synced successfully. Offline cache cleared.');
      } else if (syncedSessions > 0) {
        // Some items synced, keep only the failed ones
        const remainingSessions = offlineData.sessions.filter((_, index) => index >= syncedSessions);
        
        await this.saveOfflineWorkoutData({ 
          sessions: remainingSessions
        });
        logger.log(`Partial sync completed. Keeping ${remainingSessions.length} sessions for retry.`);
      }
      
      // Perform a cleanup of any stale data (older than 7 days)
      await this.cleanStaleOfflineData();
      
      return (failedSessions === 0);
    } catch (error) {
      logger.error('Error syncing offline data:', error);
      // Don't throw the error - just log it
      return false;
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

      const now = new Date().toISOString();

      // First try to insert - if it fails due to duplicate, then update
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
        }])
        .select()
        .single();

      if (insertError) {
        // If error is not a unique violation, it's a real error
        if (!insertError.message?.includes('duplicate key value violates unique constraint')) {
          logger.error('Error inserting user exercise history:', insertError);
          return false;
        }

        // If it was a duplicate, try to update
        const { error: updateError } = await supabase
          .from('user_exercises_history')
          .update({
            weight,
            reps,
            notes,
            updated_at: now
          })
          .eq('user_id', userId)
          .eq('exercise_id', exerciseId)
          .eq('session_id', sessionId)
          .eq('set_number', setNumber);

        if (updateError) {
          logger.error('Error updating user exercise history:', updateError);
          return false;
        }
      }

      // After successful insert/update, try to update personal records
      // But don't fail if personal records update fails
      try {
        await this.checkAndUpdatePersonalRecord(userId, exerciseId, weight, reps);
      } catch (prError) {
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
      // Direct upsert approach for personal records
      const now = new Date();
      const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // First check if a personal record exists for this user, exercise, and rep count
      const { data: existingRecord } = await supabase
        .from('personal_records')
        .select('id, weight')
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId)
        .eq('reps', reps)
        .maybeSingle();
      
      // Only update if the new weight is higher than the existing record
      if (existingRecord) {
        if (weight > existingRecord.weight) {
          logger.debug(`Updating personal record: ${weight} > ${existingRecord.weight} for ${reps} reps`);
          
          const { error } = await supabase
            .from('personal_records')
            .update({
              weight,
              date: today,
              updated_at: now.toISOString()
            })
            .eq('id', existingRecord.id);
            
          if (error) {
            logger.error('Error updating personal record:', error);
          }
        }
      } else {
        // No record exists, create a new one
        logger.debug(`Creating new personal record: ${weight} for ${reps} reps`);
        
        const { error } = await supabase
          .from('personal_records')
          .insert({
            user_id: userId,
            exercise_id: exerciseId,
            weight,
            reps,
            date: today,
            created_at: now.toISOString(),
            updated_at: now.toISOString()
          });
          
        if (error) {
          logger.error('Error inserting personal record:', error);
        }
      }
    } catch (error) {
      // Catch-all error handling
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

  // Add method to sync a set to user_exercises_history
  async syncSetToUserExercisesHistory(
    userId: string,
    exerciseId: string,
    sessionId: string,
    setNumber: number,
    weight: number,
    reps: number
  ): Promise<void> {
    try {
      const now = new Date().toISOString();

      // Fetch exercise name
      const { data: exerciseData } = await supabase
        .from('exercises')
        .select('name')
        .eq('id', exerciseId)
        .single();

      const exerciseName = exerciseData?.name || 'Unknown Exercise';

      // Check if record already exists
      const { data: existingRecord, error: checkError } = await supabase
        .from('user_exercises_history')
        .select('id')
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId)
        .eq('session_id', sessionId)
        .eq('set_number', setNumber)
        .single();

      if (!checkError && existingRecord) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('user_exercises_history')
          .update({
            weight,
            reps,
            exercise_name: exerciseName,
            updated_at: now
          })
          .eq('id', existingRecord.id);
        if (updateError) {
          logger.error(`Failed to update user_exercises_history for set ${setNumber}:`, updateError);
        } else {
          logger.debug(`Updated existing user exercise history record for set ${setNumber}`);
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('user_exercises_history')
          .insert([{
            user_id: userId,
            exercise_id: exerciseId,
            exercise_name: exerciseName,
            session_id: sessionId,
            weight,
            reps,
            set_number: setNumber,
            completed_at: now,
            personal_record: false, // Will be updated by checkAndUpdatePersonalRecord if needed
            created_at: now,
            updated_at: now
          }]);

        if (insertError) {
          logger.error(`Failed to insert user_exercises_history for set ${setNumber}:`, insertError);
          // If error is duplicate, try update
          if (insertError.message?.includes('duplicate key value')) {
            const { error: updateError } = await supabase
              .from('user_exercises_history')
              .update({
                weight,
                reps,
                exercise_name: exerciseName,
                updated_at: now
              })
              .eq('user_id', userId)
              .eq('exercise_id', exerciseId)
              .eq('session_id', sessionId)
              .eq('set_number', setNumber);
            if (updateError) {
              logger.error(`Failed to update after duplicate insert for set ${setNumber}:`, updateError);
            } else {
              logger.debug(`Updated user exercise history after duplicate insert for set ${setNumber}`);
            }
          }
        } else {
          logger.debug(`Created new user exercise history record for set ${setNumber}`);
        }
      }

      // After successful insert/update, try to update personal records
      // But don't fail if personal records update fails
      try {
        await this.checkAndUpdatePersonalRecord(userId, exerciseId, weight, reps);
      } catch (prError) {
        logger.error('Error updating personal records:', prError);
      }
    } catch (error) {
      logger.error(`Error syncing set ${setNumber} to user_exercises_history:`, error);
    }
  },

  // Improved deleteActivePlanWithSessions method
  async deleteActivePlanWithSessions(planId: string): Promise<boolean> {
    try {
      logger.debug(`Starting deletion process for active plan: ${planId}`);
      
      // First verify the plan exists
      const { data: planData, error: planCheckError } = await supabase
        .from('user_active_plans')
        .select('id')
        .eq('id', planId)
        .single();
        
      if (planCheckError) {
        logger.error(`Plan ${planId} not found or error checking:`, planCheckError);
        return false;
      }
      
      logger.debug(`Verified plan exists: ${planId}`);
      
      // 1. Get all workout sessions for this plan with detailed logging
      const { data: sessions, error: sessionsError } = await supabase
        .from('workout_sessions')
        .select('id, start_time, status')
        .eq('active_plan_id', planId);
        
      if (sessionsError) {
        logger.error(`Error fetching workout sessions for plan ${planId}:`, sessionsError);
        return false;
      }
      
      if (!sessions || sessions.length === 0) {
        logger.debug(`No workout sessions found for plan ${planId}, proceeding with deletion`);
      } else {
        logger.debug(`Found ${sessions.length} workout sessions to delete for plan ${planId}`);
        logger.debug(`Session IDs: ${sessions.map(s => s.id).join(', ')}`);
        
        const sessionIds = sessions.map(s => s.id);
        
        // 2. First delete all exercise history records associated with these sessions
        logger.debug(`Deleting exercise history for ${sessionIds.length} sessions`);
        const { data: historyData, error: historyCheckError } = await supabase
          .from('user_exercises_history')
          .select('count')
          .in('session_id', sessionIds);
          
        if (!historyCheckError) {
          logger.debug(`Found exercise history records to delete: ${JSON.stringify(historyData)}`);
        }
        
        // Delete exercise history with thorough error handling
        try {
          const { error: historyError } = await supabase
            .from('user_exercises_history')
            .delete()
            .in('session_id', sessionIds);
            
          if (historyError) {
            logger.error(`Error deleting exercise history for plan ${planId}:`, historyError);
            return false;
          }
          
          logger.debug(`Successfully deleted exercise history for ${sessionIds.length} sessions`);
        } catch (deleteHistoryError) {
          logger.error(`Exception deleting exercise history for plan ${planId}:`, deleteHistoryError);
          return false;
        }
        
        // 3. Now delete each session individually to ensure success
        let allSessionsDeleted = true;
        for (const sessionId of sessionIds) {
          try {
            logger.debug(`Deleting session ${sessionId}`);
            const { error: sessionError } = await supabase
              .from('workout_sessions')
              .delete()
              .eq('id', sessionId);
              
            if (sessionError) {
              logger.error(`Error deleting session ${sessionId}:`, sessionError);
              allSessionsDeleted = false;
            } else {
              logger.debug(`Successfully deleted session ${sessionId}`);
            }
          } catch (deleteSessionError) {
            logger.error(`Exception deleting session ${sessionId}:`, deleteSessionError);
            allSessionsDeleted = false;
          }
        }
        
        if (!allSessionsDeleted) {
          logger.error(`Some sessions could not be deleted for plan ${planId}`);
          
          // Verify what sessions remain
          const { data: remainingSessions } = await supabase
            .from('workout_sessions')
            .select('id, active_plan_id')
            .eq('active_plan_id', planId);
            
          if (remainingSessions && remainingSessions.length > 0) {
            logger.error(`${remainingSessions.length} sessions still remain for plan ${planId}: ${JSON.stringify(remainingSessions)}`);
            return false;
          } else {
            logger.debug(`Verified all sessions are now deleted for plan ${planId}`);
          }
        } else {
          logger.debug(`All ${sessionIds.length} sessions successfully deleted for plan ${planId}`);
        }
      }
      
      // 4. Double check that no sessions remain before proceeding
      const { data: checkSessions } = await supabase
        .from('workout_sessions')
        .select('count')
        .eq('active_plan_id', planId);
        
      if (checkSessions && checkSessions[0]?.count > 0) {
        logger.error(`Found ${checkSessions[0].count} remaining sessions for plan ${planId}, cannot safely delete plan`);
        return false;
      }
      
      // 5. Now delete the plan exercises
      logger.debug(`Deleting exercises for plan ${planId}`);
      try {
        const { error: exercisesError } = await supabase
          .from('user_active_plan_exercises')
          .delete()
          .eq('active_plan_id', planId);
          
        if (exercisesError) {
          logger.error(`Error deleting plan exercises for ${planId}:`, exercisesError);
          // Continue anyway, not a blocker for plan deletion
          logger.debug(`Continuing with plan deletion despite exercise deletion error`);
        } else {
          logger.debug(`Successfully deleted exercises for plan ${planId}`);
        }
      } catch (exerciseDeleteError) {
        logger.error(`Exception deleting exercises for plan ${planId}:`, exerciseDeleteError);
        // Continue anyway, not a blocker for plan deletion
        logger.debug(`Continuing with plan deletion despite exercise deletion error`);
      }
      
      // 6. Finally delete the plan itself with a small delay to ensure DB consistency
      await new Promise(resolve => setTimeout(resolve, 300));
      logger.debug(`Deleting plan ${planId}`);
      
      try {
        const { error: planError } = await supabase
          .from('user_active_plans')
          .delete()
          .eq('id', planId);
          
        if (planError) {
          logger.error(`Error deleting active plan ${planId}:`, planError);
          return false;
        }
        
        logger.debug(`Successfully deleted active plan: ${planId}`);
        return true;
      } catch (planDeleteError) {
        logger.error(`Exception deleting active plan ${planId}:`, planDeleteError);
        return false;
      }
    } catch (error) {
      logger.error(`Error in deleteActivePlanWithSessions for plan ${planId}:`, error);
      return false;
    }
  },
};

export default workoutPlanService; 