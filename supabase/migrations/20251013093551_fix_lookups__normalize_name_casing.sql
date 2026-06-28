-- Normalize event_state names
UPDATE event_state SET name = 'Draft' WHERE name = 'draft';
UPDATE event_state SET name = 'Pending' WHERE name = 'pending';
UPDATE event_state SET name = 'Approved' WHERE name = 'approved';
UPDATE event_state SET name = 'Rejected' WHERE name = 'rejected';
UPDATE event_state SET name = 'Cancelled' WHERE name = 'cancelled';

-- Normalize event_mode names
UPDATE event_mode SET name = 'Physical' WHERE name = 'physical';
UPDATE event_mode SET name = 'Online' WHERE name = 'online';
UPDATE event_mode SET name = 'Hybrid' WHERE name = 'hybrid';

-- Normalize notification_status names
UPDATE notification_status SET name = 'Pending' WHERE name = 'PENDING';
UPDATE notification_status SET name = 'Sent' WHERE name = 'SENT';
UPDATE notification_status SET name = 'Failed' WHERE name = 'FAILED';

-- Normalize registration_status names
UPDATE registration_status SET name = 'Confirmed' WHERE name = 'CONFIRMED';
UPDATE registration_status SET name = 'Waitlisted' WHERE name = 'WAITLISTED';
UPDATE registration_status SET name = 'Cancelled_User' WHERE name = 'CANCELLED_USER';
UPDATE registration_status SET name = 'Cancelled_Admin' WHERE name = 'CANCELLED_ADMIN';
UPDATE registration_status SET name = 'Cancelled_Event' WHERE name = 'CANCELLED_EVENT';
