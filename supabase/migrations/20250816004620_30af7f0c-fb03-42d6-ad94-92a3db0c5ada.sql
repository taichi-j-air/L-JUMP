-- Add 'developer' to the allowed user_role values
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_user_role_check 
CHECK (user_role IN ('user', 'admin', 'developer'));

-- Now set the developer account
UPDATE profiles 
SET user_role = 'developer' 
WHERE user_id = 'c986e437-a760-4885-ae25-dd8ae3038516';