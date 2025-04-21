-- Create achievements table
CREATE TABLE achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    subtitle VARCHAR(255),
    requirement TEXT NOT NULL,
    icon VARCHAR(100) NOT NULL,
    icon_background_color VARCHAR(50),
    total_progress INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user_achievements table
CREATE TABLE user_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    current_progress INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id)
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_achievements_updated_at
    BEFORE UPDATE ON achievements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_achievements_updated_at
    BEFORE UPDATE ON user_achievements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create RLS policies
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Achievements policies
CREATE POLICY "Allow read access to all authenticated users"
    ON achievements FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow insert to service role only"
    ON achievements FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Allow update to service role only"
    ON achievements FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- User achievements policies
CREATE POLICY "Users can read their own achievements"
    ON user_achievements FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own achievements"
    ON user_achievements FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all user achievements"
    ON user_achievements FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Insert initial achievements
INSERT INTO achievements (title, description, subtitle, requirement, icon, icon_background_color, total_progress) VALUES
    ('First Milestone', 'Your first workout', 'Your first workout', 'Complete your first workout', 'dumbbell', '#f9e009', 1),
    ('Determination', 'Completed 5 workouts', 'Completed 5 workouts', 'Complete 5 workouts', 'arm-flex', '#f9e009', 5),
    ('Gym Beast', '4 workouts in 1 week', '4 workouts in 1 week', 'Complete 4 workouts in a single week', 'arm-flex-outline', '#f9e009', 4),
    ('Rising Star', 'Completed 7 workouts', 'Completed 7 workouts', 'Complete 7 workouts', 'star', '#f9e009', 7),
    ('Power Month', '10 workouts in a month', '10 workouts in a month', 'Complete 10 workouts in one month', 'lightning-bolt', '#f9e009', 10),
    ('Gym Rat', 'Total time at the gym > 24h', 'Total time at the gym > 24h', 'Spend more than 24 hours at the gym', 'clock', '#f9e009', 24),
    ('3 in a Row', 'At least 3 workouts for 3 weeks', 'At least 3 workouts for 3 weeks', 'Complete at least 3 workouts per week for 3 weeks', 'numeric-3-box', '#f9e009', 3),
    ('4 in a Row', 'At least 4 workouts for 4 weeks', 'At least 4 workouts for 4 weeks', 'Complete at least 4 workouts per week for 4 weeks', 'numeric-4-box', '#f9e009', 4),
    ('5 in a Row', 'At least 5 workouts for 5 weeks', 'At least 5 workouts for 5 weeks', 'Complete at least 5 workouts per week for 5 weeks', 'numeric-5-box', '#f9e009', 5),
    ('Animal', 'Total weight lifted > 250k', 'Total weight lifted > 250k', 'Lift a total weight of more than 250,000 kg', 'weight', '#f9e009', 250),
    ('Savage', 'Total weight lifted > 500k', 'Total weight lifted > 500k', 'Lift a total weight of more than 500,000 kg', 'weight', '#f9e009', 500),
    ('Hulk', 'Total weight lifted > 1M', 'Total weight lifted > 1M', 'Lift a total weight of more than 1,000,000 kg', 'weight', '#f9e009', 1000); 