import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiFilter, FiSearch } from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import ShowtimePickerModal from "../../components/user/ShowtimePickerModal";
import {
  clearAuthSession,
  getAccessToken,
  isAccessTokenExpired,
} from "../../lib/auth";
import {
  CINEMA_SELECTION_EVENT,
  CINEMA_SELECTION_STORAGE_KEY,
  readSelectedCinemaId,
} from "../../lib/cinemaSelection";
import { getMediaUrl } from "../../lib/media";
import {
  movieService,
  type GenreResponse,
  type MovieResponse,
} from "../../services/movieService";
import {
  showtimeService,
  type ShowtimeResponse,
} from "../../services/showtimeService";

type MovieCard = {
  movieId: string;
  title: string;
  genre: string;
  duration: string;
  director: string;
  posterUrl: string;
  ageRating: string;
  highlight?: string;
  movieStatus?: string;
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

const BUY_TICKET_VISIBILITY_REFRESH_MS = 30_000;

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();

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

const isBookableShowtime = (showtime: ShowtimeResponse, currentTimeMs: number) => {
  const startTimestamp = getShowtimeTimestamp(showtime.startTime);

  return showtime.status?.toUpperCase() === "OPEN" && startTimestamp > currentTimeMs;
};

const mapMovieToCard = (movie: MovieResponseAliases): MovieCard => {
  const movieId = movie.id || movie.movieId || movie.movieID || "";
  const title =
    movie.movieNameVn || movie.title || movie.movieName || movie.name || "Phim đang cập nhật";
  const durationValue = movie.duration ?? movie.durationMinutes ?? movie.runningTime;
  const duration = Number(durationValue);
  const genre =
    movie.genres?.filter(Boolean).join(", ") ||
    movie.genre ||
    movie.genreName ||
    movie.categoryName ||
    "Đang cập nhật";
  const posterPath =
    movie.imagePoster || movie.posterUrl || movie.imageUrl || movie.poster || "";

  return {
    movieId,
    title,
    genre,
    duration: duration > 0 ? `${duration} phút` : "Đang cập nhật",
    director: movie.director || "Đang cập nhật",
    posterUrl: getMediaUrl(posterPath),
    ageRating: movie.ageRating || "P",
    highlight: movie.highlight || (movie.isHot ? "HOT" : undefined),
    movieStatus: movie.movieStatus || "NOW_SHOWING",
  };
};

const buildGenreOptions = (genres: GenreResponse[], movies: MovieCard[]) => {
  const genreNames = new Set<string>();

  genres.forEach((genre) => {
    if (genre.name?.trim()) {
      genreNames.add(genre.name.trim());
    }
  });

  movies.forEach((movie) => {
    movie.genre
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item && item !== "Đang cập nhật")
      .forEach((item) => genreNames.add(item));
  });

  return Array.from(genreNames).sort((left, right) =>
    left.localeCompare(right, "vi"),
  );
};

