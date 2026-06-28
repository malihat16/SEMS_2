-- =============================================
-- SEMS2 Database Seeding Script
-- =============================================
--
-- This script seeds the database with sample data for development and testing.
-- It migrates data from the original INSERT.sql to the new Supabase schema.
--
-- NOTE: All lookup tables (study_level, study_school, study_course, etc.)
-- are already populated by the migration files, so this script only adds:
-- - Sample organisations
-- - Sample events
-- =============================================

-- Create a system user UUID for created_by fields that require NOT NULL
-- This represents system-generated seed data
DO $$
DECLARE
    system_uuid UUID := gen_random_uuid();
BEGIN
    -- =============================================
    -- ORGANISATIONS
    -- =============================================

    INSERT INTO public.organisation (
        organisation_id,
        name,
        description,
        organisation_update_request,
        created_at,
        created_by,
        modified_at,
        modified_by,
        deleted_at,
        deleted_by
    ) VALUES
    (
        gen_random_uuid(),
        'Tech Innovators Club',
        'A student-led organisation that explores emerging technologies, hosts coding workshops, and organises hackathons.',
        NULL,
        NOW(),
        system_uuid,
        NULL,
        NULL,
        NULL,
        NULL
    ),
    (
        gen_random_uuid(),
        'Business Leaders Society',
        'A society for aspiring entrepreneurs and business students to network, attend industry talks, and collaborate on startup projects.',
        NULL,
        NOW(),
        system_uuid,
        NULL,
        NULL,
        NULL,
        NULL
    ),
    (
        gen_random_uuid(),
        'Engineering Design Team',
        'A multidisciplinary engineering group that participates in design competitions, robotics challenges, and prototype development.',
        NULL,
        NOW(),
        system_uuid,
        NULL,
        NULL,
        NULL,
        NULL
    ),
    (
        gen_random_uuid(),
        'Health & Wellness Association',
        'Promotes mental and physical wellbeing on campus through awareness campaigns, fitness activities, and peer support programs.',
        NULL,
        NOW(),
        system_uuid,
        NULL,
        NULL,
        NULL,
        NULL
    ),
    (
        gen_random_uuid(),
        'Cultural Exchange Club',
        'An international student club that celebrates cultural diversity through food festivals, performances, and language exchange sessions.',
        NULL,
        NOW(),
        system_uuid,
        NULL,
        NULL,
        NULL,
        NULL
    ),
    (
        gen_random_uuid(),
        'MUMEC',
        'Monash University Malaysia Engineering Club (MUMEC) is the umbrella organisation administering the 15 engineering clubs & teams at Monash Malaysia, acting as the bridge between student clubs/teams and the SOE administration.',
        NULL,
        NOW(),
        system_uuid,
        NULL,
        NULL,
        NULL,
        NULL
    );

    -- =============================================
    -- EVENTS
    -- =============================================

    INSERT INTO public.event (
        event_id,
        organisation_id,
        event_state_id,
        event_mode_id,
        name,
        description,
        venue,
        capacity,
        note_to_registrants,
        start_datetime,
        end_datetime,
        registration_opening_datetime,
        registration_closing_datetime,
        registration_url,
        registration_secret_code,
        feedback_url,
        ems_url,
        ems_number,
        reviewed_by,
        reviewed_at,
        reviewer_notes,
        event_update_request,
        created_at,
        created_by,
        modified_at,
        modified_by,
        deleted_at,
        deleted_by
    ) VALUES
    -- 1. Past Event (-2 days)
    (
        gen_random_uuid(),
        (SELECT organisation_id FROM public.organisation WHERE name = 'Tech Innovators Club'),
        (SELECT event_state_id FROM public.event_state WHERE name = 'Approved'),
        (SELECT event_mode_id FROM public.event_mode WHERE name = 'Physical'),
        'AI Coding Sprint',
        'A hackathon focused on building AI-powered applications within 24 hours.',
        'Innovation Lab, Block A',
        100,
        'Bring your laptop and charger!',
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '2 days' + INTERVAL '6 hours',
        NOW() - INTERVAL '10 days',
        NOW() - INTERVAL '3 days',
        'https://example.com/register/ai-coding-sprint',
        NULL,
        'https://example.com/feedback/ai-coding-sprint',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NOW(),
        system_uuid,
        NULL,
        NULL,
        NULL,
        NULL
    ),

    -- 2. Current Event (Happening now)
    (
        gen_random_uuid(),
        (SELECT organisation_id FROM public.organisation WHERE name = 'Health & Wellness Association'),
        (SELECT event_state_id FROM public.event_state WHERE name = 'Approved'),
        (SELECT event_mode_id FROM public.event_mode WHERE name = 'Hybrid'),
        'Mindfulness & Yoga Session',
        'A guided yoga and meditation workshop for stress relief and focus.',
        'Sports Complex Hall',
        50,
        'Wear comfortable attire. Mats provided.',
        NOW() - INTERVAL '1 hour',
        NOW() + INTERVAL '2 hours',
        NOW() - INTERVAL '7 days',
        NOW() - INTERVAL '1 hour',
        'https://example.com/register/yoga-session',
        NULL,
        'https://example.com/feedback/yoga-session',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NOW(),
        system_uuid,
        NULL,
        NULL,
        NULL,
        NULL
    ),

    -- 3. Future Event #1 (3 days later)
    (
        gen_random_uuid(),
        (SELECT organisation_id FROM public.organisation WHERE name = 'Business Leaders Society'),
        (SELECT event_state_id FROM public.event_state WHERE name = 'Approved'),
        (SELECT event_mode_id FROM public.event_mode WHERE name = 'Online'),
        'Startup Pitch Night',
        'Students pitch their business ideas to a panel of judges and investors.',
        'Zoom (link will be shared after registration)',
        200,
        'Prepare a 5-minute pitch deck. Zoom meeting link will be shared via email after registration. Please test your audio and video before the event.',
        NOW() + INTERVAL '3 days',
        NOW() + INTERVAL '3 days' + INTERVAL '3 hours',
        NOW(),
        NOW() + INTERVAL '2 days',
        'https://example.com/register/startup-pitch-night',
        NULL,
        'https://example.com/feedback/startup-pitch-night',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NOW(),
        system_uuid,
        NULL,
        NULL,
        NULL,
        NULL
    ),

    -- 4. Future Event #2 (7 days later)
    (
        gen_random_uuid(),
        (SELECT organisation_id FROM public.organisation WHERE name = 'Engineering Design Team'),
        (SELECT event_state_id FROM public.event_state WHERE name = 'Approved'),
        (SELECT event_mode_id FROM public.event_mode WHERE name = 'Physical'),
        'Robotics Challenge 2025',
        'Teams compete to build and program robots for obstacle navigation.',
        'Engineering Workshop, Block C',
        150,
        'Safety briefing will be conducted before the challenge.',
        NOW() + INTERVAL '7 days',
        NOW() + INTERVAL '7 days' + INTERVAL '8 hours',
        NOW(),
        NOW() + INTERVAL '6 days',
        'https://example.com/register/robotics-challenge',
        NULL,
        'https://example.com/feedback/robotics-challenge',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NOW(),
        system_uuid,
        NULL,
        NULL,
        NULL,
        NULL
    ),

    -- 5. Future Event #3 (14 days later)
    (
        gen_random_uuid(),
        (SELECT organisation_id FROM public.organisation WHERE name = 'Cultural Exchange Club'),
        (SELECT event_state_id FROM public.event_state WHERE name = 'Approved'),
        (SELECT event_mode_id FROM public.event_mode WHERE name = 'Hybrid'),
        'International Food Festival',
        'Celebrate cultural diversity through cuisines from around the world.',
        'Main Courtyard',
        500,
        'Bring your appetite and an open mind!',
        NOW() + INTERVAL '14 days',
        NOW() + INTERVAL '14 days' + INTERVAL '6 hours',
        NOW(),
        NOW() + INTERVAL '13 days',
        'https://example.com/register/food-festival',
        NULL,
        'https://example.com/feedback/food-festival',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NOW(),
        system_uuid,
        NULL,
        NULL,
        NULL,
        NULL
    ),

    -- 6. Time-Sensitive Event (registration + event window very tight)
    (
        gen_random_uuid(),
        (SELECT organisation_id FROM public.organisation WHERE name = 'Tech Innovators Club'),
        (SELECT event_state_id FROM public.event_state WHERE name = 'Approved'),
        (SELECT event_mode_id FROM public.event_mode WHERE name = 'Online'),
        'Flash Networking Session',
        'A lightning-fast online networking session designed to test short registration and event windows.',
        'Google Meet (link shared after registration)',
        20,
        'This is a quick networking session. Please join the Google Meet link that will be shared after registration: https://meet.google.com/ Be prepared to introduce yourself briefly!',
        NOW() + INTERVAL '1 minute',
        NOW() + INTERVAL '2 minutes',
        NOW() - INTERVAL '1 minute',
        NOW() + INTERVAL '1 minute',
        'https://example.com/register/flash-networking',
        NULL,
        'https://example.com/feedback/flash-networking',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NOW(),
        system_uuid,
        NULL,
        NULL,
        NULL,
        NULL
    );

END $$;

-- =============================================
-- SEED DATA SUMMARY
-- =============================================
--
-- This script has added:
-- - 6 sample organisations (student clubs and societies)
-- - 6 sample events with different timing scenarios:
--   * 1 past event (AI Coding Sprint)
--   * 1 current/ongoing event (Mindfulness & Yoga Session)
--   * 4 future events (Startup Pitch Night, Robotics Challenge, Food Festival, Flash Networking)
--
-- All events are in 'Approved' state and use the standardized capitalized naming convention.
-- Event modes mapped from old schema:
-- - 'Physical (Campus)' & 'Physical (External)' → 'Physical'
-- - 'Online' → 'Online'
-- - 'Hybrid' → 'Hybrid'
--
-- A random system UUID is generated and used for all created_by fields
-- to satisfy NOT NULL constraints while indicating this is seed data.
-- =============================================