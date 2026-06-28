<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		getOrganisations,
		getOrganisationMembers,
		getOrganisationRoles,
		addOrganisationMember,
		updateOrganisationMemberRole,
		removeOrganisationMember,
		searchUsers
	} from '$lib/database';
	import { getUserProfile } from '$lib/auth';
	import {
		canViewOrganisationMembers,
		canManageOrganisationMembers,
		canEditOrganisationMemberRoles
	} from '$lib/permissions';
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
	import { ArrowLeft, Users, Plus, Trash2, Edit, Search, Filter, RefreshCw } from '@lucide/svelte';
	import type { Organisation, OrganisationMember, OrganisationRole } from '$lib/types';

	let { data } = $props();
	let { supabase } = $derived(data);

	let organisationId = $state('');
	let organisation: Organisation | null = $state(null);
	let members: OrganisationMember[] = $state([]);
	let roles: OrganisationRole[] = $state([]);
	let loading = $state(true);
	let userProfile: any = $state(null);
	let currentUserMembership: OrganisationMember | null = $state(null);

	// Permission states
	let canView = $state(false);
	let canManage = $state(false);
	let canEditRoles = $state(false);

	// Search and filter state
	let memberSearchTerm = $state('');
	let filterRole = $state('');
	let filteredMembers = $state<OrganisationMember[]>([]);

	// Add member dialog state
	let showAddMemberDialog = $state(false);
	let searchTerm = $state('');
	let searchResults: any[] = $state([]);
	let searching = $state(false);
	let hasSearched = $state(false);
	let selectedUser: any = $state(null);
	let selectedRole = $state('');
	let addingMember = $state(false);

	// Edit role dialog state
	let editingMember: OrganisationMember | null = $state(null);
	let editingRole = $state('');
	let updatingRole = $state(false);
	let showEditRoleDialog = $state(false);

	// Delete member state
	let memberToDelete: OrganisationMember | null = $state(null);

	onMount(async () => {
		organisationId = $page.params?.id || '';
		await loadData();
	});

	async function loadData() {
		loading = true;
		try {
			// Check permission to view members first
			const canViewMembers = await canViewOrganisationMembers(supabase, organisationId);
			if (!canViewMembers) {
				goto('/forbidden');
				return;
			}

			const [profile, organisations, orgMembers, orgRoles] = await Promise.all([
				getUserProfile(supabase),
				getOrganisations(supabase),
				getOrganisationMembers(supabase, organisationId),
				getOrganisationRoles(supabase)
			]);

			userProfile = profile;
			organisation = organisations.find((org) => org.organisation_id === organisationId) ?? null;
			members = orgMembers;
			roles = orgRoles;

			if (!organisation) {
				goto('/organisation-management');
				return;
			}

			// Set permissions
			canView = true; // Already checked above
			canManage = await canManageOrganisationMembers(supabase, organisationId);
			canEditRoles = await canEditOrganisationMemberRoles(supabase, organisationId);

			// Find current user's membership in this organisation
			if (userProfile?.profile?.profile_id) {
				currentUserMembership =
					members.find((member) => member.profile_id === userProfile.profile.profile_id) ?? null;
			}
		} catch (error) {
			console.error('Error loading data:', error);
			goto('/organisation-management');
		} finally {
			loading = false;
		}
	}

	async function handleSearch() {
		if (!searchTerm.trim() || searchTerm.length < 2) {
			searchResults = [];
			hasSearched = false;
			return;
		}

		searching = true;
		hasSearched = false; // Reset while searching
		selectedUser = null; // Reset selected user when performing new search
		selectedRole = ''; // Reset selected role when performing new search

		try {
			console.log('Searching for:', searchTerm);
			const results = await searchUsers(supabase, searchTerm);
			console.log('Search results:', results);
			// Filter out users who are already members
			const memberIds = members.map((m) => m.profile?.profile_id);
			searchResults = results.filter((user) => !memberIds.includes(user.profile_id));
			console.log('Filtered results:', searchResults);
			hasSearched = true; // Mark that search has been performed
		} catch (error) {
			console.error('Error searching users:', error);
			searchResults = [];
			hasSearched = true; // Still mark as searched even on error
		} finally {
			searching = false;
		}
	}

	async function handleAddMember() {
		if (!selectedUser || !selectedRole || !userProfile?.profile?.profile_id) return;

		addingMember = true;
		try {
			const result = await addOrganisationMember(supabase,
				organisationId,
				selectedUser.profile_id,
				selectedRole,
				userProfile.profile.profile_id
			);

			if (result) {
				// If the added member is the current user, refresh the entire member list
				// to ensure permissions are properly updated
				if (result.profile_id === userProfile.profile.profile_id) {
					console.log(
						'Current user added as member, refreshing member list for permission updates'
					);
					// Refresh the entire member list to ensure data consistency
					const freshMembers = await getOrganisationMembers(supabase, organisationId);
					members = freshMembers;
					// Find and update current user membership from fresh data
					currentUserMembership =
						freshMembers.find((member) => member.profile_id === userProfile.profile.profile_id) ??
						null;
					console.log('Updated current user membership:', currentUserMembership);
				} else {
					// For other users, just add to the existing list
					members = [...members, result];
				}

				// Reset form
				showAddMemberDialog = false;
				searchTerm = '';
				searchResults = [];
				selectedUser = null;
				selectedRole = '';

				toast('Member added successfully.');
			} else {
				toast('Failed to add member. Please try again.');
			}
		} catch (error) {
			console.error('Error adding member:', error);
			toast('An error occurred while adding the member.');
		} finally {
			addingMember = false;
		}
	}

	async function handleUpdateRole() {
		if (!editingMember || !editingRole || !userProfile?.profile?.profile_id) return;

		updatingRole = true;
		try {
			const result = await updateOrganisationMemberRole(supabase,
				editingMember.organisation_member_id,
				editingRole,
				userProfile.profile.profile_id
			);

			if (result) {
				// Update the member in the list
				const index = members.findIndex(
					(m) => m.organisation_member_id === editingMember!.organisation_member_id
				);
				if (index >= 0) {
					members[index] = result;
					members = [...members];
				}

				// Update current user membership if it's the current user being edited
				if (result.profile_id === userProfile.profile.profile_id) {
					currentUserMembership = result;
				}

				// Close the dialog by resetting state
				showEditRoleDialog = false;
				editingMember = null;
				editingRole = '';
				toast('Member role updated successfully.');
			} else {
				toast('Failed to update member role. Please try again.');
			}
		} catch (error) {
			console.error('Error updating member role:', error);
			toast('An error occurred while updating the member role.');
		} finally {
			updatingRole = false;
		}
	}

	async function handleRemoveMember() {
		if (!memberToDelete || !userProfile?.profile?.profile_id) return;

		try {
			const success = await removeOrganisationMember(supabase,
				memberToDelete.organisation_member_id,
				userProfile.profile.profile_id
			);

			if (success) {
				// Check if the current user is being removed
				if (memberToDelete.profile_id === userProfile.profile.profile_id) {
					console.log('Current user removed from organisation, clearing membership');
					currentUserMembership = null;
				}

				members = members.filter(
					(m) => m.organisation_member_id !== memberToDelete!.organisation_member_id
				);
				memberToDelete = null;
				toast('Member removed successfully.');
			} else {
				toast('Failed to remove member. Please try again.');
			}
		} catch (error) {
			console.error('Error removing member:', error);
			toast('An error occurred while removing the member.');
		}
	}

	function handleBack() {
		goto('/organisation-management');
	}

	function formatDate(dateString: string | undefined | null) {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleDateString();
	}

	function getUserDisplayName(profile: any) {
		if (!profile) return 'Unknown User';
		return profile.full_name || `Student ${profile.student_id}` || 'Unknown User';
	}

	function getRoleClasses(roleName: string) {
		switch (roleName?.toLowerCase()) {
			case 'owner':
				return 'bg-red-100 text-red-800 hover:bg-red-200'; // Red styling
			case 'leader':
				return 'bg-green-100 text-green-800 hover:bg-green-200'; // Green styling
			default:
				return ''; // Use default Badge styling
		}
	}

	// Permission helper functions
	function isAdmin(): boolean {
		const result =
			userProfile?.profile?.profile_role?.name === 'Admin' ||
			userProfile?.profile?.profile_role?.name === 'Superadmin';
		return result;
	}

	function isOwner(): boolean {
		const result = currentUserMembership?.organisation_role?.name === 'Owner';
		return result;
	}

	function isLeader(): boolean {
		const result = currentUserMembership?.organisation_role?.name === 'Leader';
		return result;
	}

	function canEditRole(): boolean {
		return canEditRoles;
	}

	function canAddMembers(): boolean {
		return canManage;
	}

	function canRemoveMembers(): boolean {
		return canManage;
	}

	function hasAnyActions(): boolean {
		return canEditRole() || canRemoveMembers();
	}

	// Reset add member form when dialog closes
	$effect(() => {
		if (!showAddMemberDialog) {
			searchTerm = '';
			searchResults = [];
			hasSearched = false;
			selectedUser = null;
			selectedRole = '';
		}
	});

	// Reset edit role form when dialog closes
	$effect(() => {
		if (!showEditRoleDialog) {
			editingMember = null;
			editingRole = '';
		}
	});

	// Filter members based on search term filter
	$effect(() => {
		let filtered = members;

		// Filter by search term
		if (memberSearchTerm.trim()) {
			const searchLower = memberSearchTerm.toLowerCase();
			filtered = filtered.filter((member) => {
				const displayName = getUserDisplayName(member.profile).toLowerCase();
				const email = member.profile?.email?.toLowerCase() || '';
				const studentId = member.profile?.student_id?.toString().toLowerCase() || '';

				return (
					displayName.includes(searchLower) ||
					email.includes(searchLower) ||
					studentId.includes(searchLower)
				);
			});
		}

		// Filter by role
		if (filterRole) {
			filtered = filtered.filter((member) => member.organisation_role?.organisation_role_id === filterRole);
		}

		filteredMembers = filtered;
	});

	// Reset filter role when new search is performed
	$effect(() => {
		if (memberSearchTerm.trim()) {
			filterRole = '';
		}
	});

	// Debug effect to track permission changes
	$effect(() => {
		if (userProfile && organisation) {
			console.log('Permission debug:', {
				userProfile: userProfile?.profile?.profile_role?.name,
				currentUserMembership: currentUserMembership?.organisation_role?.name,
				isAdmin: isAdmin(),
				isOwner: isOwner(),
				isLeader: isLeader(),
				canAddMembers: canAddMembers(),
				canRemoveMembers: canRemoveMembers(),
				canEditRole: canEditRole()
			});
		}
	});
