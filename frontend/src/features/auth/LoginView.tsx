import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldAlert,
  Stethoscope,
  CheckCircle2,
  Shield,
  HeartPulse,
  Sparkles,
  User,
  Building,
  UserPlus,
  LogIn,
} from 'lucide-react';
import type { AuthResponse } from '../../types/auth';

interface LoginViewProps {
  apiBaseUrl: string;
  onLoginSuccess: (auth: AuthResponse) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ apiBaseUrl, onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Sign In Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Registration Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'Doctor' | 'Accountant' | 'Pharmacist' | 'Laboratorist' | 'Receptionist' | 'Admin'>('Doctor');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [forgotModal, setForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your work email and password.');
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
      setError('Unable to connect to the hospital authentication service.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setError('Please fill out all registration fields.');
      return;
    }
    if (regPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim(),
          password: regPassword,
          role: regRole,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.data?.accessToken) {
        onLoginSuccess(data.data);
      } else {
        const msg = data.error?.message || data.message || 'Registration failed.';
        setError(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } catch {
      setError('Unable to reach the registration gateway. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const instantLogin = async (roleEmail: string, roleName: string) => {
    setEmail(roleEmail);
    setPassword('ValidPassword123!');
    setLoading(true);
    setError(null);
    setIsLocked(false);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: roleEmail, password: 'ValidPassword123!' }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.data?.accessToken) {
        onLoginSuccess(data.data);
        return;
      }
    } catch {
      // Backend offline or local fallback
    }

    // Direct fallback for instant demo persona access
    onLoginSuccess({
      accessToken: 'demo-token-' + roleName.toLowerCase(),
      user: {
        id: 'demo-' + roleName.toLowerCase(),
        email: roleEmail,
        name: `${roleName} Test`,
        role: roleName,
        group: roleName,
        permissions: [],
      },
    });
    setLoading(false);
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
      background: 'radial-gradient(ellipse at 15% 15%, #e0f2fe 0%, #f0fdf4 35%, #f8fafc 85%)',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative Background Accents */}
      <div style={{
        position: 'absolute',
        top: -120,
        right: -120,
        width: 380,
        height: 380,
        borderRadius: '50%',
        background: 'rgba(2, 132, 199, 0.08)',
        filter: 'blur(50px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: -100,
        left: -100,
        width: 350,
        height: 350,
        borderRadius: '50%',
        background: 'rgba(16, 185, 129, 0.08)',
        filter: 'blur(50px)',
        pointerEvents: 'none',
      }} />

