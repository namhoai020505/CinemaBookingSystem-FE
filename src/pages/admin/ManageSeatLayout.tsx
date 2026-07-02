import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { roomService } from '../../services/roomService';
import type { RoomResponse, SeatResponse } from '../../services/roomService';

// ============================================================
// Constants
// ============================================================
const SEAT_TYPES = [
  { id: 'SEAT_TYPE_NORMAL', label: 'Normal', color: '#4B5563', hoverColor: '#6B7280', selectedBorder: '#9CA3AF' },
  { id: 'SEAT_TYPE_VIP', label: 'VIP', color: '#3B82F6', hoverColor: '#60A5FA', selectedBorder: '#93C5FD' },
  { id: 'SEAT_TYPE_SWEETBOX', label: 'Sweetbox', color: '#EC4899', hoverColor: '#F472B6', selectedBorder: '#F9A8D4' },
] as const;

// Lấy cấu hình màu/label của từng loại ghế để dùng lại ở grid và legend.
const getSeatColor = (seatTypeId: string) => {
  const found = SEAT_TYPES.find((t) => t.id === seatTypeId);
  return found ?? SEAT_TYPES[0];
};

// ============================================================
// Component
// ============================================================
// Trang cấu hình sơ đồ ghế cho một phòng chiếu cụ thể.
export default function ManageSeatLayout() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  // Data
  const [room, setRoom] = useState<RoomResponse | null>(null);
  const [seats, setSeats] = useState<SeatResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Selection
  const [selectedSeatIds, setSelectedSeatIds] = useState<Set<string>>(new Set());

  // Generator form
  const [genRows, setGenRows] = useState(8);
  const [genCols, setGenCols] = useState(12);
  const [genType, setGenType] = useState('SEAT_TYPE_NORMAL');

  // Batch edit
  const [batchType, setBatchType] = useState('SEAT_TYPE_VIP');

  // ──────────────────────────────────────────
  // Data fetching
  // ──────────────────────────────────────────
  // Tải thông tin phòng và danh sách ghế hiện tại của phòng.
  const fetchData = useCallback(async () => {
    if (!roomId) return;
    try {
      setLoading(true);
      const [roomData, seatsData] = await Promise.all([
        roomService.getRoomById(roomId),
        roomService.getSeatMap(roomId),
      ]);
      setRoom(roomData);
      setSeats(seatsData);
    } catch (err) {
      console.error('Lỗi tải dữ liệu phòng:', err);
      toast.error('Không thể tải dữ liệu phòng chiếu.');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // Gọi fetchData khi roomId thay đổi để luôn hiển thị đúng phòng đang quản lý.
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ──────────────────────────────────────────
  // Seat grid grouping
  // ──────────────────────────────────────────
  // Gom danh sách ghế phẳng thành từng hàng để render giống sơ đồ phòng chiếu.
  const seatGrid = (() => {
    const rowMap = new Map<string, SeatResponse[]>();
    for (const seat of seats) {
      const existing = rowMap.get(seat.rowLabel) || [];
      existing.push(seat);
      rowMap.set(seat.rowLabel, existing);
    }
    // Sort each row by seatNumber
    for (const [, rowSeats] of rowMap) {
      rowSeats.sort((a, b) => a.seatNumber - b.seatNumber);
    }
    // Sort rows alphabetically
    const sortedRows = Array.from(rowMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return sortedRows;
  })();

  // Số cột lớn nhất giúp căn chỉnh header/grid ngay cả khi các hàng không đều nhau.
  const maxCols = seatGrid.reduce((max, [, rowSeats]) => Math.max(max, rowSeats.length), 0);

  // ──────────────────────────────────────────
  // Selection handlers
  // ──────────────────────────────────────────
  // Chọn hoặc bỏ chọn một ghế trong grid để thao tác hàng loạt.
  const toggleSeat = (seatId: string) => {
    setSelectedSeatIds((prev) => {
      const next = new Set(prev);
      if (next.has(seatId)) {
        next.delete(seatId);
      } else {
        next.add(seatId);
      }
      return next;
    });
  };

  // Chọn/bỏ chọn toàn bộ ghế trong một hàng.
  const toggleRow = (rowLabel: string) => {
    const rowSeats = seats.filter((s) => s.rowLabel === rowLabel);
    const allSelected = rowSeats.every((s) => selectedSeatIds.has(s.seatId));
    setSelectedSeatIds((prev) => {
      const next = new Set(prev);
      for (const s of rowSeats) {
        if (allSelected) {
          next.delete(s.seatId);
        } else {
          next.add(s.seatId);
        }
      }
      return next;
    });
  };

  // Toggle chọn toàn bộ ghế trong phòng.
  const selectAll = () => {
    if (selectedSeatIds.size === seats.length) {
      setSelectedSeatIds(new Set());
    } else {
      setSelectedSeatIds(new Set(seats.map((s) => s.seatId)));
    }
  };

  // Xóa toàn bộ lựa chọn hiện tại.
  const clearSelection = () => setSelectedSeatIds(new Set());

  // ──────────────────────────────────────────
  // Auto generate seats
  // ──────────────────────────────────────────
  // Sinh lại sơ đồ ghế theo số hàng/cột/type admin nhập.
  const handleGenerateSeats = async () => {
    if (!roomId) return;

    if (seats.length > 0) {
      const confirmed = window.confirm(
        `⚠️ Phòng hiện đã có ${seats.length} ghế. Tất cả ghế cũ sẽ bị XÓA và thay thế bằng sơ đồ mới (${genRows}×${genCols} = ${genRows * genCols} ghế). Tiếp tục?`
      );
      if (!confirmed) return;
    }

    try {
      setActionLoading(true);

      // Step 1: Delete existing seats one-by-one (sequential) so the backend
      // processes each before the next, avoiding race conditions.
      // Collect any that fail (e.g. tied to an active showtime).
      if (seats.length > 0) {
        const failedSeats: string[] = [];
        for (const seat of seats) {
          try {
            await roomService.deleteSeat(seat.seatId);
          } catch {
            failedSeats.push(seat.seatCode);
          }
        }

        if (failedSeats.length > 0) {
          // Some seats could not be removed — backend blocked them.
          toast.error(
            `Không thể xóa ${failedSeats.length} ghế đang được dùng bởi suất chiếu: ${failedSeats.slice(0, 8).join(', ')}${failedSeats.length > 8 ? '...' : ''}. Vui lòng hủy hoặc xóa các suất chiếu liên quan trước.`,
            { autoClose: 8000 }
          );
          await fetchData();
          return;
        }
      }

      // Step 2: Create each seat individually via POST /api/seats.
      // This bypasses generate-seats entirely, so soft-deleted seat records
      // still in the DB no longer cause a 409 Conflict.
      const totalSeats = genRows * genCols;
      let created = 0;
      const createFailed: string[] = [];

      for (let r = 0; r < genRows; r++) {
        const rowLabel = String.fromCharCode(65 + r); // A, B, C, ...
        for (let c = 1; c <= genCols; c++) {
          try {
            await roomService.createSeat({
              roomId,
              rowLabel,
              seatNumber: c,
              seatTypeId: genType,
            });
            created++;
          } catch {
            createFailed.push(`${rowLabel}${c}`);
          }
        }
      }

      if (createFailed.length > 0) {
        toast.warn(
          `Tạo được ${created}/${totalSeats} ghế. Không thể tạo: ${createFailed.slice(0, 8).join(', ')}${createFailed.length > 8 ? ` (+${createFailed.length - 8} nữa)` : ''}.`,
          { autoClose: 8000 }
        );
      } else {
        toast.success(`Đã tạo ${created} ghế thành công!`);
      }

      setSelectedSeatIds(new Set());
      await fetchData();
    } catch (err: unknown) {
      console.error('Lỗi sinh ghế:', err);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message ?? 'Sinh ghế thất bại. Vui lòng thử lại.');

      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  // ──────────────────────────────────────────
  // Batch operations
  // ──────────────────────────────────────────
  // Đổi loại ghế cho toàn bộ ghế đang được chọn.
  const handleBatchChangeType = async () => {
    if (selectedSeatIds.size === 0) {
      toast.error('Vui lòng chọn ít nhất 1 ghế!');
      return;
    }

    try {
      setActionLoading(true);
      const promises = Array.from(selectedSeatIds).map((seatId) => {
        const seat = seats.find((s) => s.seatId === seatId);
        if (!seat) return Promise.resolve();
        return roomService.updateSeat(seatId, {
          rowLabel: seat.rowLabel,
          seatNumber: seat.seatNumber,
          seatTypeId: batchType,
        });
      });
      await Promise.all(promises);
      toast.success(`Đã đổi loại ${selectedSeatIds.size} ghế thành công!`);
      setSelectedSeatIds(new Set());
      await fetchData();
    } catch (err) {
      console.error('Lỗi batch update:', err);
      toast.error('Cập nhật ghế thất bại.');
    } finally {
      setActionLoading(false);
    }
  };

  // Backend DELETE /api/seats/{seatId} = soft-delete (set isActive = false)
  // There is no "reactivate" endpoint, so we only support deactivation.
  // Vô hiệu hóa các ghế đã chọn để không hiển thị cho khách hàng.
  const handleBatchDeactivate = async () => {
    if (selectedSeatIds.size === 0) {
      toast.error('Vui lòng chọn ít nhất 1 ghế!');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ Bạn sắp vô hiệu hóa ${selectedSeatIds.size} ghế. Ghế đã vô hiệu hóa sẽ không hiển thị cho khách hàng. Tiếp tục?`
    );
    if (!confirmed) return;

    try {
      setActionLoading(true);
      let deactivated = 0;
      const failed: string[] = [];

      for (const seatId of Array.from(selectedSeatIds)) {
        try {
          await roomService.deleteSeat(seatId);
          deactivated++;
        } catch {
          const seat = seats.find((s) => s.seatId === seatId);
          failed.push(seat?.seatCode ?? seatId);
        }
      }

      if (failed.length > 0) {
        toast.warn(
          `Vô hiệu hóa được ${deactivated}/${selectedSeatIds.size} ghế. ` +
          `${failed.length} ghế bị chặn (đang dùng bởi suất chiếu): ${failed.slice(0, 6).join(', ')}${failed.length > 6 ? ` (+${failed.length - 6} nữa)` : ''}.`,
          { autoClose: 8000 }
        );
      } else {
        toast.success(`Đã vô hiệu hóa ${deactivated} ghế!`);
      }

      setSelectedSeatIds(new Set());
      await fetchData();
    } catch (err) {
      console.error('Lỗi vô hiệu hóa ghế:', err);
      toast.error('Vô hiệu hóa thất bại.');
    } finally {
      setActionLoading(false);
    }
  };

  // Xóa mềm các ghế đã chọn; backend vẫn có thể chặn nếu ghế đang liên quan suất chiếu.
  const handleBatchDelete = async () => {
    if (selectedSeatIds.size === 0) {
      toast.error('Vui lòng chọn ít nhất 1 ghế!');
      return;
    }
    const confirmed = window.confirm(
      `⚠️ Bạn sắp XÓA ${selectedSeatIds.size} ghế. Hành động này không thể hoàn tác. Tiếp tục?`
    );
    if (!confirmed) return;

    try {
      setActionLoading(true);
      let deleted = 0;
      const failed: string[] = [];

      for (const seatId of Array.from(selectedSeatIds)) {
        try {
          await roomService.deleteSeat(seatId);
          deleted++;
        } catch {
          const seat = seats.find((s) => s.seatId === seatId);
          failed.push(seat?.seatCode ?? seatId);
        }
      }

      if (failed.length > 0) {
        toast.warn(
          `Xóa được ${deleted}/${selectedSeatIds.size} ghế. ` +
          `${failed.length} ghế bị chặn (đang dùng bởi suất chiếu): ${failed.slice(0, 6).join(', ')}${failed.length > 6 ? ` (+${failed.length - 6} nữa)` : ''}.`,
          { autoClose: 8000 }
        );
      } else {
        toast.success(`Đã xóa ${deleted} ghế thành công!`);
      }

      setSelectedSeatIds(new Set());
      await fetchData();
    } catch (err) {
      console.error('Lỗi xóa ghế:', err);
      toast.error('Xóa ghế thất bại.');
    } finally {
      setActionLoading(false);
    }
  };

  // ──────────────────────────────────────────
  // Stats
  // ──────────────────────────────────────────
  // Tính nhanh số lượng từng loại ghế để hiển thị các card thống kê.
  const seatStats = (() => {
    const stats = { total: seats.length, normal: 0, vip: 0, sweetbox: 0, inactive: 0 };
    for (const s of seats) {
      if (!s.isActive) stats.inactive++;
      if (s.seatTypeId === 'SEAT_TYPE_NORMAL') stats.normal++;
      else if (s.seatTypeId === 'SEAT_TYPE_VIP') stats.vip++;
      else if (s.seatTypeId === 'SEAT_TYPE_SWEETBOX') stats.sweetbox++;
    }
    return stats;
  })();

  // ──────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0C] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#4318FF] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400 font-['Urbanist']">Đang tải sơ đồ ghế...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0C] p-6 text-white font-['Urbanist']">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/rooms')}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-semibold transition flex items-center gap-2"
        >
          <span>←</span> Quay lại
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold uppercase tracking-wider">
            Sơ Đồ Ghế
          </h1>
          <p className="mt-0.5 text-xs text-gray-400">
            {room ? `${room.roomName} — ${room.cinemaName}` : `Phòng ${roomId}`}
            {room && (
              <span className="ml-2 text-gray-500">· Sức chứa: {room.capacity}</span>
            )}
          </p>
        </div>
      </div>

      {/* MAIN LAYOUT: Grid + Control Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">

        {/* ═══════════════════════════════════════ */}
        {/* LEFT: SEAT GRID                        */}
        {/* ═══════════════════════════════════════ */}
        <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-6 shadow-2xl overflow-x-auto">
          {seats.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">💺</div>
              <p className="text-gray-400 text-sm mb-2">Phòng chiếu chưa có ghế nào.</p>
              <p className="text-gray-500 text-xs">Sử dụng bảng điều khiển bên phải để sinh ghế tự động.</p>
            </div>
          ) : (
            <>
              {/* Screen indicator */}
              <div className="text-center mb-6">
                <div className="mx-auto max-w-md h-2 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent rounded-full" />
                <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mt-1 block">Màn Hình</span>
              </div>

              {/* Seat Grid */}
              <div className="flex flex-col items-center gap-1.5">
                {seatGrid.map(([rowLabel, rowSeats]) => {
                  const allRowSelected = rowSeats.every((s) => selectedSeatIds.has(s.seatId));
                  return (
                    <div key={rowLabel} className="flex items-center gap-1.5">
                      {/* Row label */}
                      <button
                        onClick={() => toggleRow(rowLabel)}
                        className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-bold transition-all duration-150 ${
                          allRowSelected
                            ? 'bg-[#4318FF] text-white'
                            : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-white'
                        }`}
                        title={`Chọn tất cả hàng ${rowLabel}`}
                      >
                        {rowLabel}
                      </button>

                      {/* Seats */}
                      {rowSeats.map((seat) => {
                        const typeInfo = getSeatColor(seat.seatTypeId);
                        const isSelected = selectedSeatIds.has(seat.seatId);
                        const isInactive = !seat.isActive;

                        return (
                          <button
                            key={seat.seatId}
                            onClick={() => toggleSeat(seat.seatId)}
                            className="relative transition-all duration-150 group/seat"
                            title={`${seat.seatCode} · ${typeInfo.label}${isInactive ? ' (Không HĐ)' : ''}`}
                            style={{
                              width: maxCols > 14 ? 32 : 40,
                              height: maxCols > 14 ? 32 : 40,
                            }}
                          >
                            <div
                              className={`w-full h-full rounded-lg flex items-center justify-center text-[10px] font-bold transition-all duration-150 ${
                                isSelected
                                  ? 'ring-2 ring-white scale-110 shadow-lg'
                                  : 'hover:scale-105'
                              } ${isInactive ? 'opacity-30' : ''}`}
                              style={{
                                backgroundColor: isSelected ? typeInfo.hoverColor : typeInfo.color,
                              }}
                            >
                              {seat.seatNumber}
                              {isInactive && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-full h-[2px] bg-red-500 rotate-45 absolute" />
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}

                      {/* Right row label */}
                      <span className="w-8 h-8 flex items-center justify-center text-xs font-bold text-gray-600">
                        {rowLabel}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Select All / Clear */}
              <div className="flex justify-center gap-3 mt-5">
                <button
                  onClick={selectAll}
                  className="px-3 py-1.5 bg-gray-800/60 hover:bg-gray-700 text-xs text-gray-300 rounded-lg transition"
                >
                  {selectedSeatIds.size === seats.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
                {selectedSeatIds.size > 0 && (
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1.5 bg-gray-800/60 hover:bg-gray-700 text-xs text-gray-300 rounded-lg transition"
                  >
                    Bỏ chọn ({selectedSeatIds.size})
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* ═══════════════════════════════════════ */}
        {/* RIGHT: CONTROL PANEL                   */}
        {/* ═══════════════════════════════════════ */}
        <div className="space-y-5">
          {/* ── Stats ── */}
          <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-300 mb-3">Thống Kê Ghế</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#0F172A] rounded-xl p-3 text-center border border-gray-800">
                <div className="text-xl font-bold text-white">{seatStats.total}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Tổng Ghế</div>
              </div>
              <div className="bg-[#0F172A] rounded-xl p-3 text-center border border-gray-800">
                <div className="text-xl font-bold text-gray-400">{seatStats.normal}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Normal</div>
              </div>
              <div className="bg-[#0F172A] rounded-xl p-3 text-center border border-gray-800">
                <div className="text-xl font-bold text-blue-400">{seatStats.vip}</div>
                <div className="text-[10px] text-blue-500 uppercase tracking-wider mt-0.5">VIP</div>
              </div>
              <div className="bg-[#0F172A] rounded-xl p-3 text-center border border-gray-800">
                <div className="text-xl font-bold text-pink-400">{seatStats.sweetbox}</div>
                <div className="text-[10px] text-pink-500 uppercase tracking-wider mt-0.5">Sweetbox</div>
              </div>
            </div>
          </div>

          {/* ── Auto Generator ── */}
          <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-300 mb-3">
              ⚡ Sinh Ghế Tự Động
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">Số Hàng</label>
                  <input
                    type="number"
                    min={1}
                    max={26}
                    value={genRows}
                    onChange={(e) => setGenRows(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">Số Cột</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={genCols}
                    onChange={(e) => setGenCols(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">Loại Ghế Mặc Định</label>
                <select
                  value={genType}
                  onChange={(e) => setGenType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
                >
                  {SEAT_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="bg-[#0F172A] rounded-lg p-2.5 border border-gray-800">
                <span className="text-xs text-gray-400">
                  Sẽ tạo <span className="text-white font-bold">{genRows * genCols}</span> ghế
                  ({genRows} hàng × {genCols} cột)
                </span>
              </div>
              <button
                onClick={handleGenerateSeats}
                disabled={actionLoading}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition shadow-lg ${
                  actionLoading
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-[#4318FF] hover:bg-blue-700 text-white shadow-[#4318FF]/20'
                }`}
              >
                {actionLoading ? 'Đang xử lý...' : '⚡ Sinh Ghế Ngay'}
              </button>
            </div>
          </div>

          {/* ── Batch Editor ── */}
          <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-300 mb-1">
              🎯 Chỉnh Sửa Hàng Loạt
            </h3>
            <p className="text-[10px] text-gray-500 mb-3">
              Đã chọn: <span className="text-white font-bold">{selectedSeatIds.size}</span> ghế
            </p>

            {selectedSeatIds.size === 0 ? (
              <div className="bg-[#0F172A] rounded-xl p-4 text-center border border-gray-800">
                <span className="text-xs text-gray-500">Click vào ghế trên sơ đồ hoặc click vào chữ cái hàng để chọn.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Change type */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">Đổi Loại Ghế</label>
                  <div className="flex gap-2">
                    <select
                      value={batchType}
                      onChange={(e) => setBatchType(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
                    >
                      {SEAT_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleBatchChangeType}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>

                {/* Deactivate (soft-delete) */}
                <button
                  onClick={handleBatchDeactivate}
                  disabled={actionLoading}
                  className="w-full py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-xs font-semibold rounded-lg transition disabled:opacity-50"
                >
                  🚫 Vô Hiệu Hóa {selectedSeatIds.size} Ghế
                </button>

                {/* Delete */}
                <button
                  onClick={handleBatchDelete}
                  disabled={actionLoading}
                  className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold rounded-lg transition disabled:opacity-50"
                >
                  🗑️ Xóa {selectedSeatIds.size} Ghế Đã Chọn
                </button>
              </div>
            )}
          </div>

          {/* ── Legend ── */}
          <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-300 mb-3">Chú Thích</h3>
            <div className="space-y-2">
              {SEAT_TYPES.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5">
                  <div
                    className="w-5 h-5 rounded-md"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="text-xs text-gray-300">{t.label}</span>
                  {t.id === 'SEAT_TYPE_NORMAL' && <span className="text-[10px] text-gray-500 ml-auto">Phụ thu 0đ</span>}
                  {t.id === 'SEAT_TYPE_VIP' && <span className="text-[10px] text-blue-500 ml-auto">+30,000đ</span>}
                  {t.id === 'SEAT_TYPE_SWEETBOX' && <span className="text-[10px] text-pink-500 ml-auto">+50,000đ</span>}
                </div>
              ))}
              <div className="flex items-center gap-2.5 pt-1 border-t border-gray-800">
                <div className="w-5 h-5 rounded-md bg-gray-600 opacity-30 relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-[2px] bg-red-500 rotate-45" />
                  </div>
                </div>
                <span className="text-xs text-gray-500">Không hoạt động</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md bg-gray-600 ring-2 ring-white" />
                <span className="text-xs text-gray-500">Đang được chọn</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {actionLoading && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-8 flex flex-col items-center gap-3 shadow-2xl">
            <div className="w-8 h-8 border-2 border-[#4318FF] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-300">Đang xử lý...</span>
          </div>
        </div>
      )}
    </div>
  );
}
