<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		getEventsForUserOrganisations,
		getUserLeadershipOrganisations,
		getEventStates,
		getEvents
	} from '$lib/database';
	import { getUserProfile, isUserAdmin } from '$lib/auth';
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
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table/index.js';
	import { toast } from 'svelte-sonner';
	import {
		Calendar,
		Plus,
		Users,
		Edit,
		Search,
		Filter,
		MapPin,
		Clock,
		Building2,
		Eye,
		RefreshCw,
		Shield
	} from '@lucide/svelte';
	import type { Event, Organisation, EventState } from '$lib/types';

	let { data } = $props();
	let { supabase } = $derived(data);

	let events: Event[] = $state([]);
	let userOrganisations: Organisation[] = $state([]);
	let eventStates: EventState[] = $state([]);
	let loading = $state(true);
	let userProfile: any = $state(null);
	let isAdmin = $state(false);
	let adminViewMode = $state(true); // true = admin view (all events), false = organiser view

	// Search and filter state
	let searchTerm = $state('');
	let selectedOrganisation = $state('all');
	let selectedEventState = $state('all');
	let filteredEvents = $state<Event[]>([]);

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		loading = true;
		try {
			console.log('Loading events data...');
			const profile = await getUserProfile(supabase);

			if (!profile?.profile?.profile_id) {
				console.error('No user profile found');
				toast.error('Unable to load user profile');
				loading = false;
				return;
			}

			userProfile = profile;
			console.log('User profile loaded:', profile);

			// Check if user is admin
			isAdmin = await isUserAdmin(supabase);
			console.log('Is admin:', isAdmin);

			// Load event states
			const states = await getEventStates(supabase);
			eventStates = states;
			console.log('Event states loaded:', states);

			if (isAdmin && adminViewMode) {
				// Admin view: load all events from all organisations
				console.log('Loading all events (admin view)...');
				const { events: allEvents } = await getEvents(supabase);
				events = allEvents;
				console.log('All events loaded for admin:', allEvents);

				// For admin view, extract unique organisations from all events
				const uniqueOrgs = allEvents.reduce((acc: Organisation[], event) => {
					if (
						event.organisation &&
						!acc.find((org) => org.organisation_id === event.organisation_id)
					) {
						acc.push({
							organisation_id: event.organisation_id,
							name: event.organisation.name,
							description: event.organisation.description
						} as Organisation);
					}
					return acc;
				}, []);
				userOrganisations = uniqueOrgs;
				console.log('All organisations extracted:', uniqueOrgs);
			} else {
				// Organizer view: load user's leadership organisations and their events
				console.log('Loading leadership organisations and their events...');
				const orgs = await getUserLeadershipOrganisations(supabase, profile.profile.profile_id);
				userOrganisations = orgs;
				console.log('User leadership organisations:', orgs);

				// Load events for user's organisations
				console.log('Loading events for user organisations...');
				const { events: userEvents } = await getEventsForUserOrganisations(supabase,
					profile.profile.profile_id
				);
				events = userEvents;
				console.log('User events loaded:', userEvents);
			}

			console.log('Final data - User organisations:', $state.snapshot(userOrganisations));
			console.log('Final data - Events loaded:', $state.snapshot(events));
		} catch (error) {
			console.error('Error loading data:', error);
			toast.error('Failed to load events data');
		} finally {
			loading = false;
			console.log('Loading complete, setting loading to false');
		}
	}

	async function setViewMode(isAdminView: boolean) {
		if (adminViewMode === isAdminView) return; // Don't reload if same view

		adminViewMode = isAdminView;
		// Reset filters when switching views
		searchTerm = '';
		selectedOrganisation = 'all';
		selectedEventState = 'all';
		// Reload data with new view mode
		await loadData();
	}

	function handleCreateEvent() {
		goto('/event-create');
	}

	function handleEditEvent(eventId: string) {
		goto(`/events/edit/${eventId}`);
	}

	function handleViewEvent(eventId: string) {
		goto(`/events/${eventId}`);
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
		} catch {
			return 'Invalid date';
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

	// Filter events based on search term and filters
	$effect(() => {
		let filtered = events;

		// Filter by search term
		if (searchTerm.trim()) {
			const searchLower = searchTerm.toLowerCase();
			filtered = filtered.filter((event) => {
				const name = event.name?.toLowerCase() || '';
				const description = event.description?.toLowerCase() || '';
				const venue = event.venue?.toLowerCase() || '';
				const orgName = event.organisation?.name?.toLowerCase() || '';

				return (
					name.includes(searchLower) ||
					description.includes(searchLower) ||
					venue.includes(searchLower) ||
					orgName.includes(searchLower)
				);
			});
		}

		// Filter by organisation
		if (selectedOrganisation && selectedOrganisation !== 'all') {
			filtered = filtered.filter((event) => event.organisation_id === selectedOrganisation);
		}

		// Filter by event state
		if (selectedEventState && selectedEventState !== 'all') {
			filtered = filtered.filter((event) => event.event_state?.name === selectedEventState);
		}

		// Sort by start date in descending order (most recent first)
		filtered = filtered.sort((a, b) => {
			const dateA = a.start_datetime ? new Date(a.start_datetime).getTime() : 0;
			const dateB = b.start_datetime ? new Date(b.start_datetime).getTime() : 0;
			return dateB - dateA; // Descending order (most recent first)
		});

		filteredEvents = filtered;
	});
</script>

<svelte:head>
	<title>Event Management - SEMS</title>
	<meta
		name="description"
		content="Manage and organise student events. Create, edit, and monitor events for your organisation."
	/>
	<meta
		name="keywords"
		content="event management, organise events, create events, student organisation"
	/>
	<meta property="og:title" content="Event Management - SEMS" />
	<meta
		property="og:description"
		content="Manage and organise student events. Create, edit, and monitor events for your organisation."
	/>
	<meta property="og:type" content="website" />
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href="/event-management" />
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
		<div>
			<div class="flex items-center gap-3">
				<h1 class="text-3xl font-bold text-gray-900">Event Management</h1>
			</div>
			<p class="mt-2 text-gray-600">
				{#if isAdmin && adminViewMode}
					Manage all events across all organisations.
				{:else}
					Manage events for your organisations.
				{/if}
			</p>
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
			{#if isAdmin}
				<Button
					variant={adminViewMode ? 'destructive' : 'default'}
					onclick={() => setViewMode(!adminViewMode)}
					disabled={loading}
					class="flex-1 sm:w-auto sm:flex-initial"
				>
					{adminViewMode ? 'Admin View' : 'Organizer View'}
				</Button>
			{/if}
			<Button onclick={handleCreateEvent} class="flex-1 sm:w-auto sm:flex-initial">
				<Plus class="h-4 w-4" />
				Create Event
			</Button>
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
			<span class="ml-2">Loading events...</span>
		</div>
	{:else if (!isAdmin || !adminViewMode) && userOrganisations.length === 0}
		<Card>
			<CardContent class="pt-6">
				<div class="py-8 text-center">
					<Building2 class="mx-auto mb-4 h-12 w-12 text-gray-400" />
					<h3 class="mb-2 text-lg font-medium text-gray-900">No Leadership Roles</h3>
					<p class="mb-4 text-gray-600">
						You need to be an owner or leader of an organisation to manage events.
					</p>
					<p class="text-sm text-gray-500">
						Contact an organisation owner to request leadership access.
					</p>
				</div>
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
				<!-- <CardDescription>Find and filter events across your organisations.</CardDescription> -->
			</CardHeader>
			<CardContent>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<!-- Search Input -->
					<div>
						<Label for="event-search">Search Events</Label>
						<div class="relative mt-2">
							<Search
								class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400"
							/>
							<Input
								id="event-search"
								type="text"
								placeholder="Search by name, description, venue..."
								bind:value={searchTerm}
								class="pl-10"
							/>
						</div>
					</div>

					<!-- Organisation Filter -->
					<div>
						<Label for="org-filter">
							{#if isAdmin && adminViewMode}
								Organisation
							{:else}
								Your Organisations
							{/if}
						</Label>
						<Select.Root
							type="single"
							value={selectedOrganisation}
							onValueChange={(value) => {
								if (value !== undefined) selectedOrganisation = value;
							}}
						>
							<Select.Trigger class="mt-2 w-full">
								{selectedOrganisation === 'all' || !selectedOrganisation
									? isAdmin && adminViewMode
										? 'All Organisations'
										: 'All Your Organisations'
									: userOrganisations.find((org) => org.organisation_id === selectedOrganisation)
											?.name ||
										(isAdmin && adminViewMode ? 'All Organisations' : 'All Your Organisations')}
							</Select.Trigger>
							<Select.Content>
								<Select.Group>
									<Select.Item value="all">
										{isAdmin && adminViewMode ? 'All Organisations' : 'All Your Organisations'}
									</Select.Item>
									{#each userOrganisations as org}
										<Select.Item value={org.organisation_id}>{org.name}</Select.Item>
									{/each}
								</Select.Group>
							</Select.Content>
						</Select.Root>
					</div>

					<!-- Event State Filter -->
					<div>
						<Label for="state-filter">Event State</Label>
						<Select.Root
							type="single"
							value={selectedEventState}
							onValueChange={(value) => {
								if (value !== undefined) selectedEventState = value;
							}}
						>
							<Select.Trigger class="mt-2 w-full">
								{selectedEventState === 'all' || !selectedEventState
									? 'All States'
									: selectedEventState}
							</Select.Trigger>
							<Select.Content>
								<Select.Group>
									<Select.Item value="all">All States</Select.Item>
									{#each eventStates as state}
										<Select.Item value={state.name}>{state.name}</Select.Item>
									{/each}
								</Select.Group>
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				{#if searchTerm || (selectedOrganisation && selectedOrganisation !== 'all') || (selectedEventState && selectedEventState !== 'all')}
					<div class="mt-4 flex items-center justify-between">
						<p class="text-sm text-gray-600">
							Showing {filteredEvents.length} of {events.length} events
						</p>
						<Button
							variant="outline"
							size="sm"
							onclick={() => {
								searchTerm = '';
								selectedOrganisation = 'all';
								selectedEventState = 'all';
							}}
						>
							Clear Filters
						</Button>
					</div>
				{/if}
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Calendar class="h-5 w-5" />
					Events
				</CardTitle>
				<CardDescription>
					{#if isAdmin && adminViewMode}
						All events from all organisations.
					{:else}
						Events from organisations where you have leadership roles.
					{/if}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{#if filteredEvents.length === 0 && events.length === 0}
					<div class="py-8 text-center">
						<Calendar class="mx-auto mb-4 h-12 w-12 text-gray-400" />
						<h3 class="mb-2 text-lg font-medium text-gray-900">No Events</h3>
						<p class="mb-4 text-gray-600">Get started by creating your first event.</p>
						<Button onclick={handleCreateEvent} class="mx-auto flex items-center gap-2">
							<Plus class="h-4 w-4" />
							Create Event
						</Button>
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
								selectedOrganisation = 'all';
								selectedEventState = 'all';
							}}
						>
							Clear Filters
						</Button>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead class="w-1/4 min-w-[200px]">Event</TableHead>
									<TableHead class="w-1/6 min-w-[150px]">Organisation</TableHead>
									<TableHead class="w-1/6 min-w-[120px]">State</TableHead>
									<TableHead class="w-1/6 min-w-[150px]">Start Date</TableHead>
									<TableHead class="w-1/12 min-w-[80px]">Registrations</TableHead>
									<TableHead class="w-1/4 min-w-[200px] text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each filteredEvents as event}
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
												<!-- <Button
													variant="outline"
													size="sm"
													onclick={() => handleEditEvent(event.event_id)}
													class="flex shrink-0 items-center gap-1"
												>
													<Edit class="h-3 w-3" />
													<span class="hidden sm:inline">Edit</span>
												</Button> -->
											</div>
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					</div>
				{/if}
			</CardContent>
		</Card>
	{/if}
</div>
