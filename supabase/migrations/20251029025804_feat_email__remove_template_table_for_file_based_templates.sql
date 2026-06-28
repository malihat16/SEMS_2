-- Migration: Remove template table and use file-based email templates
-- This migration removes the database template table and replaces it with file-based Handlebars templates
-- The notification_log.template_id foreign key is replaced with template_name to track which template was used

-- Step 1: Drop RLS policies on template table
DROP POLICY IF EXISTS "View templates" ON public.template;
DROP POLICY IF EXISTS "Create templates" ON public.template;
DROP POLICY IF EXISTS "Update templates" ON public.template;
DROP POLICY IF EXISTS "No hard delete template" ON public.template;

-- Step 2: Drop foreign key constraint from notification_log to template
ALTER TABLE public.notification_log
DROP CONSTRAINT IF EXISTS fk_notification_log_template_id;

-- Step 3: Alter notification_log to replace template_id with template_name
-- First, add the new column
ALTER TABLE public.notification_log
ADD COLUMN IF NOT EXISTS template_name TEXT;

-- Update existing rows with a default template name if any exist
-- (In a fresh system, this won't affect anything, but it's here for safety)
UPDATE public.notification_log
SET template_name = COALESCE(
  (SELECT name FROM public.template WHERE template_id = notification_log.template_id),
  'unknown'
)
WHERE template_name IS NULL;

-- Make template_name NOT NULL after populating it
ALTER TABLE public.notification_log
ALTER COLUMN template_name SET NOT NULL;

-- Drop the old template_id column
ALTER TABLE public.notification_log
DROP COLUMN IF EXISTS template_id;

-- Step 4: Drop the template table
DROP TABLE IF EXISTS public.template;

-- Step 5: Add a comment explaining the new approach
COMMENT ON COLUMN public.notification_log.template_name IS 'Name of the Handlebars template file used for this notification (e.g., "registration", "reminder", "thank-you", "certificate")';
