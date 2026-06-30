import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaChair, FaCouch } from 'react-icons/fa';
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

const getSeatColor = (seatTypeId: string) => {
  const found = SEAT_TYPES.find((t) => t.id === seatTypeId);
  return found ?? SEAT_TYPES[0];
};

// ============================================================
// Component
// ============================================================
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

  // Brush select states
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState<'select' | 'deselect' | null>(null);

  // Undo/Redo history for selection
  const [selectionHistory, setSelectionHistory] = useState<Set<string>[]>([new Set()]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Copy Layout states
  const [otherRooms, setOtherRooms] = useState<RoomResponse[]>([]);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedSourceRoomId, setSelectedSourceRoomId] = useState('');

  // Generator form
  const [genRows, setGenRows] = useState(8);
  const [genCols, setGenCols] = useState(12);
  const [genType, setGenType] = useState('SEAT_TYPE_NORMAL');

  // Batch edit
  const [batchType, setBatchType] = useState('SEAT_TYPE_VIP');

  // Toggle hiển thị ghế vô hiệu (mặc định ẩn để lưới nhìn chuẩn)
  const [showInactiveSeats, setShowInactiveSeats] = useState(false);

  // ──────────────────────────────────────────
  // Data fetching
  // ──────────────────────────────────────────
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
      toast.error('Không thể tải dữ liệu phòng chiếu.');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ──────────────────────────────────────────
  // Seat grid grouping
  // ──────────────────────────────────────────
  // Tổng số ghế inactive (dùng để hiển thị badge "X ghế đang ẩn")
  const totalInactiveCount = seats.filter((s) => !s.isActive).length;

  const seatGrid = (() => {
    const rowMap = new Map<string, SeatResponse[]>();
    for (const seat of seats) {
      // Nếu đang ẩn ghế inactive → bỏ qua ghế không hoạt động
      if (!showInactiveSeats && !seat.isActive) continue;
      const existing = rowMap.get(seat.rowLabel) || [];
      existing.push(seat);
      rowMap.set(seat.rowLabel, existing);
    }
    // Sắp xếp và lọc bỏ các cột chẵn bị chiếm dụng bởi ghế Sweetbox
    for (const [rowLabel, rowSeats] of rowMap) {
      rowSeats.sort((a, b) => a.seatNumber - b.seatNumber);

      const filtered: SeatResponse[] = [];
      const skipCols = new Set<number>();
      for (const seat of rowSeats) {
        if (skipCols.has(seat.seatNumber)) {
          continue;
        }
        filtered.push(seat);
        if (seat.seatTypeId === 'SEAT_TYPE_SWEETBOX') {
          skipCols.add(seat.seatNumber + 1);
        }
      }
      rowMap.set(rowLabel, filtered);
    }
    // Loại bỏ hàng rỗng (có thể xảy ra khi ẩn ghế inactive)
    const sortedRows = Array.from(rowMap.entries())
      .filter(([, rowSeats]) => rowSeats.length > 0)
      .sort((a, b) => a[0].localeCompare(b[0]));
    return sortedRows;
  })();

  const maxCols = seatGrid.reduce((max, [, rowSeats]) => Math.max(max, rowSeats.length), 0);
  const visibleSeats = seatGrid.flatMap(([, rowSeats]) => rowSeats);

  // ──────────────────────────────────────────
  // Selection handlers
  // ──────────────────────────────────────────
  // Helper to update selection and push to history
  const updateSelection = (newSelection: Set<string>, pushToHistory = true) => {
    setSelectedSeatIds(newSelection);
    if (pushToHistory) {
      const nextHistory = selectionHistory.slice(0, historyIndex + 1);
      nextHistory.push(new Set(newSelection));
      setSelectionHistory(nextHistory);
      setHistoryIndex(nextHistory.length - 1);
    }
  };

  const handleMouseDown = (seatId: string) => {
    setIsDrawing(true);
    const currentlySelected = selectedSeatIds.has(seatId);
    const nextMode = currentlySelected ? 'deselect' : 'select';
    setDrawMode(nextMode);

    const nextSelection = new Set(selectedSeatIds);
    if (nextMode === 'select') {
      nextSelection.add(seatId);
    } else {
      nextSelection.delete(seatId);
    }
    updateSelection(nextSelection, true);
  };

  const handleMouseEnter = (seatId: string) => {
    if (!isDrawing || !drawMode) return;
    const nextSelection = new Set(selectedSeatIds);
    if (drawMode === 'select') {
      nextSelection.add(seatId);
    } else {
      nextSelection.delete(seatId);
    }
    setSelectedSeatIds(nextSelection);
  };

  const handleMouseUp = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      setDrawMode(null);
      const nextHistory = selectionHistory.slice(0, historyIndex + 1);
      nextHistory.push(new Set(selectedSeatIds));
      setSelectionHistory(nextHistory);
      setHistoryIndex(nextHistory.length - 1);
    }
  }, [isDrawing, selectedSeatIds, historyIndex, selectionHistory]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseUp]);

  const undoSelection = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setSelectedSeatIds(new Set(selectionHistory[prevIndex]));
    }
  }, [historyIndex, selectionHistory]);

  const redoSelection = useCallback(() => {
    if (historyIndex < selectionHistory.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setSelectedSeatIds(new Set(selectionHistory[nextIndex]));
    }
  }, [historyIndex, selectionHistory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoSelection();
      } else if (isCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redoSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undoSelection, redoSelection]);

  const toggleRow = (rowLabel: string) => {
    const rowSeats = seatGrid.find(([label]) => label === rowLabel)?.[1] || [];
    const allSelected = rowSeats.every((s) => selectedSeatIds.has(s.seatId));
    const nextSelection = new Set(selectedSeatIds);
    for (const s of rowSeats) {
      if (allSelected) {
        nextSelection.delete(s.seatId);
      } else {
        nextSelection.add(s.seatId);
      }
    }
    updateSelection(nextSelection, true);
  };

  const selectAll = () => {
    let nextSelection: Set<string>;
    if (selectedSeatIds.size === visibleSeats.length) {
      nextSelection = new Set();
    } else {
      nextSelection = new Set(visibleSeats.map((s) => s.seatId));
    }
    updateSelection(nextSelection, true);
  };

  const clearSelection = () => {
    updateSelection(new Set(), true);
  };

  // Copy Layout handlers
  const loadOtherRooms = async () => {
    try {
      const roomsList = await roomService.getRooms();
      const filtered = roomsList.filter((r) => r.roomId !== roomId);
      setOtherRooms(filtered);
    } catch (err) {
    }
  };

  const handleCopyLayout = async () => {
    if (!roomId || !selectedSourceRoomId) return;

    const confirmMsg = `⚠️ CẢNH BÁO:\nHành động này sẽ XÓA toàn bộ ghế hiện tại của phòng này và sao chép sơ đồ ghế từ phòng nguồn.\nBạn có chắc chắn muốn tiếp tục?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setActionLoading(true);
      setShowCopyModal(false);

      // 1. Tải sơ đồ ghế phòng nguồn
      const sourceSeats = await roomService.getSeatMap(selectedSourceRoomId);
      if (sourceSeats.length === 0) {
        toast.error('Phòng nguồn không có ghế nào để sao chép.');
        setActionLoading(false);
        return;
      }

      // 2. Phân loại tác vụ cần làm để đồng bộ
      let copiedCount = 0;
      let updatedCount = 0;
      let deactivatedCount = 0;
      const failedSeats: string[] = [];

      // Vô hiệu hóa các ghế không có ở phòng nguồn
      for (const curSeat of seats) {
        const match = sourceSeats.find(s => s.rowLabel === curSeat.rowLabel && s.seatNumber === curSeat.seatNumber);
        if (!match && curSeat.isActive) {
          try {
            await roomService.deleteSeat(curSeat.seatId);
            deactivatedCount++;
          } catch {
            failedSeats.push(curSeat.seatCode);
          }
        }
      }

      // Cập nhật hoặc tạo mới các ghế từ phòng nguồn
      for (const src of sourceSeats) {
        const existing = seats.find(s => s.rowLabel === src.rowLabel && s.seatNumber === src.seatNumber);
        if (existing) {
          try {
            await roomService.updateSeat(existing.seatId, {
              rowLabel: src.rowLabel,
              seatNumber: src.seatNumber,
              seatTypeId: src.seatTypeId,
              isActive: src.isActive
            });
            updatedCount++;
          } catch {
            failedSeats.push(`${src.rowLabel}${src.seatNumber}`);
          }
        } else {
          try {
            const newSeat = await roomService.createSeat({
              roomId,
              rowLabel: src.rowLabel,
              seatNumber: src.seatNumber,
              seatTypeId: src.seatTypeId
            });
            if (!src.isActive) {
              await roomService.updateSeat(newSeat.seatId, {
                rowLabel: src.rowLabel,
                seatNumber: src.seatNumber,
                seatTypeId: src.seatTypeId,
                isActive: false
              });
            }
            copiedCount++;
          } catch {
            failedSeats.push(`${src.rowLabel}${src.seatNumber}`);
          }
        }
      }

      if (failedSeats.length > 0) {
        toast.warn(`Sao chép thành công. Tạo mới: ${copiedCount}, Cập nhật: ${updatedCount}, Vô hiệu hóa: ${deactivatedCount}. Thất bại ở: ${failedSeats.slice(0, 5).join(', ')}...`);
      } else {
        toast.success(`Đã sao chép thành công sơ đồ ghế (Tạo mới: ${copiedCount}, Cập nhật: ${updatedCount}, Vô hiệu hóa: ${deactivatedCount})!`);
      }

      setSelectedSeatIds(new Set());
      await fetchData();
    } catch (err) {
      toast.error('Sao chép sơ đồ ghế thất bại.');
    } finally {
      setActionLoading(false);
    }
  };

  // ──────────────────────────────────────────
  // Auto generate seats
  // ──────────────────────────────────────────
  const handleGenerateSeats = async () => {
    if (!roomId) return;

    if (seats.length > 0) {
      const confirmed = window.confirm(
        `⚠️ Bạn có muốn sinh thêm các ghế mới trong sơ đồ ${genRows}×${genCols} không? Các ghế hiện tại sẽ được giữ nguyên.`
      );
      if (!confirmed) return;
    }

    try {
      setActionLoading(true);

      // Mô phỏng tính toán sức chứa phòng chiếu sau khi sinh ghế mới
      let projectedCapacity = 0;
      for (const s of seats) {
        if (!s.isActive) continue;
        const rIndex = s.rowLabel.charCodeAt(0) - 65;
        const inGrid = rIndex >= 0 && rIndex < genRows && s.seatNumber >= 1 && s.seatNumber <= genCols;
        if (!inGrid) {
          projectedCapacity += s.seatTypeId === 'SEAT_TYPE_SWEETBOX' ? 2 : 1;
        }
      }
      for (let r = 0; r < genRows; r++) {
        const rowLabel = String.fromCharCode(65 + r);
        for (let c = 1; c <= genCols; c++) {
          if (genType === 'SEAT_TYPE_SWEETBOX' && c % 2 === 0) {
            const existing = seats.find((s) => s.rowLabel === rowLabel && s.seatNumber === c && s.isActive);
            if (existing) {
              projectedCapacity += existing.seatTypeId === 'SEAT_TYPE_SWEETBOX' ? 2 : 1;
            }
            continue;
          }
          const existing = seats.find((s) => s.rowLabel === rowLabel && s.seatNumber === c);
          if (existing) {
            const type = existing.isActive ? existing.seatTypeId : genType;
            projectedCapacity += type === 'SEAT_TYPE_SWEETBOX' ? 2 : 1;
          } else {
            projectedCapacity += genType === 'SEAT_TYPE_SWEETBOX' ? 2 : 1;
          }
        }
      }

      if (projectedCapacity > (room?.capacity ?? 0)) {
        toast.error(
          `Không thể sinh thêm ghế vì tổng số chỗ ngồi sau khi sinh (${projectedCapacity}) sẽ vượt quá sức chứa tối đa của phòng (${room?.capacity} chỗ).`
        );
        setActionLoading(false);
        return;
      }

      let created = 0;
      let skipped = 0;
      const createFailed: string[] = [];

      for (let r = 0; r < genRows; r++) {
        const rowLabel = String.fromCharCode(65 + r); // A, B, C, ...
        for (let c = 1; c <= genCols; c++) {
          if (genType === 'SEAT_TYPE_SWEETBOX' && c % 2 === 0) {
            continue;
          }
          const existing = seats.find(
            (s) => s.rowLabel === rowLabel && s.seatNumber === c
          );
          if (existing) {
            if (!existing.isActive) {
              try {
                await roomService.updateSeat(existing.seatId, {
                  rowLabel: existing.rowLabel,
                  seatNumber: existing.seatNumber,
                  seatTypeId: genType,
                  isActive: true,
                });
                created++;
              } catch {
                createFailed.push(`${rowLabel}${c}`);
              }
            } else {
              skipped++;
            }
            continue;
          }

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
          `Tạo/Kích hoạt được ${created} ghế (bỏ qua ${skipped} ghế hoạt động). Không thể xử lý: ${createFailed.slice(0, 8).join(', ')}${createFailed.length > 8 ? ` (+${createFailed.length - 8} nữa)` : ''}.`,
          { autoClose: 8000 }
        );
      } else {
        toast.success(`Đã tạo/kích hoạt ${created} ghế thành công! (Bỏ qua ${skipped} ghế đã tồn tại và hoạt động)`);
      }

      setSelectedSeatIds(new Set());
      await fetchData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message ?? 'Sinh ghế thất bại. Vui lòng thử lại.');

      await fetchData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchReactivate = async () => {
    if (selectedSeatIds.size === 0) {
      toast.error('Vui lòng chọn ít nhất 1 ghế!');
      return;
    }

    let capacityDiff = 0;
    for (const seatId of Array.from(selectedSeatIds)) {
      const seat = seats.find((s) => s.seatId === seatId);
      if (!seat || seat.isActive) continue;
      const cap = seat.seatTypeId === 'SEAT_TYPE_SWEETBOX' ? 2 : 1;
      capacityDiff += cap;
    }
    const newCapacity = seatStats.totalCapacity + capacityDiff;
    if (newCapacity > (room?.capacity ?? 0)) {
      toast.error(`Không thể kích hoạt các ghế này vì tổng số chỗ ngồi sau khi kích hoạt (${newCapacity}) sẽ vượt quá sức chứa tối đa của phòng (${room?.capacity} chỗ).`);
      return;
    }

    try {
      setActionLoading(true);
      let reactivated = 0;
      const failed: string[] = [];

      for (const seatId of Array.from(selectedSeatIds)) {
        const seat = seats.find((s) => s.seatId === seatId);
        if (!seat) continue;

        try {
          await roomService.updateSeat(seatId, {
            rowLabel: seat.rowLabel,
            seatNumber: seat.seatNumber,
            seatTypeId: seat.seatTypeId,
            isActive: true,
          });
          reactivated++;
        } catch {
          failed.push(seat.seatCode);
        }
      }

      if (failed.length > 0) {
        toast.warn(
          `Kích hoạt được ${reactivated}/${selectedSeatIds.size} ghế. ` +
          `Thất bại: ${failed.slice(0, 6).join(', ')}${failed.length > 6 ? ` (+${failed.length - 6} nữa)` : ''}.`,
          { autoClose: 8000 }
        );
      } else {
        toast.success(`Đã kích hoạt thành công ${reactivated} ghế!`);
      }

      setSelectedSeatIds(new Set());
      await fetchData();
    } catch (err) {
      toast.error('Kích hoạt thất bại.');
    } finally {
      setActionLoading(false);
    }
  };

  // ──────────────────────────────────────────
  // Batch operations
  // ──────────────────────────────────────────
  const handleBatchChangeType = async () => {
    if (selectedSeatIds.size === 0) {
      toast.error('Vui lòng chọn ít nhất 1 ghế!');
      return;
    }

    let capacityDiff = 0;
    for (const seatId of Array.from(selectedSeatIds)) {
      const seat = seats.find((s) => s.seatId === seatId);
      if (!seat || !seat.isActive) continue;
      const oldCap = seat.seatTypeId === 'SEAT_TYPE_SWEETBOX' ? 2 : 1;
      const newCap = batchType === 'SEAT_TYPE_SWEETBOX' ? 2 : 1;
      capacityDiff += (newCap - oldCap);
    }
    const newCapacity = seatStats.totalCapacity + capacityDiff;
    if (newCapacity > (room?.capacity ?? 0)) {
      toast.error(`Không thể đổi loại ghế vì tổng số chỗ ngồi sau khi đổi (${newCapacity}) sẽ vượt quá sức chứa tối đa của phòng (${room?.capacity} chỗ).`);
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
          isActive: seat.isActive,
        });
      });
      await Promise.all(promises);
      toast.success(`Đã đổi loại ${selectedSeatIds.size} ghế thành công!`);
      setSelectedSeatIds(new Set());
      await fetchData();
    } catch (err) {
      toast.error('Cập nhật ghế thất bại.');
    } finally {
      setActionLoading(false);
    }
  };

  // Backend DELETE /api/seats/{seatId} = soft-delete (set isActive = false)
  // There is no "reactivate" endpoint, so we only support deactivation.
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
      toast.error('Vô hiệu hóa thất bại.');
    } finally {
      setActionLoading(false);
    }
  };

  // handleBatchDelete đã được hợp nhất vào handleBatchDeactivate
  // (cả hai đều gọi soft-delete API — giữ 1 hàm tránh nhầm lẫn)

  // ──────────────────────────────────────────
  // Stats
  // ──────────────────────────────────────────
  const seatStats = (() => {
    const stats = {
      total: 0,
      normal: 0,
      vip: 0,
      sweetbox: 0,
      inactive: 0,
      activeNormal: 0,
      activeVip: 0,
      activeSweetbox: 0,
      totalCapacity: 0
    };
    for (const s of visibleSeats) {
      if (!s.isActive) {
        stats.inactive++;
      } else {
        if (s.seatTypeId === 'SEAT_TYPE_NORMAL') stats.activeNormal++;
        else if (s.seatTypeId === 'SEAT_TYPE_VIP') stats.activeVip++;
        else if (s.seatTypeId === 'SEAT_TYPE_SWEETBOX') stats.activeSweetbox++;
      }

      if (s.seatTypeId === 'SEAT_TYPE_NORMAL') stats.normal++;
      else if (s.seatTypeId === 'SEAT_TYPE_VIP') stats.vip++;
      else if (s.seatTypeId === 'SEAT_TYPE_SWEETBOX') stats.sweetbox++;
    }
    stats.totalCapacity = stats.activeNormal + stats.activeVip + stats.activeSweetbox * 2;
    stats.total = stats.normal + stats.vip + stats.sweetbox * 2;
    stats.sweetbox = stats.sweetbox * 2;
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
              <div className="flex flex-col items-center gap-1.5 select-none">
                {seatGrid.map(([rowLabel, rowSeats]) => {
                  const allRowSelected = rowSeats.every((s) => selectedSeatIds.has(s.seatId));
                  return (
                    <div key={rowLabel} className="flex items-center gap-1.5">
                      {/* Row label */}
                      <button
                        onClick={() => toggleRow(rowLabel)}
                        className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-bold transition-all duration-150 ${allRowSelected
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
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleMouseDown(seat.seatId);
                            }}
                            onMouseEnter={() => handleMouseEnter(seat.seatId)}
                            className="relative transition-all duration-150 group/seat"
                            title={`${seat.seatCode} · ${typeInfo.label}${isInactive ? ' (Không HĐ)' : ''}`}
                            style={{
                              width: seat.seatTypeId === 'SEAT_TYPE_SWEETBOX'
                                ? (maxCols > 14 ? 70 : 86)
                                : (maxCols > 14 ? 32 : 40),
                              height: maxCols > 14 ? 32 : 40,
                            }}
                          >
                            <div
                              className={`w-full h-full rounded-lg flex items-center justify-center gap-1 text-[10px] font-bold transition-all duration-150 ${isSelected
                                ? 'ring-2 ring-white scale-110 shadow-lg'
                                : 'hover:scale-105'
                                } ${isInactive ? 'opacity-30' : ''}`}
                              style={{
                                backgroundColor: isSelected ? typeInfo.hoverColor : typeInfo.color,
                              }}
                            >
                              {seat.seatTypeId === 'SEAT_TYPE_SWEETBOX' ? (
                                <FaCouch className="h-3.5 w-7 shrink-0 text-white/90" />
                              ) : seat.seatTypeId === 'SEAT_TYPE_VIP' ? (
                                <FaCouch className="h-3.5 w-3.5 shrink-0 text-white/90" />
                              ) : (
                                <FaChair className="h-3.5 w-3.5 shrink-0 text-white/90" />
                              )}
                              <span>{seat.seatNumber}</span>
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
              <div className="flex justify-center items-center gap-3 mt-5">
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
                <div className="h-4 w-[1px] bg-gray-800 mx-1" />
                <button
                  onClick={undoSelection}
                  disabled={historyIndex === 0}
                  className="px-2.5 py-1.5 bg-gray-800/60 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-800/60 text-xs text-gray-300 rounded-lg transition flex items-center gap-1"
                  title="Hoàn tác chọn ghế (Ctrl+Z)"
                >
                  <span>↩️</span> Undo
                </button>
                <button
                  onClick={redoSelection}
                  disabled={historyIndex >= selectionHistory.length - 1}
                  className="px-2.5 py-1.5 bg-gray-800/60 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-800/60 text-xs text-gray-300 rounded-lg transition flex items-center gap-1"
                  title="Làm lại chọn ghế (Ctrl+Y)"
                >
                  Redo <span>↪️</span>
                </button>
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
              <div className="bg-[#0F172A] rounded-xl p-3 text-center border border-gray-800 col-span-2">
                <div className="text-xl font-bold text-white">
                  {seatStats.totalCapacity} / {room?.capacity ?? 0}
                </div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">
                  Sức chứa đã dùng (chỗ ngồi)
                </div>
              </div>
              <div className="bg-[#0F172A] rounded-xl p-3 text-center border border-gray-800">
                <div className="text-xl font-bold text-white">{seatStats.total}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Tổng Ghế</div>
              </div>
              <div className="bg-[#0F172A] rounded-xl p-3 text-center border border-gray-800">
                <div className={`text-xl font-bold ${totalInactiveCount > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                  {totalInactiveCount}
                </div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Vô Hiệu</div>
              </div>
              <div className="bg-[#0F172A] rounded-xl p-3 text-center border border-gray-800">
                <div className="text-xl font-bold text-gray-400">{seatStats.normal}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Normal</div>
              </div>
              <div className="bg-[#0F172A] rounded-xl p-3 text-center border border-gray-800">
                <div className="text-xl font-bold text-blue-400">{seatStats.vip}</div>
                <div className="text-[10px] text-blue-500 uppercase tracking-wider mt-0.5">VIP</div>
              </div>
              <div className="bg-[#0F172A] rounded-xl p-3 text-center border border-gray-800 col-span-2">
                <div className="text-xl font-bold text-pink-400">{seatStats.sweetbox}</div>
                <div className="text-[10px] text-pink-500 uppercase tracking-wider mt-0.5">Sweetbox</div>
              </div>
            </div>

            {/* Toggle hiển thị ghế vô hiệu */}
            {totalInactiveCount > 0 && (
              <button
                onClick={() => setShowInactiveSeats((v) => !v)}
                className={`mt-3 w-full py-2 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-2 ${showInactiveSeats
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25'
                    : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:bg-gray-700'
                  }`}
              >
                {showInactiveSeats ? '🙈 Ẩn ghế vô hiệu' : `👁️ Hiện ${totalInactiveCount} ghế vô hiệu`}
              </button>
            )}
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
            ) : (() => {
              // Phân loại ghế đang chọn
              const selectedActive = Array.from(selectedSeatIds).filter(
                (id) => seats.find((s) => s.seatId === id)?.isActive
              );
              const selectedInactive = Array.from(selectedSeatIds).filter(
                (id) => !seats.find((s) => s.seatId === id)?.isActive
              );
              return (
                <div className="space-y-3">
                  {/* Chỉ hiện đổi loại và vô hiệu hóa nếu có ghế active được chọn */}
                  {selectedActive.length > 0 && (
                    <>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                          Đổi Loại Ghế ({selectedActive.length} ghế active)
                        </label>
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

                      <button
                        onClick={handleBatchDeactivate}
                        disabled={actionLoading}
                        className="w-full py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-xs font-semibold rounded-lg transition disabled:opacity-50"
                      >
                        🚫 Vô Hiệu Hóa {selectedActive.length} Ghế Active
                      </button>
                    </>
                  )}

                  {/* Chỉ hiện tái kích hoạt nếu có ghế inactive được chọn */}
                  {selectedInactive.length > 0 && (
                    <button
                      onClick={handleBatchReactivate}
                      disabled={actionLoading}
                      className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-lg transition disabled:opacity-50"
                    >
                      ✅ Kích Hoạt Lại {selectedInactive.length} Ghế Vô Hiệu
                    </button>
                  )}

                  {/* Gợi ý nếu chọn lẫn lộn */}
                  {selectedActive.length > 0 && selectedInactive.length > 0 && (
                    <p className="text-[10px] text-gray-500 text-center">Đang chọn cả ghế active và vô hiệu.</p>
                  )}
                </div>
              );
            })()}
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
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition shadow-lg ${actionLoading
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-[#4318FF] hover:bg-blue-700 text-white shadow-[#4318FF]/20'
                  }`}
              >
                {actionLoading ? 'Đang xử lý...' : '⚡ Sinh Ghế Ngay'}
              </button>
            </div>
          </div>

          {/* ── Copy Layout ── */}
          <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-300 mb-3">
              📋 Sao Chép Sơ Đồ
            </h3>
            <p className="text-[10px] text-gray-500 mb-3">
              Áp dụng sơ đồ thiết kế ghế từ một phòng chiếu khác cho phòng này.
            </p>
            <button
              onClick={() => {
                void loadOtherRooms();
                setShowCopyModal(true);
              }}
              disabled={actionLoading}
              className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold rounded-xl transition border border-gray-700"
            >
              📋 Sao chép từ phòng khác...
            </button>
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

      {/* COPY LAYOUT MODAL */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-6 shadow-2xl w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span>📋</span> Sao chép sơ đồ ghế
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Lấy toàn bộ thiết kế ghế từ một phòng chiếu khác và áp dụng cho phòng hiện tại. Ghế hiện tại của phòng này sẽ được đồng bộ/vô hiệu hóa tương ứng.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1.5">Chọn phòng chiếu nguồn</label>
                <select
                  value={selectedSourceRoomId}
                  onChange={(e) => setSelectedSourceRoomId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
                >
                  <option value="">-- Chọn phòng --</option>
                  {otherRooms.map((r) => (
                    <option key={r.roomId} value={r.roomId}>
                      {r.roomName} ({r.cinemaName}) - {r.seatCount} ghế
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setShowCopyModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-lg transition"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleCopyLayout}
                  disabled={!selectedSourceRoomId || actionLoading}
                  className="px-4 py-2 bg-[#4318FF] hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                >
                  Xác nhận sao chép
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
