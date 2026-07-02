import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import {
  clearAuthSession,
  getAccessToken,
  getRoleFromAccessToken,
  normalizeRole,
} from '../lib/auth';
import { verifyAdminSession } from '../services/authService';

type AuthCheckState = 'checking' | 'allowed' | 'login' | 'forbidden';

type RequireAuthProps = {
  allowedRoles?: string[];
  verifyAdmin?: boolean;
};

const RequireAuth = ({ allowedRoles = [], verifyAdmin = false }: RequireAuthProps) => {
  const [authState, setAuthState] = useState<AuthCheckState>('checking');

  useEffect(() => {
    let isMounted = true;
    const token = getAccessToken();

    const setSafeAuthState = (nextState: AuthCheckState) => {
      if (isMounted) {
        setAuthState(nextState);
      }
    };

    if (!token) {
      clearAuthSession();
      setSafeAuthState('login');

      return () => {
        isMounted = false;
      };
    }

    const normalizedRole = normalizeRole(getRoleFromAccessToken(token));
    const normalizedAllowedRoles = allowedRoles.map((role) => normalizeRole(role));
    const hasAllowedRole =
      normalizedAllowedRoles.length === 0 ||
      normalizedAllowedRoles.includes(normalizedRole);

    if (!hasAllowedRole) {
      setSafeAuthState('forbidden');

      return () => {
        isMounted = false;
      };
    }

    if (!verifyAdmin) {
      setSafeAuthState('allowed');

      return () => {
        isMounted = false;
      };
    }

    verifyAdminSession()
      .then(() => setSafeAuthState('allowed'))
      .catch((error: unknown) => {
        const status =
          typeof error === 'object' &&
          error !== null &&
          'response' in error &&
          typeof error.response === 'object' &&
          error.response !== null &&
          'status' in error.response &&
          typeof error.response.status === 'number'
            ? error.response.status
            : undefined;

        if (status === 401) {
          clearAuthSession();
          setSafeAuthState('login');
          return;
        }

        setSafeAuthState('forbidden');
      });

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
