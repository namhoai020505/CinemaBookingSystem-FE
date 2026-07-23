import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FaBell,
  FaBroadcastTower,
  FaCheckDouble,
  FaFilter,
  FaHistory,
  FaInfoCircle,
  FaPaperPlane,
  FaSearch,
  FaSlidersH,
  FaSyncAlt,
  FaUserCheck,
  FaUsers,
} from 'react-icons/fa';
import {
  extractNotificationItems,
  notificationService,
  type FeedItem,
  type NotificationItem,
  type SendNotificationRequest,
} from '../../services/notificationService';

type ApiErrorLike = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as ApiErrorLike;
  return apiError.response?.data?.message || fallback;
};

const extractUserItems = (response: unknown): { userId: string; fullName: string; email: string }[] => {
  if (!response) return [];
  const rawPayload = (response as Record<string, unknown>).data ?? response;
  const list = Array.isArray(rawPayload)
    ? rawPayload
    : Array.isArray((rawPayload as Record<string, unknown>).items)
    ? (rawPayload as Record<string, unknown>).items
    : Array.isArray((rawPayload as Record<string, unknown>).data)
    ? (rawPayload as Record<string, unknown>).data
    : [];

  if (!Array.isArray(list)) return [];

  return list
    .map((item: unknown) => {
      if (typeof item === 'string') {
        return { userId: item, fullName: item, email: '' };
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const uId = String(obj.userId || obj.UserId || obj.id || obj.Id || '');
        const fName = String(obj.fullName || obj.FullName || obj.name || obj.Name || '');
        const mail = String(obj.email || obj.Email || '');
        return { userId: uId, fullName: fName, email: mail };
      }
      return null;
    })
    .filter((u): u is { userId: string; fullName: string; email: string } => Boolean(u && u.userId));
};



