/**
 * Dynamic API Base URL Configuration for Medora 2.0
 * 
 * Supports:
 * 1. Cloud / Vercel Deployments (*.vercel.app or custom domains):
 *    - Uses VITE_API_BASE_URL if explicitly configured with an https:// endpoint.
 *    - Otherwise uses same-origin (window.location.origin) so /api/v1 calls go to the same host.
 *    - Intelligently ignores private LAN IPs or localhost bundled from local dev .env files.
 * 2. Local Area Network (192.168.*, 10.*, etc.):
 *    - Points to port 3000 on the host machine.
 * 3. Localhost Development:
 *    - Defaults to http://localhost:3000 (or http://127.0.0.1:3000).
 */
export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;

  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname, origin } = window.location;

    // Detect cloud or public domain deployment (Vercel, Render, AWS, Netlify, custom domain)
    const isCloudDeploy =
      hostname.endsWith('.vercel.app') ||
      hostname.endsWith('.netlify.app') ||
      (!hostname.includes('localhost') &&
        hostname !== '127.0.0.1' &&
        !/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname));

    if (isCloudDeploy) {
      // 1. If an explicit valid public HTTPS backend URL is set, use it
      if (envUrl && envUrl.startsWith('https://')) {
        return envUrl.trim().replace(/\/+$/, '');
      }

      // 2. Production Vercel deployment resolution
      if (hostname.includes('medora-20-frontend.vercel.app')) {
        return 'https://medora-20-backend.vercel.app';
      }

      // 3. Dynamic match if following *-frontend.vercel.app pattern
      if (hostname.endsWith('-frontend.vercel.app')) {
        return `https://${hostname.replace(/-frontend\.vercel\.app$/, '-backend.vercel.app')}`;
      }

      // 4. Default fallback for cloud environments
      return 'https://medora-20-backend.vercel.app';
    }

    // If on LAN (IPv4 address that is not localhost)
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}:3000`;
    }
  }

  // If explicit environment variable is configured and valid
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // Standard local fallback
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3000`;
  }

  return 'http://127.0.0.1:3000';
}

export const API_BASE_URL = getApiBaseUrl();
