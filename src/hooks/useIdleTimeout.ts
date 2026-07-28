import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAccessToken } from '../lib/auth';
import { logout } from '../services/authService';

const LAST_ACTIVITY_KEY = 'g2c-last-activity-at';
const CHECK_IDLE_INTERVAL_MS = 10_000; // 10s is sufficient for a 10-minute idle timeout
const ACTIVITY_EVENTS = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'scroll',
  'touchstart',
  'click',
] as const;

const readLastActivity = () => {
  const storedValue = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
  return Number.isFinite(storedValue) && storedValue > 0 ? storedValue : 0;
};

export const useIdleTimeout = (timeoutMinutes: number = 10) => {
  const navigate = useNavigate();
  const location = useLocation();
  const lastActivityRef = useRef(0);
  const lastActivityWriteRef = useRef(0);
  const logoutStartedRef = useRef(false);

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      return;
    }

    logoutStartedRef.current = false;
    const timeoutMs = Math.max(1, timeoutMinutes) * 60 * 1000;

    const writeActivity = (timestamp: number) => {
      lastActivityRef.current = timestamp;

      if (timestamp - lastActivityWriteRef.current >= 1000) {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(timestamp));
        lastActivityWriteRef.current = timestamp;
      }
    };

    const getLatestActivity = () =>
      Math.max(lastActivityRef.current, readLastActivity());

    const handleIdleLogout = () => {
      if (logoutStartedRef.current) {
        return;
      }

      logoutStartedRef.current = true;
      void logout().finally(() => {
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        navigate('/', { replace: true });
        window.location.reload();
      });
    };

    const checkIdle = () => {
      if (!getAccessToken()) {
        return true;
      }

      const idleForMs = Date.now() - getLatestActivity();

      if (idleForMs >= timeoutMs) {
        handleIdleLogout();
        return true;
      }

      return false;
    };

    const markActive = () => {
      if (checkIdle()) {
        return;
      }

      writeActivity(Date.now());
    };

    writeActivity(Date.now());

    const intervalId = window.setInterval(checkIdle, CHECK_IDLE_INTERVAL_MS);
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, markActive, { passive: true });
    });

    return () => {
      window.clearInterval(intervalId);
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, markActive);
      });
    };
  }, [location.pathname, navigate, timeoutMinutes]);
};
