-- Add customization state columns to user_paused_workouts table
-- These columns track exercise customizations during paused workouts

ALTER TABLE user_paused_workouts 
ADD COLUMN IF NOT EXISTS exercise_customized JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS user_entered_values JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS focused_inputs JSONB DEFAULT '{}';

-- Add comments to explain the purpose of these columns
COMMENT ON COLUMN user_paused_workouts.exercise_customized IS 'Tracks which exercises have been customized by the user (sets, reps, exercise changes)';
COMMENT ON COLUMN user_paused_workouts.user_entered_values IS 'Tracks which input fields have been manually entered by the user';
COMMENT ON COLUMN user_paused_workouts.focused_inputs IS 'Tracks UI state for focused input fields during workout session';

-- Create an index on the new columns for better query performance if needed
-- (JSONB columns can be indexed for specific queries)
CREATE INDEX IF NOT EXISTS idx_user_paused_workouts_exercise_customized 
ON user_paused_workouts USING gin (exercise_customized); 