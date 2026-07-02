import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAccessToken } from '../lib/auth';
import { logout } from '../services/authService';

const LAST_ACTIVITY_KEY = 'g2c-last-activity-at';
const CHECK_IDLE_INTERVAL_MS = 1000;
const ACTIVITY_EVENTS = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'scroll',
  'touchstart',
  'click',
] as const;

// Đọc thời điểm user thao tác gần nhất từ localStorage để đồng bộ giữa nhiều tab.
const readLastActivity = () => {
  const storedValue = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
  return Number.isFinite(storedValue) && storedValue > 0 ? storedValue : 0;
};

// Hook tự logout khi user đăng nhập nhưng không thao tác trong timeoutMinutes.
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

    // Ghi hoạt động mới nhưng throttle 1s để không spam localStorage khi di chuột.
    const writeActivity = (timestamp: number) => {
      lastActivityRef.current = timestamp;

      if (timestamp - lastActivityWriteRef.current >= 1000) {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(timestamp));
        lastActivityWriteRef.current = timestamp;
      }
    };

    // Lấy mốc hoạt động mới nhất từ ref hiện tại và localStorage.
    const getLatestActivity = () =>
      Math.max(lastActivityRef.current, readLastActivity());

    // Gọi logout backend, dọn localStorage và đưa user về trang chủ.
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

    // Kiểm tra user đã idle quá thời gian cho phép chưa.
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

    // Mỗi event thao tác sẽ đánh dấu user còn hoạt động.
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
