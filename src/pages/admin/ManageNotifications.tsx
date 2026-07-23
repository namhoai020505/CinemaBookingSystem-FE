import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FaBell,
  FaBroadcastTower,
  FaCheckDouble,
  FaEnvelope,
  FaFilter,
  FaHistory,
  FaInfoCircle,
  FaMobileAlt,
  FaPaperPlane,
  FaSearch,
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

// Preset message templates for quick selection
const PRESET_TEMPLATES = [
  {
    label: 'Bảo trì hệ thống',
    targetGroup: 'ALL',
    channel: 'App',
    type: 'Internal',
    title: 'Thông báo bảo trì hệ thống định kỳ',
    message:
      'Hệ thống Cinema System sẽ tiến hành bảo trì hạ tầng vào lúc 02:00 - 04:00 ngày mai. Rất mong Quý khách và nhân viên thông cảm cho sự bất tiện này.',
  },
  {
    label: 'Tặng Voucher Ưu đãi đặc biệt',
    targetGroup: 'CUSTOMERS',
    channel: 'Email',
    type: 'Promotional',
    title: 'Bạn nhận được Voucher ưu đãi đặc biệt từ CinemaSystem!',
    message:
      'Chúc mừng bạn đã nhận được Voucher giảm giá đặc biệt. Hãy kiểm tra mục Ví Voucher của bạn trong ứng dụng để sử dụng ngay hôm nay!',
  },
  {
    label: 'Cập nhật Suất chiếu khẩn cấp',
    targetGroup: 'CUSTOMERS',
    channel: 'App',
    type: 'Transactional',
    title: 'Cập nhật quan trọng về Suất chiếu của bạn',
    message:
      'Suất chiếu phim bạn đã đặt vừa có điều chỉnh lịch chiếu. Vui lòng kiểm tra email hoặc vé xem phim của bạn để xem chi tiết hỗ trợ đền bù.',
  },
  {
    label: 'Cảnh báo vận hành phòng chiếu',
    targetGroup: 'STAFF',
    channel: 'Internal',
    type: 'Internal',
    title: 'Cảnh báo vận hành phòng chiếu khẩn cấp',
    message:
      'Yêu cầu đội ngũ Kỹ thuật và Nhân viên rạp kiểm tra lại hệ thống chiếu phim và ghế ngồi tại các phòng chiếu trước giờ mở cửa.',
  },
];

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
  const [targetType, setTargetType] = useState<'GROUP' | 'SINGLE' | 'MULTIPLE'>('GROUP');
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
  const [multipleUserIdsInput, setMultipleUserIdsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Internal Operational Feed State
  const [internalFeed, setInternalFeed] = useState<FeedItem[]>([]);
  const [loadingFeeds, setLoadingFeeds] = useState(false);

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

  // Apply Preset Template
  const handleApplyTemplate = (template: typeof PRESET_TEMPLATES[0]) => {
    setTargetType('GROUP');
    setFormData((prev) => ({
      ...prev,
      targetGroup: template.targetGroup,
      channel: template.channel,
      type: template.type,
      title: template.title,
      message: template.message,
    }));
    toast.info(`Đã áp dụng mẫu: ${template.label}`);
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
      payload.targetGroup = formData.targetGroup || 'ALL';
    } else if (targetType === 'SINGLE') {
      if (!formData.userId?.trim()) {
        toast.error('Vui lòng nhập User ID người nhận.');
        return;
      }
      payload.userId = formData.userId.trim();
    } else if (targetType === 'MULTIPLE') {
      const ids = multipleUserIdsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length === 0) {
        toast.error('Vui lòng nhập ít nhất 1 User ID người nhận (phân cách dấu phẩy).');
        return;
      }
      payload.userIds = ids;
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
        setMultipleUserIdsInput('');
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div
            className={`lg:col-span-2 rounded-2xl border p-6 ${
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
                <div className="grid grid-cols-3 gap-3">
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
                    <span>User ID đơn lẻ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType('MULTIPLE')}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold transition-all ${
                      targetType === 'MULTIPLE'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-500 shadow-sm'
                        : isLightMode
                          ? 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <FaUsers />
                    <span>Nhiều User ID</span>
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

              {/* Single User ID Input */}
              {targetType === 'SINGLE' && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold">
                    Nhập User ID Người Nhận (Không bắt buộc nếu sử dụng Bộ lọc Điều kiện phía dưới)
                  </label>
                  <input
                    type="text"
                    name="userId"
                    placeholder="VD: usr-c8d9e2a1-..."
                    value={formData.userId || ''}
                    onChange={handleInputChange}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-all ${
                      isLightMode
                        ? 'border-slate-300 bg-white text-slate-900 focus:border-blue-500'
                        : 'border-white/10 bg-slate-900 text-white focus:border-blue-500'
                    }`}
                  />
                </div>
              )}

              {/* Multiple User IDs Input */}
              {targetType === 'MULTIPLE' && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold">
                    Nhập Danh Sách User ID (phân cách bằng dấu phẩy)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="usr-001, usr-002, usr-003..."
                    value={multipleUserIdsInput}
                    onChange={(e) => setMultipleUserIdsInput(e.target.value)}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-all ${
                      isLightMode
                        ? 'border-slate-300 bg-white text-slate-900 focus:border-blue-500'
                        : 'border-white/10 bg-slate-900 text-white focus:border-blue-500'
                    }`}
                  />
                </div>
              )}

              {/* User Filter Conditions Section */}
              <div className={`rounded-xl border p-4 ${
                isLightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.03]'
              }`}>
                <label className="mb-2 block text-xs font-black uppercase tracking-wider text-cyan-400">
                  🎯 Điều kiện lọc người nhận (User Conditions)
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!formData.isFlagged}
                      onChange={(e) => setFormData((prev) => ({ ...prev, isFlagged: e.target.checked }))}
                      className="rounded border-slate-300"
                    />
                    <span>🚩 User bị Flag / Vi phạm Spam</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!formData.hasBooked}
                      onChange={(e) => setFormData((prev) => ({ ...prev, hasBooked: e.target.checked }))}
                      className="rounded border-slate-300"
                    />
                    <span>🎟️ User đã từng đặt vé</span>
                  </label>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-400">
                      Lọc theo Room ID (Phòng)
                    </label>
                    <input
                      type="text"
                      name="roomId"
                      placeholder="VD: room-01"
                      value={formData.roomId || ''}
                      onChange={handleInputChange}
                      className={`w-full rounded-lg border px-3 py-1.5 text-xs outline-none ${
                        isLightMode ? 'border-slate-300 bg-white text-slate-900' : 'border-white/10 bg-slate-900 text-white'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-400">
                      Lọc theo Showtime ID (Suất chiếu)
                    </label>
                    <input
                      type="text"
                      name="showtimeId"
                      placeholder="VD: st-1002"
                      value={formData.showtimeId || ''}
                      onChange={handleInputChange}
                      className={`w-full rounded-lg border px-3 py-1.5 text-xs outline-none ${
                        isLightMode ? 'border-slate-300 bg-white text-slate-900' : 'border-white/10 bg-slate-900 text-white'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-400">
                      Lọc theo Movie ID (Phim)
                    </label>
                    <input
                      type="text"
                      name="movieId"
                      placeholder="VD: mov-501"
                      value={formData.movieId || ''}
                      onChange={handleInputChange}
                      className={`w-full rounded-lg border px-3 py-1.5 text-xs outline-none ${
                        isLightMode ? 'border-slate-300 bg-white text-slate-900' : 'border-white/10 bg-slate-900 text-white'
                      }`}
                    />
                  </div>
                </div>
              </div>

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

          {/* Quick Preset Templates Column */}
          <div className="space-y-4">
            <div
              className={`rounded-2xl border p-5 ${
                isLightMode
                  ? 'border-slate-200 bg-white shadow-sm'
                  : 'border-white/10 bg-[#0B1528]'
              }`}
            >
              <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-cyan-500">
                Quick Templates (Mẫu nhanh)
              </h3>
              <p className="mb-4 text-xs text-slate-400">
                Nhấp vào các mẫu thông báo sẵn có dưới đây để điền nhanh nội dung:
              </p>

              <div className="space-y-2.5">
                {PRESET_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className={`w-full text-left rounded-xl border p-3 text-xs font-bold transition-all ${
                      isLightMode
                        ? 'border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-800'
                        : 'border-white/10 bg-white/5 hover:bg-blue-500/10 hover:border-blue-500/40 text-slate-200'
                    }`}
                  >
                    <div className="font-bold text-blue-400">{tmpl.label}</div>
                    <div className="mt-1 line-clamp-2 text-[11px] font-normal opacity-80">
                      {tmpl.message}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Channel Info Box */}
            <div
              className={`rounded-2xl border p-5 ${
                isLightMode
                  ? 'border-slate-200 bg-white shadow-sm'
                  : 'border-white/10 bg-[#0B1528]'
              }`}
            >
              <h3 className="mb-2 text-sm font-black text-slate-300">Hướng dẫn gửi tin</h3>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-start gap-2">
                  <FaMobileAlt className="mt-0.5 shrink-0 text-cyan-400" />
                  <span>
                    <strong>App Notification</strong>: Gửi tới ứng dụng khách hàng/nhân viên.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <FaEnvelope className="mt-0.5 shrink-0 text-blue-400" />
                  <span>
                    <strong>Email Service</strong>: Gửi thư điện tử chính thức từ hệ thống.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <FaBroadcastTower className="mt-0.5 shrink-0 text-emerald-400" />
                  <span>
                    <strong>Internal Feed</strong>: Tin tức vận hành dành cho Nhân viên & Quản lý.
                  </span>
                </li>
              </ul>
            </div>
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
    </div>
  );
}
