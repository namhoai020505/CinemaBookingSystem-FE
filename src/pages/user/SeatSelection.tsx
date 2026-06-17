import { useCallback, useEffect, useMemo, useState } from "react";
import { FaChair, FaCouch } from "react-icons/fa";
import { FiCalendar, FiClock, FiFilm, FiMapPin, FiTag } from "react-icons/fi";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../../lib/api";
import {
  clearAuthSession,
  getAccessToken,
  getCurrentUserProfile,
} from "../../lib/auth";

const MAX_SEATS_ALLOWED = 6;
const DEFAULT_LOCK_SECONDS = 600;
const FALLBACK_POSTER =
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop";
const API_ORIGIN = String(api.defaults.baseURL || "").replace(/\/$/, "");

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T | null;
};

const getHttpStatus = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "response" in error &&
  typeof error.response === "object" &&
  error.response !== null &&
  "status" in error.response &&
  typeof error.response.status === "number"
    ? error.response.status
    : undefined;

type RouteState = {
  movie?: {
    movieId?: string;
    title?: string;
    genre?: string;
    duration?: string;
    durationMinutes?: number;
    posterUrl?: string;
    ageRating?: string;
  };
  showtime?: {
    roomName?: string;
    cinemaName?: string;
    startTime?: string;
  };
};

type SeatMapItemResponse = {
  showtimeSeatId: string;
  seatId: string;
  rowLabel: string;
  seatNumber: number;
  seatCode: string;
  seatTypeId: string;
  price?: number;
  seatStatus: string;
  lockedUntil?: string | null;
};

type SeatMapResponse = {
  showtimeId: string;
  movieName?: string | null;
  roomName?: string | null;
  availableSeats?: SeatMapItemResponse[];
  lockedSeats?: SeatMapItemResponse[];
  soldSeats?: SeatMapItemResponse[];
};

type ShowtimeDetailResponse = {
  showtimeId: string;
  movieId: string;
  movieTitle: string;
  roomName: string;
  cinemaName: string;
  startTime: string;
};

type MovieDetailResponse = {
  movieId: string;
  title: string;
  durationMinutes?: number;
  genre?: string | null;
  ageRating?: string | null;
  posterUrl?: string | null;
};

type ShowtimeDisplayDetails = {
  movieId?: string;
  title?: string;
  genre?: string;
  duration?: string;
  posterUrl?: string;
  ageRating?: string;
  roomName?: string;
  cinemaName?: string;
  startTime?: string;
};

type LockSeatResponse = {
  showtimeSeatId: string;
  showtimeId: string;
  seatId: string;
  seatStatus: string;
  lockedUntil: string;
};

type SeatStatus = "AVAILABLE" | "BOOKED" | "HOLDING" | "LOCKED_BY_ME";
type SeatType = "NORMAL" | "VIP" | "SWEETBOX";

type SeatItem = {
  seatId: string;
  showtimeSeatId: string;
  row: string;
  column: number;
  seatCode: string;
  status: SeatStatus;
  type: SeatType;
  price: number;
  lockedUntil?: string | null;
};

type SeatMapState = {
  showtimeId: string;
  movieName: string;
  roomName: string;
  cinemaName?: string;
  startTime?: string;
  seats: SeatItem[];
};

type StoredLockedSeat = {
  seatId: string;
  showtimeSeatId: string;
  row: string;
  column: number;
  seatCode: string;
  type: SeatType;
  price: number;
  lockedUntil: string;
};

type SeatLockSession = {
  showtimeId: string;
  userKey: string;
  lockedSeats: Record<string, StoredLockedSeat>;
  selectedSeatIds: string[];
  updatedAt: string;
};

