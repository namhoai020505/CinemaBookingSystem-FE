import { type FormEvent, useEffect, useMemo, useState } from "react";
import { FaPaperPlane, FaRegStar, FaStar, FaUserCircle } from "react-icons/fa";
import { FiArrowLeft, FiClock, FiGlobe, FiCalendar, FiFilm, FiPlay } from "react-icons/fi";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../../lib/api";
import { getAccessToken, getRoleFromAccessToken, isAccessTokenExpired, isCustomerRole } from "../../lib/auth";
import { bookingService, type BookingSummary } from "../../services/bookingService";
import { reviewService, type ReviewItem } from "../../services/reviewService";

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

// Lấy yyyy-MM-dd từ startTime ISO để gom suất chiếu theo ngày.
const getDateKey = (value: string) => value.split("T")[0] || "";

// Tạo key ngày hôm nay theo timezone trình duyệt.
const getTodayKey = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
};

// Chuyển chuỗi ngày thành dữ liệu hiển thị cho tab chọn ngày.
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

// Format ISO datetime thành HH:mm cho nút suất chiếu.
const formatISOToShortTime = (value: string) => {
  if (!value) {
    return "";
  }

  const timePart = value.includes("T")
    ? value.split("T")[1]
    : value.split(" ")[1];

  return timePart?.substring(0, 5) || "";
};

// Format số tiền theo chuẩn Việt Nam.
const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value);

// Chuyển lỗi Axios/backend thành message để hiển trong khu review.
const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return error instanceof Error ? error.message : fallback;
};

