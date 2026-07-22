import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  FaBell,
  FaCheckCircle,
  FaExclamationCircle,
  FaGift,
  FaInbox,
  FaInfoCircle,
  FaSyncAlt,
  FaTimes,
} from 'react-icons/fa';
import { AUTH_SESSION_EVENT, getAccessToken } from '../lib/auth';
import {
  extractNotificationItems,
  notificationService,
  type ApiResponse,
  type NotificationItem,
} from '../services/notificationService';

type NotificationCenterProps = {
  isLightMode?: boolean;
  buttonClassName?: string;
};

type NotificationTone = 'voucher' | 'success' | 'warning' | 'error' | 'info';

const NOTIFIED_VOUCHER_STORAGE_KEY = 'g2c-notified-voucher-notifications';
const POLL_INTERVAL_MS = 45_000;

const readNotifiedVoucherIds = () => {
  if (typeof window === 'undefined') {
    return new Set<string>();
  }

  try {
    const rawValue = sessionStorage.getItem(NOTIFIED_VOUCHER_STORAGE_KEY);
    const ids = rawValue ? (JSON.parse(rawValue) as string[]) : [];
    return new Set(ids.filter(Boolean));
  } catch {
    return new Set<string>();
  }
};

const writeNotifiedVoucherIds = (ids: Set<string>) => {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.setItem(
    NOTIFIED_VOUCHER_STORAGE_KEY,
    JSON.stringify(Array.from(ids).slice(-80)),
  );
};

const normalizeSearchText = (value: string) => value.toLowerCase();

const isVoucherNotification = (notification: NotificationItem) => {
  const value = normalizeSearchText(
    [
      notification.title,
      notification.message,
      notification.type,
      notification.channel,
    ].join(' '),
  );

  return (
    value.includes('voucher') ||
    value.includes('ưu đãi') ||
    value.includes('khuyến mãi') ||
    value.includes('mã giảm') ||
    value.includes('den bu') ||
    value.includes('đền bù') ||
    value.includes('compensation')
  );
};

const formatRelativeTime = (value: string) => {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return '';
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));

  if (diffMinutes < 1) {
    return 'Vừa xong';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} phút trước`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} giờ trước`;
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as { response?: { data?: { message?: string } } };
  return apiError.response?.data?.message || fallback;
};

const assertResponseSuccess = <T,>(response: ApiResponse<T>, fallback: string) => {
  if (response.success === false) {
    throw new Error(response.message || fallback);
  }
};

const getNotificationTone = (notification: NotificationItem): NotificationTone => {
  if (isVoucherNotification(notification)) {
    return 'voucher';
  }

  const status = normalizeSearchText(notification.status || '');
  const type = normalizeSearchText(notification.type || '');
  const text = normalizeSearchText(`${notification.title} ${notification.message}`);

  if (
    status.includes('fail') ||
    status.includes('error') ||
    type.includes('error') ||
    text.includes('thất bại') ||
    text.includes('lỗi')
  ) {
    return 'error';
  }

  if (
    status.includes('warn') ||
    type.includes('warn') ||
    text.includes('cảnh báo') ||
    text.includes('sắp hết')
  ) {
    return 'warning';
  }

  if (
    status.includes('success') ||
    status.includes('sent') ||
    type.includes('success') ||
    text.includes('thành công')
  ) {
    return 'success';
  }

  return 'info';
};

