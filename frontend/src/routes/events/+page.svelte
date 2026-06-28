<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import {
		Accordion,
		AccordionContent,
		AccordionItem,
		AccordionTrigger
	} from '$lib/components/ui/accordion/index.js';
	import RegistrationDialog from '$lib/components/registration-dialog.svelte';
	import EventCalendar from '$lib/components/event-calendar.svelte';
	import { toast } from 'svelte-sonner';
	import {
		Calendar,
		MapPin,
		Users,
		Clock,
		Search,
		Filter,
		RefreshCw,
		CalendarDays,
		History,
		ExternalLink,
		Eye,
		List,
		Grid3x3,
		ChevronLeft,
		ChevronRight
	} from '@lucide/svelte';
	import {
		getEvents,
		registerForEvent,
		unregisterFromEvent,
		getUserRegistrations,
		markAttendance,
		unmarkAttendance,
		checkEventPermissions
	} from '$lib/database';
	import { requireProfile } from '$lib/auth';
	import { EVENT_STATES } from '$lib/constants';
	import type { Event, Registration } from '$lib/types';

	// Get supabase client from layout
	let { data } = $props();
	let { supabase } = $derived(data);

	// State - using Svelte 5 $state()
	let allEvents = $state<Event[]>([]);
	let allRegistrations = $state<Registration[]>([]);
	let upcomingRegistrations = $state<Registration[]>([]);
	let pastRegistrations = $state<Registration[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchTerm = $state('');
	let selectedCategory = $state('');
	let filteredEvents = $state<Event[]>([]);
	let filteredUpcomingEvents = $state<Event[]>([]);
	let filteredPastEvents = $state<Event[]>([]);
	let currentUser = $state<any>(null);
	let userRegistrations = $state<string[]>([]);
	let activeTab = $state('all');
	let viewMode = $state<'list' | 'calendar'>('list'); // Toggle between list and calendar view
	let eventPermissions = $state<
		Record<string, { isOrganiser: boolean; isAdmin: boolean; isSuperAdmin: boolean }>
	>({});

	// Registration dialog state
	let showRegistrationDialog = $state(false);
	let registrationEvent: Event | null = $state(null);
	let isRegistering = $state(false);
	let registrationDialogRef: any;

	// Load data on mount
	onMount(async () => {
		await loadData();
	});

	// Reset view mode to list on mobile
	$effect(() => {
		if (typeof window !== 'undefined') {
			const checkViewport = () => {
				if (window.innerWidth < 768) {
					// md breakpoint
					viewMode = 'list';
				}
			};

			checkViewport();
			window.addEventListener('resize', checkViewport);

			return () => {
				window.removeEventListener('resize', checkViewport);
			};
		}
	});

	async function loadData() {
		try {
			loading = true;
			error = null;

			// Load user profile and require registration if needed
			currentUser = await requireProfile(supabase);
			if (!currentUser) {
				return; // User will be redirected to registration
			}

			// Load events from database - only show approved events
			const { events } = await getEvents(supabase, {
				event_state: EVENT_STATES.APPROVED,
				registerable: true
			});

			allEvents = events;
			filteredEvents = events;

			// Get user registrations
			if (currentUser?.profile) {
				const registrations = await getUserRegistrations(supabase, currentUser.profile.profile_id);
				userRegistrations = registrations.map((reg) => reg.event_id);
				allRegistrations = registrations;

				// Separate upcoming and past events based on end_datetime and event state
				const now = new Date();
				upcomingRegistrations = registrations.filter((reg) => {
					const event = reg.event;
					// If event is cancelled, move it to past regardless of date
					if (event?.event_state?.name?.toLowerCase().trim() === 'cancelled') {
						console.log(
							'Moving cancelled event to past:',
							event.name,
							'State:',
							event.event_state.name
						);
						return false;
					}
					// Use end_datetime if available, otherwise fall back to start_datetime
					const eventEndDate = event?.end_datetime || event?.start_datetime;
					return event && eventEndDate && new Date(eventEndDate) > now;
				});

				pastRegistrations = registrations.filter((reg) => {
					const event = reg.event;
					// If event is cancelled, move it to past regardless of date
					if (event?.event_state?.name?.toLowerCase().trim() === 'cancelled') {
						return true;
					}
					// Use end_datetime if available, otherwise fall back to start_datetime
					const eventEndDate = event?.end_datetime || event?.start_datetime;
					return event && eventEndDate && new Date(eventEndDate) < now;
				});

				filteredUpcomingEvents = upcomingRegistrations
					.map((reg) => reg.event)
					.filter(Boolean) as Event[];
				filteredPastEvents = pastRegistrations.map((reg) => reg.event).filter(Boolean) as Event[];

				// Check permissions for all registered events
				const userId = currentUser.user?.id || currentUser.id;
				if (userId) {
					const permissionPromises = registrations.map(async (reg) => {
						if (reg.event) {
							const permissions = await checkEventPermissions(supabase, reg.event.event_id, userId);
							return { eventId: reg.event.event_id, permissions };
						}
						return null;
					});

					const permissionResults = await Promise.all(permissionPromises);
					const permissionsMap: Record<
						string,
						{ isOrganiser: boolean; isAdmin: boolean; isSuperAdmin: boolean }
					> = {};

					permissionResults.forEach((result) => {
						if (result) {
							permissionsMap[result.eventId] = result.permissions;
						}
					});

					eventPermissions = permissionsMap;
				}
			}
		} catch (err) {
			console.error('Error loading data:', err);
			error = 'Failed to load events. Please try again.';
		} finally {
			loading = false;
		}
	}

	// Filter events based on search and category
	$effect(() => {
		// Filter all events
		filteredEvents = allEvents.filter((event) => {
			const matchesSearch =
				event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				event.organisation?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				event.venue?.toLowerCase().includes(searchTerm.toLowerCase());

			const matchesCategory = !selectedCategory || event.organisation?.name === selectedCategory;

			return matchesSearch && matchesCategory;
		});

		// Filter upcoming events
		const upcomingEventsToFilter = upcomingRegistrations
			.map((reg) => reg.event)
			.filter(Boolean) as Event[];
		filteredUpcomingEvents = upcomingEventsToFilter.filter((event) => {
			const matchesSearch =
				event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				event.organisation?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				event.venue?.toLowerCase().includes(searchTerm.toLowerCase());

			const matchesCategory = !selectedCategory || event.organisation?.name === selectedCategory;

			return matchesSearch && matchesCategory;
		});

		// Filter past events
		const pastEventsToFilter = pastRegistrations.map((reg) => reg.event).filter(Boolean) as Event[];
		filteredPastEvents = pastEventsToFilter.filter((event) => {
			const matchesSearch =
				event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				event.organisation?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				event.venue?.toLowerCase().includes(searchTerm.toLowerCase());

			const matchesCategory = !selectedCategory || event.organisation?.name === selectedCategory;

			return matchesSearch && matchesCategory;
		});
	});

	async function handleRegister(eventId: string) {
		if (!currentUser?.profile) {
			toast('Please log in to register for events');
			return;
		}

		// Find the event and open the registration dialog
		const event = allEvents.find((e) => e.event_id === eventId);
		if (event) {
			registrationEvent = event;
			showRegistrationDialog = true;
		}
	}

	async function handleRegisterSubmit() {
		if (!registrationEvent || !currentUser?.profile) return;

		// Get form values from the dialog component
		const { secretCode, formCompleted } = registrationDialogRef?.getFormValues() || {};

		// Validate secret code if required
		if (
			registrationEvent.registration_secret_code &&
			registrationEvent.registration_secret_code.trim()
		) {
			if (!secretCode || secretCode.trim() !== registrationEvent.registration_secret_code.trim()) {
				toast('Invalid secret code. Please check and try again.');
				return;
			}
		}

		// Validate form completion if registration URL exists
		if (registrationEvent.registration_url && !formCompleted) {
			toast('Please complete the registration form before proceeding.');
			return;
		}

		isRegistering = true;

		try {
			const result = await registerForEvent(
				supabase,
				registrationEvent.event_id,
				currentUser.profile.profile_id
			);
			if (result.success && result.registration) {
				userRegistrations = [...userRegistrations, registrationEvent.event_id];
				// Refresh the events to get updated registration count
				await loadData();
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

	async function handleUnregister(eventId: string) {
		if (!currentUser?.profile) return;

		// Find the event and registration to check if unregistration is allowed
		const event = allEvents.find((e) => e.event_id === eventId);
		const registration = getRegistrationDetails(eventId);

		if (event) {
			const unregisterCheck = canUnregister(event, registration);
			if (!unregisterCheck.allowed) {
				toast(unregisterCheck.reason);
				return;
			}
		}

		try {
			const success = await unregisterFromEvent(supabase, eventId, currentUser.profile.profile_id);
			if (success) {
				userRegistrations = userRegistrations.filter((id) => id !== eventId);
				await loadData();
				toast('Successfully unregistered from the event.');
			} else {
				toast('Failed to unregister from the event.');
			}
		} catch (error) {
			console.error('Unregistration error:', error);
			toast('Failed to unregister from the event. Please try again.');
		}
	}

	async function handleMarkAttendance(registrationId: string) {
		try {
			const success = await markAttendance(supabase, registrationId);
			if (success) {
				await loadData(); // Reload data to update attendance status
				toast('Attendance marked successfully!');
			} else {
				toast('Failed to mark attendance. You may have already attended this event.');
			}
		} catch (error) {
			console.error('Attendance marking error:', error);
			toast('Failed to mark attendance. Please try again.');
		}
	}

	async function handleUnmarkAttendance(registrationId: string) {
		try {
			const success = await unmarkAttendance(supabase, registrationId);
			if (success) {
				await loadData(); // Reload data to update attendance status
				toast('Attendance unmarked successfully!');
			} else {
				toast('Failed to unmark attendance. You may not have attended this event.');
			}
		} catch (error) {
			console.error('Attendance unmarking error:', error);
			toast('Failed to unmark attendance. Please try again.');
		}
	}

	function openRegistrationForm() {
		if (registrationEvent?.registration_url) {
			try {
				let url = registrationEvent.registration_url;
				if (url) {
					// Add https:// if the URL doesn't start with http:// or https://
					if (!url.startsWith('http://') && !url.startsWith('https://')) {
						url = 'https://' + url;
					}
					window.open(url, '_blank');
				}
			} catch (error) {
				toast('Unable to open registration form. Please check your popup settings.');
			}
		}
	}

	// Reset registration dialog form when dialog closes
	$effect(() => {
		if (!showRegistrationDialog) {
			registrationEvent = null;
		}
	});

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
			return { value: 0, unit: 'minutes', text: 'Starting' };
		}
	}

	function getDaysAgo(dateString: string | null | undefined) {
		if (!dateString) return null;
		const eventDate = new Date(dateString);
		const now = new Date();
		const diffTime = now.getTime() - eventDate.getTime();
		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
		return diffDays;
	}

	function getRegistrationDetails(eventId: string) {
		const registration = allRegistrations.find((reg) => reg.event?.event_id === eventId);
		return registration;
	}

	function getAvailabilityStatus(event: Event) {
		if (event.capacity === null || event.capacity === undefined)
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

	function getAttendanceStatus(registration: Registration | null | undefined) {
		if (!registration) return false;

		return registration.attended === true;
	}

	function canUnregister(event: Event, registration?: Registration | null) {
		// Cannot unregister if user has marked attendance
		if (registration && getAttendanceStatus(registration)) {
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

	function generateGoogleCalendarUrl(event: Event, isRegistered: boolean = false) {
		const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';

		// Event title - no need to encode, URLSearchParams will handle it
		const title = event.name;

		// Event dates - convert to UTC format for Google Calendar
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

		// Location - no need to encode, URLSearchParams will handle it
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

	// Get unique organisations for filtering - combine all event sources
	const organisations = $derived([
		...new Set(
			[
				...allEvents.map((event) => event.organisation?.name),
				...filteredUpcomingEvents.map((event) => event.organisation?.name),
				...filteredPastEvents.map((event) => event.organisation?.name)
			].filter(Boolean)
		)
	]);

	// Derived content for select trigger
	const categoryContent = $derived(selectedCategory || 'All Organisations');

	// Sort past events by date (most recent first)
	const sortedFilteredPastEvents = $derived(
		[...filteredPastEvents].sort((a, b) => {
			const dateA = a.start_datetime ? new Date(a.start_datetime).getTime() : 0;
			const dateB = b.start_datetime ? new Date(b.start_datetime).getTime() : 0;
			return dateB - dateA; // Most recent first
		})
	);
</script>

<svelte:head>
	<title>Events - SEMS</title>
	<meta
		name="description"
		content="Discover and register for exciting student events. Browse upcoming activities, workshops, and social gatherings on campus."
	/>
	<meta
		name="keywords"
		content="student events, campus activities, event registration, university events, workshops, social events"
	/>
	<meta property="og:title" content="Events - SEMS" />
	<meta
		property="og:description"
		content="Discover and register for exciting student events. Browse upcoming activities, workshops, and social gatherings on campus."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:image" content="/logo.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Events - SEMS" />
	<meta
		name="twitter:description"
		content="Discover and register for exciting student events. Browse upcoming activities, workshops, and social gatherings on campus."
	/>
	<meta name="twitter:image" content="/logo.png" />
	<link rel="canonical" href="/events" />
</svelte:head>

{#snippet eventAccordionContent(
	event: Event,
	context: 'all' | 'upcoming' | 'past',
	registration?: Registration | null
)}
	{@const availability = getAvailabilityStatus(event)}
	{@const isRegistered = userRegistrations.includes(event.event_id)}
	{@const timeUntil = getTimeUntilEvent(event.start_datetime)}
	{@const daysAgo = getDaysAgo(event.start_datetime)}

	<div class="space-y-6 border-t border-gray-100 pt-4">
		<!-- Event Details Section -->
		<div class="grid gap-6 md:grid-cols-2">
			<div class="space-y-4">
				<h4 class="border-b border-gray-200 pb-2 font-medium text-gray-900">Event Information</h4>
				<div class="space-y-3">
					<div>
						<div class="mb-1 text-sm font-medium text-gray-900">Status & Mode</div>
						<div class="flex flex-wrap gap-2">
							{#if context === 'all' && !isRegistered}
								<Badge class={availability.color}>{availability.text}</Badge>
							{/if}
							<Badge variant="outline">{event.event_mode?.name || 'TBA'}</Badge>
							{#if isRegistered}
								<Badge class="bg-blue-100 text-blue-800">Registered</Badge>
								{@const currentRegistration = getRegistrationDetails(event.event_id)}
								{@const hasAttended = getAttendanceStatus(currentRegistration)}
								{#if hasAttended}
									<Badge class="bg-green-100 text-green-800">Attended</Badge>
								{/if}
							{/if}
						</div>
					</div>
					{#if event.description}
						<div>
							<div class="mb-1 text-sm font-medium text-gray-900">Description</div>
							<p class="text-sm leading-relaxed text-gray-600">{event.description}</p>
						</div>
					{/if}
					<div class="flex items-start gap-3">
						<div>
							<div class="text-sm font-medium text-gray-900">Organiser</div>
							<div class="text-sm text-gray-600">{event.organisation?.name || 'Unknown'}</div>
						</div>
					</div>
				</div>
			</div>
			<div class="space-y-4">
				<h4 class="border-b border-gray-200 pb-2 font-medium text-gray-900">Event Details</h4>
				<div class="space-y-3">
					{#if event.registration_opening_datetime || event.registration_closing_datetime}
						<div class="flex items-start gap-3">
							<Calendar class="mt-0.5 h-4 w-4 text-gray-500" />
							<div>
								<div class="text-sm font-medium text-gray-900">Registration Period</div>
								<div class="space-y-1 text-sm text-gray-600">
									<div>
										<span class="font-semibold">Start:</span>
										{formatDate(
											event.registration_opening_datetime
										)}{#if event.registration_opening_datetime}
											<span class="pl-1">at</span>
											{formatTime(event.registration_opening_datetime)}{/if}
									</div>
									<div>
										<span class="font-semibold">End:</span>
										{formatDate(
											event.registration_closing_datetime
										)}{#if event.registration_closing_datetime}
											<span class="pl-1">at</span>
											{formatTime(event.registration_closing_datetime)}{/if}
									</div>
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
									{formatDate(event.start_datetime)}{#if event.start_datetime}
										<span class="pl-1">at</span> {formatTime(event.start_datetime)}{/if}
								</div>
								{#if event.end_datetime && event.end_datetime !== event.start_datetime}
									<div>
										<span class="font-semibold">End:</span>
										{formatDate(event.end_datetime)}{#if event.end_datetime}
											<span class="pl-1">at</span> {formatTime(event.end_datetime)}{/if}
									</div>
								{/if}
							</div>
						</div>
					</div>
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
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>

		{#if context === 'past' && event.event_state?.name?.toLowerCase().trim() === 'cancelled'}
			<div class="rounded-lg border border-red-200 bg-red-50 p-4">
				<h5 class="mb-2 font-medium text-red-900">Event has been cancelled</h5>
				{#if event.note_to_registrants}
					<p class="text-sm text-red-800">{event.note_to_registrants}</p>
				{/if}
			</div>
		{:else if event.note_to_registrants && (context === 'upcoming' || context === 'past')}
			<div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
				<h5 class="mb-2 font-medium text-blue-900">Note to Registrants</h5>
				<p class="text-sm text-blue-800">{event.note_to_registrants}</p>
			</div>
		{/if}

		<!-- Registration Actions -->
		<div class="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row">
			<div class="flex flex-col gap-3 sm:flex-1 sm:flex-row">
				{#if context === 'all'}
					{#if currentUser?.profile}
						{#if isRegistered}
							<!-- <Button 
								variant="outline"
								class="flex items-center gap-2"
								onclick={() => handleUnregister(event.event_id)}
							>
								Unregister
							</Button> -->
							<div
								class="flex items-center gap-1 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800"
							>
								<span class="mr-1 h-2 w-2 rounded-full bg-blue-500"></span>
								You are registered for this event
							</div>
						{:else}
							<Button
								disabled={availability.status === 'full'}
								class="flex items-center gap-2"
								onclick={() => handleRegister(event.event_id)}
							>
								<Users class="h-4 w-4" />
								{availability.status === 'full' ? 'Event Full' : 'Register Now'}
							</Button>
							{#if availability.status === 'almost_full'}
								<div
									class="flex items-center gap-1 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-600"
								>
									Limited spots remaining
								</div>
							{/if}
						{/if}
					{:else}
						<Button disabled class="flex items-center gap-2">
							<Users class="h-4 w-4" />
							Login to Register
						</Button>
					{/if}
				{:else if context === 'upcoming'}
					{@const hasAttended = getAttendanceStatus(registration)}
					{@const unregisterCheck = canUnregister(event, registration)}
					{@const permissions = eventPermissions[event.event_id]}
					{#if !hasAttended && permissions && (permissions.isOrganiser || permissions.isAdmin || permissions.isSuperAdmin)}
						<Button
							onclick={() => handleMarkAttendance(registration?.registration_id || '')}
							class="flex items-center gap-2"
						>
							<Users class="h-4 w-4" />
							Mark Attendance
						</Button>
					{:else if hasAttended}
						<!-- <Button
							variant="outline"
							onclick={() => handleUnmarkAttendance(registration?.registration_id || '')}
							class="flex items-center gap-2"
						>
							<Users class="h-4 w-4" />
							Unmark Attendance
						</Button> -->
						<div
							class="flex items-center gap-1 rounded-md bg-green-50 px-3 py-2 text-sm text-green-600"
						>
							<span class="mr-1 h-2 w-2 rounded-full bg-green-500"></span>
							You are marked as attended for this event
						</div>
					{/if}
					{#if unregisterCheck.allowed}
						<!-- <Button
							variant="outline"
							class="flex items-center gap-2"
							onclick={() => handleUnregister(event.event_id)}
						>
							Unregister
						</Button> -->
					{:else}
						<!-- <div
							class="flex items-center gap-1 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600"
							title={unregisterCheck.reason}
						>
							<span class="h-2 w-2 rounded-full bg-gray-400 mr-1"></span>
							{unregisterCheck.reason}
						</div> -->
					{/if}
					{@const calendarUrl = generateGoogleCalendarUrl(event, true)}
					{#if calendarUrl}
						<Button
							variant="outline"
							class="flex items-center gap-2"
							onclick={() => window.open(calendarUrl, '_blank')}
						>
							<Calendar class="h-4 w-4" />
							Add to Google Calendar
						</Button>
					{/if}
				{:else if context === 'past'}
					{@const hasAttended = getAttendanceStatus(registration)}
					{@const permissions = eventPermissions[event.event_id]}
					{#if !hasAttended && permissions && (permissions.isOrganiser || permissions.isAdmin || permissions.isSuperAdmin)}
						<!-- <Button
							onclick={() => handleMarkAttendance(registration?.registration_id || '')}
							class="flex items-center gap-2"
						>
							<Users class="h-4 w-4" />
							Mark Attendance
						</Button> -->
					{/if}
					{#if hasAttended}
						<!-- <Button
							variant="outline"
							onclick={() => handleUnmarkAttendance(registration?.registration_id || '')}
							class="flex items-center gap-2"
						>
							<Users class="h-4 w-4" />
							Unmark Attendance
						</Button> -->
						<div
							class="flex items-center gap-1 rounded-md bg-green-50 px-3 py-2 text-sm text-green-600"
						>
							<span class="mr-1 h-2 w-2 rounded-full bg-green-500"></span>
							You are marked as attended for this event
						</div>
						{#if event.feedback_url}
							<Button
								variant="outline"
								onclick={() => {
									let url = event.feedback_url;
									if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
										url = 'https://' + url;
									}
									if (url) {
										window.open(url, '_blank');
									}
								}}
								class="flex items-center gap-2"
							>
								<ExternalLink class="h-4 w-4" />
								Provide Feedback
							</Button>
						{/if}
					{/if}
					<!-- {#if event.feedback_url}
						<Button
							variant="outline"
							onclick={() => {
								let url = event.feedback_url;
								if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
									url = 'https://' + url;
								}
								if (url) {
									window.open(url, '_blank');
								}
							}}
							class="flex items-center gap-2"
						>
							<ExternalLink class="h-4 w-4" />
							Provide Feedback
						</Button>
					{/if} -->
				{/if}
			</div>

			<!-- View Details Button - always shown -->
			<Button
				variant="outline"
				onclick={() => goto(`/events/${event.event_id}`)}
				class="flex items-center gap-2"
			>
				<Eye class="h-4 w-4" />
				View Event Page
			</Button>
		</div>
	</div>
{/snippet}

<div class="container mx-auto max-w-7xl px-4 py-8">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
		<div>
			<h1 class="text-3xl font-bold text-gray-900">Events</h1>
			<p class="mt-2 text-gray-600">Explore all available events and manage your registrations.</p>
		</div>
		<div class="flex gap-2 sm:flex-shrink-0">
			<Button
				variant="outline"
				onclick={loadData}
				disabled={loading}
				class="flex-1 sm:w-auto sm:flex-initial"
			>
				{#if loading}
					<div class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-gray-900"></div>
				{:else}
					<RefreshCw class="mr-2 h-4 w-4" />
				{/if}
				Refresh
			</Button>
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
			<span class="ml-2">Loading events...</span>
		</div>
	{:else if error}
		<Card class="py-12 text-center">
			<CardContent>
				<div class="mb-4 text-red-500">⚠️</div>
				<CardTitle class="mb-2 text-xl text-red-600">Error Loading Events</CardTitle>
				<CardDescription class="mb-4">{error}</CardDescription>
				<Button onclick={loadData}>Try Again</Button>
			</CardContent>
		</Card>
	{:else}
		<!-- Search and Filter Card -->
		<Card class="mb-6">
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Filter class="h-5 w-5" />
					Search & Filter
				</CardTitle>
				<!-- <CardDescription>Find specific events by name, organisation, or venue.</CardDescription> -->
			</CardHeader>
			<CardContent>
				<div class="flex flex-col gap-4 sm:flex-row">
					<div class="flex-1">
						<Label for="event-search">Search Events</Label>
						<div class="relative mt-2">
							<Search
								class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400"
							/>
							<Input
								id="event-search"
								type="text"
								placeholder="Search events, organisations, or venues..."
								value={searchTerm}
								oninput={(e) => (searchTerm = (e.target as HTMLInputElement).value)}
								class="pl-10"
							/>
						</div>
					</div>
					<div class="sm:w-64">
						<Label for="category-filter">Organisation</Label>
						<Select.Root type="single" name="category-filter" bind:value={selectedCategory}>
							<Select.Trigger class="mt-2 w-full">
								{categoryContent}
							</Select.Trigger>
							<Select.Content>
								<Select.Group>
									<Select.Item value="" label="All Organisations">All Organisations</Select.Item>
									{#each organisations as org}
										<Select.Item value={org ?? ''} label={org ?? ''}>{org}</Select.Item>
									{/each}
								</Select.Group>
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				{#if searchTerm || selectedCategory}
					<div class="mt-4 flex items-center justify-between">
						<p class="text-sm text-gray-600">
							{#if activeTab === 'all'}
								Showing {filteredEvents.length} of {allEvents.length} events
							{:else if activeTab === 'upcoming'}
								Showing {filteredUpcomingEvents.length} of {upcomingRegistrations.length} events
							{:else}
								Showing {sortedFilteredPastEvents.length} of {pastRegistrations.length} events
							{/if}
						</p>
						<Button
							variant="outline"
							size="sm"
							onclick={() => {
								searchTerm = '';
								selectedCategory = '';
							}}
						>
							Clear Filters
						</Button>
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Tabs for different event views -->
		<Tabs.Root bind:value={activeTab} class="w-full">
			<Tabs.List class="grid w-full grid-cols-3">
				<Tabs.Trigger value="all" class="flex items-center gap-2">
					<Calendar class="h-4 w-4" />
					<span class="hidden sm:inline">All Events</span>
					<span class="sm:hidden">All</span>
				</Tabs.Trigger>
				<Tabs.Trigger value="upcoming" class="flex items-center gap-2">
					<CalendarDays class="h-4 w-4" />
					<span class="hidden sm:inline">My Upcoming ({filteredUpcomingEvents.length})</span>
					<span class="sm:hidden">Upcoming</span>
				</Tabs.Trigger>
				<Tabs.Trigger value="past" class="flex items-center gap-2">
					<History class="h-4 w-4" />
					<span class="hidden sm:inline">My Past ({filteredPastEvents.length})</span>
					<span class="sm:hidden">Past</span>
				</Tabs.Trigger>
			</Tabs.List>

			<!-- All Events Tab -->
			<Tabs.Content value="all">
				<Card>
					<CardHeader>
						<div class="flex items-start justify-between">
							<div class="space-y-1.5">
								<CardTitle class="flex items-center gap-2">
									<Calendar class="h-5 w-5" />
									All Events
								</CardTitle>
								<CardDescription>All approved events available for registration.</CardDescription>
							</div>
							<!-- View Toggle - Only on Desktop -->
							<div class="hidden items-center md:flex">
								<div class="border-input bg-background flex items-center rounded-lg border p-1">
									<Button
										variant={viewMode === 'list' ? 'default' : 'ghost'}
										size="sm"
										onclick={() => (viewMode = 'list')}
										class="h-8 w-8 p-0"
									>
										<List class="h-4 w-4" />
									</Button>
									<Button
										variant={viewMode === 'calendar' ? 'default' : 'ghost'}
										size="sm"
										onclick={() => (viewMode = 'calendar')}
										class="h-8 w-8 p-0"
									>
										<Grid3x3 class="h-4 w-4" />
									</Button>
								</div>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						{#if viewMode === 'calendar'}
							<!-- Calendar View - Only on Desktop -->
							<div class="hidden md:block">
								<EventCalendar
									events={filteredEvents}
									{userRegistrations}
									onEventClick={(event: Event) => goto(`/events/${event.event_id}`)}
									onRegister={handleRegister}
								/>
							</div>
						{:else}
							<!-- List View -->
							{#if filteredEvents.length === 0 && allEvents.length === 0}
								<div class="py-8 text-center">
									<Calendar class="mx-auto mb-4 h-12 w-12 text-gray-400" />
									<h3 class="mb-2 text-lg font-medium text-gray-900">No Events Available</h3>
									<p class="mb-4 text-gray-600">
										There are no events available at the moment. Check back later!
									</p>
								</div>
							{:else if filteredEvents.length === 0}
								<div class="py-8 text-center">
									<Search class="mx-auto mb-4 h-12 w-12 text-gray-400" />
									<h3 class="mb-2 text-lg font-medium text-gray-900">No Events Found</h3>
									<p class="mb-4 text-gray-600">No events match your search criteria.</p>
									<Button
										variant="outline"
										onclick={() => {
											searchTerm = '';
											selectedCategory = '';
										}}
									>
										Clear Filters
									</Button>
								</div>
							{:else}
								<Accordion type="multiple" class="w-full space-y-3">
									{#each filteredEvents as event, index}
										{@const availability = getAvailabilityStatus(event)}
										{@const isRegistered = userRegistrations.includes(event.event_id)}
										<AccordionItem
											value={`all-event-${index}`}
											class="rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
										>
											<AccordionTrigger
												class="rounded-t-lg px-6 py-4 transition-colors duration-200 hover:bg-gray-50 hover:no-underline [&>svg]:hidden"
											>
												<div class="flex w-full items-center justify-between text-left">
													<h3
														class="max-w-xs truncate pr-4 text-base font-semibold text-gray-900 sm:max-w-sm md:max-w-md lg:max-w-lg"
													>
														{event.name}
													</h3>
													<div class="ml-4 hidden items-center gap-2 text-sm text-gray-600 sm:flex">
														<span>{formatDate(event.start_datetime)}</span>
													</div>
												</div>
											</AccordionTrigger>
											<AccordionContent class="px-6 pb-6">
												{@render eventAccordionContent(event, 'all')}
											</AccordionContent>
										</AccordionItem>
									{/each}
								</Accordion>
							{/if}
						{/if}
					</CardContent>
				</Card>
			</Tabs.Content>

			<!-- My Upcoming Events Tab -->
			<Tabs.Content value="upcoming">
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<CalendarDays class="h-5 w-5" />
							My Upcoming Events
						</CardTitle>
						<CardDescription>Events you have registered for that are coming up.</CardDescription>
					</CardHeader>
					<CardContent>
						{#if filteredUpcomingEvents.length === 0 && upcomingRegistrations.length === 0}
							<div class="py-8 text-center">
								<CalendarDays class="mx-auto mb-4 h-12 w-12 text-gray-400" />
								<h3 class="mb-2 text-lg font-medium text-gray-900">No Upcoming Events</h3>
								<p class="mb-4 text-gray-600">
									You haven't registered for any upcoming events yet.
								</p>
								<Button onclick={() => (activeTab = 'all')}>Browse Events</Button>
							</div>
						{:else if filteredUpcomingEvents.length === 0}
							<div class="py-8 text-center">
								<Search class="mx-auto mb-4 h-12 w-12 text-gray-400" />
								<h3 class="mb-2 text-lg font-medium text-gray-900">No Events Found</h3>
								<p class="mb-4 text-gray-600">No upcoming events match your search criteria.</p>
								<Button
									variant="outline"
									onclick={() => {
										searchTerm = '';
										selectedCategory = '';
									}}
								>
									Clear Filters
								</Button>
							</div>
						{:else}
							<Accordion type="multiple" class="w-full space-y-3">
								{#each filteredUpcomingEvents as event, index}
									{@const registration = getRegistrationDetails(event.event_id)}
									{@const timeUntil = getTimeUntilEvent(event.start_datetime)}
									<AccordionItem
										value={`upcoming-event-${index}`}
										class="rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
									>
										<AccordionTrigger
											class="rounded-t-lg px-6 py-4 transition-colors duration-200 hover:bg-gray-50 hover:no-underline [&>svg]:hidden"
										>
											<div class="flex w-full items-center justify-between text-left">
												<div class="flex items-center gap-3">
													<h3
														class="max-w-xs truncate pr-4 text-base font-semibold text-gray-900 sm:max-w-sm md:max-w-md lg:max-w-lg"
													>
														{event.name}
													</h3>
												</div>
												<div class="ml-4 hidden items-center gap-3 text-sm text-gray-600 sm:flex">
													{#if timeUntil}
														<!-- {#if timeUntil.value === 0 && timeUntil.unit === 'minutes'}
															<Badge variant="outline" class="border-red-200 bg-red-50 text-red-700"
																>Starting Soon</Badge
															>
														{:else if timeUntil.unit === 'day' || (timeUntil.unit === 'days' && timeUntil.value === 1)}
															<Badge
																variant="outline"
																class="border-green-200 bg-green-50 text-green-700">Tomorrow</Badge
															>
														{:else if timeUntil.unit === 'days' && timeUntil.value <= 7}
															<Badge
																variant="outline"
																class="border-orange-200 bg-orange-50 text-orange-700"
																>{timeUntil.text}</Badge
															>
														{:else if timeUntil.unit === 'hour' || timeUntil.unit === 'hours'}
															<Badge
																variant="outline"
																class="border-yellow-200 bg-yellow-50 text-yellow-700"
																>{timeUntil.text}</Badge
															>
														{:else if timeUntil.unit === 'minute' || timeUntil.unit === 'minutes'}
															<Badge variant="outline" class="border-red-200 bg-red-50 text-red-700"
																>{timeUntil.text}</Badge
															>
														{:else}
															<Badge variant="outline">{timeUntil.text}</Badge>
														{/if} -->
														<Badge variant="outline">{timeUntil.text}</Badge>
													{/if}
													<span>{formatDate(event.start_datetime)}</span>
												</div>
											</div>
										</AccordionTrigger>
										<AccordionContent class="px-6 pb-6">
											{@render eventAccordionContent(event, 'upcoming', registration)}
										</AccordionContent>
									</AccordionItem>
								{/each}
							</Accordion>
						{/if}
					</CardContent>
				</Card>
			</Tabs.Content>

			<!-- My Past Events Tab -->
			<Tabs.Content value="past">
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<History class="h-5 w-5" />
							My Past Events
						</CardTitle>
						<CardDescription>Events you have registered for in the past.</CardDescription>
					</CardHeader>
					<CardContent>
						{#if sortedFilteredPastEvents.length === 0 && pastRegistrations.length === 0}
							<div class="py-8 text-center">
								<History class="mx-auto mb-4 h-12 w-12 text-gray-400" />
								<h3 class="mb-2 text-lg font-medium text-gray-900">No Event History</h3>
								<p class="mb-4 text-gray-600">You haven't registered for any events yet.</p>
								<Button onclick={() => (activeTab = 'all')}>Browse Events</Button>
							</div>
						{:else if sortedFilteredPastEvents.length === 0}
							<div class="py-8 text-center">
								<Search class="mx-auto mb-4 h-12 w-12 text-gray-400" />
								<h3 class="mb-2 text-lg font-medium text-gray-900">No Events Found</h3>
								<p class="mb-4 text-gray-600">No past events match your search criteria.</p>
								<Button
									variant="outline"
									onclick={() => {
										searchTerm = '';
										selectedCategory = '';
									}}
								>
									Clear Filters
								</Button>
							</div>
						{:else}
							<Accordion type="multiple" class="w-full space-y-3">
								{#each sortedFilteredPastEvents as event, index}
									{@const registration = getRegistrationDetails(event.event_id)}
									{@const daysAgo = getDaysAgo(event.start_datetime)}
									<AccordionItem
										value={`past-event-${index}`}
										class="rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
									>
										<AccordionTrigger
											class="rounded-t-lg px-6 py-4 transition-colors duration-200 hover:bg-gray-50 hover:no-underline [&>svg]:hidden"
										>
											<div class="flex w-full items-center justify-between text-left">
												<div class="flex items-center gap-3">
													<h3
														class="max-w-xs truncate pr-4 text-base font-semibold text-gray-900 sm:max-w-sm md:max-w-md lg:max-w-lg"
													>
														{event.name}
													</h3>
												</div>
												<div class="ml-4 hidden items-center gap-3 text-sm text-gray-600 sm:flex">
													{#if daysAgo !== null}
														{#if daysAgo === 0}
															<Badge
																variant="outline"
																class="border-blue-200 bg-blue-50 text-blue-700">Today</Badge
															>
														{:else if daysAgo === 1}
															<Badge
																variant="outline"
																class="border-gray-200 bg-gray-50 text-gray-700">Yesterday</Badge
															>
														{:else if daysAgo <= 7}
															<Badge
																variant="outline"
																class="border-gray-200 bg-gray-50 text-gray-700"
																>{daysAgo} days ago</Badge
															>
														{:else if daysAgo <= 30}
															<Badge
																variant="outline"
																class="border-gray-200 bg-gray-50 text-gray-700"
																>{daysAgo} days ago</Badge
															>
														{:else}
															<Badge
																variant="outline"
																class="border-gray-200 bg-gray-50 text-gray-700"
																>{Math.floor(daysAgo / 30)} months ago</Badge
															>
														{/if}
													{/if}
													<span>{formatDate(event.start_datetime)}</span>
												</div>
											</div>
										</AccordionTrigger>
										<AccordionContent class="px-6 pb-6">
											{@render eventAccordionContent(event, 'past', registration)}
										</AccordionContent>
									</AccordionItem>
								{/each}
							</Accordion>
						{/if}
					</CardContent>
				</Card>
			</Tabs.Content>
		</Tabs.Root>
	{/if}
</div>

<!-- Registration Dialog -->
<RegistrationDialog
	bind:this={registrationDialogRef}
	bind:open={showRegistrationDialog}
	event={registrationEvent}
	{isRegistering}
	onClose={() => (showRegistrationDialog = false)}
	onRegister={handleRegisterSubmit}
	onOpenRegistrationForm={openRegistrationForm}
/>
