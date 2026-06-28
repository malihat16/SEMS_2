<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidate } from '$app/navigation';

	let { data } = $props();
	let { supabase } = $derived(data);

	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			// Wait for Supabase to detect and exchange the session from the URL
			// This automatically handles PKCE (uses code verifier from localStorage)
			const {
				data: { session },
				error: sessionError
			} = await supabase.auth.getSession();

			if (sessionError) {
				console.error('Session error:', sessionError);
				error = sessionError.message;
				loading = false;
				return;
			}

			if (session?.user) {
				// Session successfully established!
				// Invalidate to sync with server-side session
				await invalidate('supabase:auth');

				const userId = session.user.id;

				// Check if user has a profile
				const { data: profile, error: profileError } = await supabase
					.from('profile')
					.select('profile_id')
					.eq('user_id', userId)
					.single();

				if (profileError || !profile) {
					// No profile - redirect to registration
					goto('/register');
				} else {
					// Profile exists - redirect to events
					goto('/events');
				}
			} else {
				// No session found - redirect to home
				console.log('No session found after callback');
				goto('/');
			}
		} catch (err) {
			console.error('Callback error:', err);
			error = 'An unexpected error occurred';
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Authentication - SEMS</title>
	<meta name="description" content="Completing authentication process..." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="callback-bg"></div>
<div class="relative z-[1] flex min-h-screen items-center justify-center">
	<div
		class="flex w-full max-w-md flex-col items-center rounded-2xl bg-white p-12 shadow-lg md:p-8"
	>
		{#if loading}
			<div class="flex flex-col items-center gap-4">
				<div
					class="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--fresh-blue)]"
				></div>
				<div class="text-lg font-semibold">Completing sign in...</div>
			</div>
		{:else if error}
			<div class="flex flex-col items-center gap-4 text-center">
				<div class="text-lg font-semibold text-red-500">Authentication Error</div>
				<div class="text-gray-600">{error}</div>
				<button
					class="rounded-lg bg-[var(--fresh-blue)] px-6 py-2 font-semibold text-white transition-colors hover:bg-[var(--fresh-blue-dark)]"
					onclick={() => goto('/')}
				>
					Try Again
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.callback-bg {
		position: fixed;
		width: 100vw;
		height: 100vh;
		background: url('/landing.jpg') center center/cover no-repeat;
		filter: blur(2px);
		z-index: 0;
	}
</style>
