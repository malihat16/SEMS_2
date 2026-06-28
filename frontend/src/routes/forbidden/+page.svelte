<script lang="ts">
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card/index.js';
	import { AlertTriangle, Home, ArrowLeft } from '@lucide/svelte';
	import { goto } from '$app/navigation';

	function goHome() {
		goto('/events');
	}

	function goBack() {
		history.back();
	}
</script>

<svelte:head>
	<title>Access Denied - SEMS</title>
	<meta name="description" content="Access denied. You don't have permission to view this page." />
	<meta property="og:title" content="Access Denied - SEMS" />
	<meta
		property="og:description"
		content="Access denied. You don't have permission to view this page."
	/>
	<meta property="og:type" content="website" />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-8">
	<Card class="py-12 text-center">
		<CardHeader>
			<div class="mb-4 flex justify-center">
				<AlertTriangle class="h-16 w-16 text-red-500" />
			</div>
			<CardTitle class="mb-2 text-2xl text-red-600">Access Denied</CardTitle>
			<CardDescription class="text-lg">
				You don't have permission to access this page.
			</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			<p class="text-gray-600">
				This page is restricted and requires special permissions. Please contact an administrator if
				you believe you should have access.
			</p>

			<div class="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
				<!-- <button 
					onclick={goBack} 
					class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
				>
					<ArrowLeft class="h-4 w-4" />
					Go Back
				</button> -->
				<button
					onclick={goHome}
					class="focus-visible:ring-ring bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
				>
					<Home class="h-4 w-4" />
					Go Home
				</button>
			</div>
		</CardContent>
	</Card>
</div>
