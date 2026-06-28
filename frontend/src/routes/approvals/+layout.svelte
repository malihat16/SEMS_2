<script lang="ts">
	import { onMount } from 'svelte';
	import { checkAdminAccess } from '$lib/permissions';
	import { goto } from '$app/navigation';

	let { children, data } = $props();
	let { supabase } = $derived(data);
	let loading = $state(true);
	let hasAccess = $state(false);

	onMount(async () => {
		hasAccess = await checkAdminAccess(supabase);
		if (!hasAccess) {
			goto('/forbidden');
			return;
		}
		loading = false;
	});
</script>

{#if loading}
	<div class="flex items-center justify-center py-12">
		<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
		<span class="ml-2">Checking permissions...</span>
	</div>
{:else if !hasAccess}
	<div class="container mx-auto max-w-2xl px-4 py-8">
		<p>Redirecting...</p>
	</div>
{:else}
	{@render children()}
{/if}
