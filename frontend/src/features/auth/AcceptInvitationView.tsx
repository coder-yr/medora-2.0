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

  useEffect(() => {
    if (!token) {
      setError('Missing invitation token.');
      setLoading(false);
      return;
    }

    const validateToken = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/auth/invitations/${token}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Invitation token is invalid or has expired.');
        }
        setInvitation(data);
        if (data.name) setName(data.name);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    void validateToken();
  }, [token, apiBaseUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          token,
          password,
          name: name.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to activate staff membership.');
      }

      setSuccess(true);
      if (data.accessToken && data.user) {
        handleLoginSuccess(data);
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
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: 14, color: '#9f1239', fontSize: 13, textAlign: 'center' }}>
            <AlertCircle size={18} style={{ display: 'inline', marginRight: 6, verticalAlign: -3 }} />
            {error}
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
        ) : (
          <div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 18, fontSize: 13 }}>
              <div>Organization: <strong>{invitation?.organizationName}</strong> ({invitation?.organizationCode})</div>
              <div>Assigned Role: <span className="badge badge-primary" style={{ fontSize: 11.5 }}>{invitation?.role}</span></div>
              <div>Invited Email: <code>{invitation?.email}</code></div>
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
