import { sanitizeLogUrl } from './phi-redaction.util';

describe('PHI Log Redaction Utility', () => {
  it('leaves URLs without query parameters untouched', () => {
    expect(sanitizeLogUrl('/api/v1/patients')).toBe('/api/v1/patients');
    expect(sanitizeLogUrl('/api/v1/appointments/10')).toBe('/api/v1/appointments/10');
  });

  it('redacts sensitive query parameters like q, cnic, phone, email, and name', () => {
    const raw = '/api/v1/patients?q=042-1234567&page=1&limit=25';
    const sanitized = sanitizeLogUrl(raw);
    expect(sanitized).toContain('q=%5BREDACTED%5D');
    expect(sanitized).toContain('page=1');
    expect(sanitized).toContain('limit=25');
    expect(sanitized).not.toContain('042-1234567');
  });

  it('redacts credentials and token parameters', () => {
    const raw = '/api/v1/auth/callback?token=eyJhbGciOiJIUzI1NiJ9&state=xyz';
    const sanitized = sanitizeLogUrl(raw);
    expect(sanitized).toContain('token=%5BREDACTED%5D');
    expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('redacts multiple PHI fields in the same query string', () => {
    const raw = '/api/v1/patients/search?cnic=42201-1234567-1&patientName=Amina&phone=03001234567';
    const sanitized = sanitizeLogUrl(raw);
    expect(sanitized).not.toContain('42201-1234567-1');
    expect(sanitized).not.toContain('Amina');
    expect(sanitized).not.toContain('03001234567');
  });
});
