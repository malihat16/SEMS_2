/**
 * Centralized constants for lookup table values
 * These match the exact values in the database to prevent case-sensitivity issues
 */

// Event States (from event_state table)
export const EVENT_STATES = {
	DRAFT: 'Draft',
	PENDING: 'Pending',
	APPROVED: 'Approved',
	REJECTED: 'Rejected',
	CANCELLED: 'Cancelled'
} as const;

// Event Modes (from event_mode table)
export const EVENT_MODES = {
	PHYSICAL: 'Physical',
	ONLINE: 'Online',
	HYBRID: 'Hybrid'
} as const;

// Profile Roles (from profile_role table)
export const PROFILE_ROLES = {
	USER: 'User',
	ADMIN: 'Admin',
	SUPERADMIN: 'Superadmin'
} as const;

// Organisation Roles (from organisation_role table)
export const ORGANISATION_ROLES = {
	MEMBER: 'Member',
	LEADER: 'Leader',
	OWNER: 'Owner'
} as const;

// Registration Statuses (from registration_status table)
export const REGISTRATION_STATUSES = {
	CONFIRMED: 'Confirmed',
	WAITLISTED: 'Waitlisted',
	CANCELLED_USER: 'Cancelled_User',
	CANCELLED_ADMIN: 'Cancelled_Admin',
	CANCELLED_EVENT: 'Cancelled_Event'
} as const;

// Notification Statuses (from notification_status table)
export const NOTIFICATION_STATUSES = {
	PENDING: 'Pending',
	SENT: 'Sent',
	FAILED: 'Failed'
} as const;

// Template Types (from template_type table)
export const TEMPLATE_TYPES = {
	REMINDER: 'Reminder',
	CERTIFICATE: 'Certificate',
	REGISTRATION_CONFIRMATION: 'Registration Confirmation'
} as const;

// TypeScript types for type safety
export type EventState = typeof EVENT_STATES[keyof typeof EVENT_STATES];
export type EventMode = typeof EVENT_MODES[keyof typeof EVENT_MODES];
export type ProfileRole = typeof PROFILE_ROLES[keyof typeof PROFILE_ROLES];
export type OrganisationRole = typeof ORGANISATION_ROLES[keyof typeof ORGANISATION_ROLES];
export type RegistrationStatus = typeof REGISTRATION_STATUSES[keyof typeof REGISTRATION_STATUSES];
export type NotificationStatus = typeof NOTIFICATION_STATUSES[keyof typeof NOTIFICATION_STATUSES];
export type TemplateType = typeof TEMPLATE_TYPES[keyof typeof TEMPLATE_TYPES];