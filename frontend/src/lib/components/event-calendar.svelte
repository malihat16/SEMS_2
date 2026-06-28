<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { ChevronLeft, ChevronRight, Calendar, Users } from '@lucide/svelte';
	import type { Event } from '$lib/types';

	interface Props {
		events: Event[];
		userRegistrations?: string[];
		onEventClick?: (event: Event) => void;
		onRegister?: (eventId: string) => void;
	}

	let { events = [], userRegistrations = [], onEventClick, onRegister }: Props = $props();

	// Calendar state
	let currentDate = $state(new Date());
	let selectedDate = $state<Date | null>(null);
	let showEventDialog = $state(false);

	// Calendar helpers
	function getMonthStart(date: Date) {
		return new Date(date.getFullYear(), date.getMonth(), 1);
	}

	function getMonthEnd(date: Date) {
		return new Date(date.getFullYear(), date.getMonth() + 1, 0);
	}

	function getCalendarDays(date: Date) {
		const monthStart = getMonthStart(date);
		const monthEnd = getMonthEnd(date);

		// Get the first day of the calendar (might be from previous month)
		const calendarStart = new Date(monthStart);
		calendarStart.setDate(monthStart.getDate() - monthStart.getDay());

		// Get the last day of the calendar (might be from next month)
		const calendarEnd = new Date(monthEnd);
		const daysToAdd = 6 - monthEnd.getDay();
		calendarEnd.setDate(monthEnd.getDate() + daysToAdd);

		const days = [];
		const current = new Date(calendarStart);

		while (current <= calendarEnd) {
			days.push(new Date(current));
			current.setDate(current.getDate() + 1);
		}

		return days;
	}

	function navigateMonth(direction: 'prev' | 'next') {
		const newDate = new Date(currentDate);
		if (direction === 'prev') {
			newDate.setMonth(newDate.getMonth() - 1);
		} else {
			newDate.setMonth(newDate.getMonth() + 1);
		}
		currentDate = newDate;
	}

	function goToToday() {
		currentDate = new Date();
		selectedDate = new Date();
	}

	function isSameDay(date1: Date, date2: Date) {
		return (
			date1.getFullYear() === date2.getFullYear() &&
			date1.getMonth() === date2.getMonth() &&
			date1.getDate() === date2.getDate()
		);
	}

	function isToday(date: Date) {
		return isSameDay(date, new Date());
	}

	function isCurrentMonth(date: Date) {
		return (
			date.getFullYear() === currentDate.getFullYear() && date.getMonth() === currentDate.getMonth()
		);
	}

	function getEventsForDate(date: Date) {
		return events.filter((event) => {
			if (!event.start_datetime) return false;
			const eventDate = new Date(event.start_datetime);
			return isSameDay(eventDate, date);
		});
	}

	function formatTime(dateString: string) {
		const date = new Date(dateString);
		return date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: true
		});
	}

	function getEventStatus(event: Event) {
		const isRegistered = userRegistrations.includes(event.event_id);

		// Check if event is cancelled
		if (event.event_state?.name?.toLowerCase().trim() === 'cancelled') {
			return { text: 'Cancelled', class: 'bg-gray-100 text-gray-800 border-gray-200' };
		}

		// Check if event has passed
		const now = new Date();
		const eventEndDate = event.end_datetime || event.start_datetime;
		if (eventEndDate && new Date(eventEndDate) < now) {
			if (isRegistered) {
				return { text: 'Completed', class: 'bg-purple-100 text-purple-800 border-purple-200' };
			}
			return { text: 'Past Event', class: 'bg-gray-100 text-gray-600 border-gray-200' };
		}

		if (isRegistered) {
			return { text: 'Registered', class: 'bg-blue-100 text-blue-800 border-blue-200' };
		}

		if (event.capacity) {
			const registered = event.registration_count || 0;
			const capacity = event.capacity;

			if (registered >= capacity) {
				return { text: 'Full', class: 'bg-red-100 text-red-800 border-red-200' };
			} else if (registered / capacity >= 0.8) {
				return { text: 'Almost Full', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
			}
		}

		return { text: 'Available', class: 'bg-green-100 text-green-800 border-green-200' };
	}

	// Keyboard navigation
	function handleKeydown(event: KeyboardEvent, day: Date) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			selectedDate = selectedDate && isSameDay(selectedDate, day) ? null : day;
		} else if (event.key === 'Escape') {
			selectedDate = null;
		}
	}

	// Derived values
	const calendarDays = $derived(getCalendarDays(currentDate));
	const monthName = $derived(
		currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
	);
	const selectedDateEvents = $derived(selectedDate ? getEventsForDate(selectedDate) : []);

	// Week days
	const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
