import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FaCheck,
  FaClock,
  FaCopy,
  FaGift,
  FaMapMarkerAlt,
  FaMinus,
  FaPlus,
  FaQrcode,
  FaReceipt,
  FaRegCheckCircle,
  FaSyncAlt,
  FaTicketAlt,
  FaUserCircle,
} from "react-icons/fa";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import fallbackPoster from "../../assets/movie1.jpg";
import api from "../../lib/api";
import { getCurrentUserProfile } from "../../lib/auth";
import { getMediaUrl } from "../../lib/media";
import {
  bookingService,
  hideExpiredBookingFromHistory,
  type BookingSummary,
  type CheckoutPayload,
} from "../../services/bookingService";
import {
  isSameCheckoutRequest,
  readCheckoutAttempt,
  removeCheckoutAttempt,
  writeCheckoutAttempt,
  type CheckoutAttempt,
} from "../../services/checkoutAttempt";
import {
  paymentService,
  type CreatePaymentResponse,
} from "../../services/paymentService";

const PAYMENT_PROVIDER_ID = "PP_SEPAY";
const PAYMENT_WINDOW_SECONDS = 600;
const DEFAULT_LOCK_SECONDS = 600;
const PAYMENT_STATUS_POLL_MS = 5000;


const FNB_ITEMS = [
  {
    id: "FB_POPCORN_PEPSI_L",
    name: "Beta Combo 69oz",
    price: 75000,
    badge: "BEST COMBO",
    accent: "from-amber-300 to-orange-500",
    desc: "TIẾT KIỆM 28K!!! Gồm: 1 Bắp (69oz) + 1 Nước có gas (22oz)",
  },
  {
    id: "FB_CHEESE_POPCORN_M",
    name: "Sweet Combo 69oz",
    price: 55000,
    badge: "SWEET COMBO",
    accent: "from-sky-300 to-blue-600",
    desc: "TIẾT KIỆM 46K!!! Gồm: 1 Bắp (69oz) + 2 Nước có gas (22oz)",
  },
];

type CheckoutSeat = {
  seatId: string;
  showtimeSeatId: string;
  row: string;
  column: number;
  seatCode?: string;
  type?: string;
  price: number;
  lockedUntil?: string | null;
};

type CheckoutSeatMap = {
  showtimeId: string;
  movieName?: string;
  roomName?: string;
  cinemaName?: string;
  startTime?: string;
};

