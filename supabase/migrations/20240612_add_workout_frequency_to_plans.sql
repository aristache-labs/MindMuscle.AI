-- Add workout_frequency to plans table
ALTER TABLE workout_plans 
ADD COLUMN IF NOT EXISTS workout_frequency INTEGER DEFAULT 1;

-- Add workout_frequency to user_active_plans table
ALTER TABLE user_active_plans 
ADD COLUMN IF NOT EXISTS workout_frequency INTEGER DEFAULT 1;

-- Add current_week to user_active_plans to track user's progress
ALTER TABLE user_active_plans 
ADD COLUMN IF NOT EXISTS current_week INTEGER DEFAULT 1;

-- Add week_started_at to user_active_plans to track when the current week started
ALTER TABLE user_active_plans 
ADD COLUMN IF NOT EXISTS week_started_at TIMESTAMPTZ DEFAULT now();

-- Add comments explaining fields
COMMENT ON COLUMN workout_plans.workout_frequency IS 'Number of workout days per week in this plan';
COMMENT ON COLUMN user_active_plans.workout_frequency IS 'Number of workout days per week in this plan';
COMMENT ON COLUMN user_active_plans.current_week IS 'Current week of the 5-week progression (1-5)';
COMMENT ON COLUMN user_active_plans.week_started_at IS 'Timestamp when the current week started'; 