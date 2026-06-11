import { useEffect, useMemo, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import slide1 from "../../assets/slide1.png";
import slide2 from "../../assets/slide2.png";
import slide3 from "../../assets/slide3.png";
import slide4 from "../../assets/slide4.png";
import slide5 from "../../assets/slide5.png";
import slide6 from "../../assets/slide6.png";
import movie1 from "../../assets/movie1.jpg";
import movie2 from "../../assets/movie2.jpg";
import movie3 from "../../assets/movie3.jpg";
import movie4 from "../../assets/movie4.jpg";
import movie5 from "../../assets/movie5.jpg";
import movie6 from "../../assets/movie6.jpg";
import movie7 from "../../assets/movie7.jpg";
import movie8 from "../../assets/movie8.jpg";

type HeroSlide = {
  id: string;
  imageUrl: string;
  alt: string;
};

type Movie = {
  movieId: string;
  title: string;
  genre: string;
  duration: string;
  posterUrl: string;
  ageRating: string;
  highlight?: string;
};

const AUTO_PLAY_MS = 4500;
const SLIDE_TRANSITION_MS = 700;

const mockHeroSlides: HeroSlide[] = [
  { id: "slide-1", imageUrl: slide1, alt: "Movie banner slide 1" },
  { id: "slide-2", imageUrl: slide2, alt: "Movie banner slide 2" },
  { id: "slide-3", imageUrl: slide3, alt: "Movie banner slide 3" },
  { id: "slide-4", imageUrl: slide4, alt: "Movie banner slide 4" },
  { id: "slide-5", imageUrl: slide5, alt: "Movie banner slide 5" },
  { id: "slide-6", imageUrl: slide6, alt: "Movie banner slide 6" },
];

const FIRST_REAL_SLIDE_INDEX = 1;
const LAST_REAL_SLIDE_INDEX = mockHeroSlides.length;
const CLONED_FIRST_SLIDE_INDEX = LAST_REAL_SLIDE_INDEX + 1;

const getRealSlideIndex = (index: number) =>
  ((((index - FIRST_REAL_SLIDE_INDEX) % LAST_REAL_SLIDE_INDEX) +
    LAST_REAL_SLIDE_INDEX) %
    LAST_REAL_SLIDE_INDEX) +
  FIRST_REAL_SLIDE_INDEX;

const mockNowShowingMovies: Movie[] = [
  {
    movieId: "M01",
    title: "Tạm Biệt Gohan",
    genre: "Tình cảm, Gia đình",
    duration: "140 phút",
    posterUrl: movie1,
    ageRating: "K",
    highlight: "HOT",
  },
  {
    movieId: "M02",
    title: "Heo Năm Móng",
    genre: "Kinh dị",
    duration: "103 phút",
    posterUrl: movie2,
    ageRating: "T18",
    highlight: "HOT",
  },
  {
    movieId: "M03",
    title: "Ma Da Hàn Quốc: Hồ Nước Người",
    genre: "Kinh dị",
    duration: "95 phút",
    posterUrl: movie3,
    ageRating: "T18",
    highlight: "HOT",
  },
  {
    movieId: "M04",
    title: "Thẩm Mỹ Viện Âm Phủ",
    genre: "Kinh dị, Hồi hộp",
    duration: "100 phút",
    posterUrl: movie4,
    ageRating: "T18",
  },
  {
    movieId: "M05",
    title: "Phì Phòng: Quỷ Máu Rừng Thiêng",
    genre: "Kinh dị, Giật gân",
    duration: "120 phút",
    posterUrl: movie5,
    ageRating: "T18",
  },
  {
    movieId: "M06",
    title: "Ngôi Đền Kỳ Quái 5",
    genre: "Kinh dị, Hài hước",
    duration: "118 phút",
    posterUrl: movie6,
    ageRating: "T16",
  },
  {
    movieId: "M07",
    title: "Ốc Mượn Hồn",
    genre: "Bí ẩn, Tâm lý",
    duration: "109 phút",
    posterUrl: movie7,
    ageRating: "T18",
  },
  {
    movieId: "M08",
    title: "Phim Shin - Cậu Bé Bút Chì: Quậy",
    genre: "Hoạt hình, Gia đình",
    duration: "104 phút",
    posterUrl: movie8,
    ageRating: "P",
  },
];

import { movieService } from "../../services/movieService";

export default function Home() {
  const navigate = useNavigate(); // Khởi tạo hook điều hướng
  const [slideIndex, setSlideIndex] = useState(1);
  const [withTransition, setWithTransition] = useState(true);
  const [movies, setMovies] = useState<Movie[]>(mockNowShowingMovies);
  const [loadingMovies, setLoadingMovies] = useState(true);

  useEffect(() => {
    const fetchMovies = async () => {
      try {
        setLoadingMovies(true);
        const response: any = await movieService.getActiveMovies();
        
        // Kiểm tra nếu API trả về mảng trực tiếp, hoặc trả về object { success: true, data: [...] }
        let moviesData = [];
        if (Array.isArray(response)) {
          moviesData = response;
        } else if (response && response.success && Array.isArray(response.data)) {
          moviesData = response.data;
        }

        if (moviesData.length > 0) {
          const apiMovies = moviesData.map((m: any) => ({
            movieId: m.id || m.movieId,
            title: m.movieNameVn || m.title || m.movieName,
            genre: m.genre || "Đang cập nhật",
            duration: m.duration ? `${m.duration} phút` : "Đang cập nhật",
            posterUrl: m.imagePoster || m.posterUrl || movie1,
            ageRating: m.ageRating || "P",
            highlight: m.isHot ? "HOT" : undefined,
          }));
          setMovies(apiMovies);
        } else {
          console.warn("API không có dữ liệu, dùng dữ liệu mẫu (mock)");
          setMovies(mockNowShowingMovies);
        }
      } catch (error) {
        console.error("Lỗi lấy danh sách phim (Backend có thể đang bị lỗi 500):", error);
        console.warn("Chuyển sang dùng dữ liệu mẫu (mock)");
        setMovies(mockNowShowingMovies);
      } finally {
        setLoadingMovies(false);
      }
    };
    fetchMovies();
  }, []);

  const carouselSlides = useMemo(() => {
    const lastSlide = mockHeroSlides[mockHeroSlides.length - 1];
    const firstSlide = mockHeroSlides[0];

    return [lastSlide, ...mockHeroSlides, firstSlide];
  }, []);

  const safeSlideIndex =
    slideIndex < 0 || slideIndex > CLONED_FIRST_SLIDE_INDEX
      ? getRealSlideIndex(slideIndex)
      : slideIndex;
  const activeSlideIndex = getRealSlideIndex(slideIndex) - 1;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSlideIndex((currentIndex) => getRealSlideIndex(currentIndex) + 1);
    }, AUTO_PLAY_MS);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (slideIndex >= 0 && slideIndex <= CLONED_FIRST_SLIDE_INDEX) {
      return;
    }

    const resetTimer = window.setTimeout(() => {
      setWithTransition(false);
      setSlideIndex(getRealSlideIndex(slideIndex));
    }, 0);

    return () => window.clearTimeout(resetTimer);
  }, [slideIndex]);

  useEffect(() => {
    if (slideIndex !== 0 && slideIndex !== CLONED_FIRST_SLIDE_INDEX) {
      return;
    }

    const fallbackTimer = window.setTimeout(() => {
      setWithTransition(false);
      setSlideIndex(
        slideIndex === 0 ? LAST_REAL_SLIDE_INDEX : FIRST_REAL_SLIDE_INDEX,
      );
    }, SLIDE_TRANSITION_MS + 50);

    return () => window.clearTimeout(fallbackTimer);
  }, [slideIndex]);

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
    setSlideIndex((currentIndex) => getRealSlideIndex(currentIndex) - 1);
  };

  const goToNextSlide = () => {
    setSlideIndex((currentIndex) => getRealSlideIndex(currentIndex) + 1);
  };

  const goToSlide = (nextSlideIndex: number) => {
    setSlideIndex(nextSlideIndex + 1);
  };

  const handleSlideTransitionEnd = () => {
    if (slideIndex === CLONED_FIRST_SLIDE_INDEX) {
      setWithTransition(false);
      setSlideIndex(FIRST_REAL_SLIDE_INDEX);
      return;
    }

    if (slideIndex === 0) {
      setWithTransition(false);
      setSlideIndex(LAST_REAL_SLIDE_INDEX);
    }
  };

  return (
    <div className="-m-4 bg-[#182437]">
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
            {carouselSlides.map((slide, index) => (
              <div className="h-full min-w-full" key={`${slide.id}-${index}`}>
                <img
                  src={slide.imageUrl}
                  alt={slide.alt}
                  className="h-full w-full object-cover object-center"
                  draggable={false}
                />
              </div>
            ))}
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
            {mockHeroSlides.map((slide, index) => (
              <button
                type="button"
                key={slide.id}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={activeSlideIndex === index}
                onClick={() => goToSlide(index)}
                className={`h-3 w-3 rounded-full border border-white/80 transition ${
                  activeSlideIndex === index
                    ? "bg-white"
                    : "bg-transparent hover:bg-white/50"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#182437] px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-base font-extrabold uppercase text-white sm:text-xl">
            <button type="button" className="transition hover:text-[#FFD166]">
              Phim sắp chiếu
            </button>
            <span className="text-white/80">|</span>
            <button
              type="button"
              className="border-b-2 border-[#FFD166] pb-1 text-[#FFD166]"
            >
              Phim đang chiếu
            </button>
            <span className="text-white/80">|</span>
            <button type="button" className="transition hover:text-[#FFD166]">
              Suất chiếu đặc biệt
            </button>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {loadingMovies ? (
              <div className="col-span-full text-center text-white py-10 animate-pulse">
                Đang tải danh sách phim...
              </div>
            ) : movies.length === 0 ? (
              <div className="col-span-full text-center text-gray-500 py-10">
                Hiện chưa có phim nào đang chiếu.
              </div>
            ) : (
              movies.map((movie) => (
                <article key={movie.movieId} className="flex min-w-0 flex-col">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-[#0F172A] shadow-lg shadow-black/20">
                    <img
                      src={movie.posterUrl}
                      alt={movie.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      draggable={false}
                    />

                    <div className="absolute left-2 top-2 rounded bg-white/90 px-2 py-1 text-[10px] font-extrabold leading-none text-[#8A8F98]">
                      {movie.ageRating}
                    </div>

                    {movie.highlight ? (
                      <div className="absolute right-0 top-0 rounded-bl bg-[#7C4DFF] px-2.5 py-2 text-[10px] font-extrabold leading-none text-white">
                        {movie.highlight}
                      </div>
                    ) : null}
                  </div>

                  <h3 className="mt-3 text-[15px] font-bold leading-5 text-white">
                    {movie.title}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-white">
                    Thể loại: <span className="text-white/80">{movie.genre}</span>
                  </p>
                  <p className="text-xs leading-5 text-white">
                    Thời lượng:{" "}
                    <span className="text-white/80">{movie.duration}</span>
                  </p>

                  <button
                    type="button"
                    onClick={() => navigate(`/movie/${movie.movieId}/showtimes`)}
                    className="mt-5 h-10 w-full rounded-md bg-gradient-to-r from-[#FFD166] to-[#FFE7A3] text-xs font-extrabold uppercase text-black transition hover:brightness-105 cursor-pointer"
                  >
                    Mua vé
                  </button>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
