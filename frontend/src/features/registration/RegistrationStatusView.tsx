import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  AlertTriangle,
  ArrowRight,
  Shield,
  Stethoscope,
  Sparkles,
} from 'lucide-react';
import { getApiBaseUrl } from '../../config/api';

const API_BASE_URL = getApiBaseUrl();

interface RegistrationStatusData {
  reference: string;
  organizationName: string;
  organizationType: string;
  requestedEdition: string;
  status: 'DRAFT' | 'PENDING_EMAIL_VERIFICATION' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED';
  isEmailVerified: boolean;
  rejectionReason?: string | null;
  createdAt: string;
  organizationId?: string | null;
  adminEmail?: string;
  invitationToken?: string | null;
}

export const RegistrationStatusView: React.FC = () => {
  const { reference: routeRef } = useParams<{ reference?: string }>();
  const navigate = useNavigate();

  const [inputRef, setInputRef] = useState<string>(routeRef || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<RegistrationStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async (ref: string) => {
    const cleanRef = ref.replace(/^[:\s]+/, '').trim();
    if (!cleanRef) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/organization-registrations/status/${encodeURIComponent(cleanRef)}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || 'Registration reference not found.');
      }

      const payload = json.data || json;
      setData(payload);
    } catch (err: any) {
      setError(err.message || 'Unable to retrieve registration status.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (routeRef) {
      const clean = routeRef.replace(/^[:\s]+/, '').trim();
      setInputRef(clean);
      void fetchStatus(clean);
    }
  }, [routeRef]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputRef.replace(/^[:\s]+/, '').trim();
    if (clean) {
      navigate(`/registration-status/${encodeURIComponent(clean)}`, { replace: true });
      void fetchStatus(clean);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return { label: 'Active & Provisioned', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' };
      case 'APPROVED':
        return { label: 'Approved by Super Admin', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
      case 'PENDING_APPROVAL':
        return { label: 'Pending Super Admin Review', bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
      case 'PENDING_EMAIL_VERIFICATION':
        return { label: 'Awaiting Email Verification', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
      case 'REJECTED':
        return { label: 'Application Rejected', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' };
      case 'PROVISIONING':
        return { label: 'Provisioning Tenant Resources', bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' };
      default:
        return { label: status, bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '36px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Stethoscope size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>MEDORA 2.0</h1>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Application Tracking</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
            <Link to="/register-organization" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}>
              + Register Organization
            </Link>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <Link to="/login" style={{ color: '#64748b', textDecoration: 'none' }}>
              Sign In
            </Link>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ background: '#ffffff', borderRadius: 14, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
            Track Organization Registration Status
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>
            Enter your registration tracking reference (e.g. REG-20261122-A1B2)
          </p>

          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="REG-YYYYMMDD-XXXX"
                value={inputRef}
                onChange={(e) => setInputRef(e.target.value)}
                style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontFamily: 'monospace' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !inputRef.trim()}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                background: loading ? '#94a3b8' : '#0284c7',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Searching...' : 'Track'}
            </button>
          </form>
        </div>

        {/* Error Banner */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 14, marginBottom: 20, color: '#991b1b', fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Registration Details View */}
        {data && (
          <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>Ref: {data.reference}</span>
                <h3 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
                  {data.organizationName}
                </h3>
              </div>
              {(() => {
                const badge = getStatusBadge(data.status);
                return (
                  <span
                    style={{
                      padding: '6px 12px',
                      borderRadius: 20,
                      background: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {badge.label}
                  </span>
                );
              })()}
            </div>

            {/* Lifecycle Timeline */}
            <div style={{ marginBottom: 28 }}>
              <h4 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                Application Journey
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Step 1: Submission */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Application Submitted</span>
                    <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>({new Date(data.createdAt).toLocaleDateString()})</span>
                  </div>
                </div>

                {/* Step 2: Email Verification */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: data.isEmailVerified ? '#ecfdf5' : '#fff7ed',
                      color: data.isEmailVerified ? '#10b981' : '#ea580c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {data.isEmailVerified ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                  </div>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Email Verification</span>
                    <span style={{ fontSize: 12, color: data.isEmailVerified ? '#166534' : '#c2410c', marginLeft: 8 }}>
                      {data.isEmailVerified ? '✓ Confirmed' : 'Waiting for verification token confirmation'}
                    </span>
                    {!data.isEmailVerified && (
                      <Link to="/verify-email" style={{ fontSize: 12, color: '#0284c7', marginLeft: 10, fontWeight: 600 }}>
                        Verify Now →
                      </Link>
                    )}
                  </div>
                </div>

                {/* Step 3: Super Admin Review */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background:
                        data.status === 'REJECTED'
                          ? '#fef2f2'
                          : ['ACTIVE', 'APPROVED', 'PROVISIONING'].includes(data.status)
                            ? '#ecfdf5'
                            : '#fef3c7',
                      color:
                        data.status === 'REJECTED'
                          ? '#dc2626'
                          : ['ACTIVE', 'APPROVED', 'PROVISIONING'].includes(data.status)
                            ? '#10b981'
                            : '#d97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {data.status === 'REJECTED' ? (
                      <XCircle size={16} />
                    ) : ['ACTIVE', 'APPROVED', 'PROVISIONING'].includes(data.status) ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <Clock size={16} />
                    )}
                  </div>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Super Administrator Governance Review</span>
                    <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>
                      {data.status === 'REJECTED'
                        ? 'Rejected'
                        : ['ACTIVE', 'APPROVED', 'PROVISIONING'].includes(data.status)
                          ? '✓ Approved'
                          : 'In review queue'}
                    </span>
                  </div>
                </div>

                {/* Step 4: Active Provisioning */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: data.status === 'ACTIVE' ? '#ecfdf5' : '#f1f5f9',
                      color: data.status === 'ACTIVE' ? '#10b981' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {data.status === 'ACTIVE' ? <CheckCircle2 size={16} /> : <Building2 size={16} />}
                  </div>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: data.status === 'ACTIVE' ? '#0f172a' : '#94a3b8' }}>
                      Automated Tenant Provisioning
                    </span>
                    {data.organizationId && (
                      <span style={{ fontSize: 12, color: '#047857', marginLeft: 8, fontWeight: 600 }}>
                        (Tenant ID #{data.organizationId} Live)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Rejection Notice */}
            {data.status === 'REJECTED' && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 16, marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#991b1b' }}>
                  Application Review Notice
                </h4>
                <p style={{ margin: 0, fontSize: 13, color: '#b91c1c' }}>
                  <strong>Reason:</strong> {data.rejectionReason || 'Compliance documentation verification incomplete.'}
                </p>
              </div>
            )}

            {/* Active Notice */}
            {data.status === 'ACTIVE' && (
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: 18, marginBottom: 24, textAlign: 'center' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#047857' }}>
                  Healthcare Facility is Live!
                </h4>
                <p style={{ margin: '0 0 14px', fontSize: 13, color: '#065f46' }}>
                  {data.invitationToken
                    ? 'The organization has been provisioned and the primary administrator invitation is ready.'
                    : 'The organization has been provisioned and activated. The administrator account is active.'}
                </p>
                {data.invitationToken ? (
                  <>
                    <div style={{ background: '#ffffff', border: '1px dashed #059669', borderRadius: 8, padding: 10, marginBottom: 16, fontSize: 12.5, color: '#065f46', wordBreak: 'break-all' }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Activation Token:</div>
                      <code style={{ background: '#f0fdf4', padding: '2px 6px', borderRadius: 4, color: '#047857', display: 'inline-block' }}>{data.invitationToken}</code>
                    </div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <Link
                        to={`/accept-invitation?token=${encodeURIComponent(data.invitationToken)}`}
                        style={{ padding: '9px 18px', borderRadius: 6, background: '#059669', color: '#fff', fontSize: 13.5, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        Accept Admin Invitation <ArrowRight size={15} />
                      </Link>
                      <Link
                        to="/login"
                        style={{ padding: '9px 18px', borderRadius: 6, background: '#ffffff', color: '#047857', border: '1px solid #059669', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}
                      >
                        Platform Login
                      </Link>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link
                      to="/login"
                      style={{ padding: '9px 18px', borderRadius: 6, background: '#059669', color: '#fff', fontSize: 13.5, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      Sign In to Medora <ArrowRight size={15} />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
