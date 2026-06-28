import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSupabaseAdminClient } from '$lib/server/supabaseAdmin';
import { sendTemplatedEmail } from '$lib/email/emailService';
import { generateCertificatePDF, formatCertificateDate } from '$lib/email/certificateGenerator';
import { shouldRetry } from '$lib/email/retryHandler';
import { checkEmailPermission } from '$lib/server/emailAuth';

/**
 * POST /api/email/certificate
 * Sends certificate email to attendees
 * Request body: { eventId: string, registrationIds?: string[] }
 * If registrationIds not provided, sends to ALL attendees of the event
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Parse request body
		const { eventId, registrationIds } = await request.json();

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

		// Build query for registrations
		let query = getSupabaseAdminClient()
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
			.eq('attended', true) // Only attended registrations
			.is('deleted_at', null);

		// If specific registration IDs provided, filter by them
		if (registrationIds && Array.isArray(registrationIds) && registrationIds.length > 0) {
			query = query.in('registration_id', registrationIds);
		}

		const { data: registrations, error: regError } = await query;

		if (regError || !registrations) {
			console.error('Error fetching registrations:', regError);
			throw error(500, 'Failed to fetch registrations');
		}

		if (registrations.length === 0) {
			return json({
				success: true,
				message: 'No attended registrations found for this event',
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

			// Check if certificate already sent successfully
			const { data: existingNotif } = await getSupabaseAdminClient()
				.from('notification_log')
				.select(
					'notification_log_id, notification_status:notification_status_id(name), attempt_count'
				)
				.eq('registration_id', registration.registration_id)
				.eq('template_name', 'certificate')
				.single();

			// Skip if already sent successfully
			if (existingNotif && existingNotif.notification_status.name === 'Sent') {
				totalSkipped++;
				results.push({
					registration_id: registration.registration_id,
					email: profile.email,
					success: true,
					skipped: true,
					reason: 'Certificate already sent'
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

			// Generate certificate PDF
			const certificatePDF = generateCertificatePDF({
				event: {
					name: event.name,
					date: formatCertificateDate(event.start_datetime),
					venue: event.venue || undefined,
					organiserName: event.organisation.name || undefined
				},
				attendee: {
					fullName: profile.full_name || 'Student',
					studentId: profile.student_id ? String(profile.student_id) : undefined
				}
			});

			// Prepare template data
			const templateData = {
				attendeeName: profile.full_name || 'Student',
				eventName: event.name,
				eventDate: event.start_datetime,
				eventVenue: event.venue,
				eventOrganiser: event.organisation.name
			};

			// Send certificate email with PDF attachment
			const emailResult = await sendTemplatedEmail(
				profile.email,
				`Certificate of Attendance: ${event.name}`,
				'certificate',
				templateData,
				[
					{
						filename: `${event.name.replace(/[^a-z0-9]/gi, '_')}_Certificate.pdf`,
						content: certificatePDF
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
						template_name: 'certificate',
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
			message: `Certificate emails processed`,
			emailsSent: totalSent,
			emailsFailed: totalFailed,
			emailsSkipped: totalSkipped,
			totalProcessed: registrations.length,
			results
		});
	} catch (err) {
		console.error('Error in certificate email API:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};
