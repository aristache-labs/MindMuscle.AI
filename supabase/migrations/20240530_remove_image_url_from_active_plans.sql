-- Remove image_url column from user_active_plans
ALTER TABLE user_active_plans DROP COLUMN IF EXISTS image_url;

-- Note: Images for exercises will still be accessed through the 
-- exercises table via the relationship with user_active_plan_exercises 