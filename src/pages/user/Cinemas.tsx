import { useEffect, useMemo, useState } from "react";
import { FiMapPin, FiPhone, FiStar } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import cinemaThumbnail from "../../assets/thumbnail-1-144816-050424-68.jpeg";
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
} from "../../services/showtimeService";

type MovieCard = {
  movieId: string;
  title: string;
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
  posterUrl?: string;
  imageUrl?: string;
  poster?: string;
  isHot?: boolean;
};

const mapMovieToCard = (movie: MovieResponseAliases): MovieCard => {
  const posterPath =
    movie.imagePoster || movie.posterUrl || movie.imageUrl || movie.poster || "";

  return {
    movieId: movie.id || movie.movieId || movie.movieID || "",
    title:
      movie.movieNameVn ||
      movie.title ||
      movie.movieName ||
      movie.name ||
      "Phim đang cập nhật",
    posterUrl: getMediaUrl(posterPath),
    ageRating: movie.ageRating || "P",
    highlight: movie.highlight || (movie.isHot ? "HOT" : undefined),
  };
};

export default function Cinemas() {
  const navigate = useNavigate();
  const [cinemas, setCinemas] = useState<CinemaResponse[]>([]);
  const [selectedCinemaId, setSelectedCinemaId] = useState(() =>
    readSelectedCinemaId(),
  );
  const [nowShowingMovies, setNowShowingMovies] = useState<MovieCard[]>([]);
  const [loadingMovies, setLoadingMovies] = useState(true);

  useEffect(() => {
    const fetchPageData = async () => {
      try {
        setLoadingMovies(true);

        const [cinemaItems, moviesPage] = await Promise.all([
          showtimeService.getCinemas().catch(() => []),
          movieService.getMoviesWithPagination(1, 4, "NOW_SHOWING"),
        ]);

        setCinemas(
          cinemaItems.filter(
            (cinema) => cinema.cinemaStatus?.toUpperCase() === "ACTIVE",
          ),
        );
        setNowShowingMovies(moviesPage.items.slice(0, 4).map(mapMovieToCard));
      } catch (error) {
        console.error("Không tải được dữ liệu trang rạp:", error);
        setCinemas([]);
        setNowShowingMovies([]);
      } finally {
        setLoadingMovies(false);
      }
    };

    void fetchPageData();
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

  const cinemaName = selectedCinema?.cinemaName || "G2Cinema Thái Nguyên";
  const cinemaAddress =
    [selectedCinema?.address, selectedCinema?.city].filter(Boolean).join(" - ") ||
    "Trung tâm thương mại G2Cinema, khu vực trung tâm thành phố.";

  const handleOpenMovie = (movieId: string) => {
    if (movieId) {
      navigate(`/movie/${movieId}/showtimes`);
    }
  };

  return (
    <div className="bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#182437] dark:text-white">
      <section className="px-4 pb-14 pt-8 sm:px-6 sm:pb-16">
        <div className="mx-auto grid w-full max-w-[1120px] gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="min-w-0 lg:sticky lg:top-[118px] lg:self-start">
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-white/10 dark:bg-[#1E293B]">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0EA5E9] dark:text-[#FFD166]">
                Hệ thống rạp
              </p>
              <h1 className="mt-2 truncate text-2xl font-black tracking-tight sm:text-3xl">
                {cinemaName}
              </h1>
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#1E293B]">
              <img
                src={cinemaThumbnail}
                alt={`Không gian ${cinemaName}`}
                className="aspect-[16/10] w-full object-cover lg:aspect-[16/7]"
                loading="lazy"
                draggable={false}
              />
            </div>

            <div className="mt-5 space-y-4 text-sm font-semibold leading-7 text-slate-600 dark:text-white/65 lg:space-y-3 lg:leading-6">
              <p>
                {cinemaName} nằm tại khu vực thuận tiện, phù hợp cho khách xem
                phim cá nhân, gia đình và nhóm bạn. Rạp được bố trí quầy vé,
                khu bắp nước và sảnh chờ rộng rãi để khách có thể nhận vé, mua
                đồ ăn nhẹ và di chuyển vào phòng chiếu nhanh hơn.
              </p>
              <p>
                Hệ thống phòng chiếu sử dụng màn hình lớn, âm thanh vòm và ghế
                ngồi theo nhiều hạng khác nhau. Ghế thường phù hợp nhu cầu xem
                phim cơ bản, ghế VIP có vị trí đẹp hơn, còn ghế đôi dành cho
                khách đi theo cặp.
              </p>
              <p>
                Các suất chiếu đang mở bán sẽ được cập nhật theo từng ngày.
                Khi chọn phim, bạn có thể xem thông tin phim, lịch chiếu, phòng
                chiếu và số ghế còn trống trước khi đặt vé.
              </p>
            </div>

            <div className="mt-5 grid gap-3 text-sm font-bold sm:grid-cols-2">
              <div className="flex min-h-[64px] items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 dark:border-white/10 dark:bg-[#1E293B]">
                <FiMapPin className="shrink-0 text-[#FFD166]" size={20} />
                <span>{cinemaAddress}</span>
              </div>
              <div className="flex min-h-[64px] items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 dark:border-white/10 dark:bg-[#1E293B]">
                <FiPhone className="shrink-0 text-[#FFD166]" size={20} />
                <span>{selectedCinema?.phoneNumber || "Hotline: 1900 1234"}</span>
              </div>
            </div>
          </article>

          <aside>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FFD166] text-[#111827]">
                <FiStar size={19} aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-wide">
                Phim đang hot
              </h2>
            </div>

            {loadingMovies ? (
              <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-sm font-bold text-slate-500 dark:border-white/10 dark:bg-[#1E293B] dark:text-white/55">
                Đang tải phim đang chiếu...
              </div>
            ) : nowShowingMovies.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-sm font-bold text-slate-500 dark:border-white/10 dark:bg-[#1E293B] dark:text-white/55">
                Chưa có phim đang chiếu.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-5 gap-y-8">
                {nowShowingMovies.map((movie) => (
                  <article key={movie.movieId} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => handleOpenMovie(movie.movieId)}
                      className="group relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-[#0F172A] text-left shadow-lg shadow-black/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] motion-reduce:transition-none"
                      aria-label={`Xem thông tin ${movie.title}`}
                    >
                      {movie.posterUrl ? (
                        <img
                          src={movie.posterUrl}
                          alt={movie.title}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
                          loading="lazy"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs font-black uppercase tracking-wide text-white/45">
                          Chưa có poster
                        </div>
                      )}

                      <span className="absolute left-2 top-2 rounded bg-white/90 px-2 py-1 text-[10px] font-black text-slate-600">
                        {movie.ageRating}
                      </span>
                      {movie.highlight ? (
                        <span className="absolute right-0 top-0 rounded-bl bg-[#7C4DFF] px-2.5 py-2 text-[10px] font-black text-white">
                          {movie.highlight}
                        </span>
                      ) : null}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenMovie(movie.movieId)}
                      className="mt-3 line-clamp-2 w-full text-left text-sm font-black leading-5 text-[#075985] transition-colors hover:text-[#0EA5E9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] dark:text-white dark:hover:text-[#FFD166]"
                    >
                      {movie.title}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
