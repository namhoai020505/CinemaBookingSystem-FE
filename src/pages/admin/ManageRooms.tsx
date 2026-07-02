import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { roomService } from '../../services/roomService';
import type { RoomResponse, CinemaResponse, CreateRoomPayload } from '../../services/roomService';

const ROOM_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Hoạt Động', color: 'emerald' },
  { value: 'INACTIVE', label: 'Ngừng Hoạt Động', color: 'red' },
  { value: 'MAINTENANCE', label: 'Bảo Trì', color: 'yellow' },
] as const;

// Trả về badge màu tương ứng với trạng thái phòng để bảng dễ scan.
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Hoạt Động
        </span>
      );
    case 'INACTIVE':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          Ngừng HĐ
        </span>
      );
    case 'MAINTENANCE':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-lg text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          Bảo Trì
        </span>
      );
    default:
      return <span className="text-xs text-gray-400">{status}</span>;
  }
};


export default function ManageRooms() {
  const navigate = useNavigate();

  // Data states
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [cinemas, setCinemas] = useState<CinemaResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCinemaId, setFilterCinemaId] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomResponse | null>(null);

  // Form
  const [formCinemaId, setFormCinemaId] = useState('');
  const [formRoomName, setFormRoomName] = useState('');
  const [formCapacity, setFormCapacity] = useState(100);
  const [formStatus, setFormStatus] = useState('ACTIVE');
  const [submitting, setSubmitting] = useState(false);

  // ──────────────────────────────────────────
  // Data fetching
  // ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [roomsData, cinemasData] = await Promise.all([
        roomService.getRooms(),
        roomService.getCinemas(),
      ]);
      setRooms(roomsData);
      setCinemas(cinemasData);
    } catch (err) {
      console.error('Lỗi tải dữ liệu phòng chiếu:', err);
      toast.error('Không thể tải dữ liệu phòng chiếu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Esc to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
        setEditingRoom(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // ──────────────────────────────────────────
  // Filtered data
  // ──────────────────────────────────────────
  // Lọc phòng theo rạp được chọn, chọn ALL thì hiển thị toàn bộ.
  const filteredRooms = filterCinemaId === 'ALL'
    ? rooms
    : rooms.filter((r) => r.cinemaId === filterCinemaId);

  // ──────────────────────────────────────────
  // Modal handlers
  // ──────────────────────────────────────────
  const handleOpenAdd = () => {
    setEditingRoom(null);
    setFormCinemaId(cinemas[0]?.cinemaId || '');
    setFormRoomName('');
    setFormCapacity(100);
    setFormStatus('ACTIVE');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (room: RoomResponse) => {
    setEditingRoom(room);
    setFormCinemaId(room.cinemaId);
    setFormRoomName(room.roomName);
    setFormCapacity(room.capacity);
    setFormStatus(room.roomStatus);
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formRoomName.trim()) {
      toast.error('Tên phòng không được để trống!');
      return;
    }
    if (!formCinemaId) {
      toast.error('Vui lòng chọn rạp chiếu!');
      return;
    }

    const payload: CreateRoomPayload = {
      roomName: formRoomName.trim(),
      capacity: formCapacity,
      roomStatus: formStatus,
    };

    try {
      setSubmitting(true);
      if (editingRoom) {
        await roomService.updateRoom(editingRoom.roomId, payload);
        toast.success('Cập nhật phòng chiếu thành công!');
      } else {
        await roomService.createRoom(formCinemaId, payload);
        toast.success('Thêm phòng chiếu mới thành công!');
      }
      setIsModalOpen(false);
      setEditingRoom(null);
      await fetchData();
    } catch (err) {
      console.error('Lỗi lưu phòng chiếu:', err);
      toast.error('Lưu phòng chiếu thất bại. Kiểm tra lại dữ liệu.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (room: RoomResponse) => {
    const confirmed = window.confirm(
      `⚠️ Bạn có chắc chắn muốn xóa phòng "${room.roomName}" khỏi hệ thống? Tất cả ghế trong phòng cũng sẽ bị xóa.`
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      await roomService.deleteRoom(room.roomId);
      toast.success(`Đã xóa phòng "${room.roomName}" thành công!`);
      await fetchData();
    } catch (err) {
      console.error('Lỗi xóa phòng:', err);
      toast.error('Xóa phòng thất bại. Có thể phòng đang được sử dụng.');
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0A0C] p-6 text-white font-['Urbanist']">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wider">Quản Lý Phòng Chiếu</h1>
          <p className="mt-1 text-xs text-gray-400">
            Quản lý danh sách phòng chiếu, sức chứa và sơ đồ ghế cho từng rạp.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-[#4318FF] hover:bg-blue-700 rounded-xl text-sm font-semibold transition shadow-lg shadow-[#4318FF]/20"
        >
          + Thêm Phòng Mới
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="mb-5 flex items-center gap-3">
        <label className="text-xs font-semibold uppercase text-gray-400">Lọc theo rạp:</label>
        <select
          value={filterCinemaId}
          onChange={(e) => setFilterCinemaId(e.target.value)}
          className="px-4 py-2 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition min-w-[220px]"
        >
          <option value="ALL">Tất cả rạp</option>
          {cinemas.map((c) => (
            <option key={c.cinemaId} value={c.cinemaId}>{c.cinemaName}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500 ml-auto">
          Hiển thị {filteredRooms.length} / {rooms.length} phòng
        </span>
      </div>

      {/* TABLE */}
      {loading && rooms.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#4318FF] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-400">Đang tải dữ liệu...</span>
          </div>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-12 text-center shadow-2xl">
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-gray-400 text-sm">
            {rooms.length === 0
              ? 'Chưa có phòng chiếu nào trong hệ thống.'
              : 'Không có phòng chiếu nào thuộc rạp đã chọn.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#111C44] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 bg-blue-950/20 text-xs uppercase text-gray-400 tracking-wider">
                <th className="p-4">Tên Phòng</th>
                <th className="p-4">Rạp</th>
                <th className="p-4 text-center">Sức Chứa</th>
                <th className="p-4 text-center">Số Ghế</th>
                <th className="p-4 text-center">Trạng Thái</th>
                <th className="p-4 text-center">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50 text-sm">
              {filteredRooms.map((room) => (
                <tr key={room.roomId} className="hover:bg-blue-950/10 transition group">
                  <td className="p-4">
                    <div className="font-semibold text-white">{room.roomName}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 font-mono">{room.roomId}</div>
                  </td>
                  <td className="p-4 text-gray-300">{room.cinemaName}</td>
                  <td className="p-4 text-center">
                    <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-xs font-semibold">
                      {room.capacity} chỗ
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                      room.seatCount > 0
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                    }`}>
                      {room.seatCount} ghế
                    </span>
                  </td>
                  <td className="p-4 text-center">{getStatusBadge(room.roomStatus)}</td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => navigate(`/admin/rooms/${room.roomId}/seats`)}
                        className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 text-xs font-semibold rounded-lg transition"
                        title="Thiết kế sơ đồ ghế"
                      >
                        Sơ Đồ Ghế
                      </button>
                      <button
                        onClick={() => handleOpenEdit(room)}
                        className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 text-xs font-semibold rounded-lg transition"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(room)}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-xs font-semibold rounded-lg transition"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ────────────────────────────────────── */}
      {/* MODAL THÊM / SỬA PHÒNG               */}
      {/* ────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-[#111C44] border border-gray-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-blue-950/20 shrink-0">
              <h2 className="text-lg font-bold text-white uppercase tracking-wide">
                {editingRoom ? '✏️ Cập Nhật Phòng Chiếu' : '✨ Thêm Phòng Chiếu Mới'}
              </h2>
              <button
                onClick={() => { setIsModalOpen(false); setEditingRoom(null); }}
                className="text-gray-400 hover:text-white text-xl transition"
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Cinema Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                  Rạp Chiếu <span className="text-red-500">*</span>
                </label>
                <select
                  value={formCinemaId}
                  onChange={(e) => setFormCinemaId(e.target.value)}
                  disabled={!!editingRoom}
                  className={`w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition ${editingRoom ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                >
                  <option value="" disabled>-- Chọn rạp chiếu --</option>
                  {cinemas.map((c) => (
                    <option key={c.cinemaId} value={c.cinemaId}>{c.cinemaName}</option>
                  ))}
                </select>
                {editingRoom && (
                  <p className="text-[10px] text-gray-500 mt-1">Không thể thay đổi rạp khi sửa phòng.</p>
                )}
              </div>

              {/* Room Name */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                  Tên Phòng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formRoomName}
                  onChange={(e) => setFormRoomName(e.target.value)}
                  placeholder="Ví dụ: Phòng 1 - 2D Dolby"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Capacity & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Sức Chứa
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    Trạng Thái
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
                  >
                    {ROOM_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-800 flex justify-end gap-3 bg-blue-950/10 shrink-0">
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); setEditingRoom(null); }}
                className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-sm rounded-xl transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className={`px-6 py-2 bg-[#4318FF] text-white font-semibold text-sm rounded-xl shadow-lg transition ${submitting ? 'cursor-not-allowed opacity-70' : 'hover:bg-blue-700'
                  }`}
              >
                {submitting
                  ? 'Đang xử lý...'
                  : editingRoom ? 'Cập Nhật' : 'Lưu Phòng'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