</script>

<div class="space-y-6">
	<!-- Calendar Header -->
	<div class="flex flex-col gap-4">
		<div class="flex items-center justify-center gap-4">
			<Button variant="outline" size="sm" onclick={() => navigateMonth('prev')} class="h-8 w-8 p-0">
				<ChevronLeft class="h-4 w-4" />
			</Button>

			<Button variant="outline" onclick={goToToday} class="flex min-w-24 items-center gap-2">
				<Calendar class="h-4 w-4" />
				Today
			</Button>

			<Button variant="outline" size="sm" onclick={() => navigateMonth('next')} class="h-8 w-8 p-0">
				<ChevronRight class="h-4 w-4" />
			</Button>
		</div>

		<div class="text-center">
			<h2 class="text-xl font-semibold text-gray-900 sm:text-2xl">{monthName}</h2>
		</div>

		<!-- Legend -->
		<div class="flex flex-wrap justify-center gap-4 text-xs">
			<div class="flex items-center gap-1">
				<div class="h-3 w-3 rounded border border-green-200 bg-green-100"></div>
				<span>Available</span>
			</div>
			<div class="flex items-center gap-1">
				<div class="h-3 w-3 rounded border border-blue-200 bg-blue-100"></div>
				<span>Registered</span>
			</div>
			<div class="flex items-center gap-1">
				<div class="h-3 w-3 rounded border border-yellow-200 bg-yellow-100"></div>
				<span>Almost Full</span>
			</div>
			<div class="flex items-center gap-1">
				<div class="h-3 w-3 rounded border border-red-200 bg-red-100"></div>
				<span>Full</span>
			</div>
			<div class="flex items-center gap-1">
				<div class="h-3 w-3 rounded border border-gray-200 bg-gray-100"></div>
				<span>Past/Cancelled</span>
			</div>
		</div>
	</div>

	<!-- Calendar Grid -->
	<div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
		<div class="grid grid-cols-7" role="grid" aria-label="Calendar for {monthName}">
			<!-- Week day headers -->
			{#each weekDays as day}
				<div
					class="border-b border-gray-200 bg-gray-50 p-3 text-center text-sm font-medium text-gray-700"
				>
					{day}
				</div>
			{/each}

			<!-- Calendar days -->
			{#each calendarDays as day}
				{@const dayEvents = getEventsForDate(day)}
				{@const isSelected = selectedDate && isSameDay(day, selectedDate)}
				{@const isTodayDay = isToday(day)}
				{@const isCurrentMonthDay = isCurrentMonth(day)}

				<button
					class="relative min-h-24 border-b border-r border-gray-200 p-2 text-left transition-all last:border-r-0 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:min-h-28
						{isSelected ? 'bg-blue-50 ring-2 ring-inset ring-blue-500' : ''}
						{!isCurrentMonthDay ? 'bg-gray-50/50' : 'bg-white'}"
					onclick={() => {
						selectedDate = selectedDate && isSameDay(selectedDate, day) ? null : day;
						if (dayEvents.length > 0) {
							showEventDialog = true;
						}
					}}
					onkeydown={(e) => handleKeydown(e, day)}
					tabindex="0"
					role="gridcell"
					aria-label="{day.toLocaleDateString('en-US', {
						weekday: 'long',
						month: 'long',
						day: 'numeric'
					})}{dayEvents.length > 0
						? `, ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}`
						: ''}"
				>
					<div class="flex items-center justify-between">
						<span
							class="text-sm font-medium
							{isTodayDay ? 'flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white' : ''}
							{!isCurrentMonthDay ? 'text-gray-400' : 'text-gray-900'}"
						>
							{day.getDate()}
						</span>
					</div>

					<!-- Event indicators - no event details, just colored dots -->
					{#if dayEvents.length > 0}
						<div class="mt-2 flex flex-wrap gap-1">
							{#each dayEvents.slice(0, 4) as event}
								{@const status = getEventStatus(event)}
								<div
									class="h-2 w-2 rounded-full {status.class.includes('green')
										? 'bg-green-500'
										: status.class.includes('blue')
											? 'bg-blue-500'
											: status.class.includes('yellow')
												? 'bg-yellow-500'
												: status.class.includes('red')
													? 'bg-red-500'
													: 'bg-gray-400'}"
								></div>
							{/each}
							{#if dayEvents.length > 4}
								<div
									class="flex h-2 w-2 items-center justify-center rounded-full bg-gray-300 text-xs leading-none text-gray-600"
								>
									+
								</div>
							{/if}
						</div>
					{/if}
				</button>
			{/each}
		</div>
	</div>
</div>

<!-- Events Dialog -->
<Dialog.Root bind:open={showEventDialog}>
	<Dialog.Content class="max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>
				{#if selectedDate}
					Events for {selectedDate.toLocaleDateString('en-US', {
						weekday: 'long',
						month: 'long',
						day: 'numeric'
					})}
				{:else}
					Events
				{/if}
			</Dialog.Title>
		</Dialog.Header>

		<div class="mt-6">
			{#if selectedDateEvents.length === 0}
				<div class="py-8 text-center">
					<Calendar class="mx-auto mb-4 h-12 w-12 text-gray-400" />
					<h3 class="mb-2 text-lg font-medium text-gray-900">No events on this date</h3>
					<p class="text-gray-600">Try selecting another date with events.</p>
				</div>
			{:else}
				<div class="max-h-96 space-y-4 overflow-y-auto">
					{#each selectedDateEvents as event}
						{@const status = getEventStatus(event)}
						{@const isRegistered = userRegistrations.includes(event.event_id)}

						<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
							<div class="mb-3 flex items-start justify-between">
								<h4 class="font-semibold text-gray-900">{event.name}</h4>
								<Badge class={status.class}>{status.text}</Badge>
							</div>

							{#if event.start_datetime}
								<div class="mb-2 flex items-center gap-2 text-sm text-gray-600">
									<Calendar class="h-4 w-4" />
									{formatTime(event.start_datetime)}
								</div>
							{/if}

							{#if event.venue}
								<div class="mb-2 flex items-center gap-2 text-sm text-gray-600">
									<Users class="h-4 w-4" />
									{event.venue}
								</div>
							{/if}

							{#if event.organisation?.name}
								<p class="mb-3 text-sm text-gray-500">Organised by {event.organisation.name}</p>
							{/if}

							{#if event.description}
								<p class="mb-3 line-clamp-2 text-sm text-gray-600">{event.description}</p>
							{/if}

							<div class="flex gap-2">
								{#if onEventClick}
									<Button
										variant="outline"
										size="sm"
										onclick={() => onEventClick?.(event)}
										class="flex-1"
									>
										View Details
									</Button>
								{/if}

								{#if !isRegistered && onRegister && status.text !== 'Full'}
									<Button
										size="sm"
										onclick={() => onRegister?.(event.event_id)}
										class="flex items-center gap-2"
									>
										<Users class="h-4 w-4" />
										Register
									</Button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
