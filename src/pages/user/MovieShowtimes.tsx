import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../../lib/api";

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T | null;
};

type ShowtimeResponse = {
  showtimeId: string;
  movieId: string;
  movieTitle: string;
  roomId: string;
  roomName: string;
  cinemaId: string;
  cinemaName: string;
  startTime: string;
  endTime: string;
  basePrice: number;
  status: string;
  showtimeSeatCount: number;
};

type MovieDetailResponse = {
  movieId: string;
  title: string;
  durationMinutes: number;
  genre?: string | null;
  language?: string | null;
  releaseDate?: string | null;
  ageRating?: string | null;
  description?: string | null;
  posterUrl?: string | null;
  trailerUrl?: string | null;
  movieStatus: string;
};

type SeatMapResponse = {
  showtimeId: string;
  availableSeats?: unknown[];
  lockedSeats?: unknown[];
  soldSeats?: unknown[];
};

type MovieInfo = {
  movieId: string;
  title: string;
  durationMinutes?: number;
  ageRating?: string;
  genre?: string;
  posterUrl?: string;
};

type SeatAvailability = {
  available: number;
  locked: number;
  sold: number;
  total: number;
};

type ShowtimeSlot = ShowtimeResponse & {
  seatAvailability?: SeatAvailability;
};

type RoomGroup = {
  roomId: string;
  roomName: string;
  slots: ShowtimeSlot[];
};

type CinemaGroup = {
  cinemaId: string;
  cinemaName: string;
  city: string;
  roomGroups: RoomGroup[];
};

type DayTab = {
  label: string;
  dateDisplay: string;
  dateValue: string;
};

const FALLBACK_POSTER =
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop";

const weekdays = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

const getDateKey = (value: string) => value.split("T")[0] || "";

const getTodayKey = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
};

const buildDayTab = (dateValue: string): DayTab => {
  const [, month, date] = dateValue.split("-");
  const dateObject = new Date(`${dateValue}T00:00:00`);
  const label =
    dateValue === getTodayKey()
      ? "Hôm nay"
      : weekdays[Number.isNaN(dateObject.getTime()) ? 0 : dateObject.getDay()];

  return {
    label,
    dateDisplay: `${date}/${month}`,
    dateValue,
  };
};

const formatISOToShortTime = (value: string) => {
  if (!value) {
    return "";
  }

  const timePart = value.includes("T")
    ? value.split("T")[1]
    : value.split(" ")[1];

  return timePart?.substring(0, 5) || "";
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value);

const normalizeMovieId = (value: string | undefined) => String(value || "");

const getAvailability = (seatMap: SeatMapResponse): SeatAvailability => {
  const available = seatMap.availableSeats?.length ?? 0;
  const locked = seatMap.lockedSeats?.length ?? 0;
  const sold = seatMap.soldSeats?.length ?? 0;

  return {
    available,
    locked,
    sold,
    total: available + locked + sold,
  };
};

const mapMovieDetailToInfo = (
  movieId: string,
  movie?: MovieDetailResponse | null,
  showtime?: ShowtimeResponse,
): MovieInfo => ({
  movieId,
  title: movie?.title || showtime?.movieTitle || "Phim hệ thống",
  durationMinutes: movie?.durationMinutes,
  ageRating: movie?.ageRating || "P",
  genre: movie?.genre || "Đang cập nhật",
  posterUrl: movie?.posterUrl || FALLBACK_POSTER,
});

const groupShowtimesByCinema = (
  showtimes: ShowtimeSlot[],
  selectedDate: string,
): CinemaGroup[] => {
  const cinemaMap = new Map<string, CinemaGroup & { roomMap: Map<string, RoomGroup> }>();

  showtimes
    .filter((showtime) => getDateKey(showtime.startTime) === selectedDate)
    .filter((showtime) => showtime.status?.toUpperCase() === "OPEN")
    .forEach((showtime) => {
      const cinemaId = showtime.cinemaId || "CINEMA_DEFAULT";
      const roomId = showtime.roomId || showtime.roomName || "ROOM_DEFAULT";

      if (!cinemaMap.has(cinemaId)) {
        cinemaMap.set(cinemaId, {
          cinemaId,
          cinemaName: showtime.cinemaName || "G2Cinema",
          city: "Thái Nguyên",
          roomGroups: [],
          roomMap: new Map<string, RoomGroup>(),
        });
      }

      const cinema = cinemaMap.get(cinemaId);
      if (!cinema) {
        return;
      }

      if (!cinema.roomMap.has(roomId)) {
        const roomGroup = {
          roomId,
          roomName: showtime.roomName || `Phòng ${roomId}`,
          slots: [],
        };
        cinema.roomMap.set(roomId, roomGroup);
        cinema.roomGroups.push(roomGroup);
      }

      cinema.roomMap.get(roomId)?.slots.push(showtime);
    });

  return Array.from(cinemaMap.values()).map((cinema) => ({
    cinemaId: cinema.cinemaId,
    cinemaName: cinema.cinemaName,
    city: cinema.city,
    roomGroups: cinema.roomGroups.map((room) => ({
      ...room,
      slots: [...room.slots].sort((left, right) =>
        left.startTime.localeCompare(right.startTime),
      ),
    })),
  }));
};

