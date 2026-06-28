-- RLS Policies for SEMS2 Database
-- These policies control access to data based on user authentication and roles

-- Helper function to get current user's profile
CREATE OR REPLACE FUNCTION get_current_profile()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT profile_id
  FROM public.profile
  WHERE user_id = (SELECT auth.uid())
  AND deleted_at IS NULL;
$$;

-- Helper function to check if user has specific profile role
CREATE OR REPLACE FUNCTION has_profile_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profile p
    JOIN public.profile_role pr ON p.profile_role_id = pr.profile_role_id
    WHERE p.user_id = (SELECT auth.uid())
    AND pr.name = required_role
    AND p.deleted_at IS NULL
  );
$$;

-- Helper function to check if user is member/leader/owner of organisation
CREATE OR REPLACE FUNCTION is_organisation_member(org_id UUID, min_role TEXT DEFAULT 'Member')
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organisation_member om
    JOIN public.organisation_role or_role ON om.role_id = or_role.organisation_role_id
    JOIN public.profile p ON om.profile_id = p.profile_id
    WHERE p.user_id = (SELECT auth.uid())
    AND om.organisation_id = org_id
    AND (
      (min_role = 'Member' AND or_role.name IN ('Member', 'Leader', 'Owner'))
      OR (min_role = 'Leader' AND or_role.name IN ('Leader', 'Owner'))
      OR (min_role = 'Owner' AND or_role.name = 'Owner')
    )
    AND p.deleted_at IS NULL
    AND om.deleted_at IS NULL
  );
$$;

-- =============================================
-- PROFILE POLICIES
-- =============================================

-- Combined policy for viewing profiles
-- All authenticated users can view all profiles
CREATE POLICY "View profiles" ON profile
FOR SELECT USING (
  (SELECT auth.uid()) IS NOT NULL
);

