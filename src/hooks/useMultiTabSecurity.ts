import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const BROADCAST_CHANNEL_NAME = 'g2c_security_channel';

export type SecurityBroadcastEvent =
  | { type: 'LOGOUT' }
  | { type: 'LOGIN'; userId: string }
  | { type: 'SEAT_HOLD_CREATED'; showtimeId: string; tabId: string }
  | { type: 'BOOKING_COMPLETED'; bookingId: string; showtimeId: string };

const TAB_ID = Math.random().toString(36).substring(2, 9);

export const broadcastSecurityEvent = (event: SecurityBroadcastEvent) => {
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage(event);
      channel.close();
    }
  } catch {
    // Ignore channel failure
  }
};

export const useMultiTabSecurity = (onShowtimeInvalidate?: (showtimeId: string) => void) => {
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Storage Event Listener for Cross-Tab Auth Sync
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'accessToken') {
        if (!e.newValue) {
          toast.warn('Đã đăng xuất ở một cửa sổ/tab khác. Đang đồng bộ lại!');
          setTimeout(() => {
            window.location.href = '/';
          }, 800);
        } else if (e.newValue) {
          toast.info('Đã đăng nhập ở một cửa sổ/tab khác. Đang làm mới dữ liệu!');
          setTimeout(() => {
            window.location.reload();
          }, 800);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // 2. BroadcastChannel Listener for Multi-Tab Anti-Fraud / Seat Hold Sync
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<SecurityBroadcastEvent>) => {
        const payload = event.data;
        if (!payload) return;

        if (payload.type === 'LOGOUT') {
          toast.warn('Tài khoản đã đăng xuất ở một tab khác.');
          navigate('/', { replace: true });
        } else if (payload.type === 'SEAT_HOLD_CREATED') {
          if (payload.tabId !== TAB_ID) {
            toast.info(
              'Phát hiện giữ ghế ở một tab khác. Đã khóa để tránh trùng lặp!',
              { autoClose: 3500 }
            );
            if (onShowtimeInvalidate) {
              onShowtimeInvalidate(payload.showtimeId);
            }
          }
        } else if (payload.type === 'BOOKING_COMPLETED') {
          toast.success('Đơn hàng đã được thanh toán ở cửa sổ khác!');
          if (onShowtimeInvalidate) {
            onShowtimeInvalidate(payload.showtimeId);
          }
        }
      };
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (channel) {
        channel.close();
      }
    };
  }, [navigate, onShowtimeInvalidate]);

  return { tabId: TAB_ID, broadcastSecurityEvent };
};
