-- Fix registration and attendance unique constraints to allow re-creation after soft-delete
-- This addresses similar issues where soft-deleted records prevent re-creation

-- =============================================
-- FIX REGISTRATION CONSTRAINTS
-- =============================================

-- Drop the existing constraint that prevents re-registering after cancellation
ALTER TABLE registration
DROP CONSTRAINT uk_registration_event_profile;

-- Add a partial unique index that only enforces uniqueness for active registrations
-- This allows users to re-register for events they previously cancelled
CREATE UNIQUE INDEX uk_registration_event_profile_active
ON registration (event_id, profile_id)
WHERE deleted_at IS NULL;

-- =============================================
-- FIX ATTENDANCE CONSTRAINTS
-- =============================================

-- Drop the existing constraint that prevents re-marking attendance
ALTER TABLE attendance
DROP CONSTRAINT uk_attendance_registration;

-- Add a partial unique index that only enforces uniqueness for active attendance records
-- This allows attendance to be re-marked if it was previously soft-deleted
CREATE UNIQUE INDEX uk_attendance_registration_active
ON attendance (registration_id)
WHERE deleted_at IS NULL;