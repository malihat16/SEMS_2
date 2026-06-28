<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getUsersPaginated, deleteUser } from '$lib/database';
	import { getUserProfile } from '$lib/auth';
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
	import { Trash2, Users, Edit, Search, Filter, Shield, RefreshCw } from '@lucide/svelte';
	import type { Profile } from '$lib/types';

	let { data } = $props();
	let { supabase } = $derived(data);

	let users: Profile[] = $state([]);
	let loading = $state(true);
	let userProfile: any = $state(null);
	let selectedUserToDelete: Profile | null = $state(null);

	// Search and filter state
	let searchTerm = $state('');
	let searchInput = $state(''); // Separate input value for controlled search
	let filterRole = $state('all'); // 'all', 'admin', 'student'

	// Pagination state
	let currentPage = $state(1);
	let perPage = $state(250);
	let totalCount = $state(0);

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		loading = true;
		try {
			console.log('Loading users data...');
			const [profile, paginatedData] = await Promise.all([
				getUserProfile(supabase),
				getUsersPaginated(supabase, {
					page: currentPage,
					perPage,
					searchTerm,
					roleFilter: filterRole as 'all' | 'admin' | 'student'
				})
			]);

			console.log('Profile loaded:', profile);
			console.log('Users loaded:', paginatedData);

			userProfile = profile;
			users = paginatedData.users;
			totalCount = paginatedData.totalCount;
		} catch (error) {
			console.error('Error loading data:', error);
		} finally {
			loading = false;
		}
	}

	async function handleSearch() {
		searchTerm = searchInput;
		currentPage = 1; // Reset to first page when searching
		await loadData();
	}

	async function handlePageChange(page: number) {
		currentPage = page;
		await loadData();
	}

	async function handleDeleteUser() {
		if (!selectedUserToDelete || !userProfile?.profile?.profile_id) return;

		const success = await deleteUser(supabase,
			selectedUserToDelete.profile_id,
			userProfile.profile.profile_id
		);

		if (success) {
			selectedUserToDelete = null;
			// Reload data to reflect deletion
			await loadData();
		} else {
			toast('Failed to delete user. Please try again.');
		}
	}

	function handleEditUser(userId: string) {
		goto(`/user-management/edit/${userId}`);
	}

	function formatDate(dateString: string | undefined | null) {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleDateString();
	}

	function getUserDisplayName(user: Profile | null) {
		return user?.full_name || 'Unknown User';
	}

	function getUserRole(user: Profile) {
		return user.profile_role?.name || 'User';
	}

	// Computed values
	const totalPages = $derived(Math.ceil(totalCount / perPage));
	const showingFrom = $derived((currentPage - 1) * perPage + 1);
	const showingTo = $derived(Math.min(currentPage * perPage, totalCount));

	// Derived content for select trigger
	const roleFilterContent = $derived(
		filterRole === 'all' ? 'All Users' : filterRole === 'admin' ? 'Admins Only' : 'Students Only'
	);

	// Generate page numbers for pagination
	const pageNumbers = $derived.by(() => {
		const pages: number[] = [];
		const maxPagesToShow = 7;

		if (totalPages <= maxPagesToShow) {
			// Show all pages
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			// Always show first page
			pages.push(1);

			let startPage = Math.max(2, currentPage - 1);
			let endPage = Math.min(totalPages - 1, currentPage + 1);

			// Add ellipsis after first page if needed
			if (startPage > 2) {
				pages.push(-1); // -1 represents ellipsis
			}

			// Add middle pages
			for (let i = startPage; i <= endPage; i++) {
				pages.push(i);
			}

			// Add ellipsis before last page if needed
			if (endPage < totalPages - 1) {
				pages.push(-1); // -1 represents ellipsis
			}

			// Always show last page
			pages.push(totalPages);
		}

		return pages;
	});
</script>

