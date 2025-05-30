import supabase from './supabase';
import { User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

const profileService = {
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }

    return data;
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      throw error;
    }

    return data;
  },

  async createProfile(user: User): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .insert([
        {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || '',
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating profile:', error);
      throw error;
    }

    return data;
  }
};

export default profileService; 