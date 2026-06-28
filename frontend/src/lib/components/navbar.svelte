<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getUserProfile, signOut } from '../auth';
	// Import permissions functions for potential future use in role checking
	import { checkAdminAccess, checkSuperAdminAccess, checkScannerAccess } from '$lib/permissions';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar/index.js';
	// Import Lucide icons
	import {
		Calendar,
		BarChart3,
		CheckCircle,
		Building,
		Users,
		ChevronDown,
		Menu,
		X,
		User,
		LogOut,
		Shield,
		ScanQrCode
	} from '@lucide/svelte';

	let { supabase } = $props();

	/**
	 * @param {string} path
	 */
	function handleNav(path) {
		goto(path);
		closeMobileMenu(); // Close mobile menu when navigating
	}

	const allNavButtons = [
		{
			label: 'Events',
			path: '/events',
			paths: [],
			roles: ['User', 'Admin', 'Superadmin']
		},
		{
			label: 'Organisers',
			path: '',
			paths: [
				{
					name: 'Event Management',
					path: '/event-management',
					roles: ['User', 'Admin', 'Superadmin'],
					icon: Calendar,
					description: ''
				},
				{
					name: 'Organisation Management',
					path: '/organisation-management',
					roles: ['User', 'Admin', 'Superadmin'],
					icon: Building,
					description: ''
				},
				{
					name: 'Scan QR Codes',
					path: '/scanner',
					roles: ['User', 'Admin', 'Superadmin'],
					icon: ScanQrCode,
					description: ''
				}
			],
			roles: ['User', 'Admin', 'Superadmin']
		},
		{
			label: 'Admins',
			path: '',
			paths: [
				{
					name: 'Analytics & Reporting',
					path: '/analytics',
					roles: ['Admin', 'Superadmin'],
					icon: BarChart3,
					description: ''
				},
				{
					name: 'Approvals',
					path: '/approvals',
					roles: ['Admin', 'Superadmin'],
					icon: CheckCircle,
					description: ''
				},
				{
					name: 'Event Management',
					path: '/event-management',
					roles: ['Admin', 'Superadmin'],
					icon: Calendar,
					description: ''
				},
				{
					name: 'Organisation Management',
					path: '/organisation-management',
					roles: ['Admin', 'Superadmin'],
					icon: Building,
					description: ''
				},
				{
					name: 'User Management',
					path: '/user-management',
					roles: ['Superadmin'],
					icon: Users,
					description: ''
				}
			],
			roles: ['Admin', 'Superadmin']
		}
	];

	let userName = $state('');
	/** @type {any} */
	let userProfile = $state(null);
	/** @type {number | 'user' | null} */
	let openDropdown = $state(null);
	let userRole = $state('');
	/** @type {any[]} */
	let navButtons = $state([]);
	let isMobileMenuOpen = $state(false);
	let hasScannerAccess = $state(false);

	/**
	 * Toggle mobile menu
	 */
	function toggleMobileMenu() {
		isMobileMenuOpen = !isMobileMenuOpen;
	}

	/**
	 * Close mobile menu
	 */
	function closeMobileMenu() {
		isMobileMenuOpen = false;
	}

	/**
	 * Get the user's role from their profile
	 * @returns {string}
	 */
	function getUserRole() {
		return userProfile?.profile?.profile_role?.name || 'User';
	}

	/**
	 * Check if user has access to a specific role requirement
	 * @param {string[]} requiredRoles
	 * @returns {boolean}
	 */
	function hasRoleAccess(requiredRoles) {
		return requiredRoles.includes(userRole);
	}

	/**
	 * Filter navigation buttons based on user role
	 */
	function getFilteredNavButtons() {
		return allNavButtons
			.map((btn) => {
				// For buttons with paths (dropdowns)
				if (btn.paths && btn.paths.length > 0) {
					// Filter the paths based on user role and special permissions
					const accessiblePaths = btn.paths.filter((path) => {
						// Special handling for scanner route - requires scanner access
						if (path.path === '/scanner') {
							return hasScannerAccess;
						}
						// Default role-based filtering
						return hasRoleAccess(path.roles);
					});

					// Only include the button if it has accessible paths
					if (accessiblePaths.length > 0) {
						return {
							...btn,
							paths: accessiblePaths
						};
					}
					return null; // No accessible paths, don't show button
				} else {
					// For single buttons, check if user has access
					return hasRoleAccess(btn.roles || []) ? btn : null;
				}
			})
			.filter((btn) => btn !== null); // Remove null entries
	}

	// Update navigation when user role or scanner access changes
	$effect(() => {
		if (userRole || hasScannerAccess !== undefined) {
			navButtons = getFilteredNavButtons();
		}
	});

	onMount(async () => {
		const profile = await getUserProfile(supabase);
		if (profile) {
			userProfile = profile;
			userName =
				profile.profile?.full_name ||
				profile.user_metadata?.full_name ||
				profile.user_metadata?.name ||
				profile.email?.split('@')[0] ||
				'User';

			// Update user role - reactive statement will handle navigation filtering
			userRole = getUserRole();

			// Check scanner access
			hasScannerAccess = await checkScannerAccess(supabase);

			console.log('User role:', userRole);
			console.log('Scanner access:', hasScannerAccess);
		} else {
			// No user logged in
			userRole = '';
			hasScannerAccess = false;
			navButtons = [];
		}
	});

	async function logout() {
		try {
			const success = await signOut(supabase);
			goto('/');

			if (!success) {
				console.warn('Sign out had issues, but redirecting anyway');
			}
		} catch (error) {
			console.error('Error during logout:', error);
			goto('/');
		}
	}

	/**
	 * @param {number | 'user'} index
	 */
	function showDropdown(index) {
		openDropdown = index;
	}

	function closeDropdowns() {
		openDropdown = null;
	}

	function handleLogo() {
		goto('/events');
	}
