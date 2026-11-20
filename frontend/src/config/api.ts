/**
 * Dynamic API Base URL Configuration for Medora 2.0
 * 
 * Ensures seamless access across:
 * - Localhost development (http://localhost:5173 -> http://localhost:3000)
 * - Local Area Network / Wi-Fi (http://192.168.1.104:5173 -> http://192.168.1.104:3000)
 * - Custom domain or remote container deployments
 */
export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;

  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname } = window.location;

    // If accessed over LAN/WAN/external IP or domain (not plain localhost/127.0.0.1)
    // and envUrl is either empty or defaulted to localhost/127.0.0.1, dynamically
    // point to the same host so remote/mobile devices connect to the host machine.
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      if (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
        return `${protocol}//${hostname}:3000`;
      }
    }
  }

  // If explicit environment variable is configured and valid, use it
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.trim();
  }

  // Standard fallback
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3000`;
  }

  return 'http://127.0.0.1:3000';
}

export const API_BASE_URL = getApiBaseUrl();
