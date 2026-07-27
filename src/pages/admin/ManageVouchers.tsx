import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  FaExclamationTriangle,
  FaLayerGroup,
  FaLock,
  FaMoneyBillWave,
  FaPercent,
  FaPlus,
  FaSearch,
  FaTicketAlt,
  FaEdit,
  FaTrashAlt,
  FaTimes,
  FaUsers,
} from 'react-icons/fa';
import { voucherService } from '../../services/voucherService';
import type {
  Voucher,
  CreateVoucherPayload,
  DiscountType,
  VoucherApplicableScope,
  VoucherCategory,
  VoucherTargetType,
  UpdateVoucherPayload,
  VoucherStatus,
} from '../../services/voucherService';

type VoucherFilterType = 'ALL' | DiscountType;
type VoucherFilterStatus = 'ALL' | Extract<VoucherStatus, 'ACTIVE' | 'INACTIVE'>;
type EditableVoucherStatus = Extract<VoucherStatus, 'ACTIVE' | 'INACTIVE'>;
type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  variant: 'danger' | 'warning';
  onConfirm: () => void | Promise<void>;
} | null;

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

const isDiscountType = (value: string): value is DiscountType =>
  value === 'PERCENT' || value === 'AMOUNT';

const isVoucherFilterType = (value: string): value is VoucherFilterType =>
  value === 'ALL' || isDiscountType(value);

const isVoucherFilterStatus = (value: string): value is VoucherFilterStatus =>
  value === 'ALL' || value === 'ACTIVE' || value === 'INACTIVE';

const voucherCategoryOptions: Array<{ value: VoucherCategory; label: string; hint: string }> = [
  { value: 'EVENT', label: 'Sự kiện / Marketing', hint: 'Voucher khuyến mãi thông thường.' },
  { value: 'FOOD_BEVERAGE', label: 'F&B', hint: 'Áp dụng cho bắp nước hoặc combo.' },
  { value: 'COMPENSATION', label: 'Voucher đền bù', hint: 'Chỉ dùng cho đổi phòng/suất chiếu hoặc sự cố.' },
];

const applicableScopeOptions: Array<{ value: VoucherApplicableScope; label: string }> = [
  { value: 'TOTAL_ORDER', label: 'Toàn bộ đơn hàng' },
  { value: 'TICKET_ONLY', label: 'Chỉ tiền vé' },
  { value: 'FOOD_BEVERAGE_ONLY', label: 'Chỉ F&B' },
];

const targetTypeOptions: Array<{ value: VoucherTargetType; label: string }> = [
  { value: 'ALL_CUSTOMERS', label: 'Tất cả khách hàng' },
  { value: 'SPECIFIC_CUSTOMERS', label: 'Khách hàng chỉ định' },
];

const delimitedIdsPattern = /^[A-Za-z0-9_,;@.+\-\s]+$/;

