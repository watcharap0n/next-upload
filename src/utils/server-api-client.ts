/**
 * Server-side API client utility for making internal API calls within Docker containers
 */

import { API_BASE_SERVER } from './api-config';

export interface ApiClientOptions {
  token?: string;
  headers?: Record<string, string>;
}

/**
 * Server-side API client for internal Docker communication
 */
export class ServerApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = API_BASE_SERVER;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...(options.token && { Authorization: `Bearer ${options.token}` }),
      ...options.headers,
    };
  }

  /**
   * Make a GET request to the API server
   */
  async get<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Make a POST request to the API server
   */
  async post<T = unknown>(endpoint: string, data?: unknown, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Make a PUT request to the API server
   */
  async put<T = unknown>(endpoint: string, data?: unknown, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Make a DELETE request to the API server
   */
  async delete<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

/**
 * Create a server-side API client instance
 */
export function createServerApiClient(options: ApiClientOptions = {}): ServerApiClient {
  return new ServerApiClient(options);
}