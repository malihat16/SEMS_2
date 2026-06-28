<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		getEventById,
		getEventRegistrations,
		markAttendance,
		unmarkAttendance
	} from '$lib/database';
	import { getUserProfile } from '$lib/auth';
	import { canViewEventParticipants, canManageEventParticipants } from '$lib/permissions';
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
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table/index.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle,
		DialogTrigger
	} from '$lib/components/ui/dialog/index.js';

	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle,
		AlertDialogTrigger
	} from '$lib/components/ui/alert-dialog/index.js';
	import { toast } from 'svelte-sonner';
	import {
		ArrowLeft,
		Users,
		Search,
		Filter,
		RefreshCw,
		CheckCircle2,
		XCircle,
		User,
		Calendar,
		GraduationCap,
		Building,
		Clock
	} from '@lucide/svelte';
	import type { Event, Registration } from '$lib/types';

	let { data } = $props();
	let { supabase } = $derived(data);

	let eventId = $state('');
	let event: Event | null = $state(null);
	let registrations: Registration[] = $state([]);
	let loading = $state(true);
	let userProfile: any = $state(null);

	// Permission states
	let canView = $state(false);
	let canManage = $state(false);

	// Search and filter state
	let searchTerm = $state('');
	let filterAttendance = $state('');
	let filteredRegistrations = $state<Registration[]>([]);

	// Attendance management state
	let attendanceProcessing = $state<{ [key: string]: boolean }>({});

	onMount(async () => {
		eventId = $page.params?.id || '';
		await loadData();
	});

	async function loadData() {
		loading = true;
		try {
			// Check permission to view participants first
			const canViewParticipants = await canViewEventParticipants(supabase, eventId);
			if (!canViewParticipants) {
				goto('/forbidden');
				return;
			}

			const [profile, eventData, registrationData] = await Promise.all([
				getUserProfile(supabase),
				getEventById(supabase, eventId),
				getEventRegistrations(supabase, eventId)
			]);

			userProfile = profile;
			event = eventData;
			registrations = registrationData;

			if (!event) {
				goto('/events');
				return;
			}

			// Set permissions
			canView = true; // Already checked above
			canManage = await canManageEventParticipants(supabase, eventId);
		} catch (error) {
			console.error('Error loading data:', error);
			goto('/events');
		} finally {
			loading = false;
		}
	}

	async function handleMarkAttendance(registration: Registration) {
		if (!registration.registration_id || attendanceProcessing[registration.registration_id]) return;

		attendanceProcessing[registration.registration_id] = true;
		try {
			const result = await markAttendance(supabase, registration.registration_id);
			if (result.success) {
				// Update the registration in the list
				const index = registrations.findIndex(
					(r) => r.registration_id === registration.registration_id
				);
				if (index >= 0) {
					registrations[index] = {
						...registrations[index],
						attended: true,
						attendance_recorded_at: new Date().toISOString()
					};
				}
				toast(result.message || 'Attendance marked successfully.');
			} else {
				toast(result.message || 'Failed to mark attendance. Please try again.');
			}
		} catch (error) {
			console.error('Error marking attendance:', error);
			toast('An error occurred while marking attendance.');
		} finally {
			attendanceProcessing[registration.registration_id] = false;
		}
	}

	async function handleUnmarkAttendance(registration: Registration) {
		if (!registration.registration_id || attendanceProcessing[registration.registration_id]) return;

		attendanceProcessing[registration.registration_id] = true;
		try {
			const success = await unmarkAttendance(supabase, registration.registration_id);
			if (success) {
				// Update the registration in the list
				const index = registrations.findIndex(
					(r) => r.registration_id === registration.registration_id
				);
				if (index >= 0) {
					registrations[index] = {
						...registrations[index],
						attended: false,
						attendance_recorded_at: null,
						attendance_recorded_by: null
					};
				}
				toast('Attendance unmarked successfully.');
			} else {
				toast('Failed to unmark attendance. Please try again.');
			}
		} catch (error) {
			console.error('Error unmarking attendance:', error);
			toast('An error occurred while unmarking attendance.');
		} finally {
			attendanceProcessing[registration.registration_id] = false;
		}
	}

	function handleBack() {
		if (event) {
			goto(`/events/${event.event_id}`);
		} else {
			goto('/events');
		}
	}

	function formatDate(dateString: string | undefined | null) {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleDateString();
	}

	function formatDateTime(dateString: string | undefined | null) {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleString();
	}

	function getUserDisplayName(profile: any) {
		if (!profile) return 'Unknown User';
		return profile.full_name || `Student ${profile.student_id}` || 'Unknown User';
	}

	function getAttendanceStatus(registration: Registration): boolean {
		// Check the attended boolean field (consolidated from attendance table)
		return registration.attended === true;
	}

	function getAttendanceClasses(hasAttended: boolean) {
		return hasAttended
			? 'bg-green-100 text-green-800 hover:bg-green-200'
			: 'bg-gray-100 text-gray-800 hover:bg-gray-200';
	}

	function getStudyInfo(profile: any) {
		if (!profile) return 'N/A';

		const studyLevel = profile.study_level?.name || '';
		const school = profile.study_school_course?.study_school?.name || '';
		const course = profile.study_school_course?.study_course?.name || '';

		const parts = [studyLevel, school, course].filter(Boolean);
		return parts.length > 0 ? parts.join(' - ') : 'N/A';
	}

	// Permission helper functions
	function isAdmin(): boolean {
		const result =
			userProfile?.profile?.profile_role?.name === 'Admin' ||
			userProfile?.profile?.profile_role?.name === 'Superadmin';
		return result;
	}

	function canMarkAttendance(): boolean {
		return canManage;
	}

	// Filter registrations based on search term and attendance filter
	$effect(() => {
		let filtered = registrations;

		// Filter by search term
		if (searchTerm.trim()) {
			const searchLower = searchTerm.toLowerCase();
			filtered = filtered.filter((registration) => {
				const profile = registration.profile;
				const displayName = getUserDisplayName(profile).toLowerCase();
				const studentId = profile?.student_id?.toString() || '';
				const email = profile?.email?.toLowerCase() || '';

				return (
					displayName.includes(searchLower) ||
					studentId.includes(searchLower) ||
					email.includes(searchLower)
				);
			});
		}

		// Filter by attendance status
		if (filterAttendance) {
			if (filterAttendance === 'attended') {
				filtered = filtered.filter((registration) => getAttendanceStatus(registration));
			} else if (filterAttendance === 'not_attended') {
				filtered = filtered.filter((registration) => !getAttendanceStatus(registration));
			}
		}

		filteredRegistrations = filtered;
	});
