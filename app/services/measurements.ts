import supabase from './supabase';

export interface Measurement {
  id: string;
  user_id: string;
  category: string;
  value: number;
  unit: string;
  measured_at?: string;
  previous_value?: number | null;
  created_at: string;
  updated_at: string;
}

export const MEASUREMENT_CATEGORIES = {
  WEIGHT: 'WEIGHT',
  BICEPS: 'BICEPS',
  ABS: 'ABS',
  WAIST: 'WAIST',
  CHEST: 'CHEST',
  SHLDRS: 'SHLDRS',
  THIGH: 'THIGH',
  CALF: 'CALF',
} as const;

export type MeasurementCategory = keyof typeof MEASUREMENT_CATEGORIES;

export const measurementService = {
  // Get all measurements for a user
  async getUserMeasurements(userId: string): Promise<Measurement[]> {
    const { data, error } = await supabase
      .from('measurements')
      .select('*')
      .eq('user_id', userId)
      .order('measured_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get latest measurements for each category
  async getLatestMeasurements(userId: string): Promise<Record<MeasurementCategory, Measurement | null>> {
    const { data, error } = await supabase
      .from('measurements')
      .select('*')
      .eq('user_id', userId)
      .order('measured_at', { ascending: false });

    if (error) throw error;

    const latest: Partial<Record<MeasurementCategory, Measurement>> = {};
    const secondLatest: Partial<Record<MeasurementCategory, Measurement>> = {};
    
    // Group by category and get the latest and second latest for each
    data.forEach(measurement => {
      const category = measurement.category as MeasurementCategory;
      if (!latest[category]) {
        latest[category] = measurement;
      } else if (!secondLatest[category]) {
        secondLatest[category] = measurement;
      }
    });

    // Add previous_value to each latest measurement
    Object.keys(latest).forEach(category => {
      const categoryKey = category as MeasurementCategory;
      if (latest[categoryKey] && secondLatest[categoryKey]) {
        latest[categoryKey] = {
          ...latest[categoryKey]!,
          previous_value: secondLatest[categoryKey]!.value
        };
      }
    });

    // Ensure all categories have a value (null if no measurement exists)
    return Object.keys(MEASUREMENT_CATEGORIES).reduce((acc, category) => {
      acc[category as MeasurementCategory] = latest[category as MeasurementCategory] || null;
      return acc;
    }, {} as Record<MeasurementCategory, Measurement | null>);
  },

  // Get measurement history for a category
  async getMeasurementHistory(userId: string, category: MeasurementCategory): Promise<Measurement[]> {
    const { data, error } = await supabase
      .from('measurements')
      .select('*')
      .eq('user_id', userId)
      .eq('category', category)
      .order('measured_at', { ascending: false });

    if (error) throw error;
    
    // Process measurements to ensure proper sorting and arrow calculation
    // The measurements are already sorted by date in descending order (newest first)
    // We need to reverse the order to show oldest first in the UI
    const sortedMeasurements = [...data].reverse();
    
    // Now the first item in sortedMeasurements is the actual first measurement
    // and the last item is the most recent measurement
    
    return sortedMeasurements;
  },

  // Add a new measurement
  async addMeasurement(
    userId: string,
    category: MeasurementCategory,
    value: number,
    unit: string,
    measured_at?: string
  ): Promise<Measurement> {
    const { data, error } = await supabase
      .from('measurements')
      .insert([{
        user_id: userId,
        category,
        value,
        unit,
        measured_at: measured_at || new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update a measurement
  async updateMeasurement(
    measurementId: string,
    updates: Partial<Measurement>
  ): Promise<Measurement> {
    const { data, error } = await supabase
      .from('measurements')
      .update(updates)
      .eq('id', measurementId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete a measurement
  async deleteMeasurement(measurementId: string): Promise<void> {
    const { error } = await supabase
      .from('measurements')
      .delete()
      .eq('id', measurementId);

    if (error) throw error;
  }
};

export default measurementService; 