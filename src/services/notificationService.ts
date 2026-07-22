import api from '../lib/api';

export type NotificationItem = {
  notificationId: string;
  userId: string;
  bookingId?: string | null;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  channel: string;
  type: string;
  status: string;
};

export type PagedList<T> = {
  items: T[];
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  totalPages?: number;
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
};

export type ApiResponse<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T | null;
  errorCode?: string | null;
  errors?: Record<string, string[]> | null;
};

export type NotificationQuery = {
  isRead?: boolean;
  pageIndex?: number;
  pageSize?: number;
};

export type NotificationPage = PagedList<NotificationItem> | NotificationItem[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNotificationItem = (value: unknown): value is NotificationItem =>
  isRecord(value) && typeof value.notificationId === 'string';

const readNotificationArray = (source: unknown, keys: string[]) => {
  if (!isRecord(source)) {
    return [];
  }

  for (const key of keys) {
    const value = source[key];

    if (Array.isArray(value)) {
      return value.filter(isNotificationItem);
    }
  }

  return [];
};

export const extractNotificationItems = (
  payload: NotificationPage | null | undefined,
) => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload.filter(isNotificationItem);
  }

  const directItems = readNotificationArray(payload, [
    'items',
    'Items',
    'records',
    'Records',
  ]);

  if (directItems.length > 0) {
    return directItems;
  }

  const nestedData = (payload as Record<string, unknown>).data;

  if (Array.isArray(nestedData)) {
    return nestedData.filter(isNotificationItem);
  }

  return readNotificationArray(nestedData, ['items', 'Items', 'records', 'Records']);
};

export const notificationService = {
  getNotifications: async ({
    isRead,
    pageIndex = 1,
    pageSize = 10,
  }: NotificationQuery = {}) =>
    api.get<unknown, ApiResponse<NotificationPage>>('/api/notifications', {
      params: { isRead, pageIndex, pageSize },
    }),

  markAsRead: async (notificationIds: string[]) =>
    api.put<unknown, ApiResponse<boolean>>('/api/notifications/read', {
      notificationIds,
    }),

  markAllAsRead: async () =>
    api.put<unknown, ApiResponse<boolean>>('/api/notifications/read-all'),
};
