-- Fix organisation member unique constraint to allow re-adding soft-deleted members
-- This addresses the issue where attempting to re-add a previously removed member
-- fails with "duplicate key value violates unique constraint"

-- Drop the existing constraint that prevents re-adding soft-deleted members
ALTER TABLE organisation_member
DROP CONSTRAINT uk_organisation_member_org_profile;

-- Add a partial unique index that only enforces uniqueness for non-deleted records
-- This allows multiple soft-deleted records for the same org/profile combination
-- while still preventing duplicate active memberships
CREATE UNIQUE INDEX uk_organisation_member_org_profile_active
ON organisation_member (organisation_id, profile_id)
WHERE deleted_at IS NULL;