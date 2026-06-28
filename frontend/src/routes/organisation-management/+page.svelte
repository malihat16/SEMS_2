<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getOrganisations, deleteOrganisation } from '$lib/database';
	import { getUserProfile } from '$lib/auth';
	import {
		canCreateOrganisation,
		canDeleteOrganisation,
		canEditOrganisation,
		canViewOrganisationMembers
	} from '$lib/permissions';
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
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table/index.js';
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
	import { Trash2, Plus, Users, Edit, Search, Filter, RefreshCw } from '@lucide/svelte';
	import type { Organisation } from '$lib/types';

	let { data } = $props();
	let { supabase } = $derived(data);

	let organisations: Organisation[] = $state([]);
	let loading = $state(true);
	let userProfile: any = $state(null);
	let selectedOrgToDelete: Organisation | null = $state(null);

	// Permission states
	let canCreate = $state(false);
	let canDelete = $state(false);
	let orgPermissions = $state<Map<string, { canEdit: boolean; canViewMembers: boolean }>>(
		new Map()
	);

	// Search and filter state
	let searchTerm = $state('');
	let filteredOrganisations = $state<Organisation[]>([]);

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		loading = true;
		try {
			console.log('Loading organisations data...');
			const [profile, orgs] = await Promise.all([getUserProfile(supabase), getOrganisations(supabase)]);

			console.log('Profile loaded:', profile);
			console.log('Organisations loaded:', orgs);

			userProfile = profile;
			organisations = orgs;

			// Load permissions
			await loadPermissions();
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			loading = false;
		}
	}

	async function loadPermissions() {
		try {
			// Check global permissions
			canCreate = await canCreateOrganisation(supabase);
			canDelete = await canDeleteOrganisation(supabase);

			// Check per-organisation permissions
			const permissionsMap = new Map();

			for (const org of organisations) {
				const [canEdit, canViewMembers] = await Promise.all([
					canEditOrganisation(supabase, org.organisation_id),
					canViewOrganisationMembers(supabase, org.organisation_id)
				]);

				permissionsMap.set(org.organisation_id, {
					canEdit,
					canViewMembers
				});
			}

			orgPermissions = permissionsMap;
		} catch (error) {
			console.error('Error loading permissions:', error);
		}
	}

	async function handleDeleteOrganisation() {
		if (!selectedOrgToDelete || !userProfile?.profile?.profile_id) return;

		const success = await deleteOrganisation(supabase,
			selectedOrgToDelete.organisation_id,
			userProfile.profile.profile_id
		);

		if (success) {
			organisations = organisations.filter(
				(org) => org.organisation_id !== selectedOrgToDelete!.organisation_id
			);
			selectedOrgToDelete = null;
			toast.success('Organisation deleted successfully');
		} else {
			toast.error('Failed to delete organisation. Please try again.');
		}
	}

	function handleCreateOrganisation() {
		goto('/organisation-management/create');
	}

	function handleEditOrganisation(organisationId: string) {
		goto(`/organisation-management/edit/${organisationId}`);
	}

	function handleManageMembers(organisationId: string) {
		goto(`/organisation-management/members/${organisationId}`);
	}

	// Filter organisations based on search term
	$effect(() => {
		let filtered = organisations;

		// Filter by search term
		if (searchTerm.trim()) {
			const searchLower = searchTerm.toLowerCase();
			filtered = filtered.filter((org) => {
				const name = org.name?.toLowerCase() || '';
				const description = org.description?.toLowerCase() || '';

				return name.includes(searchLower) || description.includes(searchLower);
			});
		}

		filteredOrganisations = filtered;
	});
</script>

