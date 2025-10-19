-- Add greeting image configuration to greeting settings
ALTER TABLE public.line_greeting_settings
ADD COLUMN IF NOT EXISTS greeting_image_config jsonb;

COMMENT ON COLUMN public.line_greeting_settings.greeting_image_config IS
'Stores JSON configuration for follow-up greeting images (mode, URLs, postback data).';
