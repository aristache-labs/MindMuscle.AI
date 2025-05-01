import supabase from './supabase';

export interface Exercise {
  id: string;
  name: string;
  description: string;
  muscle_group: string;
  equipment: string;
  difficulty: string;
  created_at: string;
  updated_at: string;
  image_url?: string;
  video_url?: string;
  primary_muscles?: string[];
  secondary_muscles?: string[];
  instructions?: string[];
  is_favorite?: boolean;
}

export type ExerciseCategory = 
  | 'Cardio' 
  | 'Shoulders' 
  | 'Chest' 
  | 'Biceps' 
  | 'Abs' 
  | 'Forearms' 
  | 'Obliques' 
  | 'Quads' 
  | 'Adductors' 
  | 'Traps' 
  | 'Triceps' 
  | 'Lats' 
  | 'Lower_back' 
  | 'Abductors' 
  | 'Glutes' 
  | 'Hamstrings' 
  | 'Calves' 
  | 'all';

const exerciseService = {
  async getAllExercises(): Promise<Exercise[]> {
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching exercises:', error);
      throw error;
    }

    return data || [];
  },

  async getExercisesByCategory(category: ExerciseCategory): Promise<Exercise[]> {
    // If 'all' is passed, fetch all exercises
    if (category === 'all') {
      return this.getAllExercises();
    }
    
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('muscle_group', category)
      .order('name');

    if (error) {
      console.error(`Error fetching ${category} exercises:`, error);
      throw error;
    }

    return data || [];
  },

  async getFavoriteExercises(): Promise<Exercise[]> {
    // Get the current user ID
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) {
      throw new Error('User not authenticated');
    }
    
    const userId = userData.user.id;
    
    // Get exercises marked as favorites by the user
    const { data, error } = await supabase
      .from('user_favorite_exercises')
      .select('exercise_id')
      .eq('user_id', userId);
      
    if (error) {
      console.error('Error fetching favorite exercises:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    // Get the actual exercise details
    const exerciseIds = data.map(item => item.exercise_id);
    const { data: exercises, error: exercisesError } = await supabase
      .from('exercises')
      .select('*')
      .in('id', exerciseIds)
      .order('name');
      
    if (exercisesError) {
      console.error('Error fetching favorite exercise details:', exercisesError);
      throw exercisesError;
    }
    
    return exercises || [];
  },

  async toggleFavoriteExercise(exerciseId: string, isFavorite: boolean): Promise<void> {
    // Get the current user ID
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) {
      throw new Error('User not authenticated');
    }
    
    const userId = userData.user.id;
    
    if (isFavorite) {
      // Add to favorites
      const { error } = await supabase
        .from('user_favorite_exercises')
        .insert({ user_id: userId, exercise_id: exerciseId });
        
      if (error) {
        console.error('Error adding exercise to favorites:', error);
        throw error;
      }
    } else {
      // Remove from favorites
      const { error } = await supabase
        .from('user_favorite_exercises')
        .delete()
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId);
        
      if (error) {
        console.error('Error removing exercise from favorites:', error);
        throw error;
      }
    }
  },

  async getExerciseById(id: string): Promise<Exercise | null> {
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching exercise:', error);
      throw error;
    }

    return data;
  },

  async searchExercises(query: string): Promise<Exercise[]> {
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .order('name');

    if (error) {
      console.error('Error searching exercises:', error);
      throw error;
    }

    return data || [];
  },

  async createExercise(exercise: Omit<Exercise, 'id' | 'created_at' | 'updated_at'>): Promise<Exercise> {
    const { data, error } = await supabase
      .from('exercises')
      .insert([exercise])
      .select()
      .single();

    if (error) {
      console.error('Error creating exercise:', error);
      throw error;
    }

    return data;
  },

  async updateExercise(id: string, updates: Partial<Exercise>): Promise<Exercise> {
    const { data, error } = await supabase
      .from('exercises')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating exercise:', error);
      throw error;
    }

    return data;
  },

  async deleteExercise(id: string): Promise<void> {
    const { error } = await supabase
      .from('exercises')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting exercise:', error);
      throw error;
    }
  }
};

export default exerciseService; 