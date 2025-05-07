-- Migration to add RPC function to bypass RLS for avatar operations
-- This allows users to manage their own avatars more reliably

-- Create a security-definer function to bypass RLS for avatar operations
CREATE OR REPLACE FUNCTION public.modify_avatar(user_id uuid, action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  file_path text := user_id || '/profile.jpg';
  bucket_name text := 'avatars';
BEGIN
  -- Validate user has permission
  IF auth.uid() IS NULL OR auth.uid() <> user_id THEN
    RAISE EXCEPTION 'Unauthorized: only the owner can modify their avatar';
  END IF;

  -- Check action type
  IF action = 'delete' THEN
    -- Delete avatar file if it exists
    PERFORM storage.delete(bucket_name, file_path);
    RETURN true;
  ELSIF action = 'prepare' THEN
    -- Prepare for upload by removing any existing file
    BEGIN
      PERFORM storage.delete(bucket_name, file_path);
      EXCEPTION WHEN OTHERS THEN
        -- Ignore errors if file doesn't exist
        NULL;
    END;
    RETURN true;
  ELSE
    RAISE EXCEPTION 'Invalid action: must be either "delete" or "prepare"';
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.modify_avatar(uuid, text) TO authenticated;

-- Create new RLS policies for avatars bucket
DO $$
BEGIN
  -- Check if the avatars bucket exists and update with more permissive policies
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'avatars') THEN
    -- Drop existing policies if they exist
    BEGIN
      PERFORM storage.policy.deleter('avatars');
      PERFORM storage.policy.inserter('avatars');
      PERFORM storage.policy.updater('avatars');
      PERFORM storage.policy.selecter('avatars');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error removing existing policies: %', SQLERRM;
    END;

    -- Add new policies
    -- Policy for SELECT: allow public access
    PERFORM storage.policy.selectr(
      'avatars', 
      'Public SELECT access', 
      '(true)'
    );

    -- Policy for INSERT: authenticated users can insert into their own folder
    PERFORM storage.policy.insertr(
      'avatars', 
      'Authenticated users can upload to their own folder', 
      '(auth.uid()::text = SPLIT_PART(name, ''/'', 1))'
    );

    -- Policy for UPDATE: authenticated users can update their own avatars
    PERFORM storage.policy.updater(
      'avatars',
      'Authenticated users can update their own avatars',
      '(auth.uid()::text = SPLIT_PART(name, ''/'', 1))'
    );

    -- Policy for DELETE: authenticated users can delete their own avatars
    PERFORM storage.policy.deleter(
      'avatars',
      'Authenticated users can delete their own avatars',
      '(auth.uid()::text = SPLIT_PART(name, ''/'', 1))'
    );

    RAISE NOTICE 'Avatar bucket policies have been updated successfully.';
  ELSE
    RAISE NOTICE 'Avatars bucket does not exist. Please create it manually in the Supabase Dashboard.';
  END IF;
END;
$$; 