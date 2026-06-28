-- Create lookup tables first (no dependencies)
CREATE TABLE study_course (
    study_course_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT
);

CREATE TABLE study_school (
    study_school_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT
);

CREATE TABLE study_level (
    study_level_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT
);

CREATE TABLE profile_role (
    profile_role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT
);

CREATE TABLE registration_status (
    registration_status_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT
);


CREATE TABLE notification_status (
    notification_status_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT
);

CREATE TABLE event_state (
    event_state_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT
);

CREATE TABLE event_mode (
    event_mode_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT
);

CREATE TABLE organisation_role (
    organisation_role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT
);

-- Create dependent lookup tables
CREATE TABLE study_program (
    study_program_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_level_id UUID NOT NULL,
    study_school_id UUID NOT NULL,
    study_course_id UUID NOT NULL,
    description TEXT,
    CONSTRAINT fk_study_program_study_level_id FOREIGN KEY (study_level_id) REFERENCES study_level(study_level_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_study_program_study_school_id FOREIGN KEY (study_school_id) REFERENCES study_school(study_school_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_study_program_study_course_id FOREIGN KEY (study_course_id) REFERENCES study_course(study_course_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT uk_study_program_unique UNIQUE (study_level_id, study_school_id, study_course_id)
);

CREATE TABLE template (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subject TEXT,
    body TEXT
);

CREATE TABLE organisation (
    organisation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    organisation_update_request JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    modified_at TIMESTAMPTZ,
    modified_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
);

CREATE TABLE event (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL,
    event_state_id UUID NOT NULL,
    event_mode_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    venue TEXT,
    capacity BIGINT,
    note_to_registrants TEXT,
    start_datetime TIMESTAMPTZ,
    end_datetime TIMESTAMPTZ,
    registration_opening_datetime TIMESTAMPTZ,
    registration_closing_datetime TIMESTAMPTZ,
    registration_url TEXT,
    registration_secret_code TEXT,
    feedback_url TEXT,
    ems_url TEXT,
    ems_number TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    reviewer_notes TEXT,
    event_update_request JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    modified_at TIMESTAMPTZ,
    modified_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
,
    CONSTRAINT fk_event_organisation_id FOREIGN KEY (organisation_id) REFERENCES organisation(organisation_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_event_event_state_id FOREIGN KEY (event_state_id) REFERENCES event_state(event_state_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_event_event_mode_id FOREIGN KEY (event_mode_id) REFERENCES event_mode(event_mode_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create main entity tables
CREATE TABLE profile (
    profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    study_program_id UUID NOT NULL,
    profile_role_id UUID NOT NULL,
    student_id BIGINT,
    full_name TEXT,
    gender TEXT,
    enrolment_year INTEGER,
    enrolment_intake INTEGER,
    email TEXT NOT NULL,
    profile_update_request JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    modified_at TIMESTAMPTZ,
    modified_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
,
    CONSTRAINT fk_profile_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_profile_study_program_id FOREIGN KEY (study_program_id) REFERENCES study_program(study_program_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_profile_profile_role_id FOREIGN KEY (profile_role_id) REFERENCES profile_role(profile_role_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT uk_profile_email UNIQUE (email),
    CONSTRAINT uk_profile_student_id UNIQUE (student_id)
);

CREATE TABLE registration (
    registration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    profile_id UUID NOT NULL,
    registration_status_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    modified_at TIMESTAMPTZ,
    modified_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
,
    CONSTRAINT fk_registration_event_id FOREIGN KEY (event_id) REFERENCES event(event_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_registration_profile_id FOREIGN KEY (profile_id) REFERENCES profile(profile_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_registration_registration_status_id FOREIGN KEY (registration_status_id) REFERENCES registration_status(registration_status_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE attendance (
    attendance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    modified_at TIMESTAMPTZ,
    modified_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
,
    CONSTRAINT fk_attendance_registration_id FOREIGN KEY (registration_id) REFERENCES registration(registration_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE notification_log (
    notification_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL,
    notification_status_id UUID NOT NULL,
    template_id UUID NOT NULL,
    attempt_count BIGINT,
    last_attempt_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    modified_at TIMESTAMPTZ,
    modified_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
,
    CONSTRAINT fk_notification_log_registration_id FOREIGN KEY (registration_id) REFERENCES registration(registration_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_notification_log_template_id FOREIGN KEY (template_id) REFERENCES template(template_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_notification_log_notification_status_id FOREIGN KEY (notification_status_id) REFERENCES notification_status(notification_status_id) ON DELETE RESTRICT ON UPDATE CASCADE
);


CREATE TABLE organisation_member (
    organisation_member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL,
    profile_id UUID NOT NULL,
    role_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    modified_at TIMESTAMPTZ,
    modified_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID
,
    CONSTRAINT fk_organisation_member_organisation_id FOREIGN KEY (organisation_id) REFERENCES organisation(organisation_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_organisation_member_profile_id FOREIGN KEY (profile_id) REFERENCES profile(profile_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_organisation_member_role_id FOREIGN KEY (role_id) REFERENCES organisation_role(organisation_role_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Insert lookup table values
INSERT INTO study_level (study_level_id, name, description) VALUES
    (gen_random_uuid(), 'Undergraduate', 'Undergraduate level studies'),
    (gen_random_uuid(), 'Postgraduate', 'Postgraduate level studies');

INSERT INTO notification_status (notification_status_id, name, description) VALUES
    (gen_random_uuid(), 'PENDING', 'Notification is pending delivery'),
    (gen_random_uuid(), 'SENT', 'Notification has been sent successfully'),
    (gen_random_uuid(), 'FAILED', 'Notification delivery failed');


INSERT INTO event_state (event_state_id, name, description) VALUES
    (gen_random_uuid(), 'draft', 'Event is in draft state'),
    (gen_random_uuid(), 'pending', 'Event is pending approval'),
    (gen_random_uuid(), 'approved', 'Event has been approved'),
    (gen_random_uuid(), 'rejected', 'Event has been rejected'),
    (gen_random_uuid(), 'cancelled', 'Event has been cancelled');

INSERT INTO event_mode (event_mode_id, name, description) VALUES
    (gen_random_uuid(), 'physical', 'In-person event'),
    (gen_random_uuid(), 'online', 'Virtual/online event'),
    (gen_random_uuid(), 'hybrid', 'Combined physical and online event');

INSERT INTO organisation_role (organisation_role_id, name, description) VALUES
    (gen_random_uuid(), 'Member', 'Regular organisation member'),
    (gen_random_uuid(), 'Leader', 'Organisation leader with elevated permissions'),
    (gen_random_uuid(), 'Owner', 'Organisation owner with full permissions');

INSERT INTO profile_role (profile_role_id, name, description) VALUES
    (gen_random_uuid(), 'User', 'Regular system user'),
    (gen_random_uuid(), 'Admin', 'System administrator'),
    (gen_random_uuid(), 'Superadmin', 'Super administrator with full system access');

INSERT INTO registration_status (registration_status_id, name, description) VALUES
    (gen_random_uuid(), 'CONFIRMED', 'Registration has been confirmed'),
    (gen_random_uuid(), 'WAITLISTED', 'Registration is on waitlist'),
    (gen_random_uuid(), 'CANCELLED_USER', 'Registration cancelled by user'),
    (gen_random_uuid(), 'CANCELLED_ADMIN', 'Registration cancelled by admin'),
    (gen_random_uuid(), 'CANCELLED_EVENT', 'Registration cancelled due to event cancellation');

-- Insert event registration confirmation template
INSERT INTO template (template_id, name, subject, body) VALUES
    (gen_random_uuid(), 'Event Registration Confirmation', 'Registration Confirmed: {{event_name}}',
'<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Event Registration Confirmation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #003d82; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { color: #003d82; font-size: 24px; font-weight: bold; margin-bottom: 5px; }
        .tagline { color: #666; font-size: 14px; }
        .content { margin-bottom: 30px; }
        .event-details { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .detail-row { margin-bottom: 10px; }
        .detail-label { font-weight: bold; color: #003d82; }
        .qr-section { text-align: center; margin: 30px 0; padding: 20px; background-color: #e8f4fd; border-radius: 6px; }
        .qr-code { margin: 15px 0; }
        .important-note { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
        .contact-info { margin-top: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Monash University Malaysia</div>
            <div class="tagline">Student Experience Management System (SEMS)</div>
        </div>

        <div class="content">
            <h2 style="color: #003d82;">Registration Confirmation</h2>
            <p>Dear {{student_name}},</p>

            <p>We are pleased to confirm your successful registration for the following event:</p>

            <div class="event-details">
                <div class="detail-row">
                    <span class="detail-label">Event:</span> {{event_name}}
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date:</span> {{event_date}}
                </div>
                <div class="detail-row">
                    <span class="detail-label">Time:</span> {{event_time}}
                </div>
                <div class="detail-row">
                    <span class="detail-label">Venue:</span> {{event_venue}}
                </div>
                <div class="detail-row">
                    <span class="detail-label">Description:</span> {{event_description}}
                </div>
                <div class="detail-row">
                    <span class="detail-label">Registration ID:</span> {{registration_id}}
                </div>
            </div>

            <div class="qr-section">
                <h3 style="margin-top: 0; color: #003d82;">Event Check-in QR Code</h3>
                <p>Please present this QR code at the event for quick check-in:</p>
                <div class="qr-code">
                    {{qr_code}}
                </div>
                <p><small>Save this email or take a screenshot for easy access at the event</small></p>
            </div>

            {{#if note_to_registrants}}
            <div class="important-note">
                <strong>Important Information from Organizers:</strong><br>
                {{note_to_registrants}}
            </div>
            {{/if}}

            <p>If you need to cancel your registration or have any questions, please contact the event organizers or the Student Experience team.</p>

            <p>We look forward to seeing you at the event!</p>

            <p>Best regards,<br>
            <strong>Student Experience Management Team</strong><br>
            Monash University Malaysia</p>
        </div>

        <div class="footer">
            <div class="contact-info">
                <p>For technical support or inquiries about SEMS, please contact:<br>
                Email: student.experience@monash.edu | Phone: +60 3 5514 6000</p>
                <p>Monash University Malaysia | Jalan Lagoon Selatan, 47500 Bandar Sunway, Selangor</p>
            </div>
        </div>
    </div>
</body>
</html>');

-- Insert Monash University Malaysia schools
INSERT INTO study_school (study_school_id, name, description) VALUES
    (gen_random_uuid(), 'School of Arts and Social Sciences', 'Arts, communication, media, global studies, and social sciences'),
    (gen_random_uuid(), 'School of Business', 'Business, commerce, accounting, finance, economics, and management'),
    (gen_random_uuid(), 'School of Engineering', 'Engineering disciplines with hands-on training and industrial experience'),
    (gen_random_uuid(), 'School of Information Technology', 'Computer science, data science, AI, and technology innovation'),
    (gen_random_uuid(), 'Jeffrey Cheah School of Medicine and Health Sciences', 'Medicine, health sciences, psychology, and nutrition programs'),
    (gen_random_uuid(), 'School of Pharmacy', 'Pharmacy and pharmaceutical sciences programs'),
    (gen_random_uuid(), 'School of Science', 'Pure and applied sciences across multiple disciplines');

-- Insert Monash University Malaysia courses
INSERT INTO study_course (study_course_id, name, description) VALUES
    -- School of Arts and Social Sciences - Undergraduate
    (gen_random_uuid(), 'Bachelor of Arts and Social Sciences', 'Arts degree with communication, global studies majors'),
    (gen_random_uuid(), 'Bachelor of Digital Media and Communication', 'Digital media and communication technologies'),
    (gen_random_uuid(), 'Bachelor of Arts (Honours)', 'Honours degree in arts with research'),

    -- School of Arts and Social Sciences - Postgraduate
    (gen_random_uuid(), 'Master of Communications and Media Studies', 'Advanced communications and media studies'),
    (gen_random_uuid(), 'Doctor of Philosophy (Arts and Social Sciences)', 'PhD research in arts and social sciences'),

    -- School of Business - Undergraduate
    (gen_random_uuid(), 'Bachelor of Business and Commerce', 'Comprehensive business degree with specializations'),
    (gen_random_uuid(), 'Bachelor of Business and Commerce (Honours)', 'Honours business degree with research'),
    (gen_random_uuid(), 'Bachelor of Business and Commerce and Bachelor of Digital Media and Communication', 'Double degree: business and digital media'),
    (gen_random_uuid(), 'Bachelor of Business and Commerce and Bachelor of Computer Science', 'Double degree: business and computer science'),
    (gen_random_uuid(), 'Bachelor of Digital Business', 'Digital business and e-commerce'),
    (gen_random_uuid(), 'Bachelor in Actuarial Analytics', 'Actuarial science and analytics'),

    -- School of Business - Postgraduate
    (gen_random_uuid(), 'Master of Digital Business', 'Advanced digital business studies'),
    (gen_random_uuid(), 'Master of International Business', 'International business management'),
    (gen_random_uuid(), 'Doctor of Philosophy (Business)', 'PhD research in business'),

    -- School of Engineering - Undergraduate
    (gen_random_uuid(), 'Bachelor of Civil Engineering (Honours)', 'Civil engineering with honours'),
    (gen_random_uuid(), 'Bachelor of Chemical Engineering (Honours)', 'Chemical engineering with honours'),
    (gen_random_uuid(), 'Bachelor of Electrical and Computer Systems Engineering (Honours)', 'Electrical and computer systems engineering'),
    (gen_random_uuid(), 'Bachelor of Mechanical Engineering (Honours)', 'Mechanical engineering with honours'),
    (gen_random_uuid(), 'Bachelor of Robotics and Mechatronics Engineering (Honours)', 'Robotics and mechatronics engineering'),
    (gen_random_uuid(), 'Bachelor of Software Engineering (Honours)', 'Software engineering with honours'),
    (gen_random_uuid(), 'Bachelor of Materials Engineering (Honours)', 'Materials engineering with honours'),
    (gen_random_uuid(), 'Bachelor of Biomedical Engineering (Honours)', 'Biomedical engineering with honours'),

    -- School of Engineering - Postgraduate
    (gen_random_uuid(), 'Master of Applied Engineering', 'Applied engineering coursework'),
    (gen_random_uuid(), 'Master of Engineering Science', 'Engineering science research'),
    (gen_random_uuid(), 'Doctor of Philosophy (Engineering)', 'PhD research in engineering'),

    -- School of Information Technology - Undergraduate
    (gen_random_uuid(), 'Bachelor of Computer Science', 'Computer science and programming'),
    (gen_random_uuid(), 'Bachelor of Computer Science (Honours)', 'Computer science with research honours'),
    (gen_random_uuid(), 'Bachelor of Computer Science in Data Science', 'Computer science specializing in data science'),

    -- School of Information Technology - Postgraduate
    (gen_random_uuid(), 'Master of Artificial Intelligence', 'Advanced artificial intelligence studies'),
    (gen_random_uuid(), 'Master of Business Information Systems', 'Business information systems management'),
    (gen_random_uuid(), 'Master of Data Science', 'Advanced data science and analytics'),
    (gen_random_uuid(), 'Doctor of Philosophy (Information Technology)', 'PhD research in information technology'),

    -- Jeffrey Cheah School of Medicine and Health Sciences - Undergraduate
    (gen_random_uuid(), 'Bachelor of Medical Science and Doctor of Medicine', 'Combined medical degree program'),
    (gen_random_uuid(), 'Bachelor of Human Nutrition', 'Human nutrition and dietetics'),
    (gen_random_uuid(), 'Bachelor of Medical Science (Honours)', 'Medical science with research honours'),
    (gen_random_uuid(), 'Bachelor of Health Sciences (Honours)', 'Health sciences with research honours'),
    (gen_random_uuid(), 'Bachelor of Psychology', 'Psychology studies'),
    (gen_random_uuid(), 'Bachelor of Psychology and Business', 'Combined psychology and business degree'),
    (gen_random_uuid(), 'Bachelor of Psychology (Honours)', 'Psychology with research honours'),

    -- Jeffrey Cheah School of Medicine and Health Sciences - Postgraduate
    (gen_random_uuid(), 'Master of Biomedical Science', 'Advanced biomedical science'),
    (gen_random_uuid(), 'Master of Biotechnology', 'Advanced biotechnology studies'),
    (gen_random_uuid(), 'Master of Clinical Psychology', 'Professional clinical psychology'),
    (gen_random_uuid(), 'Master of Professional Counselling', 'Professional counselling practice'),
    (gen_random_uuid(), 'Doctor of Philosophy (Medicine and Health Sciences)', 'PhD research in medicine and health'),

    -- School of Pharmacy - Undergraduate
    (gen_random_uuid(), 'Bachelor of Pharmacy (Honours)', 'Pharmacy practice with honours'),
    (gen_random_uuid(), 'Bachelor of Pharmaceutical Science', 'Pharmaceutical science studies'),
    (gen_random_uuid(), 'Bachelor of Pharmaceutical Science (Honours)', 'Pharmaceutical science with research honours'),

    -- School of Pharmacy - Postgraduate
    (gen_random_uuid(), 'Master of Pharmaceutical Science', 'Advanced pharmaceutical science'),
    (gen_random_uuid(), 'Doctor of Philosophy (Pharmacy)', 'PhD research in pharmacy'),

    -- School of Science - Undergraduate
    (gen_random_uuid(), 'Bachelor of Science', 'Science degree with various specializations'),
    (gen_random_uuid(), 'Bachelor of Applied Data Science', 'Applied data science and analytics'),
    (gen_random_uuid(), 'Bachelor of Food Science and Technology', 'Food science and technology'),
    (gen_random_uuid(), 'Bachelor of Medical Bioscience', 'Medical bioscience studies'),
    (gen_random_uuid(), 'Bachelor of Science (Honours)', 'Science with research honours'),

    -- School of Science - Postgraduate
    (gen_random_uuid(), 'Master of Science', 'Advanced science research'),
    (gen_random_uuid(), 'Doctor of Philosophy (Science)', 'PhD research in science');

-- Insert study_program relationships
-- This creates the unified mapping of level + school + course for clean frontend filtering
INSERT INTO study_program (study_program_id, study_level_id, study_school_id, study_course_id, description)
SELECT
    gen_random_uuid(),
    sl.study_level_id,
    ss.study_school_id,
    sc.study_course_id,
    CONCAT(sl.name, ': ', sc.name)
FROM study_level sl, study_school ss, study_course sc
WHERE
    -- Undergraduate programs
    (sl.name = 'Undergraduate' AND (
        -- School of Arts and Social Sciences - Undergraduate
        (ss.name = 'School of Arts and Social Sciences' AND sc.name IN (
            'Bachelor of Arts and Social Sciences',
            'Bachelor of Digital Media and Communication',
            'Bachelor of Arts (Honours)'
        ))
        OR
        -- School of Business - Undergraduate
        (ss.name = 'School of Business' AND sc.name IN (
            'Bachelor of Business and Commerce',
            'Bachelor of Business and Commerce (Honours)',
            'Bachelor of Business and Commerce and Bachelor of Digital Media and Communication',
            'Bachelor of Business and Commerce and Bachelor of Computer Science',
            'Bachelor of Digital Business',
            'Bachelor in Actuarial Analytics'
        ))
        OR
        -- School of Engineering - Undergraduate
        (ss.name = 'School of Engineering' AND sc.name IN (
            'Bachelor of Civil Engineering (Honours)',
            'Bachelor of Chemical Engineering (Honours)',
            'Bachelor of Electrical and Computer Systems Engineering (Honours)',
            'Bachelor of Mechanical Engineering (Honours)',
            'Bachelor of Robotics and Mechatronics Engineering (Honours)',
            'Bachelor of Software Engineering (Honours)',
            'Bachelor of Materials Engineering (Honours)',
            'Bachelor of Biomedical Engineering (Honours)'
        ))
        OR
        -- School of Information Technology - Undergraduate
        (ss.name = 'School of Information Technology' AND sc.name IN (
            'Bachelor of Computer Science',
            'Bachelor of Computer Science (Honours)',
            'Bachelor of Computer Science in Data Science'
        ))
        OR
        -- Jeffrey Cheah School of Medicine and Health Sciences - Undergraduate
        (ss.name = 'Jeffrey Cheah School of Medicine and Health Sciences' AND sc.name IN (
            'Bachelor of Medical Science and Doctor of Medicine',
            'Bachelor of Human Nutrition',
            'Bachelor of Medical Science (Honours)',
            'Bachelor of Health Sciences (Honours)',
            'Bachelor of Psychology',
            'Bachelor of Psychology and Business',
            'Bachelor of Psychology (Honours)'
        ))
        OR
        -- School of Pharmacy - Undergraduate
        (ss.name = 'School of Pharmacy' AND sc.name IN (
            'Bachelor of Pharmacy (Honours)',
            'Bachelor of Pharmaceutical Science',
            'Bachelor of Pharmaceutical Science (Honours)'
        ))
        OR
        -- School of Science - Undergraduate
        (ss.name = 'School of Science' AND sc.name IN (
            'Bachelor of Science',
            'Bachelor of Applied Data Science',
            'Bachelor of Food Science and Technology',
            'Bachelor of Medical Bioscience',
            'Bachelor of Science (Honours)'
        ))
    ))
    OR
    -- Postgraduate programs
    (sl.name = 'Postgraduate' AND (
        -- School of Arts and Social Sciences - Postgraduate
        (ss.name = 'School of Arts and Social Sciences' AND sc.name IN (
            'Master of Communications and Media Studies',
            'Doctor of Philosophy (Arts and Social Sciences)'
        ))
        OR
        -- School of Business - Postgraduate
        (ss.name = 'School of Business' AND sc.name IN (
            'Master of Digital Business',
            'Master of International Business',
            'Doctor of Philosophy (Business)'
        ))
        OR
        -- School of Engineering - Postgraduate
        (ss.name = 'School of Engineering' AND sc.name IN (
            'Master of Applied Engineering',
            'Master of Engineering Science',
            'Doctor of Philosophy (Engineering)'
        ))
        OR
        -- School of Information Technology - Postgraduate
        (ss.name = 'School of Information Technology' AND sc.name IN (
            'Master of Artificial Intelligence',
            'Master of Business Information Systems',
            'Master of Data Science',
            'Doctor of Philosophy (Information Technology)'
        ))
        OR
        -- Jeffrey Cheah School of Medicine and Health Sciences - Postgraduate
        (ss.name = 'Jeffrey Cheah School of Medicine and Health Sciences' AND sc.name IN (
            'Master of Biomedical Science',
            'Master of Biotechnology',
            'Master of Clinical Psychology',
            'Master of Professional Counselling',
            'Doctor of Philosophy (Medicine and Health Sciences)'
        ))
        OR
        -- School of Pharmacy - Postgraduate
        (ss.name = 'School of Pharmacy' AND sc.name IN (
            'Master of Pharmaceutical Science',
            'Doctor of Philosophy (Pharmacy)'
        ))
        OR
        -- School of Science - Postgraduate
        (ss.name = 'School of Science' AND sc.name IN (
            'Master of Science',
            'Doctor of Philosophy (Science)'
        ))
    ));


-- Enable Row Level Security on all tables
ALTER TABLE profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_course ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_school ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_program ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE template ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_level ENABLE ROW LEVEL SECURITY;
ALTER TABLE event ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_mode ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_role ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_status ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ADDITIONAL CONSTRAINTS FOR DATA INTEGRITY
-- =============================================

-- Unique constraints for lookup table names to prevent duplicates
ALTER TABLE profile_role ADD CONSTRAINT uk_profile_role_name UNIQUE (name);
ALTER TABLE organisation_role ADD CONSTRAINT uk_organisation_role_name UNIQUE (name);
ALTER TABLE event_state ADD CONSTRAINT uk_event_state_name UNIQUE (name);
ALTER TABLE event_mode ADD CONSTRAINT uk_event_mode_name UNIQUE (name);
ALTER TABLE registration_status ADD CONSTRAINT uk_registration_status_name UNIQUE (name);
ALTER TABLE notification_status ADD CONSTRAINT uk_notification_status_name UNIQUE (name);
ALTER TABLE study_level ADD CONSTRAINT uk_study_level_name UNIQUE (name);

-- Prevent duplicate registrations for the same event
ALTER TABLE registration ADD CONSTRAINT uk_registration_event_profile UNIQUE (event_id, profile_id);

-- Prevent duplicate organisation membership
ALTER TABLE organisation_member ADD CONSTRAINT uk_organisation_member_org_profile UNIQUE (organisation_id, profile_id);

-- Prevent duplicate attendance records
ALTER TABLE attendance ADD CONSTRAINT uk_attendance_registration UNIQUE (registration_id);

-- Event date validation constraints
ALTER TABLE event ADD CONSTRAINT chk_event_dates CHECK (
    (start_datetime IS NULL OR end_datetime IS NULL OR start_datetime <= end_datetime) AND
    (registration_opening_datetime IS NULL OR registration_closing_datetime IS NULL OR registration_opening_datetime <= registration_closing_datetime)
);

-- Default values for created_at timestamps
ALTER TABLE profile ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE registration ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE attendance ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE event ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE organisation ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE organisation_member ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE notification_log ALTER COLUMN created_at SET DEFAULT NOW();
