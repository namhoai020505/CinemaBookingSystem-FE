import { useEffect, useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaClock,
  FaCreditCard,
  FaExclamationCircle,
  FaFilm,
  FaQrcode,
  FaReceipt,
  FaRegCheckCircle,
  FaTicketAlt,
  FaTimesCircle,
  FaWallet,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import ConfirmDialog from "../../components/ConfirmDialog";
import { getCurrentUserProfile } from "../../lib/auth";
import {
  bookingService,
  shouldHideBookingFromHistory,
  type BookingSummary,
} from "../../services/bookingService";
import { removeCheckoutAttempt } from "../../services/checkoutAttempt";

type BookingFilter = "ALL" | "PENDING_PAYMENT" | "PAID";

const FILTERS: { id: BookingFilter; label: string }[] = [
  { id: "ALL", label: "Tất cả" },
  { id: "PENDING_PAYMENT", label: "Chờ thanh toán" },
  { id: "PAID", label: "Đã thanh toán" },
];

const normalizeBackendDate = (value?: string | null) => {
  if (!value) {
    return "";
  }
  return value.replace(/(?:z|[+-]\d{2}:\d{2})$/i, "");
};

const parseBackendDate = (value?: string | null) => {
  const clean = normalizeBackendDate(value);
  if (!clean) return 0;
  const timestamp = Date.parse(clean);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + " đ";

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "Đang cập nhật";
  }

  const clean = normalizeBackendDate(value);
  const [datePart, timePart = ""] = clean.includes("T")
    ? clean.split("T")
    : clean.split(" ");
  const [year, month, date] = datePart ? datePart.split("-") : [];
  const shortTime = timePart ? timePart.substring(0, 5) : "";

  if (year && month && date && shortTime) {
    return `${shortTime} ${date}/${month}/${year}`;
  }

  const timestamp = parseBackendDate(value);
  if (timestamp === 0) {
    return "Đang cập nhật";
  }

  return new Date(timestamp).toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const formatShortDate = (value?: string | null) => {
  if (!value) return "--/--";
  const clean = normalizeBackendDate(value);
  const [datePart] = clean.split("T");
  const [, month, date] = datePart ? datePart.split("-") : [];
  if (date && month) return `${date}/${month}`;
  return "--/--";
};

const formatWeekday = (value?: string | null) => {
  if (!value) return "Ngày chiếu";
  const clean = normalizeBackendDate(value);
  const [datePart] = clean.split("T");
  const [year, month, date] = datePart ? datePart.split("-").map(Number) : [];
  if (year && month && date) {
    const d = new Date(year, month - 1, date);
    return d.toLocaleDateString("vi-VN", { weekday: "short" });
  }
  return "Ngày chiếu";
};

const formatShortTime = (value?: string | null) => {
  if (!value) return "--:--";
  const clean = normalizeBackendDate(value);
  const [, timePart = ""] = clean.split("T");
  if (timePart) return timePart.substring(0, 5);
  return "--:--";
};

const getShortBookingId = (bookingId: string) => {
  if (bookingId.length <= 18) {
    return bookingId;
  }

  return `${bookingId.slice(0, 10)}...${bookingId.slice(-6)}`;
};

const getStatusMeta = (status: string) => {
  const normalizedStatus = status.toUpperCase();

  if (normalizedStatus === "PAID") {
    return {
      label: "Đã thanh toán",
      icon: <FaRegCheckCircle />,
      badgeClass:
        "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
      cardAccent: "from-emerald-400/20 to-transparent",
    };
  }

  if (normalizedStatus === "PENDING_PAYMENT") {
    return {
      label: "Chờ thanh toán",
      icon: <FaClock />,
      badgeClass: "border-amber-400/40 bg-amber-500/15 text-amber-200",
      cardAccent: "from-amber-400/20 to-transparent",
    };
  }

  if (normalizedStatus === "CANCELLED" || normalizedStatus === "CANCELED") {
    return {
      label: "Đã hủy",
      icon: <FaExclamationCircle />,
      badgeClass: "border-rose-400/40 bg-rose-500/15 text-rose-200",
      cardAccent: "from-rose-400/20 to-transparent",
    };
  }

  if (normalizedStatus === "EXPIRED") {
    return {
      label: "Hết hạn",
      icon: <FaExclamationCircle />,
      badgeClass: "border-slate-400/40 bg-slate-500/15 text-slate-200",
      cardAccent: "from-slate-400/20 to-transparent",
    };
  }

  return {
    label: status || "Đang xử lý",
    icon: <FaReceipt />,
    badgeClass: "border-blue-400/40 bg-blue-500/15 text-blue-200",
    cardAccent: "from-blue-400/20 to-transparent",
  };
};

const getPaymentDeadlineLabel = (expiredAt?: string | null) => {
  const expiredTimestamp = parseBackendDate(expiredAt);

  if (expiredTimestamp === 0) {
    return "";
  }

  const remainingMs = expiredTimestamp - Date.now();

  if (remainingMs <= 0) {
    return "Đã hết hạn thanh toán";
  }

  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `Còn ${hours} giờ ${minutes} phút để thanh toán`;
  }

  return `Còn ${minutes} phút để thanh toán`;
};

