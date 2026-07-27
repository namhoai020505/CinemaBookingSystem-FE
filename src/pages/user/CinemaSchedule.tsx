import { useEffect, useMemo, useState } from "react";
import { FiClock, FiInfo, FiMapPin, FiTag } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import fallbackPoster from "../../assets/thumbnail-1-144816-050424-68.jpeg";
import {
  CINEMA_SELECTION_EVENT,
  CINEMA_SELECTION_STORAGE_KEY,
  readSelectedCinemaId,
} from "../../lib/cinemaSelection";
import { getMediaUrl } from "../../lib/media";
import { movieService, type MovieResponse } from "../../services/movieService";
import {
  showtimeService,
  type CinemaResponse,
  type ShowtimeResponse,
} from "../../services/showtimeService";

type MovieInfo = {
  movieId: string;
  title: string;
  genre: string;
  duration: string;
  posterUrl: string;
  ageRating: string;
  highlight?: string;
};

type MovieResponseAliases = MovieResponse & {
  movieId?: string;
  movieID?: string;
  title?: string;
  movieName?: string;
  name?: string;
  durationMinutes?: number | string;
  runningTime?: number | string;
  genre?: string;
  genreName?: string;
  categoryName?: string;
  posterUrl?: string;
  imageUrl?: string;
  poster?: string;
  isHot?: boolean;
};

type RoomScheduleGroup = {
  roomId: string;
  roomName: string;
  slots: ShowtimeResponse[];
};

type MovieScheduleGroup = {
  movie: MovieInfo;
  firstStartTime: number;
  roomGroups: RoomScheduleGroup[];
};

type DateTab = {
  dateValue: string;
  dateText: string;
  weekdayText: string;
};

const SCHEDULE_REFRESH_MS = 30_000;
const DATE_TAB_COUNT = 5;
const LATE_SHOWTIME_START_MINUTES = 22 * 60;

const weekdayLabels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const getGenreValue = (movie: MovieResponseAliases) => {
  if (Array.isArray(movie.genres) && movie.genres.length > 0) {
    return movie.genres.filter(Boolean).join(", ");
  }

  return movie.genre || movie.genreName || movie.categoryName || "Đang cập nhật";
};

const mapMovieToInfo = (movie: MovieResponseAliases): MovieInfo => {
  const movieId = movie.id || movie.movieId || movie.movieID || "";
  const title =
    movie.movieNameVn || movie.title || movie.movieName || movie.name || "Phim đang cập nhật";
  const durationValue = movie.duration ?? movie.durationMinutes ?? movie.runningTime;
  const duration = Number(durationValue);
  const posterPath =
    movie.imagePoster || movie.posterUrl || movie.imageUrl || movie.poster || "";

  return {
    movieId,
    title,
    genre: getGenreValue(movie),
    duration: duration > 0 ? `${duration} phút` : "Đang cập nhật",
    posterUrl: getMediaUrl(posterPath),
    ageRating: movie.ageRating || "P",
    highlight: movie.highlight || (movie.isHot ? "HOT" : undefined),
  };
};

const getShowtimeTimestamp = (value: string) => {
  if (!value) {
    return 0;
  }

  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);

  if (match) {
    const [, year, month, date, hour, minute] = match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(date),
      Number(hour),
      Number(minute),
    ).getTime();
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const getShowtimeDateKey = (value: string) => {
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "";
  }

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const buildDateTab = (dateValue: string): DateTab => {
  const [, month, date] = dateValue.split("-");
  const dateObject = new Date(`${dateValue}T00:00:00`);
  const weekdayText = weekdayLabels[
    Number.isNaN(dateObject.getTime()) ? 0 : dateObject.getDay()
  ];

  return {
    dateValue,
    dateText: `${date}/${month}`,
    weekdayText,
  };
};

