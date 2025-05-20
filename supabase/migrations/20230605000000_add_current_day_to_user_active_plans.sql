-- Add the current_day column to user_active_plans table
ALTER TABLE user_active_plans 
ADD COLUMN IF NOT EXISTS current_day INTEGER DEFAULT 0;

-- Add comment explaining the column
COMMENT ON COLUMN user_active_plans.current_day IS 'Current day number in the active plan (0-6, where 0 is typically Sunday)'; 