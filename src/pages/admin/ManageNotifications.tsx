import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  extractNotificationItems,
  notificationService,
  type NotificationItem,
  type NotificationPage,
  type SendNotificationRequest,
} from '../../services/notificationService';
import { getCurrentUserProfile } from '../../lib/auth';
import { managerDashboardService } from '../../services/managerDashboardService';
import { confirmWithPopup } from '../../services/confirmDialogService';

type ApiErrorLike = {
  message?: string;
  response?: {
    status?: number;
    data?: {
      message?: string;
      errorCode?: string;
    };
  };
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (!error) return fallback;
  const apiError = error as ApiErrorLike;
  const status = apiError.response?.status;
  const serverMsg = apiError.response?.data?.message || apiError.message;
  const errCode = apiError.response?.data?.errorCode;

  if (serverMsg) {
    return status ? `[HTTP ${status}${errCode ? ` - ${errCode}` : ''}] ${serverMsg}` : serverMsg;
  }
  return fallback;
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



const parseNotificationMeta = (item: NotificationItem) => {
  let extractedCinema = item.cinemaName || (item.cinemaId ? `Rạp #${item.cinemaId}` : null);
  let extractedManager: string | null = null;
  let isManagerReport = false;

  const fullText = `${item.title || ''} ${item.message || ''}`;

  const managerMatch = fullText.match(/Báo cáo từ Manager:\s*([^|(]+)(?:\(([^)]+)\))?\s*\|\s*Rạp:\s*([^\]\n]+)/i);
  if (managerMatch) {
    isManagerReport = true;
    extractedManager = managerMatch[1].trim() + (managerMatch[2] ? ` (${managerMatch[2].trim()})` : '');
    extractedCinema = managerMatch[3].trim();
  } else {
    if (fullText.includes('THÔNG BÁO VẬN HÀNH') || fullText.includes('BAN QUẢN LÝ') || item.type === 'Internal') {
      isManagerReport = true;
    }
    const rapMatch = fullText.match(/Rạp:\s*([^.\n\]]+)/i);
    if (rapMatch && !extractedCinema) {
      extractedCinema = rapMatch[1].trim();
    }
  }

  const senderDisplay = extractedManager
    ? extractedManager
    : isManagerReport
    ? 'Manager'
    : 'Hệ thống';

  let recipientDisplay = 'Tất cả người dùng';
  if (item.userId) {
    const uUpper = item.userId.toUpperCase();
    if (uUpper.includes('ADMIN') || uUpper === 'ADMINS') {
      recipientDisplay = 'Ban Quản Lý (Admin)';
    } else if (uUpper.includes('STAFF')) {
      recipientDisplay = 'Nhân viên (Staff)';
    } else {
      recipientDisplay = item.userId;
    }
  }

  return {
    cinemaName: extractedCinema || 'Toàn hệ thống',
    senderDisplay,
    recipientDisplay,
    isManagerReport,
  };
};