-- Combined policy for updating profiles
-- Note: Field-level restrictions for regular users will be implemented via application logic
-- Admin/Superadmin can update any field
CREATE POLICY "Update profiles" ON profile
FOR UPDATE USING (
  user_id = (SELECT auth.uid())
  OR has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- New users can create their own profile, admins can create any profile
CREATE POLICY "Create profiles" ON profile
FOR INSERT WITH CHECK (
  -- New users can create their own profile (user_id matches auth.uid())
  user_id = (SELECT auth.uid())
  -- Admins can create any profile
  OR has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- =============================================
-- EVENT POLICIES
-- =============================================

-- Combined policy for viewing events
CREATE POLICY "View events" ON event
FOR SELECT USING (
  -- Anyone can view approved events
  EXISTS (
    SELECT 1 FROM public.event_state es
    WHERE es.event_state_id = event.event_state_id
    AND es.name = 'approved'
  )
  -- Organisation members can view their org's events
  OR is_organisation_member(organisation_id)
  -- Admins can view all events
  OR has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- Organisation leaders/owners can create events (draft state only for non-admins)
CREATE POLICY "Create events" ON event
FOR INSERT WITH CHECK (
  -- Organisation leaders/owners can create draft events (Leader parameter includes Owner role)
  (is_organisation_member(organisation_id, 'Leader') AND
   EXISTS (
     SELECT 1 FROM event_state es
     WHERE es.event_state_id = event.event_state_id
     AND es.name = 'draft'
   ))
  -- Admins can create events in any state
  OR has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- Combined policy for updating events
-- Note: Field-level restrictions and state transitions will be implemented via application logic
CREATE POLICY "Update events" ON event
FOR UPDATE USING (
  is_organisation_member(organisation_id, 'Leader')
  OR has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- =============================================
-- REGISTRATION POLICIES
-- =============================================

-- Combined policy for viewing registrations
CREATE POLICY "View registrations" ON registration
FOR SELECT USING (
  -- Users can view own
  profile_id = get_current_profile()
  -- Org members can view their event registrations
  OR EXISTS (
    SELECT 1 FROM public.event e
    WHERE e.event_id = registration.event_id
    AND is_organisation_member(e.organisation_id)
  )
  -- Admins can view all
  OR has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- Users can create registrations for themselves for approved events only
CREATE POLICY "Create registrations" ON registration
FOR INSERT WITH CHECK (
  (profile_id = get_current_profile() AND
   EXISTS (
     SELECT 1 FROM public.event e
     JOIN public.event_state es ON e.event_state_id = es.event_state_id
     WHERE e.event_id = registration.event_id
     AND es.name = 'approved'
   ))
  OR has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- Combined policy for updating registrations
-- Note: Field-level restrictions for regular users will be implemented via application logic
CREATE POLICY "Update registrations" ON registration
FOR UPDATE USING (
  -- Users can update own
  profile_id = get_current_profile()
  -- Org leaders can update their event registrations
  OR EXISTS (
    SELECT 1 FROM public.event e
    WHERE e.event_id = registration.event_id
    AND is_organisation_member(e.organisation_id, 'Leader')
  )
  -- Admins can update all
  OR has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- =============================================
-- ATTENDANCE POLICIES
-- =============================================

-- Combined policy for viewing attendance
CREATE POLICY "View attendance" ON attendance
FOR SELECT USING (
  -- Users can view their own attendance
  EXISTS (
    SELECT 1 FROM registration r
    WHERE r.registration_id = attendance.registration_id
    AND r.profile_id = get_current_profile()
  )
  -- Organisation members can view attendance for their events
  OR EXISTS (
    SELECT 1 FROM registration r
    JOIN event e ON r.event_id = e.event_id
    WHERE r.registration_id = attendance.registration_id
    AND is_organisation_member(e.organisation_id)
  )
  -- Admins can view all attendance
  OR has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- Combined policy for creating attendance
CREATE POLICY "Create attendance" ON attendance
FOR INSERT WITH CHECK (
  -- Organisation leaders can create attendance records
  EXISTS (
    SELECT 1 FROM registration r
    JOIN event e ON r.event_id = e.event_id
    WHERE r.registration_id = attendance.registration_id
    AND is_organisation_member(e.organisation_id, 'Leader')
  )
  -- Admins can create attendance
  OR has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- Attendance records are immutable - no updates allowed
CREATE POLICY "No attendance updates" ON attendance
FOR UPDATE USING (false);

-- =============================================
-- ORGANISATION POLICIES
-- =============================================

-- Combined policy for viewing organisations
CREATE POLICY "View organisations" ON organisation
FOR SELECT USING (
  -- Everyone can view organisations
  true
);

-- Combined policy for updating organisations
-- Note: Field-level restrictions will be implemented via application logic
CREATE POLICY "Update organisations" ON organisation
FOR UPDATE USING (
  -- Organisation owners/leaders can update their organisation
  is_organisation_member(organisation_id, 'Leader')
  -- Admins can update all organisations
  OR has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- Combined policy for creating organisations
CREATE POLICY "Create organisations" ON organisation
FOR INSERT WITH CHECK (
  -- Admins can create organisations
  has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- =============================================
-- ORGANISATION MEMBER POLICIES
-- =============================================

-- Combined policy for viewing organisation membership
CREATE POLICY "View organisation membership" ON organisation_member
FOR SELECT USING (
  -- Organisation members can view their organisation's membership
  is_organisation_member(organisation_id)
  -- Admins can view all memberships
  OR has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- Combined policy for creating organisation membership
CREATE POLICY "Create organisation membership" ON organisation_member
FOR INSERT WITH CHECK (
  -- Organisation leaders can manage membership
  is_organisation_member(organisation_id, 'Leader')
  -- Admins can manage all memberships
  OR has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- Combined policy for updating organisation membership
CREATE POLICY "Update organisation membership" ON organisation_member
FOR UPDATE USING (
  -- Organisation leaders can update membership
  is_organisation_member(organisation_id, 'Leader')
  -- Users can leave organisations (update their own membership to deleted)
  OR profile_id = get_current_profile()
  -- Admins can update all memberships
  OR has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);


-- =============================================
-- NOTIFICATION POLICIES
-- =============================================

-- Combined policy for viewing notifications
CREATE POLICY "View notifications" ON notification_log
FOR SELECT USING (
  -- Users can view notifications for their registrations
  EXISTS (
    SELECT 1 FROM registration r
    WHERE r.registration_id = notification_log.registration_id
    AND r.profile_id = get_current_profile()
  )
  -- Organisation members can view notifications for their events
  OR EXISTS (
    SELECT 1 FROM registration r
    JOIN event e ON r.event_id = e.event_id
    WHERE r.registration_id = notification_log.registration_id
    AND is_organisation_member(e.organisation_id)
  )
  -- Admins can view all notifications
  OR has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- System can create notifications
CREATE POLICY "Create notifications" ON notification_log
FOR INSERT WITH CHECK (true);

-- =============================================
-- TEMPLATE POLICIES
-- =============================================

-- Combined policy for viewing templates
CREATE POLICY "View templates" ON template
FOR SELECT USING (
  -- Admins can view templates
  has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- Combined policy for creating templates
CREATE POLICY "Create templates" ON template
FOR INSERT WITH CHECK (
  -- Admins can create templates
  has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- Combined policy for updating templates
CREATE POLICY "Update templates" ON template
FOR UPDATE USING (
  -- Admins can update templates
  has_profile_role('Admin')
  OR has_profile_role('Superadmin')
);

-- =============================================
-- LOOKUP TABLE POLICIES (READ-ONLY FOR MOST)
-- =============================================

-- Everyone can read lookup tables (single policy per table)
CREATE POLICY "View study schools" ON study_school FOR SELECT USING (true);
CREATE POLICY "View study courses" ON study_course FOR SELECT USING (true);
CREATE POLICY "View study levels" ON study_level FOR SELECT USING (true);
CREATE POLICY "View study programs" ON study_program FOR SELECT USING (true);
CREATE POLICY "View profile roles" ON profile_role FOR SELECT USING (true);
CREATE POLICY "View organisation roles" ON organisation_role FOR SELECT USING (true);
CREATE POLICY "View registration statuses" ON registration_status FOR SELECT USING (true);
CREATE POLICY "View event states" ON event_state FOR SELECT USING (true);
CREATE POLICY "View event modes" ON event_mode FOR SELECT USING (true);
CREATE POLICY "View notification statuses" ON notification_status FOR SELECT USING (true);

-- Only superadmins can modify lookup tables
CREATE POLICY "Modify study schools" ON study_school FOR INSERT WITH CHECK (has_profile_role('Superadmin'));
CREATE POLICY "Update study schools" ON study_school FOR UPDATE USING (has_profile_role('Superadmin'));
CREATE POLICY "Delete study schools" ON study_school FOR DELETE USING (has_profile_role('Superadmin'));

CREATE POLICY "Modify study courses" ON study_course FOR INSERT WITH CHECK (has_profile_role('Superadmin'));
CREATE POLICY "Update study courses" ON study_course FOR UPDATE USING (has_profile_role('Superadmin'));
CREATE POLICY "Delete study courses" ON study_course FOR DELETE USING (has_profile_role('Superadmin'));

CREATE POLICY "Modify study levels" ON study_level FOR INSERT WITH CHECK (has_profile_role('Superadmin'));
CREATE POLICY "Update study levels" ON study_level FOR UPDATE USING (has_profile_role('Superadmin'));
CREATE POLICY "Delete study levels" ON study_level FOR DELETE USING (has_profile_role('Superadmin'));

CREATE POLICY "Modify study programs" ON study_program FOR INSERT WITH CHECK (has_profile_role('Superadmin'));
CREATE POLICY "Update study programs" ON study_program FOR UPDATE USING (has_profile_role('Superadmin'));
CREATE POLICY "Delete study programs" ON study_program FOR DELETE USING (has_profile_role('Superadmin'));

CREATE POLICY "Modify profile roles" ON profile_role FOR INSERT WITH CHECK (has_profile_role('Superadmin'));
CREATE POLICY "Update profile roles" ON profile_role FOR UPDATE USING (has_profile_role('Superadmin'));
CREATE POLICY "Delete profile roles" ON profile_role FOR DELETE USING (has_profile_role('Superadmin'));

CREATE POLICY "Modify organisation roles" ON organisation_role FOR INSERT WITH CHECK (has_profile_role('Superadmin'));
CREATE POLICY "Update organisation roles" ON organisation_role FOR UPDATE USING (has_profile_role('Superadmin'));
CREATE POLICY "Delete organisation roles" ON organisation_role FOR DELETE USING (has_profile_role('Superadmin'));

CREATE POLICY "Modify registration statuses" ON registration_status FOR INSERT WITH CHECK (has_profile_role('Superadmin'));
CREATE POLICY "Update registration statuses" ON registration_status FOR UPDATE USING (has_profile_role('Superadmin'));
CREATE POLICY "Delete registration statuses" ON registration_status FOR DELETE USING (has_profile_role('Superadmin'));

CREATE POLICY "Modify event states" ON event_state FOR INSERT WITH CHECK (has_profile_role('Superadmin'));
CREATE POLICY "Update event states" ON event_state FOR UPDATE USING (has_profile_role('Superadmin'));
CREATE POLICY "Delete event states" ON event_state FOR DELETE USING (has_profile_role('Superadmin'));

CREATE POLICY "Modify event modes" ON event_mode FOR INSERT WITH CHECK (has_profile_role('Superadmin'));
CREATE POLICY "Update event modes" ON event_mode FOR UPDATE USING (has_profile_role('Superadmin'));
CREATE POLICY "Delete event modes" ON event_mode FOR DELETE USING (has_profile_role('Superadmin'));


CREATE POLICY "Modify notification statuses" ON notification_status FOR INSERT WITH CHECK (has_profile_role('Superadmin'));
CREATE POLICY "Update notification statuses" ON notification_status FOR UPDATE USING (has_profile_role('Superadmin'));
CREATE POLICY "Delete notification statuses" ON notification_status FOR DELETE USING (has_profile_role('Superadmin'));

-- =============================================
-- SOFT DELETE POLICIES FOR NON-LUT TABLES
-- Prevent hard deletes - soft deletes are handled via UPDATE
-- =============================================

-- No hard deletes allowed on profile table
CREATE POLICY "No hard delete profile" ON profile FOR DELETE USING (false);

-- No hard deletes allowed on registration table
CREATE POLICY "No hard delete registration" ON registration FOR DELETE USING (false);

-- No hard deletes allowed on attendance table
CREATE POLICY "No hard delete attendance" ON attendance FOR DELETE USING (false);

-- No hard deletes allowed on event table
CREATE POLICY "No hard delete event" ON event FOR DELETE USING (false);

-- No hard deletes allowed on organisation table
CREATE POLICY "No hard delete organisation" ON organisation FOR DELETE USING (false);

-- No hard deletes allowed on organisation_member table
CREATE POLICY "No hard delete organisation_member" ON organisation_member FOR DELETE USING (false);


-- No hard deletes allowed on notification_log table
CREATE POLICY "No hard delete notification_log" ON notification_log FOR DELETE USING (false);

-- No hard deletes allowed on template table
CREATE POLICY "No hard delete template" ON template FOR DELETE USING (false);