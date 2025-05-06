-- Add workout_plan_exercises table to store exercises for each workout plan
CREATE TABLE IF NOT EXISTS workout_plan_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sets INT NOT NULL DEFAULT 3,
  reps_range VARCHAR(20) NOT NULL DEFAULT '8-10', -- Format could be "8-10" or "12" for fixed reps
  rest_time INT DEFAULT 60, -- Rest time in seconds
  "order" INT NOT NULL, -- Position in the workout (order is a reserved keyword, must be quoted)
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS workout_plan_exercises_plan_id_idx ON workout_plan_exercises(plan_id);

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_workout_plan_exercises_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workout_plan_exercises_updated_at_trigger
BEFORE UPDATE ON workout_plan_exercises
FOR EACH ROW
EXECUTE FUNCTION update_workout_plan_exercises_updated_at();

-- Insert some example data if exercises and plans exist
-- (The actual data insertion would depend on existing exercise IDs in your database)
-- This is just a placeholder example. You would replace these UUIDs with actual IDs from your database.
/*
INSERT INTO workout_plan_exercises (plan_id, exercise_id, sets, reps_range, rest_time, "order")
VALUES
  -- Example for a full body plan
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 3, '8-10', 60, 1), -- Replace with actual UUIDs
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 3, '8-10', 60, 2), -- Replace with actual UUIDs
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 3, '10-12', 45, 3), -- Replace with actual UUIDs
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 3, '12-15', 30, 4), -- Replace with actual UUIDs
  
  -- Example for another plan
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000005', 4, '6-8', 90, 1), -- Replace with actual UUIDs
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000006', 4, '6-8', 90, 2), -- Replace with actual UUIDs
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000007', 3, '8-10', 60, 3); -- Replace with actual UUIDs
*/ 