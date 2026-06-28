<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import Navbar from '@/components/navbar.svelte';
	import Footer from '@/components/footer.svelte';
	import { Toaster } from '$lib/components/ui/sonner/index.js';

	let { children, data } = $props();
	let { session, supabase } = $derived(data);

	// Navigation configuration
	const pagesWithoutNavbar = ['/', '/register', '/callback'];
	const showNavbar = $derived(!pagesWithoutNavbar.includes($page.url.pathname));

	// Footer configuration
	const footerConfig = {
		mode: 'include',
		includePages: ['/'],
		excludePages: ['/login', '/register', '/callback']
	};

	const showFooter = $derived(
		footerConfig.mode === 'include'
			? footerConfig.includePages.includes($page.url.pathname)
			: !footerConfig.excludePages.includes($page.url.pathname)
	);

	// Listen for auth state changes and invalidate session
	onMount(() => {
		const { data: authData } = supabase.auth.onAuthStateChange((event, newSession) => {
			console.log('Auth state change:', event, newSession ? 'session exists' : 'no session');

			if (newSession?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth');
			}
		});

		return () => authData.subscription.unsubscribe();
	});
</script>

<svelte:head>
	<!-- Global meta tags -->
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta name="theme-color" content="#1f2937" />
	<meta name="author" content="SEMS Team" />
	<meta name="application-name" content="SEMS" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="apple-mobile-web-app-title" content="SEMS" />
	<meta name="format-detection" content="telephone=no" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="msapplication-config" content="none" />
	<meta name="msapplication-TileColor" content="#1f2937" />
	<meta name="msapplication-tap-highlight" content="no" />

	<!-- Favicon and icons -->
	<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
	<link rel="apple-touch-icon" href="/favicon.png" />

	<!-- Default Open Graph tags (can be overridden by individual pages) -->
	<meta property="og:site_name" content="SEMS - Student Experience Management System" />
	<meta property="og:locale" content="en_US" />

	<!-- Default Twitter tags -->
	<meta name="twitter:site" content="@sems" />
	<meta name="twitter:creator" content="@sems" />
</svelte:head>

{#if showNavbar}
	<Navbar {supabase} />
{/if}

<Toaster />

<div class="flex min-h-screen flex-col">
	<main class="{showNavbar ? 'pt-0' : ''} min-h-screen flex-grow">
		{@render children()}
	</main>

	{#if showFooter}
		<Footer />
	{/if}
</div>
