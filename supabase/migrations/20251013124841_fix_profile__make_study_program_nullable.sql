-- Make study_program_id nullable for non-student profiles (Staff and External)
-- Student profiles will still have study_program_id populated
-- Staff and External profiles do not require academic program information
ALTER TABLE profile ALTER COLUMN study_program_id DROP NOT NULL;
