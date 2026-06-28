-- Fix RLS policies to use normalized capitalized event state names
-- This aligns the policies with the normalized lookup table values from migration 20251013093551

-- =============================================
-- EVENT POLICIES
-- =============================================

-- Drop and recreate "View events" policy with capitalized 'Approved'
DROP POLICY IF EXISTS "View events" ON event;
CREATE POLICY "View events" ON event
FOR SELECT USING (
  -- Anyone can view approved events
  EXISTS (
    SELECT 1 FROM public.event_state es
    WHERE es.event_state_id = event.event_state_id
    AND es.name = 'Approved'
  )
  -- Organisation members can view their org's events
  OR is_organisation_member(organisation_id)
  -- Admins can view all events
  OR has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- Drop and recreate "Create events" policy with capitalized 'Draft'
DROP POLICY IF EXISTS "Create events" ON event;
CREATE POLICY "Create events" ON event
FOR INSERT WITH CHECK (
  -- Organisation leaders/owners can create draft events (Leader parameter includes Owner role)
  (is_organisation_member(organisation_id, 'Leader') AND
   EXISTS (
     SELECT 1 FROM event_state es
     WHERE es.event_state_id = event.event_state_id
     AND es.name = 'Draft'
   ))
  -- Admins can create events in any state
  OR has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- =============================================
-- REGISTRATION POLICIES
-- =============================================

-- Drop and recreate "Create registrations" policy with capitalized 'Approved'
DROP POLICY IF EXISTS "Create registrations" ON registration;
CREATE POLICY "Create registrations" ON registration
FOR INSERT WITH CHECK (
  (profile_id = get_current_profile() AND
   EXISTS (
     SELECT 1 FROM public.event e
     JOIN public.event_state es ON e.event_state_id = es.event_state_id
     WHERE e.event_id = registration.event_id
     AND es.name = 'Approved'
   ))
  OR has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);