const normalizeDelimitedIds = (value: string) =>
  value
    .split(/[,\n\r\t;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(',');

const getOptionLabel = <T extends string>(
  options: Array<{ value: T; label: string }>,
  value: string | null | undefined,
  fallback: string,
) => options.find((option) => option.value === value)?.label || fallback;

const getCategoryLabel = (value: string | null | undefined) =>
  getOptionLabel(voucherCategoryOptions, value || '', 'Khác');

const getScopeLabel = (value: string | null | undefined) =>
  getOptionLabel(applicableScopeOptions, value || '', 'Toàn bộ đơn hàng');

const getTargetTypeLabel = (value: string | null | undefined) =>
  getOptionLabel(targetTypeOptions, value || '', 'Tất cả khách hàng');

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toDatetimeLocal = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const tzoffset = date.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
  return localISOTime;
};

export default function ManageVouchers() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<VoucherFilterType>('ALL');
  const [filterStatus, setFilterStatus] = useState<VoucherFilterStatus>('ALL');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);

  // Form State
  const [voucherCode, setVoucherCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENT');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [minOrderAmount, setMinOrderAmount] = useState<number>(0);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<number>(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [usageLimit, setUsageLimit] = useState<number>(100);
  const [perCustomerLimit, setPerCustomerLimit] = useState<number>(1);
  const [voucherStatus, setVoucherStatus] = useState<EditableVoucherStatus>('ACTIVE');
  const [category, setCategory] = useState<VoucherCategory>('EVENT');
  const [applicableScope, setApplicableScope] = useState<VoucherApplicableScope>('TOTAL_ORDER');
  const [targetType, setTargetType] = useState<VoucherTargetType>('ALL_CUSTOMERS');
  const [targetCustomerIds, setTargetCustomerIds] = useState('');
  const [specificFbItemIds, setSpecificFbItemIds] = useState('');
  const [isPrivateVoucher, setIsPrivateVoucher] = useState(false);
  const [requiredTicketCount, setRequiredTicketCount] = useState<number>(0);
  // Thêm mới
  const [showtimeId, setShowtimeId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [lookingUpCustomers, setLookingUpCustomers] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);
  const [submitting, setSubmitting] = useState(false);
  const voucherNeedsCustomerIds =
    isPrivateVoucher || targetType === 'SPECIFIC_CUSTOMERS';

  const handlePrivateVoucherChange = (checked: boolean) => {
    setIsPrivateVoucher(checked);

    if (checked) {
      setTargetType('SPECIFIC_CUSTOMERS');
      return;
    }

    setTargetType('ALL_CUSTOMERS');
    setTargetCustomerIds('');
  };

  // Thêm mới
  const handleLookupCustomersByShowtimeOrRoom = async () => {
    const cleanShowtimeId = showtimeId.trim();
    const cleanRoomId = roomId.trim();

    if (!cleanShowtimeId && !cleanRoomId) {
      toast.warn('Vui lòng nhập mã suất chiếu hoặc mã phòng chiếu trước khi tra cứu.');
      return;
    }

    try {
      setLookingUpCustomers(true);
      const response = await voucherService.getCustomerIdsByShowtimeOrRoom(
        cleanShowtimeId || null,
        cleanRoomId || null,
      );

      if (!response.success) {
        toast.error(response.message || 'Không thể lấy danh sách khách hàng từ suất chiếu/phòng chiếu.');
        return;
      }

      const customerIds = response.data ?? [];

      if (customerIds.length === 0) {
        setTargetCustomerIds('');
        toast.warn('Không tìm thấy khách hàng phù hợp với suất chiếu hoặc phòng chiếu đã nhập.');
        return;
      }

      setTargetType('SPECIFIC_CUSTOMERS');
      setIsPrivateVoucher(true);
      setTargetCustomerIds(customerIds.join(','));
      toast.success(`Đã lấy ${customerIds.length} khách hàng và điền vào danh sách nhận voucher.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Lỗi khi tra cứu danh sách khách hàng.'));
    } finally {
      setLookingUpCustomers(false);
    }
  };

  // Load vouchers
  const fetchVouchers = useCallback(async () => {
    try {
      setLoading(true);
      // Call service with search filter and status filter
      const searchParam = searchTerm.trim() || undefined;
      const statusParam = filterStatus !== 'ALL' ? filterStatus : undefined;
      const response = await voucherService.getAllAdminVouchers(searchParam, statusParam);
      if (response && response.success) {
        setVouchers(response.data || []);
      } else {
        toast.error(response?.message || 'Không thể tải danh sách voucher');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Lỗi khi tải danh sách voucher'));
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterStatus]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchVouchers();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchVouchers]);

  // Esc key close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
        setEditingVoucher(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Open Modal Add
  const handleOpenAdd = () => {
    setEditingVoucher(null);
    setVoucherCode('');
    setTitle('');
    setDescription('');
    setDiscountType('PERCENT');
    setDiscountValue(0);
    setMinOrderAmount(0);
    setMaxDiscountAmount(0);

    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    setStartDate(toDatetimeLocal(now.toISOString()));
    setEndDate(toDatetimeLocal(nextWeek.toISOString()));
    setUsageLimit(100);
    setPerCustomerLimit(1);
    setVoucherStatus('ACTIVE');
    setCategory('EVENT');
    setApplicableScope('TOTAL_ORDER');
    setTargetType('ALL_CUSTOMERS');
    setTargetCustomerIds('');
    setSpecificFbItemIds('');
    setIsPrivateVoucher(false);
    setRequiredTicketCount(0);
    // Thêm mới
    setShowtimeId('');
    setRoomId('');
    setIsModalOpen(true);
  };

  // Open Modal Edit
  const handleOpenEdit = (voucher: Voucher) => {
    setEditingVoucher(voucher);
    setVoucherCode(voucher.voucherCode);
    setTitle(voucher.title || '');
    setDescription(voucher.description || '');
    setDiscountType(voucher.discountType);
    setDiscountValue(voucher.discountValue);
    setMinOrderAmount(voucher.minOrderAmount || 0);
    setMaxDiscountAmount(voucher.maxDiscountAmount || 0);
    setStartDate(toDatetimeLocal(voucher.startDate));
    setEndDate(toDatetimeLocal(voucher.endDate));
    setUsageLimit(voucher.usageLimit);
    setPerCustomerLimit(voucher.perCustomerLimit || 1);
    setVoucherStatus(voucher.voucherStatus === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
    setCategory(voucher.category || 'EVENT');
    setApplicableScope(voucher.applicableScope || 'TOTAL_ORDER');
    setTargetType(voucher.targetType || 'ALL_CUSTOMERS');
    setTargetCustomerIds(voucher.targetCustomerIds || '');
    setSpecificFbItemIds(voucher.specificFbItemIds || '');
    setIsPrivateVoucher(Boolean(voucher.isPrivate));
    setRequiredTicketCount(voucher.requiredTicketCount || 0);
    // Thêm mới
    setShowtimeId(voucher.showtimeId || '');
    setRoomId(voucher.roomId || '');
    setIsModalOpen(true);
  };

  // Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!voucherCode.trim()) {
      toast.error('Mã voucher không được để trống');
      return;
    }

    if (!/^[A-Za-z0-9_-]{3,100}$/.test(voucherCode.trim())) {
      toast.warn('Mã voucher chỉ nên gồm chữ, số, dấu gạch dưới hoặc gạch ngang, dài từ 3-100 ký tự.');
      return;
    }

    if (discountValue <= 0) {
      toast.error('Giá trị giảm giá phải lớn hơn 0');
      return;
    }

    if (discountType === 'PERCENT' && discountValue > 100) {
      toast.error('Giá trị giảm giá phần trăm không được vượt quá 100%');
      return;
    }

    if (!startDate || !endDate) {
      toast.error('Vui lòng chọn thời gian bắt đầu và kết thúc');
      return;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      toast.error('Thời gian bắt đầu phải trước thời gian kết thúc');
      return;
    }

    if (usageLimit < 1 || perCustomerLimit < 1) {
      toast.warn('Giới hạn dùng và giới hạn mỗi khách phải lớn hơn 0.');
      return;
    }

    const cleanTargetCustomerIds = normalizeDelimitedIds(targetCustomerIds);
    const cleanSpecificFbItemIds = normalizeDelimitedIds(specificFbItemIds);
    // Thêm mới
    const cleanShowtimeId = showtimeId.trim();
    const cleanRoomId = roomId.trim();
    const finalTargetType: VoucherTargetType = voucherNeedsCustomerIds
      ? 'SPECIFIC_CUSTOMERS'
      : 'ALL_CUSTOMERS';
    const finalTargetCustomerIds = voucherNeedsCustomerIds
      ? cleanTargetCustomerIds
      : '';

    if (targetCustomerIds.trim() && !delimitedIdsPattern.test(targetCustomerIds)) {
      toast.warn('Danh sách khách hàng chỉ được chứa ID, email, dấu phẩy hoặc dấu chấm phẩy.');
      return;
    }

    if (specificFbItemIds.trim() && !delimitedIdsPattern.test(specificFbItemIds)) {
      toast.warn('Danh sách F&B Item ID chỉ được chứa chữ, số, dấu gạch dưới, gạch ngang và dấu phẩy.');
      return;
    }

    if (isPrivateVoucher && targetType !== 'SPECIFIC_CUSTOMERS') {
      toast.warn('Voucher private bắt buộc phải chọn nhóm "Khách hàng chỉ định".');
      return;
    }

    if (voucherNeedsCustomerIds && !cleanTargetCustomerIds) {
      toast.warn('Vui lòng nhập Customer Profile ID, User ID hoặc email khi tạo voucher private.');
      return;
    }

    if (applicableScope === 'FOOD_BEVERAGE_ONLY' && !cleanSpecificFbItemIds) {
      toast.warn('Voucher chỉ áp dụng F&B cần có danh sách F&B Item ID cụ thể.');
      return;
    }

    setSubmitting(true);

    try {
      const cleanCode = voucherCode.trim().toUpperCase();
      const titleVal = title.trim() || `Giảm giá ${cleanCode}`;
      const descVal = description.trim() || `Mã giảm giá áp dụng cho đơn hàng từ G2Cinema`;
      const finalMaxDiscountAmount =
        discountType === 'AMOUNT'
          ? discountValue
          : maxDiscountAmount > 0
            ? maxDiscountAmount
            : undefined;
      const finalRequiredTicketCount =
        requiredTicketCount > 0 ? requiredTicketCount : undefined;

      if (editingVoucher) {
        const payload: UpdateVoucherPayload = {
          title: titleVal,
          description: descVal,
          voucherStatus,
          minOrderAmount,
          maxDiscountAmount: finalMaxDiscountAmount,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          usageLimit,
          perCustomerLimit,
          category,
          applicableScope,
          targetType: finalTargetType,
          targetCustomerIds: finalTargetCustomerIds || null,
          specificFbItemIds: cleanSpecificFbItemIds || null,
          isPrivate: isPrivateVoucher,
          requiredTicketCount: finalRequiredTicketCount,
          // Thêm mới
          showtimeId: cleanShowtimeId || null,
          roomId: cleanRoomId || null,
        };
        const response = await voucherService.updateVoucher(editingVoucher.voucherId, payload);
        if (response.success) {
          toast.success(response.message || 'Cập nhật voucher thành công');
          setIsModalOpen(false);
          setEditingVoucher(null);
          void fetchVouchers();
        } else {
          toast.error(response.message || 'Cập nhật voucher thất bại');
        }
      } else {
        const payload: CreateVoucherPayload = {
          voucherCode: cleanCode,
          title: titleVal,
          description: descVal,
          discountType,
          discountValue,
          minOrderAmount,
          maxDiscountAmount: finalMaxDiscountAmount,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          usageLimit,
          perCustomerLimit,
          category,
          applicableScope,
          targetType: finalTargetType,
          targetCustomerIds: finalTargetCustomerIds || null,
          specificFbItemIds: cleanSpecificFbItemIds || null,
          isPrivate: isPrivateVoucher,
          requiredTicketCount: finalRequiredTicketCount,
          // Thêm mới
          showtimeId: cleanShowtimeId || null,
          roomId: cleanRoomId || null,
        };
        const response = await voucherService.createVoucher(payload);
        if (response.success) {
          toast.success(response.message || 'Thêm voucher mới thành công');
          setIsModalOpen(false);
          void fetchVouchers();
        } else {
          toast.error(response.message || 'Thêm voucher mới thất bại');
        }
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Có lỗi xảy ra khi lưu thông tin voucher'));
    } finally {
      setSubmitting(false);
    }
  };

  // Delete voucher
  const deleteVoucher = async (voucher: Voucher) => {
    try {
      const response = await voucherService.deleteVoucher(voucher.voucherId);
      if (response.success) {
        toast.success(response.message || 'Xóa voucher thành công');
        void fetchVouchers();
      } else {
        toast.error(response.message || 'Xóa voucher thất bại');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Có lỗi xảy ra khi xóa voucher'));
    }
  };

  const handleDelete = (voucher: Voucher) => {
    const isActiveVoucher = voucher.voucherStatus === 'ACTIVE' && new Date(voucher.endDate) >= new Date();
    const hasUsage = voucher.usedCount > 0;

    setConfirmDialog({
      title: isActiveVoucher ? 'Xóa voucher đang hoạt động?' : 'Xác nhận xóa voucher',
      message: [
        `Bạn sắp xóa voucher ${voucher.voucherCode}.`,
        isActiveVoucher ? 'Voucher này đang hoạt động, khách hàng có thể vẫn đang thấy hoặc chuẩn bị dùng mã này.' : '',
        hasUsage ? `Voucher đã có ${voucher.usedCount} lượt dùng, xóa cứng có thể làm mất dấu vết vận hành.` : '',
        'Hãy chỉ tiếp tục nếu bạn chắc chắn muốn xóa khỏi hệ thống.',
      ]
        .filter(Boolean)
        .join(' '),
      confirmLabel: 'Xóa voucher',
      variant: 'danger',
      onConfirm: () => deleteVoucher(voucher),
    });
  };

  // Toggle quick status
  const toggleVoucherStatus = async (voucher: Voucher, newStatus: EditableVoucherStatus) => {
    try {
      const payload: UpdateVoucherPayload = {
        title: voucher.title,
        description: voucher.description,
        voucherStatus: newStatus,
        minOrderAmount: voucher.minOrderAmount,
        maxDiscountAmount: voucher.maxDiscountAmount,
        startDate: voucher.startDate,
        endDate: voucher.endDate,
        usageLimit: voucher.usageLimit,
        perCustomerLimit: voucher.perCustomerLimit,
        category: voucher.category,
        applicableScope: voucher.applicableScope,
        targetType: voucher.targetType,
        targetCustomerIds: voucher.targetCustomerIds || null,
        specificFbItemIds: voucher.specificFbItemIds || null,
        isPrivate: Boolean(voucher.isPrivate),
        requiredTicketCount: voucher.requiredTicketCount,
        // Thêm mới
        showtimeId: voucher.showtimeId || null,
        roomId: voucher.roomId || null,
      };
      const response = await voucherService.updateVoucher(voucher.voucherId, payload);
      if (response.success) {
        toast.success(`Đã ${newStatus === 'ACTIVE' ? 'kích hoạt' : 'vô hiệu hóa'} voucher ${voucher.voucherCode}`);
        void fetchVouchers();
      } else {
        toast.error(response.message || 'Thay đổi trạng thái voucher thất bại');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Lỗi khi thay đổi trạng thái voucher'));
    }
  };

  const handleToggleStatus = (voucher: Voucher) => {
    const newStatus: EditableVoucherStatus =
      voucher.voucherStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    setConfirmDialog({
      title: newStatus === 'ACTIVE' ? 'Kích hoạt voucher?' : 'Vô hiệu hóa voucher?',
      message:
        newStatus === 'ACTIVE'
          ? `Voucher ${voucher.voucherCode} sẽ xuất hiện lại cho nhóm khách hàng đúng điều kiện.`
          : `Voucher ${voucher.voucherCode} sẽ ngừng áp dụng ngay sau khi lưu trạng thái mới.`,
      confirmLabel: newStatus === 'ACTIVE' ? 'Kích hoạt' : 'Vô hiệu hóa',
      variant: newStatus === 'ACTIVE' ? 'warning' : 'danger',
      onConfirm: () => toggleVoucherStatus(voucher, newStatus),
    });
  };

  // Client-side type filter
  const filteredVouchers = vouchers.filter((v) => {
    const matchType = filterType === 'ALL' || v.discountType === filterType;
    return matchType;
  });

  return (
    <div className="min-h-screen bg-[#0A0A0C] p-6 text-white font-['Urbanist']">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider flex items-center gap-2">
            <FaTicketAlt className="text-blue-500" />
            Quản Lý Vouchers
          </h1>
          <p className="mt-1 text-xs text-gray-400">
            Tạo, cập nhật và theo dõi các chương trình khuyến mãi/mã giảm giá.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:brightness-110 transition active:scale-95 self-start sm:self-auto"
        >
          <FaPlus />
          Tạo Voucher Mới
        </button>
      </div>

      {/* Filters bar */}
      <div className="mb-6 grid gap-4 md:grid-cols-3 rounded-2xl border border-gray-800 bg-[#111C44] p-4 shadow-xl">
        {/* Search */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <FaSearch className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Tìm kiếm theo mã voucher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-800 bg-[#0F172A] py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
          />
        </div>

        {/* Type Filter */}
        <div>
          <select
            value={filterType}
            onChange={(e) => {
              if (isVoucherFilterType(e.target.value)) {
                setFilterType(e.target.value);
              }
            }}
            className="w-full rounded-xl border border-gray-800 bg-[#0F172A] px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition"
          >
            <option value="ALL">Tất cả loại giảm giá</option>
            <option value="PERCENT">Phần trăm (%)</option>
            <option value="AMOUNT">Số tiền cố định (đ)</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={filterStatus}
            onChange={(e) => {
              if (isVoucherFilterStatus(e.target.value)) {
                setFilterStatus(e.target.value);
              }
            }}
            className="w-full rounded-xl border border-gray-800 bg-[#0F172A] px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
            <option value="INACTIVE">Ngừng hoạt động (INACTIVE)</option>
          </select>
        </div>
      </div>

      {/* Main content table */}
      <div className="rounded-2xl border border-gray-800 bg-[#111C44] overflow-hidden shadow-2xl">
        {loading ? (
          <div className="py-20 text-center text-gray-400">
            <span className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></span>
            <p>Đang tải danh sách voucher...</p>
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <FaTicketAlt className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-lg font-semibold">Không tìm thấy voucher nào</p>
            <p className="text-xs text-gray-500 mt-1">Hãy thử đổi bộ lọc hoặc tạo voucher mới.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-800 bg-blue-950/20 text-xs font-black uppercase tracking-wider text-slate-400">
                  <th className="p-4">Mã Voucher / Mô Tả</th>
                  {/* Thêm mới */}
                  <th className="p-4">Nguồn Cấp</th>
                  <th className="p-4">Loại & Mức Giảm</th>
                  <th className="p-4 text-center">Đơn Tối Thiểu</th>
                  <th className="p-4 text-center">Giảm Tối Đa</th>
                  <th className="p-4 text-center">Đã Dùng / Giới Hạn</th>
                  <th className="p-4">Thời Gian Khả Dụng</th>
                  <th className="p-4 text-center">Trạng thái</th>
                  <th className="p-4 text-center">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50 text-sm">
                {filteredVouchers.map((voucher) => {
                  const isExpired = new Date(voucher.endDate) < new Date();
                  const isExhausted = voucher.usedCount >= voucher.usageLimit;
                  const isReallyActive = voucher.voucherStatus === 'ACTIVE' && !isExpired && !isExhausted;

                  return (
                    <tr
                      key={voucher.voucherId}
                      className={`hover:bg-blue-950/10 transition group ${voucher.voucherStatus !== 'ACTIVE' ? 'opacity-60' : ''}`}
                    >
                      {/* Code & Title */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-400 border border-blue-500/20 uppercase font-mono">
                            {voucher.voucherCode}
                          </span>
                          <span className="text-xs font-bold text-white max-w-[200px] truncate" title={voucher.title}>
                            {voucher.title}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1 font-semibold max-w-[320px] truncate">{voucher.description}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-wide">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                            voucher.isPrivate
                              ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                              : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                          }`}>
                            <FaLock className="text-[9px]" />
                            {voucher.isPrivate ? 'Private' : 'Public'}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-cyan-300">
                            <FaLayerGroup className="text-[9px]" />
                            {getCategoryLabel(voucher.category)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/25 bg-violet-400/10 px-2 py-0.5 text-violet-300">
                            <FaUsers className="text-[9px]" />
                            {getTargetTypeLabel(voucher.targetType)}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] font-semibold text-gray-500">
                          Phạm vi: {getScopeLabel(voucher.applicableScope)}
                          {voucher.specificFbItemIds ? ` · F&B: ${voucher.specificFbItemIds}` : ''}
                        </div>
                      </td>

                      {/* Thêm mới */}
                      <td className="p-4 text-xs">
                        <div className="space-y-1 font-semibold text-slate-300">
                          <div>
                            <span className="text-[10px] uppercase text-gray-500">Suất chiếu:</span>{' '}
                            <span className="font-mono text-cyan-300">
                              {voucher.showtimeId || 'Không gắn'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-gray-500">Phòng:</span>{' '}
                            <span className="font-mono text-amber-300">
                              {voucher.roomId || 'Không gắn'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Type & Value */}
                      <td className="p-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          {voucher.discountType === 'PERCENT' ? (
                            <>
                              <FaPercent className="text-cyan-400 text-xs" />
                              <span>{voucher.discountValue}%</span>
                            </>
                          ) : (
                            <>
                              <FaMoneyBillWave className="text-emerald-400 text-xs" />
                              <span>{formatCurrency(voucher.discountValue)}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Min Order */}
                      <td className="p-4 text-center text-gray-300">
                        {voucher.minOrderAmount && voucher.minOrderAmount > 0 ? formatCurrency(voucher.minOrderAmount) : 'Không có'}
                      </td>

                      {/* Max Discount */}
                      <td className="p-4 text-center text-gray-300">
                        {voucher.discountType === 'PERCENT'
                          ? voucher.maxDiscountAmount && voucher.maxDiscountAmount > 0
                            ? formatCurrency(voucher.maxDiscountAmount)
                            : 'Không giới hạn'
                          : 'Bằng mức giảm'}
                      </td>

                      {/* Used / Limit */}
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${isExhausted ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                          {voucher.usedCount} / {voucher.usageLimit}
                        </span>
                      </td>

                      {/* Period */}
                      <td className="p-4 text-xs space-y-1">
                        <div className="flex items-center gap-1 text-slate-300">
                          <span className="text-[10px] uppercase text-gray-500 w-8">Từ:</span>
                          <span>{formatDate(voucher.startDate)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-300">
                          <span className="text-[10px] uppercase text-gray-500 w-8">Đến:</span>
                          <span className={isExpired ? 'text-red-400 font-bold' : ''}>
                            {formatDate(voucher.endDate)}
                            {isExpired && ' (Hết hạn)'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(voucher)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-xs font-semibold transition hover:brightness-110 ${
                            isReallyActive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : isExpired || isExhausted
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isReallyActive ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                          {isReallyActive ? 'Đang chạy' : isExpired ? 'Hết hạn' : isExhausted ? 'Hết lượt' : 'Tạm khóa'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(voucher)}
                            className="p-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 text-xs font-semibold rounded-lg transition"
                            title="Sửa"
                          >
                            <FaEdit />
                          </button>
                          <button
                            onClick={() => handleDelete(voucher)}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold rounded-lg transition"
                            title="Xóa"
                          >
                            <FaTrashAlt />
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
      </div>

      {/* ────────────────────────────────────── */}
      {/* MODAL THÊM / SỬA VOUCHER              */}
      {/* ────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4 font-['Urbanist']">
          <div className="bg-[#111C44] border border-slate-700/80 w-full max-w-4xl rounded-2xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col max-h-[95vh] text-white">
            {/* Header */}
            <div className="p-5 border-b border-slate-700/80 flex justify-between items-start gap-4 bg-[#0F172A] shrink-0">
              <h2 className="text-lg font-black text-white uppercase tracking-wide flex items-center gap-2">
                <FaTicketAlt className="text-cyan-400" />
                {editingVoucher ? 'Cập Nhật Voucher' : 'Tạo Voucher Mới'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingVoucher(null);
                }}
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white text-lg transition cursor-pointer"
                aria-label="Đóng form voucher"
              >
                <FaTimes />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Voucher Code */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                  Mã Voucher <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingVoucher}
                  placeholder="Ví dụ: SUMMER50, G2C100K"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                  className={`w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition font-mono uppercase ${
                    editingVoucher ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                />
                {!editingVoucher && (
                  <span className="text-[10px] text-gray-500 mt-1 block">Mã tự động chuyển viết hoa, không khoảng trắng.</span>
                )}
              </div>

              {/* Title & Description */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Tiêu Đề Voucher
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Khuyến Mãi Mùa Hè"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Mô tả chi tiết
                  </label>
                  <textarea
                    placeholder="Ví dụ: Giảm ngay 10% tối đa 50k cho mọi đơn đặt vé phim."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
                  />
                </div>
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Loại giảm giá
                  </label>
                  <select
                    value={discountType}
                    disabled={!!editingVoucher}
                    onChange={(e) => {
                      if (isDiscountType(e.target.value)) {
                        setDiscountType(e.target.value);
                        setDiscountValue(0);
                      }
                    }}
                    className={`w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition ${
                      editingVoucher ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <option value="PERCENT">Phần trăm (%)</option>
                    <option value="AMOUNT">Số tiền cố định (đ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Mức giảm <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    disabled={!!editingVoucher}
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    placeholder={discountType === 'PERCENT' ? 'Ví dụ: 10 (%)' : 'Ví dụ: 50000 (đ)'}
                    className={`w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition ${
                      editingVoucher ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>

              {/* Min Order & Max Discount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Đơn tối thiểu (đ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minOrderAmount || ''}
                    onChange={(e) => setMinOrderAmount(Number(e.target.value))}
                    placeholder="Ví dụ: 100000"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Giảm tối đa (đ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={discountType === 'AMOUNT'}
                    value={discountType === 'AMOUNT' ? discountValue : maxDiscountAmount || ''}
                    onChange={(e) => setMaxDiscountAmount(Number(e.target.value))}
                    placeholder={discountType === 'AMOUNT' ? 'Cố định bằng mức giảm' : '0 (Không giới hạn)'}
                    className={`w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition ${
                      discountType === 'AMOUNT' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>

              {/* Start Date & End Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Thời gian bắt đầu
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Thời gian kết thúc
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
                  />
                </div>
              </div>

              {/* Usage Limit & PerCustomerLimit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Giới hạn số lượng dùng
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={usageLimit || ''}
                    onChange={(e) => setUsageLimit(Number(e.target.value))}
                    placeholder="Ví dụ: 100"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Giới hạn/mỗi khách
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={perCustomerLimit || ''}
                    onChange={(e) => setPerCustomerLimit(Number(e.target.value))}
                    placeholder="Ví dụ: 1"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
              </div>

              {/* Scope & Target */}
              <div className="rounded-2xl border border-slate-700/80 bg-[#0B1220] p-5 shadow-inner shadow-black/20">
                <div className="mb-5 flex flex-col gap-2 border-b border-slate-800 pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                      <FaLayerGroup />
                      Điều kiện áp dụng voucher
                    </h3>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">
                      Chọn nhóm voucher, phạm vi giảm giá và nhóm khách được nhận mã.
                    </p>
                  </div>
                  <span className={`w-fit rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                    voucherNeedsCustomerIds
                      ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                      : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                  }`}>
                    {voucherNeedsCustomerIds ? "Chỉ định khách hàng" : "Công khai"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-xl border border-slate-700 bg-[#111C44]/70 p-4">
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Nhóm voucher
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as VoucherCategory)}
                      className="h-12 w-full rounded-xl border border-slate-700 bg-[#0F172A] px-4 text-sm font-bold text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25"
                    >
                      {voucherCategoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 min-h-5 text-[11px] font-semibold text-slate-500">
                      {voucherCategoryOptions.find((option) => option.value === category)?.hint}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-700 bg-[#111C44]/70 p-4">
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Phạm vi giảm giá
                    </label>
                    <select
                      value={applicableScope}
                      onChange={(e) => {
                        const nextScope = e.target.value as VoucherApplicableScope;
                        setApplicableScope(nextScope);
                        if (nextScope !== 'FOOD_BEVERAGE_ONLY') {
                          setSpecificFbItemIds('');
                        }
                      }}
                      className="h-12 w-full rounded-xl border border-slate-700 bg-[#0F172A] px-4 text-sm font-bold text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25"
                    >
                      {applicableScopeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 min-h-5 text-[11px] font-semibold text-slate-500">
                      Voucher sẽ chỉ tính giảm trên phạm vi đã chọn.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-700 bg-[#111C44]/70 p-4">
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Nhóm khách hàng
                    </label>
                    <select
                      value={targetType}
                      onChange={(e) => {
                        const nextTargetType = e.target.value as VoucherTargetType;
                        setTargetType(nextTargetType);
                        if (nextTargetType === 'ALL_CUSTOMERS') {
                          setIsPrivateVoucher(false);
                          setTargetCustomerIds('');
                        }
                      }}
                      className="h-12 w-full rounded-xl border border-slate-700 bg-[#0F172A] px-4 text-sm font-bold text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25"
                    >
                      {targetTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className={`mt-2 rounded-lg px-3 py-2 text-[11px] font-bold ${
                      voucherNeedsCustomerIds
                        ? 'bg-amber-400/10 text-amber-200'
                        : 'bg-emerald-400/10 text-emerald-200'
                    }`}>
                      {voucherNeedsCustomerIds
                        ? 'Cần nhập Customer Profile ID, User ID hoặc email cho nhóm khách được nhận voucher.'
                        : 'Voucher đang công khai cho tất cả khách hàng đủ điều kiện.'}
                    </p>
                  </div>

                  <div className={`rounded-xl border p-4 transition ${
                    voucherNeedsCustomerIds
                      ? 'border-amber-400/40 bg-amber-400/10'
                      : 'border-slate-700 bg-[#111C44]/70'
                  }`}>
                    <label className="flex h-full min-h-[108px] cursor-pointer select-none items-center gap-4">
                      <input
                        type="checkbox"
                        checked={isPrivateVoucher}
                        onChange={(e) => handlePrivateVoucherChange(e.target.checked)}
                        className="h-5 w-5 rounded border-slate-600 bg-slate-950 text-amber-400 focus:ring-amber-400"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-black uppercase text-white">
                          Voucher private
                        </span>
                        <span className="mt-1 block text-[12px] font-semibold leading-5 text-slate-400">
                          Chỉ khách được chỉ định mới dùng được. Khi bỏ tick, hệ thống tự chuyển về voucher công khai.
                        </span>
                      </span>
                    </label>
                  </div>

                  {/* Thêm mới */}
                  <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 p-4 xl:col-span-2">
                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                          Cấp voucher đền bù theo suất chiếu / phòng
                        </h4>
                        <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-400">
                          Nhập mã suất chiếu hoặc mã phòng, hệ thống sẽ lấy các khách đã đặt vé liên quan và điền vào danh sách nhận voucher.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_auto]">
                      <div>
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Mã suất chiếu
                        </label>
                        <input
                          type="text"
                          value={showtimeId}
                          onChange={(e) => setShowtimeId(e.target.value)}
                          placeholder="VD: SHW_..."
                          className="h-12 w-full rounded-xl border border-slate-700 bg-[#0F172A] px-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Mã phòng chiếu
                        </label>
                        <input
                          type="text"
                          value={roomId}
                          onChange={(e) => setRoomId(e.target.value)}
                          placeholder="VD: RM01"
                          className="h-12 w-full rounded-xl border border-slate-700 bg-[#0F172A] px-4 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleLookupCustomersByShowtimeOrRoom()}
                        disabled={lookingUpCustomers}
                        className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 text-xs font-black uppercase tracking-wide text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FaSearch />
                        {lookingUpCustomers ? 'Đang tra cứu...' : 'Tra cứu & Lấy danh sách User ID'}
                      </button>
                    </div>
                  </div>

                  {voucherNeedsCustomerIds && (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 xl:col-span-2">
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-amber-300">
                        Khách hàng được nhận voucher *
                      </label>
                      <textarea
                        value={targetCustomerIds}
                        onChange={(e) => setTargetCustomerIds(e.target.value)}
                        rows={3}
                        placeholder="VD: CUS_001, USR_001, email@example.com hoặc mỗi dòng một khách"
                        className="w-full rounded-xl border border-amber-500/30 bg-[#0F172A] px-4 py-3 text-sm text-white outline-none transition resize-none focus:border-amber-300 focus:ring-2 focus:ring-amber-500/25"
                      />
                      <p className="mt-2 text-[11px] font-semibold text-amber-100/70">
                        Có thể dùng Customer Profile ID, User ID hoặc email. Hệ thống sẽ gửi thông báo đến đúng tài khoản.
                      </p>
                    </div>
                  )}

                  {applicableScope === 'FOOD_BEVERAGE_ONLY' && (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 xl:col-span-2">
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-amber-300">
                        F&B Item ID được áp dụng *
                      </label>
                      <textarea
                        value={specificFbItemIds}
                        onChange={(e) => setSpecificFbItemIds(e.target.value)}
                        rows={2}
                        placeholder="VD: FB_POPCORN_M, FB_PEPSI_L"
                        className="w-full rounded-xl border border-amber-500/30 bg-[#0F172A] px-4 py-3 text-sm text-white outline-none transition resize-none focus:border-amber-300 focus:ring-2 focus:ring-amber-500/25"
                      />
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-700 bg-[#111C44]/70 p-4 xl:col-span-2">
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Điều kiện mốc vé tích lũy
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={requiredTicketCount || ''}
                      onChange={(e) => setRequiredTicketCount(Number(e.target.value))}
                      placeholder="0 = không yêu cầu"
                      className="h-12 w-full rounded-xl border border-slate-700 bg-[#0F172A] px-4 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25"
                    />
                    <p className="mt-2 text-[11px] font-semibold text-slate-500">
                      Dùng cho voucher thưởng khi khách đạt số lượng vé đã đặt.
                    </p>
                  </div>
                </div>
              </div>

              <div className="hidden">
                <div>
                  <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                    <FaLayerGroup />
                    Điều kiện áp dụng voucher
                  </h3>
                  <p className="mt-1 text-[11px] font-semibold text-gray-400">
                    Các thông tin này quyết định voucher xuất hiện cho ai và áp dụng vào nhóm tiền nào.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
                    <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                      Nhóm voucher
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as VoucherCategory)}
                      className="min-h-12 w-full px-4 py-3 rounded-xl bg-[#0F172A] border border-slate-700 text-white text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25 transition cursor-pointer"
                    >
                      {voucherCategoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] font-semibold text-gray-500">
                      {voucherCategoryOptions.find((option) => option.value === category)?.hint}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                      Phạm vi giảm giá
                    </label>
                    <select
                      value={applicableScope}
                      onChange={(e) => {
                        const nextScope = e.target.value as VoucherApplicableScope;
                        setApplicableScope(nextScope);
                        if (nextScope !== 'FOOD_BEVERAGE_ONLY') {
                          setSpecificFbItemIds('');
                        }
                      }}
                      className="min-h-12 w-full px-4 py-3 rounded-xl bg-[#0F172A] border border-slate-700 text-white text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25 transition cursor-pointer"
                    >
                      {applicableScopeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                      Nhóm khách hàng
                    </label>
                    <select
                      value={targetType}
                      onChange={(e) => {
                        const nextTargetType = e.target.value as VoucherTargetType;
                        setTargetType(nextTargetType);
                        if (nextTargetType === 'ALL_CUSTOMERS') {
                          setIsPrivateVoucher(false);
                          setTargetCustomerIds('');
                        }
                      }}
                      className="min-h-12 w-full px-4 py-3 rounded-xl bg-[#0F172A] border border-slate-700 text-white text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25 transition cursor-pointer"
                    >
                      {targetTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className={`mt-2 rounded-lg px-3 py-2 text-[11px] font-bold ${
                      voucherNeedsCustomerIds
                        ? 'bg-amber-400/10 text-amber-200'
                        : 'bg-emerald-400/10 text-emerald-200'
                    }`}>
                      {voucherNeedsCustomerIds
                        ? 'Cần nhập Customer Profile ID, User ID hoặc email cho nhóm khách được nhận voucher.'
                        : 'Voucher đang công khai cho tất cả khách hàng đủ điều kiện.'}
                    </p>
                  </div>

                  <div className={`rounded-xl border px-4 py-3 transition ${
                    voucherNeedsCustomerIds
                      ? 'border-amber-400/40 bg-amber-400/10'
                      : 'border-slate-700 bg-[#0F172A]'
                  }`}>
                    <label className="flex min-h-12 cursor-pointer select-none items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isPrivateVoucher}
                        onChange={(e) => handlePrivateVoucherChange(e.target.checked)}
                        className="h-5 w-5 rounded border-slate-600 bg-slate-950 text-amber-400 focus:ring-amber-400"
                      />
                      <span>
                        <span className="block text-xs font-black uppercase text-white">
                          Voucher private
                        </span>
                        <span className="text-[11px] font-semibold text-gray-400">
                          Chỉ khách được chỉ định mới dùng được.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>

                {voucherNeedsCustomerIds && (
                  <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
                    <label className="block text-xs font-semibold uppercase text-amber-300 mb-1">
                      Khách hàng được nhận voucher *
                    </label>
                    <textarea
                      value={targetCustomerIds}
                      onChange={(e) => setTargetCustomerIds(e.target.value)}
                      rows={3}
                      placeholder="VD: CUS_001, USR_001, email@example.com hoặc mỗi dòng một khách"
                      className="w-full px-4 py-3 rounded-xl bg-[#0F172A] border border-amber-500/30 text-white text-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-500/25 transition resize-none"
                    />
                    <p className="mt-1 text-[10px] font-semibold text-gray-500">
                      Có thể dùng Customer Profile ID, User ID hoặc email. Hệ thống sẽ gửi thông báo đến đúng tài khoản.
                    </p>
                  </div>
                )}

                {applicableScope === 'FOOD_BEVERAGE_ONLY' && (
                  <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
                    <label className="block text-xs font-semibold uppercase text-amber-300 mb-1">
                      F&B Item ID được áp dụng *
                    </label>
                    <textarea
                      value={specificFbItemIds}
                      onChange={(e) => setSpecificFbItemIds(e.target.value)}
                      rows={2}
                      placeholder="VD: FB_POPCORN_M, FB_PEPSI_L"
                      className="w-full px-4 py-3 rounded-xl bg-[#0F172A] border border-amber-500/30 text-white text-sm outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-500/25 transition resize-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Điều kiện mốc vé tích lũy
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={requiredTicketCount || ''}
                    onChange={(e) => setRequiredTicketCount(Number(e.target.value))}
                    placeholder="0 = không yêu cầu"
                    className="w-full px-4 py-3 rounded-xl bg-[#0F172A] border border-slate-700 text-white text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25 transition"
                  />
                  <p className="mt-1 text-[10px] font-semibold text-gray-500">
                    Dùng cho voucher thưởng khi khách đạt số lượng vé đã đặt.
                  </p>
                </div>
              </div>

              {/* Status active */}
              {editingVoucher && (
                <div className="flex items-center pt-2">
                  <label className="inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={voucherStatus === 'ACTIVE'}
                      onChange={(e) => setVoucherStatus(e.target.checked ? 'ACTIVE' : 'INACTIVE')}
                      className="sr-only peer"
                    />
                    <div className="relative w-11 h-6 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ms-3 text-xs font-semibold uppercase text-gray-400">
                      Trạng thái: {voucherStatus === 'ACTIVE' ? 'Hoạt động' : 'Tạm khóa'}
                    </span>
                  </label>
                </div>
              )}

              {/* Actions Footer */}
              <div className="pt-4 border-t border-gray-800 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingVoucher(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-semibold text-white transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-sm font-semibold text-white hover:brightness-110 transition active:scale-95 disabled:opacity-50"
                >
                  {submitting && <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span>}
                  Lưu Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#111C44] text-white shadow-2xl">
            <div className={`flex items-start gap-3 border-b border-gray-800 p-5 ${
              confirmDialog.variant === 'danger' ? 'bg-red-500/10' : 'bg-amber-500/10'
            }`}>
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${
                confirmDialog.variant === 'danger'
                  ? 'border-red-400/30 bg-red-400/10 text-red-300'
                  : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
              }`}>
                <FaExclamationTriangle />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black">{confirmDialog.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-gray-300">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-bold text-gray-200 transition hover:bg-gray-700"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  void action();
                }}
                className={`rounded-xl px-4 py-2.5 text-sm font-black text-white transition hover:brightness-110 ${
                  confirmDialog.variant === 'danger'
                    ? 'bg-red-600'
                    : 'bg-amber-600'
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
