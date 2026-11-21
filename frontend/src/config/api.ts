/**
 * Dynamic API Base URL Configuration for Medora 2.0
 * 
 * Takes URL strictly from environment variables (VITE_API_BASE_URL).
 * If not explicitly provided in environment:
 * - In browser runtime: defaults to same-origin (window.location.origin),
 *   allowing relative routing to whatever host/domain the frontend is served on.
 * - Outside browser: returns empty string (relative API path).
 * 
 * Strict invariant: ZERO hardcoded localhost, IP addresses, or ports.
 */
export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;

  // 1. Explicit environment variable configuration (Highest Priority)
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 2. Browser runtime: dynamically resolve to same-origin
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  // 3. Fallback: empty string for relative paths
  return '';
}

export const API_BASE_URL = getApiBaseUrl();
