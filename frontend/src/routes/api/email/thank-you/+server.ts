import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabaseAdminClient } from '$lib/server/supabaseAdmin';
import { sendTemplatedEmail } from '$lib/email/emailService';
import { calculateNextRetryTime, shouldRetry } from '$lib/email/retryHandler';
import { checkEmailPermission } from '$lib/server/emailAuth';

/**
 * Handle bulk thank you email sending for an event
 * Sends thank you emails to all attendees of the event
 */
async function handleBulkThankYou(eventId: string, locals: App.Locals) {
	// Authorization check
	const authResult = await checkEmailPermission(locals, eventId);
	if (!authResult.authorized) {
		throw error(authResult.error?.includes('Unauthorized') ? 401 : 403, authResult.error);
	}
	// Fetch event details
	const { data: event, error: eventError } = await getSupabaseAdminClient()
		.from('event')
		.select(
			`
			event_id,
			name,
			description,
			venue,
			start_datetime,
			end_datetime,
			feedback_url,
			organisation:organisation_id (
				name
			)
		`
		)
		.eq('event_id', eventId)
		.single();

	if (eventError || !event) {
		console.error('Error fetching event:', eventError);
		throw error(404, 'Event not found');
	}

	// Fetch all registrations with attended = true
	const { data: registrations, error: regError } = await getSupabaseAdminClient()
		.from('registration')
		.select(
			`
			registration_id,
			profile:profile_id (
				profile_id,
				email,
				full_name,
				student_id
			)
		`
		)
		.eq('event_id', eventId)
		.eq('attended', true)
		.is('deleted_at', null);

	if (regError || !registrations) {
		console.error('Error fetching registrations:', regError);
		throw error(500, 'Failed to fetch registrations');
	}

	if (registrations.length === 0) {
		return json({
			success: true,
			message: 'No attendees found for this event',
			emailsSent: 0
		});
	}

	// Get notification status IDs
	const { data: sentStatus } = await getSupabaseAdminClient()
		.from('notification_status')
		.select('notification_status_id')
		.eq('name', 'Sent')
		.single();

	const { data: failedStatus } = await getSupabaseAdminClient()
		.from('notification_status')
		.select('notification_status_id')
		.eq('name', 'Failed')
		.single();

	if (!sentStatus || !failedStatus) {
		throw error(500, 'Notification statuses not found');
	}

	let totalSent = 0;
	let totalFailed = 0;
	let totalSkipped = 0;
	const results = [];

	// Process each registration
	for (const registration of registrations) {
		const profile = registration.profile;

		if (!profile?.email) {
			console.warn(`No email for registration ${registration.registration_id}`);
			totalSkipped++;
			continue;
		}

		// Check if thank you email already sent
		const { data: existingNotif } = await getSupabaseAdminClient()
			.from('notification_log')
			.select(
				'notification_log_id, notification_status:notification_status_id(name), attempt_count'
			)
			.eq('registration_id', registration.registration_id)
			.eq('template_name', 'thank-you')
			.single();

		// Skip if already sent successfully
		if (existingNotif && existingNotif.notification_status.name === 'Sent') {
			totalSkipped++;
			results.push({
				registration_id: registration.registration_id,
				email: profile.email,
				success: true,
				skipped: true,
				reason: 'Thank you email already sent'
			});
			continue;
		}

		const attemptCount = existingNotif ? existingNotif.attempt_count || 0 : 0;

		// Check if we should retry
		if (!shouldRetry(attemptCount)) {
			console.warn(`Max retries reached for registration ${registration.registration_id}`);
			totalSkipped++;
			results.push({
				registration_id: registration.registration_id,
				email: profile.email,
				success: false,
				skipped: true,
				reason: 'Maximum retry attempts reached'
			});
			continue;
		}

		// Prepare template data
		const templateData = {
			attendeeName: profile.full_name || 'Student',
			eventName: event.name,
			eventDate: event.start_datetime,
			eventVenue: event.venue,
			eventOrganiser: event.organisation.name,
			feedbackUrl: event.feedback_url
		};

		// Send thank you email
		const emailResult = await sendTemplatedEmail(
			profile.email,
			`Thank You for Attending: ${event.name}`,
			'thank-you',
			templateData
		);

		// Update or create notification log
		const notificationData = {
			notification_status_id: emailResult.success
				? sentStatus.notification_status_id
				: failedStatus.notification_status_id,
			attempt_count: attemptCount + 1,
			last_attempt_at: new Date().toISOString(),
			last_error: emailResult.error || null,
			modified_at: new Date().toISOString(),
			modified_by: profile.profile_id
		};

		if (existingNotif) {
			await getSupabaseAdminClient()
				.from('notification_log')
				.update(notificationData)
				.eq('notification_log_id', existingNotif.notification_log_id);
		} else {
			await getSupabaseAdminClient()
				.from('notification_log')
				.insert({
					registration_id: registration.registration_id,
					template_name: 'thank-you',
					created_by: profile.profile_id,
					...notificationData
				});
		}

		if (emailResult.success) {
			totalSent++;
		} else {
			totalFailed++;
		}

		results.push({
			registration_id: registration.registration_id,
			email: profile.email,
			success: emailResult.success,
			error: emailResult.error,
			skipped: false
		});

		// Add small delay to avoid rate limiting
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	return json({
		success: true,
		message: `Thank you emails processed`,
		emailsSent: totalSent,
		emailsFailed: totalFailed,
		emailsSkipped: totalSkipped,
		totalProcessed: registrations.length,
		results
	});
}

/**
 * POST /api/email/thank-you
 * Sends thank you email to attendee(s) after their attendance is marked
 * Request body: { registrationId?: string, eventId?: string }
 * If eventId is provided, sends to all attendees of the event
 * If registrationId is provided, sends to a single attendee
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Parse request body
		const { registrationId, eventId } = await request.json();

		if (!registrationId && !eventId) {
			throw error(400, 'Either Registration ID or Event ID is required');
		}

		// Bulk sending by event ID
		if (eventId) {
			return await handleBulkThankYou(eventId, locals);
		}

		// Single sending by registration ID
		if (!registrationId) {
			throw error(400, 'Registration ID is required');
		}

		// For single registration, first get the event_id to check authorization
		const { data: registrationForAuth, error: authFetchError } = await getSupabaseAdminClient()
			.from('registration')
			.select('event_id')
			.eq('registration_id', registrationId)
			.single();

		if (authFetchError || !registrationForAuth) {
			throw error(404, 'Registration not found');
		}

		// Authorization check for single registration
		const authResult = await checkEmailPermission(locals, registrationForAuth.event_id);
		if (!authResult.authorized) {
			throw error(authResult.error?.includes('Unauthorized') ? 401 : 403, authResult.error);
		}

		// Fetch registration details with related data
		const { data: registration, error: regError } = await getSupabaseAdminClient()
			.from('registration')
			.select(
				`
				registration_id,
				event_id,
				profile_id,
				attended,
				event:event_id (
					event_id,
					name,
					description,
					venue,
					start_datetime,
					end_datetime,
					feedback_url,
					organisation:organisation_id (
						name
					)
				),
				profile:profile_id (
					profile_id,
					email,
					full_name,
					student_id
				)
			`
			)
			.eq('registration_id', registrationId)
			.single();

		if (regError || !registration) {
			console.error('Error fetching registration:', regError);
			throw error(404, 'Registration not found');
		}

		// Type assertions for nested objects
		const event = registration.event;
		const profile = registration.profile;

		// Check if attendance was actually marked
		if (!registration.attended) {
			throw error(400, 'Attendance not marked for this registration');
		}

		if (!profile?.email) {
			throw error(400, 'Profile email not found');
		}

		// Check if thank you email already sent successfully
		const { data: existingNotif } = await getSupabaseAdminClient()
			.from('notification_log')
			.select(
				'notification_log_id, notification_status:notification_status_id(name), attempt_count'
			)
			.eq('registration_id', registrationId)
			.eq('template_name', 'thank-you')
			.single();

		// If already sent successfully, return early
		if (existingNotif && existingNotif.notification_status.name === 'Sent') {
			return json({
				success: true,
				message: 'Thank you email already sent',
				alreadySent: true
			});
		}

		// Get attempt count from existing notification log
		const attemptCount = existingNotif ? existingNotif.attempt_count || 0 : 0;

		// Check if we should retry
		if (!shouldRetry(attemptCount)) {
			return json({
				success: false,
				error: 'Maximum retry attempts reached'
			});
		}

		// Prepare template data
		const templateData = {
			attendeeName: profile.full_name || 'Student',
			eventName: event.name,
			eventDate: event.start_datetime,
			eventVenue: event.venue,
			eventOrganiser: event.organisation?.name,
			feedbackUrl: event.feedback_url
		};

		// Send thank you email
		const emailResult = await sendTemplatedEmail(
			profile.email,
			`Thank You for Attending: ${event.name}`,
			'thank-you',
			templateData
		);

		// Get notification status ID
		const { data: statusData } = await getSupabaseAdminClient()
			.from('notification_status')
			.select('notification_status_id')
			.eq('name', emailResult.success ? 'Sent' : 'Failed')
			.single();

		if (!statusData) {
			throw error(500, 'Notification status not found');
		}

		// Create or update notification log
		if (existingNotif) {
			// Update existing notification log
			await getSupabaseAdminClient()
				.from('notification_log')
				.update({
					notification_status_id: statusData.notification_status_id,
					attempt_count: attemptCount + 1,
					last_attempt_at: new Date().toISOString(),
					last_error: emailResult.error || null,
					modified_at: new Date().toISOString(),
					modified_by: profile.profile_id
				})
				.eq('notification_log_id', existingNotif.notification_log_id);
		} else {
			// Create new notification log
			await getSupabaseAdminClient()
				.from('notification_log')
				.insert({
					registration_id: registrationId,
					notification_status_id: statusData.notification_status_id,
					template_name: 'thank-you',
					attempt_count: 1,
					last_attempt_at: new Date().toISOString(),
					last_error: emailResult.error || null,
					created_by: profile.profile_id
				});
		}

		if (emailResult.success) {
			return json({
				success: true,
				message: 'Thank you email sent successfully',
				messageId: emailResult.messageId
			});
		} else {
			// Calculate next retry time
			const nextRetryTime = calculateNextRetryTime(attemptCount + 1);

			return json({
				success: false,
				error: emailResult.error,
				retryScheduled: shouldRetry(attemptCount + 1),
				nextRetryTime: shouldRetry(attemptCount + 1) ? nextRetryTime : null
			});
		}
	} catch (err) {
		console.error('Error in thank-you email API:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};
