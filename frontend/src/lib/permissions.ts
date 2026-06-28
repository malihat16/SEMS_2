import { requireProfile } from '$lib/auth';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { checkEventPermissions } from '$lib/database';
import type { OrganisationMember } from '$lib/types';

export async function checkAdminAccess(supabase: SupabaseClient<Database>): Promise<boolean> {
	try {
		const userWithProfile = await requireProfile(supabase);

		if (!userWithProfile) {
			return false; // User will be redirected to registration by requireProfile
		}

		const roleName = userWithProfile.profile?.profile_role?.name;
		if (!roleName || (roleName !== 'Admin' && roleName !== 'Superadmin')) {
			// Navigation should be handled by the component using this function
			// or by server-side hooks
			return false;
		}

		return true;
	} catch (error) {
		console.error('Error checking admin access:', error);
		return false;
	}
}

export async function checkApprovalsAccess(supabase: SupabaseClient<Database>): Promise<boolean> {
	try {
		const userWithProfile = await requireProfile(supabase);

		if (!userWithProfile) {
			return false; // User will be redirected to registration by requireProfile
		}

		const roleName = userWithProfile.profile?.profile_role?.name;
		if (!roleName || (roleName !== 'Admin' && roleName !== 'Superadmin')) {
			return false;
		}

		return true;
	} catch (error) {
		console.error('Error checking approvals access:', error);
		return false;
	}
}

export async function checkSuperAdminAccess(supabase: SupabaseClient<Database>): Promise<boolean> {
	try {
		const userWithProfile = await requireProfile(supabase);

		if (!userWithProfile) {
			return false; // User will be redirected to registration by requireProfile
		}

		const roleName = userWithProfile.profile?.profile_role?.name;
		return roleName === 'Superadmin';
	} catch (error) {
		console.error('Error checking super admin access:', error);
		return false;
	}
}

export async function checkOrganiserAccess(supabase: SupabaseClient<Database>): Promise<boolean> {
	try {
		const userWithProfile = await requireProfile(supabase);

		if (!userWithProfile) {
			return false; // User will be redirected to registration by requireProfile
		}

		// For now, allow all logged-in users to be organisers
		// Later you can check organisation membership
		return true;
	} catch (error) {
		console.error('Error checking organiser access:', error);
		return false;
	}
}

// Organisation Permission Functions

/**
 * Get user's organisation membership for a specific organisation
 */
export async function getUserOrganisationMembership(supabase: SupabaseClient<Database>, 
	profileId: string,
	organisationId: string
): Promise<OrganisationMember | null> {
	try {
		const { data, error } = await supabase
			.from('organisation_member')
			.select(
				`
				*,
				organisation_role:role_id(organisation_role_id, name, description)
			`
			)
			.eq('profile_id', profileId)
			.eq('organisation_id', organisationId)
			.is('deleted_at', null)
			.maybeSingle();

		if (error) {
			console.error('Error fetching organisation membership:', error);
			return null;
		}

		return data;
	} catch (error) {
		console.error('Error in getUserOrganisationMembership:', error);
		return null;
	}
}

/**
 * Check if user can view organisation members
 * Allowed: organisation members, leaders, owners, admins
 */
export async function canViewOrganisationMembers(supabase: SupabaseClient<Database>, organisationId: string): Promise<boolean> {
	try {
		const userWithProfile = await requireProfile(supabase);
		if (!userWithProfile?.profile?.profile_id) {
			return false;
		}

		// Check if user is admin or superadmin (global permissions)
		const globalRole = userWithProfile.profile.profile_role?.name;
		if (globalRole === 'Admin' || globalRole === 'Superadmin') {
			return true;
		}

		// Check organisation membership
		const membership = await getUserOrganisationMembership(
			supabase,
			userWithProfile.profile.profile_id,
			organisationId
		);

		// Any organisation member can view members
		return membership !== null;
	} catch (error) {
		console.error('Error checking view members permission:', error);
		return false;
	}
}

/**
 * Check if user can edit organisation details
 * Allowed: organisation owners, admins only
 */
export async function canEditOrganisation(supabase: SupabaseClient<Database>, organisationId: string): Promise<boolean> {
	try {
		const userWithProfile = await requireProfile(supabase);
		if (!userWithProfile?.profile?.profile_id) {
			return false;
		}

		// Check if user is admin or superadmin (global permissions)
		const globalRole = userWithProfile.profile.profile_role?.name;
		if (globalRole === 'Admin' || globalRole === 'Superadmin') {
			return true;
		}

		// Check organisation membership
		const membership = await getUserOrganisationMembership(
			supabase,
			userWithProfile.profile.profile_id,
			organisationId
		);

		if (!membership) {
			return false;
		}

		// Only owners can edit organisation details
		const orgRole = membership.organisation_role?.name;
		return orgRole === 'Owner';
	} catch (error) {
		console.error('Error checking edit organisation permission:', error);
		return false;
	}
}

