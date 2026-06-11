import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { clearAuthSession, getAccessToken, isAccessTokenExpired } from '../lib/auth';
import { verifyAdminSession } from '../services/authService';

type AuthCheckState = 'checking' | 'allowed' | 'login' | 'forbidden';

const RequireAuth = () => {
  const [authState, setAuthState] = useState<AuthCheckState>('checking');

  useEffect(() => {
    let isMounted = true;
    const token = getAccessToken();

    const setSafeAuthState = (nextState: AuthCheckState) => {
      if (isMounted) {
        setAuthState(nextState);
      }
    };

    if (!token || isAccessTokenExpired(token)) {
      clearAuthSession();
      setSafeAuthState('login');

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
  }, []);

  if (authState === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F172A] text-sm font-semibold text-white">
        Đang kiểm tra quyền truy cập...
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