<svelte:head>
	<title>Organisation Management - SEMS</title>
	<meta
		name="description"
		content="Manage student organisations, view members, and oversee organisational activities."
	/>
	<meta name="keywords" content="organisation management, student organisations, club management" />
	<meta property="og:title" content="Organisation Management - SEMS" />
	<meta
		property="og:description"
		content="Manage student organisations, view members, and oversee organisational activities."
	/>
	<meta property="og:type" content="website" />
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href="/organisation-management" />
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
		<div>
			<h1 class="text-3xl font-bold text-gray-900">Organisation Management</h1>
			<p class="mt-2 text-gray-600">Manage available organisations.</p>
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
			{#if canCreate}
				<Button onclick={handleCreateOrganisation} class="flex-1 sm:w-auto sm:flex-initial">
					<Plus class="h-4 w-4" />
					Create Organisation
				</Button>
			{/if}
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
			<span class="ml-2">Loading organisations...</span>
		</div>
	{:else}
		<!-- Search and Filter Card -->
		<Card class="mb-6">
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Filter class="h-5 w-5" />
					Search & Filter
				</CardTitle>
				<!-- <CardDescription>Find specific organisations.</CardDescription> -->
			</CardHeader>
			<CardContent>
				<div class="flex flex-col gap-4 sm:flex-row">
					<div class="flex-1">
						<Label for="org-search">Search Organisations</Label>
						<div class="relative mt-2">
							<Search
								class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400"
							/>
							<Input
								id="org-search"
								type="text"
								placeholder="Search by name or description..."
								value={searchTerm}
								oninput={(e) => (searchTerm = (e.target as HTMLInputElement).value)}
								class="pl-10"
							/>
						</div>
					</div>
				</div>

				{#if searchTerm}
					<div class="mt-4 flex items-center justify-between">
						<p class="text-sm text-gray-600">
							Showing {filteredOrganisations.length} of {organisations.length} organisations
						</p>
						<Button variant="outline" size="sm" onclick={() => (searchTerm = '')}>
							Clear Search
						</Button>
					</div>
				{/if}
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Users class="h-5 w-5" />
					Organisations
				</CardTitle>
				<CardDescription>All registered organisations in the system.</CardDescription>
			</CardHeader>
			<CardContent>
				{#if filteredOrganisations.length === 0 && organisations.length === 0}
					<div class="py-8 text-center">
						<Users class="mx-auto mb-4 h-12 w-12 text-gray-400" />
						<h3 class="mb-2 text-lg font-medium text-gray-900">No Organisations</h3>
						<p class="mb-4 text-gray-600">
							{#if canCreate}
								Get started by creating your first organisation.
							{:else}
								No organisations have been created yet.
							{/if}
						</p>
						{#if canCreate}
							<Button onclick={handleCreateOrganisation} class="mx-auto flex items-center gap-2">
								<Plus class="h-4 w-4" />
								Create Organisation
							</Button>
						{/if}
					</div>
				{:else if filteredOrganisations.length === 0}
					<div class="py-8 text-center">
						<Search class="mx-auto mb-4 h-12 w-12 text-gray-400" />
						<h3 class="mb-2 text-lg font-medium text-gray-900">No Organisations Found</h3>
						<p class="mb-4 text-gray-600">No organisations match your search criteria.</p>
						<Button variant="outline" onclick={() => (searchTerm = '')}>Clear Search</Button>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead class="w-1/4 min-w-[200px]">Organisation</TableHead>
									<TableHead class="w-2/4 min-w-[300px]">Description</TableHead>
									<TableHead class="w-1/12 min-w-[80px]">Members</TableHead>
									<TableHead class="w-1/4 min-w-[200px] text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each filteredOrganisations as org}
									<TableRow>
										<TableCell class="max-w-0 font-medium">
											<div class="truncate" title={org.name}>
												{org.name}
											</div>
										</TableCell>
										<TableCell class="max-w-0">
											{#if org.description}
												<div class="truncate text-gray-600" title={org.description}>
													{org.description}
												</div>
											{:else}
												<span class="italic text-gray-400">No description</span>
											{/if}
										</TableCell>
										<TableCell class="text-gray-600">
											<div class="flex items-center gap-1">
												<span>{org.member_count ?? 0}</span>
											</div>
										</TableCell>
										<TableCell class="text-right">
											<div class="flex min-w-0 items-center justify-end gap-2">
												{#if orgPermissions.get(org.organisation_id)?.canViewMembers}
													<Button
														variant="outline"
														size="sm"
														onclick={() => handleManageMembers(org.organisation_id)}
														class="flex shrink-0 items-center gap-1"
													>
														<Users class="h-3 w-3" />
														<span class="hidden sm:inline">Members</span>
													</Button>
												{/if}
												{#if orgPermissions.get(org.organisation_id)?.canEdit}
													<Button
														variant="outline"
														size="sm"
														onclick={() => handleEditOrganisation(org.organisation_id)}
														class="flex shrink-0 items-center gap-1"
													>
														<Edit class="h-3 w-3" />
														<span class="hidden sm:inline">Edit</span>
													</Button>
												{/if}

												{#if canDelete}
													<AlertDialog>
														<AlertDialogTrigger>
															<Button
																variant="outline"
																size="sm"
																class="flex shrink-0 items-center gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
																onclick={() => (selectedOrgToDelete = org)}
															>
																<Trash2 class="h-3 w-3" />
																<span class="hidden sm:inline">Delete</span>
															</Button>
														</AlertDialogTrigger>
														<AlertDialogContent>
															<AlertDialogHeader>
																<AlertDialogTitle>Delete Organisation</AlertDialogTitle>
																<AlertDialogDescription>
																	Are you sure you want to delete "{selectedOrgToDelete?.name}"?
																	This will also remove all members and associated events. This
																	action cannot be undone.
																</AlertDialogDescription>
															</AlertDialogHeader>
															<AlertDialogFooter>
																<AlertDialogCancel onclick={() => (selectedOrgToDelete = null)}>
																	Cancel
																</AlertDialogCancel>
																<AlertDialogAction
																	onclick={handleDeleteOrganisation}
																	class="bg-red-600 hover:bg-red-700"
																>
																	Delete Organisation
																</AlertDialogAction>
															</AlertDialogFooter>
														</AlertDialogContent>
													</AlertDialog>
												{/if}
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