const isPendingPayment = (booking: BookingSummary) =>
  booking.status.toUpperCase() === "PENDING_PAYMENT";

const isPaid = (booking: BookingSummary) =>
  booking.status.toUpperCase() === "PAID";

const getUserKey = () => {
  const profile = getCurrentUserProfile();
  return profile?.userId || profile?.email || "anonymous";
};

const getPaymentStorageKey = (showtimeId: string) =>
  `g2c-payment:${getUserKey()}:${showtimeId}`;

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

export default function MyBookings() {
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeFilter, setActiveFilter] = useState<BookingFilter>("ALL");
  const [cancellingBookingId, setCancellingBookingId] = useState("");
  const [cancelTargetBooking, setCancelTargetBooking] =
    useState<BookingSummary | null>(null);

  useEffect(() => {
    const fetchMyBookings = async () => {
      try {
        const response = await bookingService.getMyBookings();
        if (!response.success) {
          throw new Error(response.message || "Không tải được danh sách vé.");
        }

        setBookings(response.data || []);
      } catch (error) {
        console.error("Lỗi khi lấy danh sách vé:", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không tải được danh sách vé.",
        );
      } finally {
        setLoading(false);
      }
    };

    void fetchMyBookings();
  }, []);

  const sortedBookings = useMemo(
    () =>
      [...bookings].sort(
        (current, next) =>
          parseBackendDate(next.createdAt) - parseBackendDate(current.createdAt),
      ),
    [bookings],
  );

  const visibleBookings = useMemo(
    () =>
      sortedBookings.filter(
        (booking) => !shouldHideBookingFromHistory(booking),
      ),
    [sortedBookings],
  );

  const filteredBookings = useMemo(() => {
    if (activeFilter === "ALL") {
      return visibleBookings;
    }

    return visibleBookings.filter(
      (booking) => booking.status.toUpperCase() === activeFilter,
    );
  }, [activeFilter, visibleBookings]);

  const stats = useMemo(() => {
    const paidBookings = visibleBookings.filter(isPaid);
    const pendingBookings = visibleBookings.filter(isPendingPayment);

    return {
      total: visibleBookings.length,
      paid: paidBookings.length,
      pending: pendingBookings.length,
      totalSpent: paidBookings.reduce(
        (sum, booking) => sum + booking.totalAmount,
        0,
      ),
    };
  }, [visibleBookings]);

  const filterCounts: Record<BookingFilter, number> = {
    ALL: visibleBookings.length,
    PENDING_PAYMENT: stats.pending,
    PAID: stats.paid,
  };

  const handleCancelBooking = async (booking: BookingSummary) => {
    if (cancellingBookingId) {
      return;
    }

    try {
      setCancellingBookingId(booking.bookingId);
      setErrorMessage("");
      await bookingService.cancelPendingBooking(booking.bookingId);
      localStorage.removeItem(getPaymentStorageKey(booking.showtimeId));
      removeCheckoutAttempt(booking.showtimeId, getUserKey());
      setBookings((currentBookings) =>
        currentBookings.map((currentBooking) =>
          currentBooking.bookingId === booking.bookingId
            ? { ...currentBooking, status: "CANCELLED" }
            : currentBooking,
        ),
      );
      setCancelTargetBooking(null);
    } catch (error) {
      console.error("Lỗi hủy giao dịch:", error);
      setErrorMessage(getApiErrorMessage(error, "Không thể hủy giao dịch. Vui lòng thử lại."));
    } finally {
      setCancellingBookingId("");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#162338] px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 h-20 animate-pulse rounded-lg bg-white/5" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-lg bg-white/5"
              />
            ))}
          </div>
          <div className="mt-8 space-y-4">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="h-44 animate-pulse rounded-lg bg-white/5"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#162338] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="border-b border-white/10 pb-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FFD166]">
            Tài khoản
          </p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black leading-tight md:text-4xl">
                Vé của tôi
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Theo dõi vé đã mua, hoàn tất vé đang chờ thanh toán và mở mã QR
                khi đến rạp.
              </p>
            </div>
            <Link
              to="/"
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#FFD166]/40 px-4 py-2.5 text-sm font-black text-[#FFD166] transition hover:bg-[#FFD166] hover:text-black"
            >
              <FaFilm />
              Đặt vé mới
            </Link>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-[#0f1b35] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Tổng vé
              </p>
              <span className="rounded-lg bg-blue-500/15 p-3 text-blue-200">
                <FaTicketAlt />
              </span>
            </div>
            <p className="mt-4 text-3xl font-black">{stats.total}</p>
            <p className="mt-1 text-sm text-slate-400">giao dịch đặt vé</p>
          </div>

          <div className="rounded-lg border border-emerald-400/20 bg-[#0f1b35] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Đã thanh toán
              </p>
              <span className="rounded-lg bg-emerald-500/15 p-3 text-emerald-200">
                <FaRegCheckCircle />
              </span>
            </div>
            <p className="mt-4 text-3xl font-black">{stats.paid}</p>
            <p className="mt-1 text-sm text-slate-400">vé sẵn sàng sử dụng</p>
          </div>

          <div className="rounded-lg border border-amber-400/20 bg-[#0f1b35] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Tổng đã chi
              </p>
              <span className="rounded-lg bg-amber-500/15 p-3 text-amber-200">
                <FaWallet />
              </span>
            </div>
            <p className="mt-4 text-3xl font-black text-[#FFD166]">
              {formatCurrency(stats.totalSpent)}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              tính trên vé đã thanh toán
            </p>
          </div>
        </section>

        {errorMessage && (
          <div className="mt-6 flex gap-3 rounded-lg border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm font-bold text-rose-100">
            <FaExclamationCircle className="mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <section className="mt-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black">Danh sách vé</h2>
              <p className="mt-1 text-sm text-slate-400">
                {visibleBookings.length > 0
                  ? `${filteredBookings.length} vé đang hiển thị`
                  : "Bạn chưa có giao dịch đặt vé nào."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-[#0f1b35] p-1.5">
              {FILTERS.map((filter) => {
                const isActive = activeFilter === filter.id;

                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setActiveFilter(filter.id)}
                    className={`rounded-md px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                      isActive
                        ? "bg-[#FFD166] text-black"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {filter.label}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 ${
                        isActive ? "bg-black/15" : "bg-white/10"
                      }`}
                    >
                      {filterCounts[filter.id]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="mt-5 rounded-lg border border-white/10 bg-[#101c34] p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-2xl text-[#FFD166]">
                <FaTicketAlt />
              </div>
              <h3 className="mt-4 text-xl font-black">
                Chưa có vé trong mục này
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                Khi bạn đặt vé hoặc hoàn tất thanh toán, thông tin sẽ xuất hiện
                ở đây để bạn mở lại nhanh hơn.
              </p>
              <Link
                to="/"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#FFD166] px-5 py-3 text-sm font-black text-black transition hover:bg-[#FFE7A3]"
              >
                <FaFilm />
                Khám phá phim
              </Link>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {filteredBookings.map((booking) => {
                const statusMeta = getStatusMeta(booking.status);
                const deadlineLabel = getPaymentDeadlineLabel(
                  booking.expiredAt,
                );
                const pendingPayment = isPendingPayment(booking);

                return (
                  <article
                    key={booking.bookingId}
                    className="overflow-hidden rounded-lg border border-white/10 bg-[#101c34] shadow-xl"
                  >
                    <div
                      className={`h-1 bg-gradient-to-r ${statusMeta.cardAccent}`}
                    />
                    <div className="grid gap-5 p-5 lg:grid-cols-[116px_1fr_auto] lg:p-6">
                      <div className="flex items-center gap-4 lg:block">
                        <div className="rounded-lg border border-white/10 bg-[#17264a] p-4 text-center">
                          <p className="text-xs font-black uppercase text-slate-400">
                            {formatWeekday(booking.startTime)}
                          </p>
                          <p className="mt-2 text-2xl font-black text-white">
                            {formatShortDate(booking.startTime)}
                          </p>
                          <p className="mt-1 text-sm font-black text-[#FFD166]">
                            {formatShortTime(booking.startTime)}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase lg:mt-3 ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.icon}
                          {statusMeta.label}
                        </span>
                      </div>

                      <div>
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-2xl font-black leading-tight">
                              {booking.movieTitle || "Đơn đặt vé"}
                            </h3>
                            <p className="mt-2 text-sm text-slate-300">
                              {booking.cinemaName || "G2Cinema"}
                              <span className="mx-2 text-slate-600">|</span>
                              {booking.roomName || "Phòng chiếu"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-[#FFD166]/20 bg-[#FFD166]/10 px-4 py-3 text-left md:text-right">
                            <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                              Tổng tiền
                            </p>
                            <p className="mt-1 text-xl font-black text-[#FFD166]">
                              {formatCurrency(booking.totalAmount)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                            <p className="flex items-center gap-2 text-xs font-black uppercase text-slate-500">
                              <FaCalendarAlt />
                              Suất chiếu
                            </p>
                            <p className="mt-2 text-sm font-bold">
                              {formatDateTime(booking.startTime)}
                            </p>
                          </div>

                          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                            <p className="flex items-center gap-2 text-xs font-black uppercase text-slate-500">
                              <FaReceipt />
                              Mã đặt vé
                            </p>
                            <p
                              className="mt-2 break-all text-sm font-bold text-blue-300"
                              title={booking.bookingId}
                            >
                              {getShortBookingId(booking.bookingId)}
                            </p>
                          </div>

                          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                            <p className="flex items-center gap-2 text-xs font-black uppercase text-slate-500">
                              <FaClock />
                              Ngày tạo
                            </p>
                            <p className="mt-2 text-sm font-bold">
                              {formatDateTime(booking.createdAt)}
                            </p>
                          </div>

                          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                            <p className="flex items-center gap-2 text-xs font-black uppercase text-slate-500">
                              {pendingPayment ? <FaCreditCard /> : <FaQrcode />}
                              Trạng thái
                            </p>
                            <p className="mt-2 text-sm font-bold">
                              {pendingPayment
                                ? deadlineLabel || "Có thể tiếp tục thanh toán"
                                : "Sẵn sàng mở mã QR"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 lg:min-w-40 lg:justify-end">
                        {pendingPayment && (
                          <>
                            <Link
                              to={`/booking/checkout/${booking.showtimeId}`}
                              state={{ resumeBooking: booking }}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#FFD166] px-5 py-3 text-center text-sm font-black uppercase tracking-wider text-black transition hover:bg-[#FFE7A3]"
                            >
                              <FaCreditCard />
                              Thanh toán
                            </Link>
                            <button
                              type="button"
                              onClick={() => setCancelTargetBooking(booking)}
                              disabled={cancellingBookingId === booking.bookingId}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-400/40 bg-rose-500/10 px-5 py-3 text-center text-sm font-black uppercase tracking-wider text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              <FaTimesCircle />
                              {cancellingBookingId === booking.bookingId
                                ? "Đang hủy"
                                : "Hủy giao dịch"}
                            </button>
                          </>
                        )}
                        <Link
                          to={`/booking/success/${booking.bookingId}`}
                          className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-center text-sm font-black uppercase tracking-wider transition ${
                            pendingPayment
                              ? "bg-white/10 text-white hover:bg-white/15"
                              : "bg-[#1f6feb] text-white hover:bg-[#2f7df5]"
                          }`}
                        >
                          <FaQrcode />
                          {pendingPayment ? "Chi tiết" : "Xem vé QR"}
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <ConfirmDialog
        open={Boolean(cancelTargetBooking)}
        title="Hủy giao dịch đặt vé?"
        message="Giao dịch chưa thanh toán sẽ bị hủy và ghế đang giữ sẽ được mở lại cho người khác đặt."
        confirmLabel="Hủy giao dịch"
        cancelLabel="Giữ giao dịch"
        loading={Boolean(cancellingBookingId)}
        onClose={() => {
          if (!cancellingBookingId) {
            setCancelTargetBooking(null);
          }
        }}
        onConfirm={() => {
          if (cancelTargetBooking) {
            void handleCancelBooking(cancelTargetBooking);
          }
        }}
      />
    </div>
  );
}
