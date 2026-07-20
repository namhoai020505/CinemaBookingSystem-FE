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
} from "../../services/showtimeService";

// =================================================================
// 💡 CẤU HÌNH TIMELINE CHUẨN: 8H ĐẾN 24H (16 TIẾNG)
// =================================================================
const TIMELINE_START_HOUR = 8;
const TIMELINE_END_HOUR = 24;
const TOTAL_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR; // 16 tiếng
const HOUR_WIDTH = 120; // 1 tiếng cố định đúng 120px
const MINUTE_WIDTH = HOUR_WIDTH / 60; // ~2px cho mỗi phút
const DEFAULT_BASE_PRICE = 75000; // Giá vé mặc định 75.000đ

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

  // ---------- State: Bộ lọc ----------
  const [selectedCinemaId, setSelectedCinemaId] = useState("");
  const [selectedDate, setSelectedDate] = useState(formatDateToYMD(new Date()));

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

  // ---------- State: UX Edit Tracking & Batch Save ----------
  const [isDirty, setIsDirty] = useState(false);
  const [deletedShowtimeIds, setDeletedShowtimeIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);

  // ---------- Blocker: Chặn chuyển trang SPA khi chưa lưu lịch chiếu ----------
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
      const confirmed = window.confirm(TEXT.SHOWTIME.CONFIRM_NAVIGATE_AWAY);
      if (confirmed) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
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

  /** Fetch toàn bộ data ban đầu */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([
        fetchCinemas(),
        fetchRooms(),
        fetchMovies(),
        fetchShowtimes(),
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
    const movieName = slot.movieNameVn || "suất chiếu này";
    const room = filteredRooms.find((r) => r.roomId === roomId);
    const roomName = room ? room.roomName : "Phòng chiếu";
    const startShort = getShortTimeFromISO(slot.startTime);
    const endShort = getShortTimeFromISO(slot.endTime);
    const startTimeStr = startShort && endShort ? `${startShort} - ${endShort}` : "N/A";

    setDeleteConfirm({
      roomId,
      slotId,
      movieName,
      roomName,
      startTimeStr,
    });
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

    // Nếu slotId không phải là tempId, ta đưa vào hàng đợi xóa
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

  const handleCancelChanges = () => {
    const confirm = window.confirm(TEXT.SHOWTIME.CONFIRM_CANCEL_CHANGES);
    if (!confirm) return;

    setIsDirty(false);
    setDeletedShowtimeIds(new Set());

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

  const handleSaveChanges = async () => {
    // Chặn lưu khi đang xem ngày quá khứ (BE sẽ từ chối với INVALID_START_TIME)
    if (isPastDate) {
      toast.error(TEXT.SHOWTIME.ERR_PAST_DATE_SAVE);
      return;
    }

    setActionLoading(true);

    try {
      // 1. Thực hiện xóa các suất chiếu nằm trong deletedShowtimeIds
      for (const id of Array.from(deletedShowtimeIds)) {
        await showtimeService.deleteShowtime(id);
      }

      // 2. Thu thập danh sách các slot cần tạo mới và các slot cần cập nhật
      const newSlotsToCreate: ShowtimeSlot[] = [];
      const updatedSlots: { slot: ShowtimeSlot; original: ShowtimeResponse }[] = [];

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

      // Sắp xếp các slot cập nhật theo thứ tự thông minh (Topological Order):
      // - Nếu tăng giờ (newStartTime > oldStartTime), cần cập nhật các suất MUỘN NHẤT trước (descending order).
      // - Nếu lùi giờ (newStartTime < oldStartTime), cần cập nhật các suất SỚM NHẤT trước (ascending order).
      // Việc này tránh xung đột đè giờ với suất liền kề chưa cập nhật trong Database.
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
        // Nếu suất chiếu đang bị SUSPENDED mà Admin sắp xếp lại trên timeline, tự động khôi phục về OPEN
        const targetStatus = slot.status === "SUSPENDED" ? "OPEN" : (slot.status || "OPEN");
        await showtimeService.updateShowtime(slot.id, {
          movieId: slot.movieId,
          roomId: slot.roomId,
          startTime: slot.startTime,
          basePrice: slot.basePrice || DEFAULT_BASE_PRICE,
          status: targetStatus,
        });
        updatedCount++;
      }

      // Thực hiện tạo mới các suất chiếu temp
      for (const slot of newSlotsToCreate) {
        await showtimeService.createShowtime({
          movieId: slot.movieId,
          roomId: slot.roomId,
          startTime: slot.startTime,
          basePrice: slot.basePrice || DEFAULT_BASE_PRICE,
          status: slot.status || "OPEN",
        });
        createdCount++;
      }

      toast.success(
        `💾 Đã lưu lịch chiếu thành công! (Tạo: ${createdCount}, Cập nhật: ${updatedCount}, Xóa: ${deletedShowtimeIds.size})`
      );

      setIsDirty(false);
      setDeletedShowtimeIds(new Set());
      await fetchShowtimes(); // Reload database
    } catch (err: unknown) {

      // Map BE errorCode → thông báo tiếng Việt rõ ràng
      const ERROR_MESSAGES: Record<string, string> = TEXT.SHOWTIME.BE_ERRORS;

      let errorMsg = TEXT.SHOWTIME.ERR_GENERIC_SAVE;
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { data?: { message?: string; errorCode?: string } } };
        const beMessage = axiosErr.response?.data?.message;
        const beCode = axiosErr.response?.data?.errorCode ?? "";
        const mapped = ERROR_MESSAGES[beCode];
        errorMsg = beMessage ?? mapped ?? errorMsg;
      }
      toast.error(errorMsg, { autoClose: 7000 });

      // Nạp lại dữ liệu cũ để tránh hiển thị sai lệch
      setIsDirty(false);
      setDeletedShowtimeIds(new Set());
      await fetchShowtimes();
    } finally {
      setActionLoading(false);
    }
  };

  // =================================================================
  // 💡 EVENT HANDLERS CHO BỘ LỌC
  // =================================================================

  const handleCinemaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextVal = e.target.value;
    if (isDirty) {
      const confirm = window.confirm(TEXT.SHOWTIME.CONFIRM_CHANGE_CINEMA);
      if (!confirm) return;
    }
    setSelectedCinemaId(nextVal);
    setIsDirty(false);
    setDeletedShowtimeIds(new Set());
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    if (isDirty) {
      const confirm = window.confirm(TEXT.SHOWTIME.CONFIRM_CHANGE_DATE);
      if (!confirm) return;
    }
    setSelectedDate(nextVal);
    setIsDirty(false);
    setDeletedShowtimeIds(new Set());
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
      <div className="flex gap-4 mb-6 bg-[#111C44] p-4 rounded-xl border border-gray-800 shadow-xl flex-wrap">
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
        {isPastDate && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-lg text-amber-400 text-xs font-semibold">
            <span>⚠️</span>
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
                                <div className="text-xs font-bold truncate text-white max-w-[82%]">
                                  {slot.movieNameVn}
                                </div>
                                {/* Ẩn nút xóa khi xem ngày quá khứ */}
                                {!isPastDate && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); void handleDeleteShowtime(room.roomId, slot.id); }}
                                    className="text-white/60 hover:text-white bg-black/40 hover:bg-red-600 w-4 h-4 rounded-full flex items-center justify-center text-[10px] transition-all shrink-0 z-50 shadow-md"
                                  >
                                    &times;
                                  </button>
                                )}
                              </div>
                              <div className="text-[9px] text-white/90 font-medium tracking-wide">
                                {startShort && endShort ? `🕒 ${startShort} - ${endShort}` : "N/A"}
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
                    <span>⏱️ {movie.duration} {TEXT.SHOWTIME.MINUTES} ({movie.ageRating})</span>
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
                  <span className="text-yellow-400 text-xs font-semibold">🕒 {deleteConfirm.startTimeStr}</span>
                </div>
              </div>
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
    </div>
  );
}
