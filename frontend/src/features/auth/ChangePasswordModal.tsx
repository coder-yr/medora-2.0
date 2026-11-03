import React, { useState } from 'react';
import { Lock, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface ChangePasswordModalProps {
  token: string;
  apiBaseUrl: string;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  token,
  apiBaseUrl,
  onClose,
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      setError('Both current and new password are required.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        const msg = data.error?.message || data.message || 'Failed to update password.';
        setError(Array.isArray(msg) ? msg.join(', ') : msg);
      }
    } catch {
      setError('Network error contacting hospital server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 16
    }}>
      <div className="card" style={{ maxWidth: 440, width: '100%', padding: 24, position: 'relative' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', right: 16, top: 16, color: '#94a3b8' }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ background: '#e0f2fe', color: '#0284c7', padding: 8, borderRadius: 8 }}>
            <Lock size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Change Password</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Update your hospital account credentials
            </p>
          </div>
        </div>

        {success ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 14,
            borderRadius: 8,
            background: '#dcfce7',
            color: '#166534',
            fontSize: 14,
            fontWeight: 500
          }}>
            <CheckCircle2 size={20} />
            Password successfully updated!
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 6,
                background: '#fee2e2',
                color: '#b91c1c',
                fontSize: 13,
                marginBottom: 14
              }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input
                type="password"
                required
                className="form-input"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Password (min 8 chars)</label>
              <input
                type="password"
                required
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                required
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
