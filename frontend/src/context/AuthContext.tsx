import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser, AuthResponse, UserBranch } from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function resolveRole(user: { role?: string; group?: string } | null | undefined): string {
  if (!user) return 'Admin';
  const rawRole = user.role || user.group || 'Admin';
  const roleLower = String(rawRole).toLowerCase();

  if (roleLower.includes('doc')) return 'Doctor';
  if (roleLower.includes('acc') || roleLower.includes('fin')) return 'Accountant';
  if (roleLower.includes('pharm')) return 'Pharmacist';
  if (roleLower.includes('lab') || roleLower.includes('path')) return 'Laboratorist';
  if (roleLower.includes('recept') || roleLower.includes('front')) return 'Receptionist';
  if (roleLower.includes('nurse')) return 'Nurse';
  if (roleLower.includes('admin')) return 'Admin';

  return rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
}

interface AuthContextType {
  token: string;
  currentUser: AuthUser | null;
  userRole: string;
  userPermissions: string[];
  userBranches: UserBranch[];
  activeBranchId: string;
  authLoading: boolean;
  apiBaseUrl: string;
  setActiveBranchId: (id: string) => void;
  handleLoginSuccess: (auth: AuthResponse) => void;
  handleLogout: () => void;
  refreshIdentity: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem('medora_access_token') || '');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userRole, setUserRole] = useState<string>('Admin');
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [userBranches, setUserBranches] = useState<UserBranch[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState<string>(() => localStorage.getItem('medora_active_branch') || '1');
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const setActiveBranchId = useCallback((id: string) => {
    setActiveBranchIdState(id);
    localStorage.setItem('medora_active_branch', id);
  }, []);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('medora_access_token');
    sessionStorage.removeItem('medora_user');
    setToken('');
    setCurrentUser(null);
    setUserRole('Admin');
    setUserPermissions([]);
    setUserBranches([]);
  }, []);

  /**
   * Authoritative identity restoration: validates token against backend GET /api/v1/auth/me
   */
  const validateSessionWithBackend = useCallback(async (authToken: string) => {
    if (!authToken) {
      setAuthLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!res.ok) {
        // Token invalid, expired or unauthorized
        handleLogout();
        setAuthLoading(false);
        return;
      }

      const json = await res.json();
      if (json.success && json.data) {
        const user = json.data;
        const resolved = resolveRole(user);
        const permissions: string[] = Array.isArray(user.permissions) ? user.permissions : [];

        const normalizedUser: AuthUser = {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: resolved,
          group: user.group || resolved,
          permissions,
          branchId: user.branchId ? String(user.branchId) : undefined,
        };

        setCurrentUser(normalizedUser);
        setUserRole(resolved);
        setUserPermissions(permissions);

        // Fetch authorized branches
        try {
          const branchRes = await fetch(`${API_BASE_URL}/api/v1/branches/my-branches`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          const branchData = await branchRes.json();
          const branches: UserBranch[] = Array.isArray(branchData.data)
            ? branchData.data
            : Array.isArray(branchData)
              ? branchData
              : [];

          setUserBranches(branches);

          // Reconcile active branch
          const storedBranch = localStorage.getItem('medora_active_branch');
          if (branches.length > 0) {
            if (storedBranch && branches.some((b) => String(b.id) === String(storedBranch))) {
              setActiveBranchIdState(storedBranch);
            } else {
              const defaultBranch = String(branches[0].id);
              setActiveBranchIdState(defaultBranch);
              localStorage.setItem('medora_active_branch', defaultBranch);
            }
          }
        } catch {
          // Branch fetching error fallback
        }
      } else {
        handleLogout();
      }
    } catch {
      // Network connectivity error during startup
      // Attempt read from cached session with warning
      const raw = sessionStorage.getItem('medora_user');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const resolved = resolveRole(parsed);
          setCurrentUser(parsed);
          setUserRole(resolved);
          setUserPermissions(parsed.permissions || []);
        } catch {
          handleLogout();
        }
      }
    } finally {
      setAuthLoading(false);
    }
  }, [handleLogout]);

  useEffect(() => {
    const existingToken = sessionStorage.getItem('medora_access_token');
    if (existingToken) {
      validateSessionWithBackend(existingToken);
    } else {
      setAuthLoading(false);
    }
  }, [validateSessionWithBackend]);

  const handleLoginSuccess = useCallback((auth: AuthResponse) => {
    setToken(auth.accessToken);
    sessionStorage.setItem('medora_access_token', auth.accessToken);

    if (auth.user) {
      const resolvedRole = resolveRole(auth.user);
      const permissions: string[] = Array.isArray(auth.user.permissions) ? auth.user.permissions : [];
      const normalizedUser: AuthUser = {
        ...auth.user,
        role: resolvedRole,
        group: auth.user.group || resolvedRole,
        permissions,
      };

      setCurrentUser(normalizedUser);
      setUserRole(resolvedRole);
      setUserPermissions(permissions);
      sessionStorage.setItem('medora_user', JSON.stringify(normalizedUser));

      if (auth.user.branches && auth.user.branches.length > 0) {
        setUserBranches(auth.user.branches);
        setActiveBranchId(String(auth.user.branches[0].id));
      }
    }
  }, [setActiveBranchId]);

  return (
    <AuthContext.Provider
      value={{
        token,
        currentUser,
        userRole,
        userPermissions,
        userBranches,
        activeBranchId,
        authLoading,
        apiBaseUrl: API_BASE_URL,
        setActiveBranchId,
        handleLoginSuccess,
        handleLogout,
        refreshIdentity: () => validateSessionWithBackend(token),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
