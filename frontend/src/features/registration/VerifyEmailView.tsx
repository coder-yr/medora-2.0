import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  Mail,
  ArrowRight,
  RefreshCw,
  Stethoscope,
  Send,
} from 'lucide-react';
import { getApiBaseUrl } from '../../config/api';

const API_BASE_URL = getApiBaseUrl();

export const VerifyEmailView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tokenFromUrl = searchParams.get('token') || '';
  const [token, setToken] = useState<string>(tokenFromUrl);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [successData, setSuccessData] = useState<{
    reference: string;
    organizationName: string;
    status: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resend Verification State
  const [resendInput, setResendInput] = useState<string>('');
  const [resending, setResending] = useState<boolean>(false);
  const [resendSuccessMsg, setResendSuccessMsg] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const handleVerify = async (tokenToUse: string) => {
    if (!tokenToUse.trim()) {
      setError('Please provide a valid verification token.');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/organization-registrations/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenToUse.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Email verification failed.');
      }

      const payload = json.data || json;
      setSuccessData({
        reference: payload.reference,
        organizationName: payload.organizationName,
        status: payload.status,
      });
    } catch (err: any) {
      setError(err.message || 'An error occurred during email verification.');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (tokenFromUrl && tokenFromUrl.length >= 32) {
      void handleVerify(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendInput.trim()) {
      setResendError('Registration reference or registered email is required.');
      return;
    }

    setResending(true);
    setResendError(null);
    setResendSuccessMsg(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/organization-registrations/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceOrEmail: resendInput.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Failed to resend verification email.');
      }

      const payload = json.data || json;
      setResendSuccessMsg(payload.message || 'A fresh verification token has been generated and dispatched.');
      if (payload.verificationToken) {
        setToken(payload.verificationToken);
      }
    } catch (err: any) {
      setResendError(err.message || 'Error resending verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 540, width: '100%', background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)', padding: 36 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 50, height: 50, borderRadius: 12, background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Mail size={26} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
            Email Verification
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Confirm your organization email address to submit your registration for Super Admin review.
          </p>
        </div>

        {/* Success View */}
        {successData ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <CheckCircle2 size={36} />
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
              Email Confirmed Successfully!
            </h2>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
              Organization <strong>{successData.organizationName}</strong> is now verified and awaiting Platform Super Administrator approval.
            </p>

            <div style={{ background: '#f1f5f9', borderRadius: 10, padding: 14, marginBottom: 24, fontSize: 13 }}>
              <span style={{ color: '#64748b' }}>Reference: </span>
              <strong style={{ color: '#0284c7', fontFamily: 'monospace' }}>{successData.reference}</strong>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => navigate(`/registration-status/${successData.reference}`)}
                style={{ flex: 1, padding: '12px 16px', borderRadius: 8, background: '#0284c7', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                Track Status
              </button>
              <button
                onClick={() => navigate('/login')}
                style={{ flex: 1, padding: '12px 16px', borderRadius: 8, background: '#e2e8f0', color: '#334155', fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                Go to Login
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Error Banner */}
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center', color: '#991b1b', fontSize: 13 }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Manual Verification Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleVerify(token);
              }}
              style={{ marginBottom: 32 }}
            >
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Verification Token
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Paste 64-character verification token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace' }}
                />
                <button
                  type="submit"
                  disabled={verifying || !token.trim()}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 8,
                    background: verifying ? '#94a3b8' : '#0284c7',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    cursor: verifying ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                  }}
                >
                  {verifying ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </form>

            {/* Resend Section */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
                Didn't receive the verification email?
              </h3>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>
                Enter your registration reference or registered email to request a new token. (Rate limited to 1 request per 2 minutes).
              </p>

              {resendSuccessMsg && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 10, marginBottom: 16, color: '#166534', fontSize: 12 }}>
                  ✓ {resendSuccessMsg}
                </div>
              )}

              {resendError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 10, marginBottom: 16, color: '#991b1b', fontSize: 12 }}>
                  {resendError}
                </div>
              )}

              <form onSubmit={handleResend} style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="REG-20261122-XXXX or email@hospital.org"
                  value={resendInput}
                  onChange={(e) => setResendInput(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
                <button
                  type="submit"
                  disabled={resending || !resendInput.trim()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: resending ? 'not-allowed' : 'pointer',
                  }}
                >
                  <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
                  {resending ? 'Sending...' : 'Resend'}
                </button>
              </form>
            </div>

            <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13 }}>
              <Link to="/login" style={{ color: '#64748b', textDecoration: 'none' }}>
                ← Return to Platform Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
