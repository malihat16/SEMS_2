/**
 * Utility functions for case-insensitive lookups and comparisons
 */

/**
 * Find an item in an array by name (case-insensitive)
 */
export function findByName<T extends { name?: string | null }>(
	items: T[],
	name: string
): T | undefined {
	return items.find((item) => item.name?.toLowerCase() === name.toLowerCase());
}

/**
 * Check if a user has a specific role (case-insensitive)
 */
export function hasRole(userRole: string | null | undefined, requiredRole: string): boolean {
	return userRole?.toLowerCase() === requiredRole.toLowerCase();
}

/**
 * Check if a user has any of the specified roles (case-insensitive)
 */
export function hasAnyRole(userRole: string | null | undefined, requiredRoles: string[]): boolean {
	if (!userRole) return false;
	return requiredRoles.some((role) => userRole.toLowerCase() === role.toLowerCase());
}

/**
 * Check if an event state matches (case-insensitive)
 */
export function isEventState(eventState: string | null | undefined, targetState: string): boolean {
	return eventState?.toLowerCase() === targetState.toLowerCase();
}

/**
 * Check if an event mode matches (case-insensitive)
 */
export function isEventMode(eventMode: string | null | undefined, targetMode: string): boolean {
	return eventMode?.toLowerCase() === targetMode.toLowerCase();
}

/**
 * Get event state display name (capitalize first letter)
 */
export function formatEventState(state: string | null | undefined): string {
	if (!state) return 'Unknown';
	return state.charAt(0).toUpperCase() + state.slice(1).toLowerCase();
}

/**
 * Get event mode display name (capitalize first letter)
 */
export function formatEventMode(mode: string | null | undefined): string {
	if (!mode) return 'Unknown';
	return mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase();
}