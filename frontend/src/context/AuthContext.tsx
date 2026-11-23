import React, { createContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser, AuthResponse, UserBranch } from '../types/auth';
import { resolveUserRole, type AppRole } from '../app/role-resolution';
import { getApiBaseUrl } from '../config/api';

const API_BASE_URL = getApiBaseUrl();

interface AuthContextType {
  token: string;
  currentUser: AuthUser | null;
  userRole: AppRole;
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

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem('medora_access_token') || '');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userRole, setUserRole] = useState<AppRole>('');
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [userBranches, setUserBranches] = useState<UserBranch[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState<string>(
    () => localStorage.getItem('medora_active_branch') || '1',
  );
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const setActiveBranchId = useCallback((id: string) => {
    setActiveBranchIdState(id);
    localStorage.setItem('medora_active_branch', id);
  }, []);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('medora_access_token');
    sessionStorage.removeItem('medora_user');
    localStorage.removeItem('medora_active_branch');
    setToken('');
    setCurrentUser(null);
    setUserRole('');
    setUserPermissions([]);
    setUserBranches([]);
  }, []);

  /**
   * Authoritative identity restoration: validates token against backend GET /api/v1/auth/me
   * Invariant: Never restores privileged access from unvalidated cached session storage.
   */
  const validateSessionWithBackend = useCallback(async (authToken: string) => {
    if (!authToken) {
      setCurrentUser(null);
      setUserRole('');
      setUserPermissions([]);
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
        const resolved = resolveUserRole(user);
        const permissions: string[] = Array.isArray(user.permissions) ? user.permissions : [];

        const normalizedUser: AuthUser = {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: resolved,
          group: user.group || resolved,
          permissions,
          branchId: user.branchId ? String(user.branchId) : undefined,
          organizationId: user.organizationId ? String(user.organizationId) : undefined,
          organizationRole: user.organizationRole || undefined,
          organizationEdition: user.organizationEdition || undefined,
          organizationStatus: user.organizationStatus || undefined,
          isSuperAdmin: Boolean(user.isSuperAdmin),
        };

        setCurrentUser(normalizedUser);
        setUserRole(resolved);
        setUserPermissions(permissions);
        sessionStorage.setItem('medora_user', JSON.stringify(normalizedUser));

        // Fetch authorized branches for the validated user
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

          // Reconcile active branch securely
          const storedBranch = localStorage.getItem('medora_active_branch');
          if (branches.length > 0) {
            if (storedBranch && branches.some((b) => String(b.id) === String(storedBranch))) {
              setActiveBranchIdState(storedBranch);
            } else {
              const defaultBranch = String(branches[0].id);
              setActiveBranchIdState(defaultBranch);
              localStorage.setItem('medora_active_branch', defaultBranch);
            }
          } else if (normalizedUser.branchId) {
            setActiveBranchIdState(normalizedUser.branchId);
            localStorage.setItem('medora_active_branch', normalizedUser.branchId);
          }
        } catch {
          // Fallback if branch lookup fails
          if (normalizedUser.branchId) {
            setActiveBranchIdState(normalizedUser.branchId);
          }
        }
      } else {
        handleLogout();
      }
    } catch {
      // Network failure during startup: do NOT grant default admin
      handleLogout();
    } finally {
      setAuthLoading(false);
    }
  }, [handleLogout]);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const existingToken = sessionStorage.getItem('medora_access_token');
      if (existingToken) {
        await validateSessionWithBackend(existingToken);
      } else if (!cancelled) {
        setAuthLoading(false);
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [validateSessionWithBackend]);

  const handleLoginSuccess = useCallback(
    (auth: AuthResponse) => {
      if (!auth.accessToken || !auth.user) {
        handleLogout();
        return;
      }

      setToken(auth.accessToken);
      sessionStorage.setItem('medora_access_token', auth.accessToken);

      const resolvedRole = resolveUserRole(auth.user);
      const permissions: string[] = Array.isArray(auth.user.permissions) ? auth.user.permissions : [];
      const normalizedUser: AuthUser = {
        ...auth.user,
        role: resolvedRole,
        group: auth.user.group || resolvedRole,
        permissions,
        organizationId: auth.user.organizationId ? String(auth.user.organizationId) : undefined,
        organizationRole: auth.user.organizationRole || undefined,
        organizationEdition: auth.user.organizationEdition || undefined,
        organizationStatus: auth.user.organizationStatus || undefined,
        isSuperAdmin: Boolean(auth.user.isSuperAdmin),
      };

      setCurrentUser(normalizedUser);
      setUserRole(resolvedRole);
      setUserPermissions(permissions);
      sessionStorage.setItem('medora_user', JSON.stringify(normalizedUser));

      if (auth.user.branches && auth.user.branches.length > 0) {
        setUserBranches(auth.user.branches);
        setActiveBranchId(String(auth.user.branches[0].id));
      } else if (auth.user.branchId) {
        setActiveBranchId(String(auth.user.branchId));
      } else {
        localStorage.removeItem('medora_active_branch');
      }
    },
    [setActiveBranchId, handleLogout],
  );

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

export { useAuth } from './useAuth';
