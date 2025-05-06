-- Remove accent_color from workout_plans table
ALTER TABLE workout_plans DROP COLUMN IF EXISTS accent_color;

-- Update the comments
COMMENT ON TABLE workout_plans IS 'Workout plans table - removed accent_color as it is now available in workout_subcategories'; 