</script>

<nav class="bg-primary text-primary-foreground border-b shadow-lg">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 items-center justify-between">
			<!-- Logo -->
			<div class="flex items-center sm:px-5">
				<button class="flex cursor-pointer items-center space-x-2" onclick={handleLogo}>
					<img src="/logo.png" alt="Logo" class="h-8 w-auto object-contain" />
				</button>
			</div>

			<!-- Navigation Links -->
			<div class="hidden items-center space-x-2 md:flex">
				{#each navButtons as btn, index}
					{#if btn.paths.length > 0}
						<!-- Custom Dropdown -->
						<div
							class="relative"
							role="button"
							tabindex="0"
							onmouseenter={() => showDropdown(index)}
							onmouseleave={closeDropdowns}
						>
							<Button
								variant="ghost"
								class="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10 flex items-center gap-1"
							>
								{btn.label}
								<ChevronDown
									class="h-4 w-4 transition-transform duration-200 {openDropdown === index
										? 'rotate-180'
										: ''}"
								/>
							</Button>

							{#if openDropdown === index}
								<div class="absolute left-0 top-full z-50 w-64 pt-4">
									<div
										class="animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 relative flex max-h-[420px] flex-col overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 text-gray-950/70 shadow-xl shadow-gray-500/5 dark:border-white/[0.07] dark:bg-gray-900 dark:text-white/70 dark:shadow-gray-500/5"
									>
										{#each btn.paths as subPath}
											<button
												class="flex w-full cursor-pointer items-center gap-2 rounded-xl p-1.5 text-left hover:bg-gray-600/5 dark:hover:bg-gray-200/5"
												onclick={(e) => {
													e.stopPropagation();
													handleNav(subPath.path);
													closeDropdowns();
												}}
											>
												<div
													class="rounded-lg border border-gray-200 p-1.5 dark:border-white/[0.07]"
												>
													<subPath.icon class="h-4 w-4 shrink-0" />
												</div>
												<div class="flex flex-1 flex-col px-1">
													<div
														class="flex items-center gap-1 text-sm font-medium text-gray-800 dark:text-gray-300"
													>
														{subPath.name}
														{#if subPath.roles.includes('Superadmin') && subPath.roles.length === 1}
															<Shield class="h-3 w-3 text-gray-800 dark:text-gray-300" />
														{/if}
													</div>
													<div class="text-xs text-gray-600 dark:text-gray-400">
														{subPath.description}
													</div>
												</div>
											</button>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{:else}
						<Button
							variant="ghost"
							class="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10 cursor-pointer"
							onclick={() => handleNav(btn.path)}
						>
							{btn.label}
						</Button>
					{/if}
				{/each}
			</div>

			<!-- Mobile menu button -->
			<div class="flex items-center md:hidden">
				<button
					class="text-primary-foreground hover:bg-primary-foreground/10 rounded-md p-2"
					onclick={toggleMobileMenu}
					aria-label="Toggle mobile menu"
				>
					{#if isMobileMenuOpen}
						<X class="h-6 w-6" />
					{:else}
						<Menu class="h-6 w-6" />
					{/if}
				</button>
			</div>

			<!-- User Menu -->
			<div class="hidden items-center space-x-4 md:flex">
				{#if userName}
					<!-- Custom User Dropdown -->
					<div
						class="relative"
						role="button"
						tabindex="0"
						onmouseenter={() => showDropdown('user')}
						onmouseleave={closeDropdowns}
					>
						<button
							class="text-primary-foreground hover:bg-primary-foreground/10 flex items-center space-x-2 rounded-md px-3 py-2"
						>
							<Avatar class="h-8 w-8">
								{#if userProfile?.user_metadata?.picture || userProfile?.user_metadata?.avatar_url}
									<AvatarImage
										src={userProfile.user_metadata.picture || userProfile.user_metadata.avatar_url}
										alt={userName}
									/>
								{/if}
								<AvatarFallback class="bg-primary-foreground text-primary">
									{userName.charAt(0).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<span class="hidden sm:block">{userName}</span>
							<ChevronDown
								class="h-4 w-4 transition-transform duration-200 {openDropdown === 'user'
									? 'rotate-180'
									: ''}"
							/>
						</button>

						{#if openDropdown === 'user'}
							<div class="absolute right-0 top-full z-50 w-56 pt-2.5">
								<div
									class="animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 relative flex max-h-[420px] flex-col overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 text-gray-950/70 shadow-xl shadow-gray-500/5 dark:border-white/[0.07] dark:bg-gray-900 dark:text-white/70 dark:shadow-gray-500/5"
								>
									<button
										class="flex w-full cursor-pointer items-center gap-2 rounded-xl p-1.5 text-left hover:bg-gray-600/5 dark:hover:bg-gray-200/5"
										onclick={(e) => {
											e.stopPropagation();
											handleNav('/profile');
											closeDropdowns();
										}}
									>
										<div class="rounded-lg border border-gray-200 p-1.5 dark:border-white/[0.07]">
											<User class="h-4 w-4 shrink-0" />
										</div>
										<div class="flex flex-1 flex-col px-1">
											<div
												class="flex items-center gap-1 text-sm font-medium text-gray-800 dark:text-gray-300"
											>
												Profile
											</div>
										</div>
									</button>
									<button
										class="flex w-full cursor-pointer items-center gap-2 rounded-xl p-1.5 text-left hover:bg-gray-600/5 dark:hover:bg-gray-200/5"
										onclick={(e) => {
											e.stopPropagation();
											logout();
											closeDropdowns();
										}}
									>
										<div class="rounded-lg border border-gray-200 p-1.5 dark:border-white/[0.07]">
											<LogOut class="h-4 w-4 shrink-0" />
										</div>
										<div class="flex flex-1 flex-col px-1">
											<div
												class="flex items-center gap-1 text-sm font-medium text-gray-800 dark:text-gray-300"
											>
												Logout
											</div>
										</div>
									</button>
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<Button
						variant="ghost"
						class="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
						onclick={() => handleNav('/')}
					>
						Login
					</Button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Mobile menu -->
	<div
		class="overflow-hidden transition-all duration-300 ease-in-out md:hidden {isMobileMenuOpen
			? 'max-h-screen opacity-100'
			: 'max-h-0 opacity-0'}"
	>
		<div class="border-primary-foreground/20 bg-primary rounded-b-lg border-t shadow-lg">
			<div class="space-y-2 px-4 pb-5 pt-3">
				<!-- Mobile Navigation Links -->
				{#each navButtons as btn}
					{#if btn.paths.length > 0}
						<!-- Mobile Dropdown Section -->
						<div class="space-y-1">
							<div class="text-primary-foreground px-3 py-2 text-sm font-medium">
								{btn.label}
							</div>
							{#each btn.paths as subPath}
								<button
									class="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 block w-full rounded-md px-6 py-2 text-left text-sm"
									onclick={() => handleNav(subPath.path)}
								>
									<div class="flex items-center gap-2">
										{subPath.name}
										{#if subPath.roles.includes('Superadmin') && subPath.roles.length === 1}
											<Shield class="h-3 w-3" />
										{/if}
									</div>
								</button>
							{/each}
						</div>
					{:else}
						<button
							class="text-primary-foreground hover:bg-primary-foreground/10 block w-full rounded-md px-3 py-2 text-left"
							onclick={() => handleNav(btn.path)}
						>
							{btn.label}
						</button>
					{/if}
				{/each}

				<!-- Mobile User Menu -->
				{#if userName}
					<div class="border-primary-foreground/20 mt-3 border-t pt-3">
						<div class="flex items-center space-x-3 px-3 py-2">
							<!-- <Avatar class="h-8 w-8">
								{#if userProfile?.user_metadata?.picture || userProfile?.user_metadata?.avatar_url}
									<AvatarImage
										src={userProfile.user_metadata.picture || userProfile.user_metadata.avatar_url}
										alt={userName}
									/>
								{/if}
								<AvatarFallback class="bg-primary-foreground text-primary">
									{userName.charAt(0).toUpperCase()}
								</AvatarFallback>
							</Avatar> -->
							<span class="text-primary-foreground font-medium">{userName}</span>
						</div>
						<div class="mt-2 space-y-1">
							<button
								class="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 block w-full rounded-md px-3 py-2 text-left text-sm"
								onclick={() => handleNav('/profile')}
							>
								Profile
							</button>
							<button
								class="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 block w-full rounded-md px-3 py-2 text-left text-sm"
								onclick={logout}
							>
								Logout
							</button>
						</div>
					</div>
				{:else}
					<div class="border-primary-foreground/20 mt-3 border-t pt-3">
						<button
							class="text-primary-foreground hover:bg-primary-foreground/10 block w-full rounded-md px-3 py-2 text-left"
							onclick={() => handleNav('/')}
						>
							Login
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</nav>
