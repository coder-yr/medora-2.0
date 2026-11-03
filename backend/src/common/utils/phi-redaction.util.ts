const SENSITIVE_PATTERNS = [
  'q',
  'cnic',
  'phone',
  'email',
  'name',
  'token',
  'password',
  'pass',
  'ssn',
  'mrn',
  'authorization',
  'bearer',
  'search',
  'patient',
  'dob',
  'birth',
  'contact',
  'identity',
];

/**
 * Sanitizes URLs to remove Protected Health Information (PHI) and secrets
 * before writing to access logs or structured telemetry.
 */
export function sanitizeLogUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  if (!rawUrl.includes('?')) return rawUrl;

  const [path, queryString] = rawUrl.split('?', 2);
  if (!queryString) return path;

  const params = new URLSearchParams(queryString);
  for (const key of Array.from(params.keys())) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_PATTERNS.some((pattern) => lowerKey.includes(pattern))) {
      params.set(key, '[REDACTED]');
    }
  }

  return `${path}?${params.toString()}`;
}
