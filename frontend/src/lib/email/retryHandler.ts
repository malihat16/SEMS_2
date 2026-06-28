/**
 * Retry handler with Fibonacci backoff and jitter for email operations
 * This module provides utilities to calculate retry delays and determine if retries should continue
 */

// Maximum number of retry attempts before giving up
const MAX_RETRY_ATTEMPTS = 8;

// Jitter factor (percentage of delay to randomize, between 0 and 1)
const JITTER_FACTOR = 0.2;

// Base delay in milliseconds (1 second)
const BASE_DELAY_MS = 1000;

/**
 * Calculate Fibonacci number at position n
 * Used to determine the backoff multiplier for retry delays
 * @param n - Position in Fibonacci sequence
 * @returns Fibonacci number at position n
 */
function fibonacci(n: number): number {
	if (n <= 1) return 1;
	let a = 1,
		b = 1;
	for (let i = 2; i <= n; i++) {
		[a, b] = [b, a + b];
	}
	return b;
}

/**
 * Calculate retry delay with Fibonacci backoff and jitter
 * The delay increases according to Fibonacci sequence with added randomness
 * @param attemptCount - Current attempt count (0-indexed)
 * @returns Delay in milliseconds before next retry
 */
export function calculateRetryDelay(attemptCount: number): number {
	// Get Fibonacci multiplier
	const fibMultiplier = fibonacci(attemptCount);

	// Calculate base delay
	const baseDelay = BASE_DELAY_MS * fibMultiplier;

	// Add jitter (random variation)
	const jitterRange = baseDelay * JITTER_FACTOR;
	const jitter = Math.random() * jitterRange - jitterRange / 2;

	// Return delay with jitter applied (ensure non-negative)
	return Math.max(0, Math.floor(baseDelay + jitter));
}

/**
 * Determine if another retry attempt should be made
 * @param attemptCount - Current attempt count
 * @returns True if retry should be attempted, false if max retries reached
 */
export function shouldRetry(attemptCount: number): boolean {
	return attemptCount < MAX_RETRY_ATTEMPTS;
}

/**
 * Get human-readable delay time description
 * @param delayMs - Delay in milliseconds
 * @returns Human-readable string (e.g., "5 seconds", "2 minutes")
 */
export function getDelayDescription(delayMs: number): string {
	const seconds = Math.floor(delayMs / 1000);

	if (seconds < 60) {
		return `${seconds} second${seconds !== 1 ? 's' : ''}`;
	}

	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;

	if (remainingSeconds === 0) {
		return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
	}

	return `${minutes} minute${minutes !== 1 ? 's' : ''} and ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
}

/**
 * Retry configuration options
 */
export interface RetryConfig {
	maxAttempts?: number;
	baseDelayMs?: number;
	jitterFactor?: number;
}

/**
 * Execute an async operation with retry logic
 * @param operation - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to operation result or throwing final error
 */
export async function withRetry<T>(
	operation: () => Promise<T>,
	options: RetryConfig = {}
): Promise<T> {
	const maxAttempts = options.maxAttempts ?? MAX_RETRY_ATTEMPTS;
	let attemptCount = 0;
	let lastError: Error | null = null;

	while (attemptCount < maxAttempts) {
		try {
			return await operation();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			attemptCount++;

			if (attemptCount >= maxAttempts) {
				throw lastError;
			}

			// Calculate and wait for retry delay
			const delay = calculateRetryDelay(attemptCount);
			console.log(
				`Retry attempt ${attemptCount}/${maxAttempts} after ${getDelayDescription(delay)}...`
			);

			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	// This should never be reached, but TypeScript needs it
	throw lastError || new Error('Max retry attempts reached');
}

/**
 * Calculate the next retry time based on current attempt count
 * @param attemptCount - Current attempt count
 * @returns ISO timestamp string for next retry
 */
export function calculateNextRetryTime(attemptCount: number): string {
	const delay = calculateRetryDelay(attemptCount);
	const nextRetryDate = new Date(Date.now() + delay);
	return nextRetryDate.toISOString();
}

/**
 * Get all retry delays for visualization/logging
 * @returns Array of delay values in milliseconds for each retry attempt
 */
export function getRetrySchedule(): number[] {
	const schedule: number[] = [];
	for (let i = 0; i < MAX_RETRY_ATTEMPTS; i++) {
		schedule.push(calculateRetryDelay(i));
	}
	return schedule;
}

// Export constants for external use
export { MAX_RETRY_ATTEMPTS, JITTER_FACTOR, BASE_DELAY_MS };
