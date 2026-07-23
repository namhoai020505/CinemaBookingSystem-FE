import { type TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaStar } from "react-icons/fa";
import {
  FiChevronLeft,
  FiChevronRight,
  FiFilm,
  FiMapPin,
  FiPhone,
  FiSearch,
} from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import cinemaThumbnail from "../../assets/thumbnail-1-144816-050424-68.jpeg";
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
  writeSelectedCinemaId,
} from "../../lib/cinemaSelection";
import { getMediaUrl } from "../../lib/media";
import { movieService } from "../../services/movieService";
import { bannerService } from "../../services/bannerService";
import type { BannerResponse } from "../../services/bannerService";
import {
  showtimeService,
  type CinemaResponse,
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
  avgRating: number;
  viewCount: number;
  highlight?: string;
  movieStatus?: string;
};

type MovieApiItem = Record<string, unknown>;

type MobileSearchFilter = "title" | "genre" | "director";

const mobileSearchFilterOptions: Array<{
  value: MobileSearchFilter;
  label: string;
}> = [
  { value: "title", label: "Tên phim" },
  { value: "genre", label: "Thể loại" },
  { value: "director", label: "Đạo diễn" },
];

const AUTO_PLAY_MS = 4500;
const SLIDE_TRANSITION_MS = 700;
const BUY_TICKET_VISIBILITY_REFRESH_MS = 30_000;
const INVALID_BANNER_VALUES = new Set(["none", "null", "undefined"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const hasValidBannerValue = (value?: string | null) => {
  const trimmed = value?.trim();
  return !!trimmed && !INVALID_BANNER_VALUES.has(trimmed.toLowerCase());
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();

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

const formatCompactCount = (value: number) => {
  if (value >= 1000) {
    return `${new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 1,
    }).format(value / 1000)}K`;
  }

  return new Intl.NumberFormat("vi-VN").format(value);
};

const formatRatingText = (movie: Movie) => {
  if (movie.avgRating > 0) {
    const rating = new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 1,
    }).format(movie.avgRating);

    return movie.viewCount > 0
      ? `${rating}/10 (${formatCompactCount(movie.viewCount)} lượt xem)`
      : `${rating}/10`;
  }

  return "Chưa có đánh giá";
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
  const rawBannerUrl = getStringValue(movie, ["imageBanner", "bannerUrl"]);
  const bannerUrl = hasValidBannerValue(rawBannerUrl)
    ? getMediaUrl(rawBannerUrl)
    : "";
  const isHot = movie.isHot === true || movie.highlight === true;
  const avgRating = Number(movie.avgRating ?? movie.rating ?? 0);
  const viewCount = Number(movie.viewCount ?? 0);

  return {
    movieId,
    title,
    genre: getGenreValue(movie),
    duration: durationValue ? `${durationValue} phút` : "Đang cập nhật",
    director: getStringValue(movie, ["director", "Director"]) || "Đang cập nhật",
    posterUrl,
    bannerUrl: bannerUrl || undefined,
    ageRating: getStringValue(movie, ["ageRating", "rating", "rated"]) || "P",
    avgRating: Number.isFinite(avgRating) ? avgRating : 0,
    viewCount: Number.isFinite(viewCount) ? viewCount : 0,
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
  const [activeCinemas, setActiveCinemas] = useState<CinemaResponse[]>([]);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [movieError, setMovieError] = useState("");
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [selectedCinemaId, setSelectedCinemaId] = useState(() =>
    readSelectedCinemaId(),
  );
  const [selectedShowtimeMovie, setSelectedShowtimeMovie] =
    useState<Movie | null>(null);
  const [mobileFeaturedIndex, setMobileFeaturedIndex] = useState(0);
  const [mobileFeaturedDragOffset, setMobileFeaturedDragOffset] = useState(0);
  const [isMobileFeaturedDragging, setIsMobileFeaturedDragging] = useState(false);
  const [mobileSearchTerm, setMobileSearchTerm] = useState("");
  const [mobileSearchFilter, setMobileSearchFilter] =
    useState<MobileSearchFilter>("title");
  const mobileTouchStartXRef = useRef<number | null>(null);
  const mobileTouchDeltaXRef = useRef(0);

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

        const [moviesResponse, showtimesResponse, activeBanners, cinemaItems] = await Promise.all([
          movieService.getActiveMovies(),
          showtimeService.getShowtimes(),
          bannerService.getActiveBanners().catch(() => []),
          showtimeService.getCinemas().catch(() => []),
        ]);

        const moviesData = extractMovieList(moviesResponse);
        setMovies(moviesData.map(mapApiMovieToCard));
        setShowtimes(showtimesResponse);
        setCustomBanners(activeBanners);
        setActiveCinemas(
          cinemaItems.filter(
            (cinema) => cinema.cinemaStatus?.toUpperCase() === "ACTIVE",
          ),
        );
      } catch (error) {
        console.error("Lỗi lấy danh sách phim hoặc banner:", error);
        setMovies([]);
        setShowtimes([]);
        setCustomBanners([]);
        setActiveCinemas([]);
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

  const selectedCinema = useMemo(
    () =>
      activeCinemas.find((cinema) => cinema.cinemaId === selectedCinemaId) ||
      activeCinemas[0],
    [activeCinemas, selectedCinemaId],
  );

  const mobileCinemaItems = useMemo(
    () =>
      [...activeCinemas]
        .sort((left, right) => {
          if (left.cinemaId === selectedCinema?.cinemaId) {
            return -1;
          }

          if (right.cinemaId === selectedCinema?.cinemaId) {
            return 1;
          }

          return left.cinemaName.localeCompare(right.cinemaName, "vi");
        })
        .slice(0, 3),
    [activeCinemas, selectedCinema?.cinemaId],
  );

  const getCinemaAddress = (cinema: CinemaResponse) =>
    [cinema.address, cinema.city].filter(Boolean).join(" - ") ||
    "Địa chỉ đang cập nhật";

  const handleSelectHomeCinema = (cinema: CinemaResponse) => {
    setSelectedCinemaId(cinema.cinemaId);
    writeSelectedCinemaId(cinema.cinemaId);
    setPageIndex(1);
  };

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

  const mobileSearchFilterLabel =
    mobileSearchFilterOptions.find(
      (option) => option.value === mobileSearchFilter,
    )?.label || "Tên phim";

  const mobileNowShowingMovies = useMemo(() => {
    const normalizedSearchTerm = normalizeText(mobileSearchTerm);

    return movies
      .filter((movie) => movie.movieStatus === "NOW_SHOWING")
      .filter((movie) => {
        if (!normalizedSearchTerm) {
          return true;
        }

        const searchableValue =
          mobileSearchFilter === "director"
            ? movie.director || ""
            : mobileSearchFilter === "genre"
              ? movie.genre
              : movie.title;

        return normalizeText(searchableValue).includes(normalizedSearchTerm);
      })
      .slice(0, 12);
  }, [mobileSearchFilter, mobileSearchTerm, movies]);

  const mobileFeaturedMovies = useMemo(() => {
    const highlightedMovies = mobileNowShowingMovies.filter(
      (movie) => movie.highlight || bookableMovieIds.has(String(movie.movieId)),
    );

    return (highlightedMovies.length > 0
      ? highlightedMovies
      : mobileNowShowingMovies
    ).slice(0, 8);
  }, [bookableMovieIds, mobileNowShowingMovies]);

  const normalizedMobileFeaturedIndex =
    mobileFeaturedMovies.length > 0
      ? mobileFeaturedIndex % mobileFeaturedMovies.length
      : 0;
  const activeMobileFeaturedMovie =
    mobileFeaturedMovies.length > 0
      ? mobileFeaturedMovies[normalizedMobileFeaturedIndex]
      : null;

  const goToMobileFeaturedSlide = useCallback(
    (direction: -1 | 1) => {
      if (mobileFeaturedMovies.length <= 1) {
        return;
      }

      setMobileFeaturedIndex((currentIndex) => {
        const nextIndex = currentIndex + direction;
        return (
          (nextIndex % mobileFeaturedMovies.length) +
          mobileFeaturedMovies.length
        ) % mobileFeaturedMovies.length;
      });
    },
    [mobileFeaturedMovies.length],
  );

  const handleMobileFeaturedTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    mobileTouchStartXRef.current = event.touches[0]?.clientX ?? null;
    mobileTouchDeltaXRef.current = 0;
    setIsMobileFeaturedDragging(true);
  };

  const handleMobileFeaturedTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (mobileTouchStartXRef.current === null) {
      return;
    }

    mobileTouchDeltaXRef.current =
      event.touches[0].clientX - mobileTouchStartXRef.current;
    setMobileFeaturedDragOffset(
      Math.max(-0.95, Math.min(0.95, mobileTouchDeltaXRef.current / 230)),
    );
  };

  const handleMobileFeaturedTouchEnd = () => {
    const swipeDistance = mobileTouchDeltaXRef.current;
    mobileTouchStartXRef.current = null;
    mobileTouchDeltaXRef.current = 0;
    setIsMobileFeaturedDragging(false);
    setMobileFeaturedDragOffset(0);

    if (Math.abs(swipeDistance) < 44) {
      return;
    }

    goToMobileFeaturedSlide(swipeDistance > 0 ? -1 : 1);
  };

  const getMobileFeaturedOffsetForIndex = useCallback(
    (index: number) => {
      const totalMovies = mobileFeaturedMovies.length;

      if (totalMovies === 0) {
        return 0;
      }

      let offset = index - normalizedMobileFeaturedIndex;
      const halfLength = totalMovies / 2;

      if (offset > halfLength) {
        offset -= totalMovies;
      }

      if (offset < -halfLength) {
        offset += totalMovies;
      }

      return offset;
    },
    [mobileFeaturedMovies.length, normalizedMobileFeaturedIndex],
  );

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
    const customSlides: HeroSlide[] = customBanners
      .filter((banner) => hasValidBannerValue(banner.imageUrl))
      .map((banner) => ({
        id: `custom-slide-${banner.bannerId}`,
        imageUrl: banner.imageUrl.trim(),
        alt: banner.title,
        linkUrl: banner.linkUrl,
      }));

    // 2. Chuyển đổi các banner phim tự động đang chiếu
    const nowShowingWithBanner = movies.filter(
      (movie) =>
        movie.movieStatus === "NOW_SHOWING" &&
        hasValidBannerValue(movie.bannerUrl)
    );
    const movieSlides: HeroSlide[] = nowShowingWithBanner.map((m) => ({
      id: `slide-${m.movieId}`,
      imageUrl: m.bannerUrl!,
      alt: m.title,
      movieId: m.movieId,
    }));

    // 3. Gộp cả hai loại banner
    return [...customSlides, ...movieSlides];
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
    <div className="text-slate-900 dark:text-white transition-colors duration-300">
      <section className="bg-white px-4 pb-8 pt-4 text-slate-950 dark:bg-black dark:text-white md:hidden">
        <div className="mb-6 rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-[0_16px_35px_rgba(15,23,42,0.08)] dark:border-white/10 dark:from-[#0F172A] dark:to-[#1E293B]">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#E11D48] dark:text-[#FFD166]">
            G2Cinema
          </p>
          <h1 className="mt-1 text-[30px] font-black leading-[1.05] tracking-normal">
            Mua vé xem phim
          </h1>
          <p className="mt-2 text-sm font-semibold leading-5 text-slate-500 dark:text-white/60">
            Chọn phim, xem lịch chiếu và đặt ghế tại rạp bạn yêu thích.
          </p>

          <button
            type="button"
            onClick={() => navigate("/movies")}
            className="mt-4 flex min-h-12 w-full cursor-pointer items-center justify-between rounded-2xl border border-[#FFD166]/45 bg-[#FFD166] px-4 text-sm font-black text-slate-950 shadow-lg shadow-[#FFD166]/20 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166]"
          >
            <span className="inline-flex items-center gap-2">
              <FiFilm size={18} aria-hidden="true" />
              Xem trang phim
            </span>
            <FiChevronRight size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="mb-6 rounded-[24px] border border-slate-200 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.07)] dark:border-white/10 dark:bg-[#0F172A]/70">
          <label htmlFor="mobile-home-search" className="sr-only">
            Tìm kiếm phim
          </label>
          <div className="relative">
            <FiSearch
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-white/45"
              aria-hidden="true"
            />
            <input
              id="mobile-home-search"
              type="search"
              value={mobileSearchTerm}
              onChange={(event) => {
                setMobileSearchTerm(event.target.value);
                setMobileFeaturedIndex(0);
              }}
              placeholder={`Tìm theo ${mobileSearchFilterLabel.toLowerCase()}`}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-base font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#FFD166] focus:bg-white focus:ring-2 focus:ring-[#FFD166]/35 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-white/40 dark:focus:bg-white/[0.14]"
            />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {mobileSearchFilterOptions.map((option) => {
              const isSelected = mobileSearchFilter === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setMobileSearchFilter(option.value);
                    setMobileFeaturedIndex(0);
                  }}
                  className={`min-h-11 cursor-pointer rounded-2xl border px-2 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] ${
                    isSelected
                      ? "border-[#FFD166] bg-[#FFD166] text-slate-950 shadow-sm"
                      : "border-slate-200 bg-slate-50 text-slate-600 active:bg-slate-100 dark:border-white/10 dark:bg-white/10 dark:text-white/65 dark:active:bg-white/15"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {loadingMovies ? (
          <div className="space-y-4">
            <div className="h-8 w-40 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
            <div className="-mx-4 flex gap-5 overflow-hidden px-[18vw] pb-5">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-[330px] w-[64vw] min-w-[220px] max-w-[270px] shrink-0 animate-pulse rounded-3xl bg-slate-200 dark:bg-white/10"
                />
              ))}
            </div>
          </div>
        ) : movieError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-8 text-center text-sm font-bold text-red-700 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-100">
            {movieError}
          </div>
        ) : mobileFeaturedMovies.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-bold text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/55">
            Không có phim phù hợp với tìm kiếm hiện tại.
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-[26px] font-black leading-tight">
                Phim nổi bật
              </h2>
              <span className="text-xs font-bold text-slate-400 dark:text-white/45">
                Vuốt để xem
              </span>
            </div>

            <div
              className="-mx-4 overflow-hidden pb-2"
              onTouchStart={handleMobileFeaturedTouchStart}
              onTouchMove={handleMobileFeaturedTouchMove}
              onTouchEnd={handleMobileFeaturedTouchEnd}
            >
              <div className="relative mx-auto h-[365px] max-w-[430px] touch-pan-y select-none">
                {mobileFeaturedMovies.map((movie, index) => {
                  const relativeOffset = getMobileFeaturedOffsetForIndex(index);
                  const visualOffset =
                    relativeOffset + mobileFeaturedDragOffset;
                  const distance = Math.abs(visualOffset);
                  const isActive = index === normalizedMobileFeaturedIndex;
                  const isVisible = distance <= 1.55;
                  const scale = Math.max(0.68, 1 - Math.min(distance, 1.35) * 0.18);
                  const opacity = isVisible
                    ? Math.max(0.35, 1 - Math.min(distance, 1.6) * 0.27)
                    : 0;
                  const translatePercent = visualOffset * 78;

                  return (
                    <button
                      key={`coverflow-${movie.movieId}`}
                      type="button"
                      onClick={() => {
                        if (isActive) {
                          navigate(`/movie/${movie.movieId}/showtimes`);
                          return;
                        }

                        setMobileFeaturedIndex(index);
                      }}
                      className="absolute left-1/2 top-0 w-[72vw] max-w-[280px] cursor-pointer overflow-hidden rounded-[26px] bg-slate-900 text-left shadow-[0_18px_42px_rgba(15,23,42,0.24)] transition-[transform,opacity,filter] duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] motion-reduce:transition-none"
                      style={{
                        filter: isActive
                          ? "none"
                          : "saturate(0.84) brightness(0.9)",
                        opacity,
                        pointerEvents: isVisible ? "auto" : "none",
                        transform: `translateX(calc(-50% + ${translatePercent}%)) scale(${scale})`,
                        transition: isMobileFeaturedDragging
                          ? "none"
                          : undefined,
                        zIndex: Math.max(1, 30 - Math.round(distance * 10)),
                      }}
                      aria-label={
                        isActive
                          ? `Xem thông tin ${movie.title}`
                          : `Chuyển tới ${movie.title}`
                      }
                    >
                      {movie.posterUrl ? (
                        <img
                          src={movie.posterUrl}
                          alt={movie.title}
                          className="aspect-[3/4] w-full object-cover"
                          loading="lazy"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex aspect-[3/4] w-full items-center justify-center px-5 text-center text-sm font-black uppercase tracking-wide text-white/45">
                          Chưa có poster
                        </div>
                      )}

                      <span className="absolute left-3 top-3 rounded-full bg-[#FFD166] px-3 py-1.5 text-xs font-black text-slate-950 shadow-lg">
                        {movie.ageRating}
                      </span>
                      {movie.highlight ? (
                        <span className="absolute right-3 top-3 rounded-full bg-[#E11D48] px-3 py-1.5 text-[11px] font-black text-white shadow-lg">
                          {movie.highlight}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {activeMobileFeaturedMovie ? (
                <div className="mx-auto -mt-1 max-w-[320px] text-center">
                  <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-slate-500 dark:text-white/60">
                    <FaStar className="text-[#F97316]" size={14} aria-hidden="true" />
                    {formatRatingText(activeMobileFeaturedMovie)}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/movie/${activeMobileFeaturedMovie.movieId}/showtimes`,
                      )
                    }
                    className="mt-1 line-clamp-2 min-h-[58px] w-full cursor-pointer text-center text-[24px] font-black leading-tight transition hover:text-[#E11D48] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] dark:hover:text-[#FFD166]"
                  >
                    {activeMobileFeaturedMovie.title}
                  </button>
                  <p className="line-clamp-1 text-base font-semibold text-slate-500 dark:text-white/55">
                    {activeMobileFeaturedMovie.genre}
                  </p>
                </div>
              ) : null}

              {mobileFeaturedMovies.length > 1 ? (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => goToMobileFeaturedSlide(-1)}
                    aria-label="Phim nổi bật trước"
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] dark:border-white/10 dark:bg-white/10 dark:text-white"
                  >
                    <FiChevronLeft size={20} aria-hidden="true" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    {mobileFeaturedMovies.map((movie, index) => (
                      <button
                        key={`featured-dot-${movie.movieId}`}
                        type="button"
                        aria-label={`Chọn phim nổi bật ${index + 1}`}
                        aria-current={normalizedMobileFeaturedIndex === index}
                        onClick={() => setMobileFeaturedIndex(index)}
                        className={`h-2 rounded-full transition-all ${
                          normalizedMobileFeaturedIndex === index
                            ? "w-6 bg-[#E11D48] dark:bg-[#FFD166]"
                            : "w-2 bg-slate-300 dark:bg-white/25"
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => goToMobileFeaturedSlide(1)}
                    aria-label="Phim nổi bật sau"
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] dark:border-white/10 dark:bg-white/10 dark:text-white"
                  >
                    <FiChevronRight size={20} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <h2 className="text-[26px] font-black leading-tight">
                Phim hay đang chiếu
              </h2>
              <button
                type="button"
                onClick={() => navigate("/movies")}
                className="flex min-h-11 items-center gap-1 text-base font-black text-slate-700 transition active:scale-95 dark:text-white"
              >
                Xem tất cả
                <FiChevronRight size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {mobileNowShowingMovies.map((movie) => {
                const canBuyTicket =
                  movie.movieId && bookableMovieIds.has(String(movie.movieId));

                return (
                  <article
                    key={`mobile-now-${movie.movieId}`}
                    className="w-[42vw] min-w-[148px] max-w-[185px] shrink-0 snap-start"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/movie/${movie.movieId}/showtimes`)}
                      className="relative block w-full overflow-hidden rounded-2xl bg-slate-900 text-left shadow-md shadow-slate-900/15 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166]"
                      aria-label={`Xem thông tin ${movie.title}`}
                    >
                      {movie.posterUrl ? (
                        <img
                          src={movie.posterUrl}
                          alt={movie.title}
                          className="aspect-[2/3] w-full object-cover"
                          loading="lazy"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex aspect-[2/3] w-full items-center justify-center px-4 text-center text-xs font-black uppercase tracking-wide text-white/45">
                          Chưa có poster
                        </div>
                      )}

                      <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-black text-slate-600">
                        {movie.ageRating}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(`/movie/${movie.movieId}/showtimes`)}
                      className="mt-2 line-clamp-2 min-h-[40px] w-full text-left text-sm font-black leading-5 transition hover:text-[#E11D48] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] dark:hover:text-[#FFD166]"
                    >
                      {movie.title}
                    </button>
                    <p className="line-clamp-1 text-xs font-semibold text-slate-500 dark:text-white/55">
                      {movie.genre}
                    </p>

                    {canBuyTicket ? (
                      <button
                        type="button"
                        onClick={() => handleBuyTicket(movie)}
                        className="mt-3 min-h-10 w-full rounded-xl bg-[#FFD166] text-xs font-black uppercase text-slate-950 shadow-sm transition active:scale-95"
                      >
                        Mua vé
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </>
        )}

        <section className="mt-9 rounded-[28px] border border-slate-200 bg-slate-50 p-4 shadow-[0_16px_35px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#0F172A]/70">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#E11D48] dark:text-[#FFD166]">
                Cụm rạp
              </p>
              <h2 className="mt-1 text-2xl font-black leading-tight">
                Rạp đang hoạt động
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate("/cinemas")}
              className="min-h-11 shrink-0 rounded-full border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] dark:border-white/10 dark:bg-white/10 dark:text-white"
            >
              Tất cả
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-3xl bg-slate-900">
            <img
              src={cinemaThumbnail}
              alt="Không gian rạp G2Cinema"
              className="aspect-[16/9] w-full object-cover"
              loading="lazy"
              draggable={false}
            />
          </div>

          {mobileCinemaItems.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm font-bold text-slate-500 dark:border-white/15 dark:text-white/55">
              Chưa có dữ liệu rạp đang hoạt động.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {mobileCinemaItems.map((cinema) => {
                const isSelected = cinema.cinemaId === selectedCinema?.cinemaId;

                return (
                  <button
                    key={cinema.cinemaId}
                    type="button"
                    onClick={() => handleSelectHomeCinema(cinema)}
                    className={`w-full cursor-pointer rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] ${
                      isSelected
                        ? "border-[#FFD166] bg-[#FFD166]/20 dark:bg-[#FFD166]/12"
                        : "border-slate-200 bg-white active:bg-slate-100 dark:border-white/10 dark:bg-white/[0.06] dark:active:bg-white/10"
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                          isSelected
                            ? "bg-[#FFD166] text-slate-950"
                            : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/60"
                        }`}
                      >
                        <FiMapPin size={18} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-black">
                          {cinema.cinemaName}
                        </span>
                        <span className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-500 dark:text-white/55">
                          {getCinemaAddress(cinema)}
                        </span>
                        <span className="mt-2 flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-white/50">
                          <FiPhone size={13} aria-hidden="true" />
                          {cinema.phoneNumber || "1900 1234"}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </section>

      {activeHeroSlides.length > 0 ? (
        <section
          className="relative hidden overflow-hidden bg-black md:block"
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
      ) : null}

      <section id="movies-section" className="hidden bg-white px-4 pb-12 pt-8 transition-colors duration-300 dark:bg-black sm:px-6 sm:pb-16 sm:pt-10 md:block">
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
