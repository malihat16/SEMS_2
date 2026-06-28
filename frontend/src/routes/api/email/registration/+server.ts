import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabaseAdminClient } from '$lib/server/supabaseAdmin';
import { sendTemplatedEmail } from '$lib/email/emailService';
import { generateQrCodeBuffer } from '$lib/email/qrGenerator';
import { calculateNextRetryTime, shouldRetry } from '$lib/email/retryHandler';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Parse request body
		const { registrationId } = await request.json();

		if (!registrationId) {
			throw error(400, 'Registration ID is required');
		}

		// Fetch registration details with related data
		const { data: registration, error: regError } = await getSupabaseAdminClient()
			.from('registration')
			.select(
				`
				registration_id,
				event_id,
				profile_id,
				event:event_id (
					event_id,
					name,
					description,
					venue,
					start_datetime,
					end_datetime,
					note_to_registrants,
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

		if (!profile?.email) {
			throw error(400, 'Profile email not found');
		}

		// Check if notification already sent successfully
		const { data: existingNotif } = await getSupabaseAdminClient()
			.from('notification_log')
			.select(
				'notification_log_id, attempt_count, notification_status:notification_status_id(name)'
			)
			.eq('registration_id', registrationId)
			.eq('template_name', 'registration')
			.single();

		// If already sent successfully, return early
		if (existingNotif && existingNotif.notification_status?.name === 'Sent') {
			return json({
				success: true,
				message: 'Registration email already sent',
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

		// Generate QR code buffer
		const qrCodeBuffer = await generateQrCodeBuffer(registrationId);
		if (!qrCodeBuffer) {
			throw error(500, 'Failed to generate QR code');
		}

		// Prepare template data
		const templateData = {
			attendeeName: profile.full_name || 'Student',
			eventName: event.name,
			eventDate: event.start_datetime,
			eventVenue: event.venue,
			eventOrganiser: event.organisation?.name,
			eventDescription: event.description,
			noteToRegistrants: event.note_to_registrants
		};

		// Send email with QR code as inline attachment (template rendered internally)
		const emailResult = await sendTemplatedEmail(
			profile.email,
			`Registration Confirmed: ${event.name}`,
			'registration',
			templateData,
			[
				{
					filename: 'qr-code.png',
					content: qrCodeBuffer,
					contentId: 'qr-code' // For inline image rendering (camelCase for Resend SDK)
				}
			]
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
					template_name: 'registration',
					attempt_count: 1,
					last_attempt_at: new Date().toISOString(),
					last_error: emailResult.error || null,
					created_by: profile.profile_id
				});
		}

		if (emailResult.success) {
			return json({
				success: true,
				message: 'Registration email sent successfully',
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
		console.error('Error in registration email API:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};
