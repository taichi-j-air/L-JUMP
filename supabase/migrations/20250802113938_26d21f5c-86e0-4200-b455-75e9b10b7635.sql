-- Update profiles to set add_friend_url for users who have LINE Bot configured
-- This enables the lin.ee direct app launch method as an alternative to OAuth
-- Users can manually update their add_friend_url in the profile management page

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.add_friend_url IS 'LINE official account friend addition URL (lin.ee format) for direct app launch';

-- Example SQL for users to run manually (commented out for safety):
-- UPDATE public.profiles 
-- SET add_friend_url = 'https://lin.ee/YOUR_CODE'
-- WHERE user_id = auth.uid()
--   AND line_login_channel_id IS NOT NULL;