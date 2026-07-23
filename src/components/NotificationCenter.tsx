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
import {
  VOUCHER_WALLET_UPDATED_EVENT,
  voucherService,
  type Voucher,
} from '../services/voucherService';

type NotificationCenterProps = {
  isLightMode?: boolean;
  buttonClassName?: string;
};

type NotificationTone = 'voucher' | 'success' | 'warning' | 'error' | 'info';

const POLL_INTERVAL_MS = 45_000;

const normalizeSearchText = (value: string) => value.toLowerCase();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getStringField = (source: unknown, keys: string[]) => {
  if (!isRecord(source)) {
    return '';
  }

  for (const key of keys) {
    const value = source[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const getBooleanField = (source: unknown, keys: string[]) => {
  if (!isRecord(source)) {
    return undefined;
  }

  for (const key of keys) {
    const value = source[key];

    if (typeof value === 'boolean') {
      return value;
    }
  }

  return undefined;
};

const parseRecordPayload = (value: unknown) => {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const getNotificationPayloads = (notification: NotificationItem) =>
  [
    parseRecordPayload(notification.metadata),
    parseRecordPayload(notification.payload),
  ].filter((payload): payload is Record<string, unknown> => Boolean(payload));

const normalizeVoucherCode = (value: string) =>
  value.trim().replace(/^['"]|['"]$/g, '').toUpperCase();

const getNotificationVoucherId = (notification: NotificationItem) => {
  const directVoucherId = getStringField(notification, [
    'voucherId',
    'voucherID',
    'VoucherId',
  ]);

  if (directVoucherId) {
    return directVoucherId;
  }

  const directReferenceType = getStringField(notification, [
    'referenceType',
    'entityType',
    'targetType',
  ]).toLowerCase();
  const directReferenceId = getStringField(notification, [
    'referenceId',
    'entityId',
    'targetId',
  ]);

  if (directReferenceId && directReferenceType.includes('voucher')) {
    return directReferenceId;
  }

  if (/^VOU_/i.test(directReferenceId)) {
    return directReferenceId;
  }

  for (const payload of getNotificationPayloads(notification)) {
    const payloadVoucherId = getStringField(payload, [
      'voucherId',
      'voucherID',
      'VoucherId',
    ]);

    if (payloadVoucherId) {
      return payloadVoucherId;
    }

    const payloadReferenceType = getStringField(payload, [
      'referenceType',
      'entityType',
      'targetType',
    ]).toLowerCase();
    const payloadReferenceId = getStringField(payload, [
      'referenceId',
      'entityId',
      'targetId',
    ]);

    if (payloadReferenceId && payloadReferenceType.includes('voucher')) {
      return payloadReferenceId;
    }

    if (/^VOU_/i.test(payloadReferenceId)) {
      return payloadReferenceId;
    }
  }

  const actionUrl = getStringField(notification, ['actionUrl', 'url', 'linkUrl']);
  const urlMatch = actionUrl.match(/(?:voucherId=|vouchers?\/)([A-Za-z0-9_-]+)/i);

  if (urlMatch?.[1]) {
    return urlMatch[1];
  }

  const textMatch = [notification.message, notification.title]
    .join(' ')
    .match(/\b(VOU_[A-Za-z0-9_-]+)\b/i);

  return textMatch?.[1] || '';
};

const getNotificationVoucherCode = (notification: NotificationItem) => {
  const directCode = getStringField(notification, [
    'voucherCode',
    'VoucherCode',
    'code',
    'Code',
  ]);

  if (directCode) {
    return normalizeVoucherCode(directCode);
  }

  for (const payload of getNotificationPayloads(notification)) {
    const payloadCode = getStringField(payload, [
      'voucherCode',
      'VoucherCode',
      'code',
      'Code',
    ]);

    if (payloadCode) {
      return normalizeVoucherCode(payloadCode);
    }
  }

  const actionUrl = getStringField(notification, ['actionUrl', 'url', 'linkUrl']);
  const actionCodeMatch = actionUrl.match(/[?&](?:voucherCode|code)=([^&#]+)/i);

  if (actionCodeMatch?.[1]) {
    return normalizeVoucherCode(decodeURIComponent(actionCodeMatch[1]));
  }

  const messageCodeMatch = notification.message?.match(
    /\[\s*([A-Za-z0-9_-]{3,100})\s*\]|(?:mã|ma|code)\s*[:#-]?\s*([A-Za-z0-9_-]{3,100})/i,
  );
  const code = messageCodeMatch?.[1] || messageCodeMatch?.[2] || '';

  return code ? normalizeVoucherCode(code) : '';
};

const getNotificationClaimKey = (notification: NotificationItem) =>
  getNotificationVoucherId(notification) ||
  getNotificationVoucherCode(notification) ||
  notification.notificationId;

const findVoucherByNotification = (
  vouchers: Voucher[],
  voucherId: string,
  voucherCode: string,
) =>
  vouchers.find(
    (voucher) =>
      (voucherId && voucher.voucherId === voucherId) ||
      (voucherCode && normalizeVoucherCode(voucher.voucherCode) === voucherCode),
  );

const getApiErrorCode = (error: unknown) => {
  if (typeof error === 'object' && error && 'response' in error) {
    return (error as { response?: { data?: { errorCode?: string } } }).response?.data
      ?.errorCode;
  }

  return undefined;
};

const isAlreadyClaimedError = (error: unknown) => {
  const code = (getApiErrorCode(error) || '').toUpperCase();
  const message =
    error instanceof Error
      ? error.message
      : (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || '';
  const normalizedMessage = normalizeSearchText(message);

  return (
    code.includes('LIMIT') ||
    code.includes('ALREADY') ||
    normalizedMessage.includes('already') ||
    normalizedMessage.includes('limit') ||
    normalizedMessage.includes('đã') ||
    normalizedMessage.includes('da ')
  );
};

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

const isClaimableVoucherNotification = (notification: NotificationItem) => {
  if (!isVoucherNotification(notification)) {
    return false;
  }

  const voucherIdentifier =
    getNotificationVoucherId(notification) || getNotificationVoucherCode(notification);

  if (!voucherIdentifier) {
    return false;
  }

  const explicitClaimable =
    getBooleanField(notification, ['claimable', 'isClaimable', 'isPrivate']) ??
    getNotificationPayloads(notification)
      .map((payload) =>
        getBooleanField(payload, ['claimable', 'isClaimable', 'isPrivate']),
      )
      .find((value) => value !== undefined);

  if (explicitClaimable !== undefined) {
    return explicitClaimable;
  }

  const value = normalizeSearchText(
    [notification.title, notification.message, notification.type].join(' '),
  );

  return (
    value.includes('private') ||
    value.includes('riêng') ||
    value.includes('riÃªng') ||
    value.includes('tặng') ||
    value.includes('táº·ng') ||
    value.includes('được tặng') ||
    value.includes('Ä‘Æ°á»£c táº·ng') ||
    value.includes('claim') ||
    value.includes('nhận') ||
    value.includes('nháº­n')
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

const cleanNotificationText = (value: string) =>
  value
    .replace(/\uD83C\uDF81|\uFE0F/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const getNotificationDisplayText = (value: string | undefined, fallback: string) =>
  cleanNotificationText(value || fallback) || fallback;

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

export default function NotificationCenter({
  isLightMode = false,
  buttonClassName,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [authVersion, setAuthVersion] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimingVoucherId, setClaimingVoucherId] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const hasToken = Boolean(getAccessToken());

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  const markNotificationAsRead = useCallback(
    async (notification: NotificationItem, showErrors = true) => {
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
        if (showErrors) {
          toast.error(getApiErrorMessage(error, 'Không thể đánh dấu thông báo là đã đọc.'));
        }
      }
    },
    [],
  );

  const handleClaimVoucherNotification = useCallback(
    async (notification: NotificationItem) => {
      const voucherId = getNotificationVoucherId(notification);
      const voucherCode = getNotificationVoucherCode(notification);
      const claimKey = getNotificationClaimKey(notification);

      if (!voucherId && !voucherCode) {
        toast.info('Không tìm thấy mã voucher trong thông báo này. Vui lòng mở ví voucher để kiểm tra.');
        return;
      }

      try {
        setClaimingVoucherId(claimKey);

        const walletResponse = await voucherService.getMyVouchers();
        const walletVouchers = walletResponse.data || [];
        const walletVoucher = findVoucherByNotification(
          walletVouchers,
          voucherId,
          voucherCode,
        );

        if (walletVoucher) {
          toast.success('Voucher đã nằm trong ví ưu đãi của bạn.');
          window.dispatchEvent(new Event(VOUCHER_WALLET_UPDATED_EVENT));
          await markNotificationAsRead(notification, false);
          return;
        }

        let claimVoucherId = voucherId;

        if (!claimVoucherId) {
          const [claimableResult, activeResult] = await Promise.allSettled([
            voucherService.getClaimableVouchers(),
            voucherService.getActiveVouchers(),
          ]);
          const claimableVouchers =
            claimableResult.status === 'fulfilled'
              ? claimableResult.value.data || []
              : [];
          const activeVouchers =
            activeResult.status === 'fulfilled' ? activeResult.value.data || [] : [];
          const matchedVoucher = findVoucherByNotification(
            [...claimableVouchers, ...activeVouchers],
            '',
            voucherCode,
          );

          claimVoucherId = matchedVoucher?.voucherId || '';
        }

        if (!claimVoucherId) {
          toast.info('Không tìm thấy voucher để nhận. Vui lòng mở ví voucher để kiểm tra lại.');
          return;
        }

        const response = await voucherService.claimVoucher(claimVoucherId);

        if (!response.success) {
          throw new Error(response.message || 'Không thể nhận voucher này.');
        }

        toast.success(response.message || 'Đã thêm voucher vào ví ưu đãi.');
        window.dispatchEvent(new Event(VOUCHER_WALLET_UPDATED_EVENT));
        await markNotificationAsRead(notification, false);
      } catch (error) {
        if (isAlreadyClaimedError(error)) {
          try {
            const walletResponse = await voucherService.getMyVouchers();
            const walletVoucher = findVoucherByNotification(
              walletResponse.data || [],
              voucherId,
              voucherCode,
            );

            if (walletVoucher) {
              toast.success('Voucher đã nằm trong ví ưu đãi của bạn.');
              window.dispatchEvent(new Event(VOUCHER_WALLET_UPDATED_EVENT));
              await markNotificationAsRead(notification, false);
              return;
            }
          } catch {
            // Fall through to the original error message.
          }
        }

        toast.error(getApiErrorMessage(error, 'Không thể nhận voucher này.'));
      } finally {
        setClaimingVoucherId('');
      }
    },
    [markNotificationAsRead],
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

  const handleMarkAsRead = (notification: NotificationItem) =>
    markNotificationAsRead(notification);

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
            'absolute right-0 top-[calc(100%+8px)] z-[80] w-[min(360px,calc(100vw-20px))] overflow-hidden rounded-xl border shadow-2xl',
            isLightMode
              ? 'border-slate-200 bg-white text-slate-950 shadow-slate-900/15'
              : 'border-white/10 bg-[#0F172A] text-white shadow-black/50',
          ].join(' ')}
        >
          <div
            className={[
              'flex items-center justify-between gap-2 border-b px-3 py-2.5',
              isLightMode ? 'border-slate-200' : 'border-white/10',
            ].join(' ')}
          >
            <div className="min-w-0">
              <p className="text-sm font-black">Thông báo</p>
              <p
                className={`mt-0.5 truncate text-[11px] font-semibold ${
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
                  'grid h-7 w-7 place-items-center rounded-md border text-[11px] transition disabled:cursor-not-allowed disabled:opacity-50',
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
                className="rounded-md border border-emerald-400/25 px-2.5 py-1 text-[11px] font-black text-emerald-300 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Đọc hết
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={[
                  'grid h-7 w-7 place-items-center rounded-md border text-[11px] transition',
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

          <div className="max-h-[360px] overflow-y-auto p-1.5">
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
                const title = getNotificationDisplayText(
                  notification.title,
                  'Thông báo mới',
                );
                const message = getNotificationDisplayText(
                  notification.message,
                  'Bạn có cập nhật mới từ hệ thống.',
                );

                return (
                  <div
                    key={notification.notificationId}
                    onClick={() => void handleMarkAsRead(notification)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void handleMarkAsRead(notification);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={[
                      'group mb-1.5 flex w-full gap-2.5 rounded-lg border px-2.5 py-2 text-left shadow-sm transition last:mb-0',
                      notification.isRead
                        ? toneClasses.readCard
                        : toneClasses.unreadCard,
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[13px]',
                        toneClasses.icon,
                      ].join(' ')}
                    >
                      {renderToneIcon(tone)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={[
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            notification.isRead ? 'bg-transparent' : 'bg-rose-400',
                          ].join(' ')}
                        />
                        <span className="line-clamp-1 min-w-0 flex-1 text-[13px] font-black leading-5">
                          {title}
                        </span>
                      </span>
                      <span className="mt-0.5 block line-clamp-2 text-[11px] font-semibold leading-4 opacity-80">
                        {message}
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2">
                        <span className="block text-[10px] font-bold opacity-55">
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                        {tone === 'voucher' && isClaimableVoucherNotification(notification) ? (
                          <button
                            type="button"
                            disabled={Boolean(
                              claimingVoucherId &&
                                claimingVoucherId === getNotificationClaimKey(notification),
                            )}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleClaimVoucherNotification(notification);
                            }}
                            className="shrink-0 rounded-md bg-[#FFD166] px-3 py-1 text-[11px] font-black text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {claimingVoucherId === getNotificationClaimKey(notification)
                              ? 'Đang nhận...'
                              : 'Nhận'}
                          </button>
                        ) : null}
                      </span>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
