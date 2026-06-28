<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog/index.js';
	import { CheckCircle2, XCircle, FileText, ExternalLink, Hash } from '@lucide/svelte';
	import type { Event } from '$lib/types';

	// Props
	interface Props {
		open: boolean;
		event: Event | null;
		isSubmitting: boolean;
		onClose: () => void;
		onApprove: (reviewData: {
			emsNumber?: string;
			emsUrl?: string;
			reviewerNotes?: string;
		}) => void;
		onReject: (reviewData: { emsNumber?: string; emsUrl?: string; reviewerNotes?: string }) => void;
	}
	let {
		open = $bindable(),
		event,
		isSubmitting = false,
		onClose,
		onApprove,
		onReject
	}: Props = $props();

	// Local state
	let emsNumber = $state('');
	let emsUrl = $state('');
	let reviewerNotes = $state('');

	// Export these values so parent can access them
	export function getFormValues() {
		return { emsNumber, emsUrl, reviewerNotes };
	}

	export function resetForm() {
		emsNumber = '';
		emsUrl = '';
		reviewerNotes = '';
	}

	// Reset form when dialog closes
	$effect(() => {
		if (!open) {
			resetForm();
		}
	});

	function handleApprove() {
		const reviewData = {
			emsNumber: emsNumber.trim() || undefined,
			emsUrl: emsUrl.trim() || undefined,
			reviewerNotes: reviewerNotes.trim() || undefined
		};
		onApprove(reviewData);
	}

	function handleReject() {
		const reviewData = {
			emsNumber: emsNumber.trim() || undefined,
			emsUrl: emsUrl.trim() || undefined,
			reviewerNotes: reviewerNotes.trim() || undefined
		};
		onReject(reviewData);
	}

	function formatEmsUrl() {
		if (emsUrl && !emsUrl.startsWith('http://') && !emsUrl.startsWith('https://')) {
			emsUrl = 'https://' + emsUrl;
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="max-w-md">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<FileText class="h-5 w-5" />
				Review Event
			</DialogTitle>
			<DialogDescription>
				Review and approve or reject the event: <strong>{event?.name}</strong>
			</DialogDescription>
		</DialogHeader>

		{#if event}
			<div class="space-y-4">
				<!-- EMS Number -->
				<div class="space-y-2">
					<Label for="ems-number" class="flex items-center gap-2">
						<Hash class="h-4 w-4" />
						EMS Number
					</Label>
					<Input
						id="ems-number"
						bind:value={emsNumber}
						placeholder="Enter EMS number"
						disabled={isSubmitting}
					/>
				</div>

				<!-- EMS URL -->
				<div class="space-y-2">
					<Label for="ems-url" class="flex items-center gap-2">
						<ExternalLink class="h-4 w-4" />
						EMS Link
					</Label>
					<Input
						id="ems-url"
						bind:value={emsUrl}
						placeholder="Enter EMS link"
						onblur={formatEmsUrl}
						disabled={isSubmitting}
					/>
				</div>

				<!-- Review Notes -->
				<div class="space-y-2">
					<Label for="review-notes" class="flex items-center gap-2">
						<FileText class="h-4 w-4" />
						Review Notes
					</Label>
					<Textarea
						id="review-notes"
						bind:value={reviewerNotes}
						placeholder="Enter review notes or feedback"
						rows={3}
						disabled={isSubmitting}
					/>
				</div>
			</div>
		{/if}

		<DialogFooter class="gap-2">
			<Button variant="outline" onclick={onClose} disabled={isSubmitting}>Cancel</Button>
			<Button
				variant="destructive"
				onclick={handleReject}
				disabled={isSubmitting}
				class="flex items-center gap-2"
			>
				<XCircle class="h-4 w-4" />
				{isSubmitting ? 'Rejecting...' : 'Reject'}
			</Button>
			<Button onclick={handleApprove} disabled={isSubmitting} class="flex items-center gap-2">
				<CheckCircle2 class="h-4 w-4" />
				{isSubmitting ? 'Approving...' : 'Approve'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
