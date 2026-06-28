-- Create profile_type lookup table
CREATE TABLE profile_type (
    profile_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT
);

-- Insert profile type values
INSERT INTO profile_type (profile_type_id, name, description) VALUES
    (gen_random_uuid(), 'Student', 'Student profile type'),
    (gen_random_uuid(), 'Staff', 'Staff profile type'),
    (gen_random_uuid(), 'External', 'External profile type');

-- Add profile_type_id column as nullable first
ALTER TABLE profile ADD COLUMN profile_type_id UUID;

-- Populate existing profiles based on email pattern
-- Students have emails like: xxx@student.monash.edu
-- Staff have emails like: xxx@monash.edu (without 'student')
UPDATE profile
SET profile_type_id = (
    SELECT profile_type_id
    FROM profile_type
    WHERE name = 'Student'
)
WHERE email LIKE '%@student.monash.edu%';

-- All other existing profiles are Staff
UPDATE profile
SET profile_type_id = (
    SELECT profile_type_id
    FROM profile_type
    WHERE name = 'Staff'
)
WHERE profile_type_id IS NULL;

-- Now make the column NOT NULL
ALTER TABLE profile ALTER COLUMN profile_type_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE profile ADD CONSTRAINT fk_profile_profile_type_id
    FOREIGN KEY (profile_type_id)
    REFERENCES profile_type(profile_type_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Add unique constraint on profile_type name
ALTER TABLE profile_type ADD CONSTRAINT uk_profile_type_name UNIQUE (name);

-- Enable Row Level Security
ALTER TABLE profile_type ENABLE ROW LEVEL SECURITY;

-- Everyone can read profile_type lookup table
CREATE POLICY "View profile types" ON profile_type FOR SELECT USING (true);

-- Only superadmins can modify profile_type lookup table
CREATE POLICY "Modify profile types" ON profile_type FOR INSERT WITH CHECK (has_profile_role('Superadmin'));
CREATE POLICY "Update profile types" ON profile_type FOR UPDATE USING (has_profile_role('Superadmin'));
CREATE POLICY "Delete profile types" ON profile_type FOR DELETE USING (has_profile_role('Superadmin'));
