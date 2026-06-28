/**
 * Server-side Supabase admin client
 * This module provides a Supabase client with service role privileges for server-side operations
 * IMPORTANT: Never expose this client or its methods to the client-side
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { Database } from '$lib/database.types';

let supabaseAdminClient: SupabaseClient<Database> | null = null;

export function getSupabaseAdminClient(): SupabaseClient<Database> {
	if (supabaseAdminClient) {
		return supabaseAdminClient;
	}

	const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!serviceRoleKey) {
		throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing at runtime');
	}

	supabaseAdminClient = createClient<Database>(PUBLIC_SUPABASE_URL, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	});

	return supabaseAdminClient;
}

/**
 * Get notification status ID by name
 * @param statusName - Name of the notification status (e.g., 'Sent', 'Failed', 'Pending')
 * @returns The notification status ID or null if not found
 */
export async function getNotificationStatusId(statusName: string): Promise<string | null> {
	const { data, error } = await getSupabaseAdminClient()
		.from('notification_status')
		.select('notification_status_id')
		.eq('name', statusName)
		.single();

	if (error || !data) {
		console.error(`Error fetching notification status ${statusName}:`, error);
		return null;
	}

	return data.notification_status_id;
}

/**
 * Get multiple notification status IDs by names
 * @param statusNames - Array of notification status names
 * @returns Map of status names to their IDs
 */
export async function getNotificationStatusIds(
	statusNames: string[]
): Promise<Record<string, string>> {
	const { data, error } = await getSupabaseAdminClient()
		.from('notification_status')
		.select('notification_status_id, name')
		.in('name', statusNames);

	if (error || !data) {
		console.error('Error fetching notification statuses:', error);
		return {};
	}

	return data.reduce(
		(acc, status) => {
			acc[status.name] = status.notification_status_id;
			return acc;
		},
		{} as Record<string, string>
	);
}

/**
 * Create or update a notification log entry
 * @param params - Notification log parameters
 */
export async function upsertNotificationLog(params: {
	registrationId: string;
	templateName: string;
	statusName: string;
	attemptCount: number;
	error?: string | null;
	createdBy: string;
	existingNotifId?: string;
}) {
	const statusId = await getNotificationStatusId(params.statusName);
	if (!statusId) {
		throw new Error(`Notification status ${params.statusName} not found`);
	}

	const notificationData = {
		notification_status_id: statusId,
		attempt_count: params.attemptCount,
		last_attempt_at: new Date().toISOString(),
		last_error: params.error || null,
		modified_at: new Date().toISOString(),
		modified_by: params.createdBy
	};

	if (params.existingNotifId) {
		// Update existing notification log
		const { error } = await getSupabaseAdminClient()
			.from('notification_log')
			.update(notificationData)
			.eq('notification_log_id', params.existingNotifId);

		if (error) {
			console.error('Error updating notification log:', error);
			throw error;
		}
	} else {
		// Create new notification log
		const { error } = await getSupabaseAdminClient()
			.from('notification_log')
			.insert({
				registration_id: params.registrationId,
				template_name: params.templateName,
				created_by: params.createdBy,
				...notificationData
			});

		if (error) {
			console.error('Error creating notification log:', error);
			throw error;
		}
	}
}

/**
 * Check if a notification was already sent successfully
 * @param registrationId - Registration ID
 * @param templateName - Template name (e.g., 'registration', 'reminder')
 * @returns Notification log entry if exists, null otherwise
 */
export async function checkNotificationSent(
	registrationId: string,
	templateName: string
): Promise<{
	id: string;
	statusName: string;
	attemptCount: number;
} | null> {
	const { data, error } = await getSupabaseAdminClient()
		.from('notification_log')
		.select('notification_log_id, notification_status:notification_status_id(name), attempt_count')
		.eq('registration_id', registrationId)
		.eq('template_name', templateName)
		.single();

	if (error || !data) {
		return null;
	}

	return {
		id: data.notification_log_id,
		statusName: data.notification_status?.name || 'Unknown',
		attemptCount: data.attempt_count || 0
	};
}

export default getSupabaseAdminClient;
