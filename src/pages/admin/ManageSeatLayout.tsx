import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaChair, FaCouch } from 'react-icons/fa';
import { roomService } from '../../services/roomService';
import type { RoomResponse, SeatResponse } from '../../services/roomService';
import { TEXT } from '../../constants/vi';

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

  // Undo/Redo history for selection (tracks both real seats & virtual slots)
  type HistoryEntry = { seatIds: Set<string>; virtualSlots: Set<string> };
  const [selectionHistory, setSelectionHistory] = useState<HistoryEntry[]>([{ seatIds: new Set(), virtualSlots: new Set() }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Copy Layout states
  const [otherRooms, setOtherRooms] = useState<RoomResponse[]>([]);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedSourceRoomId, setSelectedSourceRoomId] = useState('');

  // Batch edit
  const [batchType, setBatchType] = useState('SEAT_TYPE_VIP');

  // Cấu hình Blueprint ảo cho phòng chiếu
  const [blueprintMaxRow, setBlueprintMaxRow] = useState('J');
  const [blueprintMaxCol, setBlueprintMaxCol] = useState(12);
  const [tempMaxRow, setTempMaxRow] = useState('J');
  const [tempMaxCol, setTempMaxCol] = useState(12);
  const [selectedVirtualSlots, setSelectedVirtualSlots] = useState<Set<string>>(new Set());

  const lastLoadedRoomIdRef = useRef<string | null>(null);
  const selectedSeatIdsRef = useRef<Set<string>>(new Set());
  const selectedVirtualSlotsRef = useRef<Set<string>>(new Set());
  const selectionHistoryRef = useRef<HistoryEntry[]>([{ seatIds: new Set(), virtualSlots: new Set() }]);
  const historyIndexRef = useRef<number>(0);

  // Tự động tính toán kích thước lưới Blueprint mặc định dựa trên số ghế hiện có khi đổi phòng
  useEffect(() => {
    if (seats.length > 0 && lastLoadedRoomIdRef.current !== roomId) {
      lastLoadedRoomIdRef.current = roomId;
      let maxRCode = 74; // 'J'
      let maxC = 12;
      for (const seat of seats) {
        const code = seat.rowLabel.charCodeAt(0);
        if (code > maxRCode) maxRCode = code;
        if (seat.seatNumber > maxC) maxC = seat.seatNumber;
      }
      const finalRCode = Math.min(90, maxRCode + 2); // Tối đa Z
      const finalC = Math.min(30, maxC + 2);         // Tối đa 30 cột
      setBlueprintMaxRow(String.fromCharCode(finalRCode));
      setBlueprintMaxCol(finalC);
      setTempMaxRow(String.fromCharCode(finalRCode));
      setTempMaxCol(finalC);

      // Reset selection state, selection refs và selection history
      const initialEntry = { seatIds: new Set<string>(), virtualSlots: new Set<string>() };
      selectionHistoryRef.current = [initialEntry];
      historyIndexRef.current = 0;
      setSelectionHistory([initialEntry]);
      setHistoryIndex(0);

      selectedSeatIdsRef.current = new Set();
      selectedVirtualSlotsRef.current = new Set();
      setSelectedSeatIds(new Set());
      setSelectedVirtualSlots(new Set());
    } else if (seats.length === 0 && lastLoadedRoomIdRef.current !== roomId) {
      lastLoadedRoomIdRef.current = roomId;
      setBlueprintMaxRow('J');
      setBlueprintMaxCol(12);

      // Reset selection state, selection refs và selection history
      const initialEntry = { seatIds: new Set<string>(), virtualSlots: new Set<string>() };
      selectionHistoryRef.current = [initialEntry];
      historyIndexRef.current = 0;
      setSelectionHistory([initialEntry]);
      setHistoryIndex(0);

      selectedSeatIdsRef.current = new Set();
      selectedVirtualSlotsRef.current = new Set();
      setSelectedSeatIds(new Set());
      setSelectedVirtualSlots(new Set());
    }
  }, [seats, roomId]);

  // Toggle hiển thị ghế vô hiệu (mặc định ẩn để lưới nhìn chuẩn)
  const [showInactiveSeats, setShowInactiveSeats] = useState(false);
  const [isCustomerPreview, setIsCustomerPreview] = useState(false);
  const [aisleCols, setAisleCols] = useState<number[]>([]);

  // Tải cấu hình lối đi khi đổi phòng chiếu
  useEffect(() => {
    if (roomId) {
      const saved = localStorage.getItem(`aisles-${roomId}`);
      if (saved) {
        try {
          setAisleCols(JSON.parse(saved));
        } catch (e) {
          setAisleCols([]);
        }
      } else {
        setAisleCols([]);
      }
    }
  }, [roomId]);

  // Đo đạc kích thước khung sơ đồ ghế thực tế để tự động co giãn ô ghế
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Hàm tính toán kích thước ô ghế động để vừa khít 100% chiều rộng của khung
  const getDynamicSeatDims = useCallback((seatTypeId: string) => {
    const gapSize = blueprintMaxCol > 24 ? 2 : blueprintMaxCol > 18 ? 4 : 6;
    const remainingW = containerWidth - 110; // Trừ đi 2 nhãn cột (64px) và khoảng cách gap an toàn
    const totalGaps = (blueprintMaxCol - 1) * gapSize;
    let seatW = (remainingW - totalGaps) / blueprintMaxCol;
    
    // Giới hạn kích thước ghế đơn (Normal/VIP) tối thiểu 10px, tối đa 40px
    seatW = Math.max(10, Math.min(40, seatW));
    
    if (seatTypeId === 'SEAT_TYPE_SWEETBOX') {
      return {
        width: seatW * 2 + gapSize,
        height: seatW,
      };
    }
    return {
      width: seatW,
      height: seatW,
    };
  }, [containerWidth, blueprintMaxCol]);

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
      toast.error(TEXT.SEAT_LAYOUT.ERR_FETCH_DATA);
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
      // Luôn luôn đưa tất cả ghế vào sơ đồ Grid để giữ cấu trúc phẳng 1-1 với DB
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
        // Chỉ xét các ghế thực tế được hiển thị
        const isVisible = seat.isActive || showInactiveSeats;
        if (!isVisible) continue;

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
    // Loại bỏ hàng rỗng
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
  // Tiện ích đồng bộ hóa Refs, States và lịch sử selection
  const syncAndSetSelection = (seatIds: Set<string>, virtualSlots: Set<string>, pushToHistory = false) => {
    selectedSeatIdsRef.current = seatIds;
    selectedVirtualSlotsRef.current = virtualSlots;
    setSelectedSeatIds(seatIds);
    setSelectedVirtualSlots(virtualSlots);

    if (pushToHistory) {
      const nextHistory = selectionHistoryRef.current.slice(0, historyIndexRef.current + 1);
      nextHistory.push({ seatIds: new Set(seatIds), virtualSlots: new Set(virtualSlots) });
      selectionHistoryRef.current = nextHistory;
      historyIndexRef.current = nextHistory.length - 1;

      setSelectionHistory(nextHistory);
      setHistoryIndex(nextHistory.length - 1);
    }
  };

  const handleMouseDown = (seatId: string) => {
    if (room?.roomStatus !== 'MAINTENANCE') {
      toast.warn('Chỉ có thể chỉnh sửa sơ đồ ghế khi trạng thái phòng là BẢO TRÌ (MAINTENANCE).');
      return;
    }
    setIsDrawing(true);
    const currentlySelected = selectedSeatIdsRef.current.has(seatId);
    const nextMode = currentlySelected ? 'deselect' : 'select';
    setDrawMode(nextMode);

    const nextSeatIds = new Set(selectedSeatIdsRef.current);
    if (nextMode === 'select') nextSeatIds.add(seatId);
    else nextSeatIds.delete(seatId);

    // Giữ nguyên các ô ảo đã chọn
    syncAndSetSelection(nextSeatIds, new Set(selectedVirtualSlotsRef.current), false);
  };

  const handleMouseEnter = (seatId: string) => {
    if (!isDrawing || !drawMode || room?.roomStatus !== 'MAINTENANCE') return;
    const nextSelection = new Set(selectedSeatIdsRef.current);
    if (drawMode === 'select') nextSelection.add(seatId);
    else nextSelection.delete(seatId);
    
    // Giữ nguyên các ô ảo đã chọn
    syncAndSetSelection(nextSelection, new Set(selectedVirtualSlotsRef.current), false);
  };

  // Virtual brush selection handlers
  const handleMouseDownVirtual = (slotKey: string) => {
    if (room?.roomStatus !== 'MAINTENANCE') {
      toast.warn('Chỉ có thể chỉnh sửa sơ đồ ghế khi trạng thái phòng là BẢO TRÌ (MAINTENANCE).');
      return;
    }
    setIsDrawing(true);
    const currentlySelected = selectedVirtualSlotsRef.current.has(slotKey);
    const nextMode = currentlySelected ? 'deselect' : 'select';
    setDrawMode(nextMode);

    const nextVirtual = new Set(selectedVirtualSlotsRef.current);
    if (nextMode === 'select') nextVirtual.add(slotKey);
    else nextVirtual.delete(slotKey);

    // Giữ nguyên các ghế thật đã chọn
    syncAndSetSelection(new Set(selectedSeatIdsRef.current), nextVirtual, false);
  };

  const handleMouseEnterVirtual = (slotKey: string) => {
    if (!isDrawing || !drawMode || room?.roomStatus !== 'MAINTENANCE') return;
    const nextVirtual = new Set(selectedVirtualSlotsRef.current);
    if (drawMode === 'select') nextVirtual.add(slotKey);
    else nextVirtual.delete(slotKey);
    
    // Giữ nguyên các ghế thật đã chọn
    syncAndSetSelection(new Set(selectedSeatIdsRef.current), nextVirtual, false);
  };

  const handleMouseUp = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      setDrawMode(null);
      // Thả chuột: push trạng thái selection hiện tại vào history
      syncAndSetSelection(selectedSeatIdsRef.current, selectedVirtualSlotsRef.current, true);
    }
  }, [isDrawing]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseUp]);

  const undoSelection = useCallback(() => {
    if (historyIndexRef.current > 0) {
      const prevIndex = historyIndexRef.current - 1;
      historyIndexRef.current = prevIndex;
      setHistoryIndex(prevIndex);

      const entry = selectionHistoryRef.current[prevIndex];
      selectedSeatIdsRef.current = new Set(entry.seatIds);
      selectedVirtualSlotsRef.current = new Set(entry.virtualSlots);

      setSelectedSeatIds(new Set(entry.seatIds));
      setSelectedVirtualSlots(new Set(entry.virtualSlots));
    }
  }, []);

  const redoSelection = useCallback(() => {
    if (historyIndexRef.current < selectionHistoryRef.current.length - 1) {
      const nextIndex = historyIndexRef.current + 1;
      historyIndexRef.current = nextIndex;
      setHistoryIndex(nextIndex);

      const entry = selectionHistoryRef.current[nextIndex];
      selectedSeatIdsRef.current = new Set(entry.seatIds);
      selectedVirtualSlotsRef.current = new Set(entry.virtualSlots);

      setSelectedSeatIds(new Set(entry.seatIds));
      setSelectedVirtualSlots(new Set(entry.virtualSlots));
    }
  }, []);

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
    if (room?.roomStatus !== 'MAINTENANCE') {
      toast.warn('Chỉ có thể chỉnh sửa sơ đồ ghế khi trạng thái phòng là BẢO TRÌ (MAINTENANCE).');
      return;
    }
    const rowSeats = seats.filter(s => s.rowLabel === rowLabel);
    const virtualInRow: string[] = [];
    for (let c = 1; c <= blueprintMaxCol; c++) {
      const hasSeat = seats.some(s => s.rowLabel === rowLabel && s.seatNumber === c);
      if (!hasSeat) virtualInRow.push(`${rowLabel}-${c}`);
    }

    const hasSeats = rowSeats.length > 0;
    const hasVirtual = virtualInRow.length > 0;

    const allSeatsSelected = !hasSeats || rowSeats.every(s => selectedSeatIdsRef.current.has(s.seatId));
    const allVirtualSelected = !hasVirtual || virtualInRow.every(k => selectedVirtualSlotsRef.current.has(k));
    const allRowSelected = allSeatsSelected && allVirtualSelected && (rowSeats.length + virtualInRow.length > 0);

    const newSeatIds = new Set(selectedSeatIdsRef.current);
    const newVirtual = new Set(selectedVirtualSlotsRef.current);

    for (const s of rowSeats) {
      if (allRowSelected) newSeatIds.delete(s.seatId);
      else newSeatIds.add(s.seatId);
    }
    for (const k of virtualInRow) {
      if (allRowSelected) newVirtual.delete(k);
      else newVirtual.add(k);
    }

    syncAndSetSelection(newSeatIds, newVirtual, true);
  };

  // Tính chính xác số ô ảo trống thực tế hiển thị trên lưới (đã loại bỏ Sweetbox skipCols)
  const getVisibleVirtualSlots = useCallback(() => {
    const slots = new Set<string>();
    const startCode = 65; // 'A'
    const endCode = (blueprintMaxRow || 'J').toUpperCase().charCodeAt(0);
    for (let i = startCode; i <= endCode; i++) {
      const rowLabel = String.fromCharCode(i);
      const rowSeats = seats.filter(s => s.rowLabel === rowLabel);

      const skipCols = new Set<number>();
      for (const s of rowSeats) {
        if (s.seatTypeId === 'SEAT_TYPE_SWEETBOX' && (s.isActive || showInactiveSeats)) {
          skipCols.add(s.seatNumber + 1);
        }
      }

      for (let c = 1; c <= blueprintMaxCol; c++) {
        if (skipCols.has(c)) continue;
        if (aisleCols.includes(c)) continue; // Lối đi dọc không có ô ảo để chọn lắp ghế
        const hasSeat = rowSeats.some(s => s.seatNumber === c);
        if (!hasSeat) {
          slots.add(`${rowLabel}-${c}`);
        }
      }
    }
    return slots;
  }, [seats, blueprintMaxRow, blueprintMaxCol, showInactiveSeats, aisleCols]);

  const selectAll = () => {
    if (room?.roomStatus !== 'MAINTENANCE') {
      toast.warn('Chỉ có thể chỉnh sửa sơ đồ ghế khi trạng thái phòng là BẢO TRÌ (MAINTENANCE).');
      return;
    }
    const virtualSlotsCount = getVisibleVirtualSlots().size;
    const allSeatSelected = selectedSeatIdsRef.current.size === visibleSeats.length;
    const allVirtualSelected = selectedVirtualSlotsRef.current.size === virtualSlotsCount;
    const allSelected = allSeatSelected && allVirtualSelected && (visibleSeats.length + virtualSlotsCount > 0);

    if (allSelected) {
      syncAndSetSelection(new Set(), new Set(), true);
    } else {
      const newSeatIds = new Set(visibleSeats.map((s) => s.seatId));
      const newVirtual = getVisibleVirtualSlots();
      syncAndSetSelection(newSeatIds, newVirtual, true);
    }
  };

  const clearSelection = () => {
    if (room?.roomStatus !== 'MAINTENANCE') return;
    syncAndSetSelection(new Set(), new Set(), true);
  };

  // Aisle handlers
  const toggleAisleCol = async (colNumber: number) => {
    if (room?.roomStatus !== 'MAINTENANCE') {
      toast.warn('Chỉ có thể thay đổi lối đi khi phòng ở trạng thái BẢO TRÌ (MAINTENANCE).');
      return;
    }

    let nextAisles = [...aisleCols];
    if (nextAisles.includes(colNumber)) {
      // Hủy lối đi -> Trở về cột ghế bình thường
      nextAisles = nextAisles.filter(c => c !== colNumber);
      toast.success(`Cột ${colNumber} đã được chuyển lại thành cột lắp ghế.`);
    } else {
      // Đặt làm lối đi -> Phát hiện ghế active đang nằm trên cột này
      const activeSeatsOnCol = seats.filter(s => s.seatNumber === colNumber && s.isActive);
      if (activeSeatsOnCol.length > 0) {
        const confirmed = window.confirm(
          `CẢNH BÁO: Cột ${colNumber} đang chứa ${activeSeatsOnCol.length} ghế đang hoạt động.\n` +
          `Thiết lập lối đi sẽ tự động XÓA (vô hiệu hóa) toàn bộ ghế trên cột này. Bạn có chắc chắn muốn tiếp tục?`
        );
        if (!confirmed) return;

        try {
          setActionLoading(true);
          for (const seat of activeSeatsOnCol) {
            try {
              await roomService.deleteSeat(seat.seatId);
            } catch (e) {
              console.error("Lỗi khi xóa ghế khi tạo lối đi: ", e);
            }
          }
        } catch (err) {
          toast.error("Gặp lỗi trong quá trình dọn dẹp ghế trên cột lối đi.");
        } finally {
          setActionLoading(false);
        }
        await fetchData();
      }
      nextAisles.push(colNumber);
      toast.success(`Đã thiết lập cột ${colNumber} làm lối đi dọc.`);
    }

    setAisleCols(nextAisles);
    localStorage.setItem(`aisles-${roomId}`, JSON.stringify(nextAisles));
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

    const confirmMsg = TEXT.SEAT_LAYOUT.MSG_COPY_WARN;
    if (!window.confirm(confirmMsg)) return;

    try {
      setActionLoading(true);
      setShowCopyModal(false);

      // 1. Tải sơ đồ ghế phòng nguồn
      const sourceSeats = await roomService.getSeatMap(selectedSourceRoomId);
      if (sourceSeats.length === 0) {
        toast.error(TEXT.SEAT_LAYOUT.ERR_COPY_EMPTY);
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
        toast.warn(TEXT.SEAT_LAYOUT.MSG_COPY_WARN_RESULT.replace('{0}', String(copiedCount)).replace('{1}', String(updatedCount)).replace('{2}', String(deactivatedCount)).replace('{3}', failedSeats.slice(0, 5).join(', ')));
      } else {
        toast.success(TEXT.SEAT_LAYOUT.MSG_COPY_SUCCESS.replace('{0}', String(copiedCount)).replace('{1}', String(updatedCount)).replace('{2}', String(deactivatedCount)));
      }

      setSelectedSeatIds(new Set());
      await fetchData();
    } catch (err) {
      toast.error(TEXT.SEAT_LAYOUT.ERR_COPY_FAIL);
    } finally {
      setActionLoading(false);
    }
  };



  const handleInstallSeats = async () => {
    const selectedInactive = Array.from(selectedSeatIds).filter(
      (id) => !seats.find((s) => s.seatId === id)?.isActive
    );
    if (!roomId || (selectedVirtualSlots.size === 0 && selectedInactive.length === 0)) return;
    setActionLoading(true);

    try {
      // 1. Phân tích các vị trí lắp đặt (Gộp cả ô ảo và tọa độ ghế inactive được chọn)
      const targetCoordinates = new Set<string>();
      for (const slot of Array.from(selectedVirtualSlots)) {
        targetCoordinates.add(slot);
      }
      for (const id of selectedInactive) {
        const seat = seats.find(s => s.seatId === id);
        if (seat) {
          targetCoordinates.add(`${seat.rowLabel}-${seat.seatNumber}`);
        }
      }

      // Kiểm tra chặn lắp đặt trên các cột lối đi dọc
      const aisleViolations: string[] = [];
      for (const coord of Array.from(targetCoordinates)) {
        const [rowLabel, colStr] = coord.split('-');
        const col = parseInt(colStr);
        if (aisleCols.includes(col)) {
          aisleViolations.push(`${rowLabel}${col}`);
        }
      }
      if (aisleViolations.length > 0) {
        toast.error(`Không thể lắp đặt! Các vị trí sau đang nằm trên cột lối đi dọc: ${aisleViolations.join(', ')}. Vui lòng hủy lối đi dọc trên các cột này trước.`);
        setActionLoading(false);
        return;
      }

      // Kiểm tra rule số chẵn và liền kề trên từng hàng đối với Sweetbox
      if (batchType === 'SEAT_TYPE_SWEETBOX') {
        const rowGroups = new Map<string, number[]>();
        for (const coord of Array.from(targetCoordinates)) {
          const [rowLabel, colStr] = coord.split('-');
          const col = parseInt(colStr);
          if (!rowGroups.has(rowLabel)) {
            rowGroups.set(rowLabel, []);
          }
          rowGroups.get(rowLabel)!.push(col);
        }

        const invalidRows: string[] = [];
        const nonAdjacentPairs: string[] = [];

        for (const [rowLabel, cols] of Array.from(rowGroups.entries())) {
          // 1. Kiểm tra số lượng chẵn
          if (cols.length % 2 !== 0) {
            invalidRows.push(`${rowLabel} (đang chọn ${cols.length} ô)`);
            continue;
          }

          // 2. Kiểm tra liền kề từng cặp
          const sortedCols = [...cols].sort((a, b) => a - b);
          for (let i = 0; i < sortedCols.length; i += 2) {
            const left = sortedCols[i];
            const right = sortedCols[i + 1];
            if (right !== left + 1) {
              nonAdjacentPairs.push(`${rowLabel}${left} & ${rowLabel}${right}`);
            }
          }
        }

        if (invalidRows.length > 0) {
          toast.error(`Không thể lắp đặt Sweetbox! Số lượng vị trí chọn trên các hàng sau phải là số chẵn: ${invalidRows.join(', ')}.`);
          setActionLoading(false);
          return;
        }

        if (nonAdjacentPairs.length > 0) {
          toast.error(`Không thể lắp đặt Sweetbox! Các cặp vị trí sau không nằm sát cạnh nhau để ghép đôi: ${nonAdjacentPairs.join(', ')}.`);
          setActionLoading(false);
          return;
        }
      }

      const slots = Array.from(targetCoordinates).sort((a, b) => {
        const [rowA, colA] = a.split('-');
        const [rowB, colB] = b.split('-');
        if (rowA !== rowB) return rowA.localeCompare(rowB);
        return parseInt(colA) - parseInt(colB);
      });

      const processedSlots = new Set<string>();
      const validSlots: { 
        rowLabel: string; 
        seatNumber: number; 
        existingSeat?: SeatResponse;
        needsCleanupSeatId?: string; // ID của ghế inactive cũ ở cột c+1 cần xóa
      }[] = [];
      let addedCapacity = 0;

      for (const slot of slots) {
        if (processedSlots.has(slot)) continue;

        const [rowLabel, colStr] = slot.split('-');
        const seatNumber = parseInt(colStr);

        // Kiểm tra xem vị trí này có bị chiếm bởi Sweetbox hoạt động ở cột kế trước không
        const leftNeighbor = seats.find(s => s.rowLabel === rowLabel && s.seatNumber === seatNumber - 1 && s.isActive);
        if (leftNeighbor && leftNeighbor.seatTypeId === 'SEAT_TYPE_SWEETBOX') {
          continue;
        }

        const existing = seats.find(s => s.rowLabel === rowLabel && s.seatNumber === seatNumber);

        if (batchType === 'SEAT_TYPE_SWEETBOX') {
          // Rule cho Sweetbox:
          // a. Không được nằm ở cột cuối cùng
          if (seatNumber + 1 > blueprintMaxCol) {
            toast.error(`Không thể lắp đặt Sweetbox tại ${rowLabel}${seatNumber} vì đây là cột cuối cùng của hàng.`);
            setActionLoading(false);
            return;
          }
          // b. Cột tiếp theo (c+1) không được chứa ghế active khác
          const rightActiveSeat = seats.find(s => s.rowLabel === rowLabel && s.seatNumber === seatNumber + 1 && s.isActive);
          if (rightActiveSeat) {
            toast.error(`Không thể lắp đặt Sweetbox tại ${rowLabel}${seatNumber} vì vị trí bên cạnh (${rowLabel}${seatNumber + 1}) đang có ghế hoạt động.`);
            setActionLoading(false);
            return;
          }

          // Kiểm tra xem cột tiếp theo có ghế inactive cũ không để dọn dẹp
          const rightInactiveSeat = seats.find(s => s.rowLabel === rowLabel && s.seatNumber === seatNumber + 1 && !s.isActive);
          const needsCleanupSeatId = rightInactiveSeat?.seatId;

          validSlots.push({
            rowLabel,
            seatNumber,
            existingSeat: existing,
            needsCleanupSeatId
          });

          // Đánh dấu slot hiện tại và slot tiếp theo đã xử lý
          processedSlots.add(slot);
          processedSlots.add(`${rowLabel}-${seatNumber + 1}`);

          if (existing) {
            if (!existing.isActive) {
              addedCapacity += 2;
            } else {
              addedCapacity += 1;
            }
          } else {
            addedCapacity += 2;
          }
        } else {
          // Ghế đơn (Normal/VIP)
          validSlots.push({ rowLabel, seatNumber, existingSeat: existing });
          processedSlots.add(slot);

          if (existing) {
            if (!existing.isActive) {
              addedCapacity += 1;
            }
          } else {
            addedCapacity += 1;
          }
        }
      }

      // 2. Kiểm tra sức chứa
      const currentCapacity = seats.filter(s => s.isActive).reduce((sum, s) => sum + (s.seatTypeId === 'SEAT_TYPE_SWEETBOX' ? 2 : 1), 0);
      if (currentCapacity + addedCapacity > (room?.capacity ?? 0)) {
        toast.error(`Không thể lắp đặt! Sức chứa dự kiến (${currentCapacity + addedCapacity}) vượt quá sức chứa tối đa của phòng (${room?.capacity}).`);
        setActionLoading(false);
        return;
      }

      // 3. Thực thi gọi API
      let created = 0;
      let failed = 0;

      for (const item of validSlots) {
        const { rowLabel, seatNumber, existingSeat } = item;

        // Nếu lắp Sweetbox, dọn dẹp triệt để tất cả ghế (cả active lẫn inactive) tại cột tiếp theo c+1
        if (batchType === 'SEAT_TYPE_SWEETBOX') {
          const duplicateSeats = seats.filter(s => s.rowLabel === rowLabel && s.seatNumber === seatNumber + 1);
          for (const ds of duplicateSeats) {
            try {
              await roomService.deleteSeat(ds.seatId);
            } catch (e) {
              console.error("Lỗi khi dọn dẹp ghế tại cột tiếp theo: ", e);
            }
          }
        }

        if (existingSeat) {
          try {
            await roomService.updateSeat(existingSeat.seatId, {
              rowLabel: existingSeat.rowLabel,
              seatNumber: existingSeat.seatNumber,
              seatTypeId: batchType,
              isActive: true,
            });
            created++;
          } catch {
            failed++;
          }
        } else {
          try {
            await roomService.createSeat({
              roomId,
              rowLabel,
              seatNumber,
              seatTypeId: batchType
            });
            created++;
          } catch {
            failed++;
          }
        }
      }



      if (failed > 0) {
        toast.warn(`Đã lắp đặt thành công ${created} ghế, thất bại tại ${failed} vị trí.`);
      } else {
        toast.success(`Đã lắp đặt thành công ${created} ghế vào sơ đồ!`);
      }

      syncAndSetSelection(new Set(), new Set(), true);
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Quá trình lắp đặt ghế gặp lỗi.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchReactivate = async () => {
    if (selectedSeatIds.size === 0 && selectedVirtualSlots.size === 0) {
      toast.error(TEXT.SEAT_LAYOUT.ERR_REACTIVATE_EMPTY);
      return;
    }

    const inactiveSeatsToReactivate: SeatResponse[] = [];

    // 1. Lấy từ selectedSeatIds
    for (const seatId of Array.from(selectedSeatIds)) {
      const seat = seats.find((s) => s.seatId === seatId);
      if (seat && !seat.isActive) {
        inactiveSeatsToReactivate.push(seat);
      }
    }

    // 2. Lấy từ selectedVirtualSlots (nếu ô ảo đó thực chất đã có ghế inactive trong DB)
    for (const slotKey of Array.from(selectedVirtualSlots)) {
      const [rowLabel, colStr] = slotKey.split('-');
      const seatNumber = parseInt(colStr);
      const seat = seats.find((s) => s.rowLabel === rowLabel && s.seatNumber === seatNumber);
      if (seat && !seat.isActive) {
        inactiveSeatsToReactivate.push(seat);
      }
    }

    if (inactiveSeatsToReactivate.length === 0) {
      toast.info("Không có ghế nào đang vô hiệu hóa để kích hoạt lại.");
      return;
    }

    // Kiểm tra chặn kích hoạt lại trên các cột lối đi dọc
    const aisleViolations: string[] = [];
    for (const seat of inactiveSeatsToReactivate) {
      if (aisleCols.includes(seat.seatNumber)) {
        aisleViolations.push(seat.seatCode);
      }
    }
    if (aisleViolations.length > 0) {
      toast.error(`Không thể kích hoạt! Các ghế sau đang nằm trên cột lối đi dọc: ${aisleViolations.join(', ')}. Vui lòng hủy lối đi dọc trên các cột này trước.`);
      return;
    }

    // Kiểm tra giới hạn sức chứa (capacity) của phòng
    let capacityDiff = 0;
    for (const seat of inactiveSeatsToReactivate) {
      const cap = seat.seatTypeId === 'SEAT_TYPE_SWEETBOX' ? 2 : 1;
      capacityDiff += cap;
    }
    const newCapacity = seatStats.totalCapacity + capacityDiff;
    if (newCapacity > (room?.capacity ?? 0)) {
      toast.error(TEXT.SEAT_LAYOUT.ERR_REACTIVATE_CAPACITY.replace('{0}', String(newCapacity)).replace('{1}', String(room?.capacity)));
      return;
    }

    try {
      setActionLoading(true);
      let reactivated = 0;
      const failed: string[] = [];

      for (const seat of inactiveSeatsToReactivate) {
        try {
          await roomService.updateSeat(seat.seatId, {
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
        toast.warn(TEXT.SEAT_LAYOUT.MSG_REACTIVATE_WARN.replace('{0}', String(reactivated)).replace('{1}', String(inactiveSeatsToReactivate.length)).replace('{2}', failed.slice(0, 6).join(', ')).replace('{3}', failed.length > 6 ? ` (+${failed.length - 6} nữa)` : ''), { autoClose: 8000 });
      } else {
        toast.success(TEXT.SEAT_LAYOUT.MSG_REACTIVATE_SUCCESS.replace('{0}', String(reactivated)));
      }

      setSelectedSeatIds(new Set());
      setSelectedVirtualSlots(new Set());
      await fetchData();
    } catch (err) {
      toast.error(TEXT.SEAT_LAYOUT.ERR_REACTIVATE_FAIL);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetLayout = async () => {
    if (!roomId) return;
    const confirmed = window.confirm(
      "CẢNH BÁO: Bạn có chắc chắn muốn xóa toàn bộ sơ đồ ghế của phòng chiếu này?\n" +
      "Hành động này sẽ vô hiệu hóa tất cả ghế hiện tại và đặt kích thước khung rạp về mặc định (Hàng J x 12 Cột)."
    );
    if (!confirmed) return;

    try {
      setActionLoading(true);
      // Xóa tất cả các ghế hiện tại của rạp
      for (const seat of seats) {
        try {
          await roomService.deleteSeat(seat.seatId);
        } catch (e) {
          // Bỏ qua lỗi cục bộ trên từng ghế để hoàn tất xóa
        }
      }
      
      // Reset Ref đổi phòng để kích hoạt lại logic useEffect căn chỉnh Grid mặc định
      lastLoadedRoomIdRef.current = null;
      
      // Reset kích thước lưới Grid về mặc định
      setBlueprintMaxRow('J');
      setBlueprintMaxCol(12);
      setTempMaxRow('J');
      setTempMaxCol(12);
      
      setSelectedSeatIds(new Set());
      setSelectedVirtualSlots(new Set());
      
      toast.success("Đã reset toàn bộ sơ đồ ghế và kích thước khung rạp về mặc định thành công!");
      await fetchData();
    } catch (err) {
      toast.error("Gặp lỗi trong quá trình reset sơ đồ ghế.");
    } finally {
      setActionLoading(false);
    }
  };

  // ──────────────────────────────────────────
  // Batch operations
  // ──────────────────────────────────────────
  // Đổi loại ghế cho toàn bộ ghế đang được chọn.
  // Sweetbox chiếm 2 cột liền kề:
  //   - Sweetbox → Normal/VIP: tạo thêm ghế tại cột kế bên
  //   - Normal/VIP → Sweetbox: nếu ghế kề cũng được chọn thì consume nó;
  //     KHÔNG tự động vô hiệu ghế kề ngoài selection để tránh side effects.
  const handleBatchChangeType = async () => {
    if (selectedSeatIds.size === 0) {
      toast.error(TEXT.SEAT_LAYOUT.ERR_REACTIVATE_EMPTY);
      return;
    }

    // ── Validation riêng cho chuyển sang Sweetbox ──
    // Bắt buộc chọn đúng bội số 2, mỗi cặp phải liền kề (cùng hàng, số cột kề nhau),
    // và tất cả phải là ghế Normal hoặc VIP (không phải sweetbox).
    if (batchType === 'SEAT_TYPE_SWEETBOX') {
      const selectedList = Array.from(selectedSeatIds)
        .map((id) => seats.find((s) => s.seatId === id))
        .filter((s): s is SeatResponse => !!s);

      // Kiểm tra tất cả đều không phải sweetbox
      const hasSweetbox = selectedList.some((s) => s.seatTypeId === 'SEAT_TYPE_SWEETBOX');
      if (hasSweetbox) {
        toast.error('Không thể chuyển ghế Sweetbox sang Sweetbox. Vui lòng chỉ chọn ghế Normal hoặc VIP.');
        return;
      }

      // Kiểm tra số lượng phải là bội số 2
      if (selectedList.length % 2 !== 0) {
        toast.error('Để chuyển sang Sweetbox, hãy chọn số chẵn ghế (mỗi 2 ghế liền kề = 1 Sweetbox).');
        return;
      }

      // Kiểm tra từng cặp phải liền kề nhau (cùng hàng, seatNumber kề)
      const sorted = [...selectedList].sort((a, b) => {
        const rowCmp = a.rowLabel.localeCompare(b.rowLabel);
        return rowCmp !== 0 ? rowCmp : a.seatNumber - b.seatNumber;
      });

      const invalidPairs: string[] = [];
      for (let i = 0; i < sorted.length; i += 2) {
        const left = sorted[i];
        const right = sorted[i + 1];
        const isAdjacent =
          left.rowLabel === right.rowLabel &&
          right.seatNumber === left.seatNumber + 1;
        if (!isAdjacent) {
          invalidPairs.push(`${left.seatCode} & ${right.seatCode}`);
        }
      }

      if (invalidPairs.length > 0) {
        toast.error(
          `Các ghế sau không liền kề nhau nên không thể ghép thành Sweetbox: ${invalidPairs.join(', ')}. ` +
          'Hãy chọn các cặp ghế nằm sát nhau cùng hàng.',
          { autoClose: 8000 }
        );
        return;
      }
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
      toast.error(TEXT.SEAT_LAYOUT.ERR_CHANGE_TYPE_CAPACITY.replace('{0}', String(newCapacity)).replace('{1}', String(room?.capacity)));
      return;
    }

    try {
      setActionLoading(true);
      let changed = 0;
      const failed: string[] = [];

      // Tiền xử lý: với Normal/VIP → Sweetbox, nếu ghế kề cũng trong selection
      // thì đánh dấu consumed → bỏ qua ở loop chính (không chuyển nó thành sweetbox riêng)
      const consumedSeatIds = new Set<string>();
      if (batchType === 'SEAT_TYPE_SWEETBOX') {
        const orderedSelected = Array.from(selectedSeatIds)
          .map((id) => seats.find((s) => s.seatId === id))
          .filter((s): s is SeatResponse => !!s && s.seatTypeId !== 'SEAT_TYPE_SWEETBOX')
          .sort((a, b) => {
            const rowCmp = a.rowLabel.localeCompare(b.rowLabel);
            return rowCmp !== 0 ? rowCmp : a.seatNumber - b.seatNumber;
          });

        for (const seat of orderedSelected) {
          if (consumedSeatIds.has(seat.seatId)) continue;
          const neighbor = orderedSelected.find(
            (s) => s.rowLabel === seat.rowLabel && s.seatNumber === seat.seatNumber + 1
          );
          if (neighbor) consumedSeatIds.add(neighbor.seatId);
        }
      }

      for (const seatId of Array.from(selectedSeatIds)) {
        // Bỏ qua ghế bị consume (nó sẽ bị vô hiệu hóa khi sweetbox kề xử lý)
        if (consumedSeatIds.has(seatId)) continue;
        const seat = seats.find((s) => s.seatId === seatId);
        if (!seat) continue;

        const wasSweetbox = seat.seatTypeId === 'SEAT_TYPE_SWEETBOX';
        const becomingSweetbox = batchType === 'SEAT_TYPE_SWEETBOX';

        // 3. Normal/VIP → Sweetbox: dọn dẹp triệt để tất cả ghế (cả active lẫn inactive) tại cột tiếp theo c+1
        if (!wasSweetbox && becomingSweetbox) {
          const neighborNumber = seat.seatNumber + 1;
          const duplicateSeats = seats.filter(
            (s) => s.rowLabel === seat.rowLabel && s.seatNumber === neighborNumber
          );
          for (const ds of duplicateSeats) {
            try {
              await roomService.deleteSeat(ds.seatId);
            } catch (e) {
              console.error("Lỗi khi dọn dẹp ghế tại cột tiếp theo: ", e);
            }
          }
        }

        try {
          // 1. Cập nhật loại của ghế gốc
          await roomService.updateSeat(seatId, {
            rowLabel: seat.rowLabel,
            seatNumber: seat.seatNumber,
            seatTypeId: batchType,
            isActive: seat.isActive,
          });

          // 2. Sweetbox → Normal/VIP: tạo thêm ghế ở cột kế bên (seatNumber + 1)
          if (wasSweetbox && !becomingSweetbox) {
            const neighborNumber = seat.seatNumber + 1;
            const neighborSeat = seats.find(
              (s) => s.rowLabel === seat.rowLabel && s.seatNumber === neighborNumber
            );
            if (neighborSeat) {
              // Ghế kề đã tồn tại (inactive) → kích hoạt và đặt đúng loại
              await roomService.updateSeat(neighborSeat.seatId, {
                rowLabel: neighborSeat.rowLabel,
                seatNumber: neighborSeat.seatNumber,
                seatTypeId: batchType,
                isActive: true,
              });
            } else {
              // Chưa có record → tạo mới
              await roomService.createSeat({
                roomId: seat.roomId,
                rowLabel: seat.rowLabel,
                seatNumber: neighborNumber,
                seatTypeId: batchType,
              });
            }
          }



          changed++;
        } catch {
          failed.push(seat.seatCode);
        }
      }

      if (failed.length > 0) {
        toast.warn(
          `Đổi loại được ${changed}/${selectedSeatIds.size - consumedSeatIds.size} ghế. ` +
          `Thất bại: ${failed.slice(0, 6).join(', ')}${failed.length > 6 ? ` (+${failed.length - 6} nữa)` : ''}.`,
          { autoClose: 8000 }
        );
      } else if (batchType === 'SEAT_TYPE_SWEETBOX') {
        toast.success(`Đã chuyển thành công ${changed} ghế Sweetbox!`);
      } else {
        toast.success(`Đã đổi loại ${changed} ghế thành công!`);
      }
      setSelectedSeatIds(new Set());
      await fetchData();
    } catch (err) {
      toast.error(TEXT.SEAT_LAYOUT.ERR_CHANGE_TYPE_FAIL);
    } finally {
      setActionLoading(false);
    }
  };



  // Backend DELETE /api/seats/{seatId} = soft-delete (set isActive = false)
  // There is no "reactivate" endpoint, so we only support deactivation.
  const handleBatchDeactivate = async () => {
    if (selectedSeatIds.size === 0) {
      toast.error(TEXT.SEAT_LAYOUT.ERR_REACTIVATE_EMPTY);
      return;
    }

    const confirmed = window.confirm(TEXT.SEAT_LAYOUT.MSG_DEACTIVATE_CONFIRM.replace('{0}', String(selectedSeatIds.size)));
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
        toast.warn(TEXT.SEAT_LAYOUT.MSG_DEACTIVATE_WARN.replace('{0}', String(deactivated)).replace('{1}', String(selectedSeatIds.size)).replace('{2}', String(failed.length)).replace('{3}', failed.slice(0, 6).join(', ')).replace('{4}', failed.length > 6 ? ` (+${failed.length - 6} nữa)` : ''), { autoClose: 8000 });
      } else {
        toast.success(TEXT.SEAT_LAYOUT.MSG_DEACTIVATE_SUCCESS.replace('{0}', String(deactivated)));
      }

      setSelectedSeatIds(new Set());
      await fetchData();
    } catch (err) {
      toast.error(TEXT.SEAT_LAYOUT.ERR_DEACTIVATE_FAIL);
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
          <span className="text-sm text-gray-400 font-['Urbanist']">{TEXT.SEAT_LAYOUT.LOADING}</span>
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
          <span>←</span> {TEXT.SEAT_LAYOUT.BTN_BACK}
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold uppercase tracking-wider">
            {TEXT.SEAT_LAYOUT.TITLE}
          </h1>
          <p className="mt-0.5 text-xs text-gray-400">
            {room ? `${room.roomName} — ${room.cinemaName}` : `Phòng ${roomId}`}
            {room && (
              <span className="ml-2 text-gray-500">· {TEXT.SEAT_LAYOUT.ROOM_CAPACITY.replace('{0}', String(room.capacity))}</span>
            )}
          </p>
        </div>
      </div>

      {/* ALERT BANNER IF NOT MAINTENANCE */}
      {room && room.roomStatus !== 'MAINTENANCE' && (
        <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <h4 className="font-bold text-sm">Chế độ xem thông tin (Không thể chỉnh sửa)</h4>
            <p className="text-xs text-gray-300 mt-1">
              Phòng chiếu đang ở trạng thái <strong className="text-white">{room.roomStatus}</strong>.
              Bạn chỉ có thể thay đổi sơ đồ ghế khi trạng thái phòng được chuyển sang <strong className="text-white">BẢO TRÌ (MAINTENANCE)</strong> và không có suất chiếu nào của phòng này có booking.
            </p>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT: Grid + Control Panel (Căn giữa và dịch nhẹ sang trái) */}
      <div className="grid grid-cols-1 xl:grid-cols-[720px_1fr] gap-6 justify-center xl:-translate-x-6 max-w-[1300px] mx-auto w-full transition-transform duration-150">

        {/* ═══════════════════════════════════════ */}
        {/* LEFT: SEAT GRID                        */}
        {/* ═══════════════════════════════════════ */}
        <div ref={containerRef} className={`bg-[#111C44] border border-gray-800 rounded-2xl p-6 shadow-2xl w-full max-w-[720px] overflow-hidden relative transition-all duration-300 ${isCustomerPreview ? 'ring-1 ring-blue-500/30' : ''}`}>
          {/* Header điều khiển Chế độ xem trước */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800/55">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              {isCustomerPreview ? '👁️ Giao diện khách hàng (Xem trước)' : '🛠️ Sơ đồ thiết kế (Admin)'}
            </span>
            <button
              onClick={() => {
                setIsCustomerPreview(prev => !prev);
                if (!isCustomerPreview) {
                  setSelectedSeatIds(new Set());
                  setSelectedVirtualSlots(new Set());
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition flex items-center gap-1.5 ${
                isCustomerPreview
                  ? 'bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25'
                  : 'bg-gray-800/60 text-gray-400 border-gray-700 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <span>{isCustomerPreview ? '⚙️ Chế độ thiết kế' : '👁️ Xem trước khách đặt'}</span>
            </button>
          </div>

          {/* Screen indicator (Nằm ngoài cùng, trên hết) */}
          <div className="text-center mb-6">
            <div className="mx-auto max-w-md h-2 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent rounded-full" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mt-1 block">{TEXT.SEAT_LAYOUT.SCREEN}</span>
          </div>

          {/* Thanh chỉ số cột kiêm nút Toggle lối đi (Chỉ hiện ở chế độ thiết kế Admin) */}
          {!isCustomerPreview && (
            <div className="flex items-center justify-center gap-3 mb-4 pl-12 pr-12 select-none">
              {/* Căn lề thẳng với cột nhãn hàng bên trái */}
              <div className="w-8 flex-shrink-0" />
              
              <div className="flex items-center" style={{ gap: `${blueprintMaxCol > 24 ? 2 : blueprintMaxCol > 18 ? 4 : 6}px` }}>
                {Array.from({ length: blueprintMaxCol }).map((_, idx) => {
                  const colNum = idx + 1;
                  const isAisle = aisleCols.includes(colNum);
                  const dims = getDynamicSeatDims('SEAT_TYPE_NORMAL');
                  
                  return (
                    <button
                      key={`col-header-${colNum}`}
                      onClick={() => toggleAisleCol(colNum)}
                      className={`flex-shrink-0 text-[8px] font-extrabold rounded flex items-center justify-center transition border ${
                        isAisle
                          ? 'bg-blue-600/20 text-blue-400 border-blue-500/30 hover:bg-blue-600/30'
                          : 'bg-gray-800/40 text-gray-500 border-gray-800 hover:bg-gray-700 hover:text-white'
                      }`}
                      style={{
                        width: isAisle ? dims.width * 0.4 : dims.width,
                        height: 20,
                      }}
                      title={isAisle ? `Cột ${colNum} là lối đi · Click để hủy` : `Click để đặt cột ${colNum} làm lối đi`}
                    >
                      {isAisle ? '🚶' : colNum}
                    </button>
                  );
                })}
              </div>
              
              {/* Căn lề thẳng với cột nhãn hàng bên phải */}
              <div className="w-8 flex-shrink-0" />
            </div>
          )}

          {/* Grid Layout: Phân chia 3 cột cố định và cuộn */}
          <div className="flex gap-4 items-start select-none">
            {(() => {
              const startCode = 65; // 'A'
              const endCode = (blueprintMaxRow || 'J').toUpperCase().charCodeAt(0);
              const rows: string[] = [];
              for (let i = startCode; i <= endCode; i++) {
                rows.push(String.fromCharCode(i));
              }

              // Lấy kích thước chuẩn của 1 hàng (chiều cao h) để đồng bộ cho nhãn
              const normalSeatDims = getDynamicSeatDims('SEAT_TYPE_NORMAL');
              const rowHeight = normalSeatDims.height;

              // Pre-calculate all rows data
              const rowsData = rows.map((rowLabel) => {
                const rowSeats = seats.filter(s => s.rowLabel === rowLabel);
                const virtualInRow: string[] = [];
                for (let vc = 1; vc <= blueprintMaxCol; vc++) {
                  const hasSeat = rowSeats.some(s => s.seatNumber === vc);
                  if (!hasSeat) virtualInRow.push(`${rowLabel}-${vc}`);
                }
                const totalInRow = rowSeats.length + virtualInRow.length;
                const selectedInRow = rowSeats.filter(s => selectedSeatIds.has(s.seatId)).length
                  + virtualInRow.filter(k => selectedVirtualSlots.has(k)).length;
                const allRowSelected = totalInRow > 0 && selectedInRow === totalInRow;

                // Render seats
                let currentDisplayNum = 0;
                const skipCols = new Set<number>();
                const renderedCols: React.ReactNode[] = [];

                for (let c = 1; c <= blueprintMaxCol; c++) {
                  if (skipCols.has(c)) continue;

                  const seat = seats.find(s => s.rowLabel === rowLabel && s.seatNumber === c);
                  const isAisle = aisleCols.includes(c);
                  const hasHiddenSeatHere = seat && !seat.isActive;

                  if (isAisle && !(showInactiveSeats && hasHiddenSeatHere)) {
                    const dims = getDynamicSeatDims('SEAT_TYPE_NORMAL');
                    renderedCols.push(
                      <div
                        key={`aisle-${rowLabel}-${c}`}
                        className="flex-shrink-0 bg-transparent transition-all duration-300"
                        style={{
                          width: dims.width * 0.4,
                          height: dims.height,
                        }}
                      />
                    );
                    continue;
                  }
                  if (seat && seat.seatTypeId === 'SEAT_TYPE_SWEETBOX' && (seat.isActive || showInactiveSeats)) {
                    skipCols.add(c + 1);
                  }

                  const isRealSeatVisible = seat && (seat.isActive || showInactiveSeats);

                  if (isCustomerPreview) {
                    // --- GIAO DIỆN KHÁCH HÀNG (CUSTOMER VIEW PREVIEW) ---
                    if (seat && seat.isActive) {
                      const dims = getDynamicSeatDims(seat.seatTypeId);
                      const typeInfo = getSeatColor(seat.seatTypeId);
                      const displayNum = currentDisplayNum + 1;
                      const isSweetbox = seat.seatTypeId === 'SEAT_TYPE_SWEETBOX';
                      
                      // Tăng số ghế hiển thị
                      currentDisplayNum += isSweetbox ? 2 : 1;

                      renderedCols.push(
                        <div
                          key={seat.seatId}
                          className="relative z-0 flex-shrink-0 transition-all duration-300 shadow-md"
                          title={`${rowLabel}${displayNum}${isSweetbox ? `-${displayNum + 1}` : ''} · ${typeInfo.label}`}
                          style={{
                            width: dims.width,
                            height: dims.height,
                          }}
                        >
                          <div
                            className="w-full h-full rounded-lg flex items-center justify-center gap-1 text-[10px] font-bold"
                            style={{
                              backgroundColor: typeInfo.color,
                            }}
                          >
                            {seat.seatTypeId === 'SEAT_TYPE_SWEETBOX' ? (
                              <FaCouch className="h-3.5 w-7 shrink-0 text-white/90" />
                            ) : seat.seatTypeId === 'SEAT_TYPE_VIP' ? (
                              <FaCouch className="h-3.5 w-3.5 shrink-0 text-white/90" />
                            ) : (
                              <FaChair className="h-3.5 w-3.5 shrink-0 text-white/90" />
                            )}
                            <span>
                              {isSweetbox
                                ? `${displayNum}-${displayNum + 1}`
                                : displayNum}
                            </span>
                          </div>
                        </div>
                      );
                    } else {
                      // Ghế inactive hoặc ô ảo biến thành khoảng trống trong suốt, không tương tác và không tăng số ghế hiển thị
                      const dims = getDynamicSeatDims('SEAT_TYPE_NORMAL');
                      renderedCols.push(
                        <div
                          key={`${rowLabel}-${c}`}
                          className="flex-shrink-0 bg-transparent"
                          style={{
                            width: dims.width,
                            height: dims.height,
                          }}
                        />
                      );
                    }
                  } else {
                    // --- GIAO DIỆN THIẾT KẾ ADMIN (ADMIN EDIT VIEW) ---
                    if (isRealSeatVisible && seat) {
                      const isSelected = selectedSeatIds.has(seat.seatId);
                      const isInactive = !seat.isActive;
                      const dims = getDynamicSeatDims(seat.seatTypeId);
                      const typeInfo = getSeatColor(seat.seatTypeId);

                      renderedCols.push(
                        <button
                          key={seat.seatId}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleMouseDown(seat.seatId);
                          }}
                          onMouseEnter={() => handleMouseEnter(seat.seatId)}
                          className="relative z-0 transition-all duration-150 group/seat flex-shrink-0"
                          title={`${seat.seatCode} · ${typeInfo.label}${isInactive ? ' (Không HĐ)' : ''}`}
                          style={{
                            width: dims.width,
                            height: dims.height,
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
                            <span>
                              {seat.seatTypeId === 'SEAT_TYPE_SWEETBOX'
                                ? `${seat.seatNumber}-${seat.seatNumber + 1}`
                                : seat.seatNumber}
                            </span>
                            {isInactive && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-full h-[2px] bg-red-500 rotate-45 absolute" />
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    } else {
                      const slotKey = `${rowLabel}-${c}`;
                      const dims = getDynamicSeatDims('SEAT_TYPE_NORMAL');
                      
                      const hiddenSeat = seat; // seat ở đây có isActive = false (do isRealSeatVisible = false)
                      const isSelected = hiddenSeat ? selectedSeatIds.has(hiddenSeat.seatId) : selectedVirtualSlots.has(slotKey);

                      renderedCols.push(
                        <button
                          key={slotKey}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (hiddenSeat) {
                              handleMouseDown(hiddenSeat.seatId);
                            } else {
                              handleMouseDownVirtual(slotKey);
                            }
                          }}
                          onMouseEnter={() => {
                            if (hiddenSeat) {
                              handleMouseEnter(hiddenSeat.seatId);
                            } else {
                              handleMouseEnterVirtual(slotKey);
                            }
                          }}
                          className={`flex-shrink-0 rounded-lg border border-dashed text-[9px] font-semibold transition flex items-center justify-center cursor-pointer relative z-0 ${isSelected
                            ? 'ring-2 ring-white scale-110 bg-blue-600/30 border-blue-400 text-blue-300 shadow-lg'
                            : 'border-gray-800 bg-[#0F172A]/20 hover:bg-blue-500/10 text-gray-500'
                            }`}
                          style={{
                            width: dims.width,
                            height: dims.height,
                          }}
                          title={hiddenSeat 
                            ? `Ghế cũ ${hiddenSeat.seatCode} đang ẩn · Click để chọn kích hoạt lại` 
                            : `Tọa độ trống: ${rowLabel}${c} · Click để chọn lắp ghế`
                          }
                        >
                          <span>{c}</span>
                        </button>
                      );
                    }
                  }
                }

                return {
                  rowLabel,
                  allRowSelected,
                  renderedCols,
                };
              });

              const gapSize = blueprintMaxCol > 24 ? 2 : blueprintMaxCol > 18 ? 4 : 6;

              return (
                <div className="flex flex-col w-full select-none" style={{ gap: `${gapSize}px` }}>
                  {rowsData.map((row) => (
                    <div key={row.rowLabel} style={{ height: rowHeight }} className="flex items-center justify-center gap-3">
                      {/* Row label (Left) */}
                      {isCustomerPreview ? (
                        <div
                          style={{ height: rowHeight }}
                          className="w-8 flex-shrink-0 flex items-center justify-center text-xs font-bold text-gray-500 bg-gray-900/10 rounded-md"
                        >
                          {row.rowLabel}
                        </div>
                      ) : (
                        <button
                          onClick={() => toggleRow(row.rowLabel)}
                          style={{ height: rowHeight }}
                          className={`w-8 flex-shrink-0 flex items-center justify-center rounded-md text-xs font-bold transition-all duration-150 ${row.allRowSelected
                            ? 'bg-[#4318FF] text-white'
                            : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-white'
                            }`}
                          title={TEXT.SEAT_LAYOUT.BTN_SELECT_ALL_ROW.replace('{0}', row.rowLabel)}
                        >
                          {row.rowLabel}
                        </button>
                      )}

                      {/* Columns */}
                      <div className="flex items-center" style={{ gap: `${gapSize}px` }}>
                        {row.renderedCols}
                      </div>

                      {/* Row label (Right) */}
                      <div
                        style={{ height: rowHeight }}
                        className="w-8 flex-shrink-0 flex items-center justify-center text-xs font-bold text-gray-600"
                      >
                        {row.rowLabel}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Select All / Clear */}
          {!isCustomerPreview && (
            <div className="flex justify-center items-center gap-3 mt-5">
              {(() => {
                const virtualCount = getVisibleVirtualSlots().size;
                const totalItems = visibleSeats.length + virtualCount;
                const isAllSelected = selectedSeatIds.size === visibleSeats.length
                  && selectedVirtualSlots.size === virtualCount
                  && totalItems > 0;
                return (
                  <button
                    onClick={selectAll}
                    className="px-3 py-1.5 bg-gray-800/60 hover:bg-gray-700 text-xs text-gray-300 rounded-lg transition"
                  >
                    {isAllSelected ? TEXT.SEAT_LAYOUT.BTN_DESELECT_ALL : TEXT.SEAT_LAYOUT.BTN_SELECT_ALL}
                  </button>
                );
              })()}
              {(() => {
                const virtualCount = getVisibleVirtualSlots().size;
                const totalItems = visibleSeats.length + virtualCount;
                const isAllSelected = selectedSeatIds.size === visibleSeats.length
                  && selectedVirtualSlots.size === virtualCount
                  && totalItems > 0;
                const hasAnySelected = selectedSeatIds.size > 0 || selectedVirtualSlots.size > 0;
                // Chỉ hiện nút bỏ chọn riêng khi có selection nhưng chưa chọn tất cả
                return hasAnySelected && !isAllSelected ? (
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1.5 bg-gray-800/60 hover:bg-gray-700 text-xs text-gray-300 rounded-lg transition"
                  >
                    {TEXT.SEAT_LAYOUT.BTN_DESELECT.replace('{0}', String(selectedSeatIds.size + selectedVirtualSlots.size))}
                  </button>
                ) : null;
              })()}
              <div className="h-4 w-[1px] bg-gray-800 mx-1" />
              <button
                onClick={undoSelection}
                disabled={historyIndex === 0}
                className="px-2.5 py-1.5 bg-gray-800/60 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-800/60 text-xs text-gray-300 rounded-lg transition flex items-center gap-1"
                title={TEXT.SEAT_LAYOUT.TOOLTIP_UNDO}
              >
                <span>↩️</span> {TEXT.SEAT_LAYOUT.BTN_UNDO}
              </button>
              <button
                onClick={redoSelection}
                disabled={historyIndex >= selectionHistory.length - 1}
                className="px-2.5 py-1.5 bg-gray-800/60 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-800/60 text-xs text-gray-300 rounded-lg transition flex items-center gap-1"
                title={TEXT.SEAT_LAYOUT.TOOLTIP_REDO}
              >
                {TEXT.SEAT_LAYOUT.BTN_REDO} <span>↪️</span>
              </button>
            </div>
          )}

          {/* Legend (Chia làm 2 hàng đều và đẹp) */}
          <div className="mt-6 pt-5 border-t border-gray-800 flex flex-col items-center gap-3">
            {/* Hàng 1: Các loại ghế */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {SEAT_TYPES.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="text-xs text-gray-400">{t.label}</span>
                  {t.id === 'SEAT_TYPE_NORMAL' && <span className="text-[10px] text-gray-500 font-semibold">{TEXT.SEAT_LAYOUT.LEGEND_FEE_0}</span>}
                  {t.id === 'SEAT_TYPE_VIP' && <span className="text-[10px] text-blue-500 font-semibold">{TEXT.SEAT_LAYOUT.LEGEND_FEE_30}</span>}
                  {t.id === 'SEAT_TYPE_SWEETBOX' && <span className="text-[10px] text-pink-500 font-semibold">{TEXT.SEAT_LAYOUT.LEGEND_FEE_50}</span>}
                </div>
              ))}
            </div>

            {/* Hàng 2: Trạng thái hiển thị - Chỉ hiển thị ở chế độ thiết kế Admin */}
            {!isCustomerPreview && (
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2.5 border-t border-gray-800/30 w-full max-w-lg">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gray-600 ring-2 ring-white" />
                  <span className="text-xs text-gray-400">{TEXT.SEAT_LAYOUT.LEGEND_SELECTED}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gray-600 opacity-30 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-[1px] bg-red-500 rotate-45" />
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{TEXT.SEAT_LAYOUT.LEGEND_INACTIVE}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-dashed border-gray-600 bg-[#0F172A]/20" />
                  <span className="text-xs text-gray-400">Ô trống (click để lắp ghế)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-dashed border-blue-400 bg-blue-600/30 ring-2 ring-white" />
                  <span className="text-xs text-gray-400">Vị trí đang chọn lắp</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════ */}
        {/* RIGHT: CONTROL PANEL                   */}
        {/* ═══════════════════════════════════════ */}
        <div className="flex flex-col gap-5 self-start w-full max-w-[580px]">
          {/* Hàng 1: Stats & Blueprint Settings song song */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
            {/* ── Stats ── */}
            <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-5 shadow-2xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-300 mb-3">{TEXT.SEAT_LAYOUT.TITLE_STATS}</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0F172A] rounded-xl p-2.5 text-center border border-gray-800 col-span-2">
                    <div className="text-lg font-bold text-white">
                      {seatStats.totalCapacity} / {room?.capacity ?? 0}
                    </div>
                    <div className="text-[9px] text-gray-400 uppercase tracking-wider mt-0.5">
                      {TEXT.SEAT_LAYOUT.STATS_CAPACITY}
                    </div>
                  </div>
                  <div className="bg-[#0F172A] rounded-xl p-2.5 text-center border border-gray-800">
                    <div className="text-lg font-bold text-white">{seatStats.total}</div>
                    <div className="text-[9px] text-gray-400 uppercase tracking-wider mt-0.5">{TEXT.SEAT_LAYOUT.STATS_TOTAL}</div>
                  </div>
                  <div className="bg-[#0F172A] rounded-xl p-2.5 text-center border border-gray-800">
                    <div className={`text-lg font-bold ${totalInactiveCount > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                      {totalInactiveCount}
                    </div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">{TEXT.SEAT_LAYOUT.STATS_INACTIVE}</div>
                  </div>
                  <div className="bg-[#0F172A] rounded-xl p-2.5 text-center border border-gray-800">
                    <div className="text-lg font-bold text-gray-400">{seatStats.normal}</div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Normal</div>
                  </div>
                  <div className="bg-[#0F172A] rounded-xl p-2.5 text-center border border-gray-800">
                    <div className="text-lg font-bold text-blue-400">{seatStats.vip}</div>
                    <div className="text-[9px] text-blue-500 uppercase tracking-wider mt-0.5">VIP</div>
                  </div>
                  <div className="bg-[#0F172A] rounded-xl p-2.5 text-center border border-gray-800 col-span-2">
                    <div className="text-lg font-bold text-pink-400">{seatStats.sweetbox}</div>
                    <div className="text-[9px] text-pink-500 uppercase tracking-wider mt-0.5">Sweetbox</div>
                  </div>
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
                  {showInactiveSeats ? TEXT.SEAT_LAYOUT.BTN_HIDE_INACTIVE : TEXT.SEAT_LAYOUT.BTN_SHOW_INACTIVE.replace('{0}', String(totalInactiveCount))}
                </button>
              )}
            </div>

            {/* ── Blueprint Grid Settings ── */}
            <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-5 shadow-2xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-300 mb-3">
                  Khung rạp (Lưới Blueprint)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">Hàng Tối Đa</label>
                    <input
                      type="text"
                      maxLength={1}
                      value={tempMaxRow}
                      disabled={room?.roomStatus !== 'MAINTENANCE' || isCustomerPreview}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
                        if (val) {
                          setTempMaxRow(val);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition text-center disabled:opacity-50"
                      placeholder="L"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">Cột Tối Đa</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={tempMaxCol}
                      disabled={room?.roomStatus !== 'MAINTENANCE' || isCustomerPreview}
                      onChange={(e) => {
                        const newCol = Math.max(1, Math.min(30, Number(e.target.value)));
                        setTempMaxCol(newCol);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition text-center disabled:opacity-50"
                      placeholder="16"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-2">
                  Thay đổi kích thước lưới để mở rộng hoặc thu hẹp diện tích lắp đặt ghế của phòng chiếu.
                </p>
              </div>

              {/* Nút bấm tác vụ */}
              <div className="space-y-2 mt-3">
                {/* Chỉ hiện nút Confirm khi giá trị tạm thời khác giá trị đang áp dụng */}
                {(tempMaxRow !== blueprintMaxRow || tempMaxCol !== blueprintMaxCol) && (
                  <button
                    onClick={async () => {
                      const rCount = tempMaxRow.charCodeAt(0) - 64;
                      const maxCap = room?.capacity ?? 0;
                      const area = rCount * tempMaxCol;
                      if (maxCap > 0 && area > maxCap) {
                        toast.error(`Kích thước lưới (${rCount} hàng x ${tempMaxCol} cột = ${area} ô) vượt quá sức chứa tối đa của phòng (${maxCap} ghế)!`);
                        return;
                      }

                      // 1. Quét tìm các ghế lọt ra ngoài lưới mới
                      const seatsToOrphan = seats.filter(s => {
                        const seatRCount = s.rowLabel.charCodeAt(0) - 64;
                        if (seatRCount > rCount) return true;
                        
                        if (s.seatTypeId === 'SEAT_TYPE_SWEETBOX') {
                          return (s.seatNumber + 1) > tempMaxCol;
                        }
                        return s.seatNumber > tempMaxCol;
                      });

                      // 2. Cảnh báo và xóa ghế lọt ra ngoài
                      if (seatsToOrphan.length > 0) {
                        const confirmMsg = `CẢNH BÁO: Việc thu nhỏ lưới sẽ làm biến mất và XÓA (vô hiệu hóa) ${seatsToOrphan.length} ghế hiện tại nằm ngoài phạm vi lưới mới trong database.\n\nBạn có chắc chắn muốn tiếp tục?`;
                        const confirmed = window.confirm(confirmMsg);
                        if (!confirmed) return;

                        try {
                          setActionLoading(true);
                          for (const seat of seatsToOrphan) {
                            try {
                              await roomService.deleteSeat(seat.seatId);
                            } catch (e) {
                              console.error("Lỗi khi xóa ghế ngoài phạm vi: ", e);
                            }
                          }
                        } catch (err) {
                          toast.error("Gặp lỗi trong quá trình dọn dẹp ghế ngoài phạm vi.");
                        } finally {
                          setActionLoading(false);
                        }
                      }

                      // 3. Áp dụng kích thước mới
                      setBlueprintMaxRow(tempMaxRow);
                      setBlueprintMaxCol(tempMaxCol);
                      toast.success(`Đã áp dụng kích thước lưới mới: ${tempMaxRow} hàng x ${tempMaxCol} cột!`);
                      await fetchData();
                    }}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isCustomerPreview}
                  >
                    ✓ Áp dụng kích thước mới
                  </button>
                )}

                <button
                  onClick={handleResetLayout}
                  disabled={room?.roomStatus !== 'MAINTENANCE' || actionLoading || isCustomerPreview}
                  className="w-full py-2 bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-500/25 hover:border-red-500/40 text-xs font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ⚠️ Reset Sơ Đồ & Khung Rạp
                </button>
              </div>
            </div>
          </div>

          {/* Hàng 2: Selection / Batch Action Panel */}
          {(() => {
            if (isCustomerPreview) {
              return (
                <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-5 shadow-2xl w-full">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-gray-300 mb-1">
                    Trạng thái xem trước
                  </h3>
                  <div className="bg-[#0F172A] rounded-xl p-4 text-center border border-gray-800">
                    <span className="text-xs text-blue-400 font-semibold flex items-center justify-center gap-1.5">
                      <span>👁️</span> Chế độ xem trước của khách hàng đang bật. Hãy tắt Xem trước để tiếp tục chỉnh sửa.
                    </span>
                  </div>
                </div>
              );
            }

            const selectedActive = Array.from(selectedSeatIds).filter(
              (id) => seats.find((s) => s.seatId === id)?.isActive
            );
            const selectedInactive = Array.from(selectedSeatIds).filter(
              (id) => !seats.find((s) => s.seatId === id)?.isActive
            );
            const hasActiveSelected = selectedActive.length > 0;
            const hasInstallableSelected = selectedVirtualSlots.size > 0 || selectedInactive.length > 0;

            const isDoublePanel = hasActiveSelected && hasInstallableSelected;

            return (
              <div className={`w-full ${isDoublePanel ? 'grid grid-cols-1 sm:grid-cols-2 gap-5' : 'space-y-5'}`}>
                {/* ── Batch Editor cho ghế hoạt động ── */}
                {hasActiveSelected && (
                  <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-5 shadow-2xl flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-300 mb-1">
                        Sửa đổi ghế hoạt động
                      </h3>
                      <p className="text-[10px] text-gray-500 mb-3">
                        Đang chọn <span className="text-white font-bold">{selectedActive.length}</span> ghế đang hoạt động.
                      </p>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                            {TEXT.SEAT_LAYOUT.BATCH_CHANGE_TYPE.replace('{0}', String(selectedActive.length))}
                          </label>
                          <div className="flex gap-2">
                            <select
                              value={batchType}
                              onChange={(e) => setBatchType(e.target.value)}
                              disabled={room?.roomStatus !== 'MAINTENANCE' || actionLoading}
                              className="flex-1 px-3 py-2 rounded-lg bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50"
                            >
                              {SEAT_TYPES.map((t) => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                              ))}
                            </select>
                            <button
                              onClick={handleBatchChangeType}
                              disabled={room?.roomStatus !== 'MAINTENANCE' || actionLoading}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {TEXT.SEAT_LAYOUT.BTN_APPLY}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleBatchDeactivate}
                      disabled={room?.roomStatus !== 'MAINTENANCE' || actionLoading}
                      className="w-full mt-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-xs font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {TEXT.SEAT_LAYOUT.BTN_BATCH_DEACTIVATE.replace('{0}', String(selectedActive.length))}
                    </button>
                  </div>
                )}

                {/* ── Lắp đặt & Kích hoạt ghế mới/ẩn ── */}
                {hasInstallableSelected && (
                  <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-5 shadow-2xl flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-300 mb-1">
                        Lắp đặt & Kích hoạt ghế
                      </h3>
                      <div className="text-[10px] text-gray-500 mb-3 space-y-0.5">
                        {selectedVirtualSlots.size > 0 && (
                          <div>
                            • Chọn <span className="text-white font-bold">{selectedVirtualSlots.size}</span> vị trí ô trống.
                          </div>
                        )}
                        {selectedInactive.length > 0 && (
                          <div>
                            • Chọn <span className="text-white font-bold">{selectedInactive.length}</span> vị trí ghế cũ đang ẩn.
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
                            Chọn loại ghế lắp đặt
                          </label>
                          <select
                            value={batchType}
                            onChange={(e) => setBatchType(e.target.value)}
                            disabled={room?.roomStatus !== 'MAINTENANCE' || actionLoading}
                            className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50"
                          >
                            {SEAT_TYPES.map((t) => (
                              <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 mt-3">
                      <button
                        onClick={handleInstallSeats}
                        disabled={room?.roomStatus !== 'MAINTENANCE' || actionLoading}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Lắp đặt & Kích hoạt {selectedVirtualSlots.size + selectedInactive.length} ghế
                      </button>
                      <button
                        onClick={clearSelection}
                        className="w-full py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs font-semibold rounded-lg transition"
                      >
                        Bỏ chọn tất cả
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Hướng dẫn trống khi không chọn gì ── */}
                {!hasActiveSelected && !hasInstallableSelected && (
                  <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-5 shadow-2xl">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-300 mb-1">
                      {TEXT.SEAT_LAYOUT.TITLE_BATCH}
                    </h3>
                    <div className="bg-[#0F172A] rounded-xl p-4 text-center border border-gray-800">
                      <span className="text-xs text-gray-500">
                        Hãy quét chuột chọn các ghế thực tế trên sơ đồ để sửa đổi, hoặc chọn các vị trí trống/ẩn để tiến hành lắp đặt ghế mới.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Hàng 3: Copy Layout Card */}
          <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-5 shadow-2xl flex items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-300 mb-1">
                {TEXT.SEAT_LAYOUT.TITLE_COPY}
              </h3>
              <p className="text-[10px] text-gray-500">
                {TEXT.SEAT_LAYOUT.COPY_DESC}
              </p>
            </div>
            <button
              onClick={() => {
                void loadOtherRooms();
                setShowCopyModal(true);
              }}
              disabled={room?.roomStatus !== 'MAINTENANCE' || actionLoading || isCustomerPreview}
              className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold rounded-xl transition border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {TEXT.SEAT_LAYOUT.BTN_COPY}
            </button>
          </div>
        </div>
      </div>

      {/* COPY LAYOUT MODAL */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-6 shadow-2xl w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span>📋</span> {TEXT.SEAT_LAYOUT.MODAL_COPY_TITLE}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {TEXT.SEAT_LAYOUT.MODAL_COPY_DESC}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1.5">{TEXT.SEAT_LAYOUT.MODAL_COPY_LABEL}</label>
                <select
                  value={selectedSourceRoomId}
                  onChange={(e) => setSelectedSourceRoomId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-gray-800 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
                >
                  <option value="">{TEXT.SEAT_LAYOUT.MODAL_COPY_PLACEHOLDER}</option>
                  {otherRooms.map((r) => (
                    <option key={r.roomId} value={r.roomId}>
                      {TEXT.SEAT_LAYOUT.MODAL_COPY_ROOM_INFO.replace('{0}', r.roomName).replace('{1}', r.cinemaName).replace('{2}', String(r.seatCount))}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setShowCopyModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-lg transition"
                >
                  {TEXT.SEAT_LAYOUT.BTN_CANCEL}
                </button>
                <button
                  onClick={handleCopyLayout}
                  disabled={!selectedSourceRoomId || actionLoading}
                  className="px-4 py-2 bg-[#4318FF] hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {TEXT.SEAT_LAYOUT.BTN_CONFIRM_COPY}
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
            <span className="text-sm text-gray-300">{TEXT.SEAT_LAYOUT.LOADING_PROCESS}</span>
          </div>
        </div>
      )}
    </div>
  );
}
