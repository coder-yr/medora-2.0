import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AcceptInvitationView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { apiBaseUrl, handleLoginSuccess } = useAuth();

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<{
    id: string;
    email: string;
    name?: string;
    role: string;
    organizationName: string;
    organizationCode: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [manualTokenInput, setManualTokenInput] = useState('');
  const [activeToken, setActiveToken] = useState<string | null>(token);

  useEffect(() => {
    const curToken = token || activeToken;
    if (!curToken) {
      setError('No invitation token provided. Please paste your token or use the activation link sent to you.');
      setLoading(false);
      return;
    }

    const validateToken = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/auth/invitations/${curToken.trim()}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error?.message || json.message || 'Invitation token is invalid or has expired.');
        }
        const payload = json.data?.data || json.data || json;
        const normalizedInvitation = {
          id: payload.id || '',
          email: payload.email || '',
          name: payload.name || '',
          role: payload.role || '',
          organizationName: payload.organizationName || payload.organization?.name || '',
          organizationCode: payload.organizationCode || payload.organization?.code || '',
        };
        setInvitation(normalizedInvitation);
        if (normalizedInvitation.name) setName(normalizedInvitation.name);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    void validateToken();
  }, [token, activeToken, apiBaseUrl]);

  const handleManualTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualTokenInput.trim();
    if (clean) {
      navigate(`/accept-invitation?token=${encodeURIComponent(clean)}`, { replace: true });
      setActiveToken(clean);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const curToken = token || activeToken;
    if (!curToken) {
      alert('Invitation token is required.');
      return;
    }
    if (password.length < 8) {
      alert('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: curToken.trim(),
          password,
          name: name.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || 'Failed to activate staff membership.');
      }

      setSuccess(true);
      const payload = json.data || json;
      if (payload.accessToken && payload.user) {
        handleLoginSuccess(payload);
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 1500);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at 15% 15%, #e0f2fe 0%, #f0fdf4 35%, #f8fafc 85%)',
        padding: '24px 16px',
        fontFamily: 'inherit',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 480,
          width: '100%',
          background: '#ffffff',
          borderRadius: 16,
          padding: 32,
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: '#e0e7ff',
              color: '#4338ca',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <h2 style={{ margin: '0 0 6px 0', fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
            Activate Staff Account
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: '#64748b' }}>
            Medora Healthcare Platform Invitation
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
            Validating single-use invitation token...
          </div>
        ) : error ? (
          <div>
            <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: 14, color: '#9f1239', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
              <AlertCircle size={18} style={{ display: 'inline', marginRight: 6, verticalAlign: -3 }} />
              {error}
            </div>

            {error.toLowerCase().includes('already been accepted') ? (
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '10px 16px', fontSize: 14, fontWeight: 700 }}
                >
                  Proceed to Platform Login
                </button>
              </div>
            ) : null}

            <form onSubmit={handleManualTokenSubmit} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
                Enter Invitation Token Manually
              </label>
              <input
                type="text"
                required
                className="form-control"
                placeholder="Paste your 64-character token here..."
                value={manualTokenInput}
                onChange={(e) => setManualTokenInput(e.target.value)}
                style={{ fontSize: 13, marginBottom: 12 }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '9px 16px', fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                Validate Token <ArrowRight size={15} />
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                type="button"
                onClick={() => navigate('/login')}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Already have an activated account? Sign In
              </button>
            </div>
          </div>
        ) : success ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <CheckCircle2 size={40} color="#16a34a" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px 0', fontSize: 18, fontWeight: 700, color: '#166534' }}>
              Membership Activated!
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>
              Redirecting you to your Medora operational workbench...
            </p>
          </div>
        ) : !invitation ? (
          <div>
            <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: 14, color: '#9f1239', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
              <AlertCircle size={18} style={{ display: 'inline', marginRight: 6, verticalAlign: -3 }} />
              No invitation details found. Please check your activation link or sign in.
            </div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px 16px', fontSize: 14, fontWeight: 700 }}
              >
                Go to Platform Login
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 18, fontSize: 13 }}>
              <div>Organization: <strong>{invitation.organizationName}</strong> ({invitation.organizationCode})</div>
              <div>Assigned Role: <span className="badge badge-primary" style={{ fontSize: 11.5 }}>{invitation.role}</span></div>
              <div>Invited Email: <code>{invitation.email}</code></div>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Create Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="form-control"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="form-control"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px 16px', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {submitting ? 'Activating...' : 'Activate Account & Sign In'} <ArrowRight size={16} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