<svelte:head>
	<title>User Management - SEMS</title>
	<meta
		name="description"
		content="Manage system users, permissions, and user roles. Administrative access required."
	/>
	<meta
		name="keywords"
		content="user management, admin panel, user permissions, system administration"
	/>
	<meta property="og:title" content="User Management - SEMS" />
	<meta
		property="og:description"
		content="Manage system users, permissions, and user roles. Administrative access required."
	/>
	<meta property="og:type" content="website" />
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href="/user-management" />
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
		<div>
			<h1 class="text-3xl font-bold text-gray-900">User Management</h1>
			<p class="mt-2 text-gray-600">Manage system users and their permissions.</p>
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
			<span class="ml-2">Loading users...</span>
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
				<div class="flex flex-col gap-4">
					<div class="flex flex-col gap-4 sm:flex-row">
						<div class="flex-1">
							<Label for="user-search">Search Users</Label>
							<div class="relative mt-2">
								<Search
									class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400"
								/>
								<Input
									id="user-search"
									type="text"
									placeholder="Search by name, student ID, or email..."
									value={searchInput}
									oninput={(e) => (searchInput = (e.target as HTMLInputElement).value)}
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											handleSearch();
										}
									}}
									class="pl-10"
								/>
							</div>
						</div>
						<div class="sm:w-64">
							<Label for="role-filter">Role Filter</Label>
							<Select.Root type="single" name="role-filter" bind:value={filterRole}>
								<Select.Trigger class="mt-2 w-full">
									{roleFilterContent}
								</Select.Trigger>
								<Select.Content>
									<Select.Group>
										<Select.Item
											value="all"
											label="All Users"
											onclick={() => {
												if (filterRole !== 'all') {
													filterRole = 'all';
													currentPage = 1;
													loadData();
												}
											}}>All Users</Select.Item
										>
										<Select.Item
											value="admin"
											label="Admins Only"
											onclick={() => {
												if (filterRole !== 'admin') {
													filterRole = 'admin';
													currentPage = 1;
													loadData();
												}
											}}>Admins Only</Select.Item
										>
										<Select.Item
											value="student"
											label="Students Only"
											onclick={() => {
												if (filterRole !== 'student') {
													filterRole = 'student';
													currentPage = 1;
													loadData();
												}
											}}>Students Only</Select.Item
										>
									</Select.Group>
								</Select.Content>
							</Select.Root>
						</div>
					</div>

					<div class="flex items-center justify-between gap-4">
						<p class="text-sm text-gray-600">
							{#if totalCount > 0}
								Showing {showingFrom}-{showingTo} of {totalCount} users
							{:else}
								No users found
							{/if}
						</p>
						<div class="flex gap-2">
							{#if searchTerm || filterRole !== 'all'}
								<Button
									variant="outline"
									size="sm"
									onclick={() => {
										searchInput = '';
										searchTerm = '';
										filterRole = 'all';
										currentPage = 1;
										loadData();
									}}
								>
									Clear Filters
								</Button>
							{/if}
							<Button variant="default" size="sm" onclick={handleSearch} disabled={loading}>
								<Search class="mr-2 h-4 w-4" />
								Search
							</Button>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Users class="h-5 w-5" />
					Users
				</CardTitle>
				<CardDescription>All registered users in the system.</CardDescription>
			</CardHeader>
			<CardContent>
				{#if users.length === 0 && !searchTerm && filterRole === 'all'}
					<div class="py-8 text-center">
						<Users class="mx-auto mb-4 h-12 w-12 text-gray-400" />
						<h3 class="mb-2 text-lg font-medium text-gray-900">No Users</h3>
						<p class="text-gray-600">No users have registered yet.</p>
					</div>
				{:else if users.length === 0}
					<div class="py-8 text-center">
						<Search class="mx-auto mb-4 h-12 w-12 text-gray-400" />
						<h3 class="mb-2 text-lg font-medium text-gray-900">No Users Found</h3>
						<p class="mb-4 text-gray-600">No users match your search criteria.</p>
						<Button
							variant="outline"
							onclick={() => {
								searchInput = '';
								searchTerm = '';
								filterRole = 'all';
								currentPage = 1;
								loadData();
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
									<TableHead class="w-1/4 min-w-[200px]">Name</TableHead>
									<TableHead class="w-1/6 min-w-[120px]">Student ID</TableHead>
									<TableHead class="w-1/4 min-w-[200px]">Email</TableHead>
									<TableHead class="w-1/8 min-w-[100px]">Role</TableHead>
									<TableHead class="w-1/4 min-w-[180px] text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each users as user}
									<TableRow>
										<TableCell class="max-w-0 font-medium">
											<div class="truncate font-semibold" title={getUserDisplayName(user)}>
												{getUserDisplayName(user)}
											</div>
										</TableCell>
										<TableCell class="max-w-0">
											{#if user.student_id}
												<span
													class="block truncate text-gray-900"
													title={user.student_id.toString()}
												>
													{user.student_id}
												</span>
											{:else}
												<span class="text-gray-400">N/A</span>
											{/if}
										</TableCell>
										<TableCell class="max-w-0">
											{#if user.email}
												<span class="block truncate text-gray-900" title={user.email}>
													{user.email}
												</span>
											{:else}
												<span class="text-gray-400">N/A</span>
											{/if}
										</TableCell>
										<TableCell>
											{@const userRole = getUserRole(user)}
											{@const badgeVariant =
												userRole === 'Superadmin'
													? 'destructive'
													: userRole === 'Admin'
														? 'default'
														: 'secondary'}
											{@const badgeClass =
												userRole === 'Admin' ? 'bg-green-600 text-white hover:bg-green-700' : ''}
											<Badge variant={badgeVariant} class={`shrink-0 ${badgeClass}`}>
												{#if userRole === 'Admin' || userRole === 'Superadmin'}
													<Shield class="mr-1 h-3 w-3" />
													<span class="hidden sm:inline">{userRole}</span>
													<span class="sm:hidden">{userRole.charAt(0)}</span>
												{:else}
													<Users class="mr-1 h-3 w-3" />
													<span class="hidden sm:inline">User</span>
													<span class="sm:hidden">U</span>
												{/if}
											</Badge>
										</TableCell>
										<TableCell class="text-right">
											<div class="flex min-w-0 items-center justify-end gap-2">
												<!-- Edit Button -->
												<Button
													variant="outline"
													size="sm"
													onclick={() => handleEditUser(user.profile_id)}
													class="flex shrink-0 items-center gap-1"
												>
													<Edit class="h-3 w-3" />
													<span class="hidden sm:inline">Edit</span>
												</Button>

												<!-- Delete Button -->
												<AlertDialog>
													<AlertDialogTrigger>
														<Button
															variant="outline"
															size="sm"
															class="flex shrink-0 items-center gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
															onclick={() => (selectedUserToDelete = user)}
														>
															<Trash2 class="h-3 w-3" />
															<span class="hidden sm:inline">Delete</span>
														</Button>
													</AlertDialogTrigger>
													<AlertDialogContent>
														<AlertDialogHeader>
															<AlertDialogTitle>Delete User</AlertDialogTitle>
															<AlertDialogDescription>
																Are you sure you want to delete "{getUserDisplayName(
																	selectedUserToDelete
																)}"? This will remove the user and all their associated data
																including registrations. This action cannot be undone.
															</AlertDialogDescription>
														</AlertDialogHeader>
														<AlertDialogFooter>
															<AlertDialogCancel onclick={() => (selectedUserToDelete = null)}>
																Cancel
															</AlertDialogCancel>
															<AlertDialogAction
																onclick={handleDeleteUser}
																class="bg-red-600 hover:bg-red-700"
															>
																Delete User
															</AlertDialogAction>
														</AlertDialogFooter>
													</AlertDialogContent>
												</AlertDialog>
											</div>
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					</div>

					<!-- Pagination -->
					{#if totalPages > 1}
						<div class="mt-6 flex items-center justify-between">
							<p class="text-sm text-gray-600">
								Page {currentPage} of {totalPages}
							</p>
							<div class="flex items-center gap-1">
								<!-- Previous Button -->
								<Button
									variant="ghost"
									size="sm"
									onclick={() => {
										if (currentPage > 1) handlePageChange(currentPage - 1);
									}}
									disabled={currentPage === 1}
									class="gap-1 px-2.5"
								>
									<span class="sr-only">Previous</span>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="m15 18-6-6 6-6" />
									</svg>
									<span class="hidden sm:inline">Previous</span>
								</Button>

								<!-- Page Numbers -->
								{#each pageNumbers as pageNum, i (i)}
									{#if pageNum === -1}
										<Button variant="ghost" size="sm" disabled class="px-2">
											<span>...</span>
										</Button>
									{:else}
										<Button
											variant={currentPage === pageNum ? 'outline' : 'ghost'}
											size="sm"
											onclick={() => handlePageChange(pageNum)}
											class="px-3"
										>
											{pageNum}
										</Button>
									{/if}
								{/each}

								<!-- Next Button -->
								<Button
									variant="ghost"
									size="sm"
									onclick={() => {
										if (currentPage < totalPages) handlePageChange(currentPage + 1);
									}}
									disabled={currentPage === totalPages}
									class="gap-1 px-2.5"
								>
									<span class="sr-only">Next</span>
									<span class="hidden sm:inline">Next</span>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="m9 18 6-6-6-6" />
									</svg>
								</Button>
							</div>
						</div>
					{/if}
				{/if}
			</CardContent>
		</Card>
	{/if}
</div>
