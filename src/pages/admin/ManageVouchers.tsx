import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FaTicketAlt, FaPlus, FaEdit, FaTrashAlt, FaTimes, FaSearch, FaPercent, FaMoneyBillWave } from 'react-icons/fa';
import { voucherService } from '../../services/voucherService';
import type { Voucher, CreateVoucherPayload, UpdateVoucherPayload } from '../../services/voucherService';

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
  const [filterType, setFilterType] = useState<'ALL' | 'PERCENT' | 'AMOUNT'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);

  // Form State
  const [voucherCode, setVoucherCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [minOrderAmount, setMinOrderAmount] = useState<number>(0);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<number>(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [usageLimit, setUsageLimit] = useState<number>(100);
  const [perCustomerLimit, setPerCustomerLimit] = useState<number>(1);
  const [voucherStatus, setVoucherStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [submitting, setSubmitting] = useState(false);

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
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi tải danh sách voucher');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterStatus]);

  useEffect(() => {
    fetchVouchers();
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
    setIsModalOpen(true);
  };

  // Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!voucherCode.trim()) {
      toast.error('Mã voucher không được để trống');
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

    setSubmitting(true);

    try {
      const cleanCode = voucherCode.trim().toUpperCase();
      const titleVal = title.trim() || `Giảm giá ${cleanCode}`;
      const descVal = description.trim() || `Mã giảm giá áp dụng cho đơn hàng từ G2Cinema`;

      if (editingVoucher) {
        const payload: UpdateVoucherPayload = {
          title: titleVal,
          description: descVal,
          voucherStatus,
          minOrderAmount,
          maxDiscountAmount: discountType === 'AMOUNT' ? discountValue : maxDiscountAmount,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          usageLimit,
          perCustomerLimit,
        };
        const response = await voucherService.updateVoucher(editingVoucher.voucherId, payload);
        if (response.success) {
          toast.success(response.message || 'Cập nhật voucher thành công');
          setIsModalOpen(false);
          setEditingVoucher(null);
          fetchVouchers();
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
          maxDiscountAmount: discountType === 'AMOUNT' ? discountValue : maxDiscountAmount,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          usageLimit,
          perCustomerLimit,
        };
        const response = await voucherService.createVoucher(payload);
        if (response.success) {
          toast.success(response.message || 'Thêm voucher mới thành công');
          setIsModalOpen(false);
          fetchVouchers();
        } else {
          toast.error(response.message || 'Thêm voucher mới thất bại');
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi lưu thông tin voucher');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete voucher
  const handleDelete = async (voucher: Voucher) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa voucher ${voucher.voucherCode}?`)) {
      return;
    }

    try {
      const response = await voucherService.deleteVoucher(voucher.voucherId);
      if (response.success) {
        toast.success(response.message || 'Xóa voucher thành công');
        fetchVouchers();
      } else {
        toast.error(response.message || 'Xóa voucher thất bại');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi xóa voucher');
    }
  };

  // Toggle quick status
  const handleToggleStatus = async (voucher: Voucher) => {
    try {
      const newStatus = voucher.voucherStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
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
      };
      const response = await voucherService.updateVoucher(voucher.voucherId, payload);
      if (response.success) {
        toast.success(`Đã ${newStatus === 'ACTIVE' ? 'kích hoạt' : 'vô hiệu hóa'} voucher ${voucher.voucherCode}`);
        fetchVouchers();
      } else {
        toast.error(response.message || 'Thay đổi trạng thái voucher thất bại');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi thay đổi trạng thái voucher');
    }
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
            onChange={(e) => setFilterType(e.target.value as any)}
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
            onChange={(e) => setFilterStatus(e.target.value as any)}
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
                  <th className="p-4">Loại & Mức Giảm</th>
                  <th className="p-4 text-center">Đơn Tối Thiểu</th>
                  <th className="p-4 text-center">Giảm Tối Đa</th>
                  <th className="p-4 text-center">Đã Dùng / Giới Hạn</th>
                  <th className="p-4">Thời Gian Khả Dụng</th>
                  <th className="p-4 text-center">Trạng Trạng</th>
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
          <div className="bg-[#111C44] border border-gray-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] text-white">
            {/* Header */}
            <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-blue-950/20 shrink-0">
              <h2 className="text-lg font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <FaTicketAlt className="text-blue-500" />
                {editingVoucher ? 'Cập Nhật Voucher' : 'Tạo Voucher Mới'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingVoucher(null);
                }}
                className="text-gray-400 hover:text-white text-xl transition bg-transparent border-0 cursor-pointer"
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
                      setDiscountType(e.target.value as any);
                      setDiscountValue(0);
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
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
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
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
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
                    <span className="ms-3 text-xs font-semibold uppercase text-gray-400">Trạng thái: Hoạt động</span>
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
    </div>
  );
}
