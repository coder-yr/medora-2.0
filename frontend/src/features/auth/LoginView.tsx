import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, ShieldAlert, Stethoscope, CheckCircle2 } from 'lucide-react';
import type { AuthResponse } from '../../types/auth';

interface LoginViewProps {
  apiBaseUrl: string;
  onLoginSuccess: (auth: AuthResponse) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ apiBaseUrl, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [forgotModal, setForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    setIsLocked(false);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.data?.accessToken) {
        onLoginSuccess(data.data);
      } else {
        const msg = data.error?.message || data.message || 'Invalid email or password.';
        if (typeof msg === 'string' && msg.toLowerCase().includes('locked')) {
          setIsLocked(true);
        }
        setError(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } catch {
      setError('Unable to connect to the hospital authentication server.');
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('ValidPassword123!');
    setError(null);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    try {
      await fetch(`${apiBaseUrl}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      setForgotSent(true);
    } catch {
      setForgotSent(true);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: 16
    }}>
      <div style={{
        maxWidth: 440,
        width: '100%',
        background: 'var(--bg-card, #ffffff)',
        borderRadius: 16,
        padding: 36,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--border-color, #e2e8f0)',
      }}>
        {/* Hospital Branding Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: 14,
            background: '#0284c7',
            color: '#fff',
            marginBottom: 14,
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
          }}>
            <Stethoscope size={30} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
            Medora 2.0
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #64748b)' }}>
            Hospital Information Management System
          </p>
        </div>

        {/* Lockout or Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 8,
            marginBottom: 20,
            background: isLocked ? '#fef2f2' : '#fff1f2',
            border: `1px solid ${isLocked ? '#f87171' : '#fecdd3'}`,
            color: '#991b1b',
            fontSize: 13,
          }}>
            <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600 }}>{isLocked ? 'Account Locked' : 'Authentication Error'}</div>
              <div>{error}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: 13 }}>Work Email / Username</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="doctor.test@medora.hospital"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                style={{ paddingLeft: 38 }}
                disabled={loading}
              />
              <Mail size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>Password</label>
              <button
                type="button"
                onClick={() => setForgotModal(true)}
                style={{ fontSize: 12, color: '#0284c7', textDecoration: 'none', background: 'none' }}
              >
                Forgot?
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: 38, paddingRight: 38 }}
                disabled={loading}
              />
              <Lock size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 12, top: 10, color: '#94a3b8', background: 'none' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: 15, fontWeight: 600 }}
            disabled={loading}
          >
            {loading ? 'Verifying Identity...' : 'Sign In to Medora'}
          </button>
        </form>

        {/* Development Persona Quick Links */}
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textAlign: 'center' }}>
            Quick Demo Sign-In
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 11, padding: '5px 4px' }}
              onClick={() => quickFill('admin.test@medora.hospital')}
            >
              Admin
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 11, padding: '5px 4px' }}
              onClick={() => quickFill('doctor.test@medora.hospital')}
            >
              Doctor
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 11, padding: '5px 4px' }}
              onClick={() => quickFill('accountant.test@medora.hospital')}
            >
              Accountant
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 11, padding: '5px 4px' }}
              onClick={() => quickFill('pharmacist.test@medora.hospital')}
            >
              Pharmacist
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 11, padding: '5px 4px' }}
              onClick={() => quickFill('laboratorist.test@medora.hospital')}
            >
              Laboratorist
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 11, padding: '5px 4px' }}
              onClick={() => quickFill('receptionist.test@medora.hospital')}
            >
              Receptionist
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div className="card" style={{ maxWidth: 400, width: '100%', padding: 24 }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 18, fontWeight: 700 }}>Reset Password</h3>
            {forgotSent ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', marginBottom: 12 }}>
                  <CheckCircle2 size={18} />
                  <span>Password reset instructions sent.</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  If the account exists, you will receive an outbox recovery notice.
                </p>
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: 12 }}
                  onClick={() => { setForgotModal(false); setForgotSent(false); }}
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Enter your hospital registered email to request a reset link.
                </p>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="user@medora.hospital"
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setForgotModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Send Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