/**
 * Check if user can manage organisation members (add/remove members)
 * Allowed: organisation leaders, owners, admins
 */
export async function canManageOrganisationMembers(supabase: SupabaseClient<Database>, organisationId: string): Promise<boolean> {
	try {
		const userWithProfile = await requireProfile(supabase);
		if (!userWithProfile?.profile?.profile_id) {
			return false;
		}

		// Check if user is admin or superadmin (global permissions)
		const globalRole = userWithProfile.profile.profile_role?.name;
		if (globalRole === 'Admin' || globalRole === 'Superadmin') {
			return true;
		}

		// Check organisation membership
		const membership = await getUserOrganisationMembership(
			supabase,
			userWithProfile.profile.profile_id,
			organisationId
		);

		if (!membership) {
			return false;
		}

		// Check if user has leader or owner role
		const orgRole = membership.organisation_role?.name;
		return orgRole === 'Leader' || orgRole === 'Owner';
	} catch (error) {
		console.error('Error checking manage members permission:', error);
		return false;
	}
}

/**
 * Check if user can edit organisation member roles
 * Allowed: organisation owners, admins only
 */
export async function canEditOrganisationMemberRoles(supabase: SupabaseClient<Database>, organisationId: string): Promise<boolean> {
	try {
		const userWithProfile = await requireProfile(supabase);
		if (!userWithProfile?.profile?.profile_id) {
			return false;
		}

		// Check if user is admin or superadmin (global permissions)
		const globalRole = userWithProfile.profile.profile_role?.name;
		if (globalRole === 'Admin' || globalRole === 'Superadmin') {
			return true;
		}

		// Check organisation membership
		const membership = await getUserOrganisationMembership(
			supabase,
			userWithProfile.profile.profile_id,
			organisationId
		);

		if (!membership) {
			return false;
		}

		// Only owners can edit member roles
		const orgRole = membership.organisation_role?.name;
		return orgRole === 'Owner';
	} catch (error) {
		console.error('Error checking edit member roles permission:', error);
		return false;
	}
}

/**
 * Check if user can create organisations
 * Allowed: admins only
 */
export async function canCreateOrganisation(supabase: SupabaseClient<Database>): Promise<boolean> {
	try {
		const userWithProfile = await requireProfile(supabase);
		if (!userWithProfile?.profile?.profile_id) {
			return false;
		}

		const globalRole = userWithProfile.profile.profile_role?.name;
		return globalRole === 'Admin' || globalRole === 'Superadmin';
	} catch (error) {
		console.error('Error checking create organisation permission:', error);
		return false;
	}
}

/**
 * Check if user can delete organisations
 * Allowed: admins only
 */
export async function canDeleteOrganisation(supabase: SupabaseClient<Database>): Promise<boolean> {
	try {
		const userWithProfile = await requireProfile(supabase);
		if (!userWithProfile?.profile?.profile_id) {
			return false;
		}

		const globalRole = userWithProfile.profile.profile_role?.name;
		return globalRole === 'Admin' || globalRole === 'Superadmin';
	} catch (error) {
		console.error('Error checking delete organisation permission:', error);
		return false;
	}
}

// Event Permission Functions

/**
 * Check if user can view event participants
 * Allowed: event organisers (organisation owners/leaders), admins, and super admins
 */
export async function canViewEventParticipants(supabase: SupabaseClient<Database>, eventId: string): Promise<boolean> {
	try {
		const userWithProfile = await requireProfile(supabase);
		if (!userWithProfile?.profile?.profile_id) {
			return false;
		}

		const profileId = userWithProfile.profile.profile_id;
		const globalRole = userWithProfile.profile.profile_role?.name;

		// Check if user is admin or super admin
		if (globalRole === 'Admin' || globalRole === 'Superadmin') {
			return true;
		}

		// Check if user is an organiser of the event (owner or leader of the organising organisation)
		const { data: event, error } = await supabase
			.from('event')
			.select(
				`
				organisation_id,
				organisation:organisation_id(
					organisation_member!inner(
						profile_id,
						organisation_role:role_id(name)
					)
				)
			`
			)
			.eq('event_id', eventId)
			.eq('organisation.organisation_member.profile_id', profileId)
			.is('organisation.organisation_member.deleted_at', null)
			.single();

		if (error || !event) {
			return false;
		}

		// Check if user has organiser role (Owner or Leader)
		const organisation = event.organisation as any;
		const membership = organisation?.organisation_member?.[0];
		const roleName = membership?.organisation_role?.name;
		return roleName === 'Owner' || roleName === 'Leader';
	} catch (error) {
		console.error('Error checking view event participants permission:', error);
		return false;
	}
}