const parseLockTime = (value?: string | null) => {
  if (!value) {
    return 0;
  }

  const normalized = /(?:z|[+-]\d{2}:\d{2})$/i.test(value)
    ? value
    : `${value}Z`;
  const timestamp = Date.parse(normalized);

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const isActiveLock = (lockedUntil?: string | null) =>
  parseLockTime(lockedUntil) > Date.now();

const getSeatType = (seatTypeId: string): SeatType => {
  if (seatTypeId === "ST02" || seatTypeId === "SEAT_TYPE_VIP") {
    return "VIP";
  }

  if (seatTypeId === "ST03" || seatTypeId === "SEAT_TYPE_SWEETBOX") {
    return "SWEETBOX";
  }

  return "NORMAL";
};

const getSeatPrice = (type: SeatType) => {
  if (type === "VIP") {
    return 100000;
  }

  if (type === "SWEETBOX") {
    return 180000;
  }

  return 80000;
};

const getStorageKey = (showtimeId: string, userKey: string) =>
  `g2c-seat-locks:${userKey}:${showtimeId}`;

const getUserKey = () => {
  const profile = getCurrentUserProfile();
  return profile?.userId || profile?.email || "anonymous";
};

const readLockSession = (
  showtimeId: string,
  userKey: string,
): SeatLockSession | null => {
  const storageKey = getStorageKey(showtimeId, userKey);
  const rawValue = localStorage.getItem(storageKey);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as SeatLockSession;
    const activeLockedSeats = Object.fromEntries(
      Object.entries(parsed.lockedSeats || {}).filter(([, seat]) =>
        isActiveLock(seat.lockedUntil),
      ),
    );
    const activeSeatIds = new Set(Object.keys(activeLockedSeats));
    const selectedSeatIds = (parsed.selectedSeatIds || []).filter((seatId) =>
      activeSeatIds.has(seatId),
    );

    if (Object.keys(activeLockedSeats).length === 0) {
      localStorage.removeItem(storageKey);
      return null;
    }

    const nextSession: SeatLockSession = {
      showtimeId,
      userKey,
      lockedSeats: activeLockedSeats,
      selectedSeatIds,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };

    localStorage.setItem(storageKey, JSON.stringify(nextSession));
    return nextSession;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
};

const writeLockSession = (session: SeatLockSession) => {
  localStorage.setItem(
    getStorageKey(session.showtimeId, session.userKey),
    JSON.stringify({
      ...session,
      updatedAt: new Date().toISOString(),
    }),
  );
};

const removeLockSession = (showtimeId: string, userKey: string) => {
  localStorage.removeItem(getStorageKey(showtimeId, userKey));
};

const getSessionRemainingSeconds = (session: SeatLockSession | null) => {
  if (!session) {
    return DEFAULT_LOCK_SECONDS;
  }

  const selectedLocks = session.selectedSeatIds
    .map((seatId) => session.lockedSeats[seatId]?.lockedUntil)
    .filter(Boolean) as string[];
  const relevantLocks =
    selectedLocks.length > 0
      ? selectedLocks
      : Object.values(session.lockedSeats).map((seat) => seat.lockedUntil);
  const earliestExpiry = relevantLocks
    .map(parseLockTime)
    .filter((timestamp) => timestamp > Date.now())
    .sort((left, right) => left - right)[0];

  if (!earliestExpiry) {
    return DEFAULT_LOCK_SECONDS;
  }

  return Math.max(0, Math.ceil((earliestExpiry - Date.now()) / 1000));
};

const toStoredLockedSeat = (
  seat: SeatItem,
  lockedUntil: string,
): StoredLockedSeat => ({
  seatId: seat.seatId,
  showtimeSeatId: seat.showtimeSeatId,
  row: seat.row,
  column: seat.column,
  seatCode: seat.seatCode,
  type: seat.type,
  price: seat.price,
  lockedUntil,
});

const sortSeatRows = (rows: string[]) =>
  [...rows].sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true }),
  );

const buildSeatRowTypeMap = (rows: string[]): Record<string, SeatType> => {
  const orderedRows = sortSeatRows(rows);
  const lastRowIndex = orderedRows.length - 1;
  const frontNormalRowCount =
    orderedRows.length >= 7
      ? 3
      : Math.min(2, Math.max(1, orderedRows.length - 2));

  return orderedRows.reduce<Record<string, SeatType>>((types, row, index) => {
    if (index === lastRowIndex) {
      types[row] = "SWEETBOX";
      return types;
    }

    types[row] = index < frontNormalRowCount ? "NORMAL" : "VIP";
    return types;
  }, {});
};

const mapSeat = (
  item: SeatMapItemResponse,
  status: SeatStatus,
  ownedLocks: Record<string, StoredLockedSeat>,
  rowTypeMap: Record<string, SeatType>,
): SeatItem => {
  const backendType = getSeatType(item.seatTypeId);
  const type = rowTypeMap[item.rowLabel] || backendType;
  const ownedLock = ownedLocks[item.seatId];
  const isLockedByMe =
    status === "HOLDING" && ownedLock && isActiveLock(ownedLock.lockedUntil);

  return {
    seatId: item.seatId,
    showtimeSeatId: item.showtimeSeatId,
    row: item.rowLabel,
    column: item.seatNumber,
    seatCode: item.seatCode,
    status: isLockedByMe ? "LOCKED_BY_ME" : status,
    type,
    price: item.price ?? getSeatPrice(type),
    lockedUntil: isLockedByMe ? ownedLock.lockedUntil : item.lockedUntil,
  };
};

const formatTimer = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

const isSelectableSeat = (seat: SeatItem) =>
  seat.status === "AVAILABLE" || seat.status === "LOCKED_BY_ME";

const formatCompactPrice = (value?: number | null) => {
  if (!value) {
    return "";
  }

  return ` (${Math.round(value / 1000)}k)`;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value) + "đ";

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "Đang cập nhật";
  }

  const [datePart, timePart = ""] = value.includes("T")
    ? value.split("T")
    : value.split(" ");
  const [year, month, date] = datePart.split("-");
  const shortTime = timePart.substring(0, 5);

  if (year && month && date && shortTime) {
    return `${shortTime} ${date}/${month}/${year}`;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp)
    ? "Đang cập nhật"
    : new Date(timestamp).toLocaleString("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      });
};