const formatTime = (value: string) => {
  const match = value.match(/[T\s](\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "";
};

const getShowtimeStartMinutes = (value: string) => {
  const match = value.match(/[T\s](\d{2}):(\d{2})/);
  if (!match) {
    return 0;
  }

  return Number(match[1]) * 60 + Number(match[2]);
};

const isVisibleShowtime = (showtime: ShowtimeResponse, currentTimeMs: number) =>
  showtime.status?.toUpperCase() === "OPEN" &&
  getShowtimeTimestamp(showtime.startTime) > currentTimeMs;

const sortShowtimesByTime = (slots: ShowtimeResponse[]) =>
  [...slots].sort(
    (left, right) =>
      getShowtimeTimestamp(left.startTime) - getShowtimeTimestamp(right.startTime),
  );

const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value);

export default function CinemaSchedule() {
  const navigate = useNavigate();
  const [cinemas, setCinemas] = useState<CinemaResponse[]>([]);
  const [movies, setMovies] = useState<MovieInfo[]>([]);
  const [showtimes, setShowtimes] = useState<ShowtimeResponse[]>([]);
  const [selectedCinemaId, setSelectedCinemaId] = useState(() =>
    readSelectedCinemaId(),
  );
  const [selectedDate, setSelectedDate] = useState("");
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchScheduleData = async () => {
      try {
        setLoading(true);
        setErrorMessage("");

        const [cinemaItems, movieItems, showtimeItems] = await Promise.all([
          showtimeService.getCinemas().catch(() => []),
          movieService.getActiveMovies(),
          showtimeService.getShowtimes(),
        ]);

        setCinemas(
          cinemaItems.filter(
            (cinema) => cinema.cinemaStatus?.toUpperCase() === "ACTIVE",
          ),
        );
        setMovies(movieItems.map((movie) => mapMovieToInfo(movie)));
        setShowtimes(showtimeItems);
      } catch (error) {
        console.error("Không tải được lịch chiếu theo rạp:", error);
        setCinemas([]);
        setMovies([]);
        setShowtimes([]);
        setErrorMessage("Không tải được lịch chiếu từ hệ thống.");
      } finally {
        setLoading(false);
      }
    };

    void fetchScheduleData();
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(
      () => setCurrentTimeMs(Date.now()),
      SCHEDULE_REFRESH_MS,
    );

    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    const syncSelectedCinema = () => setSelectedCinemaId(readSelectedCinemaId());

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === CINEMA_SELECTION_STORAGE_KEY) {
        syncSelectedCinema();
      }
    };

    window.addEventListener(CINEMA_SELECTION_EVENT, syncSelectedCinema);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(CINEMA_SELECTION_EVENT, syncSelectedCinema);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const selectedCinema = useMemo(
    () =>
      cinemas.find((cinema) => cinema.cinemaId === selectedCinemaId) ||
      cinemas[0],
    [cinemas, selectedCinemaId],
  );

  const effectiveCinemaId = selectedCinema?.cinemaId || "";

  const visibleShowtimes = useMemo(
    () =>
      showtimes
        .filter((showtime) =>
          effectiveCinemaId ? showtime.cinemaId === effectiveCinemaId : true,
        )
        .filter((showtime) => isVisibleShowtime(showtime, currentTimeMs)),
    [currentTimeMs, effectiveCinemaId, showtimes],
  );

  const dateTabs = useMemo(() => {
    const dateKeys = Array.from(
      new Set(
        visibleShowtimes
          .map((showtime) => getShowtimeDateKey(showtime.startTime))
          .filter(Boolean),
      ),
    ).sort();

    const fallbackDateKeys = Array.from({ length: DATE_TAB_COUNT }, (_, index) =>
      getLocalDateKey(addDays(new Date(), index)),
    );

    const resolvedDateKeys =
      dateKeys.length > 0 ? dateKeys.slice(0, DATE_TAB_COUNT) : fallbackDateKeys;

    return resolvedDateKeys.map(buildDateTab);
  }, [visibleShowtimes]);

  const activeDate = dateTabs.some((tab) => tab.dateValue === selectedDate)
    ? selectedDate
    : dateTabs[0]?.dateValue || "";

  const moviesById = useMemo(() => {
    const movieMap = new Map<string, MovieInfo>();
    movies.forEach((movie) => {
      if (movie.movieId) {
        movieMap.set(String(movie.movieId), movie);
      }
    });

    return movieMap;
  }, [movies]);

  const scheduleGroups = useMemo<MovieScheduleGroup[]>(() => {
    const groupMap = new Map<
      string,
      MovieScheduleGroup & { roomMap: Map<string, RoomScheduleGroup> }
    >();

    visibleShowtimes
      .filter((showtime) => getShowtimeDateKey(showtime.startTime) === activeDate)
      .forEach((showtime) => {
        const movieId = String(showtime.movieId || showtime.movieTitle);
        const movie =
          moviesById.get(String(showtime.movieId)) ||
          ({
            movieId,
            title: showtime.movieTitle || "Phim đang cập nhật",
            genre: "Đang cập nhật",
            duration: "Đang cập nhật",
            posterUrl: "",
            ageRating: "P",
          } satisfies MovieInfo);

        if (!groupMap.has(movieId)) {
          groupMap.set(movieId, {
            movie,
            firstStartTime: getShowtimeTimestamp(showtime.startTime),
            roomGroups: [],
            roomMap: new Map<string, RoomScheduleGroup>(),
          });
        }

        const movieGroup = groupMap.get(movieId);
        if (!movieGroup) {
          return;
        }

        movieGroup.firstStartTime = Math.min(
          movieGroup.firstStartTime,
          getShowtimeTimestamp(showtime.startTime),
        );

        const roomKey = showtime.roomId || showtime.roomName || "ROOM_DEFAULT";

        if (!movieGroup.roomMap.has(roomKey)) {
          const roomGroup = {
            roomId: roomKey,
            roomName:
              showtime.roomName ||
              (roomKey !== "ROOM_DEFAULT" ? `Phòng ${roomKey}` : "Phòng chiếu"),
            slots: [],
          };
          movieGroup.roomMap.set(roomKey, roomGroup);
          movieGroup.roomGroups.push(roomGroup);
        }

        movieGroup.roomMap.get(roomKey)?.slots.push(showtime);
      });

    return Array.from(groupMap.values())
      .map((group) => ({
        movie: group.movie,
        firstStartTime: group.firstStartTime,
        roomGroups: group.roomGroups.map((room) => ({
          ...room,
          slots: sortShowtimesByTime(room.slots),
        })),
      }))
      .sort((left, right) => left.firstStartTime - right.firstStartTime);
  }, [activeDate, moviesById, visibleShowtimes]);

  const featuredGroup = scheduleGroups[0];
  const remainingGroups = scheduleGroups.slice(1);
  const cinemaName = selectedCinema?.cinemaName || "Tất cả rạp";

  const handleSelectShowtime = (showtimeId: string) => {
    navigate(`/booking/seats/${showtimeId}`);
  };

  const renderSlotButton = (slot: ShowtimeResponse) => {
    const startMinutes = getShowtimeStartMinutes(slot.startTime);
    const isLate = startMinutes >= LATE_SHOWTIME_START_MINUTES;
    const timeLabel = formatTime(slot.startTime) || "--:--";
    const seatLabel =
      slot.showtimeSeatCount > 0
        ? `${slot.showtimeSeatCount} ghế trống`
        : `${formatMoney(slot.basePrice)} đ`;

    return (
      <button
        key={slot.showtimeId}
        type="button"
        onClick={() => handleSelectShowtime(slot.showtimeId)}
        className={`g2c-cinema-schedule-slot min-h-[48px] min-w-[88px] rounded-sm px-3 py-2 text-center text-xs font-black shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] ${
          isLate
            ? "g2c-cinema-schedule-slot--late bg-[#FF3347] text-white hover:bg-[#E31F32]"
            : "bg-white text-[#111827] hover:bg-[#FFE8A8]"
        }`}
      >
        <span className="g2c-cinema-schedule-time block text-sm leading-none">
          {timeLabel}
        </span>
        <span
          className={`g2c-cinema-schedule-seat mt-1 block text-[9px] font-bold ${
            isLate ? "text-white/80" : "text-slate-500"
          }`}
        >
          {seatLabel}
        </span>
      </button>
    );
  };

  const renderMovieCard = (
    group: MovieScheduleGroup,
    variant: "featured" | "compact",
  ) => {
    const isFeatured = variant === "featured";
    const posterClass = isFeatured
      ? "w-full max-w-[260px] sm:w-[250px]"
      : "w-full max-w-[180px] sm:w-[160px]";

    return (
      <article
        key={group.movie.movieId}
        className={`border-t border-white/35 py-6 ${
          isFeatured
            ? "grid gap-5 md:grid-cols-[260px_1fr]"
            : "grid gap-4 sm:grid-cols-[170px_1fr]"
        }`}
      >
        <button
          type="button"
          onClick={() => navigate(`/movie/${group.movie.movieId}/showtimes`)}
          className={`${posterClass} group relative overflow-hidden rounded-lg bg-[#0F172A] text-left shadow-xl shadow-black/20 transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] motion-reduce:transition-none`}
          aria-label={`Xem thông tin ${group.movie.title}`}
        >
          <img
            src={group.movie.posterUrl || fallbackPoster}
            alt={group.movie.title}
            className="aspect-[2/3] w-full object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
            loading="lazy"
            draggable={false}
          />
          <span className="absolute left-2 top-2 rounded bg-[#FFD166] px-2 py-1 text-[10px] font-black text-[#111827]">
            {group.movie.ageRating}
          </span>
          {group.movie.highlight ? (
            <span className="absolute right-0 top-0 rounded-bl bg-[#FF3347] px-2.5 py-2 text-[10px] font-black text-white">
              {group.movie.highlight}
            </span>
          ) : null}
        </button>

        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate(`/movie/${group.movie.movieId}/showtimes`)}
            className={`line-clamp-2 text-left font-black leading-tight text-white transition-colors hover:text-[#FFD166] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] ${
              isFeatured ? "text-3xl" : "text-lg"
            }`}
          >
            {group.movie.title}
          </button>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <FiTag aria-hidden="true" />
              {group.movie.genre}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FiClock aria-hidden="true" />
              {group.movie.duration}
            </span>
          </div>

          <div className="mt-4 space-y-5">
            {group.roomGroups.map((room) => (
              <section key={room.roomId}>
                <h3 className="mb-3 text-base font-black text-white">
                  {room.roomName || `Phòng ${room.roomId}`}
                </h3>
                <div className="flex flex-wrap gap-3">
                  {room.slots.map(renderSlotButton)}
                </div>
              </section>
            ))}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="bg-[#1E293B] text-white transition-colors duration-300">
      <section className="px-4 pb-12 pt-8 sm:px-6 sm:pb-16">
        <div className="mx-auto w-full max-w-[1120px]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/35 pb-3">
            <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-white/70">
              <FiMapPin className="shrink-0 text-[#FFD166]" aria-hidden="true" />
              <span className="truncate">{cinemaName}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-white/70">
              <span className="h-3 w-3 rounded-sm bg-[#FF3347]" />
              Suất chiếu muộn từ 22h00
            </div>
          </div>

          <div className="mt-4 flex gap-6 overflow-x-auto border-b border-white/35 pb-2">
            {dateTabs.map((tab) => {
              const isActive = tab.dateValue === activeDate;

              return (
                <button
                  key={tab.dateValue}
                  type="button"
                  onClick={() => setSelectedDate(tab.dateValue)}
                  className={`min-h-[52px] shrink-0 text-left transition-colors ${
                    isActive ? "text-[#FFD166]" : "text-white hover:text-[#FFD166]"
                  }`}
                >
                  <span className="text-3xl font-black leading-none">
                    {tab.dateText.split("/")[0]}
                  </span>
                  <span className="ml-1 text-lg font-black">
                    /{tab.dateText.split("/")[1]}
                  </span>
                  <span className="ml-1 text-xs font-black">- {tab.weekdayText}</span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="py-24 text-center text-sm font-bold text-white/60">
              Đang tải lịch chiếu...
            </div>
          ) : errorMessage ? (
            <div className="mt-8 rounded-lg border border-red-400/25 bg-red-500/10 px-4 py-10 text-center text-sm font-bold text-red-100">
              {errorMessage}
            </div>
          ) : scheduleGroups.length === 0 ? (
            <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-16 text-center">
              <FiInfo className="mx-auto text-white/45" size={26} aria-hidden="true" />
              <p className="mt-3 text-sm font-black">Chưa có suất chiếu phù hợp</p>
              <p className="mt-2 text-sm font-semibold text-white/55">
                Hãy thử chọn ngày khác hoặc đổi cơ sở rạp ở thanh header.
              </p>
            </div>
          ) : (
            <>
              {featuredGroup ? renderMovieCard(featuredGroup, "featured") : null}

              {remainingGroups.length > 0 ? (
                <div className="grid gap-x-10 lg:grid-cols-2">
                  {remainingGroups.map((group) => renderMovieCard(group, "compact"))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