      <div style={{
        maxWidth: 480,
        width: '100%',
        background: '#ffffff',
        borderRadius: 20,
        padding: '34px 32px',
        boxShadow: '0 20px 40px -15px rgba(2, 132, 199, 0.08), 0 1px 3px 0 rgba(15, 23, 42, 0.06)',
        border: '1px solid #e2e8f0',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Hospital Branding Header */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#ffffff',
            marginBottom: 12,
            boxShadow: '0 8px 18px rgba(2, 132, 199, 0.3)',
          }}>
            <Stethoscope size={30} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
              MEDORA 2.0
            </h1>
            <span style={{
              background: '#e0f2fe',
              color: '#0284c7',
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 6,
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}>
              Enterprise
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Hospital Clinical & Operational Management
          </p>

          {/* Security & System Trust Badges */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#059669', background: '#ecfdf5', padding: '3px 8px', borderRadius: 9999, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Shield size={12} /> Zero-Trust RBAC
            </span>
            <span style={{ fontSize: 11, color: '#0284c7', background: '#f0f9ff', padding: '3px 8px', borderRadius: 9999, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <HeartPulse size={12} /> Clinical Core
            </span>
          </div>
        </div>

        {/* Tab Switcher: Sign In vs Register */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: '#f1f5f9',
          borderRadius: 10,
          padding: 3,
          marginBottom: 20,
        }}>
          <button
            type="button"
            onClick={() => { setAuthMode('login'); setError(null); }}
            style={{
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 700,
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: authMode === 'login' ? '#ffffff' : 'transparent',
              color: authMode === 'login' ? '#0f172a' : '#64748b',
              boxShadow: authMode === 'login' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <LogIn size={15} /> Sign In
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('register'); setError(null); }}
            style={{
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 700,
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: authMode === 'register' ? '#ffffff' : 'transparent',
              color: authMode === 'register' ? '#0284c7' : '#64748b',
              boxShadow: authMode === 'register' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <UserPlus size={15} /> Register Staff
          </button>
        </div>

        {/* Lockout or Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 10,
            marginBottom: 20,
            background: isLocked ? '#fef2f2' : '#fff1f2',
            border: `1px solid ${isLocked ? '#f87171' : '#fecdd3'}`,
            color: '#991b1b',
            fontSize: 13,
            lineHeight: 1.4,
          }}>
            <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 2, color: '#dc2626' }} />
            <div>
              <div style={{ fontWeight: 700 }}>{isLocked ? 'Account Temporarily Locked' : 'Authentication Notice'}</div>
              <div>{error}</div>
            </div>
          </div>
        )}

        {/* SIGN IN FORM */}
        {authMode === 'login' && (
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group" style={{ marginBottom: 15 }}>
              <label className="form-label" style={{ fontSize: 12.5 }}>Hospital Work Email</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  className="form-input"
                  placeholder="doctor.test@medora.hospital"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  style={{ paddingLeft: 38 }}
                  disabled={loading}
                />
                <Mail size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0, fontSize: 12.5 }}>Password</label>
                <button
                  type="button"
                  onClick={() => setForgotModal(true)}
                  style={{ fontSize: 12, fontWeight: 600, color: '#0284c7', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer' }}
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
                <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 10, top: 9, color: '#94a3b8', padding: 3, background: 'none', border: 'none', cursor: 'pointer' }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '11px', fontSize: 14, fontWeight: 700, borderRadius: 10 }}
              disabled={loading}
            >
              {loading ? 'Verifying Credentials...' : 'Sign In to Clinical Portal'}
            </button>
          </form>
        )}

        {/* REGISTER STAFF FORM */}
        {authMode === 'register' && (
          <form onSubmit={handleRegisterSubmit}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontSize: 12.5 }}>Full Name</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Dr. Aisha Khan"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  autoFocus
                  required
                  style={{ paddingLeft: 38 }}
                  disabled={loading}
                />
                <User size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontSize: 12.5 }}>Hospital Work Email</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  className="form-input"
                  placeholder="e.g. aisha.khan@medora.hospital"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  style={{ paddingLeft: 38 }}
                  disabled={loading}
                />
                <Mail size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontSize: 12.5 }}>Hospital Role / Department</label>
              <div style={{ position: 'relative' }}>
                <select
                  className="form-input"
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as any)}
                  style={{ paddingLeft: 38, cursor: 'pointer', fontWeight: 600 }}
                  disabled={loading}
                >
                  <option value="Doctor">🩺 Doctor (Medical Consultant)</option>
                  <option value="Accountant">📊 Accountant (Finance & Invoices)</option>
                  <option value="Pharmacist">💊 Pharmacist (Inventory & Dispense)</option>
                  <option value="Laboratorist">🔬 Laboratorist (Pathology & RIS)</option>
                  <option value="Receptionist">📋 Receptionist (Frontdesk & IPD)</option>
                  <option value="Admin">👑 Administrator (Governance)</option>
                </select>
                <Building size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ fontSize: 12.5 }}>Password (min 8 chars)</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  minLength={8}
                  style={{ paddingLeft: 38, paddingRight: 38 }}
                  disabled={loading}
                />
                <Lock size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 10, top: 9, color: '#94a3b8', padding: 3, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '11px', fontSize: 14, fontWeight: 700, borderRadius: 10 }}
              disabled={loading}
            >
              {loading ? 'Creating Staff Account...' : `Register as ${regRole} & Enter`}
            </button>
          </form>
        )}

        {/* Development Persona Quick Links */}
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid #f1f5f9' }}>
          <div style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 700,
            color: '#64748b',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}>
            <Sparkles size={12} style={{ color: '#0284c7' }} />
            One-Click Instant Demo Personas
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '7px 4px', background: '#f8fafc', borderColor: '#e2e8f0', color: '#1e293b' }}
              onClick={() => instantLogin('admin.test@medora.hospital', 'Admin')}
              title="Sign in as Administrator"
            >
              👑 Admin
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '7px 4px', background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}
              onClick={() => instantLogin('doctor.test@medora.hospital', 'Doctor')}
              title="Sign in as Doctor"
            >
              🩺 Doctor
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '7px 4px', background: '#fef3c7', borderColor: '#fde68a', color: '#92400e' }}
              onClick={() => instantLogin('accountant.test@medora.hospital', 'Accountant')}
              title="Sign in as Accountant"
            >
              📊 Accountant
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '7px 4px', background: '#f0f9ff', borderColor: '#bae6fd', color: '#0369a1' }}
              onClick={() => instantLogin('pharmacist.test@medora.hospital', 'Pharmacist')}
              title="Sign in as Pharmacist"
            >
              💊 Pharmacist
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '7px 4px', background: '#faf5ff', borderColor: '#e9d5ff', color: '#6b21a8' }}
              onClick={() => instantLogin('laboratorist.test@medora.hospital', 'Laboratorist')}
              title="Sign in as Laboratorist"
            >
              🔬 Laboratorist
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: 12, padding: '7px 4px', background: '#fff1f2', borderColor: '#fecdd3', color: '#9f1239' }}
              onClick={() => instantLogin('receptionist.test@medora.hospital', 'Receptionist')}
              title="Sign in as Receptionist"
            >
              📋 Receptionist
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotModal && (
        <div className="modal-backdrop">
          <div className="card modal-dialog" style={{ maxWidth: 420, width: '100%', padding: 26 }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Reset Account Password</h3>
            {forgotSent ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#059669', marginBottom: 12, fontWeight: 600 }}>
                  <CheckCircle2 size={20} />
                  <span>Password reset instructions dispatched.</span>
                </div>
                <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                  If your email is registered with Medora, an outbox recovery notice with verification credentials has been queued.
                </p>
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: 16 }}
                  onClick={() => { setForgotModal(false); setForgotSent(false); }}
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <p style={{ fontSize: 13, color: '#64748b', marginBottom: 18, lineHeight: 1.5 }}>
                  Enter your registered hospital work email address to receive password recovery instructions.
                </p>
                <div className="form-group">
                  <label className="form-label">Hospital Work Email</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="user@medora.hospital"
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setForgotModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Send Reset Link
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
