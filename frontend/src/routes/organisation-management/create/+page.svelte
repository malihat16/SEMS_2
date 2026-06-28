<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createOrganisation } from '$lib/database';
	import { getUserProfile } from '$lib/auth';
	import { canCreateOrganisation } from '$lib/permissions';
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
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { toast } from 'svelte-sonner';
	import { ArrowLeft, Building } from '@lucide/svelte';

	let { data } = $props();
	let { supabase } = $derived(data);

	let formData = $state({
		name: '',
		description: ''
	});
	let loading = $state(false);
	let userProfile: any = $state(null);
	let errors: Record<string, string> = $state({});
	let hasPermission = $state(false);
	let checkingPermission = $state(true);

	onMount(async () => {
		// Check permission first
		const canCreate = await canCreateOrganisation(supabase);
		if (!canCreate) {
			goto('/forbidden');
			return;
		}

		hasPermission = true;
		checkingPermission = false;

		// Load user profile
		try {
			userProfile = await getUserProfile(supabase);
		} catch (error) {
			console.error('Error loading user profile:', error);
		}
	});

	function validateForm() {
		const newErrors: Record<string, string> = {};

		if (!formData.name.trim()) {
			newErrors.name = 'Organisation name is required';
		} else if (formData.name.trim().length < 2) {
			newErrors.name = 'Organisation name must be at least 2 characters';
		}

		errors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		console.log('Form submission started...');
		console.log('Form data:', formData);
		console.log('User profile:', userProfile);

		if (!validateForm() || !userProfile?.profile?.profile_id) {
			console.log('Validation failed or no user profile');
			return;
		}

		loading = true;
		try {
			console.log('Calling createOrganisation...');
			const result = await createOrganisation(
				supabase,
				{
					name: formData.name.trim(),
					description: formData.description.trim() || undefined
				},
				userProfile.profile.profile_id
			);

			console.log('createOrganisation result:', result);

			if (result) {
				console.log('Organisation created successfully, redirecting...');
				toast.success('Organisation created successfully');
				goto('/organisation-management');
			} else {
				console.log('Failed to create organisation');
				toast.error('Failed to create organisation. Please try again.');
			}
		} catch (error) {
			console.error('Error creating organisation:', error);
			toast.error('An error occurred while creating the organisation.');
		} finally {
			loading = false;
		}
	}

	function handleCancel() {
		goto('/organisation-management');
	}

	function handleInputChange(field: string, value: string) {
		formData[field as keyof typeof formData] = value;
		// Clear error when user starts typing
		if (errors[field]) {
			const newErrors = { ...errors };
			delete newErrors[field];
			errors = newErrors;
		}
	}
</script>

<div class="container mx-auto max-w-4xl px-4 py-8">
	{#if checkingPermission}
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
			<span class="ml-2">Checking permissions...</span>
		</div>
	{:else if !hasPermission}
		<div class="py-12 text-center">
			<p class="text-lg text-gray-600">You don't have permission to create organisations.</p>
		</div>
	{:else}
		<div class="mb-6">
			<Button variant="ghost" onclick={handleCancel} class="mb-4 flex items-center gap-2">
				<ArrowLeft class="h-4 w-4" />
				Back to Organisations
			</Button>

			<div class="flex items-center gap-3">
				<Building class="h-8 w-8 text-blue-600" />
				<div>
					<h1 class="text-3xl font-bold text-gray-900">Create Organisation</h1>
					<p class="mt-1 text-gray-600">Add a new organisation to the system.</p>
				</div>
			</div>
		</div>

		<Card>
			<CardHeader>
				<CardTitle>Organisation Details</CardTitle>
				<CardDescription>Provide the basic information for the new organisation.</CardDescription>
			</CardHeader>
			<CardContent>
				<form onsubmit={handleSubmit} class="space-y-6">
					<div class="space-y-2">
						<Label for="name">Organisation Name *</Label>
						<Input
							id="name"
							type="text"
							placeholder="Enter organisation name"
							value={formData.name}
							oninput={(e) => handleInputChange('name', (e.target as HTMLInputElement).value)}
							class={errors.name ? 'border-red-500' : ''}
							disabled={loading}
						/>
						{#if errors.name}
							<p class="text-sm text-red-600">{errors.name}</p>
						{/if}
					</div>

					<div class="space-y-2">
						<Label for="description">Description</Label>
						<Textarea
							id="description"
							placeholder="Enter organisation description (optional)"
							value={formData.description}
							oninput={(e) =>
								handleInputChange('description', (e.target as HTMLTextAreaElement).value)}
							rows={4}
							disabled={loading}
						/>
						<p class="text-sm text-gray-500">
							Provide a brief description of the organisation's purpose and activities.
						</p>
					</div>

					<div class="flex justify-end gap-4 border-t pt-6">
						<Button type="button" variant="outline" onclick={handleCancel} disabled={loading}>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={loading || !formData.name.trim()}
							class="flex items-center gap-2"
						>
							{#if loading}
								<div class="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
							{/if}
							Create Organisation
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	{/if}
</div>
