-- =============================================
-- CONSOLIDATE ATTENDANCE INTO REGISTRATIONS
-- =============================================
-- This migration consolidates the attendance table into the registrations table
-- for better performance and simplified data model

-- Step 1: Add new columns to registration table
ALTER TABLE registration ADD COLUMN attended BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE registration ADD COLUMN attendance_recorded_by UUID REFERENCES auth.users(id);
ALTER TABLE registration ADD COLUMN attendance_recorded_at TIMESTAMPTZ;

-- Step 2: Migrate existing attendance data
-- Update registrations with attendance data from existing attendance records
UPDATE registration
SET
    attended = TRUE,
    attendance_recorded_by = a.created_by,
    attendance_recorded_at = a.created_at
FROM attendance a
WHERE registration.registration_id = a.registration_id
    AND a.deleted_at IS NULL;

-- Step 3: Verify data migration
-- This query should return 0 rows if migration was successful
-- DO NOT INCLUDE IN MIGRATION - FOR VERIFICATION ONLY
-- SELECT COUNT(*) as missing_attendance_data
-- FROM attendance a
-- LEFT JOIN registration r ON a.registration_id = r.registration_id
-- WHERE a.deleted_at IS NULL AND (r.attended = FALSE OR r.attended IS NULL);

-- Step 4: Drop the old attendance table and related constraints
-- Remove the unique index first
DROP INDEX IF EXISTS uk_attendance_registration_active;

-- Drop the attendance table
DROP TABLE IF EXISTS attendance;

-- Step 5: Update RLS - attendance table RLS policy is automatically removed
-- The registration table already has RLS enabled, so no additional changes needed

-- Step 6: Add helpful indexes for the new columns
CREATE INDEX idx_registration_attended ON registration(attended) WHERE attended = TRUE;
CREATE INDEX idx_registration_attendance_recorded_at ON registration(attendance_recorded_at) WHERE attendance_recorded_at IS NOT NULL;