export default function MovieShowtimes() {
  const { movieId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [movieInfo, setMovieInfo] = useState<MovieInfo | null>(null);
  const [showtimes, setShowtimes] = useState<ShowtimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchShowtimeData = async () => {
      const currentMovieId = normalizeMovieId(movieId);
      if (!currentMovieId) {
        setErrorMessage("Không tìm thấy mã phim.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const [movieResult, showtimeResult] = await Promise.allSettled([
          api.get(`/api/movies/${currentMovieId}`) as Promise<unknown>,
          api.get("/api/showtimes") as Promise<unknown>,
        ]);

        if (!isMounted) {
          return;
        }

        const movieResponse =
          movieResult.status === "fulfilled"
            ? (movieResult.value as ApiResponse<MovieDetailResponse>)
            : null;
        const showtimeResponse =
          showtimeResult.status === "fulfilled"
            ? (showtimeResult.value as ApiResponse<ShowtimeResponse[]>)
            : null;

        if (!showtimeResponse?.success || !Array.isArray(showtimeResponse.data)) {
          throw new Error(showtimeResponse?.message || "Không tải được lịch chiếu.");
        }

        const movieShowtimes = showtimeResponse.data.filter(
          (showtime) => String(showtime.movieId) === currentMovieId,
        );
        const sampleShowtime = movieShowtimes[0];

        setMovieInfo(
          mapMovieDetailToInfo(
            currentMovieId,
            movieResponse?.success ? movieResponse.data : null,
            sampleShowtime,
          ),
        );

        const availabilityEntries = await Promise.all(
          movieShowtimes.map(async (showtime) => {
            try {
              const response = (await api.get(
                `/api/seats/showtimes/${showtime.showtimeId}/map`,
              )) as unknown as ApiResponse<SeatMapResponse>;

              return [
                showtime.showtimeId,
                response.success && response.data ? getAvailability(response.data) : null,
              ] as const;
            } catch (error) {
              console.warn("Không tải được sơ đồ ghế cho suất chiếu", showtime.showtimeId, error);
              return [showtime.showtimeId, null] as const;
            }
          }),
        );

        if (!isMounted) {
          return;
        }

        const availabilityMap = new Map(
          availabilityEntries.filter(
            (entry): entry is readonly [string, SeatAvailability] => entry[1] !== null,
          ),
        );

        setShowtimes(
          movieShowtimes.map((showtime) => ({
            ...showtime,
            seatAvailability: availabilityMap.get(showtime.showtimeId),
          })),
        );
      } catch (error) {
        console.error("Lỗi tải lịch chiếu:", error);
        if (isMounted) {
          setErrorMessage("Không tải được lịch chiếu từ hệ thống.");
          setMovieInfo(null);
          setShowtimes([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchShowtimeData();

    return () => {
      isMounted = false;
    };
  }, [movieId]);

  const daysFilter = useMemo(() => {
    const dateValues = Array.from(
      new Set(showtimes.map((showtime) => getDateKey(showtime.startTime)).filter(Boolean)),
    ).sort();

    return dateValues.map(buildDayTab);
  }, [showtimes]);

  const selectedDateFromUrl = searchParams.get("date") || "";
  const currentSelectedDate = daysFilter.some(
    (day) => day.dateValue === selectedDateFromUrl,
  )
    ? selectedDateFromUrl
    : daysFilter[0]?.dateValue || "";

  useEffect(() => {
    if (!loading && currentSelectedDate && selectedDateFromUrl !== currentSelectedDate) {
      setSearchParams({ date: currentSelectedDate }, { replace: true });
    }
  }, [currentSelectedDate, loading, selectedDateFromUrl, setSearchParams]);

  const groupedCinemas = useMemo(
    () => groupShowtimesByCinema(showtimes, currentSelectedDate),
    [currentSelectedDate, showtimes],
  );

  const handleDateChange = (dateValue: string) => {
    setSearchParams({ date: dateValue });
  };

  const handleSelectShowtime = (slot: ShowtimeSlot) => {
    navigate(`/booking/seats/${slot.showtimeId}`, {
      state: {
        movie: movieInfo,
        showtime: slot,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0C] text-white">
        <p className="animate-pulse text-sm font-bold text-blue-400">
          Đang đồng bộ lịch chiếu từ hệ thống...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0C] p-6 text-white">
      <div className="mx-auto max-w-5xl">
        {movieInfo ? (
          <div className="mb-8 flex items-center gap-6 rounded-3xl border border-gray-800 bg-[#111C44] p-6 shadow-2xl">
            <div className="h-36 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-900 shadow-md">
              <img
                src={movieInfo.posterUrl || FALLBACK_POSTER}
                alt={movieInfo.title}
                className="h-full w-full object-cover"
                onError={(event) => {
                  if (event.currentTarget.src !== FALLBACK_POSTER) {
                    event.currentTarget.src = FALLBACK_POSTER;
                  }
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded bg-amber-500 px-2.5 py-0.5 text-[10px] font-black uppercase text-black">
                  {movieInfo.ageRating || "P"}
                </span>
                <h1 className="text-2xl font-black tracking-wide">
                  {movieInfo.title}
                </h1>
              </div>
              <p className="mt-2 text-xs text-gray-300">
                Thể loại: {movieInfo.genre || "Đang cập nhật"}
                {movieInfo.durationMinutes ? (
                  <> | Thời lượng: {movieInfo.durationMinutes} phút</>
                ) : null}
              </p>
              <p className="mt-4 text-xs italic text-gray-500">
                Lưu ý: Vui lòng mua vé đúng độ tuổi quy định của bộ phim.
              </p>
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center text-sm font-semibold text-red-100">
            {errorMessage}
          </div>
        ) : null}

        <div className="mb-8">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
            Chọn ngày xem
          </h3>
          {daysFilter.length === 0 ? (
            <div className="rounded-2xl border border-gray-800 bg-[#111C44] p-5 text-sm text-gray-400">
              Hiện phim này chưa có ngày chiếu khả dụng.
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {daysFilter.map((day) => {
                const isSelected = day.dateValue === currentSelectedDate;
                return (
                  <button
                    type="button"
                    key={day.dateValue}
                    onClick={() => handleDateChange(day.dateValue)}
                    className={`flex min-w-[90px] flex-col items-center rounded-xl border p-3 transition ${
                      isSelected
                        ? "border-indigo-500 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                        : "border-gray-800 bg-[#111C44] text-gray-400 hover:border-gray-700 hover:text-white"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                      {day.label}
                    </span>
                    <span className="mt-0.5 text-lg font-black">
                      {day.dateDisplay}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Danh sách suất chiếu tại rạp
          </h3>

          {groupedCinemas.length === 0 ? (
            <div className="rounded-2xl border border-gray-800 bg-[#111C44] p-10 text-center text-sm italic text-gray-500">
              Hiện tại không tìm thấy suất chiếu khả dụng cho phim trong ngày đã chọn.
            </div>
          ) : (
            groupedCinemas.map((cinema) => (
              <div
                key={cinema.cinemaId}
                className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-[#111C44] p-5 shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
                  <h4 className="text-base font-extrabold tracking-wide text-blue-400">
                    {cinema.cinemaName}
                  </h4>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    {cinema.city}
                  </span>
                </div>

                <div className="space-y-4">
                  {cinema.roomGroups.map((group) => (
                    <div
                      key={group.roomId}
                      className="flex flex-col items-start gap-3 rounded-xl border border-gray-800/40 bg-[#0D1637]/40 p-4 sm:flex-row sm:gap-6"
                    >
                      <div className="w-36 shrink-0 pt-2 text-xs font-black uppercase tracking-wider text-gray-400">
                        {group.roomName}
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {group.slots.map((slot) => {
                          const shortTime = formatISOToShortTime(slot.startTime);
                          const availableSeats =
                            slot.seatAvailability?.available ?? slot.showtimeSeatCount;
                          const isSoldOut = availableSeats <= 0;

                          return (
                            <button
                              type="button"
                              key={slot.showtimeId}
                              onClick={() => handleSelectShowtime(slot)}
                              disabled={isSoldOut}
                              className="group rounded-xl border border-gray-800 bg-[#0F172A] px-4 py-2.5 text-center transition hover:scale-[1.03] hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                              title={`Giá vé cơ bản: ${formatMoney(slot.basePrice)}đ`}
                            >
                              <div className="text-sm font-black text-white transition-colors group-hover:text-blue-400">
                                {shortTime}
                              </div>
                              <div className="mt-0.5 text-[9px] font-medium text-gray-500">
                                {availableSeats} ghế trống
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
