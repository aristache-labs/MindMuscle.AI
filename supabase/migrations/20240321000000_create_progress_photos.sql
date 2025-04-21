-- Create progress_photos table
CREATE TABLE IF NOT EXISTS public.progress_photos (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('before', 'after')),
  photo_url TEXT NOT NULL,
  taken_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own photos" ON public.progress_photos;
DROP POLICY IF EXISTS "Users can insert their own photos" ON public.progress_photos;
DROP POLICY IF EXISTS "Users can delete their own photos" ON public.progress_photos;

-- Allow users to see only their own photos
CREATE POLICY "Users can view their own photos"
  ON public.progress_photos
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert their own photos
CREATE POLICY "Users can insert their own photos"
  ON public.progress_photos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own photos
CREATE POLICY "Users can delete their own photos"
  ON public.progress_photos
  FOR DELETE
  USING (auth.uid() = user_id);

-- Storage bucket and policies need to be configured through the Supabase Dashboard
-- or using the Supabase Management API. They cannot be created through SQL migrations.
-- Please follow these steps manually in the Supabase Dashboard:
-- 1. Go to Storage > Buckets
-- 2. Create a new bucket named 'progress-photos' if it doesn't exist
-- 3. Set the bucket to Public
-- 4. Go to Storage > Policies
-- 5. Add the following policies for the 'progress-photos' bucket:
--    - SELECT: Allow public access (no conditions)
--    - INSERT: auth.uid()::text = (storage.foldername(name))[1]
--    - DELETE: auth.uid()::text = (storage.foldername(name))[1] 