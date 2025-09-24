/**
 * API configuration utility for handling different API base URLs
 * for client-side and server-side requests in Docker environments
 */

// Client-side API base URL (for browser requests)
export const API_BASE_CLIENT = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

// Server-side API base URL (for internal Docker communication)
export const API_BASE_SERVER = process.env.API_BASE_INTERNAL || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

/**
 * Get the appropriate API base URL based on the execution context
 * @param isServerSide - Whether this is a server-side request
 * @returns The appropriate API base URL
 */
export function getApiBase(isServerSide: boolean = false): string {
  return isServerSide ? API_BASE_SERVER : API_BASE_CLIENT;
}

/**
 * Determine if code is running on the server side
 * @returns true if running on server, false if on client
 */
export function isServerSide(): boolean {
  return typeof window === 'undefined';
}

/**
 * Get the appropriate API base URL based on current execution context
 * @returns The appropriate API base URL
 */
export function getContextualApiBase(): string {
  return getApiBase(isServerSide());
}