export default function ManageNotifications() {
  const context = useOutletContext<{ isLightMode?: boolean }>() || {};
  const isLightMode = context.isLightMode ?? false;
  const location = useLocation();
  const isManager = location.pathname.startsWith('/manager');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'send' | 'list' | 'feeds'>('send');

  // Notification List State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [readFilter, setReadFilter] = useState<string>('ALL'); // ALL, READ, UNREAD
  const [pageIndex, setPageIndex] = useState(1);
  const pageSize = 12;

  // Send Notification Form State
  const [targetType, setTargetType] = useState<'GROUP' | 'SINGLE'>('GROUP');
  const [formData, setFormData] = useState<SendNotificationRequest>({
    targetGroup: isManager ? 'STAFF' : 'ALL',
    userId: '',
    userIds: [],
    bookingId: '',
    isFlagged: false,
    hasBooked: false,
    roomId: '',
    showtimeId: '',
    movieId: '',
    title: '',
    message: '',
    channel: 'App',
    type: 'Promotional',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Internal Operational Feed State
  const [internalFeed, setInternalFeed] = useState<FeedItem[]>([]);
  const [loadingFeeds, setLoadingFeeds] = useState(false);

  // Filter Modal State & User Matches
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState({
    isFlagged: false,
    hasBooked: false,
    roomId: '',
    showtimeId: '',
    movieId: '',
  });
  const [matchedUsers, setMatchedUsers] = useState<
    { userId: string; fullName: string; email: string; role?: string }[]
  >([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Load Data
  useEffect(() => {
    fetchNotifications();
    fetchFeeds();
  }, [pageIndex, readFilter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const isReadParam =
        readFilter === 'READ' ? true : readFilter === 'UNREAD' ? false : undefined;
      const res = await notificationService.getNotifications({
        isRead: isReadParam,
        pageIndex,
        pageSize,
      });

      if (res && res.data) {
        const items = extractNotificationItems(res.data);
        setNotifications(items);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể tải danh sách thông báo.'));
    } finally {
      setLoading(false);
    }
  };

  const fetchFeeds = async () => {
    try {
      setLoadingFeeds(true);
      const res = await notificationService.getInternalFeed();
      if (res && res.data) {
        setInternalFeed(Array.isArray(res.data) ? res.data : [res.data]);
      }
    } catch {
      // Ignore background feed fetch error quietly
    } finally {
      setLoadingFeeds(false);
    }
  };

  // Form Input Change
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Send Notification Submit
  const handleSubmitSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Vui lòng nhập Tiêu đề thông báo.');
      return;
    }
    if (!formData.message.trim()) {
      toast.error('Vui lòng nhập Nội dung thông báo.');
      return;
    }

    const payload: SendNotificationRequest = {
      title: formData.title.trim(),
      message: formData.message.trim(),
      channel: formData.channel || 'App',
      type: formData.type || 'Transactional',
      bookingId: formData.bookingId?.trim() || null,
      isFlagged: formData.isFlagged || false,
      hasBooked: formData.hasBooked || false,
      roomId: formData.roomId?.trim() || null,
      showtimeId: formData.showtimeId?.trim() || null,
      movieId: formData.movieId?.trim() || null,
    };

    if (targetType === 'GROUP') {
      payload.targetGroup = formData.targetGroup || (isManager ? 'STAFF' : 'ALL');
    } else if (targetType === 'SINGLE') {
      const rawUserId = formData.userId?.trim() || '';
      if (
        !rawUserId &&
        !formData.isFlagged &&
        !formData.hasBooked &&
        !formData.roomId &&
        !formData.showtimeId &&
        !formData.movieId
      ) {
        toast.error('Vui lòng nhập User ID người nhận hoặc sử dụng bộ lọc điều kiện.');
        return;
      }
      if (rawUserId.includes(',')) {
        payload.userIds = rawUserId.split(',').map((s) => s.trim()).filter(Boolean);
      } else if (rawUserId) {
        payload.userId = rawUserId;
      }
    }

    try {
      setIsSubmitting(true);
      const res = await notificationService.sendNotification(payload);
      if (res.success) {
        toast.success(res.message || 'Phát thông báo thành công!');
        // Reset form
        setFormData((prev) => ({
          ...prev,
          title: '',
          message: '',
          bookingId: '',
        }));
        fetchNotifications();
        setActiveTab('list');
      } else {
        toast.error(res.message || 'Gửi thông báo thất bại.');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Lỗi hệ thống khi gửi thông báo.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      const res = await notificationService.markAllAsRead();
      if (res.success) {
        toast.success('Đã đánh dấu tất cả thông báo là ĐÃ ĐỌC.');
        fetchNotifications();
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Thao tác thất bại.'));
    }
  };

  // Filtered Notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      const matchSearch =
        !searchTerm.trim() ||
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.userId && item.userId.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchChannel =
        channelFilter === 'ALL' ||
        item.channel?.toUpperCase() === channelFilter.toUpperCase();

      const matchType =
        typeFilter === 'ALL' || item.type?.toUpperCase() === typeFilter.toUpperCase();

      return matchSearch && matchChannel && matchType;
    });
  }, [notifications, searchTerm, channelFilter, typeFilter]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  return (
    <div
      className={`min-h-screen p-4 sm:p-6 lg:p-8 font-['Urbanist'] transition-colors duration-300 ${
        isLightMode ? 'bg-slate-50 text-slate-900' : 'bg-[#070D18] text-white'
      }`}
    >
      {/* Header Banner */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/20">
              <FaBroadcastTower className="text-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                Quản lý Thông báo (Notification Center)
              </h1>
              <p
                className={`text-xs font-semibold sm:text-sm ${
                  isLightMode ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                Gửi thông báo hệ thống, quản lý tin nhắn nội bộ và theo dõi nguồn tin vận hành rạp
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div
          className={`rounded-2xl border p-5 transition-all ${
            isLightMode
              ? 'border-slate-200 bg-white shadow-sm'
              : 'border-white/10 bg-[#0B1528]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                isLightMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Tổng số thông báo
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500/10 text-blue-500">
              <FaBell />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black">{notifications.length}</div>
          <div
            className={`mt-1 text-xs ${
              isLightMode ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            Tin nhắn trang hiện tại
          </div>
        </div>

        <div
          className={`rounded-2xl border p-5 transition-all ${
            isLightMode
              ? 'border-slate-200 bg-white shadow-sm'
              : 'border-white/10 bg-[#0B1528]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                isLightMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Chưa đọc (Unread)
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-500">
              <FaInfoCircle />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-amber-500">{unreadCount}</div>
          <div
            className={`mt-1 text-xs ${
              isLightMode ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            Thông báo chưa xác nhận
          </div>
        </div>

        <div
          className={`rounded-2xl border p-5 transition-all ${
            isLightMode
              ? 'border-slate-200 bg-white shadow-sm'
              : 'border-white/10 bg-[#0B1528]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                isLightMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Tin vận hành nội bộ
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <FaBroadcastTower />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-emerald-400">
            {internalFeed.length}
          </div>
          <div
            className={`mt-1 text-xs ${
              isLightMode ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            Internal Operational Feed
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6 flex border-b border-slate-200 dark:border-white/10">
        <button
          onClick={() => setActiveTab('send')}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-bold transition-all ${
            activeTab === 'send'
              ? 'border-blue-500 text-blue-500'
              : isLightMode
                ? 'border-transparent text-slate-500 hover:text-slate-900'
                : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <FaPaperPlane />
          <span>Gửi Thông Báo Mới</span>
        </button>

        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-bold transition-all ${
            activeTab === 'list'
              ? 'border-blue-500 text-blue-500'
              : isLightMode
                ? 'border-transparent text-slate-500 hover:text-slate-900'
                : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <FaHistory />
          <span>Lịch Sử & Danh Sách Thông Báo</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-slate-950">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('feeds')}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-bold transition-all ${
            activeTab === 'feeds'
              ? 'border-blue-500 text-blue-500'
              : isLightMode
                ? 'border-transparent text-slate-500 hover:text-slate-900'
                : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <FaBroadcastTower />
          <span>Nguồn Tin Vận Hành Nội Bộ</span>
        </button>
      </div>

      {/* TAB 1: SEND NOTIFICATION FORM */}
      {activeTab === 'send' && (
        <div className="w-full">
          {/* Main Form */}
          <div
            className={`w-full rounded-2xl border p-6 ${
              isLightMode
                ? 'border-slate-200 bg-white shadow-sm'
                : 'border-white/10 bg-[#0B1528]'
            }`}
          >
            <h2 className="mb-4 text-lg font-black tracking-tight">
              Tạo & Gửi Thông Báo Mới
            </h2>

            <form onSubmit={handleSubmitSend} className="space-y-5">
              {/* Target Type Selector */}
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">
                  1. Chọn Đối tượng Nhận (Target Audience)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTargetType('GROUP')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition-all ${
                      targetType === 'GROUP'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-500 shadow-sm'
                        : isLightMode
                          ? 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <FaUsers />
                    <span>Nhóm người dùng</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('SINGLE')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition-all ${
                      targetType === 'SINGLE'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-500 shadow-sm'
                        : isLightMode
                          ? 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <FaUserCheck />
                    <span>User riêng lẻ</span>
                  </button>
                </div>
              </div>

              {/* Target Group Select */}
              {targetType === 'GROUP' && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold">
                    Chọn Nhóm Người Dùng (Target Group)
                  </label>
                  <select
                    name="targetGroup"
                    value={formData.targetGroup || (isManager ? 'STAFF' : 'ALL')}
                    onChange={handleInputChange}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-semibold outline-none transition-all ${
                      isLightMode
                        ? 'border-slate-300 bg-white text-slate-900 focus:border-blue-500'
                        : 'border-white/10 bg-slate-900 text-white focus:border-blue-500'
                    }`}
                  >
                    {!isManager && <option value="ALL">Tất cả người dùng (ALL)</option>}
                    <option value="STAFF">Nhân viên rạp (STAFF)</option>
                    <option value="CUSTOMERS">Khách hàng (CUSTOMERS)</option>
                    {!isManager && <option value="MANAGERS">Quản lý rạp (MANAGERS)</option>}
                  </select>
                </div>
              )}

              {/* Single User ID Input with 3-bars Filter Button */}
              {targetType === 'SINGLE' && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold">
                    Nhập User ID Người Nhận
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      name="userId"
                      placeholder="Nhập User ID (VD: usr-c8d9e2a1-...) hoặc nhấn nút bộ lọc bên cạnh"
                      value={formData.userId || ''}
                      onChange={handleInputChange}
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-all ${
                        isLightMode
                          ? 'border-slate-300 bg-white text-slate-900 focus:border-blue-500'
                          : 'border-white/10 bg-slate-900 text-white focus:border-blue-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setTempFilters({
                          isFlagged: !!formData.isFlagged,
                          hasBooked: !!formData.hasBooked,
                          roomId: formData.roomId || '',
                          showtimeId: formData.showtimeId || '',
                          movieId: formData.movieId || '',
                        });
                        setIsFilterModalOpen(true);
                      }}
                      title="Mở bộ lọc điều kiện người dùng"
                      className={`flex h-10 w-11 shrink-0 items-center justify-center rounded-xl border transition-all ${
                        formData.isFlagged ||
                        formData.hasBooked ||
                        formData.roomId ||
                        formData.showtimeId ||
                        formData.movieId
                          ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400 font-bold'
                          : isLightMode
                          ? 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <FaSlidersH className="text-base" />
                    </button>
                  </div>

                  {/* Active Filter Badges & Quick Auto-Fill */}
                  {(formData.isFlagged ||
                    formData.hasBooked ||
                    formData.roomId ||
                    formData.showtimeId ||
                    formData.movieId) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                      <span className="text-slate-400">Bộ lọc đang áp dụng:</span>
                      {formData.isFlagged && (
                        <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-red-400 border border-red-500/20">
                          User bị Flag
                        </span>
                      )}
                      {formData.hasBooked && (
                        <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-blue-400 border border-blue-500/20">
                          Đã từng đặt vé
                        </span>
                      )}
                      {formData.roomId && (
                        <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-amber-400 border border-amber-500/20">
                          Phòng: {formData.roomId}
                        </span>
                      )}
                      {formData.showtimeId && (
                        <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-emerald-400 border border-emerald-500/20">
                          Suất chiếu: {formData.showtimeId}
                        </span>
                      )}
                      {formData.movieId && (
                        <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-purple-400 border border-purple-500/20">
                          Phim: {formData.movieId}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setIsSearchingUsers(true);
                            const res = await notificationService.getFilteredUsers({
                              isFlagged: formData.isFlagged || undefined,
                              hasBooked: formData.hasBooked || undefined,
                              roomId: formData.roomId?.trim() || undefined,
                              showtimeId: formData.showtimeId?.trim() || undefined,
                              movieId: formData.movieId?.trim() || undefined,
                            });
                            const items = extractUserItems(res);
                            if (items.length === 0) {
                              toast.warning('Không tìm thấy người dùng nào khớp với bộ lọc.');
                            } else {
                              const ids = items.map((u) => u.userId).join(', ');
                              setFormData((prev) => ({ ...prev, userId: ids }));
                              toast.success(`Tự động điền ${items.length} User ID phù hợp!`);
                            }
                          } catch {
                            toast.error('Lỗi khi tra cứu danh sách người dùng.');
                          } finally {
                            setIsSearchingUsers(false);
                          }
                        }}
                        className="rounded bg-cyan-500/20 px-2 py-0.5 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 font-bold"
                      >
                        ⚡ Nạp nhanh (Auto-fill)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            isFlagged: false,
                            hasBooked: false,
                            roomId: '',
                            showtimeId: '',
                            movieId: '',
                          }));
                        }}
                        className="ml-1 text-slate-400 hover:text-red-400 underline"
                      >
                        Xóa lọc
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Channel & Type Selection */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold">Kênh Thông Báo (Channel)</label>
                  <select
                    name="channel"
                    value={formData.channel}
                    onChange={handleInputChange}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-semibold outline-none transition-all ${
                      isLightMode
                        ? 'border-slate-300 bg-white text-slate-900 focus:border-blue-500'
                        : 'border-white/10 bg-slate-900 text-white focus:border-blue-500'
                    }`}
                  >
                    <option value="App">App Notification</option>
                    <option value="Email">Email Service</option>
                    <option value="SMS">SMS Message</option>
                    <option value="Internal">Internal Staff Feed</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold">Loại Thông Báo (Type)</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-semibold outline-none transition-all ${
                      isLightMode
                        ? 'border-slate-300 bg-white text-slate-900 focus:border-blue-500'
                        : 'border-white/10 bg-slate-900 text-white focus:border-blue-500'
                    }`}
                  >
                    <option value="Transactional">Giao dịch (Transactional)</option>
                    <option value="Promotional">Khuyến mãi (Promotional)</option>
                    <option value="Loyalty">Điểm thưởng / Thành viên (Loyalty)</option>
                    <option value="Internal">Vận hành / Nội bộ (Internal)</option>
                  </select>
                </div>
              </div>

              {/* Booking ID Optional */}
              <div>
                <label className="mb-1.5 block text-xs font-bold">
                  Mã Đặt Vé Liên Quan (Booking ID - Không bắt buộc)
                </label>
                <input
                  type="text"
                  name="bookingId"
                  placeholder="VD: BKG-2026-998811"
                  value={formData.bookingId || ''}
                  onChange={handleInputChange}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-all ${
                    isLightMode
                      ? 'border-slate-300 bg-white text-slate-900 focus:border-blue-500'
                      : 'border-white/10 bg-slate-900 text-white focus:border-blue-500'
                  }`}
                />
              </div>

              {/* Title Input */}
              <div>
                <label className="mb-1.5 block text-xs font-bold">
                  Tiêu Đề Thông Báo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  maxLength={255}
                  placeholder="Nhập tiêu đề thông báo..."
                  value={formData.title}
                  onChange={handleInputChange}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-all ${
                    isLightMode
                      ? 'border-slate-300 bg-white text-slate-900 focus:border-blue-500'
                      : 'border-white/10 bg-slate-900 text-white focus:border-blue-500'
                  }`}
                />
              </div>

              {/* Message Input */}
              <div>
                <label className="mb-1.5 block text-xs font-bold">
                  Nội Dung Thông Báo <span className="text-rose-500">*</span>
                </label>
                <textarea
                  name="message"
                  rows={4}
                  maxLength={1000}
                  placeholder="Nhập nội dung chi tiết thông báo..."
                  value={formData.message}
                  onChange={handleInputChange}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-all ${
                    isLightMode
                      ? 'border-slate-300 bg-white text-slate-900 focus:border-blue-500'
                      : 'border-white/10 bg-slate-900 text-white focus:border-blue-500'
                  }`}
                />
                <div className="mt-1 text-right text-[11px] text-slate-400">
                  {formData.message.length}/1000 ký tự
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/30 transition-all hover:brightness-110 active:scale-98 disabled:opacity-50"
                >
                  <FaPaperPlane />
                  <span>{isSubmitting ? 'Đang phát thông báo...' : 'Phát Thông Báo Ngay'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: NOTIFICATION LIST & HISTORY */}
      {activeTab === 'list' && (
        <div
          className={`rounded-2xl border p-6 ${
            isLightMode
              ? 'border-slate-200 bg-white shadow-sm'
              : 'border-white/10 bg-[#0B1528]'
          }`}
        >
          {/* Filter Bar */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <div
                className={`flex flex-1 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm ${
                  isLightMode
                    ? 'border-slate-300 bg-slate-50 text-slate-900'
                    : 'border-white/10 bg-slate-900 text-white'
                }`}
              >
                <FaSearch className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tiêu đề, nội dung hoặc User ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Channel Filter */}
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <FaFilter className="text-slate-400" />
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold outline-none ${
                    isLightMode
                      ? 'border-slate-300 bg-white text-slate-900'
                      : 'border-white/10 bg-slate-900 text-white'
                  }`}
                >
                  <option value="ALL">Tất cả kênh</option>
                  <option value="App">App</option>
                  <option value="Email">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="Signage">Signage</option>
                  <option value="Internal">Internal</option>
                </select>
              </div>

              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold outline-none ${
                  isLightMode
                    ? 'border-slate-300 bg-white text-slate-900'
                    : 'border-white/10 bg-slate-900 text-white'
                }`}
              >
                <option value="ALL">Tất cả loại tin</option>
                <option value="Transactional">Transactional</option>
                <option value="Promotional">Promotional</option>
                <option value="Loyalty">Loyalty</option>
                <option value="Internal">Internal</option>
              </select>

              {/* Read Filter */}
              <select
                value={readFilter}
                onChange={(e) => setReadFilter(e.target.value)}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold outline-none ${
                  isLightMode
                    ? 'border-slate-300 bg-white text-slate-900'
                    : 'border-white/10 bg-slate-900 text-white'
                }`}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="UNREAD">Chưa đọc (Unread)</option>
                <option value="READ">Đã đọc (Read)</option>
              </select>

              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20"
              >
                <FaCheckDouble />
                <span>Đọc tất cả</span>
              </button>
            </div>
          </div>

          {/* Table View */}
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">
              <FaSyncAlt className="mx-auto mb-2 animate-spin text-2xl text-blue-500" />
              Đang tải danh sách thông báo...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Không tìm thấy thông báo nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr
                    className={`border-b font-black uppercase tracking-wider ${
                      isLightMode
                        ? 'border-slate-200 text-slate-500'
                        : 'border-white/10 text-slate-400'
                    }`}
                  >
                    <th className="py-3 px-4">Kênh & Loại</th>
                    <th className="py-3 px-4">Tiêu đề & Nội dung</th>
                    <th className="py-3 px-4">User ID / Booking</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10 font-semibold">
                  {filteredNotifications.map((item) => (
                    <tr
                      key={item.notificationId}
                      className={`transition-all ${
                        !item.isRead
                          ? isLightMode
                            ? 'bg-blue-50/60'
                            : 'bg-blue-500/10'
                          : isLightMode
                            ? 'hover:bg-slate-50'
                            : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      {/* Channel & Type */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex w-fit items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-black text-blue-400 border border-blue-500/20">
                            {item.channel || 'App'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {item.type || 'Transactional'}
                          </span>
                        </div>
                      </td>

                      {/* Title & Message */}
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="font-black text-sm text-slate-200">
                          {item.title}
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs font-normal opacity-80">
                          {item.message}
                        </div>
                      </td>

                      {/* User ID / Booking */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-[11px] text-cyan-400">
                          {item.userId ? item.userId : 'All Users'}
                        </div>
                        {item.bookingId && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            #{item.bookingId}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {item.isRead ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                            <FaCheckDouble className="text-[9px]" /> Đã đọc
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
                            <FaBell className="text-[9px]" /> Chưa đọc
                          </span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString('vi-VN')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between border-t border-slate-200 dark:border-white/10 pt-4 text-xs font-bold">
            <button
              disabled={pageIndex <= 1}
              onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-white/10 px-4 py-2 hover:bg-white/5 disabled:opacity-40"
            >
              Trang trước
            </button>
            <span>Trang {pageIndex}</span>
            <button
              disabled={notifications.length < pageSize}
              onClick={() => setPageIndex((p) => p + 1)}
              className="rounded-lg border border-white/10 px-4 py-2 hover:bg-white/5 disabled:opacity-40"
            >
              Trang tiếp
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: INTERNAL OPERATIONAL FEED */}
      {activeTab === 'feeds' && (
        <div className="w-full">
          {/* Internal Feed Card */}
          <div
            className={`rounded-2xl border p-6 ${
              isLightMode
                ? 'border-slate-200 bg-white shadow-sm'
                : 'border-white/10 bg-[#0B1528]'
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaBroadcastTower className="text-emerald-400 text-lg" />
                <h3 className="text-base font-black">Nguồn Tin Vận Hành Nội Bộ (Internal Operational Feed)</h3>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
                Staff & Manager Feed
              </span>
            </div>

            {loadingFeeds ? (
              <div className="py-8 text-center text-xs text-slate-400">Đang tải...</div>
            ) : internalFeed.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Chưa có thông tin vận hành mới.
              </div>
            ) : (
              <div className="space-y-3">
                {internalFeed.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs font-medium"
                  >
                    <div className="font-bold text-sm text-emerald-300">
                      {item.title || item.type || 'Operational Notice'}
                    </div>
                    <div className="mt-1 text-slate-300 opacity-90">
                      {item.message || item.content}
                    </div>
                    <div className="mt-2 text-[10px] text-slate-400">
                      {item.createdAt || item.timestamp
                        ? new Date(item.createdAt || item.timestamp!).toLocaleString('vi-VN')
                        : 'Vừa xong'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Condition Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl transition-all ${
              isLightMode
                ? 'border-slate-200 bg-white text-slate-900'
                : 'border-white/15 bg-slate-900 text-white'
            }`}
          >
            <div className="mb-4 flex items-center justify-between border-b pb-3 border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2 font-bold text-base">
                <FaSlidersH className="text-cyan-500" />
                <span>Bộ lọc điều kiện tìm người nhận</span>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tempFilters.isFlagged}
                    onChange={(e) =>
                      setTempFilters((prev) => ({ ...prev, isFlagged: e.target.checked }))
                    }
                    className="rounded border-slate-300"
                  />
                  <span>User bị Flag / Vi phạm Spam (IsBlocked hoặc SpamCount &gt; 0)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tempFilters.hasBooked}
                    onChange={(e) =>
                      setTempFilters((prev) => ({ ...prev, hasBooked: e.target.checked }))
                    }
                    className="rounded border-slate-300"
                  />
                  <span>User đã từng đặt vé trong hệ thống</span>
                </label>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="mb-1 block text-xs font-bold">
                    Lọc theo Mã Phòng chiếu (Room ID)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: room-01"
                    value={tempFilters.roomId}
                    onChange={(e) =>
                      setTempFilters((prev) => ({ ...prev, roomId: e.target.value }))
                    }
                    className={`w-full rounded-xl border px-3.5 py-2 text-xs outline-none ${
                      isLightMode
                        ? 'border-slate-300 bg-white text-slate-900'
                        : 'border-white/10 bg-slate-950 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold">
                    Lọc theo Mã Suất chiếu (Showtime ID)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: st-1002"
                    value={tempFilters.showtimeId}
                    onChange={(e) =>
                      setTempFilters((prev) => ({ ...prev, showtimeId: e.target.value }))
                    }
                    className={`w-full rounded-xl border px-3.5 py-2 text-xs outline-none ${
                      isLightMode
                        ? 'border-slate-300 bg-white text-slate-900'
                        : 'border-white/10 bg-slate-950 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold">
                    Lọc theo Mã Phim (Movie ID)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: mov-501"
                    value={tempFilters.movieId}
                    onChange={(e) =>
                      setTempFilters((prev) => ({ ...prev, movieId: e.target.value }))
                    }
                    className={`w-full rounded-xl border px-3.5 py-2 text-xs outline-none ${
                      isLightMode
                        ? 'border-slate-300 bg-white text-slate-900'
                        : 'border-white/10 bg-slate-950 text-white'
                    }`}
                  />
                </div>
              </div>

              {/* Matched Users Preview */}
              {matchedUsers.length > 0 && (
                <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs">
                  <div className="font-bold text-cyan-400 mb-1">
                    Kết quả tra cứu ({matchedUsers.length} người dùng phù hợp):
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {matchedUsers.slice(0, 5).map((u) => (
                      <div key={u.userId} className="flex items-center justify-between text-[11px]">
                        <span className="font-mono text-cyan-300">{u.userId}</span>
                        <span className="truncate max-w-[180px] font-semibold">{u.fullName || u.email}</span>
                      </div>
                    ))}
                    {matchedUsers.length > 5 && (
                      <div className="text-[10px] text-slate-400 italic">
                        ...và {matchedUsers.length - 5} người dùng khác
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t pt-4 border-slate-200 dark:border-white/10">
              <button
                type="button"
                disabled={isSearchingUsers}
                onClick={async () => {
                  try {
                    setIsSearchingUsers(true);
                    const res = await notificationService.getFilteredUsers({
                      isFlagged: tempFilters.isFlagged || undefined,
                      hasBooked: tempFilters.hasBooked || undefined,
                      roomId: tempFilters.roomId?.trim() || undefined,
                      showtimeId: tempFilters.showtimeId?.trim() || undefined,
                      movieId: tempFilters.movieId?.trim() || undefined,
                    });
                    const items = extractUserItems(res);
                    setMatchedUsers(items);
                    if (items.length === 0) {
                      toast.warning('Không tìm thấy người dùng nào thỏa mãn tất cả điều kiện.');
                    } else {
                      toast.info(`Tìm thấy ${items.length} người dùng thỏa điều kiện.`);
                    }
                  } catch {
                    toast.error('Không thể kiểm tra danh sách người dùng.');
                  } finally {
                    setIsSearchingUsers(false);
                  }
                }}
                className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                  isLightMode
                    ? 'border-cyan-300 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                    : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
                }`}
              >
                {isSearchingUsers ? 'Đang tra cứu...' : 'Tra cứu trước'}
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen(false)}
                  className={`rounded-xl border px-4 py-2 text-xs font-bold transition-all ${
                    isLightMode
                      ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  Hủy
                </button>

                <button
                  type="button"
                  disabled={isSearchingUsers}
                  onClick={async () => {
                    try {
                      setIsSearchingUsers(true);
                      const res = await notificationService.getFilteredUsers({
                        isFlagged: tempFilters.isFlagged || undefined,
                        hasBooked: tempFilters.hasBooked || undefined,
                        roomId: tempFilters.roomId?.trim() || undefined,
                        showtimeId: tempFilters.showtimeId?.trim() || undefined,
                        movieId: tempFilters.movieId?.trim() || undefined,
                      });

                      const users = extractUserItems(res);

                      setFormData((prev) => ({
                        ...prev,
                        isFlagged: tempFilters.isFlagged,
                        hasBooked: tempFilters.hasBooked,
                        roomId: tempFilters.roomId,
                        showtimeId: tempFilters.showtimeId,
                        movieId: tempFilters.movieId,
                      }));

                      if (users.length === 0) {
                        toast.warning('Không tìm thấy người dùng nào thỏa mãn tất cả điều kiện trên.');
                      } else {
                        const ids = users.map((u) => u.userId).join(', ');
                        setFormData((prev) => ({ ...prev, userId: ids }));
                        setTargetType('SINGLE');
                        toast.success(`Đã tự động điền ${users.length} User ID vào ô người nhận!`);
                      }

                      setIsFilterModalOpen(false);
                    } catch {
                      toast.error('Có lỗi xảy ra khi tự động điền.');
                    } finally {
                      setIsSearchingUsers(false);
                    }
                  }}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-2 text-xs font-black text-white shadow-md hover:brightness-110 disabled:opacity-50"
                >
                  {isSearchingUsers ? 'Đang xử lý...' : 'Tự động điền (Auto-fill)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
