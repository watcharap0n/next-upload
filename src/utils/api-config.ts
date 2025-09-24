/**
 * API configuration utility for server-side only requests in Docker environments
 * NO CLIENT-SIDE API CALLS - All communication happens server-side through internal Docker networking
 */

// Server-side API base URL (for internal Docker communication only)
export const API_BASE_INTERNAL = process.env.API_BASE_INTERNAL || "http://api-server:8080";

/**
 * Get the API base URL for server-side requests only
 * @returns The internal API base URL for Docker communication
 */
export function getApiBase(): string {
  return API_BASE_INTERNAL;
}

/**
 * Determine if code is running on the server side
 * @returns true if running on server, false if on client
 */
export function isServerSide(): boolean {
  return typeof window === 'undefined';
}