const getToneClasses = (tone: NotificationTone, isLightMode: boolean) => {
  const common = {
    icon: '',
    unreadCard: '',
    readCard: isLightMode
      ? 'border-slate-200 bg-slate-50 text-slate-600'
      : 'border-white/5 bg-white/[0.03] text-white/60',
  };

  switch (tone) {
    case 'voucher':
      return {
        ...common,
        icon: 'bg-amber-300 text-slate-950 shadow-lg shadow-amber-500/20',
        unreadCard: isLightMode
          ? 'border-amber-300 bg-amber-50 text-slate-950 shadow-amber-200/40'
          : 'border-amber-300/30 bg-amber-300/10 text-white shadow-amber-950/30',
      };
    case 'success':
      return {
        ...common,
        icon: 'bg-emerald-400/15 text-emerald-300',
        unreadCard: isLightMode
          ? 'border-emerald-200 bg-emerald-50 text-slate-950'
          : 'border-emerald-300/25 bg-emerald-300/10 text-white',
      };
    case 'warning':
      return {
        ...common,
        icon: 'bg-orange-400/15 text-orange-300',
        unreadCard: isLightMode
          ? 'border-orange-200 bg-orange-50 text-slate-950'
          : 'border-orange-300/25 bg-orange-300/10 text-white',
      };
    case 'error':
      return {
        ...common,
        icon: 'bg-rose-400/15 text-rose-300',
        unreadCard: isLightMode
          ? 'border-rose-200 bg-rose-50 text-slate-950'
          : 'border-rose-300/25 bg-rose-300/10 text-white',
      };
    default:
      return {
        ...common,
        icon: 'bg-cyan-400/15 text-cyan-300',
        unreadCard: isLightMode
          ? 'border-cyan-200 bg-cyan-50 text-slate-950'
          : 'border-cyan-300/25 bg-cyan-300/10 text-white',
      };
  }
};

const renderToneIcon = (tone: NotificationTone) => {
  switch (tone) {
    case 'voucher':
      return <FaGift />;
    case 'success':
      return <FaCheckCircle />;
    case 'warning':
      return <FaExclamationCircle />;
    case 'error':
      return <FaTimes />;
    default:
      return <FaInfoCircle />;
  }
};

const renderVoucherToast = (notification: NotificationItem) => (
  <div className="flex gap-3">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-300 text-slate-950 shadow-lg shadow-amber-500/20">
      <FaGift />
    </span>
    <span className="min-w-0">
      <span className="block text-sm font-black text-white">
        {notification.title || 'Bạn có voucher mới'}
      </span>
      <span className="mt-1 block line-clamp-2 text-xs font-semibold leading-5 text-slate-200">
        {notification.message || 'Mở ví ưu đãi để xem chi tiết voucher vừa nhận.'}
      </span>
    </span>
  </div>
);

