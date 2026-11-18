import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Stethoscope, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { token, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: '#f8fafc',
      }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: '#e0f2fe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0284c7',
        }}>
          <Stethoscope size={28} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontWeight: 600, fontSize: 15 }}>
          <Loader2 className="animate-spin" size={18} style={{ color: '#0284c7' }} />
          <span>Restoring verified hospital session...</span>
        </div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

interface RequirePermissionProps {
  permission: string;
  children: React.ReactNode;
}

export const RequirePermission: React.FC<RequirePermissionProps> = ({ permission, children }) => {
  const { userPermissions, userRole } = useAuth();
  const navigate = useNavigate();

  const hasAccess =
    userRole === 'Admin' ||
    userPermissions.map((p) => p.toLowerCase()).includes(permission.toLowerCase());

  if (!hasAccess) {
    return (
      <div style={{
        maxWidth: 560,
        margin: '60px auto',
        padding: 32,
        borderRadius: 16,
        background: '#ffffff',
        border: '1px solid #fee2e2',
        boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.08)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#fef2f2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#dc2626',
          margin: '0 auto 16px',
        }}>
          <ShieldAlert size={30} />
        </div>

        <h3 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
          Access Restricted
        </h3>
        <p style={{ margin: '0 0 16px 0', fontSize: 13.5, color: '#64748b', lineHeight: 1.5 }}>
          Your active hospital staff role (<strong>{userRole}</strong>) does not have the required security authorization to access this workspace.
        </p>

        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 12.5,
          color: '#475569',
          marginBottom: 24,
          fontFamily: 'monospace',
          display: 'inline-block',
        }}>
          Required Grant: <code>{permission}</code>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', fontSize: 13 }}
          >
            <ArrowLeft size={16} /> Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
