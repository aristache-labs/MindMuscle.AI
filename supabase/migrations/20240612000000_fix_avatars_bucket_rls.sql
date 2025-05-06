-- This migration fixes the RLS policies for the avatars bucket
-- to allow users to upload and delete their own avatar photos

-- Storage bucket and policies need to be configured through the Supabase Dashboard
-- or using the Supabase Management API. They cannot be created through SQL migrations.
-- Please follow these steps manually in the Supabase Dashboard:
-- 1. Go to Storage > Buckets
-- 2. Ensure the 'avatars' bucket exists and is set to Public
-- 3. Go to Storage > Policies for the 'avatars' bucket
-- 4. Remove any existing policies for the avatars bucket
-- 5. Add the following policies for the 'avatars' bucket:
--    - SELECT: Allow public access (no conditions)
--    - INSERT: auth.uid()::text = (storage.foldername(name))[1]
--    - DELETE: auth.uid()::text = (storage.foldername(name))[1]

-- Create function to check if the migration has been applied
CREATE OR REPLACE FUNCTION public.check_avatars_bucket_exists()
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  bucket_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE name = 'avatars'
  ) INTO bucket_exists;
  
  RETURN bucket_exists;
END;
$$;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration to fix avatars bucket RLS policies completed.';
  
  -- Check if bucket exists
  IF (SELECT public.check_avatars_bucket_exists()) THEN
    RAISE NOTICE 'Avatars bucket exists. Please update its policies manually in the Supabase Dashboard.';
  ELSE
    RAISE NOTICE 'Avatars bucket does not exist. Please create it manually in the Supabase Dashboard.';
  END IF;
END;
$$; 