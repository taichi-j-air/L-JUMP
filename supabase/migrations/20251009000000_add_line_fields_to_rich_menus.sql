-- Add LINE rich menu tracking fields and selection flag
ALTER TABLE public.rich_menus
  ADD COLUMN IF NOT EXISTS line_rich_menu_id TEXT,
  ADD COLUMN IF NOT EXISTS line_rich_menu_alias_id TEXT,
  ADD COLUMN IF NOT EXISTS selected BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS rich_menus_line_rich_menu_alias_id_key
  ON public.rich_menus(line_rich_menu_alias_id)
  WHERE line_rich_menu_alias_id IS NOT NULL;