</script>

<div class="container mx-auto max-w-7xl px-4 py-8">
	<div class="mb-6">
		<Button variant="ghost" onclick={handleBack} class="mb-4 flex items-center gap-2">
			<ArrowLeft class="h-4 w-4" />
			Back to Organisations
		</Button>

		<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
			<div class="flex items-center gap-3">
				<Users class="h-8 w-8 text-blue-600" />
				<div>
					<h1 class="text-3xl font-bold text-gray-900">Manage Members</h1>
					<p class="mt-1 text-gray-600">
						{#if organisation}
							{organisation.name} - {members.length} member{members.length !== 1 ? 's' : ''}
						{:else}
							Loading organisation...
						{/if}
					</p>
				</div>
			</div>

			{#if !loading}
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
					{#if canAddMembers()}
						<Dialog bind:open={showAddMemberDialog}>
							<DialogTrigger>
								<Button class="flex-1 sm:w-auto sm:flex-initial">
									<Plus class="h-4 w-4" />
									Add Member
								</Button>
							</DialogTrigger>
							<DialogContent class="max-w-md">
								<DialogHeader>
									<DialogTitle>Add New Member</DialogTitle>
									<DialogDescription>
										Search for users and add them to the organisation
									</DialogDescription>
								</DialogHeader>

								<div class="space-y-4">
									<div class="space-y-2">
										<Label for="search">Search Users</Label>
										<div class="flex gap-2">
											<div class="relative flex-1">
												<Search
													class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400"
												/>
												<Input
													id="search"
													type="text"
													placeholder="Search by name or student ID..."
													value={searchTerm}
													oninput={(e) => (searchTerm = (e.target as HTMLInputElement).value)}
													onkeydown={(e) => {
														if (e.key === 'Enter') {
															e.preventDefault();
															handleSearch();
														}
													}}
													class="pl-10"
												/>
											</div>
											<Button
												onclick={handleSearch}
												disabled={!searchTerm.trim() || searchTerm.length < 2 || searching}
												variant="outline"
												class="px-4"
											>
												{#if searching}
													<div
														class="h-4 w-4 animate-spin rounded-full border-b-2 border-gray-600"
													></div>
												{:else}
													<Search class="h-4 w-4" />
												{/if}
											</Button>
										</div>
									</div>

									{#if searching}
										<div class="flex items-center justify-center py-4">
											<div
												class="h-6 w-6 animate-spin rounded-full border-b-2 border-gray-900"
											></div>
											<span class="ml-2">Searching...</span>
										</div>
									{:else if searchResults.length > 0}
										<div class="max-h-40 space-y-2 overflow-y-auto">
											<Label>Select User</Label>
											{#each searchResults as user}
												<button
													class="w-full rounded-lg border p-3 text-left hover:bg-gray-50 {selectedUser?.profile_id ===
													user.profile_id
														? 'border-blue-300 bg-blue-50'
														: ''}"
													onclick={() => (selectedUser = user)}
												>
													<div class="font-medium">{getUserDisplayName(user)}</div>
													<div class="text-sm text-gray-600">
														{#if user.student_id}Student ID: {user.student_id}{/if}
														{#if user.email}
															• {user.email}{/if}
													</div>
												</button>
											{/each}
										</div>
									{:else if hasSearched && searchResults.length === 0}
										<p class="py-4 text-center text-sm text-gray-600">No users found</p>
									{/if}

									{#if selectedUser}
										<div class="space-y-2">
											<Label for="role">Select Role</Label>
											<Select.Root type="single" name="role" bind:value={selectedRole}>
												<Select.Trigger class="w-full">
													{selectedRole
														? roles.find((r) => r.organisation_role_id === selectedRole)?.name ||
															'Choose a role'
														: 'Choose a role'}
												</Select.Trigger>
												<Select.Content>
													<Select.Group>
														{#each roles as role}
															<Select.Item value={role.organisation_role_id} label={role.name}>
																{role.name}
																{#if role.description}
																	- {role.description}
																{/if}
															</Select.Item>
														{/each}
													</Select.Group>
												</Select.Content>
											</Select.Root>
										</div>
									{/if}
								</div>

								<DialogFooter>
									<Button
										variant="outline"
										onclick={() => (showAddMemberDialog = false)}
										disabled={addingMember}
									>
										Cancel
									</Button>
									<Button
										onclick={handleAddMember}
										disabled={!selectedUser || !selectedRole || addingMember}
										class="flex items-center gap-2"
									>
										{#if addingMember}
											<div class="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
										{/if}
										Add Member
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
			<span class="ml-2">Loading members...</span>
		</div>
	{:else}
		<!-- Search and Filter Card -->
		<Card class="mb-6">
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Filter class="h-5 w-5" />
					Search & Filter
				</CardTitle>
				<!-- <CardDescription>Find specific members or filter by role</CardDescription> -->
			</CardHeader>
			<CardContent>
				<div class="flex flex-col gap-4 sm:flex-row">
					<div class="flex-1">
						<Label for="member-search">Search Members</Label>
						<div class="relative mt-2">
							<Search
								class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400"
							/>
							<Input
								id="member-search"
								type="text"
								placeholder="Search by name, email, or student ID"
								value={memberSearchTerm}
								oninput={(e) => (memberSearchTerm = (e.target as HTMLInputElement).value)}
								class="pl-10"
							/>
						</div>
					</div>

					<div class="w-full sm:w-64">
						<Label for="role-filter">Filter by Role</Label>
						<div class="mt-2">
							<Select.Root type="single" name="role-filter" bind:value={filterRole}>
								<Select.Trigger class="w-full">
									{filterRole
										? roles.find((r) => r.organisation_role_id === filterRole)?.name || 'All Roles'
										: 'All Roles'}
								</Select.Trigger>
								<Select.Content>
									<Select.Group>
										<Select.Item value="" label="All Roles">All Roles</Select.Item>
										{#each roles as role}
											<Select.Item value={role.organisation_role_id} label={role.name}>
												{role.name}
											</Select.Item>
										{/each}
									</Select.Group>
								</Select.Content>
							</Select.Root>
						</div>
					</div>
				</div>

				{#if memberSearchTerm || filterRole}
					<div class="mt-4 flex items-center justify-between">
						<p class="text-sm text-gray-600">
							Showing {filteredMembers.length} of {members.length} members
						</p>
						<Button
							variant="outline"
							size="sm"
							onclick={() => {
								memberSearchTerm = '';
								filterRole = '';
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
					<Users class="h-5 w-5" />
					Organisation Members ({filteredMembers.length}{memberSearchTerm || filterRole
						? ` of ${members.length}`
						: ''})
				</CardTitle>
				{#if organisation?.description}
					<CardDescription>{organisation.description}</CardDescription>
				{/if}
			</CardHeader>
			<CardContent>
				{#if filteredMembers.length === 0 && members.length === 0}
					<div class="py-8 text-center">
						<Users class="mx-auto mb-4 h-12 w-12 text-gray-400" />
						<h3 class="mb-2 text-lg font-medium text-gray-900">No Members</h3>
						<p class="mb-4 text-gray-600">This organisation doesn't have any members yet.</p>
						{#if canAddMembers()}
							<Button
								onclick={() => (showAddMemberDialog = true)}
								class="mx-auto flex items-center gap-2"
							>
								<Plus class="h-4 w-4" />
								Add First Member
							</Button>
						{/if}
					</div>
				{:else if filteredMembers.length === 0}
					<div class="py-8 text-center">
						<Search class="mx-auto mb-4 h-12 w-12 text-gray-400" />
						<h3 class="mb-2 text-lg font-medium text-gray-900">No Members Found</h3>
						<p class="mb-4 text-gray-600">No members match your search criteria.</p>
						<Button
							variant="outline"
							onclick={() => {
								memberSearchTerm = '';
								filterRole = '';
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
									<TableHead class="w-1/4 min-w-[200px]">Member</TableHead>
									<TableHead class="w-1/6 min-w-[120px]">Student ID</TableHead>
									<TableHead class="w-1/4 min-w-[200px]">Email</TableHead>
									<TableHead class="w-1/8 min-w-[100px]">Role</TableHead>
									{#if hasAnyActions()}
										<TableHead class="w-1/4 min-w-[180px] text-right">Actions</TableHead>
									{/if}
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each filteredMembers as member}
									<TableRow>
										<TableCell class="max-w-0 font-medium">
											<div
												class="truncate font-semibold"
												title={getUserDisplayName(member.profile)}
											>
												{getUserDisplayName(member.profile)}
											</div>
										</TableCell>
										<TableCell class="max-w-0">
											{#if member.profile?.student_id}
												<span
													class="block truncate text-gray-900"
													title={member.profile.student_id.toString()}
												>
													{member.profile.student_id}
												</span>
											{:else}
												<span class="text-gray-400">N/A</span>
											{/if}
										</TableCell>
										<TableCell class="max-w-0">
											{#if member.profile?.email}
												<span class="block truncate text-gray-900" title={member.profile.email}>
													{member.profile.email}
												</span>
											{:else}
												<span class="text-gray-400">N/A</span>
											{/if}
										</TableCell>
										<TableCell>
											{#if member.organisation_role?.name?.toLowerCase() === 'owner' || member.organisation_role?.name?.toLowerCase() === 'leader'}
												<Badge class="shrink-0 {getRoleClasses(member.organisation_role.name)}">
													{member.organisation_role?.name || 'Unknown Role'}
												</Badge>
											{:else}
												<Badge variant="secondary" class="shrink-0">
													{member.organisation_role?.name || 'Unknown Role'}
												</Badge>
											{/if}
										</TableCell>
										{#if hasAnyActions()}
											<TableCell class="text-right">
												<div class="flex min-w-0 items-center justify-end gap-2">
													{#if canEditRole()}
														<Dialog bind:open={showEditRoleDialog}>
															<DialogTrigger>
																<Button
																	variant="outline"
																	size="sm"
																	onclick={() => {
																		editingMember = member;
																		editingRole = member.organisation_role?.organisation_role_id || '';
																		showEditRoleDialog = true;
																	}}
																	class="flex shrink-0 items-center gap-1"
																>
																	<Edit class="h-3 w-3" />
																	<span class="hidden sm:inline">Edit Role</span>
																</Button>
															</DialogTrigger>
															<DialogContent class="max-w-md">
																<DialogHeader>
																	<DialogTitle>Edit Member Role</DialogTitle>
																	<DialogDescription>
																		Change the role for {getUserDisplayName(editingMember?.profile)}
																	</DialogDescription>
																</DialogHeader>

																<div class="space-y-4">
																	<div class="space-y-2">
																		<Label for="edit-role">Select Role</Label>
																		<Select.Root
																			type="single"
																			name="edit-role"
																			bind:value={editingRole}
																		>
																			<Select.Trigger class="w-full">
																				{editingRole
																					? roles.find(
																							(r) => r.organisation_role_id === editingRole
																						)?.name || 'Choose a role'
																					: 'Choose a role'}
																			</Select.Trigger>
																			<Select.Content>
																				<Select.Group>
																					{#each roles as role}
																						<Select.Item
																							value={role.organisation_role_id}
																							label={role.name}
																						>
																							{role.name}
																							{#if role.description}
																								- {role.description}
																							{/if}
																						</Select.Item>
																					{/each}
																				</Select.Group>
																			</Select.Content>
																		</Select.Root>
																	</div>
																</div>

																<DialogFooter>
																	<Button
																		variant="outline"
																		onclick={() => {
																			showEditRoleDialog = false;
																			editingMember = null;
																			editingRole = '';
																		}}
																		disabled={updatingRole}
																	>
																		Cancel
																	</Button>
																	<Button
																		onclick={handleUpdateRole}
																		disabled={!editingRole || updatingRole}
																		class="flex items-center gap-2"
																	>
																		{#if updatingRole}
																			<div
																				class="h-4 w-4 animate-spin rounded-full border-b-2 border-white"
																			></div>
																		{/if}
																		Update Role
																	</Button>
																</DialogFooter>
															</DialogContent>
														</Dialog>
													{/if}

													{#if canRemoveMembers()}
														<AlertDialog>
															<AlertDialogTrigger>
																<Button
																	variant="outline"
																	size="sm"
																	class="flex shrink-0 items-center gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
																	onclick={() => (memberToDelete = member)}
																>
																	<Trash2 class="h-3 w-3" />
																	<span class="hidden sm:inline">Remove</span>
																</Button>
															</AlertDialogTrigger>
															<AlertDialogContent>
																<AlertDialogHeader>
																	<AlertDialogTitle>Remove Member</AlertDialogTitle>
																	<AlertDialogDescription>
																		Are you sure you want to remove "{getUserDisplayName(
																			memberToDelete?.profile
																		)}" from this organisation? This action cannot be undone.
																	</AlertDialogDescription>
																</AlertDialogHeader>
																<AlertDialogFooter>
																	<AlertDialogCancel onclick={() => (memberToDelete = null)}>
																		Cancel
																	</AlertDialogCancel>
																	<AlertDialogAction
																		onclick={handleRemoveMember}
																		class="bg-red-600 hover:bg-red-700"
																	>
																		Remove Member
																	</AlertDialogAction>
																</AlertDialogFooter>
															</AlertDialogContent>
														</AlertDialog>
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
