import { getUserProfile as getDbUserProfile } from './database';
import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from './types';
import type { Database } from './database.types';

/**
 * Helper function to check if an error is related to missing auth session
 */
function isSessionMissingError(error: unknown): boolean {
	if (!error) return false;
	const message = (error as { message?: string }).message?.toLowerCase() || '';
	return (
		message.includes('auth session missing') ||
		message.includes('session missing') ||
		message.includes('no session found')
	);
}

export async function getCurrentUser(supabase: SupabaseClient<Database>): Promise<User | null> {
	const {
		data: { user }
	} = await supabase.auth.getUser();
	return user || null;
}

export async function getUserProfile(
	supabase: SupabaseClient<Database>
): Promise<(User & { profile?: Profile }) | null> {
	const user = await getCurrentUser(supabase);
	if (!user) return null;

	// Get user profile
	const profile = await getDbUserProfile(supabase, user.id);

	return {
		...user,
		profile: profile || undefined
	};
}

export async function requireProfile(
	supabase: SupabaseClient<Database>
): Promise<(User & { profile: Profile }) | null> {
	const userWithProfile = await getUserProfile(supabase);
	if (!userWithProfile) return null;

	if (!userWithProfile.profile) {
		// Profile doesn't exist, user needs to register
		if (typeof window !== 'undefined') {
			window.location.href = '/register';
		}
		return null;
	}

	return userWithProfile as User & { profile: Profile };
}

export async function signOut(supabase: SupabaseClient<Database>) {
	try {
		// First check if there's an active user
		const {
			data: { user }
		} = await supabase.auth.getUser();

		if (!user) {
			// No active user, consider logout successful
			console.log('No active user found, logout successful');
			return true;
		}

		const { error } = await supabase.auth.signOut();
		if (error) {
			// If the error is due to missing session, still consider it successful
			if (isSessionMissingError(error)) {
				console.log('Session already cleared, logout successful');
				return true;
			}
			console.error('Error signing out:', error);
			return false;
		}
		return true;
	} catch (error) {
		// Handle any other errors gracefully
		console.error('Unexpected error during sign out:', error);
		// If it's a session missing error, still consider it successful
		if (isSessionMissingError(error)) {
			return true;
		}
		// Even if there's an error, we can still redirect the user
		// as the session might be invalid anyway
		return true;
	}
}

export async function isUserAdmin(supabase: SupabaseClient<Database>): Promise<boolean> {
	const userWithProfile = await getUserProfile(supabase);
	const roleName = userWithProfile?.profile?.profile_role?.name;
	return roleName === 'Admin' || roleName === 'Superadmin';
}