const resolvePosterUrl = (value?: string | null) => {
  const posterUrl = value?.trim();
  if (!posterUrl) {
    return "";
  }

  if (/^(https?:|data:|blob:)/i.test(posterUrl)) {
    return posterUrl;
  }

  if (posterUrl.startsWith("/")) {
    return `${API_ORIGIN}${posterUrl}`;
  }

  return `${API_ORIGIN}/${posterUrl.replace(/^\.?\//, "")}`;
};

const getSeatTypeLabel = (type: SeatType) => {
  if (type === "VIP") {
    return "Ghế VIP";
  }

  if (type === "SWEETBOX") {
    return "Ghế đôi";
  }

  return "Ghế thường";
};

const getSeatDisplayName = (seat: SeatItem) =>
  seat.seatCode || `${seat.row}${seat.column}`;

export default function SeatSelection() {
  const { showtimeId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as RouteState | null;
  const routeMovieTitle = routeState?.movie?.title;
  const routeMovieGenre = routeState?.movie?.genre;
  const routeMovieDuration =
    routeState?.movie?.duration ||
    (routeState?.movie?.durationMinutes
      ? `${routeState.movie.durationMinutes} phút`
      : "");
  const routeMoviePoster = routeState?.movie?.posterUrl;
  const routeMovieAgeRating = routeState?.movie?.ageRating;
  const routeRoomName = routeState?.showtime?.roomName;
  const routeCinemaName = routeState?.showtime?.cinemaName;
  const routeStartTime = routeState?.showtime?.startTime;
  const [userKey] = useState(() => getUserKey());

  const [seatMap, setSeatMap] = useState<SeatMapState | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<SeatItem[]>([]);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_LOCK_SECONDS);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [unlockingSeatId, setUnlockingSeatId] = useState<string | null>(null);
  const [displayDetails, setDisplayDetails] =
    useState<ShowtimeDisplayDetails | null>(null);

  const persistSelectedLockedSeats = useCallback(
    (nextSelectedSeats: SeatItem[]) => {
      const session = readLockSession(showtimeId, userKey);
      if (!session) {
        return;
      }

      const selectedSeatIds = nextSelectedSeats
        .filter((seat) => Boolean(session.lockedSeats[seat.seatId]))
        .map((seat) => seat.seatId);

      writeLockSession({
        ...session,
        selectedSeatIds,
      });
      setTimeLeft(getSessionRemainingSeconds({ ...session, selectedSeatIds }));
    },
    [showtimeId, userKey],
  );

  useEffect(() => {
    let isMounted = true;

    const fetchDisplayDetails = async () => {
      if (!showtimeId) {
        setDisplayDetails(null);
        return;
      }

      try {
        const showtimeResponse = (await api.get(
          `/api/showtimes/${showtimeId}`,
        )) as unknown as ApiResponse<ShowtimeDetailResponse>;

        if (!isMounted) {
          return;
        }

        if (!showtimeResponse.success || !showtimeResponse.data) {
          throw new Error(showtimeResponse.message || "Showtime not found.");
        }

        const showtime = showtimeResponse.data;
        let movie: MovieDetailResponse | null = null;

        if (showtime.movieId) {
          try {
            const movieResponse = (await api.get(
              `/api/movies/${showtime.movieId}`,
            )) as unknown as ApiResponse<MovieDetailResponse>;

            if (movieResponse.success && movieResponse.data) {
              movie = movieResponse.data;
            }
          } catch (error) {
            console.warn("Khong tai duoc thong tin phim cho suat chieu:", error);
          }
        }

        if (!isMounted) {
          return;
        }

        setDisplayDetails({
          movieId: showtime.movieId,
          title: movie?.title || showtime.movieTitle,
          genre: movie?.genre || undefined,
          duration: movie?.durationMinutes
            ? `${movie.durationMinutes} phút`
            : undefined,
          posterUrl: resolvePosterUrl(movie?.posterUrl),
          ageRating: movie?.ageRating || undefined,
          roomName: showtime.roomName,
          cinemaName: showtime.cinemaName,
          startTime: showtime.startTime,
        });
      } catch (error) {
        console.warn("Khong tai duoc thong tin suat chieu:", error);
        if (isMounted) {
          setDisplayDetails(null);
        }
      }
    };

    void fetchDisplayDetails();

    return () => {
      isMounted = false;
    };
  }, [showtimeId]);

  const refreshSeatMap = useCallback(async () => {
    if (!showtimeId) {
      return;
    }

    const token = getAccessToken();
    if (!token) {
      clearAuthSession();
      navigate("/login", { replace: true, state: { from: location.pathname } });
      return;
    }

    try {
      setLoading(true);
      const lockSession = readLockSession(showtimeId, userKey);
      const ownedLocks = lockSession?.lockedSeats || {};
      const response = (await api.get(
        `/api/seats/showtimes/${showtimeId}/map`,
      )) as unknown as ApiResponse<SeatMapResponse>;

      if (!response.success || !response.data) {
        throw new Error(response.message || "Không tải được sơ đồ ghế.");
      }

      const rawData = response.data;
      const availableSeats = rawData.availableSeats || [];
      const lockedSeats = rawData.lockedSeats || [];
      const soldSeats = rawData.soldSeats || [];
      const allSeats = [...availableSeats, ...lockedSeats, ...soldSeats];
      const rowTypeMap = buildSeatRowTypeMap(
        Array.from(new Set(allSeats.map((seat) => seat.rowLabel))),
      );
      const mappedSeats = [
        ...availableSeats.map((seat) =>
          mapSeat(seat, "AVAILABLE", ownedLocks, rowTypeMap),
        ),
        ...lockedSeats.map((seat) =>
          mapSeat(seat, "HOLDING", ownedLocks, rowTypeMap),
        ),
        ...soldSeats.map((seat) =>
          mapSeat(seat, "BOOKED", ownedLocks, rowTypeMap),
        ),
      ];
      const ownedVisibleSeatIds = new Set(
        mappedSeats
          .filter((seat) => seat.status === "LOCKED_BY_ME")
          .map((seat) => seat.seatId),
      );

      if (lockSession) {
        const nextLockedSeats = Object.fromEntries(
          Object.entries(lockSession.lockedSeats).filter(([seatId]) =>
            ownedVisibleSeatIds.has(seatId),
          ),
        );
        const nextSelectedSeatIds = lockSession.selectedSeatIds.filter((seatId) =>
          ownedVisibleSeatIds.has(seatId),
        );

        if (Object.keys(nextLockedSeats).length > 0) {
          writeLockSession({
            ...lockSession,
            lockedSeats: nextLockedSeats,
            selectedSeatIds: nextSelectedSeatIds,
          });
          setTimeLeft(
            getSessionRemainingSeconds({
              ...lockSession,
              lockedSeats: nextLockedSeats,
              selectedSeatIds: nextSelectedSeatIds,
            }),
          );
        } else {
          removeLockSession(showtimeId, userKey);
          setTimeLeft(DEFAULT_LOCK_SECONDS);
        }

        setSelectedSeats(
          mappedSeats.filter((seat) => nextSelectedSeatIds.includes(seat.seatId)),
        );
      } else {
        setSelectedSeats([]);
        setTimeLeft(DEFAULT_LOCK_SECONDS);
      }

      setSeatMap({
        showtimeId: rawData.showtimeId,
        movieName: rawData.movieName || routeMovieTitle || "Đang cập nhật...",
        roomName: rawData.roomName || routeRoomName || "Phòng chiếu",
        cinemaName: routeCinemaName,
        startTime: routeStartTime,
        seats: mappedSeats,
      });
    } catch (error) {
      if (getHttpStatus(error) === 401) {
        clearAuthSession();
        navigate("/login", { replace: true, state: { from: location.pathname } });
        return;
      }

      console.error("Lỗi kết nối API sơ đồ ghế:", error);
      setSeatMap(null);
    } finally {
      setLoading(false);
    }
  }, [
    routeCinemaName,
    routeMovieTitle,
    routeRoomName,
    routeStartTime,
    showtimeId,
    userKey,
    navigate,
    location.pathname,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshSeatMap();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refreshSeatMap]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const session = readLockSession(showtimeId, userKey);
      const nextTimeLeft = getSessionRemainingSeconds(session);
      setTimeLeft(nextTimeLeft);

      if (!session) {
        setSelectedSeats((current) => {
          const hadOwnedLock = current.some((seat) => seat.status === "LOCKED_BY_ME");
          if (hadOwnedLock) {
            window.setTimeout(() => {
              void refreshSeatMap();
            }, 0);
          }

          return current.filter((seat) => seat.status !== "LOCKED_BY_ME");
        });
        setSeatMap((current) =>
          current
            ? {
                ...current,
                seats: current.seats.map((seat) =>
                  seat.status === "LOCKED_BY_ME"
                    ? { ...seat, status: "AVAILABLE", lockedUntil: null }
                    : seat,
                ),
              }
            : current,
        );
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [refreshSeatMap, showtimeId, userKey]);

  const validateSeatGaps = (currentSelection: SeatItem[]) => {
    if (!seatMap) {
      return true;
    }

    const rows = Array.from(new Set(currentSelection.map((seat) => seat.row)));

    for (const row of rows) {
      const allSeatsInRow = seatMap.seats
        .filter((seat) => seat.row === row)
        .sort((left, right) => left.column - right.column);
      const selectedCols = currentSelection
        .filter((seat) => seat.row === row)
        .map((seat) => seat.column);

      for (const seat of allSeatsInRow) {
        if (!isSelectableSeat(seat) || selectedCols.includes(seat.column)) {
          continue;
        }

        const leftSeat = allSeatsInRow.find(
          (item) => item.column === seat.column - 1,
        );
        const rightSeat = allSeatsInRow.find(
          (item) => item.column === seat.column + 1,
        );
        const isBlocked = (item: SeatItem | undefined, column: number) =>
          Boolean(
            item &&
              (item.status === "BOOKED" ||
                item.status === "HOLDING" ||
                selectedCols.includes(column)),
          );

        if (
          leftSeat &&
          rightSeat &&
          isBlocked(leftSeat, seat.column - 1) &&
          isBlocked(rightSeat, seat.column + 1)
        ) {
          const bothWereAlreadyBooked =
            (leftSeat.status === "BOOKED" || leftSeat.status === "HOLDING") &&
            (rightSeat.status === "BOOKED" || rightSeat.status === "HOLDING");

          if (!bothWereAlreadyBooked) {
            return false;
          }
        }
      }
    }

    return true;
  };

  const releaseLockedSeat = async (seat: SeatItem) => {
    setUnlockingSeatId(seat.seatId);

    try {
      const response = (await api.post("/api/seats/unlock", {
        showtimeId,
        seatId: seat.seatId,
      })) as unknown as ApiResponse<unknown>;

      if (!response.success) {
        throw new Error(response.message || "Không thể bỏ giữ ghế.");
      }

      const currentSession = readLockSession(showtimeId, userKey);
      if (currentSession) {
        const nextLockedSeats = { ...currentSession.lockedSeats };
        delete nextLockedSeats[seat.seatId];

        const nextSelectedSeatIds = currentSession.selectedSeatIds.filter(
          (seatId) => seatId !== seat.seatId,
        );

        if (Object.keys(nextLockedSeats).length === 0) {
          removeLockSession(showtimeId, userKey);
          setTimeLeft(DEFAULT_LOCK_SECONDS);
        } else {
          const nextSession = {
            ...currentSession,
            lockedSeats: nextLockedSeats,
            selectedSeatIds: nextSelectedSeatIds,
          };
          writeLockSession(nextSession);
          setTimeLeft(getSessionRemainingSeconds(nextSession));
        }
      }

      setSelectedSeats((current) =>
        current.filter((item) => item.seatId !== seat.seatId),
      );
      setSeatMap((current) =>
        current
          ? {
              ...current,
              seats: current.seats.map((item) =>
                item.seatId === seat.seatId
                  ? { ...item, status: "AVAILABLE", lockedUntil: null }
                  : item,
              ),
            }
          : current,
      );
    } catch (error) {
      console.error("Lỗi bỏ giữ ghế:", error);
      alert("Không thể bỏ giữ ghế này. Vui lòng tải lại sơ đồ ghế và thử lại.");
      await refreshSeatMap();
    } finally {
      setUnlockingSeatId(null);
    }
  };

  const handleSelectSeat = async (seat: SeatItem) => {
    if (unlockingSeatId || !isSelectableSeat(seat)) {
      return;
    }

    const exists = selectedSeats.some((item) => item.seatId === seat.seatId);

    if (exists && seat.status === "LOCKED_BY_ME") {
      await releaseLockedSeat(seat);
      return;
    }

    const nextSelectedSeats = exists
      ? selectedSeats.filter((item) => item.seatId !== seat.seatId)
      : [...selectedSeats, seat];

    if (!exists && selectedSeats.length >= MAX_SEATS_ALLOWED) {
      alert(`Hệ thống chỉ cho phép chọn tối đa ${MAX_SEATS_ALLOWED} ghế trong một giao dịch!`);
      return;
    }

    setSelectedSeats(nextSelectedSeats);
    persistSelectedLockedSeats(nextSelectedSeats);
  };

  const totalAmount = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
  const selectedSeatCodes = selectedSeats.map(getSeatDisplayName);

  const handleProceed = async () => {
    if (selectedSeats.length === 0) {
      alert("Vui lòng chọn ít nhất một ghế.");
      return;
    }

    if (!validateSeatGaps(selectedSeats)) {
      alert("Không thể đặt ghế vì thao tác đang để lại một ghế trống duy nhất kẹt ở giữa. Vui lòng chọn các ghế nằm sát nhau.");
      return;
    }

    try {
      setSubmitting(true);
      const currentSession = readLockSession(showtimeId, userKey);
      const lockedSeatsByMe = currentSession?.lockedSeats || {};
      const seatsToLock = selectedSeats.filter(
        (seat) => !lockedSeatsByMe[seat.seatId],
      );

      const lockResponses = await Promise.all(
        seatsToLock.map(async (seat) => {
          const response = (await api.post("/api/seats/lock", {
            showtimeId,
            seatId: seat.seatId,
          })) as unknown as ApiResponse<LockSeatResponse>;

          return { seat, response };
        }),
      );

      const failedResponse = lockResponses.find(({ response }) => !response.success);
      if (failedResponse) {
        alert(failedResponse.response.message || "Một trong số các ghế bạn chọn vừa có người giữ trước. Vui lòng tải lại trang.");
        await refreshSeatMap();
        return;
      }

      const nextLockedSeats: Record<string, StoredLockedSeat> = {
        ...lockedSeatsByMe,
      };

      lockResponses.forEach(({ seat, response }) => {
        if (!response.data?.lockedUntil) {
          return;
        }

        nextLockedSeats[seat.seatId] = toStoredLockedSeat(
          {
            ...seat,
            showtimeSeatId: response.data.showtimeSeatId || seat.showtimeSeatId,
            status: "LOCKED_BY_ME",
          },
          response.data.lockedUntil,
        );
      });

      selectedSeats.forEach((seat) => {
        const existingLock = lockedSeatsByMe[seat.seatId];
        if (existingLock && isActiveLock(existingLock.lockedUntil)) {
          nextLockedSeats[seat.seatId] = existingLock;
        }
      });

      const selectedSeatIds = selectedSeats.map((seat) => seat.seatId);
      const nextSession: SeatLockSession = {
        showtimeId,
        userKey,
        lockedSeats: nextLockedSeats,
        selectedSeatIds,
        updatedAt: new Date().toISOString(),
      };
      writeLockSession(nextSession);
      setTimeLeft(getSessionRemainingSeconds(nextSession));

      const nextSelectedSeats = selectedSeats.map((seat) => ({
        ...seat,
        status: "LOCKED_BY_ME" as SeatStatus,
        showtimeSeatId:
          nextLockedSeats[seat.seatId]?.showtimeSeatId || seat.showtimeSeatId,
        lockedUntil: nextLockedSeats[seat.seatId]?.lockedUntil || seat.lockedUntil,
      }));

      setSelectedSeats(nextSelectedSeats);
      navigate(`/booking/checkout/${showtimeId}`, {
        state: {
          selectedSeats: nextSelectedSeats,
          totalAmount,
          seatMap,
        },
      });
    } catch (error) {
      console.error("Lỗi khi gọi API khóa giữ ghế:", error);
      alert("Không thể kết nối hệ thống giữ ghế. Vui lòng thử lại!");
    } finally {
      setSubmitting(false);
    }
  };

  const seatTypePrices = useMemo(() => {
    const prices: Partial<Record<SeatType, number>> = {};

    seatMap?.seats.forEach((seat) => {
      prices[seat.type] =
        prices[seat.type] === undefined
          ? seat.price
          : Math.min(prices[seat.type]!, seat.price);
    });

    return prices;
  }, [seatMap]);

  const rowsStructure = seatMap
    ? sortSeatRows(Array.from(new Set(seatMap.seats.map((seat) => seat.row))))
    : [];
  const displayMovieTitle =
    routeMovieTitle ||
    displayDetails?.title ||
    seatMap?.movieName ||
    "Đang cập nhật...";
  const displayMovieGenre =
    routeMovieGenre || displayDetails?.genre || "Đang cập nhật";
  const displayMovieDuration =
    routeMovieDuration || displayDetails?.duration || "Đang cập nhật";
  const displayPosterUrl =
    resolvePosterUrl(routeMoviePoster) ||
    displayDetails?.posterUrl ||
    FALLBACK_POSTER;
  const displayMovieAgeRating =
    routeMovieAgeRating || displayDetails?.ageRating || "P";
  const displayRoomName =
    seatMap?.roomName || routeRoomName || displayDetails?.roomName || "Phòng chiếu";
  const displayCinemaName =
    seatMap?.cinemaName || routeCinemaName || displayDetails?.cinemaName || "G2Cinema";
  const displayStartTime =
    seatMap?.startTime || routeStartTime || displayDetails?.startTime;

  const getSeatStyles = (seat: SeatItem) => {
    const isChoosing = selectedSeats.some((item) => item.seatId === seat.seatId);

    if (seat.status === "BOOKED") {
      return "border-red-400 bg-red-600 text-white opacity-90 cursor-not-allowed";
    }

    if (isChoosing) {
      return "border-sky-200 bg-sky-500 text-white shadow-[0_0_16px_rgba(14,165,233,0.5)] scale-110";
    }

    if (seat.status === "LOCKED_BY_ME") {
      return "border-cyan-300 bg-cyan-600 text-white hover:bg-cyan-500";
    }

    if (seat.status === "HOLDING") {
      return "border-yellow-200 bg-yellow-300 text-slate-950 cursor-not-allowed";
    }

    switch (seat.type) {
      case "VIP":
        return "border-slate-300 bg-slate-100/15 text-slate-100 hover:border-sky-300 hover:bg-sky-500 hover:text-white";
      case "SWEETBOX":
        return "border-slate-300 bg-slate-100/15 text-slate-100 hover:border-sky-300 hover:bg-sky-500 hover:text-white";
      default:
        return "border-slate-300 bg-slate-100/10 text-slate-100 hover:bg-slate-100 hover:text-slate-900";
    }
  };

  const renderSeatIcon = (seat: SeatItem) => {
    if (seat.type === "SWEETBOX") {
      return <FaCouch className="h-5 w-10 sm:h-6 sm:w-12" />;
    }

    if (seat.type === "VIP") {
      return <FaCouch className="h-5 w-5 sm:h-6 sm:w-6" />;
    }

    return <FaChair className="h-4 w-4 sm:h-5 sm:w-5" />;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#182437] text-white">
        <p className="animate-pulse text-sm font-bold text-[#FFD166]">
          Đang kết nối API và đồng bộ sơ đồ phòng chiếu...
        </p>
      </div>
    );
  }

  if (!seatMap) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#182437] font-bold text-white">
        <p className="text-sm text-rose-400">
          Không thể khởi tạo sơ đồ phòng chiếu từ hệ thống.
        </p>
      </div>
    );
  }

  return (
    <div className="-m-4 min-h-screen bg-[#182437] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1660px]">
        <div className="mb-6 flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold text-[#FFD166]">
              Trang chủ &gt; Đặt vé &gt; {displayMovieTitle}
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-wide">
              Chọn ghế
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              {displayCinemaName} | {displayRoomName} | Mã suất:{" "}
              {seatMap.showtimeId}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-[11px] font-bold text-slate-300">
            <div className="flex items-center gap-2">
              <FaChair className="h-4 w-4 text-slate-200" />
              Ghế trống
            </div>
            <div className="flex items-center gap-2">
              <FaChair className="h-4 w-4 rounded-sm bg-sky-500 p-0.5 text-white" />
              Ghế đang chọn
            </div>
            <div className="flex items-center gap-2">
              <FaChair className="h-4 w-4 rounded-sm bg-cyan-600 p-0.5 text-white" />
              Ghế đang giữ
            </div>
            <div className="flex items-center gap-2">
              <FaChair className="h-4 w-4 rounded-sm bg-red-600 p-0.5 text-white" />
              Ghế đã bán
            </div>
            <div className="flex items-center gap-2">
              <FaChair className="h-4 w-4 rounded-sm bg-yellow-300 p-0.5 text-slate-950" />
              Ghế đặt trước
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0">
            <div className="py-2">
              <div className="mx-auto mb-8 max-w-[1180px] px-6">
                <div className="h-10 rounded-t-[100%] border-t-4 border-sky-300/90 bg-gradient-to-b from-sky-300/15 to-transparent shadow-[0_-10px_24px_rgba(56,189,248,0.22)]" />
                <p className="-mt-1 text-center text-xs font-bold uppercase tracking-[0.28em] text-slate-400">
                  Màn hình chiếu
                </p>
              </div>

              <div className="overflow-x-auto pb-3 lg:overflow-visible">
                <div className="mx-auto flex min-w-max flex-col items-center gap-2 lg:min-w-0">
                  {rowsStructure.map((row) => {
                    const seatsInRow = seatMap.seats
                      .filter((seat) => seat.row === row)
                      .sort((left, right) => left.column - right.column);

                    return (
                      <div key={row} className="flex items-center justify-center gap-3">
                        <div className="w-6 text-center text-xs font-black text-slate-500">
                          {row}
                        </div>
                        <div className="flex items-center justify-center gap-1.5 xl:gap-2">
                          {seatsInRow.map((seat) => {
                            const disabled =
                              unlockingSeatId === seat.seatId || !isSelectableSeat(seat);

                            return (
                              <button
                                type="button"
                                key={seat.seatId}
                                disabled={disabled}
                                title={`${getSeatDisplayName(seat)} - ${getSeatTypeLabel(
                                  seat.type,
                                )} - ${formatCurrency(seat.price)}`}
                                onClick={() => {
                                  void handleSelectSeat(seat);
                                }}
                                className={`group relative flex h-8 shrink-0 items-center justify-center rounded-md border transition-all sm:h-9 ${
                                  seat.type === "SWEETBOX"
                                    ? "w-14 sm:w-16 xl:w-[70px]"
                                    : "w-8 sm:w-9"
                                } ${getSeatStyles(seat)}`}
                              >
                                {renderSeatIcon(seat)}
                                <span className="pointer-events-none absolute -bottom-5 left-1/2 hidden -translate-x-1/2 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-bold text-white group-hover:block">
                                  {getSeatDisplayName(seat)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="w-6 text-center text-xs font-black text-slate-500">
                          {row}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-[#0D1637] p-5 shadow-xl md:grid-cols-[minmax(0,1fr)_150px_150px_170px]">
              <div>
                <div className="mb-4 flex flex-wrap gap-5 text-[11px] font-bold text-slate-300">
                  <span className="flex items-center gap-2">
                    <FaChair className="h-4 w-4 text-slate-200" />
                    Ghế thường{formatCompactPrice(seatTypePrices.NORMAL)}
                  </span>
                  <span className="flex items-center gap-2">
                    <FaCouch className="h-4 w-4 text-slate-200" />
                    Ghế VIP{formatCompactPrice(seatTypePrices.VIP)}
                  </span>
                  <span className="flex items-center gap-2">
                    <FaCouch className="h-4 w-8 text-slate-200" />
                    Ghế đôi{formatCompactPrice(seatTypePrices.SWEETBOX)}
                  </span>
                </div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Ghế đã chọn (tối đa {MAX_SEATS_ALLOWED} vé)
                </p>
                <div className="mt-2 flex min-h-8 flex-wrap gap-2">
                  {selectedSeatCodes.length === 0 ? (
                    <span className="text-sm italic text-slate-500">
                      Vui lòng chọn vị trí ngồi...
                    </span>
                  ) : (
                    selectedSeatCodes.map((seatCode) => (
                      <span
                        key={seatCode}
                        className="rounded-md border border-sky-300/70 bg-sky-500/15 px-3 py-1 text-xs font-black text-sky-100"
                      >
                        {seatCode}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t border-white/10 pt-3 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Tổng tiền
                </p>
                <p className="mt-2 text-lg font-black text-[#FFD166]">
                  {formatCurrency(totalAmount)}
                </p>
              </div>

              <div className="border-t border-white/10 pt-3 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Thời gian còn lại
                </p>
                <p className="mt-1 font-mono text-3xl font-black text-[#FFD166]">
                  {formatTimer(timeLeft)}
                </p>
              </div>

              <button
                type="button"
                disabled={selectedSeats.length === 0 || submitting}
                onClick={handleProceed}
                className={`h-12 self-center rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all ${
                  selectedSeats.length > 0 && !submitting
                    ? "bg-[#FFD166] text-black hover:-translate-y-0.5 hover:bg-[#FFE7A3]"
                    : "cursor-not-allowed bg-slate-800 text-slate-500"
                }`}
              >
                {submitting ? "Đang giữ..." : "Tiếp tục"}
              </button>
            </div>
          </section>

          <aside className="h-fit rounded-2xl border border-white/10 bg-[#111C44]/80 p-5 shadow-2xl lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-xl bg-slate-900 shadow-lg">
              <img
                src={displayPosterUrl}
                alt={displayMovieTitle}
                className="aspect-[2/3] w-full object-cover"
                draggable={false}
                onError={(event) => {
                  if (event.currentTarget.src !== FALLBACK_POSTER) {
                    event.currentTarget.src = FALLBACK_POSTER;
                  }
                }}
              />
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <h2 className="text-xl font-black text-white">{displayMovieTitle}</h2>
              <div className="flex items-start gap-2 text-slate-300">
                <FiTag className="mt-0.5 h-4 w-4 shrink-0 text-[#FFD166]" />
                <span>
                  <b>Thể loại</b>
                  <br />
                  {displayMovieGenre}
                </span>
              </div>
              <div className="flex items-start gap-2 text-slate-300">
                <FiClock className="mt-0.5 h-4 w-4 shrink-0 text-[#FFD166]" />
                <span>
                  <b>Thời lượng</b>
                  <br />
                  {displayMovieDuration}
                </span>
              </div>
              <div className="flex items-start gap-2 text-slate-300">
                <FiMapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#FFD166]" />
                <span>
                  <b>Rạp chiếu</b>
                  <br />
                  {displayCinemaName}
                </span>
              </div>
              <div className="flex items-start gap-2 text-slate-300">
                <FiCalendar className="mt-0.5 h-4 w-4 shrink-0 text-[#FFD166]" />
                <span>
                  <b>Ngày chiếu</b>
                  <br />
                  {formatDateTime(displayStartTime)}
                </span>
              </div>
              <div className="flex items-start gap-2 text-slate-300">
                <FiFilm className="mt-0.5 h-4 w-4 shrink-0 text-[#FFD166]" />
                <span>
                  <b>Ghế ngồi</b>
                  <br />
                  {selectedSeatCodes.length > 0
                    ? selectedSeatCodes.join(", ")
                    : "Chưa chọn"}
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-[#FFD166]/30 bg-[#FFD166]/10 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#FFD166]">
                Phân loại
              </p>
              <p className="mt-1 text-sm font-bold text-white">
                {displayMovieAgeRating}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
