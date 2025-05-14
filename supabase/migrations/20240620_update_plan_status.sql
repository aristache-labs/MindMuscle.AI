-- Add status field to user_active_plans table
ALTER TABLE user_active_plans ADD COLUMN IF NOT EXISTS status TEXT;

-- Update existing records
UPDATE user_active_plans SET status = 'InProgress' WHERE is_active = TRUE;
UPDATE user_active_plans SET status = 'Completed' WHERE is_active = FALSE;

-- Add comment to the table for documentation
COMMENT ON COLUMN user_active_plans.status IS 'Plan status: InProgress, Completed, or NULL';

-- Create an index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_user_active_plans_status ON user_active_plans(status); 