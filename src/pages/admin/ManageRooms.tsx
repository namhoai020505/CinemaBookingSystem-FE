import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { roomService } from '../../services/roomService';
import type { RoomResponse, CinemaResponse, CreateRoomPayload } from '../../services/roomService';
import { TEXT } from '../../constants/vi';

const ROOM_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: TEXT.ROOM.STATUS_ACTIVE, color: 'emerald' },
  { value: 'INACTIVE', label: TEXT.ROOM.STATUS_INACTIVE, color: 'red' },
  { value: 'MAINTENANCE', label: TEXT.ROOM.STATUS_MAINTENANCE, color: 'yellow' },
] as const;

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  ACTIVE: {
    label: TEXT.ROOM.STATUS_ACTIVE,
    dot: 'bg-emerald-400 animate-pulse',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  INACTIVE: {
    label: TEXT.ROOM.STATUS_INACTIVE,
    dot: 'bg-red-400',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  MAINTENANCE: {
    label: TEXT.ROOM.STATUS_MAINTENANCE,
    dot: 'bg-yellow-400 animate-pulse',
    badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  },
};

const getStatusBadge = (status: string) => {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return <span className="text-xs text-gray-400">{status}</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-xs font-semibold ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};


// Trang quản lý phòng chiếu: lọc theo rạp, thêm/sửa/xóa phòng và đi tới sơ đồ ghế.
export default function ManageRooms() {
  const navigate = useNavigate();

  // Data states
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [cinemas, setCinemas] = useState<CinemaResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [filterCinemaId, setFilterCinemaId] = useState<string>('ALL');

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
  // Tải đồng thời danh sách phòng và rạp để render bảng và form chọn rạp.
  const fetchData = async () => {
    try {
      setLoading(true);
      const [roomsData, cinemasData] = await Promise.all([
        roomService.getRooms(),
        roomService.getCinemas(),
      ]);
      setRooms(roomsData);
      setCinemas(cinemasData);
    } catch (err) {
      toast.error(TEXT.ROOM.ERR_FETCH_ROOMS);
    } finally {
      setLoading(false);
    }
  };

  // Lấy dữ liệu lần đầu khi admin mở trang phòng chiếu.
  useEffect(() => {
    void fetchData();
  }, []);

  // Esc to close modal
  // Đóng modal bằng phím Escape để thao tác quản trị nhanh hơn.
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
  const filteredRooms = rooms.filter((r) => {
    const matchCinema = filterCinemaId === 'ALL' || r.cinemaId === filterCinemaId;
    const matchStatus = filterStatus === 'ALL' || r.roomStatus === filterStatus;
    return matchCinema && matchStatus;
  });


  // ──────────────────────────────────────────
  // Modal handlers
  // ──────────────────────────────────────────
  // Chuẩn bị form trống khi admin muốn thêm phòng mới.
  const handleOpenAdd = () => {
    setEditingRoom(null);
    setFormCinemaId(cinemas[0]?.cinemaId || '');
    setFormRoomName('');
    setFormCapacity(100);
    setFormStatus('ACTIVE');
    setIsModalOpen(true);
  };

  // Đổ dữ liệu phòng hiện tại vào form để sửa.
  const handleOpenEdit = (room: RoomResponse) => {
    setEditingRoom(room);
    setFormCinemaId(room.cinemaId);
    setFormRoomName(room.roomName);
    setFormCapacity(room.capacity);
    setFormStatus(room.roomStatus);
    setIsModalOpen(true);
  };

  // Validate form rồi gọi API create/update phòng tùy đang thêm mới hay chỉnh sửa.
  const handleSubmit = async () => {
    if (!formRoomName.trim()) {
      toast.error(TEXT.ROOM.ERR_NAME_EMPTY);
      return;
    }
    if (!formCinemaId) {
      toast.error(TEXT.ROOM.ERR_CINEMA_EMPTY);
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
        toast.success(TEXT.ROOM.SUCCESS_UPDATE);
      } else {
        await roomService.createRoom(formCinemaId, payload);
        toast.success(TEXT.ROOM.SUCCESS_CREATE);
      }
      setIsModalOpen(false);
      setEditingRoom(null);
      await fetchData();
    } catch (err) {
      toast.error(TEXT.ROOM.ERR_SAVE);
    } finally {
      setSubmitting(false);
    }
  };

  // Xác nhận trước khi xóa phòng vì backend có thể xóa kèm sơ đồ ghế của phòng.
  const handleDelete = async (room: RoomResponse) => {
    const confirmed = window.confirm(TEXT.ROOM.CONFIRM_DEACTIVATE.replace("{0}", room.roomName));
    if (!confirmed) return;

    try {
      setLoading(true);
      await roomService.updateRoom(room.roomId, {
        roomName: room.roomName,
        capacity: room.capacity,
        roomStatus: 'INACTIVE',
      });
      toast.success(TEXT.ROOM.SUCCESS_DEACTIVATE.replace("{0}", room.roomName));
      await fetchData();
    } catch (err) {
      toast.error(TEXT.ROOM.ERR_DEACTIVATE);
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
          <h1 className="text-2xl font-bold uppercase tracking-wider">{TEXT.ROOM.TITLE}</h1>
          <p className="mt-1 text-xs text-gray-400">
            {TEXT.ROOM.SUBTITLE}
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-[#4318FF] hover:bg-blue-700 rounded-xl text-sm font-semibold transition shadow-lg shadow-[#4318FF]/20"
        >
          {TEXT.ROOM.BTN_ADD_ROOM}
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase text-gray-400 shrink-0">{TEXT.ROOM.FILTER_CINEMA}</label>
          <select
            value={filterCinemaId}
            onChange={(e) => setFilterCinemaId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition min-w-[180px]"
          >
            <option value="ALL">{TEXT.ROOM.FILTER_CINEMA_ALL}</option>
            {cinemas.map((c) => (
              <option key={c.cinemaId} value={c.cinemaId}>{c.cinemaName}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase text-gray-400 shrink-0">{TEXT.ROOM.FILTER_STATUS}</label>
          <div className="flex gap-1.5">
            {['ALL', 'ACTIVE', 'MAINTENANCE', 'INACTIVE'].map((s) => {
              const cfg = STATUS_CONFIG[s];
              const isSelected = filterStatus === s;
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${isSelected
                      ? s === 'ALL'
                        ? 'bg-[#4318FF] text-white border-[#4318FF]'
                        : `${cfg?.badge ?? ''} ring-2 ring-white/20`
                      : 'bg-gray-800/40 text-gray-400 border-gray-700 hover:bg-gray-700/60'
                    }`}
                >
                  {s === 'ALL' ? TEXT.ROOM.STATUS_ALL : (cfg?.label ?? s)}
                </button>
              );
            })}
          </div>
        </div>

        <span className="text-xs text-gray-500 ml-auto">
          {TEXT.ROOM.SHOWING_INFO.replace('{0}', String(filteredRooms.length)).replace('{1}', String(rooms.length))}
        </span>
      </div>

      {/* TABLE */}
      {loading && rooms.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#4318FF] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-400">{TEXT.ROOM.LOADING}</span>
          </div>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-12 text-center shadow-2xl">
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-gray-400 text-sm">
            {rooms.length === 0
              ? TEXT.ROOM.NO_ROOMS_SYSTEM
              : TEXT.ROOM.NO_ROOMS_FILTER}
          </p>
        </div>
      ) : (
        <div className="bg-[#111C44] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 bg-blue-950/20 text-xs uppercase text-gray-400 tracking-wider">
                <th className="p-4">{TEXT.ROOM.TH_NAME}</th>
                <th className="p-4">{TEXT.ROOM.TH_CINEMA}</th>
                <th className="p-4 text-center">{TEXT.ROOM.TH_CAPACITY}</th>
                <th className="p-4 text-center">{TEXT.ROOM.TH_SEATS}</th>
                <th className="p-4 text-center">{TEXT.ROOM.TH_STATUS}</th>
                <th className="p-4 text-center">{TEXT.ROOM.TH_ACTION}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50 text-sm">
              {filteredRooms.map((room) => {
                return (
                  <tr
                    key={room.roomId}
                    className={`hover:bg-blue-950/10 transition group ${room.roomStatus === 'INACTIVE' ? 'opacity-60' : ''}`}
                  >
                    <td className="p-4">
                      <div className="font-semibold text-white">{room.roomName}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5 font-mono">{room.roomId}</div>
                    </td>
                    <td className="p-4 text-gray-300">{room.cinemaName}</td>
                    <td className="p-4 text-center">
                      <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-xs font-semibold">
                        {room.capacity} {TEXT.ROOM.UNIT_CAPACITY}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${room.seatCount > 0
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                        }`}>
                        {room.seatCount} {TEXT.ROOM.UNIT_SEAT}
                      </span>
                    </td>
                    <td className="p-4 text-center">{getStatusBadge(room.roomStatus)}</td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2 flex-wrap">
                        {/* Seat layout button — only available for non-inactive rooms */}
                        <button
                          onClick={() => navigate(`/admin/rooms/${room.roomId}/seats`)}
                          className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 text-xs font-semibold rounded-lg transition"
                          title={TEXT.ROOM.BTN_SEAT_LAYOUT}
                        >
                          {TEXT.ROOM.BTN_SEAT_LAYOUT}
                        </button>

                        <button
                          onClick={() => handleOpenEdit(room)}
                          className="px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 text-xs font-semibold rounded-lg transition"
                        >
                          {TEXT.ROOM.BTN_EDIT}
                        </button>
                        <button
                          onClick={() => void handleDelete(room)}
                          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 text-xs font-semibold rounded-lg transition"
                        >
                          {TEXT.ROOM.BTN_DELETE}
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

      {/* ────────────────────────────────────── */}
      {/* MODAL THÊM / SỬA PHÒNG               */}
      {/* ────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-[#111C44] border border-gray-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-blue-950/20 shrink-0">
              <h2 className="text-lg font-bold text-white uppercase tracking-wide">
                {editingRoom ? TEXT.ROOM.MODAL_UPDATE_TITLE : TEXT.ROOM.MODAL_ADD_TITLE}
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
                  {TEXT.ROOM.LABEL_CINEMA} <span className="text-red-500">*</span>
                </label>
                <select
                  value={formCinemaId}
                  onChange={(e) => setFormCinemaId(e.target.value)}
                  disabled={!!editingRoom}
                  className={`w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition ${
                    editingRoom ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="" disabled>{TEXT.ROOM.PLACEHOLDER_CINEMA}</option>
                  {cinemas.map((c) => (
                    <option key={c.cinemaId} value={c.cinemaId}>{c.cinemaName}</option>
                  ))}
                </select>
                {editingRoom && (
                  <p className="text-[10px] text-gray-500 mt-1">{TEXT.ROOM.HINT_CINEMA_EDIT}</p>
                )}
              </div>

              {/* Room Name */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                  {TEXT.ROOM.LABEL_NAME} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formRoomName}
                  onChange={(e) => setFormRoomName(e.target.value)}
                  placeholder={TEXT.ROOM.PLACEHOLDER_NAME}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Capacity & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">
                    {TEXT.ROOM.LABEL_CAPACITY}
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
                    {TEXT.ROOM.LABEL_STATUS}
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
                {TEXT.ROOM.BTN_CANCEL}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className={`px-6 py-2 bg-[#4318FF] text-white font-semibold text-sm rounded-xl shadow-lg transition ${
                  submitting ? 'cursor-not-allowed opacity-70' : 'hover:bg-blue-700'
                }`}
              >
                {submitting
                  ? TEXT.ROOM.BTN_SUBMITTING
                  : editingRoom ? TEXT.ROOM.BTN_SUBMIT_UPDATE : TEXT.ROOM.BTN_SUBMIT_ADD
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
