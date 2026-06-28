import { checkEventPermissions } from '$lib/database';

/**
 * Authorization result for email sending permissions
 */
export interface EmailAuthResult {
	authorized: boolean;
	userId: string | null;
	error?: string;
}

/**
 * Checks if the current user has permission to send emails for a specific event.
 *
 * Authorized users:
 * - Superadmins (global access)
 * - Admins (global access)
 * - Organisation Owners (for their org's events)
 * - Organisation Leaders (for their org's events)
 *
 * @param locals - SvelteKit event.locals containing session and Supabase client
 * @param eventId - The event ID to check permissions for
 * @returns EmailAuthResult with authorization status and optional error message
 */
export async function checkEmailPermission(
	locals: App.Locals,
	eventId: string
): Promise<EmailAuthResult> {
	// 1. Check authentication
	const { session, user } = await locals.safeGetSession();

	if (!session || !user) {
		return {
			authorized: false,
			userId: null,
			error: 'Unauthorized - authentication required'
		};
	}

	// 2. Check event permissions using existing utility
	const permissions = await checkEventPermissions(locals.supabase, eventId, user.id);

	// 3. Verify user has required permissions
	// isAdmin includes both Admin and Superadmin roles
	// isOrganiser includes Organisation Owners and Leaders
	if (permissions.isAdmin || permissions.isSuperAdmin || permissions.isOrganiser) {
		return {
			authorized: true,
			userId: user.id
		};
	}

	// 4. User lacks sufficient permissions
	return {
		authorized: false,
		userId: user.id,
		error: 'Forbidden - insufficient permissions to send emails for this event'
	};
}