export default function Movies() {
  const navigate = useNavigate();
  const location = useLocation();
  const [movies, setMovies] = useState<MovieCard[]>([]);
  const [genres, setGenres] = useState<GenreResponse[]>([]);
  const [showtimes, setShowtimes] = useState<ShowtimeResponse[]>([]);
  const [selectedCinemaId, setSelectedCinemaId] = useState(() =>
    readSelectedCinemaId(),
  );
  const [selectedShowtimeMovie, setSelectedShowtimeMovie] =
    useState<MovieCard | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("all");
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [movieError, setMovieError] = useState("");
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);
  const genreFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMoviesPageData = async () => {
      try {
        setLoadingMovies(true);
        setMovieError("");

        const [moviesResponse, showtimesResponse, genresResponse] =
          await Promise.all([
            movieService.getActiveMovies(),
            showtimeService.getShowtimes(),
            movieService.getGenres().catch(() => []),
          ]);

        setMovies(moviesResponse.map(mapMovieToCard));
        setShowtimes(showtimesResponse);
        setGenres(genresResponse);
      } catch (error) {
        console.error("Lỗi lấy danh sách phim:", error);
        setMovies([]);
        setShowtimes([]);
        setGenres([]);
        setMovieError("Không tải được danh sách phim từ hệ thống.");
      } finally {
        setLoadingMovies(false);
      }
    };

    void fetchMoviesPageData();
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(
      () => setCurrentTimeMs(Date.now()),
      BUY_TICKET_VISIBILITY_REFRESH_MS,
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

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        genreFilterRef.current &&
        !genreFilterRef.current.contains(event.target as Node)
      ) {
        setIsGenreDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const genreOptions = useMemo(
    () => buildGenreOptions(genres, movies),
    [genres, movies],
  );

  const bookableMovieIds = useMemo(() => {
    const movieIds = new Set<string>();

    showtimes.forEach((showtime) => {
      if (selectedCinemaId && showtime.cinemaId !== selectedCinemaId) {
        return;
      }

      if (isBookableShowtime(showtime, currentTimeMs)) {
        movieIds.add(String(showtime.movieId));
      }
    });

    return movieIds;
  }, [currentTimeMs, selectedCinemaId, showtimes]);

  const filteredMovies = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);
    const normalizedGenre =
      selectedGenre === "all" ? "" : normalizeText(selectedGenre);

    return movies.filter((movie) => {
      const matchesSearch =
        !normalizedSearch ||
        normalizeText(`${movie.title} ${movie.director} ${movie.genre}`).includes(
          normalizedSearch,
        );
      const matchesGenre =
        !normalizedGenre || normalizeText(movie.genre).includes(normalizedGenre);

      return matchesSearch && matchesGenre;
    });
  }, [movies, searchTerm, selectedGenre]);

  const selectedGenreLabel = selectedGenre === "all" ? "Thể loại" : selectedGenre;

  const handleSelectGenre = (genre: string) => {
    setSelectedGenre(genre);
    setIsGenreDropdownOpen(false);
  };

  const handleGenreDropdownKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      setIsGenreDropdownOpen(false);
    }
  };

  const handleBuyTicket = (movie: MovieCard) => {
    const accessToken = getAccessToken();

    if (!accessToken || isAccessTokenExpired(accessToken)) {
      clearAuthSession();
      navigate("/login", {
        state: {
          from: location.pathname,
          intent: "buy-ticket",
          movieId: movie.movieId,
        },
      });
      return;
    }

    setSelectedShowtimeMovie(movie);
  };

  const handleOpenMovie = (movieId: string) => {
    if (movieId) {
      navigate(`/movie/${movieId}/showtimes`);
    }
  };

  return (
    <div className="bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#182437] dark:text-white">
      <section className="px-4 pb-12 pt-8 sm:px-6 sm:pb-16">
        <div className="mx-auto w-full max-w-[1120px]">
          <div className="mx-auto mb-8 grid max-w-2xl grid-cols-1 rounded-md border border-slate-300 bg-white shadow-sm dark:border-[#474747] dark:bg-[#1E293B] sm:grid-cols-[1fr_220px]">
            <label htmlFor="movie-search" className="sr-only">
              Tìm kiếm phim
            </label>
            <div className="relative">
              <FiSearch
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-white/45"
                aria-hidden="true"
              />
              <input
                id="movie-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm kiếm"
                className="h-11 w-full border-0 bg-transparent pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-[#FFD166] dark:text-white dark:placeholder:text-white/45"
              />
            </div>

            <div
              className="relative z-30 border-t border-slate-300 dark:border-[#474747] sm:border-l sm:border-t-0"
              ref={genreFilterRef}
              onKeyDown={handleGenreDropdownKeyDown}
            >
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isGenreDropdownOpen}
                aria-label="Lọc theo thể loại"
                onClick={() => setIsGenreDropdownOpen((current) => !current)}
                className="flex h-11 w-full cursor-pointer items-center gap-3 bg-transparent px-4 text-left text-sm font-bold text-slate-700 transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FFD166] dark:text-white dark:hover:bg-white/[0.06]"
              >
                <FiFilter
                  className="h-4 w-4 shrink-0 text-slate-400 dark:text-white/50"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{selectedGenreLabel}</span>
                <FiChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 dark:text-white/50 ${
                    isGenreDropdownOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>

              {isGenreDropdownOpen ? (
                <div
                  role="listbox"
                  aria-label="Danh sách thể loại"
                  className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-2xl shadow-slate-900/15 dark:border-[#474747] dark:bg-[#1E293B] dark:text-white dark:shadow-black/40"
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedGenre === "all"}
                    onClick={() => handleSelectGenre("all")}
                    className={`flex min-h-[42px] w-full cursor-pointer items-center rounded-md px-3 text-left text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] ${
                      selectedGenre === "all"
                        ? "bg-[#FFD166] text-[#111827]"
                        : "text-slate-700 hover:bg-slate-100 dark:text-white dark:hover:bg-white/[0.08]"
                    }`}
                  >
                    Tất cả thể loại
                  </button>

                  {genreOptions.map((genre) => {
                    const isSelected = selectedGenre === genre;

                    return (
                      <button
                        key={genre}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectGenre(genre)}
                        className={`mt-1 flex min-h-[42px] w-full cursor-pointer items-center rounded-md px-3 text-left text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] ${
                          isSelected
                            ? "bg-[#FFD166] text-[#111827]"
                            : "text-slate-700 hover:bg-slate-100 dark:text-white dark:hover:bg-white/[0.08]"
                        }`}
                      >
                        <span className="truncate">{genre}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          {loadingMovies ? (
            <div className="py-20 text-center text-sm font-bold text-slate-500 dark:text-white/60">
              Đang tải danh sách phim...
            </div>
          ) : movieError ? (
            <div className="rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-10 text-center text-sm font-semibold text-red-100">
              {movieError}
            </div>
          ) : filteredMovies.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-16 text-center text-sm font-bold text-slate-500 dark:border-white/10 dark:bg-[#1E293B] dark:text-white/55">
              Không có phim phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10">
              {filteredMovies.map((movie) => {
                const canBuyTicket =
                  movie.movieId && bookableMovieIds.has(String(movie.movieId));

                return (
                  <article
                    key={movie.movieId}
                    className="movie-card flex min-w-0 flex-col justify-between rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition-colors duration-200 hover:bg-slate-100 dark:border-transparent dark:bg-[#182437]/50 dark:shadow-none dark:hover:bg-[#1E2E4A]/40 sm:p-3"
                  >
                    <div className="flex flex-col gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => handleOpenMovie(movie.movieId)}
                        className="relative aspect-[2/3] overflow-hidden rounded-lg bg-[#0F172A] text-left shadow-md shadow-black/20 transition duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] lg:shadow-lg lg:shadow-black/30"
                        aria-label={`Xem lịch chiếu ${movie.title}`}
                      >
                        {movie.posterUrl ? (
                          <img
                            src={movie.posterUrl}
                            alt={movie.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            draggable={false}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[#111827] px-4 text-center text-xs font-bold uppercase tracking-wide text-white/45">
                            Chưa có poster
                          </div>
                        )}

                        <div className="absolute left-1.5 top-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-[#8A8F98] sm:left-2 sm:top-2 sm:px-2 sm:py-1 sm:text-[10px]">
                          {movie.ageRating}
                        </div>

                        {movie.highlight ? (
                          <div className="absolute right-0 top-0 rounded-bl bg-[#7C4DFF] px-2 py-1.5 text-[9px] font-extrabold leading-none text-white sm:px-2.5 sm:py-2 sm:text-[10px]">
                            {movie.highlight}
                          </div>
                        ) : null}
                      </button>

                      <div>
                        <button
                          type="button"
                          onClick={() => handleOpenMovie(movie.movieId)}
                          className="line-clamp-2 min-h-[34px] text-left text-sm font-bold leading-4 text-slate-800 transition-colors hover:text-[#FFD166] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] dark:text-white sm:min-h-[40px] sm:text-[15px] sm:leading-5"
                        >
                          {movie.title}
                        </button>
                        <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-500 dark:text-white/60 sm:mt-2 sm:space-y-1 sm:text-xs">
                          <p className="truncate">
                            Đạo diễn:{" "}
                            <span className="font-medium text-slate-700 dark:text-white/85">
                              {movie.director}
                            </span>
                          </p>
                          <p className="truncate">
                            Thể loại:{" "}
                            <span className="font-medium text-slate-700 dark:text-white/85">
                              {movie.genre}
                            </span>
                          </p>
                          <p className="truncate">
                            Thời lượng:{" "}
                            <span className="font-medium text-slate-700 dark:text-white/85">
                              {movie.duration}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {canBuyTicket ? (
                      <button
                        type="button"
                        onClick={() => handleBuyTicket(movie)}
                        className="mt-4 h-9 w-full rounded bg-gradient-to-r from-[#FFD166] to-[#FFE7A3] text-[11px] font-extrabold uppercase text-black shadow-md transition hover:brightness-105 active:scale-95 sm:mt-5 sm:h-10 sm:rounded-md sm:text-xs"
                      >
                        Mua vé
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {selectedShowtimeMovie && (
        <ShowtimePickerModal
          movie={selectedShowtimeMovie}
          selectedCinemaId={selectedCinemaId}
          onClose={() => setSelectedShowtimeMovie(null)}
        />
      )}
    </div>
  );
}
