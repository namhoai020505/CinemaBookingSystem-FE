import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  FaBuilding,
  FaPlus,
  FaSearch,
  FaMapMarkerAlt,
  FaPhone,
  FaEdit,
  FaTrash,
  FaCity,
  FaTimes,
  FaCheckCircle,
} from 'react-icons/fa';
import { cinemaService, type CinemaResponse, type CreateCinemaPayload, type UpdateCinemaPayload } from '../../services/cinemaService';
import { confirmWithPopup } from '../../services/confirmDialogService';

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  ACTIVE: {
    label: 'Hoạt động',
    dot: 'bg-emerald-400 animate-pulse',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  INACTIVE: {
    label: 'Tạm dừng',
    dot: 'bg-red-400',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  MAINTENANCE: {
    label: 'Bảo trì',
    dot: 'bg-amber-400 animate-pulse',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
};

const getStatusBadge = (status: string) => {
  const cfg = STATUS_CONFIG[status] || {
    label: status,
    dot: 'bg-gray-400',
    badge: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-full text-xs font-medium ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

export default function ManageCinemas() {
  const [cinemas, setCinemas] = useState<CinemaResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCinema, setEditingCinema] = useState<CinemaResponse | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formStatus, setFormStatus] = useState('ACTIVE');
  const [submitting, setSubmitting] = useState(false);

  // Fetch Data
  const fetchCinemas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await cinemaService.getCinemas();
      setCinemas(data);
    } catch {
      toast.error('Không thể tải danh sách cụm rạp.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCinemas();
  }, [fetchCinemas]);

  // Handle Modal Open
  const handleOpenAddModal = () => {
    setEditingCinema(null);
    setFormName('');
    setFormAddress('');
    setFormCity('');
    setFormPhone('');
    setFormStatus('ACTIVE');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cinema: CinemaResponse) => {
    setEditingCinema(cinema);
    setFormName(cinema.cinemaName);
    setFormAddress(cinema.address);
    setFormCity(cinema.city);
    setFormPhone(cinema.phoneNumber || '');
    setFormStatus(cinema.cinemaStatus || 'ACTIVE');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCinema(null);
  };

  // Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      toast.error('Vui lòng nhập tên rạp chiếu.');
      return;
    }
    if (!formAddress.trim()) {
      toast.error('Vui lòng nhập địa chỉ rạp.');
      return;
    }
    if (!formCity.trim()) {
      toast.error('Vui lòng nhập tỉnh/thành phố.');
      return;
    }

    try {
      setSubmitting(true);

      if (editingCinema) {
        // Update
        const payload: UpdateCinemaPayload = {
          cinemaName: formName.trim(),
          address: formAddress.trim(),
          city: formCity.trim(),
          phoneNumber: formPhone.trim() || undefined,
          cinemaStatus: formStatus,
        };
        await cinemaService.updateCinema(editingCinema.cinemaId, payload);
        toast.success('Cập nhật rạp chiếu thành công!');
      } else {
        // Create
        const payload: CreateCinemaPayload = {
          cinemaName: formName.trim(),
          address: formAddress.trim(),
          city: formCity.trim(),
          phoneNumber: formPhone.trim() || undefined,
          cinemaStatus: formStatus,
        };
        await cinemaService.createCinema(payload);
        toast.success('Thêm cụm rạp mới thành công!');
      }

      handleCloseModal();
      void fetchCinemas();
    } catch {
      toast.error(editingCinema ? 'Không thể cập nhật thông tin rạp.' : 'Không thể tạo rạp mới.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete / Deactivate Cinema
  const handleDelete = async (cinema: CinemaResponse) => {
    const confirmed = await confirmWithPopup({
      title: 'Xóa / Tạm dừng rạp chiếu',
      message: `Bạn có chắc chắn muốn xóa hoặc chuyển rạp "${cinema.cinemaName}" sang trạng thái tạm dừng?`,
      confirmLabel: 'Xác nhận xóa',
    });

    if (!confirmed) return;

    try {
      await cinemaService.deleteCinema(cinema.cinemaId);
      toast.success('Đã cập nhật trạng thái rạp chiếu.');
      void fetchCinemas();
    } catch {
      toast.error('Thao tác thất bại.');
    }
  };

  // Filter Logic
  const filteredCinemas = cinemas.filter((item) => {
    const matchesSearch =
      item.cinemaName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.address.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || item.cinemaStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Unique Cities count
  const citiesCount = new Set(cinemas.map((c) => c.city)).size;
  const activeCinemasCount = cinemas.filter((c) => c.cinemaStatus === 'ACTIVE').length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl text-white shadow-lg shadow-blue-500/30">
            <FaBuilding className="text-2xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Quản Lý Cụm Rạp</h1>
            <p className="text-sm text-slate-400 mt-1">Danh sách hệ thống rạp chiếu phim toàn quốc</p>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-blue-600/30 transition-all duration-200 active:scale-95"
        >
          <FaPlus />
          <span>Thêm Rạp Mới</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">Tổng số cụm rạp</p>
            <p className="text-2xl font-bold text-white mt-1">{cinemas.length}</p>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl">
            <FaBuilding className="text-xl" />
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">Rạp đang hoạt động</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{activeCinemasCount}</p>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
            <FaCheckCircle className="text-xl" />
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">Tỉnh / Thành phủ phủ rộng</p>
            <p className="text-2xl font-bold text-indigo-400 mt-1">{citiesCount}</p>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
            <FaCity className="text-xl" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 p-4 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-center shadow-lg">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <input
            type="text"
            placeholder="Tìm theo tên rạp, thành phố..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/80 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-slate-400 whitespace-nowrap">Trạng thái:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="INACTIVE">Tạm dừng</option>
            <option value="MAINTENANCE">Bảo trì</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 text-center text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm">Đang tải danh sách rạp chiếu...</p>
          </div>
        ) : filteredCinemas.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <FaBuilding className="text-4xl text-slate-600 mx-auto" />
            <p className="text-base font-medium">Không tìm thấy rạp chiếu nào phù hợp</p>
            <p className="text-xs text-slate-500">Thử thay đổi từ khóa hoặc bộ lọc trạng thái</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/80 border-b border-white/10 text-xs uppercase text-slate-400 tracking-wider">
                <tr>
                  <th className="px-6 py-4">Mã & Tên rạp</th>
                  <th className="px-6 py-4">Địa chỉ & Thành phố</th>
                  <th className="px-6 py-4">Số điện thoại</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredCinemas.map((cinema) => (
                  <tr key={cinema.cinemaId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{cinema.cinemaName}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{cinema.cinemaId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <FaMapMarkerAlt className="text-red-400 text-xs shrink-0" />
                        <span>{cinema.address}</span>
                      </div>
                      <div className="text-xs text-indigo-400 mt-1 font-medium">{cinema.city}</div>
                    </td>
                    <td className="px-6 py-4">
                      {cinema.phoneNumber ? (
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <FaPhone className="text-blue-400 text-xs shrink-0" />
                          <span>{cinema.phoneNumber}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Chưa cập nhật</span>
                      )}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(cinema.cinemaStatus)}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(cinema)}
                        title="Chỉnh sửa rạp"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-medium transition-colors"
                      >
                        <FaEdit />
                        <span>Sửa</span>
                      </button>
                      <button
                        onClick={() => void handleDelete(cinema)}
                        title="Xóa hoặc Tạm dừng"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium transition-colors"
                      >
                        <FaTrash />
                        <span>Xóa</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Form Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-800/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FaBuilding className="text-blue-400" />
                <span>{editingCinema ? 'Chỉnh Sửa Thông Tin Rạp' : 'Thêm Cụm Rạp Mới'}</span>
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Tên rạp chiếu <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Cinema G2C Hà Nội"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Địa chỉ chi tiết <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Số 123 Đường Cầu Giấy, Phường Quan Hoa"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Tỉnh / Thành phố <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Hà Nội, TP.HCM..."
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Số điện thoại liên hệ
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 0243.888.9999"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Trạng thái hoạt động
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="ACTIVE">Hoạt động (Active)</option>
                  <option value="INACTIVE">Tạm dừng (Inactive)</option>
                  <option value="MAINTENANCE">Bảo trì (Maintenance)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-600/30 transition-all duration-200"
                >
                  {submitting ? 'Đang lưu...' : editingCinema ? 'Cập Nhật' : 'Tạo Rạp Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
