import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  getRoleFromAccessToken,
  isAccessTokenExpired,
  normalizeRole,
} from '../lib/auth';
import { refreshAccessToken } from '../lib/api';
import { verifyAdminSession } from '../services/authService';

type AuthCheckState = 'checking' | 'allowed' | 'login' | 'forbidden';

type RequireAuthProps = {
  allowedRoles?: string[];
  verifyAdmin?: boolean;
};

const getErrorStatus = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'response' in error &&
  typeof error.response === 'object' &&
  error.response !== null &&
  'status' in error.response &&
  typeof error.response.status === 'number'
    ? error.response.status
    : undefined;

const RequireAuth = ({ allowedRoles = [], verifyAdmin = false }: RequireAuthProps) => {
  const [authState, setAuthState] = useState<AuthCheckState>('checking');

  useEffect(() => {
    let isMounted = true;

    const setSafeAuthState = (nextState: AuthCheckState) => {
      if (isMounted) {
        setAuthState(nextState);
      }
    };

    const authorizeToken = async (token: string) => {
      const normalizedRole = normalizeRole(getRoleFromAccessToken(token));
      const normalizedAllowedRoles = allowedRoles.map((role) => normalizeRole(role));
      const hasAllowedRole =
        normalizedAllowedRoles.length === 0 ||
        normalizedAllowedRoles.includes(normalizedRole);

      if (!hasAllowedRole) {
        setSafeAuthState('forbidden');
        return;
      }

      if (!verifyAdmin) {
        setSafeAuthState('allowed');
        return;
      }

      try {
        await verifyAdminSession();
        setSafeAuthState('allowed');
      } catch (error: unknown) {
        if (getErrorStatus(error) === 401) {
          clearAuthSession();
          setSafeAuthState('login');
          return;
        }

        setSafeAuthState('forbidden');
      }
    };

    const checkAuth = async () => {
      let token = getAccessToken();

      if (!token && getRefreshToken()) {
        token = await refreshAccessToken();
      }

      if (!token) {
        clearAuthSession();
        setSafeAuthState('login');
        return;
      }

      if (isAccessTokenExpired(token)) {
        const refreshedToken = await refreshAccessToken();

        if (!refreshedToken) {
          setSafeAuthState('login');
          return;
        }

        token = refreshedToken;
      }

      await authorizeToken(token);
    };

    void checkAuth();

    return () => {
      isMounted = false;
    };
  }, [allowedRoles, verifyAdmin]);

  if (authState === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F172A] text-sm font-semibold text-white">
        Dang kiem tra quyen truy cap...
      </div>
    );
  }

  if (authState === 'login') {
    return <Navigate to="/login" replace />;
  }

  if (authState === 'forbidden') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default RequireAuth;
