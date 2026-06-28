<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		getPendingUpdateRequests,
		approveProfileUpdate,
		rejectProfileUpdate,
		approveOrganisationUpdate,
		rejectOrganisationUpdate,
		approveEventUpdate,
		rejectEventUpdate,
		getStudyLevels,
		getStudySchools,
		getStudyProgramsBySchoolAndLevel,
		getOrganisations,
		getEventStates,
		getEventModes,
		getEvents
	} from '$lib/database';
	import { checkApprovalsAccess } from '$lib/permissions';
	import { EVENT_STATES } from '$lib/constants';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import {
		Accordion,
		AccordionContent,
		AccordionItem,
		AccordionTrigger
	} from '$lib/components/ui/accordion/index.js';
	import {
		CheckCircle,
		XCircle,
		User,
		Building2,
		Calendar,
		RefreshCw,
		Clock,
		AlertTriangle,
		Eye,
		Users,
		MapPin
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import type { Profile, Organisation, Event } from '$lib/types';

	let { data } = $props();
	let { supabase } = $derived(data);

	// State
	let loading = $state(true);
	let hasAccess = $state<boolean | null>(null);
	let pendingEvents = $state<Event[]>([]);
	let profileRequests = $state<Profile[]>([]);
	let organisationRequests = $state<Organisation[]>([]);
	let eventRequests = $state<Event[]>([]);
	let activeTab = $state('pending-events');
	let processing = $state(false);

	// Reference data for displaying human-readable values
	let studyLevels = $state<any[]>([]);
	let studySchools = $state<any[]>([]);
	let studyPrograms = $state<any[]>([]);
	let organisations = $state<any[]>([]);
	let eventStates = $state<any[]>([]);
	let eventModes = $state<any[]>([]);

	// Dialog state
	let showConfirmDialog = $state(false);
	let confirmAction = $state<() => Promise<void>>(() => Promise.resolve());
	let confirmTitle = $state('');
	let confirmDescription = $state('');

	// Derived counts for tabs
	const pendingEventCount = $derived(pendingEvents.length);
	const profileCount = $derived(profileRequests.length);
	const organisationCount = $derived(organisationRequests.length);
	const eventCount = $derived(eventRequests.length);
	const totalCount = $derived(pendingEventCount + profileCount + organisationCount + eventCount);

	onMount(async () => {
		const canAccess = await checkApprovalsAccess(supabase);
		hasAccess = canAccess;

		if (!canAccess) {
			goto('/forbidden');
			return;
		}

		await loadData();
	});

	async function loadData() {
		try {
			loading = true;

			// Load reference data, update requests, and pending events in parallel
			const [updateRequests, levels, schools, orgs, states, modes] = await Promise.all([
				getPendingUpdateRequests(supabase),
				getStudyLevels(supabase),
				getStudySchools(supabase),
				getOrganisations(supabase),
				getEventStates(supabase),
				getEventModes(supabase)
			]);

			// Load all study programs for all combinations of levels and schools
			const allPrograms = [];
			for (const level of levels) {
				for (const school of schools) {
					try {
						const programs = await getStudyProgramsBySchoolAndLevel(supabase,
							level.study_level_id,
							school.study_school_id
						);
						allPrograms.push(...programs);
					} catch (error) {
						// Some combinations might not exist, that's okay
						console.debug(`No programs found for level ${level.name} and school ${school.name}`);
					}
				}
			}

			// Log available event states to help debug
			console.log('Available event states:', states);

			// Try to find the pending state - it might be named differently
			const pendingState = states.find(
				(state) =>
					state.name.toLowerCase().includes('pending') ||
					state.name.toLowerCase().includes('waiting') ||
					state.name.toLowerCase().includes('approval')
			);

			console.log('Found pending state:', pendingState);

			// Load pending events using the correct state name
			let pendingEventsData;
			if (pendingState) {
				pendingEventsData = await getEvents(supabase, { event_state: pendingState.name });
				console.log('Pending events data:', pendingEventsData);
			} else {
				// Fallback: try common variations
				console.log('No pending state found, trying fallback...');
				try {
					pendingEventsData = await getEvents(supabase, { event_state: EVENT_STATES.PENDING });
				} catch {
					try {
						pendingEventsData = await getEvents(supabase, { event_state: 'pending' });
					} catch {
						console.warn('Could not find pending events state, loading all events for debugging');
						// Load all events for debugging
						pendingEventsData = await getEvents(supabase);
					}
				}
			}

			profileRequests = updateRequests.profileRequests;
			organisationRequests = updateRequests.organisationRequests;
			eventRequests = updateRequests.eventRequests;
			pendingEvents = pendingEventsData.events;

			// Debug: Log all events and their states
			console.log(
				'All loaded events:',
				pendingEventsData.events.map((e) => ({
					id: e.event_id,
					name: e.name,
					state: e.event_state?.name,
					organisation: e.organisation?.name
				}))
			);

			studyLevels = levels;
			studySchools = schools;
			studyPrograms = allPrograms;
			organisations = orgs;
			eventStates = states;
			eventModes = modes;
		} catch (error) {
			console.error('Error loading approvals data:', error);
			toast.error('Failed to load approvals data');
		} finally {
			loading = false;
		}
	}

	function formatDate(dateString: string | null | undefined) {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatDateTime(dateTimeString: string | null | undefined): string {
		if (!dateTimeString) return 'Not set';

		try {
			const date = new Date(dateTimeString);
			return date.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch (error) {
			return 'Invalid date';
		}
	}

	// Helper function to properly compare datetime values
	function isDateTimeDifferent(
		dateTime1: string | null | undefined,
		dateTime2: string | null | undefined
	): boolean {
		// If both are null/undefined, they're the same
		if (!dateTime1 && !dateTime2) return false;

		// If one is null/undefined and the other isn't, they're different
		if (!dateTime1 || !dateTime2) return true;

		try {
			const date1 = new Date(dateTime1);
			const date2 = new Date(dateTime2);

			// Compare the actual time values (in milliseconds)
			return date1.getTime() !== date2.getTime();
		} catch (error) {
			// If there's an error parsing dates, fall back to string comparison
			return dateTime1 !== dateTime2;
		}
	}
	function getEventStateColor(stateName: string) {
		switch (stateName?.toLowerCase()) {
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
			case 'published':
				return 'bg-blue-100 text-blue-800';
			case 'completed':
				return 'bg-purple-100 text-purple-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function handleViewEvent(eventId: string) {
		goto(`/events/${eventId}`);
	}

	function getDisplayValue(
		value: any,
		type:
			| 'studyLevel'
			| 'studySchool'
			| 'studyProgram'
			| 'organisation'
			| 'eventState'
			| 'eventMode'
			| 'gender'
			| 'intake'
	) {
		if (!value) return 'N/A';

		switch (type) {
			case 'studyLevel':
				return studyLevels.find((l) => l.study_level_id === value)?.name || value;
			case 'studySchool':
				return studySchools.find((s) => s.study_school_id === value)?.name || value;
			case 'studyProgram':
				return studyPrograms.find((p) => p.study_program_id === value)?.study_course?.name || value;
			case 'organisation':
				return organisations.find((o) => o.organisation_id === value)?.name || value;
			case 'eventState':
				return eventStates.find((s) => s.event_state_id === value)?.name || value;
			case 'eventMode':
				return eventModes.find((m) => m.event_mode_id === value)?.name || value;
			case 'gender':
				return value;
			case 'intake':
				return value === '2'
					? 'February'
					: value === '7'
						? 'July'
						: value === '10'
							? 'October'
							: value;
			default:
				return value;
		}
	}

	async function handleApproveProfile(profileId: string) {
		confirmTitle = 'Approve Profile Update';
		confirmDescription =
			'Are you sure you want to approve this profile update request? This action cannot be undone.';
		confirmAction = async () => {
			processing = true;
			try {
				const result = await approveProfileUpdate(supabase, profileId);
				if (result) {
					toast.success('Profile update approved successfully');
					await loadData();
				} else {
					toast.error('Failed to approve profile update');
				}
			} catch (error) {
				console.error('Error approving profile update:', error);
				toast.error('An error occurred while approving the profile update');
			} finally {
				processing = false;
				showConfirmDialog = false;
			}
		};
		showConfirmDialog = true;
	}

	async function handleRejectProfile(profileId: string) {
		confirmTitle = 'Reject Profile Update';
		confirmDescription =
			'Are you sure you want to reject this profile update request? The requested changes will be discarded.';
		confirmAction = async () => {
			processing = true;
			try {
				const result = await rejectProfileUpdate(supabase, profileId);
				if (result) {
					toast.success('Profile update rejected successfully');
					await loadData();
				} else {
					toast.error('Failed to reject profile update');
				}
			} catch (error) {
				console.error('Error rejecting profile update:', error);
				toast.error('An error occurred while rejecting the profile update');
			} finally {
				processing = false;
				showConfirmDialog = false;
			}
		};
		showConfirmDialog = true;
	}

	async function handleApproveOrganisation(organisationId: string) {
		confirmTitle = 'Approve Organisation Update';
		confirmDescription =
			'Are you sure you want to approve this organisation update request? This action cannot be undone.';
		confirmAction = async () => {
			processing = true;
			try {
				const result = await approveOrganisationUpdate(supabase, organisationId);
				if (result) {
					toast.success('Organisation update approved successfully');
					await loadData();
				} else {
					toast.error('Failed to approve organisation update');
				}
			} catch (error) {
				console.error('Error approving organisation update:', error);
				toast.error('An error occurred while approving the organisation update');
			} finally {
				processing = false;
				showConfirmDialog = false;
			}
		};
		showConfirmDialog = true;
	}

	async function handleRejectOrganisation(organisationId: string) {
		confirmTitle = 'Reject Organisation Update';
		confirmDescription =
			'Are you sure you want to reject this organisation update request? The requested changes will be discarded.';
		confirmAction = async () => {
			processing = true;
			try {
				const result = await rejectOrganisationUpdate(supabase, organisationId);
				if (result) {
					toast.success('Organisation update rejected successfully');
					await loadData();
				} else {
					toast.error('Failed to reject organisation update');
				}
			} catch (error) {
				console.error('Error rejecting organisation update:', error);
				toast.error('An error occurred while rejecting the organisation update');
			} finally {
				processing = false;
				showConfirmDialog = false;
			}
		};
		showConfirmDialog = true;
	}

	async function handleApproveEvent(eventId: string) {
		confirmTitle = 'Approve Event Update';
		confirmDescription =
			'Are you sure you want to approve this event update request? This action cannot be undone.';
		confirmAction = async () => {
			processing = true;
			try {
				const result = await approveEventUpdate(supabase, eventId);
				if (result) {
					toast.success('Event update approved successfully');
					await loadData();
				} else {
					toast.error('Failed to approve event update');
				}
			} catch (error) {
				console.error('Error approving event update:', error);
				toast.error('An error occurred while approving the event update');
			} finally {
				processing = false;
				showConfirmDialog = false;
			}
		};
		showConfirmDialog = true;
	}

	async function handleRejectEvent(eventId: string) {
		confirmTitle = 'Reject Event Update';
		confirmDescription =
			'Are you sure you want to reject this event update request? The requested changes will be discarded.';
		confirmAction = async () => {
			processing = true;
			try {
				const result = await rejectEventUpdate(supabase, eventId);
				if (result) {
					toast.success('Event update rejected successfully');
					await loadData();
				} else {
					toast.error('Failed to reject event update');
				}
			} catch (error) {
				console.error('Error rejecting event update:', error);
				toast.error('An error occurred while rejecting the event update');
			} finally {
				processing = false;
				showConfirmDialog = false;
			}
		};
		showConfirmDialog = true;
	}
</script>

<svelte:head>
	<title>Approvals - SEMS</title>
	<meta
		name="description"
		content="Review and approve pending profile updates, organisation changes, and event modifications."
	/>
	<meta name="keywords" content="approvals, review requests, admin panel, profile updates" />
	<meta property="og:title" content="Approvals - SEMS" />
	<meta
		property="og:description"
		content="Review and approve pending profile updates, organisation changes, and event modifications."
	/>
	<meta property="og:type" content="website" />
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href="/approvals" />
</svelte:head>

{#snippet profileAccordionContent(profile: Profile)}
	{@const updateRequest = profile.profile_update_request}
	<div class="space-y-6 border-t border-gray-100 pt-4">
		<div class="grid gap-6 md:grid-cols-2">
			<!-- Current Values -->
			<div>
				<h4 class="mb-3 font-semibold text-gray-900">Current Values</h4>
				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-gray-600">Full Name:</span>
						<span>{profile.full_name || 'N/A'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Student ID:</span>
						<span>{profile.student_id || 'N/A'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Gender:</span>
						<span>{profile.gender || 'N/A'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Enrolment Year:</span>
						<span>{profile.enrolment_year || 'N/A'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Enrolment Intake:</span>
						<span>{getDisplayValue(profile.enrolment_intake?.toString(), 'intake')}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Study Level:</span>
						<span>{profile.study_program?.study_level?.name || 'N/A'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">School:</span>
						<span>{profile.study_program?.study_school?.name || 'N/A'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Program:</span>
						<span>{profile.study_program?.study_course?.name || 'N/A'}</span>
					</div>
				</div>
			</div>

			<!-- Requested Changes -->
			<div>
				<h4 class="mb-3 font-semibold text-gray-900">Requested Changes</h4>
				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-gray-600">Full Name:</span>
						<span class:text-blue-600={updateRequest.full_name !== profile.full_name}>
							{updateRequest.full_name || 'N/A'}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Student ID:</span>
						<span class:text-blue-600={updateRequest.student_id !== profile.student_id}>
							{updateRequest.student_id || 'N/A'}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Gender:</span>
						<span class:text-blue-600={updateRequest.gender !== profile.gender}>
							{updateRequest.gender || 'N/A'}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Enrolment Year:</span>
						<span class:text-blue-600={updateRequest.enrolment_year !== profile.enrolment_year}>
							{updateRequest.enrolment_year || 'N/A'}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Enrolment Intake:</span>
						<span class:text-blue-600={updateRequest.enrolment_intake !== profile.enrolment_intake}>
							{getDisplayValue(updateRequest.enrolment_intake?.toString(), 'intake')}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Study Level:</span>
						<span
							class:text-blue-600={updateRequest.study_level_id !==
								profile.study_program?.study_level_id}
						>
							{getDisplayValue(updateRequest.study_level_id, 'studyLevel')}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">School:</span>
						<span
							class:text-blue-600={updateRequest.study_school_id !==
								profile.study_program?.study_school_id}
						>
							{getDisplayValue(updateRequest.study_school_id, 'studySchool')}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Program:</span>
						<span
							class:text-blue-600={updateRequest.study_program_id !==
								profile.study_program?.study_program_id}
						>
							{getDisplayValue(updateRequest.study_program_id, 'studyProgram')}
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="flex justify-end gap-2 border-t border-gray-200 pt-4">
			<Button
				variant="outline"
				size="sm"
				onclick={() => handleRejectProfile(profile.profile_id)}
				disabled={processing}
			>
				<XCircle class="mr-2 h-4 w-4" />
				Reject
			</Button>
			<Button
				size="sm"
				onclick={() => handleApproveProfile(profile.profile_id)}
				disabled={processing}
			>
				<CheckCircle class="mr-2 h-4 w-4" />
				Approve
			</Button>
		</div>
	</div>
{/snippet}

{#snippet organisationAccordionContent(organisation: Organisation)}
	{@const updateRequest = organisation.organisation_update_request}
	<div class="space-y-6 border-t border-gray-100 pt-4">
		<div class="grid gap-6 md:grid-cols-2">
			<!-- Current Values -->
			<div>
				<h4 class="mb-3 font-semibold text-gray-900">Current Values</h4>
				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-gray-600">Name:</span>
						<span>{organisation.name}</span>
					</div>
					<div>
						<span class="text-gray-600">Description:</span>
						<p class="mt-1 text-gray-900">{organisation.description || 'No description'}</p>
					</div>
				</div>
			</div>

			<!-- Requested Changes -->
			<div>
				<h4 class="mb-3 font-semibold text-gray-900">Requested Changes</h4>
				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-gray-600">Name:</span>
						<span class:text-blue-600={updateRequest.name !== organisation.name}>
							{updateRequest.name}
						</span>
					</div>
					<div>
						<span class="text-gray-600">Description:</span>
						<p
							class="mt-1"
							class:text-blue-600={updateRequest.description !== organisation.description}
						>
							{updateRequest.description || 'No description'}
						</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="flex justify-end gap-2 border-t border-gray-200 pt-4">
			<Button
				variant="outline"
				size="sm"
				onclick={() => handleRejectOrganisation(organisation.organisation_id)}
				disabled={processing}
			>
				<XCircle class="mr-2 h-4 w-4" />
				Reject
			</Button>
			<Button
				size="sm"
				onclick={() => handleApproveOrganisation(organisation.organisation_id)}
				disabled={processing}
			>
				<CheckCircle class="mr-2 h-4 w-4" />
				Approve
			</Button>
		</div>
	</div>
{/snippet}

{#snippet eventAccordionContent(event: Event)}
	{@const updateRequest = event.event_update_request}
	<div class="space-y-6 border-t border-gray-100 pt-4">
		<div class="grid gap-6 md:grid-cols-2">
			<!-- Current Values -->
			<div>
				<h4 class="mb-3 font-semibold text-gray-900">Current Values</h4>
				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-gray-600">Name:</span>
						<span>{event.name}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Venue:</span>
						<span>{event.venue || 'N/A'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Capacity:</span>
						<span>{event.capacity || 'Unlimited'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Start Date:</span>
						<span>{formatDate(event.start_datetime)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">End Date:</span>
						<span>{formatDate(event.end_datetime)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Registration Opens:</span>
						<span>{formatDate(event.registration_opening_datetime)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Registration Closes:</span>
						<span>{formatDate(event.registration_closing_datetime)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Event Mode:</span>
						<span>{event.event_mode?.name || 'N/A'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Registration URL:</span>
						<span>{event.registration_url || 'None'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Feedback URL:</span>
						<span>{event.feedback_url || 'None'}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Registration Secret Code:</span>
						<span>{event.registration_secret_code || 'None'}</span>
					</div>
					<div>
						<span class="text-gray-600">Description:</span>
						<p class="mt-1 text-gray-900">{event.description || 'No description'}</p>
					</div>
					<div>
						<span class="text-gray-600">Note to Registrants:</span>
						<p class="mt-1 text-gray-900">{event.note_to_registrants || 'None'}</p>
					</div>
				</div>
			</div>

			<!-- Requested Changes -->
			<div>
				<h4 class="mb-3 font-semibold text-gray-900">Requested Changes</h4>
				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-gray-600">Name:</span>
						<span class:text-blue-600={updateRequest.name !== event.name}>
							{updateRequest.name}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Venue:</span>
						<span class:text-blue-600={updateRequest.venue !== event.venue}>
							{updateRequest.venue || 'N/A'}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Capacity:</span>
						<span class:text-blue-600={updateRequest.capacity !== event.capacity}>
							{updateRequest.capacity || 'Unlimited'}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Start Date:</span>
						<span
							class:text-blue-600={isDateTimeDifferent(
								updateRequest.start_datetime,
								event.start_datetime
							)}
						>
							{formatDate(updateRequest.start_datetime)}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">End Date:</span>
						<span
							class:text-blue-600={isDateTimeDifferent(
								updateRequest.end_datetime,
								event.end_datetime
							)}
						>
							{formatDate(updateRequest.end_datetime)}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Registration Opens:</span>
						<span
							class:text-blue-600={isDateTimeDifferent(
								updateRequest.registration_opening_datetime,
								event.registration_opening_datetime
							)}
						>
							{formatDate(updateRequest.registration_opening_datetime)}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Registration Closes:</span>
						<span
							class:text-blue-600={isDateTimeDifferent(
								updateRequest.registration_closing_datetime,
								event.registration_closing_datetime
							)}
						>
							{formatDate(updateRequest.registration_closing_datetime)}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Event Mode:</span>
						<span class:text-blue-600={updateRequest.event_mode_id !== event.event_mode_id}>
							{getDisplayValue(updateRequest.event_mode_id, 'eventMode')}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Registration URL:</span>
						<span class:text-blue-600={updateRequest.registration_url !== event.registration_url}>
							{updateRequest.registration_url || 'None'}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Feedback URL:</span>
						<span class:text-blue-600={updateRequest.feedback_url !== event.feedback_url}>
							{updateRequest.feedback_url || 'None'}
						</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Registration Secret Code:</span>
						<span
							class:text-blue-600={updateRequest.registration_secret_code !==
								event.registration_secret_code}
						>
							{updateRequest.registration_secret_code || 'None'}
						</span>
					</div>
					<div>
						<span class="text-gray-600">Description:</span>
						<p class="mt-1" class:text-blue-600={updateRequest.description !== event.description}>
							{updateRequest.description || 'No description'}
						</p>
					</div>
					<div>
						<span class="text-gray-600">Note to Registrants:</span>
						<p
							class="mt-1"
							class:text-blue-600={updateRequest.note_to_registrants !== event.note_to_registrants}
						>
							{updateRequest.note_to_registrants || 'None'}
						</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="flex justify-end gap-2 border-t border-gray-200 pt-4">
			<Button
				variant="outline"
				size="sm"
				onclick={() => handleRejectEvent(event.event_id)}
				disabled={processing}
			>
				<XCircle class="mr-2 h-4 w-4" />
				Reject
			</Button>
			<Button size="sm" onclick={() => handleApproveEvent(event.event_id)} disabled={processing}>
				<CheckCircle class="mr-2 h-4 w-4" />
				Approve
			</Button>
		</div>
	</div>
{/snippet}

<div class="container mx-auto max-w-7xl px-4 py-8">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-3xl font-bold text-gray-900">Update Approvals</h1>
			<p class="mt-1 text-gray-600">Review and manage pending approvals and update requests.</p>
		</div>
		<div class="flex gap-2 sm:flex-shrink-0">
			<Button variant="outline" onclick={loadData} disabled={loading} class="w-full sm:w-auto">
				<RefreshCw class={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
				Refresh
			</Button>
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
			<span class="ml-2">Loading update requests...</span>
		</div>
	{:else if hasAccess === false}
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center">
			<AlertTriangle class="mx-auto mb-4 h-12 w-12 text-yellow-500" />
			<h3 class="mb-2 text-xl font-semibold">Access Denied</h3>
			<p class="text-gray-600">You don't have permission to access the approvals page.</p>
		</div>
	{:else}
		<!-- Summary Stats -->
		<div class="mb-6 grid gap-4 md:grid-cols-4">
			<div class="rounded-lg border border-gray-200 bg-white p-6">
				<div class="flex items-center">
					<div class="rounded-full bg-yellow-100 p-3">
						<Calendar class="h-6 w-6 text-yellow-600" />
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-600">Pending Events</p>
						<p class="text-2xl font-bold text-gray-900">{pendingEventCount}</p>
					</div>
				</div>
			</div>

			<div class="rounded-lg border border-gray-200 bg-white p-6">
				<div class="flex items-center">
					<div class="rounded-full bg-purple-100 p-3">
						<Calendar class="h-6 w-6 text-purple-600" />
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-600">Event Requests</p>
						<p class="text-2xl font-bold text-gray-900">{eventCount}</p>
					</div>
				</div>
			</div>

			<div class="rounded-lg border border-gray-200 bg-white p-6">
				<div class="flex items-center">
					<div class="rounded-full bg-green-100 p-3">
						<Building2 class="h-6 w-6 text-green-600" />
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-600">Organisation Requests</p>
						<p class="text-2xl font-bold text-gray-900">{organisationCount}</p>
					</div>
				</div>
			</div>

			<div class="rounded-lg border border-gray-200 bg-white p-6">
				<div class="flex items-center">
					<div class="rounded-full bg-blue-100 p-3">
						<User class="h-6 w-6 text-blue-600" />
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-600">Profile Requests</p>
						<p class="text-2xl font-bold text-gray-900">{profileCount}</p>
					</div>
				</div>
			</div>

			<!-- <div class="rounded-lg border border-gray-200 bg-white p-6">
				<div class="flex items-center">
					<div class="rounded-full bg-orange-100 p-3">
						<Clock class="h-6 w-6 text-orange-600" />
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-600">Total Pending</p>
						<p class="text-2xl font-bold text-gray-900">{totalCount}</p>
					</div>
				</div>
			</div> -->
		</div>

		<!-- Tabs for different request types -->
		<Tabs.Root bind:value={activeTab} class="w-full">
			<Tabs.List class="grid w-full grid-cols-4">
				<Tabs.Trigger value="pending-events" class="relative">
					<div class="flex items-center gap-2">
						<Calendar class="h-4 w-4 sm:hidden" />
						<span class="hidden sm:inline">Pending Events</span>
						<!-- <span class="sm:hidden">Events</span> -->
						{#if pendingEventCount > 0}
							<Badge variant="destructive" class="h-5 min-w-5 text-xs">
								{pendingEventCount}
							</Badge>
						{/if}
					</div>
				</Tabs.Trigger>
				<Tabs.Trigger value="events" class="relative">
					<div class="flex items-center gap-2">
						<Calendar class="h-4 w-4 sm:hidden" />
						<span class="hidden sm:inline">Event Updates</span>
						<!-- <span class="sm:hidden">Updates</span> -->
						{#if eventCount > 0}
							<Badge variant="destructive" class="h-5 min-w-5 text-xs">
								{eventCount}
							</Badge>
						{/if}
					</div>
				</Tabs.Trigger>
				<Tabs.Trigger value="organisations" class="relative">
					<div class="flex items-center gap-2">
						<Building2 class="h-4 w-4 sm:hidden" />
						<span class="hidden sm:inline">Organisation Updates</span>
						<!-- <span class="sm:hidden">Orgs</span> -->
						{#if organisationCount > 0}
							<Badge variant="destructive" class="h-5 min-w-5 text-xs">
								{organisationCount}
							</Badge>
						{/if}
					</div>
				</Tabs.Trigger>
				<Tabs.Trigger value="profiles" class="relative">
					<div class="flex items-center gap-2">
						<User class="h-4 w-4 sm:hidden" />
						<span class="hidden sm:inline">Profile Updates</span>
						<!-- <span class="sm:hidden">Profiles</span> -->
						{#if profileCount > 0}
							<Badge variant="destructive" class="h-5 min-w-5 text-xs">
								{profileCount}
							</Badge>
						{/if}
					</div>
				</Tabs.Trigger>
			</Tabs.List>

			<!-- Pending Events Tab -->
			<Tabs.Content value="pending-events" class="mt-6">
				<!-- Debug info -->
				<!-- {#if pendingEvents.length === 0}
					<div class="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
						<h4 class="font-medium text-blue-900">Debug Info:</h4>
						<p class="text-sm text-blue-700">
							Pending events count: {pendingEvents.length}
						</p>
						<p class="text-sm text-blue-700">
							Available event states: {eventStates.map((s) => s.name).join(', ')}
						</p>
						<p class="text-sm text-blue-700">
							Looking for events with states containing: pending, waiting, or approval
						</p>
						<details class="mt-2">
							<summary class="cursor-pointer text-sm font-medium text-blue-900"
								>Show Raw Data</summary
							>
							<pre class="mt-2 max-h-40 overflow-auto text-xs text-blue-800">{JSON.stringify(
									{ pendingEvents, eventStates },
									null,
									2
								)}</pre>
						</details>
					</div>
				{/if} -->

				{#if pendingEvents.length === 0}
					<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
						<Calendar class="mx-auto mb-4 h-12 w-12 text-gray-400" />
						<h3 class="text-lg font-medium text-gray-900">No pending events</h3>
						<p class="mt-2 text-gray-600">All events have been approved or are in other states.</p>
					</div>
				{:else}
					<div class="overflow-x-auto rounded-lg border border-gray-200">
						<Table>
							<TableHeader>
								<TableRow class="bg-muted/50">
									<TableHead class="w-1/4 min-w-[200px]">Event</TableHead>
									<TableHead class="w-1/6 min-w-[150px]">Organisation</TableHead>
									<TableHead class="w-1/6 min-w-[120px]">State</TableHead>
									<TableHead class="w-1/6 min-w-[150px]">Start Date</TableHead>
									<TableHead class="w-1/12 min-w-[80px]">Registrations</TableHead>
									<TableHead class="w-1/4 min-w-[200px] text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each pendingEvents as event}
									<TableRow>
										<TableCell class="max-w-0 font-medium">
											<div class="space-y-1">
												<div class="truncate font-medium" title={event.name}>
													{event.name}
												</div>
												<!-- {#if event.venue}
													<div class="flex items-center gap-1 text-sm text-gray-500">
														<MapPin class="h-3 w-3" />
														<span class="truncate" title={event.venue}>{event.venue}</span>
													</div>
												{/if} -->
											</div>
										</TableCell>
										<TableCell class="max-w-0">
											<div class="truncate" title={event.organisation?.name}>
												{event.organisation?.name || 'Unknown'}
											</div>
										</TableCell>
										<TableCell>
											<Badge class={getEventStateColor(event.event_state?.name || '')}>
												{event.event_state?.name || 'Unknown'}
											</Badge>
										</TableCell>
										<TableCell class="text-sm">
											{#if event.start_datetime}
												<div class="flex items-center gap-1">
													{formatDateTime(event.start_datetime)}
												</div>
											{:else}
												<span class="text-gray-400">Not set</span>
											{/if}
										</TableCell>
										<TableCell class="text-center">
											<div class="flex items-center justify-center gap-1">
												<Users class="h-3 w-3" />
												<span>{event.registration_count || 0}</span>
												{#if event.capacity}
													<span class="text-gray-400">/{event.capacity}</span>
												{/if}
											</div>
										</TableCell>
										<TableCell class="text-right">
											<div class="flex min-w-0 items-center justify-end gap-2">
												<Button
													variant="outline"
													size="sm"
													onclick={() => handleViewEvent(event.event_id)}
													class="flex shrink-0 items-center gap-1"
												>
													<Eye class="h-3 w-3" />
													<span class="hidden sm:inline">View</span>
												</Button>
											</div>
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					</div>
				{/if}
			</Tabs.Content>

			<!-- Event Update Requests -->
			<Tabs.Content value="events" class="mt-6">
				{#if eventRequests.length === 0}
					<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
						<Calendar class="mx-auto mb-4 h-12 w-12 text-gray-400" />
						<h3 class="text-lg font-medium text-gray-900">No pending event requests</h3>
						<p class="mt-2 text-gray-600">All event update requests have been reviewed.</p>
					</div>
				{:else}
					<Accordion type="multiple" class="w-full space-y-3">
						{#each eventRequests as event (event.event_id)}
							{@const updateRequest = event.event_update_request}
							<AccordionItem
								value={event.event_id.toString()}
								class="rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
							>
								<AccordionTrigger
									class="rounded-t-lg px-6 py-4 transition-colors duration-200 hover:bg-gray-50 hover:no-underline [&>svg]:hidden"
								>
									<div class="flex w-full items-center justify-between">
										<div class="text-left">
											<h3 class="text-base font-semibold">{event.name}</h3>
										</div>
										<div class="space-y-1 text-sm text-gray-600">
											<p>{event.organisation?.name}</p>
										</div>
									</div>
								</AccordionTrigger>
								<AccordionContent class="px-6 pb-6">
									{@render eventAccordionContent(event)}
								</AccordionContent>
							</AccordionItem>
						{/each}
					</Accordion>
				{/if}
			</Tabs.Content>

			<!-- Organisation Update Requests -->
			<Tabs.Content value="organisations" class="mt-6">
				{#if organisationRequests.length === 0}
					<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
						<Building2 class="mx-auto mb-4 h-12 w-12 text-gray-400" />
						<h3 class="text-lg font-medium text-gray-900">No pending organisation requests</h3>
						<p class="mt-2 text-gray-600">All organisation update requests have been reviewed.</p>
					</div>
				{:else}
					<Accordion type="multiple" class="w-full space-y-3">
						{#each organisationRequests as organisation (organisation.organisation_id)}
							{@const updateRequest = organisation.organisation_update_request}
							<AccordionItem
								value={organisation.organisation_id.toString()}
								class="rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
							>
								<AccordionTrigger
									class="rounded-t-lg px-6 py-4 transition-colors duration-200 hover:bg-gray-50 hover:no-underline [&>svg]:hidden"
								>
									<div class="flex w-full items-center justify-between">
										<div class="text-left">
											<h3 class="text-base font-semibold">{organisation.name}</h3>
										</div>
									</div>
								</AccordionTrigger>
								<AccordionContent class="px-6 pb-6">
									{@render organisationAccordionContent(organisation)}
								</AccordionContent>
							</AccordionItem>
						{/each}
					</Accordion>
				{/if}
			</Tabs.Content>

			<!-- Profile Update Requests -->
			<Tabs.Content value="profiles" class="mt-6">
				{#if profileRequests.length === 0}
					<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
						<User class="mx-auto mb-4 h-12 w-12 text-gray-400" />
						<h3 class="text-lg font-medium text-gray-900">No pending profile requests</h3>
						<p class="mt-2 text-gray-600">All profile update requests have been reviewed.</p>
					</div>
				{:else}
					<Accordion type="multiple" class="w-full space-y-3">
						{#each profileRequests as profile (profile.profile_id)}
							{@const updateRequest = profile.profile_update_request}
							<AccordionItem
								value={profile.profile_id.toString()}
								class="rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
							>
								<AccordionTrigger
									class="rounded-t-lg px-6 py-4 transition-colors duration-200 hover:bg-gray-50 hover:no-underline [&>svg]:hidden"
								>
									<div class="flex w-full items-center justify-between">
										<div class="text-left">
											<h3 class="text-base font-semibold">
												{profile.full_name || 'Unnamed Profile'}
											</h3>
										</div>
									</div>
								</AccordionTrigger>
								<AccordionContent class="px-6 pb-6">
									{@render profileAccordionContent(profile)}
								</AccordionContent>
							</AccordionItem>
						{/each}
					</Accordion>
				{/if}
			</Tabs.Content>
		</Tabs.Root>
	{/if}
</div>

<!-- Confirmation Dialog -->
<AlertDialog.Root bind:open={showConfirmDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{confirmTitle}</AlertDialog.Title>
			<AlertDialog.Description>
				{confirmDescription}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={confirmAction} disabled={processing}>
				{#if processing}
					<div class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
				{/if}
				Continue
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
