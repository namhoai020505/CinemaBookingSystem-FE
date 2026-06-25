import { useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiClock, FiGlobe, FiCalendar, FiFilm, FiPlay } from "react-icons/fi";
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
  language?: string;
  releaseDate?: string;
  description?: string;
  trailerUrl?: string;
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
  language: movie?.language || "Tiếng Việt",
  releaseDate: movie?.releaseDate || undefined,
  description: movie?.description || undefined,
  trailerUrl: movie?.trailerUrl || undefined,
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

const getYoutubeEmbedUrl = (url?: string) => {
  if (!url) return "";
  let videoId = "";
  if (url.includes("watch?v=")) {
    videoId = url.split("watch?v=")[1]?.split("&")[0] || "";
  } else if (url.includes("youtu.be/")) {
    videoId = url.split("youtu.be/")[1]?.split("?")[0] || "";
  } else if (url.includes("embed/")) {
    videoId = url.split("embed/")[1]?.split("?")[0] || "";
  }
  return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
};

export default function MovieShowtimes() {
  const { movieId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [movieInfo, setMovieInfo] = useState<MovieInfo | null>(null);
  const [showtimes, setShowtimes] = useState<ShowtimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showTrailerModal, setShowTrailerModal] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
        <button
          type="button"
          onClick={() => navigate("/")}
          className="group mb-5 flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white transition-all bg-white/5 hover:bg-white/10 px-3.5 py-1.5 rounded-lg border border-white/5 hover:border-white/15 cursor-pointer shadow-md w-fit"
        >
          <FiArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Quay lại trang chủ
        </button>
        {movieInfo ? (
          <div className="relative mb-8 overflow-hidden rounded-3xl border border-gray-800 bg-[#111C44] shadow-2xl p-6 md:p-8">
            {/* Backdrop Blur Poster */}
            <div 
              className="absolute inset-0 bg-cover bg-center blur-2xl opacity-10 pointer-events-none scale-110"
              style={{ backgroundImage: `url(${movieInfo.posterUrl || FALLBACK_POSTER})` }}
            />
            
            <div className="relative z-10 grid gap-6 md:grid-cols-[240px_1fr] items-start">
              {/* Left: Movie Poster */}
              <div className="mx-auto md:mx-0 w-full max-w-[240px] aspect-[2/3] overflow-hidden rounded-2xl bg-slate-900 shadow-xl border border-white/5 group relative">
                <img
                  src={movieInfo.posterUrl || FALLBACK_POSTER}
                  alt={movieInfo.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(event) => {
                    if (event.currentTarget.src !== FALLBACK_POSTER) {
                      event.currentTarget.src = FALLBACK_POSTER;
                    }
                  }}
                />
                
                {/* Watch Trailer Button Overlay on Poster Hover */}
                {movieInfo.trailerUrl && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setShowTrailerModal(true)}
                      className="bg-[#FFD166] text-black hover:bg-[#FFE7A3] font-bold p-3.5 rounded-full shadow-lg transition-transform transform scale-90 group-hover:scale-100 duration-300 flex items-center gap-2 cursor-pointer"
                    >
                      <FiPlay className="h-5 w-5 fill-black" />
                    </button>
                  </div>
                )}
              </div>

              {/* Right: Movie Details */}
              <div className="flex flex-col gap-4 text-left">
                {/* Title and Age Rating Badge */}
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span 
                      className={`rounded px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-sm ${
                        movieInfo.ageRating?.includes("C18") ? "bg-red-650" :
                        movieInfo.ageRating?.includes("C16") ? "bg-orange-600" :
                        movieInfo.ageRating?.includes("C13") ? "bg-yellow-600" :
                        "bg-green-600"
                      }`}
                    >
                      {movieInfo.ageRating || "P"}
                    </span>
                    <h1 className="text-2xl md:text-3xl font-black tracking-wide text-white">
                      {movieInfo.title}
                    </h1>
                  </div>
                  <p className="text-[11px] text-[#FFD166] font-semibold mt-1">Lưu ý: Vui lòng mua vé đúng độ tuổi quy định của bộ phim.</p>
                </div>

                {/* Metadata List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0F172A]/50 border border-gray-800/80 rounded-2xl p-4 text-xs text-gray-300">
                  <div className="flex items-center gap-2.5">
                    <FiFilm className="h-4 w-4 text-[#FFD166] shrink-0" />
                    <span><b>Thể loại:</b> {movieInfo.genre || "Đang cập nhật"}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <FiClock className="h-4 w-4 text-[#FFD166] shrink-0" />
                    <span><b>Thời lượng:</b> {movieInfo.durationMinutes ? `${movieInfo.durationMinutes} phút` : "Đang cập nhật"}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <FiGlobe className="h-4 w-4 text-[#FFD166] shrink-0" />
                    <span><b>Ngôn ngữ:</b> {movieInfo.language || "Tiếng Việt"}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <FiCalendar className="h-4 w-4 text-[#FFD166] shrink-0" />
                    <span>
                      <b>Khởi chiếu:</b>{" "}
                      {movieInfo.releaseDate 
                        ? new Date(movieInfo.releaseDate).toLocaleDateString("vi-VN") 
                        : "Đang cập nhật"}
                    </span>
                  </div>
                </div>

                {/* Synopsis / Description */}
                <div className="flex flex-col gap-1.5 mt-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Tóm tắt phim</h3>
                  <p className="text-xs leading-6 text-slate-300 bg-slate-900/10 p-1.5 rounded-lg border border-transparent font-medium">
                    {movieInfo.description || "Nội dung phim đang được cập nhật..."}
                  </p>
                </div>

                {/* Trailer Button */}
                {movieInfo.trailerUrl && (
                  <button
                    type="button"
                    onClick={() => setShowTrailerModal(true)}
                    className="flex items-center justify-center gap-2 w-fit bg-red-650 hover:bg-red-600 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-red-900/20 transition-all text-xs active:scale-95 cursor-pointer mt-1"
                  >
                    <FiPlay className="h-4 w-4 fill-white" />
                    Xem Trailer
                  </button>
                )}
              </div>
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

      {/* WATCH TRAILER MODAL */}
      {showTrailerModal && movieInfo?.trailerUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowTrailerModal(false)}
        >
          <div 
            className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowTrailerModal(false)} 
              className="absolute top-4 right-4 text-white hover:text-red-500 text-xl font-bold bg-black/60 hover:bg-black w-8 h-8 rounded-full flex items-center justify-center transition-all z-50 cursor-pointer"
            >
              &times;
            </button>
            <iframe 
              className="w-full h-full" 
              src={getYoutubeEmbedUrl(movieInfo.trailerUrl)} 
              title="Trailer" 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}
    </div>
  );
}
