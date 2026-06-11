import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAccessToken, getRoleFromAccessToken, isCustomerRole } from '../lib/auth';
import { logout } from '../services/authService';

export const useIdleTimeout = (timeoutMinutes: number = 10) => {
  const navigate = useNavigate();
  const location = useLocation();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    const role = getRoleFromAccessToken(token);

    if (!token || !isCustomerRole(role)) {
      return;
    }

    const handleLogout = () => {
      void logout().finally(() => {
        navigate('/');
        window.location.reload();
      });
    };

    const resetTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(handleLogout, timeoutMinutes * 60 * 1000);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    resetTimer();
    events.forEach((event) => window.addEventListener(event, resetTimer));

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [location.pathname, navigate, timeoutMinutes]);
};