// Format ngày review/booking về dạng ngắn gọn, nếu backend trả sai thì hiện fallback.
const formatDisplayDateTime = (value?: string | null) => {
  if (!value) {
    return "Đang cập nhật";
  }

  const normalizedValue = /(?:z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
  const timestamp = Date.parse(normalizedValue);

  if (Number.isNaN(timestamp)) {
    return "Đang cập nhật";
  }

  return new Date(timestamp).toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

// Chỉ cho phép chọn booking đã thanh toán khi gửi review cho phim.
const isPaidBooking = (booking: BookingSummary) =>
  booking.status?.toUpperCase() === "PAID" || booking.status?.toUpperCase() === "COMPLETED";

// Chuẩn hóa id từ route param để so sánh chắc chắn với dữ liệu API.
const normalizeMovieId = (value: string | undefined) => String(value || "");

// Tính số ghế available/locked/sold từ seat map của một suất chiếu.
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

// Map movie detail từ backend sang dữ liệu header/aside của trang.
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

// Gom suất chiếu theo cụm rạp và phòng chiếu để render danh sách rõ ràng.
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

// Chuyển URL YouTube thường sang embed URL dùng trong modal trailer.
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

type RatingStarsProps = {
  rating: number;
  onChange?: (rating: number) => void;
  sizeClass?: string;
};

// Render sao cho cả review đã duyệt và input chọn sao của user.
const RatingStars = ({ rating, onChange, sizeClass = "h-5 w-5" }: RatingStarsProps) => (
  <div className="flex items-center gap-1">
    {Array.from({ length: 5 }, (_, index) => {
      const score = index + 1;
      const Icon = score <= Math.round(rating) ? FaStar : FaRegStar;

      if (onChange) {
        return (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            className="text-[#FFD166] transition hover:scale-110 focus:outline-none"
            aria-label={`Chọn ${score} sao`}
          >
            <Icon className={sizeClass} />
          </button>
        );
      }

      return <Icon key={score} className={`${sizeClass} text-[#FFD166]`} />;
    })}
  </div>
);

type ReviewSectionProps = {
  movieInfo: MovieInfo | null;
  reviews: ReviewItem[];
  reviewsLoading: boolean;
  reviewError: string;
  reviewSuccess: string;
  isAuthenticated: boolean;
  isCustomerAccount: boolean;
  eligibleReviewBookings: BookingSummary[];
  selectedReviewBookingId: string;
  selectedRating: number;
  reviewComment: string;
  submittingReview: boolean;
  onSelectBooking: (bookingId: string) => void;
  onRatingChange: (rating: number) => void;
  onCommentChange: (comment: string) => void;
  onSubmitReview: (event: FormEvent<HTMLFormElement>) => void;
  onLoginClick: () => void;
};

// Khu vực cuối trang hiển thị review đã duyệt và form tạo review mới.
const ReviewSection = ({
  movieInfo,
  reviews,
  reviewsLoading,
  reviewError,
  reviewSuccess,
  isAuthenticated,
  isCustomerAccount,
  eligibleReviewBookings,
  selectedReviewBookingId,
  selectedRating,
  reviewComment,
  submittingReview,
  onSelectBooking,
  onRatingChange,
  onCommentChange,
  onSubmitReview,
  onLoginClick,
}: ReviewSectionProps) => {
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / reviews.length
      : 0;
  const canSubmit =
    isCustomerAccount &&
    eligibleReviewBookings.length > 0 &&
    selectedReviewBookingId &&
    selectedRating > 0 &&
    !submittingReview;

  return (
    <section className="mt-10 rounded-3xl border border-gray-800 bg-[#111C44] p-5 shadow-2xl md:p-7">
      <div className="mb-6 flex flex-col gap-4 border-b border-gray-800/80 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FFD166]">
            Đánh giá
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Cảm nhận về {movieInfo?.title || "bộ phim"}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Chia sẻ trải nghiệm sau khi xem phim để những khán giả khác tham khảo.
          </p>
        </div>

        <div className="rounded-2xl border border-[#FFD166]/30 bg-[#FFD166]/10 px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Điểm trung bình
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-3xl font-black text-[#FFD166]">
              {reviews.length > 0 ? averageRating.toFixed(1) : "--"}
            </span>
            <div>
              <RatingStars rating={averageRating} sizeClass="h-4 w-4" />
              <p className="mt-1 text-xs font-bold text-slate-400">
                {reviews.length} đánh giá đã duyệt
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-300">
            Review mới nhất
          </h3>

          {reviewsLoading ? (
            <div className="rounded-2xl border border-gray-800 bg-[#0D1637]/60 p-6 text-center text-sm font-bold text-slate-400">
              Đang tải đánh giá...
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl border border-gray-800 bg-[#0D1637]/60 p-6 text-sm text-slate-400">
              Chưa có đánh giá nào được duyệt cho phim này.
            </div>
          ) : (
            reviews.map((review) => (
              <article
                key={review.reviewId}
                className="rounded-2xl border border-gray-800 bg-[#0D1637]/60 p-5"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <FaUserCircle className="h-8 w-8 text-slate-500" />
                    <div>
                      <p className="text-sm font-black text-white">
                        {review.customerName || "Thành viên G2C"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDisplayDateTime(review.createdAt)}
                      </p>
                    </div>
                  </div>
                  <RatingStars rating={review.rating} sizeClass="h-4 w-4" />
                </div>

                <p className="whitespace-pre-line text-sm leading-6 text-slate-300">
                  {review.comment?.trim() || "Người dùng chỉ chấm sao cho phim này."}
                </p>
              </article>
            ))
          )}
        </div>

        <form
          onSubmit={onSubmitReview}
          className="rounded-2xl border border-gray-800 bg-[#0D1637]/60 p-5"
        >
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-300">
            Để lại đánh giá
          </h3>

          {!isAuthenticated ? (
            <div className="mt-4 rounded-2xl border border-[#FFD166]/30 bg-[#FFD166]/10 p-4">
              <p className="text-sm font-bold text-slate-200">
                Bạn cần đăng nhập để đánh giá phim.
              </p>
              <button
                type="button"
                onClick={onLoginClick}
                className="mt-4 rounded-xl bg-[#FFD166] px-5 py-3 text-xs font-black uppercase text-black transition hover:bg-[#FFE7A3]"
              >
                Đăng nhập
              </button>
            </div>
          ) : !isCustomerAccount ? (
            <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
              Chỉ tài khoản khách hàng đã mua vé mới có thể gửi đánh giá phim.
            </div>
          ) : eligibleReviewBookings.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
              Bạn cần có vé đã thanh toán của phim này trước khi gửi đánh giá.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">
                  Vé dùng để đánh giá
                </label>
                <select
                  value={selectedReviewBookingId}
                  onChange={(event) => onSelectBooking(event.target.value)}
                  className="w-full rounded-xl border border-gray-800 bg-[#0F172A] px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-[#FFD166]"
                >
                  {eligibleReviewBookings.map((booking) => (
                    <option key={booking.bookingId} value={booking.bookingId}>
                      {formatDisplayDateTime(booking.startTime)} - {booking.roomName || "Phòng chiếu"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">
                  Số sao
                </label>
                <RatingStars
                  rating={selectedRating}
                  onChange={onRatingChange}
                  sizeClass="h-7 w-7"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">
                  Nội dung
                </label>
                <textarea
                  value={reviewComment}
                  onChange={(event) => onCommentChange(event.target.value)}
                  rows={5}
                  maxLength={1000}
                  placeholder="Viết cảm nhận của bạn về bộ phim..."
                  className="w-full resize-none rounded-xl border border-gray-800 bg-[#0F172A] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#FFD166]"
                />
                <p className="mt-1 text-right text-[11px] font-bold text-slate-500">
                  {reviewComment.length}/1000
                </p>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FFD166] to-[#FFE7A3] px-5 py-3 text-xs font-black uppercase text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FaPaperPlane />
                {submittingReview ? "Đang gửi..." : "Gửi đánh giá"}
              </button>
            </div>
          )}

          {reviewError ? (
            <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm font-bold text-rose-100">
              {reviewError}
            </div>
          ) : null}

          {reviewSuccess ? (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-100">
              {reviewSuccess}
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
};

// Trang lịch chiếu của một phim, cho phép chọn ngày và đi tới chọn ghế.
export default function MovieShowtimes() {
  const { movieId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [movieInfo, setMovieInfo] = useState<MovieInfo | null>(null);
  const [showtimes, setShowtimes] = useState<ShowtimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [userBookings, setUserBookings] = useState<BookingSummary[]>([]);
  const [selectedReviewBookingId, setSelectedReviewBookingId] = useState("");
  const [selectedRating, setSelectedRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");

  const currentAccessToken = getAccessToken();
  const isAuthenticated = Boolean(currentAccessToken) && !isAccessTokenExpired(currentAccessToken);
  const isCustomerAccount = isAuthenticated && isCustomerRole(getRoleFromAccessToken(currentAccessToken));

  // Khi đổi phim trên URL, reset trạng thái để tránh hiển thị data phim cũ.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Tải movie detail, danh sách showtimes và số ghế còn lại cho từng suất.
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

        const canLoadSeatMap = Boolean(getAccessToken()) && !isAccessTokenExpired();
        const availabilityEntries = await Promise.all(
          movieShowtimes.map(async (showtime) => {
            if (!canLoadSeatMap) {
              return [showtime.showtimeId, null] as const;
            }

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

  // Tải danh sách review đã duyệt của phim để hiển thị ở cuối trang.
  useEffect(() => {
    let isMounted = true;
    const currentMovieId = normalizeMovieId(movieId);

    const fetchReviews = async () => {
      if (!currentMovieId) {
        setReviews([]);
        setReviewsLoading(false);
        return;
      }

      setReviewsLoading(true);

      try {
        const response = await reviewService.getMovieReviews(currentMovieId);

        if (!isMounted) {
          return;
        }

        if (!response.success) {
          throw new Error(response.message || "Không tải được đánh giá phim.");
        }

        setReviews(response.data || []);
      } catch (error) {
        if (isMounted) {
          setReviewError(getErrorMessage(error, "Không tải được đánh giá phim."));
          setReviews([]);
        }
      } finally {
        if (isMounted) {
          setReviewsLoading(false);
        }
      }
    };

    void fetchReviews();

    return () => {
      isMounted = false;
    };
  }, [movieId]);

  // Nếu user đã đăng nhập, tải vé của họ để chọn booking hợp lệ khi gửi review.
  useEffect(() => {
    let isMounted = true;

    const fetchUserBookings = async () => {
      if (!isCustomerAccount) {
        setUserBookings([]);
        setSelectedReviewBookingId("");
        return;
      }

      try {
        const response = await bookingService.getMyBookings();

        if (!isMounted) {
          return;
        }

        if (!response.success) {
          throw new Error(response.message || "Không tải được vé của bạn.");
        }

        setUserBookings(response.data || []);
      } catch (error) {
        if (isMounted) {
          console.warn("Không tải được vé để đánh giá phim", error);
          setUserBookings([]);
        }
      }
    };

    void fetchUserBookings();

    return () => {
      isMounted = false;
    };
  }, [isCustomerAccount, movieId]);

  // Tạo danh sách ngày có suất chiếu, nếu chưa có thì vẫn có ngày hôm nay.
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

  // Đồng bộ ngày đang chọn lên query string để reload/back vẫn giữ tab ngày.
  useEffect(() => {
    if (!loading && currentSelectedDate && selectedDateFromUrl !== currentSelectedDate) {
      setSearchParams({ date: currentSelectedDate }, { replace: true });
    }
  }, [currentSelectedDate, loading, selectedDateFromUrl, setSearchParams]);

  // Lọc showtimes theo ngày đang chọn rồi group theo rạp/phòng.
  const groupedCinemas = useMemo(
    () => groupShowtimesByCinema(showtimes, currentSelectedDate),
    [currentSelectedDate, showtimes],
  );

  const currentMovieShowtimeIds = useMemo(
    () => new Set(showtimes.map((showtime) => String(showtime.showtimeId))),
    [showtimes],
  );

  const eligibleReviewBookings = useMemo(
    () =>
      userBookings.filter((booking) => {
        const isSameMovieByShowtime = currentMovieShowtimeIds.has(String(booking.showtimeId));
        const isSameMovieByTitle =
          Boolean(movieInfo?.title && booking.movieTitle) &&
          booking.movieTitle?.trim().toLowerCase() === movieInfo?.title.trim().toLowerCase();

        return isPaidBooking(booking) && (isSameMovieByShowtime || isSameMovieByTitle);
      }),
    [currentMovieShowtimeIds, movieInfo?.title, userBookings],
  );

  // Luôn chọn sẵn vé đầu tiên hợp lệ để payload review có bookingId đúng cho BE kiểm tra.
  useEffect(() => {
    setSelectedReviewBookingId((currentBookingId) => {
      if (
        currentBookingId &&
        eligibleReviewBookings.some((booking) => booking.bookingId === currentBookingId)
      ) {
        return currentBookingId;
      }

      return eligibleReviewBookings[0]?.bookingId || "";
    });
  }, [eligibleReviewBookings]);

  // Cập nhật tab ngày và query string khi user chọn ngày khác.
  const handleDateChange = (dateValue: string) => {
    setSearchParams({ date: dateValue });
  };

  // Điều hướng sang trang chọn ghế, truyền kèm movie/showtime để tránh màn loading thiếu dữ liệu.
  const handleSelectShowtime = (slot: ShowtimeSlot) => {
    navigate(`/booking/seats/${slot.showtimeId}`, {
      state: {
        movie: movieInfo,
        showtime: slot,
      },
    });
  };

  const handleSubmitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const currentMovieId = normalizeMovieId(movieId);

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (!isCustomerAccount) {
      setReviewError("Chỉ tài khoản khách hàng mới có thể gửi đánh giá phim.");
      return;
    }

    if (!currentMovieId) {
      setReviewError("Không tìm thấy mã phim để gửi đánh giá.");
      return;
    }

    if (!selectedReviewBookingId) {
      setReviewError("Bạn cần có vé đã thanh toán của phim này trước khi đánh giá.");
      return;
    }

    if (selectedRating <= 0) {
      setReviewError("Vui lòng chọn số sao trước khi gửi đánh giá.");
      return;
    }

    setSubmittingReview(true);
    setReviewError("");
    setReviewSuccess("");

    try {
      const response = await reviewService.createReview({
        movieId: currentMovieId,
        bookingId: selectedReviewBookingId,
        rating: selectedRating,
        comment: reviewComment.trim() || undefined,
      });

      if (!response.success) {
        throw new Error(response.message || "Không gửi được đánh giá.");
      }

      const createdReview = response.data;
      const reviewStatus = createdReview?.status?.toUpperCase();

      if (createdReview && reviewStatus === "APPROVED") {
        setReviews((currentReviews) => [
          createdReview,
          ...currentReviews.filter((review) => review.reviewId !== createdReview.reviewId),
        ]);
      }

      setSelectedRating(0);
      setReviewComment("");
      setReviewSuccess(
        response.message ||
          (reviewStatus === "APPROVED"
            ? "Đánh giá của bạn đã được đăng."
            : "Đánh giá của bạn đã được gửi và đang chờ kiểm duyệt."),
      );
    } catch (error) {
      setReviewError(getErrorMessage(error, "Không gửi được đánh giá."));
    } finally {
      setSubmittingReview(false);
    }
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

        <ReviewSection
          movieInfo={movieInfo}
          reviews={reviews}
          reviewsLoading={reviewsLoading}
          reviewError={reviewError}
          reviewSuccess={reviewSuccess}
          isAuthenticated={isAuthenticated}
          isCustomerAccount={isCustomerAccount}
          eligibleReviewBookings={eligibleReviewBookings}
          selectedReviewBookingId={selectedReviewBookingId}
          selectedRating={selectedRating}
          reviewComment={reviewComment}
          submittingReview={submittingReview}
          onSelectBooking={setSelectedReviewBookingId}
          onRatingChange={(rating) => {
            setSelectedRating(rating);
            setReviewError("");
            setReviewSuccess("");
          }}
          onCommentChange={(comment) => {
            setReviewComment(comment);
            setReviewError("");
          }}
          onSubmitReview={handleSubmitReview}
          onLoginClick={() => navigate("/login")}
        />
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