</script>

<div class="container mx-auto max-w-7xl px-4 py-8">
	<div class="mb-6">
		<Button variant="ghost" onclick={handleBack} class="mb-4 flex items-center gap-2">
			<ArrowLeft class="h-4 w-4" />
			Back to Event
		</Button>

		<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
			<div class="flex items-center gap-3">
				<Users class="h-6 w-6 text-blue-600" />
				<div>
					<h1 class="text-2xl font-bold text-gray-900">Event Participants</h1>
					<p class="text-sm text-gray-600">
						{event?.name || 'Loading...'}
					</p>
				</div>
			</div>

			{#if !loading}
				<div class="flex items-center gap-2">
					<Badge variant="outline" class="flex items-center gap-1">
						<Users class="h-3 w-3" />
						{registrations.length} Registered
					</Badge>
					<Badge variant="outline" class="flex items-center gap-1">
						<CheckCircle2 class="h-3 w-3" />
						{registrations.filter((r) => getAttendanceStatus(r)).length} Attended
					</Badge>
				</div>
			{/if}
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
			<span class="ml-2">Loading participants...</span>
		</div>
	{:else}
		<!-- Search and Filter Card -->
		<Card class="mb-6">
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Filter class="h-5 w-5" />
					Search & Filter
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="flex flex-col gap-4 sm:flex-row">
					<div class="flex-1">
						<Label for="search-input">Search Participants</Label>
						<div class="relative mt-2">
							<Search
								class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400"
							/>
							<Input
								id="search-input"
								type="text"
								placeholder="Search by name, student ID, or email..."
								bind:value={searchTerm}
								class="pl-10"
							/>
						</div>
					</div>
					<div class="sm:w-64">
						<Label for="attendance-filter">Attendance Status</Label>
						<Select.Root type="single" name="attendance-filter" bind:value={filterAttendance}>
							<Select.Trigger id="attendance-filter" class="mt-2 w-full">
								{filterAttendance === 'attended'
									? 'Attended'
									: filterAttendance === 'not_attended'
										? 'Not attended'
										: 'All participants'}
							</Select.Trigger>
							<Select.Content>
								<Select.Group>
									<Select.Item value="" label="All participants">All participants</Select.Item>
									<Select.Item value="attended" label="Attended">Attended</Select.Item>
									<Select.Item value="not_attended" label="Not attended">Not attended</Select.Item>
								</Select.Group>
							</Select.Content>
						</Select.Root>
					</div>
				</div>

				{#if searchTerm || filterAttendance}
					<div class="mt-4 flex items-center justify-between">
						<p class="text-sm text-gray-600">
							Showing {filteredRegistrations.length} of {registrations.length} participants
						</p>
						<Button
							variant="outline"
							size="sm"
							onclick={() => {
								searchTerm = '';
								filterAttendance = '';
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
					<Users class="h-4 w-4" />
					Participants ({filteredRegistrations.length})
				</CardTitle>
				<CardDescription>Manage event registrations and attendance tracking.</CardDescription>
			</CardHeader>
			<CardContent>
				{#if filteredRegistrations.length === 0}
					<div class="py-12 text-center">
						<Users class="mx-auto h-12 w-12 text-gray-400" />
						<h3 class="mt-4 text-lg font-medium text-gray-900">No participants found</h3>
						<p class="mt-2 text-gray-600">
							{registrations.length === 0
								? 'No one has registered for this event yet.'
								: 'No participants match your search criteria.'}
						</p>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead class="w-1/4 min-w-[200px]">Participant</TableHead>
									<TableHead class="w-1/6 min-w-[120px]">Student ID</TableHead>
									<TableHead class="w-1/4 min-w-[200px]">Email</TableHead>
									<TableHead class="w-1/8 min-w-[100px]">Attendance</TableHead>
									{#if canMarkAttendance()}
										<TableHead class="w-1/4 min-w-[180px] text-right">Actions</TableHead>
									{/if}
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each filteredRegistrations as registration (registration.registration_id)}
									{@const hasAttended = getAttendanceStatus(registration)}
									{@const processing = attendanceProcessing[registration.registration_id]}
									<TableRow>
										<TableCell class="max-w-0 font-medium">
											<div
												class="truncate font-semibold"
												title={getUserDisplayName(registration.profile)}
											>
												{getUserDisplayName(registration.profile)}
											</div>
										</TableCell>
										<TableCell class="max-w-0">
											{#if registration.profile?.student_id}
												<span
													class="block truncate text-gray-900"
													title={registration.profile.student_id.toString()}
												>
													{registration.profile.student_id}
												</span>
											{:else}
												<span class="text-gray-400">N/A</span>
											{/if}
										</TableCell>
										<TableCell class="max-w-0">
											{#if registration.profile?.email}
												<span
													class="block truncate text-gray-900"
													title={registration.profile.email}
												>
													{registration.profile.email}
												</span>
											{:else}
												<span class="text-gray-400">N/A</span>
											{/if}
										</TableCell>
										<TableCell>
											<Badge class={`shrink-0 ${getAttendanceClasses(hasAttended)}`}>
												{#if hasAttended}
													<CheckCircle2 class="mr-1 h-3 w-3" />
													<span class="hidden sm:inline">Attended</span>
													<span class="sm:hidden">A</span>
												{:else}
													<XCircle class="mr-1 h-3 w-3" />
													<span class="hidden sm:inline">Not Attended</span>
													<span class="sm:hidden">N</span>
												{/if}
											</Badge>
											<!-- {#if hasAttended && registration.attendance?.created_at}
												<div class="mt-1 flex items-center gap-1 text-xs text-gray-500">
													<Clock class="h-3 w-3" />
													<span class="hidden sm:inline"
														>{formatDateTime(registration.attendance.created_at)}</span
													>
													<span class="sm:hidden"
														>{formatDate(registration.attendance.created_at)}</span
													>
												</div>
											{/if} -->
										</TableCell>
										{#if canMarkAttendance()}
											<TableCell class="text-right">
												<div class="flex min-w-0 items-center justify-end gap-2">
													{#if hasAttended}
														<Button
															variant="outline"
															size="sm"
															onclick={() => handleUnmarkAttendance(registration)}
															disabled={processing}
															class="flex shrink-0 items-center gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
														>
															{#if processing}
																<RefreshCw class="h-3 w-3 animate-spin" />
															{:else}
																<XCircle class="h-3 w-3" />
															{/if}
															<span class="hidden sm:inline">Unmark</span>
														</Button>
													{:else}
														<Button
															variant="default"
															size="sm"
															onclick={() => handleMarkAttendance(registration)}
															disabled={processing}
															class="flex shrink-0 items-center gap-1"
														>
															{#if processing}
																<RefreshCw class="h-3 w-3 animate-spin" />
															{:else}
																<CheckCircle2 class="h-3 w-3" />
															{/if}
															<span class="hidden sm:inline">Mark Attended</span>
														</Button>
													{/if}
												</div>
											</TableCell>
										{/if}
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
