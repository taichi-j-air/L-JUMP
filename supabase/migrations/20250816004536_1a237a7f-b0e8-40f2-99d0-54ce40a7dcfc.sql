-- Fix the developer account setup
UPDATE profiles 
SET user_role = 'developer' 
WHERE user_id = 'c986e437-a760-4885-ae25-dd8ae3038516';