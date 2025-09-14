-- Add duplicate_policy to forms table
ALTER TABLE forms
ADD COLUMN duplicate_policy text DEFAULT 'allow';

-- Add force_external_browser to cms_pages table  
ALTER TABLE cms_pages
ADD COLUMN force_external_browser boolean DEFAULT false;