/**
 * Check if user can manage event participants (mark attendance)
 * Allowed: event organisers (organisation owners/leaders), admins, and super admins
 */
export async function canManageEventParticipants(supabase: SupabaseClient<Database>, eventId: string): Promise<boolean> {
	try {
		const userWithProfile = await requireProfile(supabase);
		if (!userWithProfile?.profile?.profile_id) {
			return false;
		}

		const profileId = userWithProfile.profile.profile_id;
		const globalRole = userWithProfile.profile.profile_role?.name;

		// Check if user is admin or super admin
		if (globalRole === 'Admin' || globalRole === 'Superadmin') {
			return true;
		}

		// Check if user is an organiser of the event (owner or leader of the organising organisation)
		const { data: event, error } = await supabase
			.from('event')
			.select(
				`
				organisation_id,
				organisation:organisation_id(
					organisation_member!inner(
						profile_id,
						organisation_role:role_id(name)
					)
				)
			`
			)
			.eq('event_id', eventId)
			.eq('organisation.organisation_member.profile_id', profileId)
			.is('organisation.organisation_member.deleted_at', null)
			.single();

		if (error || !event) {
			return false;
		}

		// Check if user has organiser role (Owner or Leader)
		const organisation = event.organisation as any;
		const membership = organisation?.organisation_member?.[0];
		const roleName = membership?.organisation_role?.name;
		return roleName === 'Owner' || roleName === 'Leader';
	} catch (error) {
		console.error('Error checking manage event participants permission:', error);
		return false;
	}
}

/**
 * Check if user can create events
 * Requirements: Must be admin/superadmin OR have leadership role in at least one organisation
 */
export async function checkEventCreationAccess(supabase: SupabaseClient<Database>): Promise<boolean> {
	try {
		const userWithProfile = await requireProfile(supabase);
		if (!userWithProfile?.profile?.profile_id) {
			return false;
		}

		const profileId = userWithProfile.profile.profile_id;
		const globalRole = userWithProfile.profile.profile_role?.name;

		// Check if user is admin or super admin
		if (globalRole === 'Admin' || globalRole === 'Superadmin') {
			return true;
		}

		// Check if user has leadership role in any organisation
		const { data: memberships, error } = await supabase
			.from('organisation_member')
			.select(
				`
				organisation_role:role_id(name)
			`
			)
			.eq('profile_id', profileId)
			.is('deleted_at', null)
			.in('organisation_role.name', ['Owner', 'Leader']);

		if (error) {
			console.error('Error checking leadership memberships:', error);
			return false;
		}

		// User can create events if they have at least one leadership role
		return memberships && memberships.length > 0;
	} catch (error) {
		console.error('Error checking event creation access:', error);
		return false;
	}
}

/**
 * Check if user can edit a specific event
 * Requirements: Must be admin/superadmin OR have leadership role in the event's organisation
 */
export async function checkEventEditAccess(supabase: SupabaseClient<Database>, eventId: string): Promise<boolean> {
	try {
		const userWithProfile = await requireProfile(supabase);
		if (!userWithProfile?.id) {
			return false;
		}

		const permissions = await checkEventPermissions(supabase, eventId, userWithProfile.id);

		// User can edit if they are admin, super admin, or organiser of the event
		return permissions.isAdmin || permissions.isSuperAdmin || permissions.isOrganiser;
	} catch (error) {
		console.error('Error checking event edit access:', error);
		return false;
	}
}

/**
 * Check if user can access the QR scanner
 * Requirements: Must be admin/superadmin OR have leadership role in at least one organisation
 */
export async function checkScannerAccess(supabase: SupabaseClient<Database>): Promise<boolean> {
	try {
		const userWithProfile = await requireProfile(supabase);
		if (!userWithProfile?.profile?.profile_id) {
			return false;
		}

		const profileId = userWithProfile.profile.profile_id;
		const globalRole = userWithProfile.profile.profile_role?.name;

		// Check if user is admin or super admin
		if (globalRole === 'Admin' || globalRole === 'Superadmin') {
			return true;
		}

		// Check if user has leadership role in any organisation
		const { data: memberships, error } = await supabase
			.from('organisation_member')
			.select(
				`
				organisation_role:role_id(name)
			`
			)
			.eq('profile_id', profileId)
			.is('deleted_at', null);

		if (error) {
			console.error('Error checking leadership memberships:', error);
			return false;
		}

		// User can access scanner if they have at least one leadership role (Owner or Leader)
		return (
			memberships &&
			memberships.some(
				(membership: any) =>
					membership.organisation_role?.name === 'Owner' ||
					membership.organisation_role?.name === 'Leader'
			)
		);
	} catch (error) {
		console.error('Error checking scanner access:', error);
		return false;
	}
}