type CheckoutRouteState = {
  selectedSeats?: CheckoutSeat[];
  totalAmount?: number;
  seatMap?: CheckoutSeatMap;
  resumeBooking?: BookingSummary;
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

type CheckoutDisplayDetails = {
  movieId?: string;
  title?: string;
  genre?: string;
  duration?: string;
  ageRating?: string;
  posterUrl?: string;
  cinemaName?: string;
  roomName?: string;
  startTime?: string;
};

type StoredLockedSeat = CheckoutSeat & {
  lockedUntil: string;
};

type SeatLockSession = {
  showtimeId: string;
  userKey: string;
  lockedSeats: Record<string, StoredLockedSeat>;
  selectedSeatIds: string[];
  updatedAt: string;
};

type PaymentSession = {
  showtimeId: string;
  userKey: string;
  booking: BookingSummary;
  payment: CreatePaymentResponse;
  expiresAt: string;
  createdAt: string;
};

const normalizeBackendDate = (value?: string | null) => {
  if (!value) {
    return "";
  }

  return /(?:z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
};

const parseBackendTime = (value?: string | null) => {
  const normalized = normalizeBackendDate(value);
  if (!normalized) {
    return 0;
  }

  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + " đ";

const formatTimer = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
};

const formatDateTime = (value?: string | null) => {
  const timestamp = parseBackendTime(value);
  if (!timestamp) {
    return "Đang cập nhật";
  }

  return new Date(timestamp).toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

// Lấy định danh user hiện tại để tách session theo tài khoản.
const getUserKey = () => {
  const profile = getCurrentUserProfile();
  return profile?.userId || profile?.email || "anonymous";
};

const getSeatLockStorageKey = (showtimeId: string, userKey: string) =>
  `g2c-seat-locks:${userKey}:${showtimeId}`;

const getPaymentStorageKey = (showtimeId: string, userKey: string) =>
  `g2c-payment:${userKey}:${showtimeId}`;

const readSeatLockSession = (
  showtimeId: string,
  userKey: string,
): SeatLockSession | null => {
  const rawValue = localStorage.getItem(getSeatLockStorageKey(showtimeId, userKey));

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as SeatLockSession;
    const activeLockedSeats = Object.fromEntries(
      Object.entries(parsed.lockedSeats || {}).filter(
        ([, seat]) => parseBackendTime(seat.lockedUntil) > Date.now(),
      ),
    );
    const activeSeatIds = new Set(Object.keys(activeLockedSeats));
    const selectedSeatIds = (parsed.selectedSeatIds || []).filter((seatId) =>
      activeSeatIds.has(seatId),
    );

    if (Object.keys(activeLockedSeats).length === 0) {
      localStorage.removeItem(getSeatLockStorageKey(showtimeId, userKey));
      return null;
    }

    const nextSession = {
      ...parsed,
      lockedSeats: activeLockedSeats,
      selectedSeatIds,
    };
    localStorage.setItem(
      getSeatLockStorageKey(showtimeId, userKey),
      JSON.stringify(nextSession),
    );
    return nextSession;
  } catch {
    localStorage.removeItem(getSeatLockStorageKey(showtimeId, userKey));
    return null;
  }
};

const removeSeatLockSession = (showtimeId: string, userKey: string) => {
  localStorage.removeItem(getSeatLockStorageKey(showtimeId, userKey));
};

const readPaymentSession = (
  showtimeId: string,
  userKey: string,
): PaymentSession | null => {
  const rawValue = localStorage.getItem(getPaymentStorageKey(showtimeId, userKey));

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as PaymentSession;
    if (parseBackendTime(parsed.expiresAt) <= Date.now()) {
      localStorage.removeItem(getPaymentStorageKey(showtimeId, userKey));
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(getPaymentStorageKey(showtimeId, userKey));
    return null;
  }
};

const writePaymentSession = (session: PaymentSession) => {
  localStorage.setItem(
    getPaymentStorageKey(session.showtimeId, session.userKey),
    JSON.stringify(session),
  );
};

const removePaymentSession = (showtimeId: string, userKey: string) => {
  localStorage.removeItem(getPaymentStorageKey(showtimeId, userKey));
};

const getSecondsUntil = (value?: string | null, fallback = 0) => {
  const timestamp = parseBackendTime(value);

  if (!timestamp) {
    return fallback;
  }

  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
};

const getSeatHoldRemainingSeconds = (
  showtimeId: string,
  userKey: string,
  selectedSeats: CheckoutSeat[],
) => {
  const session = readSeatLockSession(showtimeId, userKey);
  const selectedExpiries = session
    ? session.selectedSeatIds
      .map((seatId) => session.lockedSeats[seatId]?.lockedUntil)
      .filter(Boolean)
    : selectedSeats.map((seat) => seat.lockedUntil).filter(Boolean);

  const earliestExpiry = selectedExpiries
    .map((value) => parseBackendTime(value))
    .filter((timestamp) => timestamp > Date.now())
    .sort((left, right) => left - right)[0];

  if (!earliestExpiry) {
    return DEFAULT_LOCK_SECONDS;
  }

  return Math.max(0, Math.ceil((earliestExpiry - Date.now()) / 1000));
};

const getSepayBankCode = (bankName: string) => {
  const normalized = bankName.toLowerCase().replace(/[\s._-]/g, "");
  const bankCodes: Record<string, string> = {
    mb: "MBBank",
    mbbank: "MBBank",
    mbb: "MBBank",
    militarybank: "MBBank",
  };

  return bankCodes[normalized] || bankName;
};

const getSeatsFromSession = (showtimeId: string, userKey: string) => {
  const session = readSeatLockSession(showtimeId, userKey);

  if (!session) {
    return [];
  }

  return session.selectedSeatIds
    .map((seatId) => session.lockedSeats[seatId])
    .filter(Boolean);
};

const getSepayQrUrl = (payment: CreatePaymentResponse | null) => {
  if (payment?.qrUrl) {
    return payment.qrUrl;
  }

  if (payment?.qrCode) {
    return payment.qrCode;
  }

  if (!payment?.bankName || !payment.bankAccount || !payment.transactionCode) {
    return "";
  }

  const query = new URLSearchParams({
    bank: getSepayBankCode(payment.bankName),
    acc: payment.bankAccount,
    amount: String(Math.round(payment.amount)),
    des: payment.transactionCode,
    template: "compact",
  });

  return `https://qr.sepay.vn/img?${query.toString()}`;
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return error instanceof Error ? error.message : fallback;
};

const isNetworkInterruption = (error: unknown) =>
  typeof error === "object"
  && error !== null
  && (!("response" in error) || (error as { response?: unknown }).response == null);

export default function Checkout() {
  const { showtimeId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as CheckoutRouteState | null;
  const resumeBooking = routeState?.resumeBooking ?? null;
  const [userKey] = useState(() => getUserKey());
  const [userProfile] = useState(() => getCurrentUserProfile());
  const [storedPaymentSession] = useState(() =>
    readPaymentSession(showtimeId, userKey),
  );
  const [checkoutAttempt, setCheckoutAttempt] = useState<CheckoutAttempt | null>(() =>
    readCheckoutAttempt(showtimeId, userKey),
  );
  const [selectedSeats] = useState<CheckoutSeat[]>(() =>
    routeState?.selectedSeats?.length
      ? routeState.selectedSeats
      : getSeatsFromSession(showtimeId, userKey),
  );
  const [seatMap] = useState<CheckoutSeatMap | null>(() => {
    if (routeState?.seatMap) {
      return routeState.seatMap;
    }

    if (storedPaymentSession?.booking || resumeBooking) {
      const currentBooking = storedPaymentSession?.booking || resumeBooking;
      return {
        showtimeId,
        movieName: currentBooking?.movieTitle,
        roomName: currentBooking?.roomName,
        cinemaName: currentBooking?.cinemaName,
        startTime: currentBooking?.startTime || undefined,
      };
    }

    return showtimeId ? { showtimeId } : null;
  });
  const [step, setStep] = useState<"extras" | "payment">(
    storedPaymentSession || resumeBooking ? "payment" : "extras",
  );
  const [seatHoldSeconds, setSeatHoldSeconds] = useState(() =>
    getSeatHoldRemainingSeconds(showtimeId, userKey, selectedSeats),
  );
  const [booking, setBooking] = useState<BookingSummary | null>(
    storedPaymentSession?.booking || resumeBooking,
  );
  const [payment, setPayment] = useState<CreatePaymentResponse | null>(
    storedPaymentSession?.payment || null,
  );
  const [paymentExpiresAt, setPaymentExpiresAt] = useState<string | null>(
    storedPaymentSession?.expiresAt || resumeBooking?.expiredAt || null,
  );
  const [paymentSeconds, setPaymentSeconds] = useState(() =>
    getSecondsUntil(
      storedPaymentSession?.expiresAt || resumeBooking?.expiredAt,
      PAYMENT_WINDOW_SECONDS,
    ),
  );
  const [submitting, setSubmitting] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paymentConfigRefreshTried, setPaymentConfigRefreshTried] = useState(false);
  const [paymentExpiredDialogOpen, setPaymentExpiredDialogOpen] =
    useState(false);
  const [copiedField, setCopiedField] = useState("");
  const [fnbCart, setFnbCart] = useState<Record<string, number>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [paymentStatusMessage, setPaymentStatusMessage] = useState("");
  const [displayDetails, setDisplayDetails] =
    useState<CheckoutDisplayDetails | null>(null);

  const seatsTotalAmount = useMemo(
    () =>
      routeState?.totalAmount ??
      selectedSeats.reduce((sum, seat) => sum + (seat.price || 0), 0),
    [routeState?.totalAmount, selectedSeats],
  );

  const fnbTotalAmount = useMemo(
    () =>
      FNB_ITEMS.reduce(
        (sum, item) => sum + (fnbCart[item.id] || 0) * item.price,
        0,
      ),
    [fnbCart],
  );

  const estimatedTotalAmount = seatsTotalAmount + fnbTotalAmount;
  const voucherDiscount = 0;
  const pointDiscount = 0;
  const payableAmount = Math.max(
    0,
    estimatedTotalAmount - voucherDiscount - pointDiscount,
  );
  const paymentQrUrl = getSepayQrUrl(payment);
  const isPaymentExpired = step === "payment" && paymentSeconds <= 0;
  const displayMovieTitle =
    booking?.movieTitle ||
    displayDetails?.title ||
    seatMap?.movieName ||
    "Đơn đặt vé";
  const displayMovieGenre = displayDetails?.genre || "Đang cập nhật";
  const displayMovieDuration = displayDetails?.duration || "Đang cập nhật";
  const displayMovieAgeRating = displayDetails?.ageRating || "P";
  const displayPosterUrl = displayDetails?.posterUrl || fallbackPoster;
  const displayCinemaName =
    booking?.cinemaName ||
    displayDetails?.cinemaName ||
    seatMap?.cinemaName ||
    "G2Cinema";
  const displayRoomName =
    booking?.roomName ||
    displayDetails?.roomName ||
    seatMap?.roomName ||
    "Phòng chiếu";
  const displayStartTime =
    booking?.startTime || displayDetails?.startTime || seatMap?.startTime;
  const selectedSeatLabels = selectedSeats.map(
    (seat) => seat.seatCode || `${seat.row}${seat.column}`,
  );
  const redirectHomeAfterPaymentExpired = useCallback(() => {
    hideExpiredBookingFromHistory(booking?.bookingId);

    if (showtimeId) {
      removePaymentSession(showtimeId, userKey);
      removeCheckoutAttempt(showtimeId, userKey);
    }

    navigate("/", { replace: true });
  }, [booking?.bookingId, navigate, showtimeId, userKey]);

  const recoverCheckoutAttempt = useCallback(async (attempt: CheckoutAttempt) => {
    const recoveryResponse = await bookingService.recoverCheckout(
      attempt.idempotencyKey,
    );

    if (!recoveryResponse.success || !recoveryResponse.data) {
      return false;
    }

    const recovery = recoveryResponse.data;
    if (recovery.bookingStatus === "PAID") {
      removeCheckoutAttempt(showtimeId, userKey);
      navigate(`/booking/success/${recovery.bookingId}`, { replace: true });
      return true;
    }

    if (recovery.bookingStatus !== "PENDING_PAYMENT") {
      removeCheckoutAttempt(showtimeId, userKey);
      setCheckoutAttempt(null);
      setErrorMessage("Đơn checkout trước đó không còn chờ thanh toán. Vui lòng chọn ghế lại.");
      return true;
    }

    const detailResponse = await bookingService.getBookingById(recovery.bookingId);
    if (!detailResponse.success || !detailResponse.data) {
      return false;
    }

    const detail = detailResponse.data;
    const recoveredBooking: BookingSummary = {
      bookingId: detail.bookingId,
      showtimeId: detail.showtimeId,
      movieTitle: detail.movieTitle,
      cinemaName: detail.cinemaName,
      roomName: detail.roomName,
      startTime: detail.startTime,
      totalAmount: detail.totalAmount,
      status: detail.status,
      createdAt: detail.createdAt,
      expiredAt: recovery.expiredAt,
    };
    const recoveredAttempt = { ...attempt, bookingId: recovery.bookingId };

    writeCheckoutAttempt(showtimeId, userKey, recoveredAttempt);
    setCheckoutAttempt(recoveredAttempt);
    setBooking(recoveredBooking);
    setPaymentExpiresAt(recovery.expiredAt || null);
    setPaymentSeconds(getSecondsUntil(recovery.expiredAt, PAYMENT_WINDOW_SECONDS));
    setStep("payment");
    setErrorMessage("");
    return true;
  }, [navigate, showtimeId, userKey]);

  useEffect(() => {
    if (!checkoutAttempt || booking) {
      return undefined;
    }

    const syncAttempt = () => {
      void recoverCheckoutAttempt(checkoutAttempt).catch(() => {
        // A missing network response is expected here; the persisted attempt
        // remains available for the next online event or manual retry.
      });
    };

    syncAttempt();
    window.addEventListener("online", syncAttempt);
    return () => window.removeEventListener("online", syncAttempt);
  }, [booking, checkoutAttempt, recoverCheckoutAttempt]);

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
        )) as unknown as {
          success: boolean;
          message?: string;
          data?: ShowtimeDetailResponse | null;
        };

        if (!isMounted) {
          return;
        }

        if (!showtimeResponse.success || !showtimeResponse.data) {
          throw new Error(showtimeResponse.message || "Không tải được suất chiếu.");
        }

        const showtime = showtimeResponse.data;
        let movie: MovieDetailResponse | null = null;

        if (showtime.movieId) {
          try {
            const movieResponse = (await api.get(
              `/api/movies/${showtime.movieId}`,
            )) as unknown as {
              success: boolean;
              data?: MovieDetailResponse | null;
            };

            if (movieResponse.success && movieResponse.data) {
              movie = movieResponse.data;
            }
          } catch (error) {
            console.warn("Không tải được thông tin phim:", error);
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
          ageRating: movie?.ageRating || undefined,
          posterUrl: getMediaUrl(movie?.posterUrl),
          cinemaName: showtime.cinemaName,
          roomName: showtime.roomName,
          startTime: showtime.startTime,
        });
      } catch (error) {
        console.warn("Không tải được thông tin checkout:", error);
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

  useEffect(() => {
    if (step === "payment") {
      return undefined;
    }

    const timer = window.setInterval(() => {
      const nextSeconds = getSeatHoldRemainingSeconds(
        showtimeId,
        userKey,
        selectedSeats,
      );
      setSeatHoldSeconds(nextSeconds);

      if (nextSeconds <= 0) {
        setErrorMessage("Ghế đã hết thời gian giữ. Vui lòng chọn lại ghế.");
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [selectedSeats, showtimeId, step, userKey]);

  useEffect(() => {
    if (step !== "payment" || !paymentExpiresAt) {
      return undefined;
    }

    const syncPaymentTimer = () => {
      setPaymentSeconds(getSecondsUntil(paymentExpiresAt));
    };
    syncPaymentTimer();

    const timer = window.setInterval(syncPaymentTimer, 1000);
    return () => window.clearInterval(timer);
  }, [paymentExpiresAt, step]);

  useEffect(() => {
    if (
      step !== "payment" ||
      !booking?.bookingId ||
      booking.status?.toUpperCase() === "PAID" ||
      paymentSeconds > 0
    ) {
      return undefined;
    }

    const openDialogTimer = window.setTimeout(() => {
      setPaymentExpiredDialogOpen(true);
    }, 0);

    const redirectTimer = window.setTimeout(() => {
      redirectHomeAfterPaymentExpired();
    }, 4000);

    return () => {
      window.clearTimeout(openDialogTimer);
      window.clearTimeout(redirectTimer);
    };
  }, [
    booking?.bookingId,
    booking?.status,
    paymentSeconds,
    redirectHomeAfterPaymentExpired,
    step,
  ]);

  useEffect(() => {
    if (
      step !== "payment" ||
      !booking?.bookingId ||
      payment?.paymentId ||
      paymentConfigRefreshTried
    ) {
      return undefined;
    }

    let cancelled = false;

    const refreshPaymentConfig = async () => {
      try {
        const response = await paymentService.createPayment({
          bookingId: booking.bookingId,
          paymentProviderId: PAYMENT_PROVIDER_ID,
        });

        if (cancelled) {
          return;
        }

        setPaymentConfigRefreshTried(true);

        if (!response.success || !response.data?.paymentId) {
          setPaymentStatusMessage(
            response.message || "Không thể tải lại cấu hình thanh toán.",
          );
          return;
        }

        const refreshedPayment = response.data;
        const expiresAt =
          refreshedPayment.expiresAt ||
          paymentExpiresAt ||
          new Date(Date.now() + PAYMENT_WINDOW_SECONDS * 1000).toISOString();

        setPayment(refreshedPayment);
        setPaymentExpiresAt(expiresAt);
        setPaymentSeconds(getSecondsUntil(expiresAt, PAYMENT_WINDOW_SECONDS));
        writePaymentSession({
          showtimeId,
          userKey,
          booking,
          payment: refreshedPayment,
          expiresAt,
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        if (!cancelled) {
          setPaymentConfigRefreshTried(true);
          setPaymentStatusMessage(
            getApiErrorMessage(error, "Không thể tải lại cấu hình thanh toán."),
          );
        }
      }
    };

    void refreshPaymentConfig();

    return () => {
      cancelled = true;
    };
  }, [
    booking,
    payment,
    paymentConfigRefreshTried,
    paymentExpiresAt,
    showtimeId,
    step,
    userKey,
  ]);

  useEffect(() => {
    if (step !== "payment" || !booking?.bookingId) {
      return undefined;
    }

    let cancelled = false;

    const syncBookingStatus = async () => {
      try {
        const response = await bookingService.getBookingById(booking.bookingId);
        if (cancelled || !response.success || !response.data) {
          return;
        }

        setBooking((current) =>
          current
            ? {
              ...current,
              status: response.data.status,
              movieTitle: response.data.movieTitle || current.movieTitle,
              cinemaName: response.data.cinemaName || current.cinemaName,
              roomName: response.data.roomName || current.roomName,
              startTime: response.data.startTime || current.startTime,
              totalAmount: response.data.totalAmount || current.totalAmount,
            }
            : current,
        );

        if (response.data.status === "PAID") {
          removePaymentSession(showtimeId, userKey);
          removeCheckoutAttempt(showtimeId, userKey);
          navigate(`/booking/success/${booking.bookingId}`, { replace: true });
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Khong the dong bo trang thai thanh toan:", error);
        }
      }
    };

    const timer = window.setInterval(() => {
      void syncBookingStatus();
    }, PAYMENT_STATUS_POLL_MS);

    void syncBookingStatus();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [booking?.bookingId, navigate, showtimeId, step, userKey]);

  const handleQuantityChange = (itemId: string, delta: number) => {
    setFnbCart((current) => ({
      ...current,
      [itemId]: Math.max(0, (current[itemId] || 0) + delta),
    }));
  };

  const handleCopy = async (value: string, field: string) => {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(""), 1600);
    } catch {
      setErrorMessage("Không thể sao chép tự động. Vui lòng copy thủ công.");
    }
  };

  const handleCheckPaymentStatus = async () => {
    if (!booking?.bookingId) {
      return;
    }

    try {
      setCheckingPayment(true);
      setPaymentStatusMessage("");
      const response = await bookingService.getBookingById(booking.bookingId);

      if (!response.success || !response.data) {
        throw new Error(response.message || "Không thể kiểm tra trạng thái thanh toán.");
      }

      setBooking((current) =>
        current
          ? {
            ...current,
            status: response.data.status,
            movieTitle: response.data.movieTitle || current.movieTitle,
            cinemaName: response.data.cinemaName || current.cinemaName,
            roomName: response.data.roomName || current.roomName,
            startTime: response.data.startTime || current.startTime,
            totalAmount: response.data.totalAmount || current.totalAmount,
          }
          : current,
      );

      if (response.data.status === "PAID") {
        removePaymentSession(showtimeId, userKey);
        removeCheckoutAttempt(showtimeId, userKey);
        navigate(`/booking/success/${booking.bookingId}`, { replace: true });
        return;
      }

      setPaymentStatusMessage(
        "Hệ thống chưa nhận được webhook thanh toán. Vui lòng chờ thêm vài giây rồi kiểm tra lại.",
      );
    } catch (error) {
      setPaymentStatusMessage(
        getApiErrorMessage(error, "Không thể kiểm tra trạng thái thanh toán."),
      );
    } finally {
      setCheckingPayment(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!showtimeId || selectedSeats.length === 0) {
      setErrorMessage("Không tìm thấy thông tin ghế đã chọn.");
      return;
    }

    if (seatHoldSeconds <= 0) {
      setErrorMessage("Ghế đã hết thời gian giữ. Vui lòng chọn lại ghế.");
      return;
    }

    const showtimeSeatIds = selectedSeats
      .map((seat) => seat.showtimeSeatId)
      .filter(Boolean);

    if (showtimeSeatIds.length !== selectedSeats.length) {
      setErrorMessage("Dữ liệu ghế chưa hợp lệ. Vui lòng quay lại chọn ghế.");
      return;
    }

    let activeAttempt: CheckoutAttempt | null = null;

    try {
      setSubmitting(true);
      setErrorMessage("");

      const foodItems = Object.entries(fnbCart)
        .filter(([, quantity]) => quantity > 0)
        .map(([fbItemId, quantity]) => ({ fbItemId, quantity }));

      const checkoutPayload: CheckoutPayload = {
        showtimeId,
        showtimeSeatIds,
        foodItems: foodItems.length > 0 ? foodItems : undefined,
      };
      const attempt = checkoutAttempt && isSameCheckoutRequest(checkoutAttempt.request, checkoutPayload)
        ? checkoutAttempt
        : {
          version: 1,
          idempotencyKey: crypto.randomUUID(),
          request: checkoutPayload,
          createdAt: new Date().toISOString(),
        };

      writeCheckoutAttempt(showtimeId, userKey, attempt);
      setCheckoutAttempt(attempt);
      activeAttempt = attempt;

      const checkoutResponse = await bookingService.checkout(
        checkoutPayload,
        attempt.idempotencyKey,
      );

      if (!checkoutResponse.success || !checkoutResponse.data?.bookingId) {
        throw new Error(checkoutResponse.message || "Không thể tạo đơn đặt vé.");
      }

      const checkout = checkoutResponse.data;
      const nextBooking: BookingSummary = {
        bookingId: checkout.bookingId,
        showtimeId: checkout.showtimeId,
        movieTitle: seatMap?.movieName,
        cinemaName: seatMap?.cinemaName,
        roomName: seatMap?.roomName,
        startTime: seatMap?.startTime || null,
        totalAmount: checkout.totalAmount,
        status: checkout.bookingStatus,
        createdAt: new Date().toISOString(),
        expiredAt: checkout.expiredAt,
      };
      const bookedAttempt = { ...attempt, bookingId: nextBooking.bookingId };
      writeCheckoutAttempt(showtimeId, userKey, bookedAttempt);
      setCheckoutAttempt(bookedAttempt);

      const paymentResponse = await paymentService.createPayment({
        bookingId: nextBooking.bookingId,
        paymentProviderId: PAYMENT_PROVIDER_ID,
      });

      if (!paymentResponse.success || !paymentResponse.data?.paymentId) {
        throw new Error(
          paymentResponse.message || "Không thể khởi tạo thanh toán.",
        );
      }

      const fallbackExpiresAt = new Date(
        Date.now() + PAYMENT_WINDOW_SECONDS * 1000,
      ).toISOString();
      const expiresAt = paymentResponse.data.expiresAt || fallbackExpiresAt;

      const nextSession: PaymentSession = {
        showtimeId,
        userKey,
        booking: nextBooking,
        payment: paymentResponse.data,
        expiresAt,
        createdAt: new Date().toISOString(),
      };

      writePaymentSession(nextSession);
      removeSeatLockSession(showtimeId, userKey);
      setBooking(nextBooking);
      setPayment(paymentResponse.data);
      setPaymentExpiresAt(expiresAt);
      setPaymentSeconds(getSecondsUntil(expiresAt, PAYMENT_WINDOW_SECONDS));
      setStep("payment");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      if (isNetworkInterruption(error) && activeAttempt) {
        const recovered = await recoverCheckoutAttempt(activeAttempt);
        if (!recovered) {
          setErrorMessage(
            "Kết nối bị gián đoạn. Checkout đã được lưu; hệ thống sẽ đồng bộ lại khi có mạng hoặc khi bạn bấm tiếp tục.",
          );
        }
        return;
      }
      console.error("Lỗi tạo thanh toán:", error);
      setErrorMessage(getApiErrorMessage(error, "Đã có lỗi xảy ra khi tạo thanh toán."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!storedPaymentSession && !resumeBooking && selectedSeats.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#182437] p-6 text-center text-white">
        <p className="text-sm font-bold text-rose-300">
          Không tìm thấy thông tin đặt vé. Vui lòng quay lại chọn ghế.
        </p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="rounded-lg bg-[#FFD166] px-5 py-2.5 text-xs font-black uppercase text-black"
        >
          Về trang chủ
        </button>
      </div>
    );
  }

  if (step === "payment" && booking) {
    return (
      <div className="min-h-screen bg-[#182437] px-4 py-6 text-white sm:px-6">
        <div className="mx-auto w-full max-w-[1180px]">
          <p className="mb-5 text-xs font-black text-[#FFD166]">
            Trang chủ &gt; Đặt vé &gt; Thanh toán QR
          </p>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-lg border border-white/10 bg-[#111C44] p-5 shadow-2xl sm:p-7">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#FFD166]">
                    <FaQrcode />
                    Thanh toán bằng mã QR
                  </div>
                  <h1 className="mt-2 text-2xl font-black">
                    Cảm ơn bạn đã đặt vé
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                    Đơn hàng của bạn đã được tạo. Quét mã QR bên dưới bằng ứng dụng
                    ngân hàng và giữ nguyên nội dung chuyển khoản để hệ thống tự
                    xác nhận vé.
                  </p>
                </div>
                <div className="rounded-md border border-[#FFD166]/30 bg-[#FFD166]/10 px-5 py-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#FFD166]">
                    Thời gian còn lại
                  </p>
                  <p className="mt-1 font-mono text-3xl font-black text-white">
                    {formatTimer(paymentSeconds)}
                  </p>
                </div>
              </div>

              <div className="mt-7 grid gap-6 xl:grid-cols-[310px_minmax(0,1fr)]">
                <div className="rounded-lg border border-white/10 bg-[#0D1637] p-4">
                  <div className="flex aspect-square items-center justify-center rounded-md bg-white p-4">
                    {paymentQrUrl ? (
                      <img
                        src={paymentQrUrl}
                        alt="QR thanh toán SePay"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-sm font-bold text-slate-700">
                        QR sẽ hiển thị khi BE có cấu hình ngân hàng.
                      </div>
                    )}
                  </div>
                  <div className="mt-4 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <FaRegCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                      <p className="text-sm font-semibold leading-5 text-emerald-50">
                        Sau khi thanh toán, vé sẽ được xác nhận tự động. Bạn cũng có
                        thể bấm kiểm tra nếu ngân hàng đã trừ tiền.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-white/10 bg-[#0D1637] p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Mã đơn
                      </p>
                      <p className="mt-1 break-all font-mono text-sm font-black">
                        {booking.bookingId}
                      </p>
                    </div>
                    <div className="rounded-md border border-white/10 bg-[#0D1637] p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Số tiền
                      </p>
                      <p className="mt-1 text-2xl font-black text-[#FFD166]">
                        {formatCurrency(payment?.amount ?? booking.totalAmount)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-md border border-white/10 bg-[#0D1637] p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Ngân hàng nhận
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-slate-400">Ngân hàng</p>
                        <p className="mt-1 font-bold">
                          {payment?.bankName || "Đang cấu hình"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Chủ tài khoản</p>
                        <p className="mt-1 font-bold">
                          {payment?.accountName || "G2Cinema"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border border-white/10 bg-[#0D1637] p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Số tài khoản
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="break-all font-mono text-lg font-black">
                        {payment?.bankAccount || "Đang cấu hình"}
                      </p>
                      {payment?.bankAccount && (
                        <button
                          type="button"
                          title="Sao chép số tài khoản"
                          onClick={() =>
                            void handleCopy(payment.bankAccount, "account")
                          }
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white transition hover:border-[#FFD166] hover:text-[#FFD166]"
                        >
                          {copiedField === "account" ? <FaCheck /> : <FaCopy />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-md border border-blue-400/30 bg-blue-950/30 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-blue-100">
                      Nội dung chuyển khoản
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="break-all font-mono text-xl font-black text-blue-50">
                        {payment?.transactionCode || "Đang tạo mã giao dịch..."}
                      </p>
                      {payment?.transactionCode && (
                        <button
                          type="button"
                          title="Sao chép nội dung chuyển khoản"
                          onClick={() =>
                            void handleCopy(payment.transactionCode, "content")
                          }
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-blue-300/40 bg-blue-400/10 text-blue-50 transition hover:bg-blue-400/20"
                        >
                          {copiedField === "content" ? <FaCheck /> : <FaCopy />}
                        </button>
                      )}
                    </div>
                  </div>

                  {paymentStatusMessage && (
                    <p className="rounded-md border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm font-bold text-amber-100">
                      {paymentStatusMessage}
                    </p>
                  )}
                  {isPaymentExpired && (
                    <p className="rounded-md border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm font-bold text-rose-200">
                      Mã thanh toán đã hết hạn. Vui lòng tạo lại đơn đặt vé mới.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void handleCheckPaymentStatus()}
                  disabled={checkingPayment}
                  className="flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#FFD166] to-[#FFE7A3] px-5 py-3 text-center text-xs font-black uppercase tracking-wider text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <FaSyncAlt className={checkingPayment ? "animate-spin" : ""} />
                  {checkingPayment ? "Đang kiểm tra..." : "Tôi đã thanh toán"}
                </button>
                <Link
                  to="/my-bookings"
                  className="rounded-md bg-slate-700 px-5 py-3 text-center text-xs font-black uppercase tracking-wider text-white transition hover:bg-slate-600"
                >
                  Vé của tôi
                </Link>
              </div>
            </section>

            <aside className="h-fit rounded-lg border border-white/10 bg-[#111C44] p-4 shadow-2xl lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-lg bg-slate-900">
                <img
                  src={displayPosterUrl}
                  alt={displayMovieTitle}
                  className="aspect-[2/3] w-full object-cover"
                  onError={(event) => {
                    if (event.currentTarget.src !== fallbackPoster) {
                      event.currentTarget.src = fallbackPoster;
                    }
                  }}
                />
              </div>

              <div className="mt-5 space-y-3 text-sm">
                <h2 className="text-xl font-black">{displayMovieTitle}</h2>
                <div className="flex items-start gap-2 text-slate-300">
                  <FaMapMarkerAlt className="mt-0.5 shrink-0 text-[#FFD166]" />
                  <span>
                    <b>Rạp chiếu</b>
                    <br />
                    {displayCinemaName}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-slate-300">
                  <FaClock className="mt-0.5 shrink-0 text-[#FFD166]" />
                  <span>
                    <b>Ngày chiếu</b>
                    <br />
                    {formatDateTime(displayStartTime)}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-slate-300">
                  <FaTicketAlt className="mt-0.5 shrink-0 text-[#FFD166]" />
                  <span>
                    <b>Ghế ngồi</b>
                    <br />
                    {selectedSeatLabels.length > 0
                      ? selectedSeatLabels.join(", ")
                      : "Đang cập nhật"}
                  </span>
                </div>
                <div className="rounded-md border border-white/10 bg-[#0D1637] p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Tổng thanh toán
                  </p>
                  <p className="mt-1 text-2xl font-black text-[#FFD166]">
                    {formatCurrency(payment?.amount ?? booking.totalAmount)}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {paymentExpiredDialogOpen && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg border border-rose-400/30 bg-[#111C44] p-6 text-center text-white shadow-2xl">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/15 text-2xl text-rose-200">
                <FaClock />
              </div>
              <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-rose-200">
                Hết thời gian đặt vé
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Đơn đặt vé đã quá 10 phút
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Thời gian thanh toán đã kết thúc. Hệ thống sẽ tự chuyển bạn về
                trang chủ để chọn lại suất chiếu và ghế mới.
              </p>
              <button
                type="button"
                onClick={redirectHomeAfterPaymentExpired}
                className="mt-6 w-full rounded-md bg-[#FFD166] px-5 py-3 text-xs font-black uppercase tracking-wider text-black transition hover:bg-[#FFE7A3]"
              >
                Về trang chủ ngay
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[#182437] px-4 py-5 text-white sm:px-6">
      <div className="mx-auto w-full max-w-[1180px]">
        <p className="mb-5 text-xs font-black text-[#FFD166]">
          Trang chủ &gt; Đặt vé &gt; {displayMovieTitle}
        </p>

        {errorMessage && (
          <div className="mb-5 rounded-md border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm font-bold text-rose-200">
            {errorMessage}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_330px]">
          <section className="min-w-0">
            <div className="mb-8">
              <div className="mb-4 flex items-center gap-2 text-base font-black uppercase">
                <FaUserCircle className="h-6 w-6 text-white/90" />
                Thông tin thanh toán
              </div>
              <div className="grid gap-4 text-xs sm:grid-cols-3">
                <div>
                  <p className="font-black">Họ Tên:</p>
                  <p className="mt-1 text-slate-300">
                    {userProfile?.fullName || "Thành viên G2Cinema"}
                  </p>
                </div>
                <div>
                  <p className="font-black">Số Điện Thoại:</p>
                  <p className="mt-1 text-slate-300">Đang cập nhật</p>
                </div>
                <div>
                  <p className="font-black">Email:</p>
                  <p className="mt-1 break-all text-slate-300">
                    {userProfile?.email || "Đang cập nhật"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6 flex items-center justify-between border-b border-white/15 pb-3 text-xs">
              <p className="font-black">Ghế đã chọn</p>
              <p className="text-slate-300">
                {selectedSeatLabels.join(", ")}{" "}
                <span className="ml-4 text-white">
                  {formatCurrency(seatsTotalAmount)}
                </span>
              </p>
            </div>

            <div>
              <div className="mb-4 flex items-center gap-2 text-base font-black uppercase">
                <FaReceipt className="h-5 w-5 text-white/90" />
                Combo ưu đãi
              </div>

              <div className="mb-2 grid grid-cols-[1fr_110px] px-2 text-xs font-black">
                <span>Tên combo</span>
                <span className="text-center">Số lượng</span>
              </div>

              <div className="divide-y divide-white/20">
                {FNB_ITEMS.map((item) => {
                  const quantity = fnbCart[item.id] || 0;

                  return (
                    <div
                      key={item.id}
                      className="grid gap-4 py-5 sm:grid-cols-[1fr_110px] sm:items-center"
                    >
                      <div className="flex min-w-0 gap-4">
                        <div
                          className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${item.accent} p-1 shadow-lg`}
                        >
                          <div className="flex h-full w-full flex-col items-center justify-center rounded-full border-2 border-white bg-slate-900/15 text-center">
                            <FaGift className="mb-1 h-5 w-5 text-white" />
                            <span className="px-2 text-[8px] font-black uppercase leading-tight text-white">
                              {item.badge}
                            </span>
                          </div>
                        </div>
                        <div className="min-w-0 pt-1">
                          <h3 className="text-sm font-black text-blue-400">
                            {item.name}
                          </h3>
                          <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-300">
                            {item.desc}
                          </p>
                          <p className="mt-1 text-xs font-black text-[#FFD166]">
                            {formatCurrency(item.price)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-start gap-3 sm:justify-center">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.id, -1)}
                          disabled={quantity === 0}
                          className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-500 text-white transition hover:bg-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Giảm ${item.name}`}
                        >
                          <FaMinus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center text-sm font-black">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.id, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white transition hover:bg-blue-500"
                          aria-label={`Tăng ${item.name}`}
                        >
                          <FaPlus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-7">
              <div className="mb-4 flex items-center gap-2 text-base font-black">
                <FaGift className="h-5 w-5 text-white/90" />
                Giảm giá
              </div>

              <div className="space-y-4 border-b border-white/10 pb-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-black">G2C Voucher</span>
                  <span className="text-xs text-slate-400">Chưa có voucher khả dụng</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-black">G2C Point</span>
                  <span className="text-xs text-slate-400">0 điểm có thể dùng</span>
                </div>
              </div>
            </div>

            <div className="mt-7">
              <div className="mb-4 flex items-center gap-2 text-base font-black uppercase">
                <FaQrcode className="h-5 w-5 text-white/90" />
                Phương thức thanh toán
              </div>
              <p className="mb-3 text-xs font-bold text-slate-300">
                Chọn thẻ thanh toán
              </p>
              <div className="flex w-fit items-center gap-3 rounded-md border border-blue-400 bg-blue-500/10 px-4 py-3">
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-blue-300">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                </span>
                <FaQrcode className="h-7 w-7 text-white" />
                <span className="text-sm font-black">Mã QR</span>
              </div>
            </div>

            <div className="mt-7 grid gap-4 border-t border-white/10 pt-5 lg:grid-cols-[1fr_230px] lg:items-end">
              <div className="space-y-1 text-[11px] font-bold text-white">
                <p>*Bạn vui lòng kiểm tra thông tin đầy đủ trước khi bước qua bước tiếp theo</p>
                <p>*Vé đã được thanh toán sẽ không được hoàn trả</p>
              </div>

              <div className="space-y-1 text-right text-xs">
                <div className="flex justify-between gap-5">
                  <span className="text-slate-300">Tổng tiền:</span>
                  <span className="font-black text-red-400">
                    {formatCurrency(estimatedTotalAmount)}
                  </span>
                </div>
                <div className="flex justify-between gap-5">
                  <span className="text-slate-300">Số tiền được giảm:</span>
                  <span className="font-black">{formatCurrency(voucherDiscount)}</span>
                </div>
                <div className="flex justify-between gap-5">
                  <span className="text-slate-300">Số tiền cần thanh toán:</span>
                  <span className="font-black text-red-400">
                    {formatCurrency(payableAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mx-auto mt-6 w-fit rounded-md border border-white/10 bg-[#0D1637] px-9 py-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Thời gian còn lại
              </p>
              <p className="mt-1 font-mono text-3xl font-black">
                {formatTimer(seatHoldSeconds)}
              </p>
            </div>
          </section>

          <aside className="h-fit rounded-lg border border-white/10 bg-[#111C44] p-4 shadow-2xl lg:sticky lg:top-24">
            <div className="mx-auto max-w-[220px] overflow-hidden rounded-lg bg-slate-900">
              <img
                src={displayPosterUrl}
                alt={displayMovieTitle}
                className="aspect-[2/3] w-full object-cover"
                onError={(event) => {
                  if (event.currentTarget.src !== fallbackPoster) {
                    event.currentTarget.src = fallbackPoster;
                  }
                }}
              />
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-start gap-2 text-slate-300">
                <FaTicketAlt className="mt-0.5 shrink-0 text-[#FFD166]" />
                <span>
                  <b>Thể loại</b>
                  <br />
                  {displayMovieGenre}
                </span>
              </div>
              <div className="flex items-start gap-2 text-slate-300">
                <FaClock className="mt-0.5 shrink-0 text-[#FFD166]" />
                <span>
                  <b>Thời lượng</b>
                  <br />
                  {displayMovieDuration}
                </span>
              </div>
              <div className="flex items-start gap-2 text-slate-300">
                <FaMapMarkerAlt className="mt-0.5 shrink-0 text-[#FFD166]" />
                <span>
                  <b>Rạp chiếu</b>
                  <br />
                  {displayCinemaName}
                  <br />
                  <span className="text-slate-400">{displayRoomName}</span>
                </span>
              </div>
              <div className="flex items-start gap-2 text-slate-300">
                <FaClock className="mt-0.5 shrink-0 text-[#FFD166]" />
                <span>
                  <b>Ngày chiếu</b>
                  <br />
                  {formatDateTime(displayStartTime)}
                </span>
              </div>
              <div className="flex items-start gap-2 text-slate-300">
                <FaReceipt className="mt-0.5 shrink-0 text-[#FFD166]" />
                <span>
                  <b>Ghế ngồi</b>
                  <br />
                  <span className="font-black text-blue-400">
                    {selectedSeatLabels.join(", ")}
                  </span>
                </span>
              </div>
              <div className="rounded-md border border-white/10 bg-[#0D1637] p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Phân loại
                </p>
                <p className="mt-1 font-black text-[#FFD166]">
                  {displayMovieAgeRating}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => navigate(`/booking/seats/${showtimeId}`)}
                className="rounded-md bg-slate-600 py-3 text-xs font-black uppercase text-white transition hover:bg-slate-500"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={() => void handleCreatePayment()}
                disabled={submitting || seatHoldSeconds <= 0}
                className={`rounded-md py-3 text-xs font-black uppercase transition ${submitting || seatHoldSeconds <= 0
                  ? "cursor-not-allowed bg-slate-700 text-slate-400"
                  : "bg-[#FFD166] text-white hover:bg-[#FFE7A3] hover:text-slate-950"
                  }`}
              >
                {submitting ? "Đang tạo..." : "Tiếp tục"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

