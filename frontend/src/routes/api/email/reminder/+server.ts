import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabaseAdminClient } from '$lib/server/supabaseAdmin';
import { sendTemplatedEmail } from '$lib/email/emailService';
import { generateQrCodeBuffer } from '$lib/email/qrGenerator';
import { shouldRetry } from '$lib/email/retryHandler';
import { checkEmailPermission } from '$lib/server/emailAuth';

/**
 * POST /api/email/reminder
 * Sends reminder emails to all registrants for a specific event
 * Request body: { eventId: string }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Parse request body
		const { eventId } = await request.json().catch(() => ({}));

		if (!eventId) {
			throw error(400, 'Event ID is required');
		}

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
				note_to_registrants,
				organisation:organisation_id (
					name
				),
				event_state:event_state_id (
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

		const events = [event];

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
		const results = [];

		// Process each event
		for (const event of events) {
			// Fetch all registrations for this event
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
				.eq('event_id', event.event_id)
				.is('deleted_at', null);

			if (regError || !registrations) {
				console.error(`Error fetching registrations for event ${event.event_id}:`, regError);
				continue;
			}

			// Send reminder to each registrant
			for (const registration of registrations) {
				const profile = registration.profile;

				if (!profile?.email) {
					console.warn(`No email for registration ${registration.registration_id}`);
					continue;
				}

				// Check if reminder already sent
				const { data: existingNotif } = await getSupabaseAdminClient()
					.from('notification_log')
					.select(
						'notification_log_id, notification_status:notification_status_id(name), attempt_count'
					)
					.eq('registration_id', registration.registration_id)
					.eq('template_name', 'reminder')
					.single();

				// Skip if already sent successfully
				if (existingNotif && existingNotif.notification_status.name === 'Sent') {
					continue;
				}

				const attemptCount = existingNotif ? existingNotif.attempt_count || 0 : 0;

				// Check if we should retry
				if (!shouldRetry(attemptCount)) {
					console.warn(`Max retries reached for registration ${registration.registration_id}`);
					continue;
				}

				// Generate QR code
				const qrCodeBuffer = await generateQrCodeBuffer(registration.registration_id);
				if (!qrCodeBuffer) {
					console.error(`Failed to generate QR code for ${registration.registration_id}`);
					totalFailed++;
					continue;
				}

				// Prepare template data
				const templateData = {
					attendeeName: profile.full_name || 'Student',
					eventName: event.name,
					eventDate: event.start_datetime,
					eventVenue: event.venue,
					eventOrganiser: event.organisation.name,
					noteToRegistrants: event.note_to_registrants
				};

				// Send reminder email
				const emailResult = await sendTemplatedEmail(
					profile.email,
					`Reminder: ${event.name} is Coming Soon!`,
					'reminder',
					templateData,
					[
						{
							filename: 'qr-code.png',
							content: qrCodeBuffer,
							contentId: 'qr-code' // For inline image rendering (camelCase for Resend SDK)
						}
					]
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
							template_name: 'reminder',
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
					error: emailResult.error
				});

				// Add small delay to avoid rate limiting
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		return json({
			success: true,
			message: `Reminder emails processed`,
			eventsProcessed: events.length,
			emailsSent: totalSent,
			emailsFailed: totalFailed,
			results
		});
	} catch (err) {
		console.error('Error in reminder email API:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};
