<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { generateQrCodeDataUrl } from '$lib/email/qrGenerator';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle,
		DialogTrigger
	} from '$lib/components/ui/dialog/index.js';
	import RegistrationDialog from '$lib/components/registration-dialog.svelte';
	import ReviewDialog from '$lib/components/review-dialog.svelte';
	import { toast } from 'svelte-sonner';
	import {
		Calendar,
		MapPin,
		Users,
		Clock,
		ArrowLeft,
		ExternalLink,
		CalendarPlus,
		Share2,
		Building2,
		Info,
		User,
		CheckCircle2,
		AlertCircle,
		FileText,
		MessageSquare,
		Shield,
		Link,
		Edit,
		Trash2,
		XCircle,
		RefreshCw,
		QrCode,
		Eye,
		EyeOff,
		Bell,
		Mail,
		Award
	} from '@lucide/svelte';
	import {
		getEventById,
		registerForEvent,
		unregisterFromEvent,
		getUserRegistrations,
		markAttendance,
		unmarkAttendance,
		reviewEvent,
		cancelEvent,
		deleteEvent,
		checkEventPermissions,
		submitEventForApproval
	} from '$lib/database';
	import { requireProfile } from '$lib/auth';
	import type { Event, Registration } from '$lib/types';

	let { data } = $props();
	let { supabase } = $derived(data);

	// Get event ID from page params
	const eventId = $derived($page.params.id);

	// State
	let event = $state<Event | null>(null);
	let userRegistration = $state<Registration | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let currentUser = $state<any>(null);
	let isRegistered = $state(false);

	// Registration dialog state
	let showRegistrationDialog = $state(false);
	let isRegistering = $state(false);
	let registrationDialogRef: any;

	// Review dialog state
	let showReviewDialog = $state(false);
	let isReviewing = $state(false);
	let reviewDialogRef: any;

	// Event management state
	let isOrganiser = $state(false);
	let isAdmin = $state(false);
	let isSuperAdmin = $state(false);
	let isCancelling = $state(false);
	let isDeleting = $state(false);
	let isSubmittingForApproval = $state(false);

	// Confirmation dialog states
	let showCancelConfirmDialog = $state(false);
	let showDeleteConfirmDialog = $state(false);
	let cancellationNote = $state('');

	// QR Code state
	let qrCodeDataUrl = $state<string | null>(null);
	let showQrCode = $state(false);

	// Email actions state
	let showRemindersDialog = $state(false);
	let showThankYouDialog = $state(false);
	let showCertificatesDialog = $state(false);
	let isSendingReminders = $state(false);
	let isSendingThankYou = $state(false);
	let isSendingCertificates = $state(false);
	let emailActionResult = $state<{ sent: number; failed: number; skipped: number } | null>(null);

	onMount(async () => {
		await loadEventData();
	});

	async function loadEventData() {
		try {
			loading = true;
			error = null;

			// Check if eventId is valid
			if (!eventId) {
				error = 'Invalid event ID';
				return;
			}

			// Load user profile first
			currentUser = await requireProfile(supabase);

			// Load event data
			const eventData = await getEventById(supabase, eventId);
			if (!eventData) {
				error = 'Event not found';
				return;
			}

			event = eventData;

			// Check if user is registered
			if (currentUser?.profile) {
				const registrations = await getUserRegistrations(supabase, currentUser.profile.profile_id);
				const registration = registrations.find((reg) => reg.event_id === eventId);
				userRegistration = registration || null;
				isRegistered = !!registration;

				// Generate QR code if user is registered
				if (registration) {
					await generateQrCode(registration.registration_id);
				}

				// Check event permissions
				if (currentUser?.profile) {
					// Try to get user ID from different sources
					const userId = currentUser.user?.id || currentUser.id;

					if (userId) {
						const permissions = await checkEventPermissions(supabase, eventId, userId);
						isOrganiser = permissions.isOrganiser;
						isAdmin = permissions.isAdmin;
						isSuperAdmin = permissions.isSuperAdmin;
					}
				}
			}
		} catch (err) {
			console.error('Error loading event data:', err);
			error = 'Failed to load event details. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function generateQrCode(registrationId: string) {
		try {
			// Generate QR code using utility function
			qrCodeDataUrl = await generateQrCodeDataUrl(registrationId);
		} catch (error) {
			console.error('Error generating QR code:', error);
			qrCodeDataUrl = null;
		}
	}

	async function handleRegister() {
		if (!event || !currentUser?.profile) {
			toast('Please log in to register for events');
			return;
		}

		// Open registration dialog
		showRegistrationDialog = true;
	}

	async function handleRegisterSubmit() {
		if (!event || !currentUser?.profile) return;

		// Get form values from the dialog component
		const { secretCode, formCompleted } = registrationDialogRef?.getFormValues() || {};

		// Validate secret code if required
		if (event.registration_secret_code && event.registration_secret_code.trim()) {
			if (!secretCode || secretCode.trim() !== event.registration_secret_code.trim()) {
				toast('Invalid secret code. Please check and try again.');
				return;
			}
		}

		// Validate form completion if registration URL exists
		if (event.registration_url && !formCompleted) {
			toast('Please complete the registration form before proceeding.');
			return;
		}

		isRegistering = true;

		try {
			const result = await registerForEvent(supabase, event.event_id, currentUser.profile.profile_id);
			if (result.success && result.registration) {
				await loadEventData(); // Refresh data
				showRegistrationDialog = false;
				toast('Successfully registered for the event!');

				// Send registration confirmation email
				try {
					const emailResponse = await fetch('/api/email/registration', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							registrationId: result.registration.registration_id
						})
					});

					if (!emailResponse.ok) {
						console.warn('Failed to send registration email, but registration was successful');
					}
				} catch (emailError) {
					console.error('Error sending registration email:', emailError);
					// Don't show error to user - registration was successful
				}
			} else {
				switch (result.error) {
					case 'already_registered':
						toast('You are already registered for this event.');
						break;
					case 'event_full':
						toast(
							'This event has reached its maximum capacity and registration is no longer available.'
						);
						break;
					case 'event_not_found':
						toast('Event not found. Please try again.');
						break;
					default:
						toast('Failed to register. Please try again.');
				}
			}
		} catch (error) {
			console.error('Registration error:', error);
			toast('Failed to register for the event. Please try again.');
		} finally {
			isRegistering = false;
		}
	}

	async function handleUnregister() {
		if (!event || !currentUser?.profile) return;

		// Check if unregistration is allowed
		const unregisterCheck = canUnregister();
		if (!unregisterCheck.allowed) {
			toast(unregisterCheck.reason);
			return;
		}

		try {
			const success = await unregisterFromEvent(supabase, event.event_id, currentUser.profile.profile_id);
			if (success) {
				await loadEventData(); // Refresh data
				toast('Successfully unregistered from the event.');
			} else {
				toast('Failed to unregister from the event.');
			}
		} catch (error) {
			console.error('Unregistration error:', error);
			toast('Failed to unregister from the event. Please try again.');
		}
	}

	async function handleMarkAttendance() {
		if (!userRegistration) return;

		try {
			const success = await markAttendance(supabase, userRegistration.registration_id);
			if (success) {
				await loadEventData(); // Refresh data
				toast('Attendance marked successfully!');
			} else {
				toast('Failed to mark attendance. You may have already attended this event.');
			}
		} catch (error) {
			console.error('Attendance marking error:', error);
			toast('Failed to mark attendance. Please try again.');
		}
	}

	async function handleUnmarkAttendance() {
		if (!userRegistration) return;

		try {
			const success = await unmarkAttendance(supabase, userRegistration.registration_id);
			if (success) {
				await loadEventData(); // Refresh data
				toast('Attendance unmarked successfully!');
			} else {
				toast('Failed to unmark attendance. You may not have attended this event.');
			}
		} catch (error) {
			console.error('Attendance unmarking error:', error);
			toast('Failed to unmark attendance. Please try again.');
		}
	}

	function handleGiveFeedback() {
		if (event?.feedback_url) {
			try {
				let url = event.feedback_url;
				// Add https:// if the URL doesn't start with http:// or https://
				if (!url.startsWith('http://') && !url.startsWith('https://')) {
					url = 'https://' + url;
				}
				window.open(url, '_blank');
			} catch (error) {
				toast('Unable to open feedback form. Please check your popup settings.');
			}
		} else {
			toast('No feedback form available for this event.');
		}
	}

	function openRegistrationForm() {
		if (event?.registration_url) {
			try {
				let url = event.registration_url;
				// Add https:// if the URL doesn't start with http:// or https://
				if (!url.startsWith('http://') && !url.startsWith('https://')) {
					url = 'https://' + url;
				}
				window.open(url, '_blank');
			} catch (error) {
				toast('Unable to open registration form. Please check your popup settings.');
			}
		}
	}

	async function handleReviewEvent() {
		if (!event || !currentUser?.profile) {
			toast('You must be logged in to review events');
			return;
		}

		// Check if user is admin
		const roleName = currentUser.profile?.profile_role?.name;
		if (!roleName || (roleName !== 'Admin' && roleName !== 'Superadmin')) {
			toast('You do not have permission to review events');
			return;
		}

		// Open review dialog
		showReviewDialog = true;
	}

	async function handleApproveEvent(reviewData: {
		emsNumber?: string;
		emsUrl?: string;
		reviewerNotes?: string;
	}) {
		if (!event || !currentUser?.profile) return;

		isReviewing = true;

		try {
			const result = await reviewEvent(supabase, event.event_id, {
				...reviewData,
				reviewedBy: currentUser.profile.profile_id,
				approved: true
			});

			if (result.success) {
				await loadEventData(); // Refresh data
				showReviewDialog = false;
				toast('Event approved successfully!');
			} else {
				toast(result.error || 'Failed to approve event. Please try again.');
			}
		} catch (error) {
			console.error('Approval error:', error);
			toast('Failed to approve event. Please try again.');
		} finally {
			isReviewing = false;
		}
	}

	async function handleRejectEvent(reviewData: {
		emsNumber?: string;
		emsUrl?: string;
		reviewerNotes?: string;
	}) {
		if (!event || !currentUser?.profile) return;

		isReviewing = true;

		try {
			const result = await reviewEvent(supabase, event.event_id, {
				...reviewData,
				reviewedBy: currentUser.profile.profile_id,
				approved: false
			});

			if (result.success) {
				await loadEventData(); // Refresh data
				showReviewDialog = false;
				toast('Event rejected successfully.');
			} else {
				toast(result.error || 'Failed to reject event. Please try again.');
			}
		} catch (error) {
			console.error('Rejection error:', error);
			toast('Failed to reject event. Please try again.');
		} finally {
			isReviewing = false;
		}
	}

	function handleEditEvent() {
		if (!event) return;
		// Navigate to edit page with event data
		goto(`/event-create?edit=${event.event_id}`);
	}

	async function handleCancelEvent() {
		if (!event || !currentUser?.profile) return;

		isCancelling = true;

		try {
			const result = await cancelEvent(
				supabase,
				event.event_id,
				currentUser.profile.profile_id,
				cancellationNote
			);

			if (result.success) {
				await loadEventData(); // Refresh data
				showCancelConfirmDialog = false;
				cancellationNote = ''; // Reset the note
				toast('Event cancelled successfully.');
			} else {
				toast(result.error || 'Failed to cancel event. Please try again.');
			}
		} catch (error) {
			console.error('Cancel error:', error);
			toast('Failed to cancel event. Please try again.');
		} finally {
			isCancelling = false;
		}
	}

	async function handleDeleteEvent() {
		if (!event || !currentUser?.profile) return;

		isDeleting = true;

		try {
			// If event is approved, first cancel it before deletion
			if (isEventApproved()) {
				// Cancel the event first
				const cancelResult = await cancelEvent(
					supabase,
					event.event_id,
					currentUser.profile.profile_id,
					'Event cancelled and deleted by administrator.'
				);

				if (!cancelResult.success) {
					toast(cancelResult.error || 'Failed to cancel event before deletion. Please try again.');
					return;
				}
			}

			// Now delete the event
			const result = await deleteEvent(supabase, event.event_id, currentUser.profile.profile_id);

			if (result.success) {
				toast('Event deleted successfully.');
				showDeleteConfirmDialog = false;
				// Navigate back to events list
				goto('/events');
			} else {
				toast(result.error || 'Failed to delete event. Please try again.');
			}
		} catch (error) {
			console.error('Delete error:', error);
			toast('Failed to delete event. Please try again.');
		} finally {
			isDeleting = false;
		}
	}

	async function handleSubmitForApproval() {
		if (!event || !currentUser?.profile) return;

		isSubmittingForApproval = true;
		try {
			const result = await submitEventForApproval(supabase, event.event_id, currentUser.profile.profile_id);

			if (result.success) {
				toast('Event submitted for approval successfully!');
				// Reload event data to show updated state
				await loadEventData();
			} else {
				toast(result.error || 'Failed to submit event for approval. Please try again.');
			}
		} catch (error) {
			console.error('Error submitting event for approval:', error);
			toast('An error occurred while submitting the event for approval.');
		} finally {
			isSubmittingForApproval = false;
		}
	}

	async function handleSendReminders() {
		if (!event) return;

		isSendingReminders = true;
		emailActionResult = null;

		try {
			const response = await fetch('/api/email/reminder', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ eventId: event.event_id })
			});

			// Handle HTTP errors (401, 403, 404, 500, etc.)
			if (!response.ok) {
				let errorMessage = 'Failed to send reminder emails';

				try {
					// Try to parse error response
					const errorData = await response.json();
					errorMessage = errorData.error || errorData.message || errorMessage;
				} catch {
					// If JSON parsing fails, use status text
					errorMessage = response.statusText || errorMessage;
				}

				toast(errorMessage);
				return;
			}

			// Handle successful response
			const result = await response.json();

			if (result.success) {
				emailActionResult = {
					sent: result.emailsSent || 0,
					failed: result.emailsFailed || 0,
					skipped: result.emailsSkipped || 0
				};
				toast(
					`Reminder emails sent! ${result.emailsSent} sent, ${result.emailsFailed || 0} failed, ${result.emailsSkipped || 0} skipped.`
				);
			} else {
				toast(`Failed to send reminder emails: ${result.error || 'Unknown error'}`);
			}
		} catch (error) {
			console.error('Error sending reminder emails:', error);
			toast('An error occurred while sending reminder emails. Please try again.');
		} finally {
			isSendingReminders = false;
			showRemindersDialog = false;
		}
	}

	async function handleSendThankYou() {
		if (!event) return;

		isSendingThankYou = true;
		emailActionResult = null;

		try {
			const response = await fetch('/api/email/thank-you', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ eventId: event.event_id })
			});

			// Handle HTTP errors (401, 403, 404, 500, etc.)
			if (!response.ok) {
				let errorMessage = 'Failed to send thank you emails';

				try {
					// Try to parse error response
					const errorData = await response.json();
					errorMessage = errorData.error || errorData.message || errorMessage;
				} catch {
					// If JSON parsing fails, use status text
					errorMessage = response.statusText || errorMessage;
				}

				toast(errorMessage);
				return;
			}

			// Handle successful response
			const result = await response.json();

			if (result.success) {
				emailActionResult = {
					sent: result.emailsSent || 0,
					failed: result.emailsFailed || 0,
					skipped: result.emailsSkipped || 0
				};
				toast(
					`Thank you emails sent! ${result.emailsSent} sent, ${result.emailsFailed || 0} failed, ${result.emailsSkipped || 0} skipped.`
				);
			} else {
				toast(`Failed to send thank you emails: ${result.error || 'Unknown error'}`);
			}
		} catch (error) {
			console.error('Error sending thank you emails:', error);
			toast('An error occurred while sending thank you emails. Please try again.');
		} finally {
			isSendingThankYou = false;
			showThankYouDialog = false;
		}
	}

	async function handleSendCertificates() {
		if (!event) return;

		isSendingCertificates = true;
		emailActionResult = null;

		try {
			const response = await fetch('/api/email/certificate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ eventId: event.event_id })
			});

			// Handle HTTP errors (401, 403, 404, 500, etc.)
			if (!response.ok) {
				let errorMessage = 'Failed to send certificates';

				try {
					// Try to parse error response
					const errorData = await response.json();
					errorMessage = errorData.error || errorData.message || errorMessage;
				} catch {
					// If JSON parsing fails, use status text
					errorMessage = response.statusText || errorMessage;
				}

				toast(errorMessage);
				return;
			}

			// Handle successful response
			const result = await response.json();

			if (result.success) {
				emailActionResult = {
					sent: result.emailsSent || 0,
					failed: result.emailsFailed || 0,
					skipped: result.emailsSkipped || 0
				};
				toast(
					`Certificates sent! ${result.emailsSent} sent, ${result.emailsFailed || 0} failed, ${result.emailsSkipped || 0} skipped.`
				);
			} else {
				toast(`Failed to send certificates: ${result.error || 'Unknown error'}`);
			}
		} catch (error) {
			console.error('Error sending certificates:', error);
			toast('An error occurred while sending certificates. Please try again.');
		} finally {
			isSendingCertificates = false;
			showCertificatesDialog = false;
		}
	}

	function formatDate(dateString: string | null | undefined) {
		if (!dateString) return 'TBA';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function formatTime(dateString: string | null | undefined) {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: true
		});
	}

	function formatDateTime(dateString: string | null | undefined) {
		if (!dateString) return 'TBA';
		const date = formatDate(dateString);
		const time = formatTime(dateString);
		return time ? `${date} at ${time}` : date;
	}

	function getTimeUntilEvent(dateString: string | null | undefined) {
		if (!dateString) return null;
		const eventDate = new Date(dateString);
		const now = new Date();
		const diffTime = eventDate.getTime() - now.getTime();

		if (diffTime <= 0) return null; // Event has passed

		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
		const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));

		if (diffDays > 1) {
			return { value: diffDays, unit: 'days', text: `In ${diffDays} days` };
		} else if (diffDays === 1) {
			return { value: diffDays, unit: 'day', text: `In 1 day` };
		} else if (diffHours > 1) {
			return { value: diffHours, unit: 'hours', text: `In ${diffHours} hours` };
		} else if (diffHours === 1) {
			return { value: diffHours, unit: 'hour', text: `In 1 hour` };
		} else if (diffMinutes > 1) {
			return { value: diffMinutes, unit: 'minutes', text: `In ${diffMinutes} minutes` };
		} else if (diffMinutes === 1) {
			return { value: diffMinutes, unit: 'minute', text: `In 1 minute` };
		} else {
			return { value: 0, unit: 'minutes', text: 'Starting now' };
		}
	}

	function getAvailabilityStatus() {
		if (!event || event.capacity === null || event.capacity === undefined)
			return { status: 'open', text: 'Open', color: 'bg-green-100 text-green-800' };

		const registered = event.registration_count || 0;
		const capacity = event.capacity;
		const percentage = (registered / capacity) * 100;

		if (percentage >= 100 || capacity === 0) {
			return { status: 'full', text: 'Full', color: 'bg-red-100 text-red-800' };
		} else if (percentage >= 80) {
			return { status: 'almost_full', text: 'Almost Full', color: 'bg-yellow-100 text-yellow-800' };
		} else {
			return { status: 'open', text: 'Open', color: 'bg-green-100 text-green-800' };
		}
	}

	function getAttendanceStatus() {
		if (!userRegistration) return false;
		return userRegistration.attended === true;
	}

	function canUnregister() {
		if (!event) return { allowed: false, reason: 'Event not found' };

		// Cannot unregister if user has marked attendance
		if (getAttendanceStatus()) {
			return { allowed: false, reason: 'Cannot unregister after marking attendance' };
		}

		// Cannot unregister if registration period is over
		if (event.registration_closing_datetime) {
			const now = new Date();
			const closingDate = new Date(event.registration_closing_datetime);
			if (now > closingDate) {
				return { allowed: false, reason: 'Registration period has ended' };
			}
		}

		return { allowed: true, reason: '' };
	}

	function getEventStateColor(stateName: string) {
		switch (stateName.toLowerCase()) {
			case 'draft':
				return 'bg-gray-100 text-gray-800';
			case 'pending':
				return 'bg-yellow-100 text-yellow-800';
			case 'approved':
				return 'bg-green-100 text-green-800';
			case 'rejected':
				return 'bg-red-100 text-red-800';
			case 'cancelled':
				return 'bg-red-100 text-red-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function isRegistrationOpen() {
		if (!event) return false;

		const now = new Date();

		// Check opening date
		if (event.registration_opening_datetime) {
			const openingDate = new Date(event.registration_opening_datetime);
			if (now < openingDate) return false;
		}

		// Check closing date
		if (event.registration_closing_datetime) {
			const closingDate = new Date(event.registration_closing_datetime);
			if (now > closingDate) return false;
		}

		return true;
	}

	function isEventApproved() {
		return event?.event_state?.name?.toLowerCase() === 'approved';
	}

	function generateGoogleCalendarUrl() {
		if (!event) return null;

		const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';

		// Event title
		const title = event.name;

		// Event dates
		const startDate = event.start_datetime ? new Date(event.start_datetime) : null;
		const endDate = event.end_datetime ? new Date(event.end_datetime) : startDate;

		if (!startDate) return null;

		// Format dates for Google Calendar (YYYYMMDDTHHMMSSZ)
		const formatDateForGoogleCal = (date: Date) => {
			return date
				.toISOString()
				.replace(/[-:]/g, '')
				.replace(/\.\d{3}/, '');
		};

		const dates = `${formatDateForGoogleCal(startDate)}/${formatDateForGoogleCal(endDate || startDate)}`;

		// Event details
		let details = `Event: ${event.name}\n`;
		if (event.description) {
			details += `Description: ${event.description}\n`;
		}
		if (event.organisation?.name) {
			details += `Organiser: ${event.organisation.name}\n`;
		}
		if (isRegistered && event.note_to_registrants) {
			details += `Note: ${event.note_to_registrants}\n`;
		}
		details += '\nRegistered via SEMS';

		// Location
		const location = event.venue || '';

		// Build the URL
		const params = new URLSearchParams({
			text: title,
			dates: dates,
			details: details,
			location: location
		});

		return `${baseUrl}&${params.toString()}`;
	}

	function isUserAdmin() {
		if (!currentUser?.profile?.profile_role?.name) return false;
		const roleName = currentUser.profile.profile_role.name;
		return roleName === 'Admin' || roleName === 'Superadmin';
	}

	function isEventPending() {
		return event?.event_state?.name?.toLowerCase() === 'pending';
	}

	function isEventCancelled() {
		return event?.event_state?.name?.toLowerCase() === 'cancelled';
	}

	// Derived values
	const availability = $derived(getAvailabilityStatus());
	const timeUntil = $derived(getTimeUntilEvent(event?.start_datetime));
	const hasAttended = $derived(getAttendanceStatus());
	const registrationOpen = $derived(isRegistrationOpen());
	const userIsAdmin = $derived(isUserAdmin());
	const eventIsPending = $derived(isEventPending());

	// Reset registration dialog form when dialog closes
	$effect(() => {
		if (!showRegistrationDialog) {
			// Form reset is handled by the component itself
		}
	});
</script>

<svelte:head>
	{#if event}
		<title>{event.name} - SEMS</title>
		<meta
			name="description"
			content={event.description ||
				`Join ${event.name} organised by ${event.organisation?.name || 'SEMS'}. Event details, registration, and more.`}
		/>
		<meta
			name="keywords"
			content="student event, {event.name}, {event.organisation?.name || ''}, event registration"
		/>
		<meta property="og:title" content="{event.name} - SEMS" />
		<meta
			property="og:description"
			content={event.description ||
				`Join ${event.name} organised by ${event.organisation?.name || 'SEMS'}.`}
		/>
		<meta property="og:type" content="event" />
		<meta property="og:image" content="/logo.png" />
		{#if event.start_datetime}
			<meta property="event:start_time" content={event.start_datetime} />
		{/if}
		{#if event.end_datetime}
			<meta property="event:end_time" content={event.end_datetime} />
		{/if}
		{#if event.venue}
			<meta property="event:location" content={event.venue} />
		{/if}
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:title" content="{event.name} - SEMS" />
		<meta
			name="twitter:description"
			content={event.description ||
				`Join ${event.name} organised by ${event.organisation?.name || 'SEMS'}.`}
		/>
		<link rel="canonical" href="/events/{event.event_id}" />
	{:else}
		<title>Event Details - SEMS</title>
		<meta name="description" content="View event details and register for student activities." />
		<link rel="canonical" href="/events" />
	{/if}
</svelte:head>

{#if loading}
	<div class="container mx-auto max-w-6xl px-4 py-8">
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
			<span class="ml-2">Loading event details...</span>
		</div>
	</div>
{:else if error}
	<div class="container mx-auto max-w-6xl px-4 py-8">
		<Card class="py-12 text-center">
			<CardContent>
				<AlertCircle class="mx-auto mb-4 h-12 w-12 text-red-500" />
				<h2 class="mb-2 text-xl font-semibold text-gray-900">{error}</h2>
				<p class="mb-4 text-gray-600">The event you're looking for could not be found.</p>
				<Button onclick={() => history.back()}>
					<ArrowLeft class="mr-2 h-4 w-4" />
					Back to Events
				</Button>
			</CardContent>
		</Card>
	</div>
{:else if event}
	<div class="container mx-auto max-w-6xl px-4 py-8">
		<!-- Header -->
		<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="flex items-center gap-3">
				<Button variant="ghost" onclick={() => history.back()} class="px-2">
					<ArrowLeft class="h-4 w-4" />
				</Button>
				<div>
					<h1 class="text-3xl font-bold text-gray-900">{event.name}</h1>
				</div>
			</div>
			<div class="flex gap-2">
				{#if event && generateGoogleCalendarUrl()}
					<Button
						variant="outline"
						onclick={() => {
							const url = generateGoogleCalendarUrl();
							if (url) window.open(url, '_blank');
						}}
					>
						<CalendarPlus class="mr-2 h-4 w-4" />
						Add to Calendar
					</Button>
				{/if}
				<Button
					variant="outline"
					onclick={() => {
						if (event) {
							navigator.share?.({ title: event.name, url: window.location.href }) ||
								navigator.clipboard
									.writeText(window.location.href)
									.then(() => toast('Link copied to clipboard'));
						}
					}}
				>
					<Share2 class="mr-2 h-4 w-4" />
					Share
				</Button>
			</div>
		</div>

		<div class="grid gap-6 lg:grid-cols-3">
			<!-- Main Content -->
			<div class="lg:col-span-2">
				<!-- Event Description -->
				{#if event.description}
					<Card class="mb-6">
						<CardHeader>
							<div class="flex items-center justify-between">
								<CardTitle class="flex items-center gap-2">
									<Info class="h-5 w-5" />
									About This Event
								</CardTitle>
								{#if event.event_state}
									<Badge class={getEventStateColor(event.event_state.name)}>
										{event.event_state.name}
									</Badge>
								{/if}
							</div>
						</CardHeader>
						<CardContent>
							<p class="whitespace-pre-wrap text-gray-700">{event.description}</p>
						</CardContent>
					</Card>
				{/if}

				<!-- Event Details -->
				<Card class="mb-6">
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<Calendar class="h-5 w-5" />
							Event Details
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="grid gap-6 md:grid-cols-2">
							<div class="space-y-4">
								<h4 class="border-b border-gray-200 pb-2 font-medium text-gray-900">
									Event Date & Time
								</h4>
								{#if event.registration_opening_datetime || event.registration_closing_datetime}
									<div class="flex items-start gap-3">
										<Clock class="mt-0.5 h-4 w-4 text-gray-500" />
										<div>
											<div class="text-sm font-medium text-gray-900">Registration Period</div>
											<div class="space-y-1 text-sm text-gray-600">
												{#if event.registration_opening_datetime}
													<div>
														<span class="font-semibold">Opens:</span>
														{formatDateTime(event.registration_opening_datetime)}
													</div>
												{/if}
												{#if event.registration_closing_datetime}
													<div>
														<span class="font-semibold">Closes:</span>
														{formatDateTime(event.registration_closing_datetime)}
													</div>
												{/if}
											</div>
										</div>
									</div>
								{/if}
								<div class="flex items-start gap-3">
									<Calendar class="mt-0.5 h-4 w-4 text-gray-500" />
									<div>
										<div class="text-sm font-medium text-gray-900">Event Period</div>
										<div class="space-y-1 text-sm text-gray-600">
											<div>
												<span class="font-semibold">Start:</span>
												{formatDateTime(event.start_datetime)}
											</div>
											{#if event.end_datetime && event.end_datetime !== event.start_datetime}
												<div>
													<span class="font-semibold">End:</span>
													{formatDateTime(event.end_datetime)}
												</div>
											{/if}
										</div>
									</div>
								</div>
							</div>
							<div class="space-y-4">
								<h4 class="border-b border-gray-200 pb-2 font-medium text-gray-900">Event Venue</h4>
								<div class="space-y-3">
									{#if event.venue}
										<div class="flex items-start gap-3">
											<MapPin class="mt-0.5 h-4 w-4 text-gray-500" />
											<div>
												<div class="text-sm font-medium text-gray-900">Venue</div>
												<div class="text-sm text-gray-600">{event.venue}</div>
											</div>
										</div>
									{/if}
									{#if event.capacity}
										<div class="flex items-start gap-3">
											<Users class="mt-0.5 h-4 w-4 text-gray-500" />
											<div>
												<div class="text-sm font-medium text-gray-900">Capacity</div>
												<div class="text-sm text-gray-600">
													{event.registration_count || 0} / {event.capacity} registered
													<!-- {#if event.capacity && event.registration_count}
														({Math.round(((event.registration_count || 0) / event.capacity) * 100)}% full)
													{/if} -->
												</div>
											</div>
										</div>
									{/if}
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				<!-- Note to Registrants / Cancellation Notice -->
				{#if event.note_to_registrants && (isRegistered || userIsAdmin)}
					<Card
						class="mb-6 {isEventCancelled()
							? 'border-red-200 bg-red-50'
							: 'border-blue-200 bg-blue-50'}"
					>
						<CardHeader>
							<CardTitle
								class="flex items-center gap-2 {isEventCancelled()
									? 'text-red-900'
									: 'text-blue-900'}"
							>
								<MessageSquare class="h-5 w-5" />
								{isEventCancelled() ? 'Event has been cancelled' : 'Note to Registrants'}
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p
								class="whitespace-pre-wrap {isEventCancelled() ? 'text-red-800' : 'text-blue-800'}"
							>
								{event.note_to_registrants}
							</p>
						</CardContent>
					</Card>
				{/if}

				<!-- External Links -->
				{#if (event.registration_url || event.feedback_url || event.ems_url) && userIsAdmin}
					<Card class="mb-6">
						<CardHeader>
							<CardTitle class="flex items-center gap-2">
								<Link class="h-5 w-5" />
								External Links
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="space-y-3">
								{#if event.registration_url}
									<Button
										variant="outline"
										onclick={openRegistrationForm}
										class="w-full justify-start"
									>
										<ExternalLink class="mr-2 h-4 w-4" />
										Registration Form
									</Button>
								{/if}
								{#if event.feedback_url}
									<Button
										variant="outline"
										onclick={() => {
											if (event?.feedback_url) window.open(event.feedback_url, '_blank');
										}}
										class="w-full justify-start"
									>
										<ExternalLink class="mr-2 h-4 w-4" />
										Feedback Form
									</Button>
								{/if}
								{#if event.ems_url}
									<Button
										variant="outline"
										onclick={() => {
											if (event?.ems_url) window.open(event.ems_url, '_blank');
										}}
										class="w-full justify-start"
									>
										<ExternalLink class="mr-2 h-4 w-4" />
										EMS Link {event.ems_number ? `(${event.ems_number})` : ''}
									</Button>
								{/if}
							</div>
						</CardContent>
					</Card>
				{/if}
			</div>

			<!-- Sidebar -->
			<div class="space-y-6">
				<!-- Quick Info -->
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<Info class="h-5 w-5" />
							Quick Info
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="space-y-3">
							{#if timeUntil}
								<div class="flex items-center gap-3">
									<Clock class="h-4 w-4 text-gray-500" />
									<div>
										<div class="text-sm font-medium text-gray-900">Starts In</div>
										<div class="text-sm text-gray-600">{timeUntil.text}</div>
									</div>
								</div>
							{/if}
							<div class="flex items-center gap-3">
								<Calendar class="h-4 w-4 text-gray-500" />
								<div>
									<div class="text-sm font-medium text-gray-900">Event Date</div>
									<div class="text-sm text-gray-600">
										{formatDate(event.start_datetime)} @ {formatTime(event.start_datetime)}
									</div>
									<!-- {#if event.start_datetime}
										<div class="text-xs text-gray-500">{formatTime(event.start_datetime)}</div>
									{/if} -->
								</div>
							</div>
							{#if event.event_mode}
								<div class="flex items-center gap-3">
									<Users class="h-4 w-4 text-gray-500" />
									<div>
										<div class="text-sm font-medium text-gray-900">Event Mode</div>
										<div class="text-sm text-gray-600">{event.event_mode.name}</div>
									</div>
								</div>
							{/if}
							{#if event.venue}
								<div class="flex items-center gap-3">
									<MapPin class="h-4 w-4 text-gray-500" />
									<div>
										<div class="text-sm font-medium text-gray-900">Venue</div>
										<div class="text-sm text-gray-600">{event.venue}</div>
									</div>
								</div>
							{/if}
						</div>
					</CardContent>
				</Card>

				<!-- Organiser Info -->
				{#if event.organisation}
					<Card>
						<CardHeader>
							<CardTitle class="flex items-center gap-2">
								<Building2 class="h-5 w-5" />
								Organiser
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="space-y-3">
								<div>
									<div class="font-medium text-gray-900">{event.organisation.name}</div>
									{#if event.organisation.description}
										<div class="mt-1 text-sm text-gray-600">{event.organisation.description}</div>
									{/if}
								</div>
							</div>
						</CardContent>
					</Card>
				{/if}

				<!-- Actions -->
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<User class="h-5 w-5" />
							Actions
						</CardTitle>
					</CardHeader>
					<CardContent>
						{#if currentUser?.profile}
							{#if isEventApproved()}
								{#if isRegistered}
									<div class="space-y-3">
										<div class="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-blue-800">
											<CheckCircle2 class="h-4 w-4" />
											<span class="text-sm font-medium">You are registered for this event</span>
										</div>

										<!-- QR Code Section - Only show if attendance is not yet marked -->
										{#if qrCodeDataUrl && !hasAttended}
											<Card class="border-gray-200 bg-gray-50">
												<CardHeader class="pb-3">
													<CardTitle class="flex items-center justify-between text-sm">
														<div class="flex items-center gap-2">
															<QrCode class="h-4 w-4" />
															Event Check-in QR Code
														</div>
														<Button
															variant="ghost"
															size="sm"
															onclick={() => (showQrCode = !showQrCode)}
															class="h-auto p-1"
														>
															{#if showQrCode}
																<EyeOff class="h-4 w-4" />
															{:else}
																<Eye class="h-4 w-4" />
															{/if}
														</Button>
													</CardTitle>
												</CardHeader>
												<CardContent class="pt-0">
													<div class="flex items-center justify-center" style="height: 260px;">
														{#if showQrCode}
															<div class="text-center">
																<div class="mb-3 inline-block rounded-lg bg-white p-3 shadow-sm">
																	<img
																		src={qrCodeDataUrl}
																		alt="Event check-in QR code"
																		class="mx-auto block"
																		style="width: 200px; height: 200px;"
																	/>
																</div>
																<p class="text-xs text-gray-600">
																	Present this QR code at the event for quick check-in
																</p>
															</div>
														{:else}
															<div class="text-center">
																<QrCode class="mx-auto mb-2 h-8 w-8 text-gray-400" />
																<p class="text-xs text-gray-600">
																	Click the eye icon above to show your QR code
																</p>
															</div>
														{/if}
													</div>
												</CardContent>
											</Card>
										{/if}

										{#if hasAttended}
											<div
												class="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-800"
											>
												<CheckCircle2 class="h-4 w-4" />
												<span class="text-sm font-medium">Attendance marked</span>
											</div>
											{#if event.feedback_url}
												<Button onclick={handleGiveFeedback} class="w-full">
													<MessageSquare class="mr-2 h-4 w-4" />
													Give Feedback
												</Button>
											{:else}
												<div class="rounded-lg bg-gray-50 p-3">
													<span class="text-sm text-gray-600"
														>No feedback form available for this event</span
													>
												</div>
											{/if}
										{:else if isOrganiser || isAdmin || isSuperAdmin}
											<Button onclick={handleMarkAttendance} class="w-full">
												<CheckCircle2 class="mr-2 h-4 w-4" />
												Mark My Attendance
											</Button>
										{/if}
									</div>
								{:else}
									<div class="space-y-3">
										{#if !registrationOpen}
											<div class="rounded-lg bg-gray-50 p-3">
												<span class="text-sm text-gray-600">Registration is not currently open</span
												>
											</div>
										{:else if availability.status === 'full'}
											<Button disabled class="w-full">Event Full</Button>
										{:else}
											<Button onclick={handleRegister} class="w-full">
												<Users class="mr-2 h-4 w-4" />
												Register Now
											</Button>
											{#if availability.status === 'almost_full'}
												<div class="rounded-lg bg-yellow-50 p-3">
													<span class="text-sm text-yellow-800">Limited spots remaining</span>
												</div>
											{/if}
										{/if}
									</div>
								{/if}
							{:else}
								<div class="rounded-lg bg-gray-50 p-3">
									<span class="text-sm text-gray-600">
										This event is not available for registration
									</span>
								</div>
							{/if}
						{:else}
							<Button disabled class="w-full">Login to Register</Button>
						{/if}
					</CardContent>
				</Card>

				<!-- Event Management Actions -->
				{#if isOrganiser}
					<Card>
						<CardHeader>
							<CardTitle class="flex items-center gap-2">
								<Building2 class="h-5 w-5" />
								Organiser Actions
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="space-y-3">
								<!-- View Participants Button -->
								<Button
									onclick={() => goto(`/events/participants/${event?.event_id}`)}
									class="w-full"
									variant="outline"
								>
									<Users class="mr-2 h-4 w-4" />
									View Participants
								</Button>

								<!-- Edit Event Button -->
								<Button onclick={handleEditEvent} class="w-full" variant="outline">
									<Edit class="mr-2 h-4 w-4" />
									Edit Event
								</Button>

								<!-- Cancel Event Button - Only show for approved events -->
								{#if !isEventCancelled() && isEventApproved()}
									<Dialog bind:open={showCancelConfirmDialog}>
										<DialogTrigger class="w-full">
											<Button disabled={isCancelling} class="w-full" variant="destructive">
												{#if isCancelling}
													<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
													Cancelling...
												{:else}
													<XCircle class="mr-2 h-4 w-4" />
													Cancel Event
												{/if}
											</Button>
										</DialogTrigger>
										<DialogContent class="max-w-md">
											<DialogHeader>
												<DialogTitle>Cancel Event</DialogTitle>
												<DialogDescription>
													Are you sure you want to cancel this event? This action cannot be undone
													and all registered participants will be notified.
												</DialogDescription>
											</DialogHeader>
											<div class="space-y-4 py-4">
												<div class="space-y-2">
													<Label for="cancellation-note">Cancellation Message</Label>
													<Textarea
														id="cancellation-note"
														bind:value={cancellationNote}
														placeholder="Enter a message to display to registered participants explaining why the event has been cancelled..."
														rows={4}
													/>
													<p class="text-xs text-gray-500">
														This message will replace the "Note to Registrants" and be shown to all
														registered participants.
													</p>
												</div>
											</div>
											<DialogFooter>
												<Button
													variant="outline"
													onclick={() => {
														showCancelConfirmDialog = false;
														cancellationNote = '';
													}}
												>
													Cancel
												</Button>
												<Button onclick={handleCancelEvent} variant="destructive">
													Cancel Event
												</Button>
											</DialogFooter>
										</DialogContent>
									</Dialog>
								{/if}
							</div>
						</CardContent>
					</Card>
				{/if}

				{#if userIsAdmin}
					<Card>
						<CardHeader>
							<CardTitle class="flex items-center gap-2">
								<Shield class="h-5 w-5" />
								Admin Actions
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="space-y-3">
								{#if eventIsPending}
									<Button onclick={handleReviewEvent} class="w-full">
										<FileText class="mr-2 h-4 w-4" />
										Review Event
									</Button>
								{/if}

								<!-- View Participants Button -->
								<Button
									onclick={() => goto(`/events/participants/${event?.event_id}`)}
									class="w-full"
									variant="outline"
								>
									<Users class="mr-2 h-4 w-4" />
									View Participants
								</Button>

								<!-- Edit Event Button -->
								<Button onclick={handleEditEvent} class="w-full" variant="outline">
									<Edit class="mr-2 h-4 w-4" />
									Edit Event
								</Button>

								<!-- Cancel Event Button - Only show for approved events -->
								{#if !isEventCancelled() && isEventApproved()}
									<Dialog bind:open={showCancelConfirmDialog}>
										<DialogTrigger class="w-full">
											<Button disabled={isCancelling} class="w-full" variant="destructive">
												{#if isCancelling}
													<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
													Cancelling...
												{:else}
													<XCircle class="mr-2 h-4 w-4" />
													Cancel Event
												{/if}
											</Button>
										</DialogTrigger>
										<DialogContent class="max-w-md">
											<DialogHeader>
												<DialogTitle>Cancel Event</DialogTitle>
												<DialogDescription>
													Are you sure you want to cancel this event? This action cannot be undone
													and all registered participants will be notified.
												</DialogDescription>
											</DialogHeader>
											<div class="space-y-4 py-4">
												<div class="space-y-2">
													<Label for="cancellation-note-admin">Cancellation Message</Label>
													<Textarea
														id="cancellation-note-admin"
														bind:value={cancellationNote}
														placeholder="Enter a message to display to registered participants explaining why the event has been cancelled..."
														rows={4}
													/>
													<p class="text-xs text-gray-500">
														This message will replace the "Note to Registrants" and be shown to all
														registered participants.
													</p>
												</div>
											</div>
											<DialogFooter>
												<Button
													variant="outline"
													onclick={() => {
														showCancelConfirmDialog = false;
														cancellationNote = '';
													}}
												>
													Cancel
												</Button>
												<Button onclick={handleCancelEvent} variant="destructive">
													Cancel Event
												</Button>
											</DialogFooter>
										</DialogContent>
									</Dialog>
								{/if}

								<!-- Delete Event Button -->
								<Dialog bind:open={showDeleteConfirmDialog}>
									<DialogTrigger class="w-full">
										<Button disabled={isDeleting} class="w-full" variant="destructive">
											{#if isDeleting}
												<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
												Deleting...
											{:else}
												<Trash2 class="mr-2 h-4 w-4" />
												Delete Event
											{/if}
										</Button>
									</DialogTrigger>
									<DialogContent>
										<DialogHeader>
											<DialogTitle>Delete Event</DialogTitle>
											<DialogDescription>
												{#if isEventApproved()}
													Are you sure you want to delete this event? This will cancel the event and
													mark it as deleted. This action cannot be undone.
												{:else}
													Are you sure you want to delete this event? This action cannot be undone
													and will permanently remove the event and all associated data.
												{/if}
											</DialogDescription>
										</DialogHeader>
										<DialogFooter>
											<Button variant="outline" onclick={() => (showDeleteConfirmDialog = false)}>
												Cancel
											</Button>
											<Button onclick={handleDeleteEvent} variant="destructive">
												Delete Event
											</Button>
										</DialogFooter>
									</DialogContent>
								</Dialog>
							</div>
						</CardContent>
					</Card>
				{/if}

				<!-- Email Actions - For Organisers and Admins -->
				{#if (isOrganiser && isEventApproved()) || isAdmin || isSuperAdmin}
					<Card>
						<CardHeader>
							<CardTitle class="flex items-center gap-2">
								<Mail class="h-5 w-5" />
								Email Actions
							</CardTitle>
							<CardDescription>Send emails to event participants</CardDescription>
						</CardHeader>
						<CardContent>
							<div class="space-y-3">
								<!-- Send Reminders Button -->
								<Button
									onclick={() => (showRemindersDialog = true)}
									class="w-full"
									variant="outline"
									disabled={isSendingReminders}
								>
									{#if isSendingReminders}
										<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
										Sending...
									{:else}
										<Bell class="mr-2 h-4 w-4" />
										Send Reminder Emails
									{/if}
								</Button>

								<!-- Send Thank You Button -->
								<Button
									onclick={() => (showThankYouDialog = true)}
									class="w-full"
									variant="outline"
									disabled={isSendingThankYou}
								>
									{#if isSendingThankYou}
										<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
										Sending...
									{:else}
										<Mail class="mr-2 h-4 w-4" />
										Send Thank You Emails
									{/if}
								</Button>

								<!-- Send Certificates Button -->
								<Button
									onclick={() => (showCertificatesDialog = true)}
									class="w-full"
									variant="outline"
									disabled={isSendingCertificates}
								>
									{#if isSendingCertificates}
										<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
										Sending...
									{:else}
										<Award class="mr-2 h-4 w-4" />
										Send Certificates
									{/if}
								</Button>
							</div>
						</CardContent>
					</Card>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Email Action Confirmation Dialogs -->

<!-- Send Reminders Confirmation Dialog -->
<Dialog bind:open={showRemindersDialog}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Send Reminder Emails</DialogTitle>
			<DialogDescription>
				This will send reminder emails with QR codes to all registered participants for this event.
				Participants who have already received reminder emails will be skipped.
			</DialogDescription>
		</DialogHeader>
		<div class="py-4">
			<div class="rounded-lg bg-blue-50 p-4">
				<div class="flex items-start gap-3">
					<Info class="mt-0.5 h-5 w-5 text-blue-600" />
					<div class="text-sm text-blue-900">
						<p class="font-medium">Recipients:</p>
						<p>All registered participants ({event?.registration_count || 0} total)</p>
					</div>
				</div>
			</div>
		</div>
		<DialogFooter>
			<Button variant="outline" onclick={() => (showRemindersDialog = false)}>Cancel</Button>
			<Button onclick={handleSendReminders} disabled={isSendingReminders}>
				{#if isSendingReminders}
					<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
					Sending...
				{:else}
					<Bell class="mr-2 h-4 w-4" />
					Send Reminders
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<!-- Send Thank You Confirmation Dialog -->
<Dialog bind:open={showThankYouDialog}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Send Thank You Emails</DialogTitle>
			<DialogDescription>
				This will send thank you emails to all participants who attended this event. Participants
				who have already received thank you emails will be skipped.
			</DialogDescription>
		</DialogHeader>
		<div class="py-4">
			<div class="rounded-lg bg-green-50 p-4">
				<div class="flex items-start gap-3">
					<Info class="mt-0.5 h-5 w-5 text-green-600" />
					<div class="text-sm text-green-900">
						<p class="font-medium">Recipients:</p>
						<p>Participants who marked attendance</p>
					</div>
				</div>
			</div>
		</div>
		<DialogFooter>
			<Button variant="outline" onclick={() => (showThankYouDialog = false)}>Cancel</Button>
			<Button onclick={handleSendThankYou} disabled={isSendingThankYou}>
				{#if isSendingThankYou}
					<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
					Sending...
				{:else}
					<Mail class="mr-2 h-4 w-4" />
					Send Thank You
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<!-- Send Certificates Confirmation Dialog -->
<Dialog bind:open={showCertificatesDialog}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Send Certificates</DialogTitle>
			<DialogDescription>
				This will generate and send certificates to all participants who attended this event.
				Participants who have already received certificates will be skipped.
			</DialogDescription>
		</DialogHeader>
		<div class="py-4">
			<div class="rounded-lg bg-purple-50 p-4">
				<div class="flex items-start gap-3">
					<Info class="mt-0.5 h-5 w-5 text-purple-600" />
					<div class="text-sm text-purple-900">
						<p class="font-medium">Recipients:</p>
						<p>Participants who marked attendance</p>
						<p class="mt-2 text-xs">Note: Certificates will be generated as PDF attachments</p>
					</div>
				</div>
			</div>
		</div>
		<DialogFooter>
			<Button variant="outline" onclick={() => (showCertificatesDialog = false)}>Cancel</Button>
			<Button onclick={handleSendCertificates} disabled={isSendingCertificates}>
				{#if isSendingCertificates}
					<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
					Sending...
				{:else}
					<Award class="mr-2 h-4 w-4" />
					Send Certificates
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<!-- Registration Dialog -->
<RegistrationDialog
	bind:this={registrationDialogRef}
	bind:open={showRegistrationDialog}
	{event}
	{isRegistering}
	onClose={() => (showRegistrationDialog = false)}
	onRegister={handleRegisterSubmit}
	onOpenRegistrationForm={openRegistrationForm}
/>

<!-- Review Dialog -->
<ReviewDialog
	bind:this={reviewDialogRef}
	bind:open={showReviewDialog}
	{event}
	isSubmitting={isReviewing}
	onClose={() => (showReviewDialog = false)}
	onApprove={handleApproveEvent}
	onReject={handleRejectEvent}
/>
