-- Enable RLS on user_profile_details table
ALTER TABLE public.user_profile_details ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile details" ON public.user_profile_details;
DROP POLICY IF EXISTS "Users can update their own profile details" ON public.user_profile_details;
DROP POLICY IF EXISTS "Users can insert their own profile details" ON public.user_profile_details;

-- Create policies for user_profile_details
CREATE POLICY "Users can view their own profile details"
  ON public.user_profile_details
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile details"
  ON public.user_profile_details
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile details"
  ON public.user_profile_details
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id); 