<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { ExternalLink, Users } from '@lucide/svelte';
	import type { Event } from '$lib/types';

	// Props
	interface Props {
		open: boolean;
		event: Event | null;
		isRegistering: boolean;
		onClose: () => void;
		onRegister: () => void;
		onOpenRegistrationForm: () => void;
	}
	let {
		open = $bindable(),
		event,
		isRegistering = false,
		onClose,
		onRegister,
		onOpenRegistrationForm
	}: Props = $props();

	// Local state
	let secretCode = $state('');
	let formCompleted = $state(false);

	// Export these values so parent can access them
	export function getFormValues() {
		return { secretCode, formCompleted };
	}

	export function resetForm() {
		secretCode = '';
		formCompleted = false;
	}

	// Reset form when dialog closes
	$effect(() => {
		if (!open) {
			resetForm();
		}
	});

	function formatDate(dateString: string | null | undefined) {
		if (!dateString) return 'TBA';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function formatTime(dateString: string | null | undefined) {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: true
		});
	}

	// Check if form is valid for submission
	const isFormValid = $derived(() => {
		if (!event) return false;

		// Check if event is at full capacity
		if (
			event.capacity !== null &&
			event.capacity !== undefined &&
			event.registration_count !== undefined
		) {
			const remainingCapacity = event.capacity - event.registration_count;
			if (remainingCapacity <= 0) return false;
		}

		// Check if external form is required and completed
		if (event.registration_url && !formCompleted) return false;

		// Check if secret code is required and provided
		if (
			event.registration_secret_code &&
			event.registration_secret_code.trim() !== '' &&
			!secretCode.trim()
		)
			return false;

		return true;
	});
</script>

<Dialog bind:open>
	<DialogContent class="max-w-md">
		<DialogHeader>
			<DialogTitle>Register for Event</DialogTitle>
			<DialogDescription>
				{#if event}
					Complete the requirements below to register for {event.name}.
				{/if}
			</DialogDescription>
		</DialogHeader>

		{#if event}
			<div class="space-y-4">
				<!-- Capacity Check Section -->
				{#if event.capacity && event.registration_count}
					{@const remainingCapacity = event.capacity - event.registration_count}
					{#if remainingCapacity <= 0}
						<div class="rounded-lg border border-red-200 bg-red-50 p-4">
							<h5 class="font-sm mb-2 font-semibold text-red-900">Event Full</h5>
							<p class="text-xs text-red-800">
								This event has reached its maximum capacity of {event.capacity} registrants. Registration
								is no longer available.
							</p>
						</div>
					{:else if remainingCapacity <= 5}
						<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
							<h5 class="font-sm mb-2 font-semibold text-yellow-900">Limited Spots Remaining</h5>
							<p class="text-xs text-yellow-800">
								Only {remainingCapacity} spot{remainingCapacity === 1 ? '' : 's'} remaining out of {event.capacity}.
							</p>
						</div>
					{/if}
				{/if}

				<!-- External Registration Form Section -->
				{#if event.registration_url}
					<div class="space-y-3">
						<div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
							<h5 class="font-sm mb-2 font-semibold text-blue-900">Registration Form Required</h5>
							<p class="mb-3 text-xs text-blue-800">
								Please complete the external registration form before proceeding.
							</p>
							<Button
								onclick={onOpenRegistrationForm}
								class="flex items-center gap-2"
								variant="outline"
							>
								<ExternalLink class="h-4 w-4" />
								Open Registration Form
							</Button>
						</div>

						<div class="mb-1 flex items-center space-x-2">
							<Checkbox
								id="form-completed"
								bind:checked={formCompleted}
								aria-describedby="form-completed-description"
							/>
							<Label
								for="form-completed"
								class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
							>
								Form has been filled *
							</Label>
						</div>
						<p id="form-completed-description" class="text-xs text-gray-500">
							Please confirm that you have completed the registration form.
						</p>
					</div>
				{/if}

				<!-- Secret Code Section -->
				{#if event.registration_secret_code && event.registration_secret_code.trim()}
					<div class="space-y-1">
						<Label for="secret-code">Secret Code *</Label>
						<Input
							id="secret-code"
							type="text"
							placeholder="Enter the secret code"
							bind:value={secretCode}
							class="w-full"
							required
						/>
						<p class="text-xs text-gray-500">This event requires a secret code to register.</p>
					</div>
				{/if}

				<!-- Event Details Summary -->
				<div class="rounded-lg border bg-gray-50 p-3">
					<h5 class="mb-2 text-sm font-medium text-gray-900">Event Summary</h5>
					<div class="space-y-1 text-xs text-gray-600">
						<div><span class="font-medium">Event:</span> {event.name}</div>
						{#if event.start_datetime}
							<div>
								<span class="font-medium">Date:</span>
								{formatDate(event.start_datetime)}
								{#if event.start_datetime}
									at {formatTime(event.start_datetime)}
								{/if}
							</div>
						{/if}
						{#if event.venue}
							<div><span class="font-medium">Venue:</span> {event.venue}</div>
						{/if}
						<!-- {#if event.capacity !== null && event.capacity !== undefined}
							<div>
								<span class="font-medium">Capacity:</span>
								{event.registration_count || 0} / {event.capacity} registered
							</div>
						{/if} -->
					</div>
				</div>
			</div>
		{/if}

		<DialogFooter>
			<Button
				variant="outline"
				onclick={onClose}
				disabled={isRegistering}
				class="flex-1 sm:flex-initial"
			>
				Cancel
			</Button>
			<Button
				onclick={onRegister}
				disabled={isRegistering || !isFormValid}
				class="flex flex-1 items-center gap-2 sm:flex-initial"
			>
				{#if isRegistering}
					<div class="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
				{:else}
					<Users class="h-4 w-4" />
				{/if}
				{#if isRegistering}
					Registering...
				{:else if event?.capacity !== null && event?.capacity !== undefined && event?.registration_count !== undefined && event.capacity - event.registration_count <= 0}
					Event Full
				{:else}
					Complete Registration
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
