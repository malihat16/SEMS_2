<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		getOrganisations,
		updateOrganisation,
		requestOrganisationUpdate,
		clearOrganisationUpdateRequest
	} from '$lib/database';
	import { getUserProfile } from '$lib/auth';
	import { canEditOrganisation } from '$lib/permissions';
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
	import type { Organisation } from '$lib/types';

	let { data } = $props();
	let { supabase } = $derived(data);

	let organisationId = $state('');
	let formData = $state({
		name: '',
		description: ''
	});
	let loading = $state(true);
	let requesting = $state(false);
	let canceling = $state(false);
	let userProfile: any = $state(null);
	let organisation: Organisation | null = $state(null);
	let errors: Record<string, string> = $state({});
	let hasPermission = $state(false);
	let pendingRequest = $state<any>(null);

	onMount(async () => {
		organisationId = $page.params?.id || '';
		await loadData();
	});

	async function loadData() {
		loading = true;
		try {
			const [profile, organisations] = await Promise.all([getUserProfile(supabase), getOrganisations(supabase)]);

			userProfile = profile;
			organisation = organisations.find((org) => org.organisation_id === organisationId) || null;

			if (!organisation) {
				goto('/organisation-management');
				return;
			}

			// Check for pending update request
			if (organisation?.organisation_update_request) {
				pendingRequest = organisation.organisation_update_request;
			}

			// Check permission to edit this organisation
			const canEdit = await canEditOrganisation(supabase, organisationId);
			if (!canEdit) {
				goto('/forbidden');
				return;
			}

			hasPermission = true;
			formData = {
				name: organisation.name || '',
				description: organisation.description || ''
			};
		} catch (error) {
			console.error('Error loading data:', error);
			goto('/organisation-management');
		} finally {
			loading = false;
		}
	}

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

	function handleCancel() {
		goto('/organisation-management');
	}

	async function handleRequestUpdate() {
		if (!validateForm() || !userProfile?.profile?.profile_id || !organisation) return;

		requesting = true;
		try {
			// Create the update request object
			const updateRequest = {
				name: formData.name.trim(),
				description: formData.description.trim() || null
			};

			const result = await requestOrganisationUpdate(supabase, organisation.organisation_id, updateRequest);

			if (result) {
				organisation = result;
				pendingRequest = updateRequest;
				toast.success('Organisation update request submitted successfully');
			} else {
				toast.error('Failed to submit organisation update request. Please try again.');
			}
		} catch (error) {
			console.error('Error requesting organisation update:', error);
			toast.error('An error occurred while submitting the organisation update request.');
		} finally {
			requesting = false;
		}
	}

	async function handleCancelRequest() {
		if (!organisation) return;

		canceling = true;
		try {
			const result = await clearOrganisationUpdateRequest(supabase, organisation.organisation_id);

			if (result) {
				organisation = result;
				pendingRequest = null;
				toast.success('Organisation update request cancelled successfully');
			} else {
				toast.error('Failed to cancel organisation update request. Please try again.');
			}
		} catch (error) {
			console.error('Error cancelling organisation update request:', error);
			toast.error('An error occurred while cancelling the organisation update request.');
		} finally {
			canceling = false;
		}
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
	<div class="mb-6">
		<Button variant="ghost" onclick={handleCancel} class="mb-4 flex items-center gap-2">
			<ArrowLeft class="h-4 w-4" />
			Back to Organisations
		</Button>

		<div class="flex items-center gap-3">
			<Building class="h-8 w-8 text-blue-600" />
			<div>
				<h1 class="text-3xl font-bold text-gray-900">Edit Organisation</h1>
				<p class="mt-1 text-gray-600">
					{#if organisation}
						Editing "{organisation.name}"
					{:else}
						Loading organisation details...
					{/if}
				</p>
			</div>
		</div>
	</div>

	{#if pendingRequest}
		<Card class="mb-6 border-orange-200 bg-orange-50">
			<CardHeader>
				<CardTitle class="flex items-center text-orange-800">
					<svg class="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
							clip-rule="evenodd"
						/>
					</svg>
					Pending Update Request
				</CardTitle>
				<CardDescription class="text-orange-700">
					Pending organisation update request submitted.
				</CardDescription>
			</CardHeader>
			<CardContent class="flex justify-end">
				<Button variant="outline" size="sm" disabled={canceling} onclick={handleCancelRequest}>
					{#if canceling}
						<div class="mr-2 h-3 w-3 animate-spin rounded-full border-b-2 border-current"></div>
						Cancelling...
					{:else}
						Cancel Request
					{/if}
				</Button>
			</CardContent>
		</Card>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
			<span class="ml-2">Loading organisation...</span>
		</div>
	{:else if organisation}
		<Card>
			<CardHeader>
				<CardTitle>Organisation Details</CardTitle>
				<CardDescription>Update the organisation information.</CardDescription>
			</CardHeader>
			<CardContent>
				<form class="space-y-6">
					<div class="space-y-2">
						<Label for="name">Organisation Name *</Label>
						<Input
							id="name"
							type="text"
							placeholder="Enter organisation name"
							value={formData.name}
							oninput={(e) => handleInputChange('name', (e.target as HTMLInputElement).value)}
							class={errors.name ? 'border-red-500' : ''}
							disabled={requesting}
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
							disabled={requesting}
						/>
						<p class="text-sm text-gray-500">
							Provide a brief description of the organisation's purpose and activities.
						</p>
					</div>

					<div class="flex justify-end gap-4 border-t pt-6">
						<Button type="button" variant="outline" onclick={handleCancel} disabled={requesting}>
							Cancel
						</Button>
						<Button
							type="button"
							disabled={requesting || !!pendingRequest || !formData.name.trim()}
							onclick={handleRequestUpdate}
							class="flex items-center gap-2"
						>
							{#if requesting}
								<div class="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
								Requesting Update...
							{:else if pendingRequest}
								Request Pending
							{:else}
								Request Update
							{/if}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	{:else}
		<Card>
			<CardContent class="py-8 text-center">
				<p class="text-gray-600">Organisation not found.</p>
				<Button onclick={handleCancel} class="mt-4">Back to Organisations</Button>
			</CardContent>
		</Card>
	{/if}
</div>
