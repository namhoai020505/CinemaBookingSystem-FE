import { useCallback, useEffect, useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import slide1 from "../../assets/slide1.png";
import slide2 from "../../assets/slide2.png";
import slide3 from "../../assets/slide3.png";
import slide4 from "../../assets/slide4.png";
import slide5 from "../../assets/slide5.png";
import slide6 from "../../assets/slide6.png";
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
import { movieService } from "../../services/movieService";
import { bannerService } from "../../services/bannerService";
import type { BannerResponse } from "../../services/bannerService";
import {
  showtimeService,
  type ShowtimeResponse,
} from "../../services/showtimeService";

type HeroSlide = {
  id: string;
  imageUrl: string;
  alt: string;
  movieId?: string;
  linkUrl?: string;
};

type Movie = {
  movieId: string;
  title: string;
  genre: string;
  duration: string;
  director?: string;
  posterUrl: string;
  bannerUrl?: string;
  ageRating: string;
  highlight?: string;
  movieStatus?: string;
};

type MovieApiItem = Record<string, unknown>;

const AUTO_PLAY_MS = 4500;
const SLIDE_TRANSITION_MS = 700;
const BUY_TICKET_VISIBILITY_REFRESH_MS = 30_000;

const mockHeroSlides: HeroSlide[] = [
  { id: "slide-1", imageUrl: slide1, alt: "Movie banner slide 1" },
  { id: "slide-2", imageUrl: slide2, alt: "Movie banner slide 2" },
  { id: "slide-3", imageUrl: slide3, alt: "Movie banner slide 3" },
  { id: "slide-4", imageUrl: slide4, alt: "Movie banner slide 4" },
  { id: "slide-5", imageUrl: slide5, alt: "Movie banner slide 5" },
  { id: "slide-6", imageUrl: slide6, alt: "Movie banner slide 6" },
];



const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getStringValue = (item: MovieApiItem, keys: string[]) => {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return "";
};

const getGenreValue = (item: MovieApiItem) => {
  const genre = item.genre ?? item.genres ?? item.genreName ?? item.categoryName;

  if (Array.isArray(genre)) {
    return genre
      .map((value) => {
        if (typeof value === "string") {
          return value.trim();
        }

        if (isRecord(value)) {
          return getStringValue(value, ["name", "genreName", "title"]);
        }

        return "";
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof genre === "string" && genre.trim()) {
    return genre.trim();
  }

  return "Đang cập nhật";
};

// resolvePosterUrl: đã được thay bằng getMediaUrl từ lib/media
// để đảm bảo tất cả các trang dùng cùng logic prefix URL của backend.

const extractMovieList = (response: unknown): MovieApiItem[] => {
  if (Array.isArray(response)) {
    return response.filter(isRecord);
  }

  if (!isRecord(response)) {
    return [];
  }

  const nestedData = isRecord(response.data) ? response.data : null;
  const candidates = [
    response.data,
    response.items,
    response.results,
    nestedData?.data,
    nestedData?.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord);
    }
  }

  return [];
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

const isBookableShowtime = (showtime: ShowtimeResponse, currentTimeMs: number) => {
  const startTimestamp = getShowtimeTimestamp(showtime.startTime);

  return showtime.status?.toUpperCase() === "OPEN" && startTimestamp > currentTimeMs;
};

const mapApiMovieToCard = (movie: MovieApiItem): Movie => {
  const movieId = getStringValue(movie, ["movieId", "id", "movieID", "MovieId"]);
  const title =
    getStringValue(movie, ["movieNameVn", "title", "movieName", "name"]) ||
    "Phim đang cập nhật";
  const durationValue = getStringValue(movie, [
    "duration",
    "durationMinutes",
    "runningTime",
  ]);
  const posterUrl = getMediaUrl(
    getStringValue(movie, ["imagePoster", "posterUrl", "imageUrl", "poster"]),
  );
  const bannerUrl = getMediaUrl(
    getStringValue(movie, ["imageBanner", "bannerUrl"]),
  );
  const isHot = movie.isHot === true || movie.highlight === true;

  return {
    movieId,
    title,
    genre: getGenreValue(movie),
    duration: durationValue ? `${durationValue} phút` : "Đang cập nhật",
    director: getStringValue(movie, ["director", "Director"]) || "Đang cập nhật",
    posterUrl,
    bannerUrl: bannerUrl || undefined,
    ageRating: getStringValue(movie, ["ageRating", "rating", "rated"]) || "P",
    highlight: isHot ? "HOT" : undefined,
    movieStatus: getStringValue(movie, ["movieStatus", "status"]) || "NOW_SHOWING",
  };
};

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [slideIndex, setSlideIndex] = useState(1);
  const [withTransition, setWithTransition] = useState(true);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [customBanners, setCustomBanners] = useState<BannerResponse[]>([]);
  const [showtimes, setShowtimes] = useState<ShowtimeResponse[]>([]);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [movieError, setMovieError] = useState("");
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [selectedCinemaId, setSelectedCinemaId] = useState(() =>
    readSelectedCinemaId(),
  );
  const [selectedShowtimeMovie, setSelectedShowtimeMovie] =
    useState<Movie | null>(null);

  const [activeTab, setActiveTab] = useState<"NOW_SHOWING" | "COMING_SOON" | "SPECIAL">("NOW_SHOWING");
  const [pageIndex, setPageIndex] = useState(1);
  const pageSize = 10;

  const filteredMovies = useMemo(() => {
    return movies.filter((movie) => {
      if (activeTab === "NOW_SHOWING") {
        return movie.movieStatus === "NOW_SHOWING";
      }
      if (activeTab === "COMING_SOON") {
        return movie.movieStatus === "COMING_SOON";
      }
      if (activeTab === "SPECIAL") {
        return !!movie.highlight;
      }
      return true;
    });
  }, [movies, activeTab]);

  const totalPages = Math.ceil(filteredMovies.length / pageSize);

  const paginatedMovies = useMemo(() => {
    const start = (pageIndex - 1) * pageSize;
    return filteredMovies.slice(start, start + pageSize);
  }, [filteredMovies, pageIndex, pageSize]);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (pageIndex > 3) {
        pages.push("...");
      }
      const start = Math.max(2, pageIndex - 1);
      const end = Math.min(totalPages - 1, pageIndex + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (pageIndex < totalPages - 2) {
        pages.push("...");
      }
      pages.push(totalPages);
    }
    return pages;
  };

  // Tải danh sách phim và lịch chiếu để chỉ hiện nút mua vé khi phim có suất chiếu còn bán.
  useEffect(() => {
    const fetchMoviesAndShowtimes = async () => {
      try {
        setLoadingMovies(true);
        setMovieError("");

        const [moviesResponse, showtimesResponse, activeBanners] = await Promise.all([
          movieService.getActiveMovies(),
          showtimeService.getShowtimes(),
          bannerService.getActiveBanners().catch(() => []),
        ]);

        const moviesData = extractMovieList(moviesResponse);
        setMovies(moviesData.map(mapApiMovieToCard));
        setShowtimes(showtimesResponse);
        setCustomBanners(activeBanners);
      } catch (error) {
        console.error("Lỗi lấy danh sách phim hoặc banner:", error);
        setMovies([]);
        setShowtimes([]);
        setCustomBanners([]);
        setMovieError("Không tải được danh sách phim từ hệ thống.");
      } finally {
        setLoadingMovies(false);
      }
    };

    void fetchMoviesAndShowtimes();
  }, []);

  // Tự refresh điều kiện hiện nút mua vé khi suất chiếu gần nhất vừa quá giờ.
  useEffect(() => {
    const timerId = window.setInterval(
      () => setCurrentTimeMs(Date.now()),
      BUY_TICKET_VISIBILITY_REFRESH_MS,
    );

    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    const syncSelectedCinema = () => {
      setSelectedCinemaId(readSelectedCinemaId());
      setPageIndex(1);
    };

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

  // Save scroll position when user scrolls the Home page
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem("home-scroll-y", String(window.scrollY));
    };
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Restore scroll position after movie cards have been loaded and rendered
  useEffect(() => {
    if (!loadingMovies) {
      const savedScrollY = sessionStorage.getItem("home-scroll-y");
      if (savedScrollY) {
        const timer = setTimeout(() => {
          window.scrollTo({
            top: parseInt(savedScrollY, 10),
            behavior: "instant" as ScrollBehavior,
          });
        }, 80);
        return () => clearTimeout(timer);
      }
    }
  }, [loadingMovies]);

  const activeHeroSlides = useMemo<HeroSlide[]>(() => {
    // 1. Chuyển đổi các banner sự kiện/bắp nước của rạp từ DB
    const customSlides: HeroSlide[] = customBanners.map(b => ({
      id: `custom-slide-${b.bannerId}`,
      imageUrl: b.imageUrl,
      alt: b.title,
      linkUrl: b.linkUrl,
    }));

    // 2. Chuyển đổi các banner phim tự động đang chiếu
    const nowShowingWithBanner = movies.filter(
      (m) => m.movieStatus === "NOW_SHOWING" && m.bannerUrl && m.bannerUrl !== "none"
    );
    const movieSlides: HeroSlide[] = nowShowingWithBanner.map((m) => ({
      id: `slide-${m.movieId}`,
      imageUrl: m.bannerUrl!,
      alt: m.title,
      movieId: m.movieId,
    }));

    // 3. Gộp cả hai loại banner
    const combined = [...customSlides, ...movieSlides];

    if (combined.length > 0) {
      return combined;
    }

    // Nếu không có bất cứ banner nào, fallback về mockHeroSlides cũ
    return mockHeroSlides;
  }, [movies, customBanners]);

  const lastRealSlideIndex = activeHeroSlides.length;
  const clonedFirstSlideIndex = lastRealSlideIndex + 1;

  const getRealSlideIndexDynamic = useCallback((index: number) => {
    if (lastRealSlideIndex === 0) return 0;
    return ((((index - 1) % lastRealSlideIndex) + lastRealSlideIndex) % lastRealSlideIndex) + 1;
  }, [lastRealSlideIndex]);

  const carouselSlides = useMemo(() => {
    if (activeHeroSlides.length === 0) return [];
    const lastSlide = activeHeroSlides[activeHeroSlides.length - 1];
    const firstSlide = activeHeroSlides[0];

    return [lastSlide, ...activeHeroSlides, firstSlide];
  }, [activeHeroSlides]);

  const safeSlideIndex =
    slideIndex < 0 || slideIndex > clonedFirstSlideIndex
      ? getRealSlideIndexDynamic(slideIndex)
      : slideIndex;
  const activeSlideIndex = getRealSlideIndexDynamic(slideIndex) - 1;

  useEffect(() => {
    if (lastRealSlideIndex === 0) return;
    const timer = window.setInterval(() => {
      setSlideIndex((currentIndex) => getRealSlideIndexDynamic(currentIndex) + 1);
    }, AUTO_PLAY_MS);

    return () => window.clearInterval(timer);
  }, [lastRealSlideIndex, getRealSlideIndexDynamic]);

  useEffect(() => {
    if (lastRealSlideIndex === 0) return;
    if (slideIndex >= 0 && slideIndex <= clonedFirstSlideIndex) {
      return;
    }

    const resetTimer = window.setTimeout(() => {
      setWithTransition(false);
      setSlideIndex(getRealSlideIndexDynamic(slideIndex));
    }, 0);

    return () => window.clearTimeout(resetTimer);
  }, [slideIndex, lastRealSlideIndex, clonedFirstSlideIndex, getRealSlideIndexDynamic]);

  useEffect(() => {
    if (lastRealSlideIndex === 0) return;
    if (slideIndex !== 0 && slideIndex !== clonedFirstSlideIndex) {
      return;
    }

    const fallbackTimer = window.setTimeout(() => {
      setWithTransition(false);
      setSlideIndex(
        slideIndex === 0 ? lastRealSlideIndex : 1,
      );
    }, SLIDE_TRANSITION_MS + 50);

    return () => window.clearTimeout(fallbackTimer);
  }, [slideIndex, lastRealSlideIndex, clonedFirstSlideIndex]);

  useEffect(() => {
    if (withTransition) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setWithTransition(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [withTransition]);

  const goToPreviousSlide = () => {
    setSlideIndex((currentIndex) => getRealSlideIndexDynamic(currentIndex) - 1);
  };

  const goToNextSlide = () => {
    setSlideIndex((currentIndex) => getRealSlideIndexDynamic(currentIndex) + 1);
  };

  const goToSlide = (nextSlideIndex: number) => {
    setSlideIndex(nextSlideIndex + 1);
  };

  const handleBuyTicket = (movie: Movie) => {
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

  const handleSlideTransitionEnd = () => {
    if (slideIndex === clonedFirstSlideIndex) {
      setWithTransition(false);
      setSlideIndex(1);
      return;
    }

    if (slideIndex === 0) {
      setWithTransition(false);
      setSlideIndex(lastRealSlideIndex);
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-[#182437] text-slate-900 dark:text-white transition-colors duration-300">
      <section
        className="relative overflow-hidden bg-black"
        aria-label="Movie banners"
      >
        <div className="relative h-[220px] sm:h-[330px] lg:h-[520px] xl:h-[620px]">
          <div
            className="flex h-full"
            onTransitionEnd={handleSlideTransitionEnd}
            style={{
              transform: `translateX(-${safeSlideIndex * 100}%)`,
              transition: withTransition
                ? `transform ${SLIDE_TRANSITION_MS}ms ease-in-out`
                : "none",
            }}
          >
            {carouselSlides.map((slide, index) => {
              const isClickable = !!(slide.movieId || slide.linkUrl);
              return (
                <div
                  className={`h-full min-w-full relative overflow-hidden ${isClickable ? "cursor-pointer" : ""}`}
                  key={`${slide.id}-${index}`}
                  onClick={() => {
                    if (slide.movieId) {
                      navigate(`/movie/${slide.movieId}/showtimes`);
                    } else if (slide.linkUrl) {
                      if (slide.linkUrl.startsWith("http")) {
                        window.open(slide.linkUrl, "_blank");
                      } else {
                        navigate(slide.linkUrl);
                      }
                    }
                  }}
                >
                  {/* Backdrop blur image to fill empty areas beautifully */}
                  <img
                    src={getMediaUrl(slide.imageUrl)}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover object-center blur-2xl scale-110 opacity-60 select-none pointer-events-none"
                    draggable={false}
                  />
                  {/* Crisp content image fitted perfectly inside the banner frame */}
                  <img
                    src={getMediaUrl(slide.imageUrl)}
                    alt={slide.alt}
                    className="relative z-10 h-full w-full object-contain object-center"
                    draggable={false}
                  />
                </div>
              );
            })}
          </div>

          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black/45 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black/45 to-transparent" />

          <button
            type="button"
            aria-label="Previous slide"
            onClick={goToPreviousSlide}
            className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-white/75 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70 sm:left-7 sm:h-12 sm:w-12"
          >
            <FiChevronLeft
              className="h-9 w-9 sm:h-11 sm:w-11"
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            aria-label="Next slide"
            onClick={goToNextSlide}
            className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-white/75 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70 sm:right-7 sm:h-12 sm:w-12"
          >
            <FiChevronRight
              className="h-9 w-9 sm:h-11 sm:w-11"
              aria-hidden="true"
            />
          </button>

          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
            {activeHeroSlides.map((slide, index) => (
              <button
                type="button"
                key={slide.id}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={activeSlideIndex === index}
                onClick={() => goToSlide(index)}
                className={`h-3 w-3 rounded-full border border-white/80 transition ${activeSlideIndex === index
                  ? "bg-white"
                  : "bg-transparent hover:bg-white/50"
                  }`}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="movies-section" className="bg-slate-50 dark:bg-[#182437] px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-10 transition-colors duration-300">
        <div className="mx-auto max-w-[1360px] w-full">
          <div className="mb-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-base font-extrabold uppercase text-slate-800 dark:text-white sm:text-xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab("COMING_SOON");
                setPageIndex(1);
              }}
              className={`transition hover:text-[#FFD166] ${
                activeTab === "COMING_SOON"
                  ? "border-b-2 border-[#FFD166] pb-1 text-[#FFD166]"
                  : "text-slate-500 dark:text-white/60"
              }`}
            >
              Phim sắp chiếu
            </button>
            <span className="text-slate-400 dark:text-white/80">|</span>
            <button
              type="button"
              onClick={() => {
                setActiveTab("NOW_SHOWING");
                setPageIndex(1);
              }}
              className={`transition hover:text-[#FFD166] ${
                activeTab === "NOW_SHOWING"
                  ? "border-b-2 border-[#FFD166] pb-1 text-[#FFD166]"
                  : "text-slate-500 dark:text-white/60"
              }`}
            >
              Phim đang chiếu
            </button>
            <span className="text-slate-400 dark:text-white/80">|</span>
            <button
              type="button"
              onClick={() => {
                setActiveTab("SPECIAL");
                setPageIndex(1);
              }}
              className={`transition hover:text-[#FFD166] ${
                activeTab === "SPECIAL"
                  ? "border-b-2 border-[#FFD166] pb-1 text-[#FFD166]"
                  : "text-slate-500 dark:text-white/60"
              }`}
            >
              Suất chiếu đặc biệt
            </button>
          </div>

          {/* DANH SÁCH BỐ CỤC PHÂN CHIA RIÊNG BIỆT */}
          {loadingMovies ? (
            <div className="col-span-full text-center text-white py-20 animate-pulse font-bold">
              Đang tải danh sách phim...
            </div>
          ) : movieError ? (
            <div className="col-span-full rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-10 text-center text-sm font-semibold text-red-100">
              {movieError}
            </div>
          ) : paginatedMovies.length === 0 ? (
            <div className="col-span-full text-center text-gray-400 py-20 font-bold">
              Hiện chưa có phim nào trong danh mục này.
            </div>
          ) : (
            <>
              {/* DESKTOP VIEW (5 cột cân bằng 5-5, chiều rộng rộng hơn để không trống trải) */}
              <div className="hidden lg:grid lg:grid-cols-5 gap-x-6 gap-y-10">
                {paginatedMovies.map((movie, index) => (
                  <article
                    key={`desktop-${movie.movieId || index}`}
                    className="movie-card flex min-w-0 flex-col justify-between h-full rounded-xl border border-slate-200 dark:border-transparent p-3 hover:bg-slate-100 dark:hover:bg-[#1E2E4A]/40 transition-all duration-300 bg-white dark:bg-[#182437]/50 shadow-sm dark:shadow-none"
                  >
                    <div className="flex flex-col gap-3">
                      <div
                        onClick={() => navigate(`/movie/${movie.movieId}/showtimes`)}
                        className="relative aspect-[2/3] overflow-hidden rounded-lg bg-[#0F172A] shadow-lg shadow-black/30 cursor-pointer hover:opacity-90 hover:scale-[1.02] transition-all duration-300"
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
                          <div className="flex h-full w-full items-center justify-center bg-[#111827] px-5 text-center text-sm font-bold uppercase tracking-wide text-white/45">
                            Chưa có poster
                          </div>
                        )}

                        <div className="absolute left-2 top-2 rounded bg-white/90 px-2 py-1 text-[10px] font-extrabold leading-none text-[#8A8F98]">
                          {movie.ageRating}
                        </div>

                        {movie.highlight ? (
                          <div className="absolute right-0 top-0 rounded-bl bg-[#7C4DFF] px-2.5 py-2 text-[10px] font-extrabold leading-none text-white">
                            {movie.highlight}
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <h3
                          className="text-[15px] font-bold leading-5 text-slate-800 dark:text-white line-clamp-2 min-h-[40px] hover:text-[#FFD166] dark:hover:text-[#FFD166] cursor-pointer transition-colors"
                          onClick={() => navigate(`/movie/${movie.movieId}/showtimes`)}
                        >
                          {movie.title}
                        </h3>
                        <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-white/70">
                          <p className="truncate">
                            Đạo diễn: <span className="text-slate-800 dark:text-white font-medium">{movie.director}</span>
                          </p>
                          <p className="truncate">
                            Thể loại: <span className="text-slate-800 dark:text-white font-medium">{movie.genre}</span>
                          </p>
                          <p className="truncate">
                            Thời lượng: <span className="text-slate-800 dark:text-white font-medium">{movie.duration}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {movie.movieId && bookableMovieIds.has(String(movie.movieId)) ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBuyTicket(movie);
                        }}
                        className="mt-5 h-10 w-full rounded-md bg-gradient-to-r from-[#FFD166] to-[#FFE7A3] text-xs font-extrabold uppercase text-black transition hover:brightness-105 shadow-md active:scale-95"
                      >
                        Mua vé
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>

              {/* MOBILE VIEW (2 cột cân bằng 2-2-2-2-2, không bao giờ lẻ loi) */}
              <div className="grid grid-cols-2 lg:hidden gap-x-4 gap-y-8">
                {paginatedMovies.map((movie, index) => (
                  <article
                    key={`mobile-${movie.movieId || index}`}
                    className="movie-card flex min-w-0 flex-col justify-between h-full rounded-lg border border-slate-200 dark:border-transparent p-2 hover:bg-slate-100 dark:hover:bg-[#1E2E4A]/30 transition-all duration-300 bg-white dark:bg-[#182437]/50 shadow-sm dark:shadow-none"
                  >
                    <div className="flex flex-col gap-2">
                      <div
                        onClick={() => navigate(`/movie/${movie.movieId}/showtimes`)}
                        className="relative aspect-[2/3] overflow-hidden rounded-lg bg-[#0F172A] shadow-md shadow-black/20 cursor-pointer active:opacity-80 transition-all"
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
                          <div className="flex h-full w-full items-center justify-center bg-[#111827] px-3 text-center text-xs font-bold uppercase tracking-wide text-white/45">
                            Chưa có poster
                          </div>
                        )}

                        <div className="absolute left-1.5 top-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-[#8A8F98]">
                          {movie.ageRating}
                        </div>

                        {movie.highlight ? (
                          <div className="absolute right-0 top-0 rounded-bl bg-[#7C4DFF] px-2 py-1.5 text-[9px] font-extrabold leading-none text-white">
                            {movie.highlight}
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <h3
                          className="text-sm font-bold leading-4 text-slate-800 dark:text-white line-clamp-2 min-h-[32px] hover:text-[#FFD166] dark:hover:text-[#FFD166] cursor-pointer transition-colors"
                          onClick={() => navigate(`/movie/${movie.movieId}/showtimes`)}
                        >
                          {movie.title}
                        </h3>
                        <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-500 dark:text-white/60">
                          <p className="truncate">
                            Đạo diễn: <span className="text-slate-700 dark:text-white/80">{movie.director}</span>
                          </p>
                          <p className="truncate">
                            Thể loại: <span className="text-slate-700 dark:text-white/80">{movie.genre}</span>
                          </p>
                          <p className="truncate">
                            Thời lượng: <span className="text-slate-700 dark:text-white/80">{movie.duration}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {movie.movieId && bookableMovieIds.has(String(movie.movieId)) ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBuyTicket(movie);
                        }}
                        className="mt-4 h-9 w-full rounded bg-gradient-to-r from-[#FFD166] to-[#FFE7A3] text-[11px] font-extrabold uppercase text-black transition active:scale-95"
                      >
                        Mua vé
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            </>
          )}

          {totalPages > 1 && (
            <div className="mt-10 flex flex-wrap justify-center items-center gap-2">
              <button
                type="button"
                disabled={pageIndex === 1}
                onClick={() => {
                  setPageIndex((prev) => prev - 1);
                  const element = document.getElementById("movies-section");
                  if (element) {
                    element.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 dark:bg-[#24334C] text-slate-800 dark:text-white transition hover:bg-slate-300 dark:hover:bg-[#2D3F5E] disabled:opacity-40 disabled:hover:bg-slate-200 dark:disabled:hover:bg-[#24334C]"
                aria-label="Trang trước"
              >
                <FiChevronLeft className="h-5 w-5" />
              </button>
              
              {getPageNumbers().map((page, index) => {
                if (page === "...") {
                  return (
                    <span
                      key={`ellipsis-${index}`}
                      className="flex h-10 w-10 items-center justify-center font-bold text-slate-400 dark:text-white/50"
                    >
                      ...
                    </span>
                  );
                }
                
                const isCurrent = page === pageIndex;
                return (
                  <button
                    key={`page-${page}`}
                    type="button"
                    onClick={() => {
                      setPageIndex(Number(page));
                      const element = document.getElementById("movies-section");
                      if (element) {
                        element.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                    className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-sm transition-all duration-200 ${
                      isCurrent
                        ? "bg-[#FFD166] text-black shadow-md shadow-[#FFD166]/20 scale-105"
                        : "bg-slate-200 dark:bg-[#24334C] text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-[#2D3F5E] hover:scale-105"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={pageIndex === totalPages}
                onClick={() => {
                  setPageIndex((prev) => prev + 1);
                  const element = document.getElementById("movies-section");
                  if (element) {
                    element.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 dark:bg-[#24334C] text-slate-800 dark:text-white transition hover:bg-slate-300 dark:hover:bg-[#2D3F5E] disabled:opacity-40 disabled:hover:bg-slate-200 dark:disabled:hover:bg-[#24334C]"
                aria-label="Trang sau"
              >
                <FiChevronRight className="h-5 w-5" />
              </button>
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
