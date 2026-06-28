<script lang="ts">
	import { onMount } from 'svelte';
	import { getLocalTimeZone, CalendarDate } from '@internationalized/date';
	import type { CalendarDate as CalendarDateType } from '@internationalized/date';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import Calendar from '$lib/components/ui/calendar/calendar.svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import {
		CalendarIcon,
		MapPin,
		Users,
		Clock,
		Plus,
		Building2,
		RefreshCw,
		Check,
		ChevronDown
	} from '@lucide/svelte';
	import {
		getUserLeadershipOrganisations,
		getOrganisations,
		getEventStates,
		getEventModes,
		createEvent,
		saveDraftEvent,
		getEventById,
		updateEvent,
		requestEventUpdate,
		clearEventUpdateRequest,
		submitEventForApproval
	} from '$lib/database';
	import { getUserProfile } from '$lib/auth';
	import { checkEventCreationAccess, checkEventEditAccess } from '$lib/permissions';
	import { toast } from 'svelte-sonner';
	import { EVENT_STATES, EVENT_MODES } from '$lib/constants';
	import { findByName, isEventMode } from '$lib/utils/lookup';
	import type { Organisation, EventState, EventMode } from '$lib/types';

	let { data } = $props();
	let { supabase } = $derived(data);

	// Form data
	let eventData = $state({
		name: '',
		description: '',
		venue: '',
		capacity: '',
		startTime: '00:00',
		endTime: '23:59',
		registrationOpenTime: '00:00',
		registrationCloseTime: '23:59',
		noteToRegistrants: '',
		registrationUrl: '',
		feedbackUrl: '',
		registrationSecretCode: '',
		organisationId: '',
		eventModeId: ''
	});

	// Calendar date states
	let startDate = $state<CalendarDateType | undefined>();
	let endDate = $state<CalendarDateType | undefined>();
	let registrationOpenDate = $state<CalendarDateType | undefined>();
	let registrationCloseDate = $state<CalendarDateType | undefined>();

	// Popover states
	let openStartDate = $state(false);
	let openEndDate = $state(false);
	let openRegOpenDate = $state(false);
	let openRegCloseDate = $state(false);

	let userOrganisations: Organisation[] = $state([]);
	let eventStates: EventState[] = $state([]);
	let eventModes: EventMode[] = $state([]);
	let loading = $state(true);
	let hasAccess = $state<boolean | null>(null);
	let userProfile: any = $state(null);
	let isSubmitting = $state(false);
	let isDraftSaving = $state(false);
	let submitMessage = $state('');
	let emsFormSubmitted = $state(false);
	let useSecretCode = $state(false);
	let eventCreated = $state(false);
	let draftSaved = $state(false);
	let createdEventName = $state('');
	let savedDraftName = $state('');
	let errors = $state({
		emsFormSubmitted: '',
		organisationId: '',
		eventModeId: '',
		noteToRegistrants: ''
	});

	// Edit mode state
	let isEditMode = $state(false);
	let editingEventId = $state<string | null>(null);
	let originalEvent = $state<any>(null);
	let pendingUpdateRequest = $state<any>(null);
	let isRequestingUpdate = $state(false);
	let isCancellingRequest = $state(false);
	let isSubmittingForApproval = $state(false);
	let isAdmin = $state(false);

	// Clear secret code when checkbox is unchecked
	$effect(() => {
		if (!useSecretCode) {
			eventData.registrationSecretCode = '';
		}
	});

	onMount(async () => {
		// Check if we're in edit mode
		const editEventId = $page.url.searchParams.get('edit');
		if (editEventId) {
			isEditMode = true;
			editingEventId = editEventId;
		}

		// Check if user is admin
		const profile = await getUserProfile(supabase);
		isAdmin =
			profile?.profile?.profile_role?.name === 'Admin' ||
			profile?.profile?.profile_role?.name === 'Superadmin';

		// Check access permissions
		let canAccess = false;

		if (isEditMode && editingEventId) {
			// For edit mode, check edit permissions for the specific event
			canAccess = await checkEventEditAccess(supabase, editingEventId);
		} else {
			// For create mode, check general creation permissions
			canAccess = await checkEventCreationAccess(supabase);
		}

		hasAccess = canAccess;

		if (!canAccess) {
			loading = false;
			return;
		}

		await loadData();

		// Load event data for editing if in edit mode
		if (isEditMode && editingEventId) {
			await loadEventForEditing(editingEventId);
		}
	});

	async function loadData() {
		loading = true;
		try {
			console.log('Loading user data...');
			const profile = await getUserProfile(supabase);

			if (!profile?.profile?.profile_id) {
				console.error('No user profile found');
				toast.error('Unable to load user profile');
				return;
			}

			userProfile = profile;

			// Load organisations based on mode and user role
			// For editing: admins get all organisations, others get leadership only
			// For creating: all users (including admins) need leadership roles
			let orgsPromise;
			if (isEditMode && isAdmin) {
				orgsPromise = getOrganisations(supabase);
			} else {
				orgsPromise = getUserLeadershipOrganisations(supabase, profile.profile.profile_id);
			}

			// Load organisations, event states, and event modes in parallel
			const [orgs, states, modes] = await Promise.all([
				orgsPromise,
				getEventStates(supabase),
				getEventModes(supabase)
			]);

			userOrganisations = orgs;
			eventStates = states as EventState[];
			eventModes = modes as EventMode[];

			console.log('User organisations:', userOrganisations);
			console.log('Event states:', eventStates);
			console.log('Event modes:', eventModes);
		} catch (error) {
			console.error('Error loading data:', error);
			toast.error('Failed to load necessary data');
		} finally {
			loading = false;
		}
	}

	async function loadEventForEditing(eventId: string) {
		try {
			const event = await getEventById(supabase, eventId);
			if (!event) {
				toast.error('Event not found');
				goto('/events');
				return;
			}

			originalEvent = event;

			originalEvent = event;

			// Check for pending update request
			if (event.event_update_request) {
				pendingUpdateRequest = event.event_update_request;
			}

			// Populate form with event data
			eventData.name = event.name || '';
			eventData.description = event.description || '';
			eventData.venue = event.venue || '';
			eventData.capacity = event.capacity ? event.capacity.toString() : '';
			eventData.noteToRegistrants = event.note_to_registrants || '';
			eventData.registrationUrl = event.registration_url || '';
			eventData.feedbackUrl = event.feedback_url || '';
			eventData.registrationSecretCode = event.registration_secret_code || '';
			eventData.organisationId = event.organisation_id || '';
			eventData.eventModeId = event.event_mode_id || '';

			// Set useSecretCode based on whether there's a secret code
			useSecretCode = !!(event.registration_secret_code && event.registration_secret_code.trim());

			// Parse dates and times
			if (event.start_datetime) {
				const startDateTime = new Date(event.start_datetime);
				startDate = new CalendarDate(
					startDateTime.getFullYear(),
					startDateTime.getMonth() + 1,
					startDateTime.getDate()
				);
				eventData.startTime = startDateTime.toTimeString().slice(0, 5);
			}

			if (event.end_datetime) {
				const endDateTime = new Date(event.end_datetime);
				endDate = new CalendarDate(
					endDateTime.getFullYear(),
					endDateTime.getMonth() + 1,
					endDateTime.getDate()
				);
				eventData.endTime = endDateTime.toTimeString().slice(0, 5);
			}

			if (event.registration_opening_datetime) {
				const regOpenDateTime = new Date(event.registration_opening_datetime);
				registrationOpenDate = new CalendarDate(
					regOpenDateTime.getFullYear(),
					regOpenDateTime.getMonth() + 1,
					regOpenDateTime.getDate()
				);
				eventData.registrationOpenTime = regOpenDateTime.toTimeString().slice(0, 5);
			}

			if (event.registration_closing_datetime) {
				const regCloseDateTime = new Date(event.registration_closing_datetime);
				registrationCloseDate = new CalendarDate(
					regCloseDateTime.getFullYear(),
					regCloseDateTime.getMonth() + 1,
					regCloseDateTime.getDate()
				);
				eventData.registrationCloseTime = regCloseDateTime.toTimeString().slice(0, 5);
			}

			// For editing, we assume EMS form was already submitted
			emsFormSubmitted = true;
		} catch (error) {
			console.error('Error loading event for editing:', error);
			toast.error('Failed to load event data');
			goto('/events');
		}
	}

	function openEMSForm() {
		const emsFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSdxb2eNzgYC5E_BnTS15PjLvjUpru8QE8D7pWViVyJD0SXdxw/viewform';

		try {
			// open new tab
			window.open(emsFormUrl, '_blank');
		} catch (error) {
			toast('Unable to open EMS form. Please check your popup settings or contact support.');
		}
	}

	function validateForm(isDraft: boolean = false) {
		errors.emsFormSubmitted = '';
		errors.organisationId = '';
		errors.eventModeId = '';
		errors.noteToRegistrants = '';
		let isValid = true;

		// EMS form is only required for final submission, not for drafts
		if (!isDraft && !emsFormSubmitted) {
			errors.emsFormSubmitted = 'Please confirm that you have submitted the EMS Form';
			isValid = false;
		}

		if (!eventData.organisationId) {
			errors.organisationId = 'Please select an organisation for this event';
			isValid = false;
		}

		if (!eventData.eventModeId) {
			errors.eventModeId = 'Please select an event mode';
			isValid = false;
		}

		// Check if event mode is Online and note to registrants is required
		if (eventData.eventModeId) {
			const selectedMode = eventModes.find((mode) => mode.event_mode_id === eventData.eventModeId);
			if (
				isEventMode(selectedMode?.name, EVENT_MODES.ONLINE) &&
				(!eventData.noteToRegistrants || eventData.noteToRegistrants.trim() === '')
			) {
				errors.noteToRegistrants = 'Note to registrants is required for online events';
				isValid = false;
			}
		}

		return isValid;
	}

	function resetForm() {
		eventData.name = '';
		eventData.description = '';
		eventData.venue = '';
		eventData.capacity = '';
		eventData.startTime = '00:00';
		eventData.endTime = '23:59';
		eventData.registrationOpenTime = '00:00';
		eventData.registrationCloseTime = '23:59';
		eventData.noteToRegistrants = '';
		eventData.registrationUrl = '';
		eventData.feedbackUrl = '';
		eventData.registrationSecretCode = '';
		eventData.organisationId = '';
		eventData.eventModeId = '';
		startDate = undefined;
		endDate = undefined;
		registrationOpenDate = undefined;
		registrationCloseDate = undefined;
		emsFormSubmitted = false;
		useSecretCode = false;
		errors.emsFormSubmitted = '';
		errors.organisationId = '';
		errors.eventModeId = '';
		errors.noteToRegistrants = '';
	}

	async function handleSaveDraft() {
		if (!validateForm(true)) {
			return;
		}

		if (!userProfile?.profile?.profile_id) {
			toast.error('User profile not found');
			return;
		}

		isDraftSaving = true;

		try {
			// Get the draft state
			const draftState = findByName(eventStates, EVENT_STATES.DRAFT);

			if (!draftState) {
				toast.error('Required event configuration not found');
				return;
			}

			// Combine date and time fields into datetime strings
			const startDateTime =
				startDate && eventData.startTime
					? new Date(
							`${startDate.year}-${String(startDate.month).padStart(2, '0')}-${String(startDate.day).padStart(2, '0')}T${eventData.startTime}:00`
						).toISOString()
					: undefined;

			const endDateTime =
				endDate && eventData.endTime
					? new Date(
							`${endDate.year}-${String(endDate.month).padStart(2, '0')}-${String(endDate.day).padStart(2, '0')}T${eventData.endTime}:00`
						).toISOString()
					: undefined;

			const registrationOpenDateTime =
				registrationOpenDate && eventData.registrationOpenTime
					? new Date(
							`${registrationOpenDate.year}-${String(registrationOpenDate.month).padStart(2, '0')}-${String(registrationOpenDate.day).padStart(2, '0')}T${eventData.registrationOpenTime}:00`
						).toISOString()
					: undefined;

			const registrationCloseDateTime =
				registrationCloseDate && eventData.registrationCloseTime
					? new Date(
							`${registrationCloseDate.year}-${String(registrationCloseDate.month).padStart(2, '0')}-${String(registrationCloseDate.day).padStart(2, '0')}T${eventData.registrationCloseTime}:00`
						).toISOString()
					: undefined;

			const eventToSave = {
				organisation_id: eventData.organisationId,
				event_state_id: draftState.event_state_id,
				event_mode_id: eventData.eventModeId,
				name: eventData.name || undefined,
				description: eventData.description || undefined,
				venue: eventData.venue || undefined,
				capacity: eventData.capacity ? parseInt(eventData.capacity) : undefined,
				note_to_registrants: eventData.noteToRegistrants || undefined,
				start_datetime: startDateTime,
				end_datetime: endDateTime,
				registration_opening_datetime: registrationOpenDateTime,
				registration_closing_datetime: registrationCloseDateTime,
				registration_url: eventData.registrationUrl || undefined,
				registration_secret_code:
					useSecretCode &&
					eventData.registrationSecretCode &&
					eventData.registrationSecretCode.trim()
						? eventData.registrationSecretCode.trim()
						: null,
				feedback_url: eventData.feedbackUrl || undefined,
				created_by: userProfile.profile.profile_id
			};

			console.log('Saving draft event:', eventToSave);

			const savedEvent = await saveDraftEvent(supabase, eventToSave);

			if (savedEvent) {
				savedDraftName = eventData.name || 'Untitled Event';
				draftSaved = true;
				toast.success('Draft saved successfully! You can continue editing or submit it later.');
			} else {
				toast.error('Failed to save draft. Please try again.');
			}
		} catch (error) {
			console.error('Error saving draft:', error);
			toast.error('Failed to save draft. Please try again.');
		} finally {
			isDraftSaving = false;
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		if (!validateForm()) {
			return;
		}

		if (!userProfile?.profile?.profile_id) {
			toast.error('User profile not found');
			return;
		}

		isSubmitting = true;

		try {
			// Combine date and time fields into datetime strings
			const startDateTime =
				startDate && eventData.startTime
					? new Date(
							`${startDate.year}-${String(startDate.month).padStart(2, '0')}-${String(startDate.day).padStart(2, '0')}T${eventData.startTime}:00`
						).toISOString()
					: undefined;

			const endDateTime =
				endDate && eventData.endTime
					? new Date(
							`${endDate.year}-${String(endDate.month).padStart(2, '0')}-${String(endDate.day).padStart(2, '0')}T${eventData.endTime}:00`
						).toISOString()
					: undefined;

			const registrationOpenDateTime =
				registrationOpenDate && eventData.registrationOpenTime
					? new Date(
							`${registrationOpenDate.year}-${String(registrationOpenDate.month).padStart(2, '0')}-${String(registrationOpenDate.day).padStart(2, '0')}T${eventData.registrationOpenTime}:00`
						).toISOString()
					: undefined;

			const registrationCloseDateTime =
				registrationCloseDate && eventData.registrationCloseTime
					? new Date(
							`${registrationCloseDate.year}-${String(registrationCloseDate.month).padStart(2, '0')}-${String(registrationCloseDate.day).padStart(2, '0')}T${eventData.registrationCloseTime}:00`
						).toISOString()
					: undefined;

			const eventPayload = {
				organisation_id: eventData.organisationId,
				event_mode_id: eventData.eventModeId,
				name: eventData.name,
				description: eventData.description,
				venue: eventData.venue,
				capacity: eventData.capacity ? parseInt(eventData.capacity) : undefined,
				note_to_registrants: eventData.noteToRegistrants || undefined,
				start_datetime: startDateTime,
				end_datetime: endDateTime,
				registration_opening_datetime: registrationOpenDateTime,
				registration_closing_datetime: registrationCloseDateTime,
				registration_url: eventData.registrationUrl || undefined,
				registration_secret_code:
					useSecretCode &&
					eventData.registrationSecretCode &&
					eventData.registrationSecretCode.trim()
						? eventData.registrationSecretCode.trim()
						: null,
				feedback_url: eventData.feedbackUrl || undefined
			};

			if (isEditMode && editingEventId) {
				// Check if event is approved - if so, use request update instead
				if (originalEvent?.event_state?.name?.toLowerCase() === 'approved') {
					await handleRequestUpdate();
					return;
				}

				// For draft events or other states, update directly
				console.log('Updating event:', eventPayload);

				const result = await updateEvent(
					supabase,
					editingEventId,
					eventPayload,
					userProfile.profile.profile_id
				);

				if (result.success) {
					toast.success('Event updated successfully!');
					goto(`/events/${editingEventId}`);
				} else {
					toast.error(result.error || 'Failed to update event. Please try again.');
				}
			} else {
				// Create new event - get the pending state for final submission
				const pendingState = findByName(eventStates, EVENT_STATES.PENDING);

				if (!pendingState) {
					toast.error('Required event configuration not found');
					return;
				}

				const eventToCreate = {
					...eventPayload,
					event_state_id: pendingState.event_state_id,
					created_by: userProfile.profile.profile_id
				};

				console.log('Creating event:', eventToCreate);

				const createdEvent = await createEvent(supabase, eventToCreate);

				if (createdEvent) {
					createdEventName = eventData.name;
					eventCreated = true;
					toast.success('Event submitted successfully! It is now pending admin approval.');
					// Reset form
					resetForm();
				} else {
					toast.error('Failed to create event. Please try again.');
				}
			}
		} catch (error) {
			console.error('Error submitting event:', error);
			toast.error('Failed to submit event. Please try again.');
		} finally {
			isSubmitting = false;
		}
	}

	async function handleRequestUpdate() {
		if (!validateForm() || !userProfile?.profile?.profile_id || !originalEvent) return;

		isRequestingUpdate = true;
		try {
			// Combine date and time fields into datetime strings
			const startDateTime =
				startDate && eventData.startTime
					? new Date(
							`${startDate.year}-${String(startDate.month).padStart(2, '0')}-${String(startDate.day).padStart(2, '0')}T${eventData.startTime}:00`
						).toISOString()
					: undefined;

			const endDateTime =
				endDate && eventData.endTime
					? new Date(
							`${endDate.year}-${String(endDate.month).padStart(2, '0')}-${String(endDate.day).padStart(2, '0')}T${eventData.endTime}:00`
						).toISOString()
					: undefined;

			const registrationOpenDateTime =
				registrationOpenDate && eventData.registrationOpenTime
					? new Date(
							`${registrationOpenDate.year}-${String(registrationOpenDate.month).padStart(2, '0')}-${String(registrationOpenDate.day).padStart(2, '0')}T${eventData.registrationOpenTime}:00`
						).toISOString()
					: undefined;

			const registrationCloseDateTime =
				registrationCloseDate && eventData.registrationCloseTime
					? new Date(
							`${registrationCloseDate.year}-${String(registrationCloseDate.month).padStart(2, '0')}-${String(registrationCloseDate.day).padStart(2, '0')}T${eventData.registrationCloseTime}:00`
						).toISOString()
					: undefined;

			// Create the update request object
			const updateRequest = {
				name: eventData.name,
				description: eventData.description,
				venue: eventData.venue,
				capacity: eventData.capacity ? parseInt(eventData.capacity) : null,
				note_to_registrants: eventData.noteToRegistrants || null,
				start_datetime: startDateTime,
				end_datetime: endDateTime,
				registration_opening_datetime: registrationOpenDateTime,
				registration_closing_datetime: registrationCloseDateTime,
				registration_url: eventData.registrationUrl || null,
				registration_secret_code:
					useSecretCode &&
					eventData.registrationSecretCode &&
					eventData.registrationSecretCode.trim()
						? eventData.registrationSecretCode.trim()
						: null,
				feedback_url: eventData.feedbackUrl || null,
				event_mode_id: eventData.eventModeId
			};

			const result = await requestEventUpdate(supabase, editingEventId!, updateRequest);

			if (result) {
				originalEvent = result;
				pendingUpdateRequest = updateRequest;
				toast.success('Event update request submitted successfully');
			} else {
				toast.error('Failed to submit event update request. Please try again.');
			}
		} catch (error) {
			console.error('Error requesting event update:', error);
			toast.error('An error occurred while submitting the event update request.');
		} finally {
			isRequestingUpdate = false;
		}
	}

	async function handleCancelUpdateRequest() {
		if (!originalEvent) return;

		isCancellingRequest = true;
		try {
			const result = await clearEventUpdateRequest(supabase, originalEvent.event_id);

			if (result) {
				originalEvent = result;
				pendingUpdateRequest = null;
				toast.success('Event update request cancelled successfully');
			} else {
				toast.error('Failed to cancel event update request. Please try again.');
			}
		} catch (error) {
			console.error('Error cancelling event update request:', error);
			toast.error('An error occurred while cancelling the event update request.');
		} finally {
			isCancellingRequest = false;
		}
	}

	async function handleSubmitForApproval() {
		if (!originalEvent || !userProfile?.profile?.profile_id) return;

		isSubmittingForApproval = true;
		try {
			const result = await submitEventForApproval(supabase,
				originalEvent.event_id,
				userProfile.profile.profile_id
			);

			if (result.success) {
				toast.success('Event submitted for approval successfully!');
				goto(`/events/${originalEvent.event_id}`);
			} else {
				toast.error(result.error || 'Failed to submit event for approval. Please try again.');
			}
		} catch (error) {
			console.error('Error submitting event for approval:', error);
			toast.error('An error occurred while submitting the event for approval.');
		} finally {
			isSubmittingForApproval = false;
		}
	}
</script>

<svelte:head>
	<title>Create Event - SEMS</title>
	<meta
		name="description"
		content="Create a new student event. Set up event details, location, capacity, and registration requirements."
	/>
	<meta name="keywords" content="create event, new event, event setup, student organisation" />
	<meta property="og:title" content="Create Event - SEMS" />
	<meta
		property="og:description"
		content="Create a new student event. Set up event details, location, capacity, and registration requirements."
	/>
	<meta property="og:type" content="website" />
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href="/event-create" />
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<div class="mb-8">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="mb-2 text-3xl font-bold text-gray-900">
					{isEditMode ? 'Edit Event' : 'Create New Event'}
				</h1>
				<p class="text-gray-600">
					{isEditMode
						? 'Update the details of your event.'
						: 'Create an engaging event for students to discover and participate in.'}
				</p>
			</div>
			<div class="flex gap-2"></div>
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
			<span class="ml-2">Loading...</span>
		</div>
	{:else if hasAccess === false}
		<Card>
			<CardContent class="pt-6">
				<div class="py-8 text-center">
					<Building2 class="mx-auto mb-4 h-12 w-12 text-red-400" />
					<h3 class="mb-2 text-lg font-medium text-gray-900">Access Denied</h3>
					<p class="mb-4 text-gray-600">
						You don't have permission to {isEditMode ? 'edit this event' : 'create events'}.
					</p>
					<p class="text-sm text-gray-500">
						{#if isEditMode}
							To edit this event, you need to be either an administrator or an owner/leader of the
							organising organisation.
						{:else}
							To create events, you need to be an owner or leader of an organisation.
						{/if}
					</p>
					<p class="mt-4 text-sm text-gray-500">
						{#if isEditMode}
							Contact an organisation owner to request leadership access or an administrator for
							help.
						{:else}
							Contact an organisation owner to request leadership access.
						{/if}
					</p>
				</div>
			</CardContent>
		</Card>
	{:else if eventCreated}
		<Card>
			<CardContent class="pt-6">
				<div class="py-8 text-center">
					<Check class="mx-auto mb-4 h-12 w-12 text-green-500" />
					<h3 class="mb-2 text-lg font-medium text-gray-900">Event Submitted Successfully!</h3>
					<p class="mb-4 text-gray-600">
						Your event "{createdEventName}" has been submitted and is now pending admin approval.
					</p>
					<!-- <p class="mb-4 text-sm text-gray-500">
						You will be notified once the admin reviews your event submission.
					</p> -->
					<Button
						class="mt-4"
						onclick={() => {
							eventCreated = false;
							createdEventName = '';
						}}
					>
						Create Another Event
					</Button>
				</div>
			</CardContent>
		</Card>
	{:else if draftSaved}
		<Card>
			<CardContent class="pt-6">
				<div class="py-8 text-center">
					<Check class="mx-auto mb-4 h-12 w-12 text-blue-500" />
					<h3 class="mb-2 text-lg font-medium text-gray-900">Draft Saved Successfully!</h3>
					<p class="mb-4 text-gray-600">
						Your event draft "{savedDraftName}" has been saved.
					</p>
					<p class="mb-4 text-sm text-gray-500">
						You can continue editing this draft or submit it for approval when ready.
					</p>
					<div class="flex justify-center gap-2">
						<Button
							variant="outline"
							onclick={() => {
								draftSaved = false;
								savedDraftName = '';
							}}
						>
							Continue Editing
						</Button>
						<Button
							onclick={() => {
								draftSaved = false;
								savedDraftName = '';
								resetForm();
							}}
						>
							Create New Event
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	{:else if userOrganisations.length === 0 && !(isEditMode && isAdmin)}
		<Card>
			<CardContent class="pt-6">
				<div class="py-8 text-center">
					<Building2 class="mx-auto mb-4 h-12 w-12 text-gray-400" />
					<h3 class="mb-2 text-lg font-medium text-gray-900">No Leadership Roles</h3>
					<p class="mb-4 text-gray-600">
						You need to be an owner or leader of an organisation to {isEditMode
							? 'edit this event'
							: 'create events'}.
					</p>
					<p class="text-sm text-gray-500">
						Contact an organisation owner to request leadership access.
					</p>
				</div>
			</CardContent>
		</Card>
	{:else}
		<!-- Pending Update Request Notice -->
		{#if isEditMode && pendingUpdateRequest}
			<Card class="mb-6 border-orange-200 bg-orange-50">
				<CardHeader>
					<CardTitle class="flex items-center text-orange-800">
						<svg class="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
								clip-rule="evenodd"
							/>
						</svg>
						Pending Update Request
					</CardTitle>
					<CardDescription class="text-orange-700">
						You have submitted an update request for this event. The changes are pending admin
						approval.
					</CardDescription>
				</CardHeader>
				<CardContent class="flex justify-end">
					<Button
						variant="outline"
						size="sm"
						disabled={isCancellingRequest}
						onclick={handleCancelUpdateRequest}
					>
						{#if isCancellingRequest}
							<div class="mr-2 h-3 w-3 animate-spin rounded-full border-b-2 border-current"></div>
							Cancelling...
						{:else}
							Cancel Request
						{/if}
					</Button>
				</CardContent>
			</Card>
		{/if}

		<Card>
			<CardHeader>
				<CardTitle class="flex items-center">
					<Plus class="mr-2 h-5 w-5" />
					Event Details
				</CardTitle>
				<CardDescription>
					Fill in the information below to create your event. All fields marked with * are required.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onsubmit={handleSubmit} class="space-y-6">
					<!-- Event Information Selection -->
					<div class="space-y-4">
						<h3 class="flex items-center text-lg font-semibold">Event Information</h3>
						<div class="space-y-2">
							<Label for="organisation">Select Organisation *</Label>
							{#if isEditMode}
								<!-- Read-only display for editing -->
								<div
									class="border-input flex h-10 w-full rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700"
								>
									{originalEvent?.organisation?.name || 'Organisation not found'}
								</div>
								<p class="text-sm text-gray-500">
									Organisation cannot be changed when editing an event.
								</p>
							{:else}
								<!-- Editable selection for creating new events -->
								<Select.Root
									type="single"
									value={eventData.organisationId}
									onValueChange={(value) => {
										if (value !== undefined) eventData.organisationId = value;
									}}
								>
									<Select.Trigger class="w-full {errors.organisationId ? 'border-red-500' : ''}">
										{eventData.organisationId
											? userOrganisations.find(
													(org) => org.organisation_id === eventData.organisationId
												)?.name || 'Select organisation'
											: 'Select organisation'}
									</Select.Trigger>
									<Select.Content>
										<Select.Group>
											{#each userOrganisations as org}
												<Select.Item value={org.organisation_id}>{org.name}</Select.Item>
											{/each}
										</Select.Group>
									</Select.Content>
								</Select.Root>
								{#if errors.organisationId}
									<span class="text-sm text-red-600">{errors.organisationId}</span>
								{/if}
								<p class="text-sm text-gray-500">
									{#if isEditMode && isAdmin}
										As an admin, you can edit events for any organisation.
									{:else}
										You can only {isEditMode ? 'edit events' : 'create events'} for organisations where
										you have owner or leader roles.
									{/if}
								</p>
							{/if}
						</div>
					</div>
					<!-- Basic Information -->
					<div class="grid gap-6 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="name">Event Name *</Label>
							<Input
								id="name"
								bind:value={eventData.name}
								placeholder="Enter event name"
								required
							/>
						</div>
						<div class="space-y-2">
							<Label for="eventMode">Event Mode *</Label>
							<Select.Root
								type="single"
								value={eventData.eventModeId}
								onValueChange={(value) => {
									if (value !== undefined) eventData.eventModeId = value;
								}}
							>
								<Select.Trigger class="w-full {errors.eventModeId ? 'border-red-500' : ''}">
									{eventData.eventModeId
										? eventModes.find((mode) => mode.event_mode_id === eventData.eventModeId)
												?.name || 'Select event mode'
										: 'Select event mode'}
								</Select.Trigger>
								<Select.Content>
									<Select.Group>
										{#each eventModes as mode}
											{#if mode.event_mode_id}
												<Select.Item value={mode.event_mode_id}>{mode.name}</Select.Item>
											{/if}
										{/each}
									</Select.Group>
								</Select.Content>
							</Select.Root>
							{#if errors.eventModeId}
								<span class="text-sm text-red-600">{errors.eventModeId}</span>
							{/if}
						</div>
					</div>

					<div class="space-y-2">
						<Label for="description">Description *</Label>
						<Textarea
							id="description"
							bind:value={eventData.description}
							placeholder="Describe your event in detail..."
							rows={4}
							required
						/>
					</div>

					<div class="grid gap-6 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="venue">Venue *</Label>
							<Input
								id="venue"
								bind:value={eventData.venue}
								placeholder="Enter venue location"
								required
							/>
						</div>
						<div class="space-y-2">
							<Label for="capacity">Capacity *</Label>
							<Input
								id="capacity"
								type="number"
								bind:value={eventData.capacity}
								placeholder="Maximum number of participants"
								required
							/>
						</div>
					</div>

					<!-- Event Date & Time -->
					<div class="space-y-4">
						<h3 class="flex items-center text-lg font-semibold">Event Period</h3>
						<div class="grid gap-6 md:grid-cols-2">
							<div class="space-y-4">
								<div class="space-y-2">
									<Label for="start-date" class="px-1">Start Date *</Label>
									<Popover.Root bind:open={openStartDate}>
										<Popover.Trigger id="start-date">
											{#snippet child({ props })}
												<Button
													{...props}
													variant="outline"
													class="w-full justify-between font-normal"
												>
													{startDate
														? startDate.toDate(getLocalTimeZone()).toLocaleDateString('en-US', {
																day: '2-digit',
																month: 'short',
																year: 'numeric'
															})
														: 'Select date'}
													<CalendarIcon class="h-4 w-4" />
												</Button>
											{/snippet}
										</Popover.Trigger>
										<Popover.Content class="w-auto overflow-hidden p-0" align="start">
											<Calendar
												type="single"
												bind:value={startDate}
												captionLayout="dropdown"
												onValueChange={() => {
													openStartDate = false;
												}}
											/>
										</Popover.Content>
									</Popover.Root>
								</div>
								<div class="space-y-2">
									<Label for="startTime">Start Time *</Label>
									<Input
										id="startTime"
										type="time"
										bind:value={eventData.startTime}
										class="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
										required
									/>
								</div>
							</div>
							<div class="space-y-4">
								<div class="space-y-2">
									<Label for="end-date" class="px-1">End Date *</Label>
									<Popover.Root bind:open={openEndDate}>
										<Popover.Trigger id="end-date">
											{#snippet child({ props })}
												<Button
													{...props}
													variant="outline"
													class="w-full justify-between font-normal"
												>
													{endDate
														? endDate.toDate(getLocalTimeZone()).toLocaleDateString('en-US', {
																day: '2-digit',
																month: 'short',
																year: 'numeric'
															})
														: 'Select date'}
													<CalendarIcon class="h-4 w-4" />
												</Button>
											{/snippet}
										</Popover.Trigger>
										<Popover.Content class="w-auto overflow-hidden p-0" align="start">
											<Calendar
												type="single"
												bind:value={endDate}
												captionLayout="dropdown"
												onValueChange={() => {
													openEndDate = false;
												}}
												isDateDisabled={(date) => {
													return (startDate && date.compare(startDate) < 0) ?? false;
												}}
											/>
										</Popover.Content>
									</Popover.Root>
								</div>
								<div class="space-y-2">
									<Label for="endTime">End Time *</Label>
									<Input
										id="endTime"
										type="time"
										bind:value={eventData.endTime}
										class="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
										required
									/>
								</div>
							</div>
						</div>
					</div>

					<!-- Registration Period -->
					<div class="space-y-4">
						<h3 class="flex items-center text-lg font-semibold">Registration Period</h3>
						<div class="grid gap-6 md:grid-cols-2">
							<div class="space-y-4">
								<div class="space-y-2">
									<Label for="reg-open-date" class="px-1">Registration Opens *</Label>
									<Popover.Root bind:open={openRegOpenDate}>
										<Popover.Trigger id="reg-open-date">
											{#snippet child({ props })}
												<Button
													{...props}
													variant="outline"
													class="w-full justify-between font-normal"
												>
													{registrationOpenDate
														? registrationOpenDate
																.toDate(getLocalTimeZone())
																.toLocaleDateString('en-US', {
																	day: '2-digit',
																	month: 'short',
																	year: 'numeric'
																})
														: 'Select date'}
													<CalendarIcon class="h-4 w-4" />
												</Button>
											{/snippet}
										</Popover.Trigger>
										<Popover.Content class="w-auto overflow-hidden p-0" align="start">
											<Calendar
												type="single"
												bind:value={registrationOpenDate}
												captionLayout="dropdown"
												onValueChange={() => {
													openRegOpenDate = false;
												}}
											/>
										</Popover.Content>
									</Popover.Root>
								</div>
								<div class="space-y-2">
									<Label for="regOpenTime">Opening Time *</Label>
									<Input
										id="regOpenTime"
										type="time"
										bind:value={eventData.registrationOpenTime}
										class="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
										required
									/>
								</div>
							</div>
							<div class="space-y-4">
								<div class="space-y-2">
									<Label for="reg-close-date" class="px-1">Registration Closes *</Label>
									<Popover.Root bind:open={openRegCloseDate}>
										<Popover.Trigger id="reg-close-date">
											{#snippet child({ props })}
												<Button
													{...props}
													variant="outline"
													class="w-full justify-between font-normal"
												>
													{registrationCloseDate
														? registrationCloseDate
																.toDate(getLocalTimeZone())
																.toLocaleDateString('en-US', {
																	day: '2-digit',
																	month: 'short',
																	year: 'numeric'
																})
														: 'Select date'}
													<CalendarIcon class="h-4 w-4" />
												</Button>
											{/snippet}
										</Popover.Trigger>
										<Popover.Content class="w-auto overflow-hidden p-0" align="start">
											<Calendar
												type="single"
												bind:value={registrationCloseDate}
												captionLayout="dropdown"
												onValueChange={() => {
													openRegCloseDate = false;
												}}
												isDateDisabled={(date) => {
													return (
														(registrationOpenDate && date.compare(registrationOpenDate) < 0) ??
														false
													);
												}}
											/>
										</Popover.Content>
									</Popover.Root>
								</div>
								<div class="space-y-2">
									<Label for="regCloseTime">Closing Time *</Label>
									<Input
										id="regCloseTime"
										type="time"
										bind:value={eventData.registrationCloseTime}
										class="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
										required
									/>
								</div>
							</div>
						</div>
					</div>

					<!-- Additional Information -->
					<div class="space-y-4">
						<h3 class="text-lg font-semibold">Additional Information</h3>
						<div class="space-y-4">
							<div class="space-y-2">
								<Label for="noteToRegistrants">
									Note to Registrants
									{#if eventData.eventModeId && isEventMode(eventModes.find((mode) => mode.event_mode_id === eventData.eventModeId)?.name, EVENT_MODES.ONLINE)}
										<span>*</span>
									{/if}
								</Label>
								<Textarea
									id="noteToRegistrants"
									bind:value={eventData.noteToRegistrants}
									placeholder="Any special instructions or information for participants (e.g. bring your own device, online meeting links)"
									rows={3}
									class={errors.noteToRegistrants ? 'border-red-500' : ''}
									required={!!(
										eventData.eventModeId &&
										eventModes.find((mode) => mode.event_mode_id === eventData.eventModeId)
											?.name === 'Online'
									)}
								/>
								{#if errors.noteToRegistrants}
									<span class="text-sm text-red-600">{errors.noteToRegistrants}</span>
								{/if}
								{#if eventData.eventModeId && isEventMode(eventModes.find((mode) => mode.event_mode_id === eventData.eventModeId)?.name, EVENT_MODES.ONLINE)}
									<p class="text-sm text-gray-500">
										<strong>Required for online events:</strong> Please provide meeting links, access
										instructions, or other important details for participants.
									</p>
								{/if}
							</div>
							<div class="grid gap-6 md:grid-cols-2">
								<div class="space-y-2">
									<Label for="registrationUrl">Registration URL</Label>
									<Input
										id="registrationUrl"
										type="text"
										bind:value={eventData.registrationUrl}
										placeholder="External registration link"
									/>
								</div>
								<div class="space-y-2">
									<Label for="feedbackUrl">Feedback URL</Label>
									<Input
										id="feedbackUrl"
										type="text"
										bind:value={eventData.feedbackUrl}
										placeholder="Post-event feedback form link"
									/>
								</div>
							</div>

							<!-- Secret Code Section -->
							<div class="space-y-4">
								<div class="grid items-start gap-6 md:grid-cols-2">
									<div class="space-y-2">
										<label class="mt-4 flex cursor-pointer items-center space-x-3">
											<input
												type="checkbox"
												bind:checked={useSecretCode}
												class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
											/>
											<span class="text-sm font-medium text-gray-700">
												Add a secret code for registration
											</span>
										</label>
									</div>

									<div class="space-y-2">
										<Label for="registrationSecretCode">Registration Secret Code</Label>
										<Input
											id="registrationSecretCode"
											bind:value={eventData.registrationSecretCode}
											placeholder="Enter secret code"
											maxlength={16}
											title="Only alphanumeric characters allowed, maximum 16 characters"
											disabled={!useSecretCode}
										/>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- EMS Form Section -->
					<div class="space-y-4">
						<h3 class="text-lg font-semibold">EMS Form</h3>

						<div class="space-y-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
							<p class="text-sm text-gray-700">
								By submitting this form, you are acknowledging that your event plan is final and no
								changes can be made to said plan. The details submitted along the form will be used
								to submit the event details to the school. Please ensure there is a minimum of
								FOURTEEN (14) days between the submission day (every Tuesday/Friday of the week) to
								the event day itself. NOTE: Ensure that you have submitted the SARAH Risk Assessment
								and have completed the venue booking BEFORE you submit this form.
							</p>

							<button
								type="button"
								class="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
								onclick={() => openEMSForm()}
							>
								Open EMS Form
							</button>

							<p class="text-sm font-medium text-orange-700">
								Note: EMS Form submission is only required when submitting for final approval, not
								for saving drafts.
							</p>

							<div class="space-y-2">
								<label class="flex cursor-pointer items-start space-x-3">
									<input
										type="checkbox"
										bind:checked={emsFormSubmitted}
										class="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
										class:border-red-500={errors.emsFormSubmitted}
									/>
									<span class="text-sm text-gray-700">
										Please make sure to tick here after submitting the EMS Form (required for final
										submission only).
									</span>
								</label>
								{#if errors.emsFormSubmitted}
									<span class="text-sm text-red-600">{errors.emsFormSubmitted}</span>
								{/if}
							</div>
						</div>
					</div>

					<!-- Submit Button -->
					<div class="border-t pt-6">
						<div class="flex justify-end gap-4">
							{#if !isEditMode}
								<Button
									type="button"
									variant="outline"
									onclick={handleSaveDraft}
									disabled={isDraftSaving || isSubmitting}
								>
									{isDraftSaving ? 'Saving Draft...' : 'Save as Draft'}
								</Button>
							{/if}

							{#if isEditMode && originalEvent?.event_state?.name?.toLowerCase() === 'draft'}
								<!-- Draft event: Show Update Draft and Submit for Approval buttons -->
								<Button
									type="submit"
									variant="outline"
									disabled={isSubmitting || isSubmittingForApproval || !!pendingUpdateRequest}
								>
									{#if isSubmitting}
										<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
										Updating Draft...
									{:else}
										Update Draft
									{/if}
								</Button>
								<Button
									type="button"
									onclick={handleSubmitForApproval}
									disabled={isSubmittingForApproval || isSubmitting || !!pendingUpdateRequest}
								>
									{#if isSubmittingForApproval}
										<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
										Submitting for Approval...
									{:else}
										Submit for Approval
									{/if}
								</Button>
							{:else if isEditMode && originalEvent?.event_state?.name?.toLowerCase() === 'approved'}
								<!-- Approved event: Show Request Update button -->
								<Button
									type="button"
									onclick={handleRequestUpdate}
									disabled={isRequestingUpdate || isSubmitting || !!pendingUpdateRequest}
								>
									{#if isRequestingUpdate}
										<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
										Requesting Update...
									{:else if pendingUpdateRequest}
										Update Request Pending
									{:else}
										Request Update
									{/if}
								</Button>
							{:else if isEditMode}
								<!-- Other states: Regular update -->
								<Button type="submit" disabled={isSubmitting || !!pendingUpdateRequest}>
									{#if isSubmitting}
										<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
										Updating Event...
									{:else}
										Update Event
									{/if}
								</Button>
							{:else}
								<!-- New event creation -->
								<Button type="submit" disabled={isSubmitting || isDraftSaving}>
									{#if isSubmitting}
										<RefreshCw class="mr-2 h-4 w-4 animate-spin" />
										Submitting Event...
									{:else}
										Submit for Approval
									{/if}
								</Button>
							{/if}
						</div>
						<p class="mt-2 text-right text-xs text-gray-500">
							{#if isEditMode && originalEvent?.event_state?.name?.toLowerCase() === 'draft'}
								Draft events can be updated directly or submitted for admin approval.
							{:else if isEditMode && originalEvent?.event_state?.name?.toLowerCase() === 'approved'}
								Approved events require update requests that need admin approval.
							{:else if isEditMode}
								Event changes will be saved immediately.
							{:else}
								Drafts can be edited later. Submitted events require admin approval.
							{/if}
						</p>
					</div>
				</form>
			</CardContent>
		</Card>
	{/if}
</div>