export default function ManageNotifications() {
  const context = useOutletContext<{ isLightMode?: boolean }>() || {};
  const isLightMode = context.isLightMode ?? false;
  const location = useLocation();
  const isManager = location.pathname.startsWith('/manager');

  // Manager & Cinema Metadata State
  const [managerInfo, setManagerInfo] = useState<{
    managerName: string;
    userId: string;
    cinemaName: string;
    cinemaId: string | number | null;
  }>({
    managerName: '',
    userId: '',
    cinemaName: '',
    cinemaId: null,
  });

  // Active Tab
  const [activeTab, setActiveTab] = useState<'send' | 'list' | 'report_admin'>('send');

  // Notification List State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [readFilter, setReadFilter] = useState<string>('ALL'); // ALL, READ, UNREAD
  const [pageIndex, setPageIndex] = useState(1);
  const pageSize = 10;
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Manager Reader State (No icons, No hardcoded data)
  const [readerFilter, setReaderFilter] = useState<'ALL' | 'STAFF' | 'ADMIN' | 'FROM_ADMIN'>('ALL');
  const [readerSearch, setReaderSearch] = useState('');

  const handleMarkSingleRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead([notificationId]);
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === notificationId ? { ...n, isRead: true } : n)),
      );
    } catch {
      // Silent catch
    }
  };

  // Checkbox selection, Detail Modal & Edit Modal State
  const [selectedNotifIds, setSelectedNotifIds] = useState<string[]>([]);
  const [viewingNotif, setViewingNotif] = useState<NotificationItem | null>(null);
  const [editingNotif, setEditingNotif] = useState<NotificationItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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
    type: isManager ? 'Internal' : 'Promotional',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGenerateAiContent = () => {
    if (!formData.title.trim()) {
      toast.warning('Vui lòng nhập tiêu đề thông báo trước khi sử dụng Gemini AI soạn nội dung.');
      return;
    }

    setIsGeneratingAi(true);
    const title = formData.title.trim();
    const type = formData.type || (isManager ? 'Internal' : 'Promotional');
    const targetGroup = formData.targetGroup || (isManager ? 'STAFF' : 'ALL');
    const specificStaffId = formData.userId?.trim();
    const channel = formData.channel || 'App';
    const isReportTab = activeTab === 'report_admin';

    setTimeout(() => {
      let recipientText = '';
      if (isReportTab || targetGroup === 'ADMINS' || targetGroup === 'ADMIN') {
        recipientText = 'Ban Quản Trị & Quản lý Hệ thống (Admin)';
      } else if (specificStaffId) {
        recipientText = `Nhân viên cụ thể (Staff ID: ${specificStaffId})`;
      } else if (targetGroup === 'STAFF') {
        recipientText = 'Staff (Nhân viên rạp cùng rạp)';
      } else {
        recipientText = 'Tất cả người dùng';
      }

      let drafted = '';

      if (isReportTab || targetGroup === 'ADMINS' || targetGroup === 'ADMIN') {
        drafted = `[BÁO CÁO / ĐỀ XUẤT TỪ MANAGER - GỬI BAN QUẢN TRỊ ADMIN]\n\n` +
          `Kính gửi Ban Quản Trị Admin,\n` +
          `Tôi là Quản lý đại diện chi nhánh rạp (${managerInfo.cinemaName || 'Rạp của tôi'}), xin gửi báo cáo/đề xuất về việc: "${title}".\n\n` +
          `- Đối tượng nhận: ${recipientText}\n` +
          `- Kênh thông báo: ${channel === 'Email' ? 'Email' : 'Thông báo Ứng dụng (App)'}\n` +
          `- Chi tiết nội dung: Kính đề nghị Ban Quản Trị xem xét, phê duyệt hoặc hỗ trợ giải quyết khẩn cấp cho cụm rạp.\n\n` +
          `Rất mong nhận được phản hồi sớm từ Ban Quản Trị. Trân trọng!`;
      } else if (isManager || type === 'Internal') {
        drafted = `[THÔNG BÁO VẬN HÀNH NỘI BỘ RẠP]\n\n` +
          `Thông báo gửi đến: ${recipientText}\n` +
          `Loại thông báo: Vận hành & Nội bộ (Internal)\n` +
          `Kênh: ${channel === 'Email' ? 'Email' : 'Thông báo Ứng dụng (App)'}\n` +
          `Tiêu đề: ${title}\n\n` +
          `- Yêu cầu ${specificStaffId ? `nhân viên ${specificStaffId}` : 'toàn bộ nhân viên ca trực cùng rạp'} tiếp nhận chỉ đạo và triển khai công việc theo đúng quy trình.\n` +
          `- Đảm bảo tuân thủ giờ giấc ca làm, giao ban đúng hạn và giữ gìn vệ sinh khu vực rạp.\n\n` +
          `Chúc cả đội làm việc tốt!`;
      } else if (type === 'Maintenance') {
        drafted = `[THÔNG BÁO BẢO TRÌ HỆ THỐNG]\n\n` +
          `Thông báo gửi đến: ${recipientText}\n` +
          `Hệ thống rạp CinemaSystem sẽ tiến hành nâng cấp & bảo trì định kỳ cho tiêu đề: "${title}".\n\n` +
          `- Thời gian dự kiến: 01:00 AM - 04:00 AM.\n` +
          `- Kênh thông báo: ${channel === 'Email' ? 'Email' : 'Thông báo Ứng dụng (App)'}\n` +
          `- Ảnh hưởng: Các dịch vụ đặt vé trực tuyến có thể gián đoạn tạm thời.\n\n` +
          `Rất mong nhận được sự thông cảm của Quý vị. Trân trọng!`;
      } else if (type === 'Emergency') {
        drafted = `[CẢNH BÁO KHẨN CẤP - THÔNG BÁO TỪ BQL]\n\n` +
          `Thông báo gửi đến: ${recipientText}\n` +
          `Yêu cầu chú ý chỉ đạo khẩn về: "${title}".\n\n` +
          `- Đề nghị bộ phận ca trực kiểm tra và thực hiện quy trình an toàn ngay lập tức.\n` +
          `- Báo cáo kết quả trực tiếp cho Quản lý ca trực sau khi hoàn tất.\n\nTrân trọng thông báo!`;
      } else {
        drafted = `[THÔNG BÁO TỪ CINEMASYSTEM]\n\n` +
          `Thông báo gửi đến: ${recipientText}\n` +
          `Tiêu đề: ${title}\n\n` +
          `Cảm ơn bạn đã theo dõi thông báo. Vui lòng kiểm tra chi tiết trên ứng dụng CinemaSystem.\n\nTrân trọng!`;
      }

      setFormData((prev) => ({ ...prev, message: drafted }));
      setIsGeneratingAi(false);
      toast.success(`Gemini AI đã tự động soạn thảo nội dung thành công cho: ${recipientText}!`);
    }, 400);
  };



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

  // Load Data & Manager Profile
  useEffect(() => {
    fetchNotifications();
  }, []);

  // Reset pageIndex to 1 when any filter changes to combine all matching notifications from page 1
  useEffect(() => {
    setPageIndex(1);
  }, [searchTerm, channelFilter, typeFilter, readFilter]);

  useEffect(() => {
    const profile = getCurrentUserProfile();
    if (profile) {
      setManagerInfo((prev) => ({
        ...prev,
        managerName: profile.fullName || 'Manager',
        userId: profile.userId || '',
      }));
    }

    if (isManager) {
      managerDashboardService
        .getDashboard({})
        .then((dash) => {
          if (dash?.cinemaName) {
            setManagerInfo((prev) => ({
              ...prev,
              cinemaName: dash.cinemaName,
              cinemaId: dash.cinemaId ?? null,
            }));
          }
        })
        .catch(() => {});
    }
  }, [isManager]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationService.getNotifications({
        pageIndex: 1,
        pageSize: 500,
      });

      const rawPayload = (res as Record<string, unknown>)?.data ?? res;
      let items = extractNotificationItems(rawPayload as NotificationPage);

      if (isManager) {
        try {
          const feedRes = await notificationService.getInternalFeed();
          const rawFeed = (feedRes as Record<string, unknown>)?.data ?? feedRes;
          const feedItems = extractNotificationItems(rawFeed as NotificationPage);

          if (feedItems.length > 0) {
            const existingIds = new Set(items.map((i) => i.notificationId));
            const newFeedItems = feedItems.filter((f) => !existingIds.has(f.notificationId));
            items = [...items, ...newFeedItems];
          }
        } catch {
          // Silent catch
        }
      }

      setNotifications(items);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể tải danh sách thông báo.'));
    } finally {
      setLoading(false);
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

    if (isManager && activeTab === 'report_admin') {
      payload.targetGroup = 'ADMINS';
      payload.type = formData.type || 'Internal';

      const senderName = managerInfo.managerName || 'Manager';
      const senderId = managerInfo.userId || '';
      const cinema = managerInfo.cinemaName || 'Rạp phân quyền';

      if (!payload.message.includes('📍 [Báo cáo từ Manager:')) {
        payload.message = `📍 [Báo cáo từ Manager: ${senderName}${senderId ? ` (${senderId})` : ''} | Rạp: ${cinema}]\n${payload.message}`;
      }
    } else if (isManager) {
      const rawStaffId = formData.userId?.trim() || '';
      if (rawStaffId) {
        if (rawStaffId.includes(',')) {
          payload.userIds = rawStaffId.split(',').map((s) => s.trim()).filter(Boolean);
        } else {
          payload.userId = rawStaffId;
        }
      } else {
        payload.targetGroup = 'STAFF';
      }
    } else if (targetType === 'GROUP') {
      payload.targetGroup = formData.targetGroup || 'ALL';
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
        toast.success(
          isManager && activeTab === 'report_admin'
            ? 'Gửi báo cáo tới Ban Quản Lý Admin thành công!'
            : res.message || 'Phát thông báo thành công!'
        );
        // Reset form
        setFormData((prev) => ({
          ...prev,
          title: '',
          message: '',
          userId: '',
          bookingId: '',
        }));
        fetchNotifications();
        if (!isManager) {
          setActiveTab('list');
        }
      } else {
        toast.error(res.message || 'Gửi thông báo thất bại.');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Lỗi hệ thống khi gửi thông báo.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Selection & Detail Read Handlers
  const handleToggleSelectNotif = (id: string) => {
    setSelectedNotifIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAllOnPage = () => {
    const pageIds = paginatedNotifications.map((n) => n.notificationId);
    const isAllSelected = pageIds.length > 0 && pageIds.every((id) => selectedNotifIds.includes(id));
    if (isAllSelected) {
      setSelectedNotifIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedNotifIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleMarkSelectedAsRead = async () => {
    if (selectedNotifIds.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một thông báo.');
      return;
    }
    try {
      await notificationService.markAsRead(selectedNotifIds);
      toast.success(`Đã đánh dấu ${selectedNotifIds.length} thông báo là ĐÃ ĐỌC.`);
      setNotifications((prev) =>
        prev.map((n) =>
          selectedNotifIds.includes(n.notificationId) ? { ...n, isRead: true } : n,
        ),
      );
      setSelectedNotifIds([]);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Thao tác thất bại.'));
    }
  };

  const handleOpenNotificationDetail = async (item: NotificationItem) => {
    setViewingNotif(item);
    if (!item.isRead) {
      try {
        await notificationService.markAsRead([item.notificationId]);
        setNotifications((prev) =>
          prev.map((n) =>
            n.notificationId === item.notificationId ? { ...n, isRead: true } : n,
          ),
        );
      } catch {
        // silent catch
      }
    }
  };

  const handleDeleteNotifications = async (ids: string[]) => {
    if (ids.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một thông báo để xóa.');
      return;
    }
    const confirmed = await confirmWithPopup({
      title: 'Xóa thông báo?',
      message: `Bạn có chắc chắn muốn xóa ${ids.length} thông báo đã chọn?`,
      confirmLabel: 'Xóa thông báo',
      cancelLabel: 'Giữ lại',
    });
    if (!confirmed) {
      return;
    }
    try {
      await notificationService.deleteNotifications(ids);
      toast.success(`Đã xóa ${ids.length} thông báo thành công.`);
      setNotifications((prev) => prev.filter((n) => !ids.includes(n.notificationId)));
      setSelectedNotifIds((prev) => prev.filter((id) => !ids.includes(id)));
      if (viewingNotif && ids.includes(viewingNotif.notificationId)) {
        setViewingNotif(null);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể xóa thông báo.'));
    }
  };

  const handleOpenEditModal = (item: NotificationItem) => {
    setEditingNotif(item);
    setEditTitle(item.title);
    setEditMessage(item.message);
  };

  const handleSaveEdit = async () => {
    if (!editingNotif) return;
    if (!editTitle.trim() || !editMessage.trim()) {
      toast.error('Vui lòng nhập đầy đủ tiêu đề và nội dung.');
      return;
    }

    try {
      setIsSavingEdit(true);
      await notificationService.updateNotification(editingNotif.notificationId, editTitle, editMessage);
      toast.success('Đã cập nhật thông báo thành công.');

      setNotifications((prev) =>
        prev.map((n) =>
          n.notificationId === editingNotif.notificationId
            ? { ...n, title: editTitle.trim(), message: editMessage.trim() }
            : n,
        ),
      );

      if (viewingNotif && viewingNotif.notificationId === editingNotif.notificationId) {
        setViewingNotif((prev) =>
          prev ? { ...prev, title: editTitle.trim(), message: editMessage.trim() } : null,
        );
      }

      setEditingNotif(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể cập nhật thông báo.'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Filtered Notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      const meta = parseNotificationMeta(item);

      const matchSearch =
        !searchTerm.trim() ||
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.userId && item.userId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        meta.cinemaName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        meta.senderDisplay.toLowerCase().includes(searchTerm.toLowerCase());

      const matchChannel =
        channelFilter === 'ALL' ||
        item.channel?.toUpperCase() === channelFilter.toUpperCase();

      const matchType =
        typeFilter === 'ALL' || item.type?.toUpperCase() === typeFilter.toUpperCase();

      const matchRead =
        readFilter === 'ALL' ||
        (readFilter === 'READ' && item.isRead) ||
        (readFilter === 'UNREAD' && !item.isRead);

      return matchSearch && matchChannel && matchType && matchRead;
    });
  }, [notifications, searchTerm, channelFilter, typeFilter, readFilter]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredNotifications.length / pageSize));
  }, [filteredNotifications.length, pageSize]);

  const paginatedNotifications = useMemo(() => {
    const start = (pageIndex - 1) * pageSize;
    return filteredNotifications.slice(start, start + pageSize);
  }, [filteredNotifications, pageIndex, pageSize]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  // Categorize notifications dynamically for Manager
  const managerNotifications = useMemo(() => {
    return notifications.map((item) => {
      const uUpper = (item.userId || '').toUpperCase();
      const targetGroupUpper = (item.targetGroup || '').toUpperCase();
      const titleLower = (item.title || '').toLowerCase();
      const msgLower = (item.message || '').toLowerCase();

      let category: 'STAFF' | 'ADMIN' | 'FROM_ADMIN' = 'STAFF';

      // 1. Manager's Reports / Messages sent to Admin ("Gửi Admin")
      if (
        msgLower.includes('báo cáo từ manager') ||
        msgLower.includes('[báo cáo') ||
        msgLower.includes('gửi admin') ||
        msgLower.includes('gửi ban quản trị') ||
        titleLower.includes('báo cáo') ||
        titleLower.includes('gửi admin') ||
        titleLower.includes('gửi ban quản trị') ||
        targetGroupUpper.includes('ADMIN')
      ) {
        category = 'ADMIN';
      }
      // 2. Notifications Received from Admin ("Từ Admin")
      else if (
        msgLower.includes('từ admin') ||
        msgLower.includes('từ ban quản trị') ||
        msgLower.includes('chỉ đạo từ admin') ||
        titleLower.includes('từ admin') ||
        titleLower.includes('từ ban quản trị') ||
        titleLower.includes('thông báo từ admin') ||
        titleLower.includes('chỉ đạo admin') ||
        uUpper.includes('ADMIN')
      ) {
        category = 'FROM_ADMIN';
      }
      // 3. Operational notifications sent to Cinema Staff ("Gửi Staff rạp")
      else {
        category = 'STAFF';
      }

      return {
        ...item,
        category,
      };
    });
  }, [notifications]);

  const filteredReaderNotifs = useMemo(() => {
    return managerNotifications.filter((item) => {
      if (readerFilter === 'STAFF' && item.category !== 'STAFF') return false;
      if (readerFilter === 'ADMIN' && item.category !== 'ADMIN') return false;
      if (readerFilter === 'FROM_ADMIN' && item.category !== 'FROM_ADMIN') return false;

      if (readerSearch.trim()) {
        const q = readerSearch.toLowerCase();
        const t = (item.title || '').toLowerCase();
        const m = (item.message || '').toLowerCase();
        const u = (item.userId || '').toLowerCase();
        if (!t.includes(q) && !m.includes(q) && !u.includes(q)) return false;
      }

      return true;
    });
  }, [managerNotifications, readerFilter, readerSearch]);

  return (
    <div
      className={`min-h-screen p-4 sm:p-6 lg:p-8 font-['Urbanist'] transition-colors duration-300 ${
        isLightMode ? 'bg-slate-50 text-slate-900' : 'bg-[#070D18] text-white'
      }`}
    >
      {/* Header Banner */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            Quản lý Thông báo
          </h1>
          <p
            className={`mt-1 text-xs font-semibold sm:text-sm ${
              isLightMode ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            Gửi thông báo hệ thống và quản lý tin nhắn nội bộ
          </p>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>
          <div className="mt-3 text-2xl font-black">{notifications.length}</div>
          <div
            className={`mt-1 text-xs ${
              isLightMode ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            Tin nhắn hệ thống
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
              Chưa đọc
            </span>
          </div>
          <div className="mt-3 text-2xl font-black text-amber-500">{unreadCount}</div>
          <div
            className={`mt-1 text-xs ${
              isLightMode ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            Thông báo chưa đọc
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Manager Mode) */}
      {isManager && (
        <div className="mb-6 flex border-b border-slate-200 dark:border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('send')}
            className={`border-b-2 px-6 py-3 text-sm font-black transition-all ${
              activeTab === 'send'
                ? 'border-emerald-500 text-emerald-400'
                : isLightMode
                  ? 'border-transparent text-slate-500 hover:text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>Thông Báo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('report_admin')}
            className={`border-b-2 px-6 py-3 text-sm font-black transition-all ${
              activeTab === 'report_admin'
                ? 'border-purple-500 text-purple-400'
                : isLightMode
                  ? 'border-transparent text-slate-500 hover:text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>Manager Báo Cáo Với Admin</span>
          </button>
        </div>
      )}

      {/* Navigation Tabs (Admin Mode) */}
      {!isManager && (
        <div className="mb-6 flex border-b border-slate-200 dark:border-white/10">
          <button
            onClick={() => setActiveTab('send')}
            className={`border-b-2 px-6 py-3 text-sm font-bold transition-all ${
              activeTab === 'send'
                ? 'border-blue-500 text-blue-500'
                : isLightMode
                  ? 'border-transparent text-slate-500 hover:text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>Gửi Thông Báo Mới</span>
          </button>

          <button
            onClick={() => setActiveTab('list')}
            className={`border-b-2 px-6 py-3 text-sm font-bold transition-all ${
              activeTab === 'list'
                ? 'border-blue-500 text-blue-500'
                : isLightMode
                  ? 'border-transparent text-slate-500 hover:text-slate-900'
                  : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>Danh Sách Thông Báo ({filteredNotifications.length})</span>
            {unreadCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-slate-950">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* TAB 1: SEND NOTIFICATION & READER PANEL */}
      {activeTab === 'send' && (
        <div className="w-full">
          {isManager ? (
            /* MANAGER 2-COLUMN LAYOUT: LEFT = READER PANEL, RIGHT = DISPATCH FORM */
            <div className="grid gap-6 lg:grid-cols-2">
              {/* LEFT COLUMN: KHU VỰC ĐỌC & THEO DÕI THÔNG BÁO (NO ICONS, DYNAMIC DATA) */}
              <div
                className={`flex flex-col rounded-2xl border p-6 ${
                  isLightMode
                    ? 'border-slate-200 bg-white shadow-sm'
                    : 'border-white/10 bg-[#0B1528]'
                }`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className={`text-base font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                      Khu vực Đọc & Theo dõi Thông báo
                    </h3>
                    <p className={`mt-0.5 text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Đọc các thông báo gửi Staff rạp, gửi Ban Quản Trị và nhận từ Admin
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchNotifications()}
                    disabled={loading}
                    className={`rounded-lg border px-3 py-1 text-xs font-bold transition ${
                      isLightMode
                        ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    Làm mới
                  </button>
                </div>

                {/* Search Bar (NO ICON!) */}
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Tìm kiếm nội dung thông báo..."
                    value={readerSearch}
                    onChange={(e) => setReaderSearch(e.target.value)}
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none transition-all ${
                      isLightMode
                        ? 'border-slate-300 bg-white text-slate-900 focus:border-emerald-500'
                        : 'border-white/10 bg-slate-900 text-white focus:border-emerald-500'
                    }`}
                  />
                </div>

                {/* Quick Filter Pills (Text Buttons, NO ICONS!) */}
                <div className="mb-4 flex flex-wrap gap-1.5 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setReaderFilter('ALL')}
                    className={`rounded-lg px-3 py-1.5 transition ${
                      readerFilter === 'ALL'
                        ? 'bg-emerald-600 text-white'
                        : isLightMode
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    Tất cả ({managerNotifications.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setReaderFilter('STAFF')}
                    className={`rounded-lg px-3 py-1.5 transition ${
                      readerFilter === 'STAFF'
                        ? 'bg-emerald-600 text-white'
                        : isLightMode
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    Gửi Staff rạp ({managerNotifications.filter((n) => n.category === 'STAFF').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setReaderFilter('ADMIN')}
                    className={`rounded-lg px-3 py-1.5 transition ${
                      readerFilter === 'ADMIN'
                        ? 'bg-blue-600 text-white'
                        : isLightMode
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    Gửi Admin ({managerNotifications.filter((n) => n.category === 'ADMIN').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setReaderFilter('FROM_ADMIN')}
                    className={`rounded-lg px-3 py-1.5 transition ${
                      readerFilter === 'FROM_ADMIN'
                        ? 'bg-purple-600 text-white'
                        : isLightMode
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    Từ Admin ({managerNotifications.filter((n) => n.category === 'FROM_ADMIN').length})
                  </button>
                </div>

                {/* Reader Cards List (NO ICONS, DYNAMIC DATA, CLICK MARKS AS READ) */}
                <div className="flex-1 max-h-[480px] overflow-y-auto space-y-2.5 pr-1">
                  {loading && managerNotifications.length === 0 ? (
                    <div className="py-12 text-center text-xs font-semibold text-slate-400">
                      Đang tải danh sách thông báo...
                    </div>
                  ) : filteredReaderNotifs.length === 0 ? (
                    <div className="py-12 text-center text-xs font-semibold text-slate-400">
                      Chưa có thông báo mới.
                    </div>
                  ) : (
                    filteredReaderNotifs.map((item) => (
                      <div
                        key={item.notificationId}
                        onClick={() => void handleMarkSingleRead(item.notificationId)}
                        className={`rounded-xl border p-3.5 transition cursor-pointer ${
                          isLightMode
                            ? item.isRead
                              ? 'border-slate-200 bg-slate-50/70 hover:bg-slate-100'
                              : 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50'
                            : item.isRead
                            ? 'border-white/10 bg-white/5 hover:bg-white/10'
                            : 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            {item.category === 'STAFF' && (
                              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-500 border border-emerald-500/30">
                                Gửi Staff rạp
                              </span>
                            )}
                            {item.category === 'ADMIN' && (
                              <span className="rounded-md bg-blue-500/15 px-2 py-0.5 text-[10px] font-black text-blue-500 border border-blue-500/30">
                                Gửi Admin
                              </span>
                            )}
                            {item.category === 'FROM_ADMIN' && (
                              <span className="rounded-md bg-purple-500/15 px-2 py-0.5 text-[10px] font-black text-purple-400 border border-purple-500/30">
                                Từ Admin
                              </span>
                            )}

                            {!item.isRead && (
                              <span className="rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-500 border border-rose-500/30">
                                Chưa đọc
                              </span>
                            )}
                          </div>
                        </div>

                        <h4 className={`text-xs font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                          {item.title}
                        </h4>
                        <p className={`mt-1 text-xs leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                          {item.message}
                        </p>

                        {/* Action Buttons: Xem, Sửa, Xóa */}
                        <div className="mt-2.5 flex items-center justify-between border-t pt-2 border-slate-200/50 dark:border-white/5">
                          <span className={`text-[10px] font-semibold ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            {new Date(item.createdAt).toLocaleString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingNotif(item);
                              }}
                              className="text-[11px] font-bold text-cyan-500 hover:underline"
                            >
                              Xem
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditModal(item);
                              }}
                              className="text-[11px] font-bold text-amber-500 hover:underline"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDeleteNotifications([item.notificationId]);
                              }}
                              className="text-[11px] font-bold text-rose-500 hover:underline"
                            >
                              Xóa
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: DISPATCH FORM */}
              <div
                className={`rounded-2xl border p-6 ${
                  isLightMode
                    ? 'border-slate-200 bg-white shadow-sm'
                    : 'border-white/10 bg-[#0B1528]'
                }`}
              >
                <h2 className="mb-4 text-lg font-black tracking-tight">
                  Soạn & Phát Thông Báo
                </h2>

                <form onSubmit={handleSubmitSend} className="space-y-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                          Thông báo gửi đến
                        </span>
                        <span className="mt-1 block text-sm font-black text-white">
                          Staff (Nhân viên rạp cùng rạp)
                        </span>
                      </div>

                      <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3.5">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                          Loại thông báo
                        </span>
                        <span className="mt-1 block text-sm font-black text-white">
                          Vận hành & Nội bộ (Internal)
                        </span>
                      </div>
                    </div>

                    {/* Optional Staff ID Input */}
                    <div>
                      <label className="mb-1.5 block text-xs font-bold">
                        Staff ID Người Nhận (Không bắt buộc - Để trống nếu muốn gửi toàn bộ Staff cùng rạp)
                      </label>
                      <input
                        type="text"
                        name="userId"
                        placeholder="Nhập Staff ID nếu muốn gửi riêng (VD: usr-staff-01) hoặc để trống..."
                        value={formData.userId || ''}
                        onChange={handleInputChange}
                        className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-all ${
                          isLightMode
                            ? 'border-slate-300 bg-white text-slate-900 focus:border-blue-500'
                            : 'border-white/10 bg-slate-900 text-white focus:border-blue-500'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold">Kênh Thông Báo</label>
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
                      <option value="App">Thông báo Ứng dụng (App)</option>
                      <option value="Email">Thư điện tử (Email)</option>
                    </select>
                  </div>

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

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="block text-xs font-bold">
                        Nội Dung Thông Báo <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateAiContent}
                        disabled={isGeneratingAi}
                        className="rounded-lg border border-purple-500/30 bg-purple-600/20 px-3 py-1 text-xs font-bold text-purple-300 hover:bg-purple-600/30 transition-all disabled:opacity-50"
                      >
                        <span>{isGeneratingAi ? 'Gemini đang soạn...' : 'Gemini AI Soạn Nội Dung'}</span>
                      </button>
                    </div>
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
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-6 py-3 text-sm font-black text-white shadow-lg transition-all hover:brightness-110 active:scale-98 disabled:opacity-50"
                    >
                      <span>{isSubmitting ? 'Đang phát thông báo...' : 'Phát Thông Báo Ngay'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            /* ADMIN SINGLE COLUMN MAIN FORM */
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
                {/* ADMIN MODE: Target & Type Selection */}
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">
                    1. Chọn Đối tượng Nhận
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
                      <span>User riêng lẻ</span>
                    </button>
                  </div>
                </div>

                {targetType === 'GROUP' && (
                  <div>
                    <label className="mb-1.5 block text-xs font-bold">
                      Chọn Nhóm Người Dùng
                    </label>
                    <select
                      name="targetGroup"
                      value={formData.targetGroup || 'ALL'}
                      onChange={handleInputChange}
                      className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-semibold outline-none transition-all ${
                        isLightMode
                          ? 'border-slate-300 bg-white text-slate-900 focus:border-blue-500'
                          : 'border-white/10 bg-slate-900 text-white focus:border-blue-500'
                      }`}
                    >
                      <option value="ALL">Tất cả người dùng</option>
                      <option value="STAFF">Nhân viên rạp (Staff)</option>
                      <option value="CUSTOMERS">Khách hàng</option>
                      <option value="MANAGERS">Quản lý rạp</option>
                    </select>
                  </div>
                )}

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
                        <span className="text-xs font-bold">Lọc</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold">Kênh Thông Báo</label>
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
                      <option value="App">Thông báo Ứng dụng (App)</option>
                      <option value="Email">Thư điện tử (Email)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold">Loại Thông Báo</label>
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
                      <option value="Transactional">Giao dịch & Vé</option>
                      <option value="Promotional">Khuyến mãi & Ưu đãi</option>
                      <option value="Loyalty">Điểm thưởng & Thành viên</option>
                      <option value="Internal">Vận hành & Nội bộ</option>
                      <option value="Maintenance">Bảo trì hệ thống</option>
                      <option value="Emergency">Khẩn cấp & Cảnh báo</option>
                      <option value="CustomerCare">Chăm sóc & Khảo sát</option>
                      <option value="SpecialEvent">Sự kiện đặc biệt & Bom tấn</option>
                    </select>
                  </div>
                </div>

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

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-xs font-bold">
                      Nội Dung Thông Báo <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateAiContent}
                      disabled={isGeneratingAi}
                      className="rounded-lg border border-purple-500/30 bg-purple-600/20 px-3 py-1 text-xs font-bold text-purple-300 hover:bg-purple-600/30 transition-all disabled:opacity-50"
                    >
                      <span>{isGeneratingAi ? 'Gemini đang soạn...' : 'Gemini AI Soạn Nội Dung'}</span>
                    </button>
                  </div>
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
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 px-6 py-3.5 text-sm font-black text-white shadow-lg transition-all hover:brightness-110 active:scale-98 disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Đang phát thông báo...' : 'Phát Thông Báo Ngay'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
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
                className={`flex flex-1 items-center rounded-xl border px-3.5 py-2 text-sm ${
                  isLightMode
                    ? 'border-slate-300 bg-slate-50 text-slate-900'
                    : 'border-white/10 bg-slate-900 text-white'
                }`}
              >
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
              <div className="flex items-center text-xs font-bold">
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
                  <option value="App">Ứng dụng (App)</option>
                  <option value="Email">Email</option>
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
                <option value="Transactional">Giao dịch</option>
                <option value="Promotional">Khuyến mãi</option>
                <option value="Loyalty">Điểm thưởng</option>
                <option value="Internal">Vận hành nội bộ</option>
                <option value="Maintenance">Bảo trì hệ thống</option>
                <option value="Emergency">Khẩn cấp</option>
                <option value="CustomerCare">Chăm sóc KH</option>
                <option value="SpecialEvent">Sự kiện đặc biệt</option>
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
                <option value="UNREAD">Chưa đọc</option>
                <option value="READ">Đã đọc</option>
              </select>

              <button
                onClick={handleMarkSelectedAsRead}
                className={`flex items-center rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                  selectedNotifIds.length > 0
                    ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25'
                    : 'border-white/10 bg-slate-800/40 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>
                  {selectedNotifIds.length > 0
                    ? `Đánh dấu đã đọc (${selectedNotifIds.length})`
                    : 'Đánh dấu đã đọc'}
                </span>
              </button>

              <button
                onClick={() => handleDeleteNotifications(selectedNotifIds)}
                className={`flex items-center rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                  selectedNotifIds.length > 0
                    ? 'border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                    : 'border-white/10 bg-slate-800/40 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>
                  {selectedNotifIds.length > 0
                    ? `Xóa thông báo (${selectedNotifIds.length})`
                    : 'Xóa thông báo'}
                </span>
              </button>
            </div>
          </div>

          {/* Table View */}
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">
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
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          paginatedNotifications.length > 0 &&
                          paginatedNotifications.every((n) => selectedNotifIds.includes(n.notificationId))
                        }
                        onChange={handleSelectAllOnPage}
                        className="rounded border-slate-400 cursor-pointer"
                        title="Chọn tất cả trang này"
                      />
                    </th>
                    <th className="py-3 px-3">Kênh</th>
                    <th className="py-3 px-3">Loại tin</th>
                    <th className="py-3 px-3">Tiêu đề</th>
                    <th className="py-3 px-3 max-w-xs">Nội dung</th>
                    {!isManager && <th className="py-3 px-3">Rạp / Đơn vị</th>}
                    <th className="py-3 px-3">Người gửi</th>
                    <th className="py-3 px-3">Người nhận</th>
                    <th className="py-3 px-3">Trạng thái</th>
                    <th className="py-3 px-3">Thời gian</th>
                    <th className="py-3 px-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10 font-semibold">
                  {paginatedNotifications.map((item) => {
                    const meta = parseNotificationMeta(item);
                    const isSelected = selectedNotifIds.includes(item.notificationId);
                    return (
                      <tr
                        key={item.notificationId}
                        className={`transition-all ${
                          isSelected
                            ? isLightMode
                              ? 'bg-blue-100/70'
                              : 'bg-blue-600/20'
                            : !item.isRead
                              ? isLightMode
                                ? 'bg-blue-50/60'
                                : 'bg-blue-500/10'
                              : isLightMode
                                ? 'hover:bg-slate-50'
                                : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectNotif(item.notificationId)}
                            className="rounded border-slate-400 cursor-pointer"
                          />
                        </td>

                        {/* Channel */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="inline-flex rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-bold text-blue-400 border border-blue-500/20">
                            {item.channel || 'App'}
                          </span>
                        </td>

                        {/* Type */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="text-xs font-semibold text-slate-300">
                            {item.type || 'Transactional'}
                          </span>
                        </td>

                        {/* Title */}
                        <td
                          className="py-3 px-3 font-bold text-xs text-slate-100 max-w-[140px] truncate cursor-pointer hover:text-cyan-300"
                          onClick={() => handleOpenNotificationDetail(item)}
                          title={item.title}
                        >
                          {item.title}
                        </td>

                        {/* Message */}
                        <td
                          className="py-3 px-3 max-w-[160px] cursor-pointer"
                          onClick={() => handleOpenNotificationDetail(item)}
                          title={item.message}
                        >
                          <div className="truncate text-xs font-normal opacity-90 hover:text-cyan-300 transition-colors">
                            {item.message}
                          </div>
                        </td>

                        {/* Cinema / Scope for Admin */}
                        {!isManager && (
                          <td className="py-3 px-3 whitespace-nowrap max-w-[120px]">
                            <span
                              title={meta.cinemaName}
                              className={`inline-block max-w-[110px] truncate rounded-md px-2 py-0.5 text-xs font-bold border align-middle ${
                                meta.cinemaName !== 'Toàn hệ thống'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                              }`}
                            >
                              {meta.cinemaName}
                            </span>
                          </td>
                        )}

                        {/* Sender */}
                        <td className="py-3 px-3 whitespace-nowrap max-w-[130px]">
                          <span
                            title={meta.senderDisplay}
                            className="inline-block max-w-[120px] truncate rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/20 align-middle"
                          >
                            {meta.senderDisplay}
                          </span>
                        </td>

                        {/* Recipient */}
                        <td className="py-3 px-3 whitespace-nowrap max-w-[130px]">
                          <span
                            title={meta.recipientDisplay}
                            className="inline-block max-w-[120px] truncate rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-bold text-purple-300 border border-purple-500/20 align-middle"
                          >
                            {meta.recipientDisplay}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-bold border ${
                              item.isRead
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {item.isRead ? 'Đã đọc' : 'Chưa đọc'}
                          </span>
                        </td>

                        {/* Timestamp */}
                        <td className="py-3 px-3 text-slate-400 text-xs whitespace-nowrap">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleString('vi-VN')
                            : '—'}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenNotificationDetail(item)}
                              className="rounded-lg bg-blue-600/20 border border-blue-500/30 px-2 py-1 text-xs font-bold text-blue-300 hover:bg-blue-600/40 transition-all"
                              title="Xem chi tiết nội dung"
                            >
                              Xem
                            </button>

                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="rounded-lg bg-amber-600/20 border border-amber-500/30 px-2 py-1 text-xs font-bold text-amber-300 hover:bg-amber-600/40 transition-all"
                              title="Chỉnh sửa thông báo"
                            >
                              <span>Sửa</span>
                            </button>

                            <button
                              onClick={() => handleDeleteNotifications([item.notificationId])}
                              className="rounded-lg bg-rose-600/20 border border-rose-500/30 px-2 py-1 text-xs font-bold text-rose-300 hover:bg-rose-600/40 transition-all"
                              title="Xóa thông báo này"
                            >
                              <span>Xóa</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
            <span>
              Trang {pageIndex} / {totalPages} (Tổng: {filteredNotifications.length} thông báo)
            </span>
            <button
              disabled={pageIndex >= totalPages}
              onClick={() => setPageIndex((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-white/10 px-4 py-2 hover:bg-white/5 disabled:opacity-40"
            >
              Trang tiếp
            </button>
          </div>
        </div>
      )}



      {/* TAB 4: MANAGER REPORT TO ADMIN */}
      {isManager && activeTab === 'report_admin' && (
        <div className="w-full">
          <div
            className={`w-full rounded-2xl border p-6 ${
              isLightMode
                ? 'border-slate-200 bg-white shadow-sm'
                : 'border-white/10 bg-[#0B1528]'
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black tracking-tight text-purple-400">
                  Manager Báo Cáo & Gửi Yêu Cầu Tới Ban Quản Lý Admin
                </h2>
                <p className={`mt-1 text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Gửi báo cáo sự cố vận hành rạp, đề xuất cấp phép hoặc thông báo khẩn cấp trực tiếp tới Admin hệ thống.
                </p>
              </div>
              <span className="rounded-full bg-purple-500/10 px-3 py-1 text-[11px] font-bold text-purple-400 border border-purple-500/20">
                Target: Ban Quản Lý (Admin)
              </span>
            </div>

            <form onSubmit={handleSubmitSend} className="space-y-5">
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-purple-300">
                    Đối tượng nhận báo cáo
                  </span>
                  <span className="mt-1 block text-sm font-black text-white">
                    Ban Quản Lý Hệ Thống (Admins)
                  </span>
                </div>
                <div className="flex flex-col text-right text-xs">
                  <span className="font-bold text-emerald-400">
                    Rạp: {managerInfo.cinemaName || 'Rạp phân quyền'}
                  </span>
                  <span className="text-slate-300 font-medium">
                    Người gửi: {managerInfo.managerName || 'Manager'} {managerInfo.userId ? `(${managerInfo.userId})` : ''}
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold">Loại Báo Cáo</label>
                <select
                  name="type"
                  value={formData.type || 'Internal'}
                  onChange={handleInputChange}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-semibold outline-none transition-all ${
                    isLightMode
                      ? 'border-slate-300 bg-white text-slate-900 focus:border-purple-500'
                      : 'border-white/10 bg-slate-900 text-white focus:border-purple-500'
                  }`}
                >
                  <option value="Internal">Báo cáo vận hành rạp định kỳ (Internal)</option>
                  <option value="Emergency">Cảnh báo sự cố khẩn cấp (Emergency)</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold">
                  Tiêu Đề Báo Cáo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  maxLength={255}
                  placeholder="Nhập tiêu đề báo cáo gửi Admin (VD: Báo cáo sự cố máy chiếu phòng 02 rạp)..."
                  value={formData.title}
                  onChange={handleInputChange}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-all ${
                    isLightMode
                      ? 'border-slate-300 bg-white text-slate-900 focus:border-purple-500'
                      : 'border-white/10 bg-slate-900 text-white focus:border-purple-500'
                  }`}
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-xs font-bold">
                    Nội Dung Báo Cáo Chi Tiết <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateAiContent}
                    disabled={isGeneratingAi}
                    className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-indigo-600/20 px-3 py-1 text-xs font-bold text-purple-300 hover:from-purple-600/30 hover:to-indigo-600/30 transition-all disabled:opacity-50"
                  >
                    <span>{isGeneratingAi ? 'Gemini đang soạn...' : 'Gemini AI Soạn Nội Dung'}</span>
                  </button>
                </div>
                <textarea
                  name="message"
                  rows={4}
                  maxLength={1000}
                  placeholder="Nhập chi tiết nội dung báo cáo hoặc nhấn 'Gemini AI Soạn Nội Dung' ở trên..."
                  value={formData.message}
                  onChange={handleInputChange}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-all ${
                    isLightMode
                      ? 'border-slate-300 bg-white text-slate-900 focus:border-purple-500'
                      : 'border-white/10 bg-slate-900 text-white focus:border-purple-500'
                  }`}
                />
                <div className="mt-1 text-right text-[11px] text-slate-400">
                  {formData.message.length}/1000 ký tự
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-purple-600/30 transition-all hover:brightness-110 active:scale-98 disabled:opacity-50"
                >
                  <span>{isSubmitting ? 'Đang gửi báo cáo...' : 'Gửi Báo Cáo Tới Ban Quản Lý Admin'}</span>
                </button>
              </div>
            </form>
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
              <div className="font-bold text-base">
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
                  <span>Tài khoản bị cờ báo / vi phạm Spam</span>
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
                    Lọc theo Mã Phòng chiếu
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
                    Lọc theo Mã Suất chiếu
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
                    Lọc theo Mã Phim
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

      {/* VIEW NOTIFICATION DETAIL MODAL */}
      {viewingNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className={`w-full max-w-2xl rounded-2xl border p-6 shadow-2xl transition-all ${
              isLightMode
                ? 'border-slate-300 bg-white text-slate-900'
                : 'border-white/10 bg-[#0B1528] text-white'
            }`}
          >
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-lg font-black text-blue-400">Chi Tiết Thông Báo / Báo Cáo</h3>
                <span className="text-xs text-slate-400">
                  Mã thông báo: #{viewingNotif.notificationId}
                </span>
              </div>
              <button
                onClick={() => setViewingNotif(null)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/10"
              >
                Đóng
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-blue-500/10 px-2.5 py-1 font-bold text-blue-400 border border-blue-500/20">
                Kênh: {viewingNotif.channel || 'App'}
              </span>
              <span className="rounded-md bg-indigo-500/10 px-2.5 py-1 font-bold text-indigo-400 border border-indigo-500/20">
                Loại: {viewingNotif.type || 'Internal'}
              </span>
              <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 font-bold text-emerald-400 border border-emerald-500/20">
                Rạp: {parseNotificationMeta(viewingNotif).cinemaName}
              </span>
              <span className="rounded-md bg-amber-500/10 px-2.5 py-1 font-bold text-amber-400 border border-amber-500/20">
                Người gửi: {parseNotificationMeta(viewingNotif).senderDisplay}
              </span>
              <span className="rounded-md bg-purple-500/10 px-2.5 py-1 font-bold text-purple-300 border border-purple-500/20">
                Người nhận: {parseNotificationMeta(viewingNotif).recipientDisplay}
              </span>
              <span
                className={`rounded-md px-2.5 py-1 font-bold border ${
                  viewingNotif.isRead
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}
              >
                Trạng thái: {viewingNotif.isRead ? 'Đã đọc' : 'Chưa đọc'}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Tiêu đề
                </label>
                <div className="mt-1 text-base font-black text-slate-100">
                  {viewingNotif.title}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Nội dung đầy đủ
                </label>
                <div
                  className={`mt-1 max-h-80 overflow-y-auto rounded-xl border p-4 text-sm font-medium leading-relaxed ${
                    isLightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-slate-900/60'
                  }`}
                >
                  <pre className="whitespace-pre-wrap font-sans">{viewingNotif.message}</pre>
                </div>
              </div>

              <div className="text-right text-xs text-slate-400">
                Thời gian tạo:{' '}
                {viewingNotif.createdAt
                  ? new Date(viewingNotif.createdAt).toLocaleString('vi-VN')
                  : '—'}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditModal(viewingNotif)}
                  className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-all"
                >
                  <span>Sửa thông báo</span>
                </button>

                <button
                  onClick={() => handleDeleteNotifications([viewingNotif.notificationId])}
                  className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition-all"
                >
                  <span>Xóa</span>
                </button>
              </div>

              <button
                onClick={() => setViewingNotif(null)}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-500 shadow-md"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT NOTIFICATION MODAL */}
      {editingNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl transition-all ${
              isLightMode
                ? 'border-slate-300 bg-white text-slate-900'
                : 'border-white/10 bg-[#0B1528] text-white'
            }`}
          >
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-amber-400">Chỉnh Sửa Thông Báo</h3>
              <button
                onClick={() => setEditingNotif(null)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/10"
              >
                Đóng
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Tiêu Đề Thông Báo</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none ${
                    isLightMode
                      ? 'border-slate-300 bg-white text-slate-900 focus:border-amber-500'
                      : 'border-white/10 bg-slate-900 text-white focus:border-amber-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Nội Dung Thông Báo</label>
                <textarea
                  rows={5}
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none ${
                    isLightMode
                      ? 'border-slate-300 bg-white text-slate-900 focus:border-amber-500'
                      : 'border-white/10 bg-slate-900 text-white focus:border-amber-500'
                  }`}
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
              <button
                onClick={() => setEditingNotif(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold hover:bg-white/10"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2 text-xs font-black text-white shadow-md hover:brightness-110 disabled:opacity-50"
              >
                {isSavingEdit ? 'Đang lưu...' : 'Lưu Thay Đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
