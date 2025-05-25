-- Add reps_adjustment_percentage to workout_cycle_weeks table for bodyweight exercises
ALTER TABLE workout_cycle_weeks 
ADD COLUMN IF NOT EXISTS reps_adjustment_percentage DECIMAL(5,2) DEFAULT 0.00;

-- Update existing cycle weeks with appropriate reps adjustment percentages
-- Week 1: Adaptation - Start with baseline reps
UPDATE workout_cycle_weeks 
SET reps_adjustment_percentage = 0.00 
WHERE week_number = 1;

-- Week 2: Accumulation - Increase reps by 10-15%
UPDATE workout_cycle_weeks 
SET reps_adjustment_percentage = 12.50 
WHERE week_number = 2;

-- Week 3: Intensification - Increase reps by 20-25%
UPDATE workout_cycle_weeks 
SET reps_adjustment_percentage = 22.50 
WHERE week_number = 3;

-- Week 4: Realization - Peak reps increase by 30-35%
UPDATE workout_cycle_weeks 
SET reps_adjustment_percentage = 32.50 
WHERE week_number = 4;

-- Week 5: Recovery - Reduce reps by 10-15% for active recovery
UPDATE workout_cycle_weeks 
SET reps_adjustment_percentage = -12.50 
WHERE week_number = 5;

-- Add comment explaining the new field
 