export default function NotificationCenter({
  isLightMode = false,
  buttonClassName,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [authVersion, setAuthVersion] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasToken = Boolean(getAccessToken());

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  const fetchNotifications = useCallback(async (showErrors = false) => {
    if (!getAccessToken()) {
      setNotifications([]);
      return;
    }

    try {
      setLoading(true);
      const response = await notificationService.getNotifications({ pageSize: 12 });

      assertResponseSuccess(response, 'Không tải được thông báo.');

      const items = extractNotificationItems(response.data);
      setNotifications(items);

      const notifiedIds = readNotifiedVoucherIds();
      const newVoucherNotifications = items.filter(
        (notification) =>
          !notification.isRead &&
          isVoucherNotification(notification) &&
          !notifiedIds.has(notification.notificationId),
      );

      newVoucherNotifications.slice(0, 2).forEach((notification) => {
        toast(renderVoucherToast(notification), {
          type: 'success',
          icon: false,
          autoClose: 6500,
          className: 'g2c-toast g2c-voucher-toast',
          progressClassName: 'g2c-toast-progress g2c-voucher-toast-progress',
        });
        notifiedIds.add(notification.notificationId);
      });

      if (newVoucherNotifications.length > 0) {
        writeNotifiedVoucherIds(notifiedIds);
      }
    } catch (error) {
      if (showErrors) {
        toast.error(getApiErrorMessage(error, 'Không tải được thông báo. Vui lòng thử lại.'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleAuthChange = () => setAuthVersion((current) => current + 1);
    window.addEventListener(AUTH_SESSION_EVENT, handleAuthChange);
    return () => window.removeEventListener(AUTH_SESSION_EVENT, handleAuthChange);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchNotifications(false);
    }, 0);
    const intervalId = window.setInterval(() => {
      void fetchNotifications(false);
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [authVersion, fetchNotifications]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  if (!hasToken) {
    return null;
  }

  const handleMarkAsRead = async (notification: NotificationItem) => {
    if (notification.isRead) {
      return;
    }

    try {
      const response = await notificationService.markAsRead([
        notification.notificationId,
      ]);

      assertResponseSuccess(response, 'Không thể đánh dấu đã đọc.');

      setNotifications((current) =>
        current.map((item) =>
          item.notificationId === notification.notificationId
            ? { ...item, isRead: true }
            : item,
        ),
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể đánh dấu thông báo là đã đọc.'));
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) {
      return;
    }

    try {
      const response = await notificationService.markAllAsRead();

      assertResponseSuccess(response, 'Không thể đánh dấu tất cả thông báo.');

      setNotifications((current) =>
        current.map((notification) => ({ ...notification, isRead: true })),
      );
      toast.success('Đã đánh dấu tất cả thông báo là đã đọc.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể đánh dấu tất cả thông báo.'));
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        className={
          buttonClassName ||
          'grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15'
        }
        title="Thông báo"
        type="button"
        onClick={() => {
          setIsOpen((current) => !current);
          void fetchNotifications(false);
        }}
        aria-label="Mở thông báo"
      >
        <span className="relative">
          <FaBell />
          {unreadCount > 0 ? (
            <span className="absolute -right-2 -top-2 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white ring-2 ring-slate-950">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </span>
      </button>

      {isOpen ? (
        <div
          className={[
            'absolute right-0 top-[calc(100%+10px)] z-[80] w-[min(390px,calc(100vw-24px))] overflow-hidden rounded-2xl border shadow-2xl',
            isLightMode
              ? 'border-slate-200 bg-white text-slate-950 shadow-slate-900/15'
              : 'border-white/10 bg-[#0F172A] text-white shadow-black/50',
          ].join(' ')}
        >
          <div
            className={[
              'flex items-start justify-between gap-3 border-b px-4 py-3',
              isLightMode ? 'border-slate-200' : 'border-white/10',
            ].join(' ')}
          >
            <div>
              <p className="text-sm font-black">Thông báo</p>
              <p
                className={`mt-0.5 text-xs font-semibold ${
                  isLightMode ? 'text-slate-500' : 'text-white/55'
                }`}
              >
                {unreadCount > 0
                  ? `${unreadCount} thông báo chưa đọc`
                  : 'Bạn đã đọc hết thông báo'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void fetchNotifications(true)}
                disabled={loading}
                className={[
                  'grid h-8 w-8 place-items-center rounded-lg border text-xs transition disabled:cursor-not-allowed disabled:opacity-50',
                  isLightMode
                    ? 'border-slate-200 text-slate-600 hover:bg-slate-100'
                    : 'border-white/10 text-slate-300 hover:bg-white/10 hover:text-white',
                ].join(' ')}
                aria-label="Làm mới thông báo"
                title="Làm mới"
              >
                <FaSyncAlt className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                onClick={() => void handleMarkAllAsRead()}
                disabled={unreadCount === 0}
                className="rounded-lg border border-emerald-400/25 px-2.5 py-1.5 text-[11px] font-black text-emerald-300 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Đọc hết
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={[
                  'grid h-8 w-8 place-items-center rounded-lg border transition',
                  isLightMode
                    ? 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-950'
                    : 'border-white/10 text-slate-400 hover:bg-white/10 hover:text-white',
                ].join(' ')}
                aria-label="Đóng thông báo"
              >
                <FaTimes />
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto p-2">
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm font-semibold text-slate-400">
                Đang tải thông báo...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm font-semibold text-slate-400">
                <FaInbox className="mx-auto mb-3 text-2xl opacity-60" />
                Chưa có thông báo mới.
              </div>
            ) : (
              notifications.map((notification) => {
                const tone = getNotificationTone(notification);
                const toneClasses = getToneClasses(tone, isLightMode);

                return (
                  <button
                    key={notification.notificationId}
                    type="button"
                    onClick={() => void handleMarkAsRead(notification)}
                    className={[
                      'group mb-2 flex w-full gap-3 rounded-xl border p-3 text-left shadow-sm transition',
                      notification.isRead
                        ? toneClasses.readCard
                        : toneClasses.unreadCard,
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                        toneClasses.icon,
                      ].join(' ')}
                    >
                      {renderToneIcon(tone)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        {!notification.isRead ? (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400" />
                        ) : null}
                        <span className="line-clamp-1 text-sm font-black">
                          {notification.title || 'Thông báo mới'}
                        </span>
                      </span>
                      <span className="mt-1 line-clamp-2 text-xs font-semibold leading-5 opacity-80">
                        {notification.message || 'Bạn có cập nhật mới từ hệ thống.'}
                      </span>
                      <span className="mt-2 block text-[11px] font-bold opacity-55">
                        {formatRelativeTime(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
