import React, { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { useBlocker } from "react-router-dom";
import { TEXT } from "../../constants/vi";
import {
  showtimeService,
  type ShowtimeResponse,
  type CinemaResponse,
  type RoomResponse,
  type MovieResponse,
  type CreateShowtimePayload,
} from "../../services/showtimeService";
import api from "../../lib/api";
import { managerService } from "../../services/managerService";
import { voucherService, type Voucher } from "../../services/voucherService";
import { confirmWithPopup } from "../../services/confirmDialogService";
import {
  buildRecurringShowtimeDrafts,
  getRecurringDateKeys,
  type RecurrenceFrequency,
  type RecurrenceSourceShowtime,
  type RecurringShowtimeDraft,
} from "../../utils/showtimeRecurrence";

// =================================================================
// 💡 CẤU HÌNH TIMELINE CHUẨN: 8H ĐẾN 24H (16 TIẾNG)
// =================================================================
const TIMELINE_START_HOUR = 8;
const TIMELINE_END_HOUR = 24;
const TOTAL_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR; // 16 tiếng
const HOUR_WIDTH = 120; // 1 tiếng cố định đúng 120px
const MINUTE_WIDTH = HOUR_WIDTH / 60; // ~2px cho mỗi phút
const DEFAULT_BASE_PRICE = 75000; // Giá vé mặc định 75.000đ

const RECURRENCE_OPTIONS: Array<{
  value: RecurrenceFrequency;
  label: string;
  helper: string;
}> = [
  { value: "NONE", label: "Không lặp", helper: "Chỉ tạo suất trong ngày đang chọn." },
  { value: "DAILY", label: "Hàng ngày", helper: "Tạo thêm mỗi ngày đến ngày kết thúc." },
  { value: "WEEKLY", label: "Hàng tuần", helper: "Tạo thêm cùng thứ mỗi tuần." },
  { value: "MONTHLY", label: "Hàng tháng", helper: "Tạo thêm cùng ngày trong tháng." },
];

// =================================================================
// 💡 PALETTE MÀU TỰ ĐỘNG CHO CÁC PHIM
// =================================================================
const MOVIE_COLORS = [
  "#4318FF", "#00C2FF", "#FF007A", "#7000FF", "#FF6B00",
  "#00D68F", "#E91E63", "#3F51B5", "#009688", "#FF5722",
  "#795548", "#607D8B", "#8BC34A", "#FFC107", "#673AB7",
];

// =================================================================
// 💡 TYPES NỘI BỘ CHO TIMELINE UI
// =================================================================

/** Phim từ sidebar (chờ kéo vào lịch) */
type UnscheduledMovie = {
  movieId: string;
  movieNameVn: string;
  duration: number;
  ageRating: string;
  color: string;
};

/** Slot hiển thị trên timeline (đã schedule) */
type ShowtimeSlot = {
  id: string;            // showtimeId từ BE
  movieId: string;
  roomId: string;
  movieNameVn: string;
  startMinutesFrom8AM: number;
  duration: number;      // phút (endTime - startTime)
  color: string;
  startTime: string;     // ISO
  endTime: string;       // ISO
  basePrice: number;
  status: string;
  hasBookings?: boolean;
};

type DraggingMovie =
  | (UnscheduledMovie & { isNew: true })
  | (ShowtimeSlot & { isNew: false; originalRoomId: string });

type Schedule = Record<string, ShowtimeSlot[]>;

// Sinh danh sách mốc giờ hiển thị từ 08:00 đến 24:00
const TIME_SLOTS: string[] = [];
for (let i = TIMELINE_START_HOUR; i <= TIMELINE_END_HOUR; i++) {
  TIME_SLOTS.push(`${i.toString().padStart(2, '0')}:00`);
}

// =================================================================
// 💡 HELPERS
// =================================================================

/** Parse giờ và phút từ chuỗi ISO mà không bị lệch múi giờ (timezone conversion) */
const parseTimeFromISO = (isoString: string): { hours: number; minutes: number } => {
  if (!isoString) return { hours: 0, minutes: 0 };
  const timePart = isoString.includes("T") ? isoString.split("T")[1] : isoString.split(" ")[1];
  if (!timePart) return { hours: 0, minutes: 0 };
  const [hStr, mStr] = timePart.split(":");
  return {
    hours: parseInt(hStr, 10) || 0,
    minutes: parseInt(mStr, 10) || 0,
  };
};

/** Tính số phút tính từ 08:00 dựa trên ISO string */
const isoToMinutesFrom8AM = (isoString: string): number => {
  const { hours, minutes } = parseTimeFromISO(isoString);
  return (hours - TIMELINE_START_HOUR) * 60 + minutes;
};

/** Lấy "HH:mm" ngắn từ ISO string */
const getShortTimeFromISO = (isoString: string): string => {
  if (!isoString) return "";
  const { hours, minutes } = parseTimeFromISO(isoString);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

/** Tính số phút chênh lệch giữa 2 ISO datetime */
const diffMinutes = (startISO: string, endISO: string): number => {
  return Math.round((new Date(endISO).getTime() - new Date(startISO).getTime()) / 60000);
};

/** Format ngày "yyyy-MM-dd" */
const formatDateToYMD = (date: Date): string => {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatVoucherDiscount = (voucher: Voucher): string => {
  if (voucher.discountType === "PERCENT") {
    return `${voucher.discountValue}%`;
  }

  return `${new Intl.NumberFormat("vi-VN").format(voucher.discountValue)}đ`;
};

const getVoucherScopeLabel = (voucher: Voucher): string => {
  switch ((voucher.applicableScope || "").toUpperCase()) {
    case "TICKET_ONLY":
      return "tiền vé";
    case "FOOD_BEVERAGE_ONLY":
      return "F&B";
    default:
      return "toàn đơn";
  }
};

const getCompensationVoucherLabel = (voucher: Voucher): string =>
  `${voucher.voucherCode} - ${voucher.title || "Voucher đền bù"} (${formatVoucherDiscount(voucher)} · ${getVoucherScopeLabel(voucher)})`;

/** Tạo ISO datetime từ ngày đã chọn + số phút tính từ 08:00 */
const minutesFrom8AMToISO = (selectedDate: string, minutesFrom8AM: number): string => {
  const [y, m, d] = selectedDate.split("-").map(Number);
  const totalMinutes = TIMELINE_START_HOUR * 60 + minutesFrom8AM;
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.floor(totalMinutes % 60);
  const dateObj = new Date(Date.UTC(y, m - 1, d, hours, mins, 0));
  return dateObj.toISOString();
};

/** Map màu sắc cho phim dựa trên movieId → stable color */
const movieColorMap = new Map<string, string>();
let colorIndex = 0;
const getMovieColor = (movieId: string): string => {
  if (!movieColorMap.has(movieId)) {
    movieColorMap.set(movieId, MOVIE_COLORS[colorIndex % MOVIE_COLORS.length]);
    colorIndex++;
  }
  return movieColorMap.get(movieId)!;
};

// =================================================================
// 💡 COMPONENT CHÍNH
// =================================================================
export default function ManageShowtime() {
  // ---------- State: Data từ API ----------
  const [cinemas, setCinemas] = useState<CinemaResponse[]>([]);
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [movies, setMovies] = useState<MovieResponse[]>([]);
  const [allShowtimes, setAllShowtimes] = useState<ShowtimeResponse[]>([]);
  const [compensationVouchers, setCompensationVouchers] = useState<Voucher[]>([]);

  // ---------- State: Bộ lọc ----------
  const [selectedCinemaId, setSelectedCinemaId] = useState("");
  const [selectedDate, setSelectedDate] = useState(formatDateToYMD(new Date()));
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>("NONE");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");

  // ---------- Computed: ngày quá khứ (để cảnh báo và khóa chỉnh sửa) ----------
  const isPastDate = selectedDate < formatDateToYMD(new Date());

  // ---------- State: UI ----------
  const [schedule, setSchedule] = useState<Schedule>({});
  const [draggingMovie, setDraggingMovie] = useState<DraggingMovie | null>(null);
  const [loading, setLoading] = useState(true);
  const isToastActive = useRef(false);
  const dragOffsetXRef = useRef<number>(0);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    roomId: string;
    slotId: string;
    movieName: string;
    roomName: string;
    startTimeStr: string;
  } | null>(null);

  // ---------- State: ChangeRoom Modal ----------
  const [changeRoomModal, setChangeRoomModal] = useState<{
    showtimeId: string;
    movieName: string;
    currentRoomId: string;
    currentRoomName: string;
    startTimeStr: string;
  } | null>(null);
  const [selectedTargetRoomId, setSelectedTargetRoomId] = useState<string>('');
  const [compensationVoucherCode, setCompensationVoucherCode] = useState<string>('');
  const [compensationNote, setCompensationNote] = useState<string>('');
  const [changeRoomLoading, setChangeRoomLoading] = useState<boolean>(false);

  // ---------- State: Update Showtime with Bookings Compensation Modal ----------
  const [updateCompModal, setUpdateCompModal] = useState<{
    slotsWithBookingsCount: number;
    affectedMovieNames: string[];
  } | null>(null);
  const [updateVoucherCode, setUpdateVoucherCode] = useState<string>('');
  const [updateCompNote, setUpdateCompNote] = useState<string>('');

  // ---------- State: UX Edit Tracking & Batch Save ----------
  const [isDirty, setIsDirty] = useState(false);
  const [deletedShowtimeIds, setDeletedShowtimeIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);

  // ---------- State: Cancel showtime with bookings ----------
  const [cancelConfirmShowtimes, setCancelConfirmShowtimes] = useState<{ id: string; movieName: string; roomName: string; startTimeStr: string }[]>([]);
  const [cancelReason, setCancelReason] = useState("");
  const [savePromiseResolve, setSavePromiseResolve] = useState<((value: boolean) => void) | null>(null);

  // ---------- Blocker: Chặn chuyển trang SPA khi chưa lưu lịch chiếu ----------
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state !== "blocked") {
      return undefined;
    }

    let disposed = false;

    const confirmNavigation = async () => {
      const confirmed = await confirmWithPopup({
        title: "Rời khỏi trang?",
        message: TEXT.SHOWTIME.CONFIRM_NAVIGATE_AWAY,
        confirmLabel: "Rời trang",
        cancelLabel: "Ở lại",
      });

      if (disposed) {
        return;
      }

      if (confirmed) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    };

    void confirmNavigation();

    return () => {
      disposed = true;
    };
  }, [blocker]);

  // ---------- Blocker: Cảnh báo reload hoặc đóng tab khi chưa lưu ----------

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = TEXT.SHOWTIME.BEFORE_UNLOAD;
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  // ---------- Computed: Phòng chiếu lọc theo rạp đã chọn ----------
  const filteredRooms = React.useMemo(
    () =>
      rooms.filter(
        (r) => r.cinemaId === selectedCinemaId && r.roomStatus === "ACTIVE",
      ),
    [rooms, selectedCinemaId],
  );

  // ---------- Computed: Danh sách phim chờ (sidebar) ----------
  const unscheduledMovies: UnscheduledMovie[] = movies.map((m) => ({
    movieId: m.id,
    movieNameVn: m.movieNameVn,
    duration: m.duration,
    ageRating: m.ageRating || "P",
    color: getMovieColor(m.id),
  }));

  const newTempShowtimeCount = React.useMemo(
    () =>
      Object.values(schedule).reduce(
        (count, slots) => count + slots.filter((slot) => slot.id.startsWith("temp_")).length,
        0,
      ),
    [schedule],
  );

  const recurringDateKeys = React.useMemo(
    () => getRecurringDateKeys(selectedDate, recurrenceEndDate, recurrenceFrequency),
    [recurrenceEndDate, recurrenceFrequency, selectedDate],
  );

  const recurringPreviewCount = newTempShowtimeCount * recurringDateKeys.length;
  const activeRecurrenceOption =
    RECURRENCE_OPTIONS.find((option) => option.value === recurrenceFrequency) ?? RECURRENCE_OPTIONS[0];

  // =================================================================
  // 💡 FETCH DATA TỪ API
  // =================================================================

  const fetchCinemas = useCallback(async () => {
    try {
      const data = await showtimeService.getCinemas();
      const activeCinemas = data.filter((c) => c.cinemaStatus === "ACTIVE");
      setCinemas(activeCinemas);
      if (activeCinemas.length > 0 && !selectedCinemaId) {
        setSelectedCinemaId(activeCinemas[0].cinemaId);
      }
    } catch {
      toast.error(TEXT.SHOWTIME.ERR_FETCH_CINEMAS);
    }
  }, [selectedCinemaId]);

  const fetchRooms = useCallback(async () => {
    try {
      const data = await showtimeService.getRooms();
      setRooms(data);
    } catch {
      toast.error(TEXT.SHOWTIME.ERR_FETCH_ROOMS);
    }
  }, []);

  const fetchMovies = useCallback(async () => {
    try {
      const data = await showtimeService.getMoviesForScheduling();
      setMovies(data);
    } catch {
      toast.error(TEXT.SHOWTIME.ERR_FETCH_MOVIES);
    }
  }, []);

  const fetchShowtimes = useCallback(async () => {
    try {
      const data = await showtimeService.getShowtimes();
      setAllShowtimes(data);
    } catch {
      toast.error(TEXT.SHOWTIME.ERR_FETCH_SHOWTIMES);
    }
  }, []);

  const fetchCompensationVouchers = useCallback(async () => {
    try {
      const data = await voucherService.getCompensationVouchers();
      setCompensationVouchers(data);
    } catch {
      setCompensationVouchers([]);
      toast.warn("Không tải được danh sách voucher đền bù. Bạn vẫn có thể đổi phòng nhưng không thể chọn voucher.");
    }
  }, []);

  /** Fetch toàn bộ data ban đầu */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([
        fetchCinemas(),
        fetchRooms(),
        fetchMovies(),
        fetchShowtimes(),
        fetchCompensationVouchers(),
      ]);
      setLoading(false);
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =================================================================
  // 💡 BUILD SCHEDULE TỪ SHOWTIMES + FILTERS
  // =================================================================
  useEffect(() => {
    if (isDirty) return undefined;

    const timeoutId = window.setTimeout(() => {
      if (filteredRooms.length === 0) {
        setSchedule({});
        return;
      }

      // Khởi tạo schedule rỗng cho mỗi phòng
      const newSchedule: Schedule = {};
      for (const room of filteredRooms) {
        newSchedule[room.roomId] = [];
      }

      // Lọc showtime theo cinema + ngày + status
      for (const st of allShowtimes) {
        // Chỉ hiển thị showtimes thuộc cinema đang chọn
        if (st.cinemaId !== selectedCinemaId) continue;

        // Chỉ hiển thị OPEN/CLOSED (bỏ CANCELLED)
        if (st.status === "CANCELLED") continue;

        // Lọc theo ngày đã chọn (tách chuỗi trực tiếp để tránh lệch múi giờ)
        const stDateStr = st.startTime.split("T")[0];
        if (stDateStr !== selectedDate) continue;

        // Chỉ thêm nếu phòng thuộc cinema đang chọn
        if (!newSchedule[st.roomId]) continue;

        const CLEAN_UP_BUFFER = 15;
        const durationMin = diffMinutes(st.startTime, st.endTime) - CLEAN_UP_BUFFER;
        const startMin = isoToMinutesFrom8AM(st.startTime);

        // Khấu trừ 15 phút dọn phòng để tính endTime hiển thị thực tế của bộ phim
        const endTimeDate = new Date(st.endTime);
        endTimeDate.setMinutes(endTimeDate.getMinutes() - CLEAN_UP_BUFFER);
        const endTimeISO = endTimeDate.toISOString();

        newSchedule[st.roomId].push({
          id: st.showtimeId,
          movieId: st.movieId,
          roomId: st.roomId,
          movieNameVn: st.movieTitle,
          startMinutesFrom8AM: startMin,
          duration: durationMin,
          color: getMovieColor(st.movieId),
          startTime: st.startTime,
          endTime: endTimeISO,
          basePrice: st.basePrice,
          status: st.status,
          hasBookings: st.hasBookings,
        });
      }

      setSchedule(newSchedule);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [allShowtimes, selectedCinemaId, selectedDate, filteredRooms, isDirty]);

  // =================================================================
  // 💡 DRAG & DROP HANDLERS
  // =================================================================

  const handleDragStartFromSidebar = (movie: UnscheduledMovie) => {
    isToastActive.current = false;
    dragOffsetXRef.current = 0;
    setDraggingMovie({ ...movie, isNew: true });
  };

  const handleDragStartFromTimeline = (
    e: React.DragEvent<HTMLDivElement>,
    roomShowtime: ShowtimeSlot,
    roomId: string
  ) => {
    isToastActive.current = false;
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffsetXRef.current = e.clientX - rect.left;
    setDraggingMovie({ ...roomShowtime, isNew: false, originalRoomId: roomId });
  };

  // --- HÀM THẢ CHUỘT CHUẨN HÓA LOCAL ---
  const handleDropOnRow = (e: React.DragEvent<HTMLDivElement>, roomId: string) => {
    e.preventDefault();
    if (!draggingMovie) return;

    const rowElement = e.currentTarget as HTMLElement;
    const rect = rowElement.getBoundingClientRect();

    // Tính tọa độ vị trí thả chuột trừ đi độ lệch điểm cầm trên thẻ phim (dragOffsetX)
    const relativeX = (e.clientX - rect.left) - dragOffsetXRef.current;
    const rawStartMinutes = Math.round(relativeX / MINUTE_WIDTH);

    const SNAP_INTERVAL = 15;
    let startMinutes = Math.round(rawStartMinutes / SNAP_INTERVAL) * SNAP_INTERVAL;

    if (startMinutes < 0) startMinutes = 0;

    const maxMinutes = TOTAL_HOURS * 60 - draggingMovie.duration;
    if (startMinutes > maxMinutes) {
      startMinutes = Math.floor(maxMinutes / SNAP_INTERVAL) * SNAP_INTERVAL;
    }

    const durationMinutes = draggingMovie.duration;
    const endMinutes = startMinutes + durationMinutes;

    // THUẬT TOÁN CHECK ĐÈ LỊCH + BUFFER 15 PHÚT (client-side)
    const CLEAN_UP_BUFFER = 15;
    const draggedSlotId = draggingMovie.isNew === false ? draggingMovie.id : null;
    const existingSlotsInRoom = (schedule[roomId] || []).filter(
      (slot) => slot.id !== draggedSlotId
    );

    for (const slot of existingSlotsInRoom) {
      const slotStart = slot.startMinutesFrom8AM;
      const slotEnd = slotStart + slot.duration;

      const isOverlapping =
        startMinutes < (slotEnd + CLEAN_UP_BUFFER) &&
        endMinutes + CLEAN_UP_BUFFER > slotStart;

      if (isOverlapping) {
        if (!isToastActive.current) {
          const slotStartShort = getShortTimeFromISO(slot.startTime);
          const slotEndShort = getShortTimeFromISO(slot.endTime);
          toast.error(
            `❌ Đè lịch chiếu! Va chạm với phim "${slot.movieNameVn}" (${slotStartShort} - ${slotEndShort}). Vui lòng cách ra 15 phút dọn phòng.`
          );
          isToastActive.current = true;
        }
        setDraggingMovie(null);
        return;
      }
    }

    const startTimeISO = minutesFrom8AMToISO(selectedDate, startMinutes);
    const endTimeISO = minutesFrom8AMToISO(selectedDate, endMinutes);

    setSchedule((prev) => {
      const next = { ...prev };
      if (!next[roomId]) next[roomId] = [];

      if (draggingMovie.isNew === true) {
        // Tạo slot tạm mới
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const newSlot: ShowtimeSlot = {
          id: tempId,
          movieId: draggingMovie.movieId,
          roomId: roomId,
          movieNameVn: draggingMovie.movieNameVn,
          startMinutesFrom8AM: startMinutes,
          duration: durationMinutes,
          color: draggingMovie.color,
          startTime: startTimeISO,
          endTime: endTimeISO,
          basePrice: DEFAULT_BASE_PRICE,
          status: "OPEN",
        };
        next[roomId] = [...next[roomId], newSlot];
      } else {
        // Di chuyển slot hiện tại
        const origRoomId = draggingMovie.originalRoomId;
        if (next[origRoomId]) {
          next[origRoomId] = next[origRoomId].filter((s) => s.id !== draggingMovie.id);
        }
        const updatedSlot: ShowtimeSlot = {
          ...draggingMovie,
          roomId: roomId,
          startMinutesFrom8AM: startMinutes,
          startTime: startTimeISO,
          endTime: endTimeISO,
        };
        next[roomId] = [...next[roomId], updatedSlot];
      }
      return next;
    });

    setIsDirty(true);
    setDraggingMovie(null);
  };

  const handleDeleteShowtime = (roomId: string, slotId: string) => {
    const slot = schedule[roomId]?.find((s) => s.id === slotId);
    if (!slot) return;

    setSchedule((prev) => {
      const next = { ...prev };
      if (next[roomId]) {
        next[roomId] = next[roomId].filter((s) => s.id !== slotId);
      }
      return next;
    });

    if (!slotId.startsWith("temp_")) {
      setDeletedShowtimeIds((prev) => {
        const next = new Set(prev);
        next.add(slotId);
        return next;
      });
    }

    setIsDirty(true);
    toast.info(TEXT.SHOWTIME.TOAST_TEMP_DELETED);
  };

  const confirmDeleteShowtime = () => {
    if (!deleteConfirm) return;
    const { roomId, slotId } = deleteConfirm;
    setDeleteConfirm(null);

    setSchedule((prev) => {
      const next = { ...prev };
      if (next[roomId]) {
        next[roomId] = next[roomId].filter((s) => s.id !== slotId);
      }
      return next;
    });

    if (!slotId.startsWith("temp_")) {
      setDeletedShowtimeIds((prev) => {
        const next = new Set(prev);
        next.add(slotId);
        return next;
      });
    }

    setIsDirty(true);
    toast.info(TEXT.SHOWTIME.TOAST_TEMP_DELETED);
  };

  /** Thực thi Đổi phòng chuyên dụng (ChangeRoom) */
  const handleChangeRoomSubmit = async () => {
    if (!changeRoomModal || !selectedTargetRoomId) {
      toast.error("Vui lòng chọn phòng chiếu mới.");
      return;
    }
    try {
      setChangeRoomLoading(true);
      await showtimeService.changeRoom(changeRoomModal.showtimeId, {
        newRoomId: selectedTargetRoomId,
        compensationVoucherCode: compensationVoucherCode.trim() || undefined,
        compensationNote: compensationNote.trim() || undefined,
      });
      toast.success("Đổi phòng chiếu chuyên dụng thành công! Đã tự động cập nhật sơ đồ ghế và gửi email cho khách.");
      setChangeRoomModal(null);
      await fetchShowtimes();
    } catch (error: unknown) {
      console.error("ChangeRoom error:", error);
      const beMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(beMsg || "Không thể đổi phòng chiếu. Vui lòng thử lại.");
    } finally {
      setChangeRoomLoading(false);
    }
  };

  const handleCancelChanges = async () => {
    const confirmed = await confirmWithPopup({
      title: "Hủy thay đổi?",
      message: TEXT.SHOWTIME.CONFIRM_CANCEL_CHANGES,
      confirmLabel: "Hủy thay đổi",
      cancelLabel: "Quay lại",
    });
    if (!confirmed) return;

    setIsDirty(false);
    setDeletedShowtimeIds(new Set());
    setRecurrenceFrequency("NONE");
    setRecurrenceEndDate("");

    // Nạp lại schedule từ database
    if (filteredRooms.length > 0) {
      const newSchedule: Schedule = {};
      for (const room of filteredRooms) {
        newSchedule[room.roomId] = [];
      }
      for (const st of allShowtimes) {
        if (st.cinemaId !== selectedCinemaId) continue;
        if (st.status === "CANCELLED") continue;
        const stDateStr = st.startTime.split("T")[0];
        if (stDateStr !== selectedDate) continue;
        if (!newSchedule[st.roomId]) continue;

        const CLEAN_UP_BUFFER = 15;
        const durationMin = diffMinutes(st.startTime, st.endTime) - CLEAN_UP_BUFFER;
        const startMin = isoToMinutesFrom8AM(st.startTime);

        // Khấu trừ 15 phút dọn phòng để tính endTime hiển thị thực tế của bộ phim
        const endTimeDate = new Date(st.endTime);
        endTimeDate.setMinutes(endTimeDate.getMinutes() - CLEAN_UP_BUFFER);
        const endTimeISO = endTimeDate.toISOString();

        newSchedule[st.roomId].push({
          id: st.showtimeId,
          movieId: st.movieId,
          roomId: st.roomId,
          movieNameVn: st.movieTitle,
          startMinutesFrom8AM: startMin,
          duration: durationMin,
          color: getMovieColor(st.movieId),
          startTime: st.startTime,
          endTime: endTimeISO,
          basePrice: st.basePrice,
          status: st.status,
        });
      }
      setSchedule(newSchedule);
    } else {
      setSchedule({});
    }

    toast.info(TEXT.SHOWTIME.TOAST_RESTORED_ORIGINAL);
  };

  const buildRecurringDraftsForNewSlots = (newSlotsToCreate: ShowtimeSlot[]): RecurringShowtimeDraft[] => {
    if (recurrenceFrequency === "NONE" || newSlotsToCreate.length === 0) {
      return [];
    }

    if (!recurrenceEndDate) {
      throw new Error("Vui lòng chọn ngày kết thúc lặp lại.");
    }

    if (recurrenceEndDate < selectedDate) {
      throw new Error("Ngày kết thúc lặp lại không được nhỏ hơn ngày bắt đầu.");
    }

    const recurringDateKeys = getRecurringDateKeys(
      selectedDate,
      recurrenceEndDate,
      recurrenceFrequency,
    );

    if (recurringDateKeys.length === 0) {
      throw new Error("Khoảng lặp hiện tại chưa tạo thêm suất nào. Hãy chọn ngày kết thúc xa hơn.");
    }

    const sources: RecurrenceSourceShowtime[] = newSlotsToCreate.map((slot) => ({
      sourceId: slot.id,
      movieId: slot.movieId,
      roomId: slot.roomId,
      startMinutesFrom8AM: slot.startMinutesFrom8AM,
      duration: slot.duration,
      basePrice: slot.basePrice || DEFAULT_BASE_PRICE,
      status: slot.status || "OPEN",
    }));

    const drafts = buildRecurringShowtimeDrafts({
      sources,
      frequency: recurrenceFrequency,
      startDate: selectedDate,
      endDate: recurrenceEndDate,
      timelineStartHour: TIMELINE_START_HOUR,
    });

    const sourceMap = new Map(newSlotsToCreate.map((slot) => [slot.id, slot]));
    const generatedWindows: Array<{
      roomId: string;
      dateKey: string;
      startMinutesFrom8AM: number;
      duration: number;
      movieNameVn: string;
    }> = [];

    const hasOverlap = (
      start: number,
      duration: number,
      otherStart: number,
      otherDuration: number,
    ) => {
      const cleanUpBuffer = 15;
      const end = start + duration;
      const otherEnd = otherStart + otherDuration;
      return start < otherEnd + cleanUpBuffer && end + cleanUpBuffer > otherStart;
    };

    for (const draft of drafts) {
      const source = sourceMap.get(draft.sourceId);
      if (!source) continue;

      const existingConflict = allShowtimes.find((showtime) => {
        if (showtime.cinemaId !== selectedCinemaId) return false;
        if (showtime.roomId !== draft.roomId) return false;
        if (showtime.status === "CANCELLED") return false;
        if (showtime.startTime.split("T")[0] !== draft.startDate) return false;

        const existingDuration = Math.max(0, diffMinutes(showtime.startTime, showtime.endTime) - 15);
        return hasOverlap(
          source.startMinutesFrom8AM,
          source.duration,
          isoToMinutesFrom8AM(showtime.startTime),
          existingDuration,
        );
      });

      if (existingConflict) {
        const roomName =
          filteredRooms.find((room) => room.roomId === draft.roomId)?.roomName || draft.roomId;
        throw new Error(
          `Lịch lặp ngày ${draft.startDate} tại ${roomName} bị trùng với "${existingConflict.movieTitle}".`,
        );
      }

      const generatedConflict = generatedWindows.find(
        (item) =>
          item.roomId === draft.roomId &&
          item.dateKey === draft.startDate &&
          hasOverlap(
            source.startMinutesFrom8AM,
            source.duration,
            item.startMinutesFrom8AM,
            item.duration,
          ),
      );

      if (generatedConflict) {
        const roomName =
          filteredRooms.find((room) => room.roomId === draft.roomId)?.roomName || draft.roomId;
        throw new Error(
          `Các suất lặp ngày ${draft.startDate} tại ${roomName} đang tự trùng giờ với "${generatedConflict.movieNameVn}".`,
        );
      }

      generatedWindows.push({
        roomId: draft.roomId,
        dateKey: draft.startDate,
        startMinutesFrom8AM: source.startMinutesFrom8AM,
        duration: source.duration,
        movieNameVn: source.movieNameVn,
      });
    }

    return drafts;
  };

  const executeSaveChanges = async (voucherCode?: string, note?: string) => {
    setActionLoading(true);

    try {
      // 1. Kiểm tra các suất chiếu bị xóa có đặt chỗ trước không
      const showtimesToCancel: { id: string; movieName: string; roomName: string; startTimeStr: string }[] = [];
      const showtimesToDelete: string[] = [];

      for (const id of Array.from(deletedShowtimeIds)) {
        const original = allShowtimes.find((st) => st.showtimeId === id);
        try {
          const res = await api.get(`/api/seats/showtimes/${id}/map`) as any;
          const hasBookings = res?.success && res?.data && ((res.data.soldSeats?.length > 0) || (res.data.lockedSeats?.length > 0));
          if (hasBookings) {
            showtimesToCancel.push({
              id,
              movieName: original?.movieTitle || "Không rõ phim",
              roomName: original?.roomName || "Phòng",
              startTimeStr: original ? new Date(original.startTime).toLocaleString('vi-VN') : "Không rõ giờ",
            });
          } else {
            showtimesToDelete.push(id);
          }
        } catch {
          showtimesToDelete.push(id);
        }
      }

      if (showtimesToCancel.length > 0) {
        setCancelConfirmShowtimes(showtimesToCancel);
        setCancelReason("");

        // Tạm dừng chờ người dùng nhập lý do hủy & mã voucher đền bù trong modal
        const proceed = await new Promise<boolean>((resolve) => {
          setSavePromiseResolve(() => resolve);
        });

        if (!proceed) {
          setActionLoading(false);
          return;
        }
      }

      let totalPaidCompensated = 0;
      let totalTicketsIssued = 0;
      let totalCombosIssued = 0;

      // Hủy các suất chiếu có đặt chỗ
      for (const st of showtimesToCancel) {
        const result = await managerService.cancelShowtime(
          st.id,
          cancelReason.trim() || "Hủy suất chiếu bởi Quản trị viên",
          compensationVoucherCode.trim() || undefined
        ) as any;
        if (result) {
          totalPaidCompensated += result.paidBookingsCompensated || 0;
          totalTicketsIssued += result.ticketVouchersIssued || 0;
          totalCombosIssued += result.comboVouchersIssued || 0;
        }
      }

      // Xóa các suất chiếu trống
      for (const id of showtimesToDelete) {
        await showtimeService.deleteShowtime(id);
      }

      const newSlotsToCreate: ShowtimeSlot[] = [];
      const updatedSlots: Array<{ slot: ShowtimeSlot; original: ShowtimeResponse }> = [];

      for (const roomId in schedule) {
        const slots = schedule[roomId] || [];
        for (const slot of slots) {
          if (slot.id.startsWith("temp_")) {
            newSlotsToCreate.push(slot);
          } else {
            const original = allShowtimes.find((st) => st.showtimeId === slot.id);
            if (original) {
              const hasRoomChanged = original.roomId !== slot.roomId;
              const hasTimeChanged = original.startTime !== slot.startTime;
              if (hasRoomChanged || hasTimeChanged) {
                updatedSlots.push({ slot, original });
              }
            }
          }
        }
      }
      // Sắp xếp các slot cập nhật theo thứ tự thông minh (Topological Order)
      const recurringDrafts = buildRecurringDraftsForNewSlots(newSlotsToCreate);

      for (const id of Array.from(deletedShowtimeIds)) {
        await showtimeService.deleteShowtime(id);
      }

      const forwardMoved = updatedSlots.filter(
        (item) => new Date(item.slot.startTime).getTime() > new Date(item.original.startTime).getTime()
      ).sort(
        (a, b) => new Date(b.slot.startTime).getTime() - new Date(a.slot.startTime).getTime()
      );

      const backwardMoved = updatedSlots.filter(
        (item) => new Date(item.slot.startTime).getTime() <= new Date(item.original.startTime).getTime()
      ).sort(
        (a, b) => new Date(a.slot.startTime).getTime() - new Date(b.slot.startTime).getTime()
      );

      const sortedUpdateList = [...forwardMoved, ...backwardMoved];

      let createdCount = 0;
      let updatedCount = 0;

      // Thực hiện cập nhật các suất chiếu đã có theo thứ tự tối ưu
      for (const { slot } of sortedUpdateList) {
        const targetStatus = slot.status === "SUSPENDED" ? "OPEN" : (slot.status || "OPEN");
        await showtimeService.updateShowtime(slot.id, {
          movieId: slot.movieId,
          roomId: slot.roomId,
          startTime: slot.startTime,
          basePrice: slot.basePrice || DEFAULT_BASE_PRICE,
          status: targetStatus,
          compensationVoucherCode: slot.hasBookings ? (voucherCode?.trim() || undefined) : undefined,
          compensationNote: slot.hasBookings ? (note?.trim() || undefined) : undefined,
        });
        updatedCount++;
      }

      // Thực hiện tạo mới các suất chiếu temp
      const createPayloads: CreateShowtimePayload[] = [
        ...newSlotsToCreate.map((slot) => ({
          movieId: slot.movieId,
          roomId: slot.roomId,
          startTime: slot.startTime,
          basePrice: slot.basePrice || DEFAULT_BASE_PRICE,
          status: slot.status || "OPEN",
        })),
        ...recurringDrafts.map((draft) => ({
          movieId: draft.movieId,
          roomId: draft.roomId,
          startTime: draft.startTime,
          basePrice: draft.basePrice || DEFAULT_BASE_PRICE,
          status: draft.status || "OPEN",
        })),
      ];

      for (const payload of createPayloads) {
        await showtimeService.createShowtime(payload);
        createdCount++;
      }

      toast.success(
        `Đã lưu lịch chiếu thành công! (Tạo: ${createdCount}, Cập nhật: ${updatedCount}, Xóa: ${deletedShowtimeIds.size})`
      );

      setIsDirty(false);
      setDeletedShowtimeIds(new Set());
      setUpdateCompModal(null);
      setRecurrenceFrequency("NONE");
      setRecurrenceEndDate("");
      await fetchShowtimes(); // Reload database
    } catch (err: unknown) {
      // Map BE errorCode → thông báo tiếng Việt rõ ràng
      const ERROR_MESSAGES: Record<string, string> = TEXT.SHOWTIME.BE_ERRORS;
      const hasApiResponse = Boolean(err && typeof err === "object" && "response" in err);

      let errorMsg = TEXT.SHOWTIME.ERR_GENERIC_SAVE;
      if (hasApiResponse) {
        const axiosErr = err as { response?: { data?: { message?: string; errorCode?: string } } };
        const beMessage = axiosErr.response?.data?.message;
        const beCode = axiosErr.response?.data?.errorCode ?? "";
        const mapped = ERROR_MESSAGES[beCode];
        errorMsg = beMessage ?? mapped ?? errorMsg;
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }
      toast.error(errorMsg, { autoClose: 300 });

      if (hasApiResponse) {
        setIsDirty(false);
        setDeletedShowtimeIds(new Set());
        setUpdateCompModal(null);
        await fetchShowtimes();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    // Chặn lưu khi đang xem ngày quá khứ
    if (isPastDate) {
      toast.error(TEXT.SHOWTIME.ERR_PAST_DATE_SAVE);
      return;
    }

    // Kiểm tra xem có suất chiếu nào ĐÃ CÓ VÉ ĐẶT bị thay đổi không
    const slotsWithBookings: string[] = [];
    for (const roomId in schedule) {
      const slots = schedule[roomId] || [];
      for (const slot of slots) {
        if (!slot.id.startsWith("temp_")) {
          const original = allShowtimes.find((st) => st.showtimeId === slot.id);
          if (original) {
            const hasRoomChanged = original.roomId !== slot.roomId;
            const hasTimeChanged = original.startTime !== slot.startTime;
            if ((hasRoomChanged || hasTimeChanged) && slot.hasBookings) {
              slotsWithBookings.push(slot.movieNameVn);
            }
          }
        }
      }
    }

    // Nếu có suất chiếu có vé đã đặt bị thay đổi, mở Modal nhập Voucher Đền Bù
    if (slotsWithBookings.length > 0) {
      setUpdateVoucherCode("");
      setUpdateCompNote("");
      setUpdateCompModal({
        slotsWithBookingsCount: slotsWithBookings.length,
        affectedMovieNames: Array.from(new Set(slotsWithBookings)),
      });
      return;
    }

    await executeSaveChanges();
  };

  // =================================================================
  // 💡 EVENT HANDLERS CHO BỘ LỌC
  // =================================================================

  const handleCinemaChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextVal = e.target.value;
    if (isDirty) {
      const confirmed = await confirmWithPopup({
        title: "Đổi rạp?",
        message: TEXT.SHOWTIME.CONFIRM_CHANGE_CINEMA,
        confirmLabel: "Đổi rạp",
        cancelLabel: "Giữ lại",
      });
      if (!confirmed) return;
    }
    setSelectedCinemaId(nextVal);
    setIsDirty(false);
    setDeletedShowtimeIds(new Set());
    setRecurrenceFrequency("NONE");
    setRecurrenceEndDate("");
  };

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    if (isDirty) {
      const confirmed = await confirmWithPopup({
        title: "Đổi ngày?",
        message: TEXT.SHOWTIME.CONFIRM_CHANGE_DATE,
        confirmLabel: "Đổi ngày",
        cancelLabel: "Giữ lại",
      });
      if (!confirmed) return;
    }
    setSelectedDate(nextVal);
    if (recurrenceEndDate && recurrenceEndDate < nextVal) {
      setRecurrenceEndDate("");
    }
    setIsDirty(false);
    setDeletedShowtimeIds(new Set());
    setRecurrenceFrequency("NONE");
    setRecurrenceEndDate("");
  };

  // =================================================================
  // 💡 RENDER
  // =================================================================

  if (loading) {
    return (
      <div className="p-6 bg-[#0A0A0C] min-h-screen text-white font-['Urbanist'] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">{TEXT.SHOWTIME.SYNCING}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#0A0A0C] min-h-screen text-white font-['Urbanist'] select-none">
      {/* TIÊU ĐỀ */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-wider">{TEXT.SHOWTIME.TITLE}</h1>
        <p className="text-xs text-gray-400 mt-1">{TEXT.SHOWTIME.SUBTITLE}</p>
      </div>

      {/* BỘ LỌC RẠP + NGÀY */}
      <div className="mb-6 rounded-2xl border border-slate-700/80 bg-[#111827] p-4 shadow-xl">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_190px_minmax(440px,1.7fr)_minmax(220px,.8fr)]">
          <div className="min-w-0">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Rạp chiếu
            </label>
            <div className="relative">
              <select
                value={selectedCinemaId}
                onChange={handleCinemaChange}
                className="h-12 w-full appearance-none rounded-xl border border-slate-700 bg-[#0F172A] px-4 text-sm font-bold text-blue-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25"
              >
                {cinemas.length === 0 && <option value="" className="bg-[#0F172A] text-white">{TEXT.SHOWTIME.NO_CINEMAS}</option>}
                {cinemas.map((c) => (
                  <option key={c.cinemaId} value={c.cinemaId} className="bg-[#0F172A] text-white">
                    {c.cinemaName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Ngày xếp lịch
            </label>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                style={{ colorScheme: "dark" }}
                className={`h-12 w-full rounded-xl border px-4 text-sm font-bold outline-none transition focus:ring-2 ${
                  isPastDate
                    ? "border-amber-500/40 bg-amber-950/20 text-amber-300 focus:ring-amber-500/25"
                    : "border-slate-700 bg-[#0F172A] text-blue-50 focus:border-cyan-400 focus:ring-cyan-500/25"
                }`}
              />
            </div>
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
              Lặp lại lịch chiếu
            </label>
            <div className={`grid gap-3 ${recurrenceFrequency !== "NONE" ? "sm:grid-cols-[1fr_180px]" : "sm:grid-cols-[1fr]"}`}>
              <select
                value={recurrenceFrequency}
                onChange={(e) => {
                  const nextFrequency = e.target.value as RecurrenceFrequency;
                  setRecurrenceFrequency(nextFrequency);
                  if (nextFrequency === "NONE") {
                    setRecurrenceEndDate("");
                  } else if (!recurrenceEndDate) {
                    setRecurrenceEndDate(selectedDate);
                  }
                }}
                disabled={isPastDate}
                className="h-12 w-full rounded-xl border border-slate-700 bg-[#0F172A] px-4 text-sm font-bold text-blue-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {RECURRENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#0F172A] text-white">
                    {option.label}
                  </option>
                ))}
              </select>

              {recurrenceFrequency !== "NONE" && (
                <input
                  type="date"
                  value={recurrenceEndDate}
                  min={selectedDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                  disabled={isPastDate}
                  style={{ colorScheme: "dark" }}
                  className="h-12 w-full rounded-xl border border-slate-700 bg-[#0F172A] px-4 text-sm font-bold text-blue-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                />
              )}
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-[11px] font-semibold leading-5 text-cyan-100">
              {activeRecurrenceOption.helper}
              {recurrenceFrequency !== "NONE" && (
                <span className="ml-2 text-amber-200">
                  Dự kiến tạo thêm {recurringPreviewCount} suất từ {newTempShowtimeCount} suất mới.
                </span>
              )}
            </div>
          </div>

          <div className="flex min-h-full flex-col justify-between gap-3 rounded-xl border border-slate-700 bg-[#0F172A] p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <span className="inline-block h-3 w-3 rounded bg-blue-500/40 ring-1 ring-blue-500/30"></span>
              {TEXT.SHOWTIME.DEFAULT_TICKET_PRICE} {DEFAULT_BASE_PRICE.toLocaleString("vi-VN")}đ
            </div>
            {isPastDate && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300">
                {TEXT.SHOWTIME.PAST_DATE_WARNING}
              </div>
            )}
            {isDirty && !isPastDate && (
              <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2">
                <div className="text-xs font-bold text-amber-300">{TEXT.SHOWTIME.UNSAVED_CHANGES_WARNING}</div>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={handleSaveChanges}
                    disabled={actionLoading}
                    className="h-9 w-full rounded-lg bg-emerald-600 px-3 text-[11px] font-black leading-none text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <span className="block truncate">
                      {actionLoading ? TEXT.SHOWTIME.BTN_SAVING : TEXT.SHOWTIME.BTN_SAVE_SCHEDULE}
                    </span>
                  </button>
                  <button
                    onClick={handleCancelChanges}
                    disabled={actionLoading}
                    className="h-9 w-full rounded-lg bg-red-600 px-3 text-[11px] font-black leading-none text-white transition hover:bg-red-500 disabled:opacity-50"
                  >
                    <span className="block truncate">{TEXT.SHOWTIME.BTN_CANCEL}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hidden">
        <div className="relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400 group-hover:text-blue-300 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1v1H9V7zm5 0h1v1h-1V7zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1z" />
            </svg>
          </div>
          <select
            value={selectedCinemaId}
            onChange={handleCinemaChange}
            className="pl-9 pr-10 py-2.5 appearance-none bg-gradient-to-r from-[#1E293B] to-[#0F172A] border border-gray-700 hover:border-blue-500/40 rounded-xl text-sm font-medium text-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all duration-300 shadow-md hover:shadow-lg group-hover:shadow-blue-500/20"
          >
            {cinemas.length === 0 && <option value="" className="bg-[#0F172A] text-white">{TEXT.SHOWTIME.NO_CINEMAS}</option>}
            {cinemas.map((c) => (
              <option key={c.cinemaId} value={c.cinemaId} className="bg-[#0F172A] text-white">
                {c.cinemaName}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-blue-300 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <div className="relative group">
          <div className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${isPastDate ? 'text-amber-500' : 'text-blue-400 group-hover:text-blue-300'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            style={{ colorScheme: "dark" }}
            className={`pl-9 pr-3 py-2 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all duration-300 shadow-md hover:shadow-lg ${isPastDate
                ? 'bg-amber-950/20 border border-amber-500/30 text-amber-400 focus:ring-amber-500'
                : 'bg-gradient-to-r from-[#1E293B] to-[#0F172A] border border-gray-700 hover:border-blue-500/40 text-blue-50'
              }`}
          />
        </div>

        {/* Cảnh báo ngày quá khứ */}
        <div className="flex min-w-[360px] flex-1 flex-wrap items-end gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
          <div className="min-w-[150px] flex-1">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-cyan-300">
              Lặp lại lịch chiếu
            </label>
            <select
              value={recurrenceFrequency}
              onChange={(e) => {
                const nextFrequency = e.target.value as RecurrenceFrequency;
                setRecurrenceFrequency(nextFrequency);
                if (nextFrequency === "NONE") {
                  setRecurrenceEndDate("");
                } else if (!recurrenceEndDate) {
                  setRecurrenceEndDate(selectedDate);
                }
              }}
              disabled={isPastDate}
              className="w-full rounded-xl border border-gray-700 bg-[#0F172A] px-3 py-2.5 text-sm font-semibold text-blue-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {RECURRENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#0F172A] text-white">
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {recurrenceFrequency !== "NONE" && (
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                Ngày kết thúc lặp
              </label>
              <input
                type="date"
                value={recurrenceEndDate}
                min={selectedDate}
                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                disabled={isPastDate}
                style={{ colorScheme: "dark" }}
                className="w-full rounded-xl border border-gray-700 bg-[#0F172A] px-3 py-2.5 text-sm font-semibold text-blue-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          )}

          <div className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-[11px] font-semibold text-gray-300">
            <div className="text-cyan-200">{activeRecurrenceOption.helper}</div>
            {recurrenceFrequency !== "NONE" && (
              <div className="mt-1 text-amber-200">
                Dự kiến tạo thêm {recurringPreviewCount} suất từ {newTempShowtimeCount} suất mới.
              </div>
            )}
          </div>
        </div>

        {isPastDate && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-lg text-amber-400 text-xs font-semibold">
            <span>{TEXT.SHOWTIME.PAST_DATE_WARNING}</span>
          </div>
        )}

        {isDirty && !isPastDate && (
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg ml-4">
            <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
              {TEXT.SHOWTIME.UNSAVED_CHANGES_WARNING}
            </span>
            <button
              onClick={handleSaveChanges}
              disabled={actionLoading}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white rounded transition shadow-md"
            >
              {actionLoading ? TEXT.SHOWTIME.BTN_SAVING : TEXT.SHOWTIME.BTN_SAVE_SCHEDULE}
            </button>
            <button
              onClick={handleCancelChanges}
              disabled={actionLoading}
              className="px-3 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-bold text-white rounded transition"
            >
              {TEXT.SHOWTIME.BTN_CANCEL}
            </button>
          </div>
        )}


        <div className="flex items-center gap-2 ml-auto text-xs text-gray-500">
          <span className="inline-block w-3 h-3 rounded bg-blue-500/40 border border-blue-500/30"></span>
          {TEXT.SHOWTIME.DEFAULT_TICKET_PRICE} {DEFAULT_BASE_PRICE.toLocaleString("vi-VN")}đ
        </div>
      </div>

      {/* LAYOUT GRID CHÍNH */}
      <div className="grid grid-cols-4 gap-6 items-start">

        {/* VÙNG CHỨA TIMELINE LỚN BÊN TRÁI */}
        <div id="timeline-scroll-wrapper" className="col-span-3 bg-[#111C44] border border-gray-800 rounded-2xl shadow-2xl overflow-x-auto class-scroll-custom max-w-full">
          {filteredRooms.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p className="text-lg font-semibold mb-2">{TEXT.SHOWTIME.NO_ROOMS_TITLE}</p>
              <p className="text-sm">{TEXT.SHOWTIME.NO_ROOMS_DESC}</p>
            </div>
          ) : (
            <div style={{ width: `${192 + TOTAL_HOURS * HOUR_WIDTH}px` }} className="flex flex-col">

              {/* 1️⃣ TRỤC THỜI GIAN (HEADER) */}
              <div className="flex border-b border-gray-800 bg-blue-950/20 text-xs text-gray-400 font-bold uppercase h-12 items-center">
                <div className="w-48 h-full flex items-center justify-center border-r border-gray-800 bg-[#111C44] sticky left-0 z-40 shrink-0 text-white">
                  {TEXT.SHOWTIME.HEADER_ROOM_TIME}
                </div>

                <div className="flex-1 flex h-full items-center relative">
                  {TIME_SLOTS.map((time, idx) => (
                    <div
                      key={time}
                      className="absolute text-gray-400 text-[11px] font-bold"
                      style={{
                        left: `${idx * HOUR_WIDTH}px`,
                        width: `${HOUR_WIDTH}px`,
                        transform: idx === 0 ? "translateX(8px)" : "translateX(-50%)",
                        textAlign: idx === 0 ? "left" : "center"
                      }}
                    >
                      {time}
                    </div>
                  ))}
                </div>
              </div>

              {/* 2️⃣ THÂN LƯỚI CÁC PHÒNG CHIẾU */}
              <div className="divide-y divide-gray-800/60">
                {filteredRooms.map((room) => (
                  <div key={room.roomId} className="flex min-h-[95px] items-center relative">

                    {/* Cột tên phòng ghim cứng lề trái */}
                    <div className="w-48 h-[95px] border-r border-gray-800 font-semibold text-gray-200 text-center text-sm bg-[#111C44] sticky left-0 z-30 shrink-0 shadow-md flex flex-col items-center justify-center gap-0.5">
                      <span>{room.roomName}</span>
                      <span className="text-[9px] text-gray-500 font-normal">{room.seatCount} {TEXT.SHOWTIME.SEAT_COUNT}</span>
                    </div>

                    {/* Vùng nhận Drop và vẽ phim */}
                    <div
                      className={`flex-1 h-[95px] relative flex shrink-0 transition ${isPastDate
                        ? 'bg-[#0d1637]/10 cursor-not-allowed'
                        : 'bg-[#0d1637]/30 cursor-crosshair'
                        }`}
                      onDragOver={(e) => { if (!isPastDate) e.preventDefault(); }}
                      onDrop={(e) => { if (!isPastDate) void handleDropOnRow(e, room.roomId); }}
                    >
                      {/* Lớp phủ khóa khi xem ngày quá khứ */}
                      {isPastDate && (
                        <div className="absolute inset-0 z-10 pointer-events-none bg-gray-900/20 flex items-center justify-center">
                          <span className="text-[10px] text-gray-600 font-semibold tracking-widest uppercase select-none opacity-60">
                            🔒 Chỉ xem
                          </span>
                        </div>
                      )}


                      {/* Vạch kẻ dọc chia khung giờ mờ làm nền */}
                      {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 border-l border-gray-800/25 pointer-events-none"
                          style={{ left: `${i * HOUR_WIDTH}px` }}
                        />
                      ))}

                      {/* VÙNG KHÔNG GIAN TUYỆT ĐỐI CHỨA CÁC THẺ PHIM ĐÈ LÊN LỚP NỀN */}
                      <div className="absolute inset-0 pointer-events-none">
                        {schedule[room.roomId]?.map((slot) => {
                          const widthPx = slot.duration * MINUTE_WIDTH;
                          const leftPx = slot.startMinutesFrom8AM * MINUTE_WIDTH;

                          const startShort = getShortTimeFromISO(slot.startTime);
                          const endShort = getShortTimeFromISO(slot.endTime);
                          const isCurrentDragging = draggingMovie?.isNew === false && draggingMovie?.id === slot.id;

                          return (
                            <div
                              key={slot.id}
                              draggable={!isPastDate}
                              onDragStart={(e) => { if (!isPastDate) handleDragStartFromTimeline(e, slot, room.roomId); }}
                              className={`absolute top-3 bottom-3 rounded-xl shadow-xl border border-white/10 px-3 py-2 flex flex-col justify-between overflow-hidden transition-all pointer-events-auto ${isPastDate
                                ? 'cursor-default opacity-60'
                                : 'cursor-grab active:cursor-grabbing hover:brightness-110 hover:scale-[1.01] hover:shadow-2xl hover:z-50'
                                } ${isCurrentDragging ? 'opacity-40 z-50' : 'z-20'}`}
                              style={{ left: `${leftPx}px`, width: `${widthPx}px`, backgroundColor: slot.color }}
                            >
                              <div className="flex justify-between items-start gap-1">
                                <div className="text-xs font-bold truncate text-white max-w-[70%]">
                                  {slot.movieNameVn}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Nút Đổi Phòng Chuyên Dụng ChangeRoom (Chỉ hiện khi suất chiếu ĐÃ CÓ vé đặt) */}
                                  {!isPastDate && !slot.id.startsWith("temp_") && slot.hasBookings && (
                                    <button
                                      title="Đổi phòng chiếu chuyên dụng (ChangeRoom)"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTargetRoomId("");
                                        setCompensationVoucherCode("");
                                        setCompensationNote("");
                                        setChangeRoomModal({
                                          showtimeId: slot.id,
                                          movieName: slot.movieNameVn,
                                          currentRoomId: room.roomId,
                                          currentRoomName: room.roomName,
                                          startTimeStr: `${startShort} - ${endShort}`,
                                        });
                                      }}
                                      className="text-white/80 hover:text-white bg-black/40 hover:bg-cyan-600 px-1.5 py-0.5 rounded-full flex items-center justify-center text-[9px] transition-all shrink-0 z-50 shadow-md cursor-pointer"
                                    >
                                      Đổi
                                    </button>
                                  )}
                                  {/* Ẩn nút xóa khi xem ngày quá khứ */}
                                  {!isPastDate && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); void handleDeleteShowtime(room.roomId, slot.id); }}
                                      className="text-white/60 hover:text-white bg-black/40 hover:bg-red-600 w-4 h-4 rounded-full flex items-center justify-center text-[10px] transition-all shrink-0 z-50 shadow-md cursor-pointer"
                                    >
                                      &times;
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="text-[9px] text-white/90 font-medium tracking-wide">
                                {startShort && endShort ? `${startShort} - ${endShort}` : "N/A"}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}
        </div>

        {/* DANH SÁCH PHIM CHỜ BÊN PHẢI */}
        <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-4 shadow-2xl flex flex-col max-h-[480px]">
          <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-4 border-b border-gray-800 pb-3">
            {TEXT.SHOWTIME.UNSCHEDULED_MOVIES_TITLE}
          </h3>
          {unscheduledMovies.length === 0 ? (
            <div className="text-center text-gray-500 py-6 text-sm">
              {TEXT.SHOWTIME.NO_UNSCHEDULED_MOVIES}
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto pr-1">
              {unscheduledMovies.map((movie) => (
                <div
                  key={movie.movieId}
                  draggable={!isPastDate}
                  onDragStart={() => { if (!isPastDate) handleDragStartFromSidebar(movie); }}
                  className={`p-3.5 rounded-xl border border-gray-800 bg-[#0F172A] transition-all flex flex-col justify-between ${isPastDate
                    ? 'cursor-not-allowed opacity-50'
                    : 'hover:border-gray-600 cursor-grab active:cursor-grabbing hover:translate-x-1'
                    }`}
                >
                  <div className="text-sm font-bold text-white">{movie.movieNameVn}</div>
                  <div className="text-[10px] text-gray-400 mt-1 flex justify-between items-center">
                    <span>{movie.duration} {TEXT.SHOWTIME.MINUTES} ({movie.ageRating})</span>
                    <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded text-white shadow-sm" style={{ backgroundColor: movie.color }}>
                      {isPastDate ? 'Chỉ Xem' : 'Kéo Thả'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* CONFIRM DELETE MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all duration-300">
          <style>{`
            @keyframes modalScaleIn {
              from { opacity: 0; transform: scale(0.95) translateY(10px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .animate-modal-scale {
              animation: modalScaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            }
          `}</style>
          <div className="bg-[#111C44] border border-red-500/20 rounded-2xl w-full max-w-md p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-modal-scale flex flex-col gap-5">
            {/* Header / Warning Icon */}
            <div className="flex items-center gap-4 border-b border-gray-800/80 pb-4">
              <div className="bg-red-500/10 text-red-500 p-3 rounded-xl border border-red-500/20 shadow-inner shrink-0">
                <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-7v6m5-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-white tracking-wide">Xác nhận xóa suất chiếu</h3>
                <p className="text-xs text-gray-400 mt-0.5">Hành động này sẽ loại bỏ suất chiếu vĩnh viễn khỏi lịch.</p>
              </div>
            </div>

            {/* Info details */}
            <div className="bg-[#0F172A] border border-gray-800/80 rounded-xl p-4 text-left flex flex-col gap-3">
              <div className="flex flex-col gap-1 border-b border-gray-800 pb-2.5">
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Phim</span>
                <span className="text-white text-sm font-bold line-clamp-2">{deleteConfirm.movieName}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Phòng chiếu</span>
                  <span className="text-blue-400 text-xs font-semibold">{deleteConfirm.roomName}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Khung giờ</span>
                  <span className="text-yellow-400 text-xs font-semibold">{deleteConfirm.startTimeStr}</span>
                </div>
              </div>
            </div>

            {/* Voucher bồi thường khi xóa showtime */}
            <div className="flex flex-col gap-1.5 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                  Voucher bồi thường sự cố (Nếu có vé)
                </span>
              </div>
              <input
                type="text"
                value={compensationVoucherCode}
                onChange={(e) => setCompensationVoucherCode(e.target.value)}
                placeholder="Nhập mã voucher đền bù tùy chỉnh (VD: COMP-100)..."
                className="w-full rounded-xl border border-gray-800 bg-[#0F172A] px-3.5 py-2 text-xs text-white outline-none focus:border-amber-400"
              />
              <p className="text-[10px] text-gray-500">Mã voucher bồi thường sẽ được phát hành tự động cho khách hàng có vé bị ảnh hưởng do xóa suất chiếu.</p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 justify-end mt-1">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-5 py-2.5 bg-gray-800/60 hover:bg-gray-800 text-gray-300 hover:text-white font-semibold rounded-xl border border-gray-700/60 transition-all text-xs active:scale-95 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => void confirmDeleteShowtime()}
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-xl shadow-lg shadow-red-900/20 transition-all text-xs active:scale-95 cursor-pointer"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Đổi Phòng Chuyên Dụng (ChangeRoom) */}
      {changeRoomModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all duration-300">
          <div className="bg-[#111C44] border border-cyan-500/30 rounded-2xl w-full max-w-md p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-modal-scale flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-gray-800/80 pb-4">
              <div className="bg-cyan-500/10 text-cyan-400 p-3 rounded-xl border border-cyan-500/20 shadow-inner shrink-0">
                <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-white tracking-wide">Đổi phòng chiếu (ChangeRoom)</h3>
                <p className="text-xs text-gray-400 mt-0.5">Dành cho suất chiếu đã phát sinh đơn đặt vé.</p>
              </div>
            </div>

            {/* Info details */}
            <div className="bg-[#0F172A] border border-gray-800/80 rounded-xl p-4 text-left flex flex-col gap-3">
              <div className="flex flex-col gap-1 border-b border-gray-800 pb-2.5">
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Phim</span>
                <span className="text-white text-sm font-bold line-clamp-2">{changeRoomModal.movieName}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 border-b border-gray-800 pb-2.5">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Phòng hiện tại</span>
                  <span className="text-red-400 text-xs font-semibold">{changeRoomModal.currentRoomName}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Khung giờ</span>
                  <span className="text-yellow-400 text-xs font-semibold">{changeRoomModal.startTimeStr}</span>
                </div>
              </div>

              {/* Target Room Selection */}
              <div className="flex flex-col gap-1.5 pt-1">
                <label className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                  Chọn phòng chiếu mới *
                </label>
                <select
                  value={selectedTargetRoomId}
                  onChange={(e) => setSelectedTargetRoomId(e.target.value)}
                  className="bg-[#1E293B] text-white border border-cyan-500/40 rounded-xl p-2.5 text-xs font-medium focus:outline-none focus:border-cyan-400 transition-all"
                >
                  <option value="">-- Chọn phòng chiếu mới --</option>
                  {filteredRooms
                    .filter((r) => r.roomId !== changeRoomModal.currentRoomId)
                    .map((r) => (
                      <option key={r.roomId} value={r.roomId}>
                        {r.roomName} ({r.capacity} ghế)
                      </option>
                    ))}
                </select>
              </div>

              {/* Voucher & Compensation Section */}
              <div className="flex flex-col gap-3 pt-2.5 border-t border-gray-800/80">
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                    Đền bù & Voucher cho khách hàng (Tùy chọn)
                  </label>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-gray-400">
                    Chọn voucher đền bù:
                  </label>
                  <select
                    value={compensationVoucherCode}
                    onChange={(e) => setCompensationVoucherCode(e.target.value)}
                    className="bg-[#1E293B] text-amber-300 border border-amber-500/30 rounded-xl p-2 text-xs font-semibold focus:outline-none focus:border-amber-400 transition-all"
                  >
                    <option value="">-- Không áp dụng voucher đền bù --</option>
                    {compensationVouchers.map((voucher) => (
                      <option key={voucher.voucherId} value={voucher.voucherCode}>
                        {getCompensationVoucherLabel(voucher)}
                      </option>
                    ))}
                  </select>
                  {compensationVouchers.length === 0 && (
                    <span className="text-[10px] font-semibold text-amber-300/80">
                      Chưa có voucher nhóm COMPENSATION đang ACTIVE.
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-gray-400">
                    Ghi chú quyền lợi đền bù (Compensation Note):
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Tặng 01 Combo Bắp Nước miễn phí tại quầy CSKH..."
                    value={compensationNote}
                    onChange={(e) => setCompensationNote(e.target.value)}
                    className="bg-[#1E293B] text-white border border-gray-700 rounded-xl p-2 text-xs font-medium focus:outline-none focus:border-cyan-400 transition-all placeholder:text-gray-600"
                  />
                </div>
              </div>

              {/* Notice */}
              <div className="bg-cyan-950/40 border border-cyan-500/20 rounded-lg p-2.5 text-[11px] text-cyan-200/90 leading-relaxed">
                Hệ thống sẽ tự động gán vị trí ghế tương đương, đính kèm Voucher đền bù (nếu có) và gửi Email AI thông báo quyền lợi trực tiếp cho khách hàng.
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 justify-end mt-1">
              <button
                disabled={changeRoomLoading}
                onClick={() => setChangeRoomModal(null)}
                className="px-4 py-2.5 bg-gray-800/60 hover:bg-gray-800 text-gray-300 hover:text-white font-semibold rounded-xl border border-gray-700/60 transition-all text-xs cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                disabled={changeRoomLoading || !selectedTargetRoomId}
                onClick={() => void handleChangeRoomSubmit()}
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-900/30 transition-all text-xs cursor-pointer disabled:opacity-50"
              >
                {changeRoomLoading ? "Đang đổi phòng..." : "Xác nhận đổi phòng"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cập nhật Suất chiếu có Booking (Đền bù & Voucher) */}
      {updateCompModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all duration-300">
          <div className="bg-[#111C44] border border-amber-500/30 rounded-2xl w-full max-w-md p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-modal-scale flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-gray-800/80 pb-4">
              <div className="text-left">
                <h3 className="text-lg font-bold text-white tracking-wide">Cập nhật suất chiếu có vé đã đặt</h3>
                <p className="text-xs text-gray-400 mt-0.5">Phát hiện {updateCompModal.slotsWithBookingsCount} suất chiếu có vé đã được khách đặt bị thay đổi.</p>
              </div>
            </div>

            {/* Movie list info */}
            <div className="bg-[#0F172A] border border-gray-800/80 rounded-xl p-3.5 text-left flex flex-col gap-2">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Phim bị ảnh hưởng:</span>
              <div className="flex flex-wrap gap-1.5">
                {updateCompModal.affectedMovieNames.map((name, i) => (
                  <span key={i} className="text-xs bg-amber-950/60 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg font-semibold">
                    {name}
                  </span>
                ))}
              </div>
            </div>

            {/* Voucher & Compensation Input */}
            <div className="flex flex-col gap-3 text-left">
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                  Cấu hình Đền bù & Voucher cho khách (Tùy chọn)
                </label>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-gray-400">
                  Chọn voucher đền bù:
                </label>
                <select
                  value={updateVoucherCode}
                  onChange={(e) => setUpdateVoucherCode(e.target.value)}
                  className="bg-[#1E293B] text-amber-300 border border-amber-500/30 rounded-xl p-2.5 text-xs font-semibold focus:outline-none focus:border-amber-400 transition-all"
                >
                  <option value="">-- Không áp dụng voucher đền bù --</option>
                  {compensationVouchers.map((voucher) => (
                    <option key={voucher.voucherId} value={voucher.voucherCode}>
                      {getCompensationVoucherLabel(voucher)}
                    </option>
                  ))}
                </select>
                {compensationVouchers.length === 0 && (
                  <span className="text-[10px] font-semibold text-amber-300/80">
                    Chưa có voucher nhóm COMPENSATION đang ACTIVE.
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-gray-400">
                  Ghi chú quyền lợi đền bù (Compensation Note):
                </label>
                <input
                  type="text"
                  placeholder="VD: Tặng 01 Combo Bắp Nước + Voucher giảm 20% cho suất chiếu tới..."
                  value={updateCompNote}
                  onChange={(e) => setUpdateCompNote(e.target.value)}
                  className="bg-[#1E293B] text-white border border-gray-700 rounded-xl p-2.5 text-xs font-medium focus:outline-none focus:border-amber-400 transition-all placeholder:text-gray-600"
                />
              </div>

            </div>

            {/* Notice */}
            <div className="bg-amber-950/30 border border-amber-500/20 rounded-lg p-2.5 text-[11px] text-amber-200/90 leading-relaxed text-left">
              Hệ thống sẽ tự động chuyển các suất chiếu này sang trạng thái chờ xử lý (`ProcessingUnstable`), đính kèm Voucher đền bù và gửi Email AI song ngữ hướng dẫn xác nhận cho khách hàng.
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 justify-end mt-1">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setUpdateCompModal(null)}
                className="px-4 py-2.5 bg-gray-800/60 hover:bg-gray-800 text-gray-300 hover:text-white font-semibold rounded-xl border border-gray-700/60 transition-all text-xs cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void executeSaveChanges(updateVoucherCode, updateCompNote)}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold rounded-xl shadow-lg shadow-amber-900/30 transition-all text-xs cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? "Đang lưu..." : "Xác nhận Lưu & Gửi Mail"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelConfirmShowtimes.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-[#0F172A] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Xác nhận Hủy Suất Chiếu có Khách Đã Đặt</h3>
                <p className="text-xs text-gray-400">Yêu cầu nhập lý do để thông báo & đền bù cho khách hàng</p>
              </div>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              <p className="text-xs font-semibold text-gray-300">
                Phát hiện {cancelConfirmShowtimes.length} suất chiếu có vé đã thanh toán/giữ chỗ sẽ bị hủy:
              </p>
              {cancelConfirmShowtimes.map((st) => (
                <div key={st.id} className="rounded-lg bg-gray-900/60 p-2.5 text-xs text-gray-300 border border-gray-800">
                  <span className="font-bold text-amber-400">{st.movieName}</span> - {st.roomName} ({st.startTimeStr})
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300">
                Lý do hủy suất chiếu <span className="text-red-400">*</span>:
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="VD: Thay đổi lịch bảo trì phòng chiếu, sự cố kỹ thuật rạp..."
                className="w-full h-20 rounded-xl border border-gray-700 bg-gray-900 p-3 text-xs text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-300">
                  Mã voucher bồi thường sự cố (Không bắt buộc):
                </label>
              </div>
              <input
                type="text"
                value={compensationVoucherCode}
                onChange={(e) => setCompensationVoucherCode(e.target.value)}
                placeholder="Ví dụ: COMP-SHOWTIME-2026, VOUCHER-BOITHUONG-50K..."
                className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancelConfirmShowtimes([]);
                  if (savePromiseResolve) {
                    savePromiseResolve(false);
                    setSavePromiseResolve(null);
                  }
                }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl text-xs"
              >
                Hủy thay đổi
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim()}
                onClick={() => {
                  setCancelConfirmShowtimes([]);
                  if (savePromiseResolve) {
                    savePromiseResolve(true);
                    setSavePromiseResolve(null);
                  }
                }}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold rounded-xl text-xs"
              >
                Xác nhận Hủy & Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
