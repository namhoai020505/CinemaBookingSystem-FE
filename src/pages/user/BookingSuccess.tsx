import { useEffect, useState } from "react";
import { FaRegCheckCircle } from "react-icons/fa";
import { Link, useParams } from "react-router-dom";
import { getCurrentUserProfile } from "../../lib/auth";
import {
  bookingService,
  type BookingDetails,
  type BookingSeatDetail,
} from "../../services/bookingService";

const normalizeBackendDate = (value?: string | null) => {
  if (!value) {
    return "";
  }

  return /(?:z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
};

const parseBackendTime = (value?: string | null) => {
  const timestamp = Date.parse(normalizeBackendDate(value));
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + " đ";

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

const getTicketQrImage = (qrCode?: string | null) => {
  if (!qrCode) {
    return "";
  }

  const query = new URLSearchParams({
    size: "150x150",
    data: qrCode,
  });

  return `https://api.qrserver.com/v1/create-qr-code/?${query.toString()}`;
};

const getPaymentStorageKey = (showtimeId: string) => {
  const profile = getCurrentUserProfile();
  const userKey = profile?.userId || profile?.email || "anonymous";
  return `g2c-payment:${userKey}:${showtimeId}`;
};

const getSeatLabel = (seat: BookingSeatDetail) =>
  `${seat.rowLabel}${seat.seatNumber}`;

export default function BookingSuccess() {
  const { bookingId } = useParams();
  const [bookingInfo, setBookingInfo] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        if (!bookingId) {
          return;
        }

        const response = await bookingService.getBookingById(bookingId);
        if (response.success) {
          setBookingInfo(response.data);

          if (response.data.status === "PAID") {
            localStorage.removeItem(getPaymentStorageKey(response.data.showtimeId));
          }
        }
      } catch (error) {
        console.error("Lỗi khi lấy thông tin đơn hàng:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchBooking();
  }, [bookingId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#182437] text-white">
        <p className="animate-pulse text-sm font-bold text-[#FFD166]">
          Đang tải thông tin vé...
        </p>
      </div>
    );
  }

  if (!bookingInfo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#182437] p-6 text-center text-white">
        <p className="text-sm font-bold text-rose-300">
          Không tìm thấy thông tin đặt vé.
        </p>
        <Link
          to="/"
          className="rounded-lg bg-[#FFD166] px-5 py-2.5 text-xs font-black uppercase text-black"
        >
          Về trang chủ
        </Link>
      </div>
    );
  }

  const isPaid = bookingInfo.status === "PAID";
  const ticketSeats = bookingInfo.seats.filter((seat) => seat.ticketQrCode);

  return (
    <div className="min-h-screen bg-[#182437] p-6 text-white">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-gray-800 bg-[#111C44] p-6 shadow-2xl md:p-8">
        <div className="flex flex-col gap-5 border-b border-gray-800 pb-6 md:flex-row md:items-start md:justify-between">
          <div>
            {isPaid ? (
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/15 text-emerald-300">
                <FaRegCheckCircle className="h-6 w-6" />
              </div>
            ) : null}
            <p className="text-xs font-black uppercase tracking-widest text-[#FFD166]">
              {isPaid ? "Thanh toán thành công" : "Đơn đang chờ thanh toán"}
            </p>
            <h1 className="mt-2 text-2xl font-black">
              {isPaid ? "Cảm ơn bạn đã thanh toán" : "Chờ xác nhận thanh toán"}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-gray-400">
              {isPaid
                ? "Vé của bạn đã sẵn sàng. Khi đến rạp, hãy mở mã QR bên dưới để nhân viên quét vé nhanh hơn."
                : "Đơn hàng vẫn đang chờ hệ thống xác nhận. Bạn có thể quay lại màn thanh toán để kiểm tra tiếp."}
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Mã đơn:{" "}
              <span className="font-bold text-white">{bookingInfo.bookingId}</span>
            </p>
          </div>
          <span
            className={`w-fit rounded-full border px-4 py-2 text-xs font-black uppercase ${
              isPaid
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : "border-amber-500/40 bg-amber-500/15 text-amber-300"
            }`}
          >
            {bookingInfo.status}
          </span>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
          <section className="space-y-4">
            <div className="rounded-xl border border-gray-800 bg-[#0D1637]/60 p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Phim
              </p>
              <h2 className="mt-1 text-xl font-black text-blue-300">
                {bookingInfo.movieTitle}
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-gray-800 bg-[#0D1637]/60 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Rạp
                </p>
                <p className="mt-1 font-bold">{bookingInfo.cinemaName}</p>
                <p className="text-sm text-gray-400">{bookingInfo.roomName}</p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-[#0D1637]/60 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Suất chiếu
                </p>
                <p className="mt-1 font-bold">
                  {formatDateTime(bookingInfo.startTime)}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-gray-800 bg-[#0D1637]/60 p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Ghế
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {bookingInfo.seats.map((seat) => (
                  <span
                    key={`${seat.seatId}-${seat.seatNumber}`}
                    className="rounded border border-blue-500/40 bg-blue-950/60 px-2.5 py-1 text-xs font-black text-blue-300"
                  >
                    {getSeatLabel(seat)}
                  </span>
                ))}
              </div>
            </div>
            {bookingInfo.foodAndBeverages.length > 0 && (
              <div className="rounded-xl border border-gray-800 bg-[#0D1637]/60 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Bắp nước
                </p>
                <div className="mt-3 space-y-2">
                  {bookingInfo.foodAndBeverages.map((item) => (
                    <div
                      key={item.itemName}
                      className="flex justify-between gap-4 text-sm"
                    >
                      <span>
                        {item.quantity}x {item.itemName}
                      </span>
                      <span className="font-bold">
                        {formatCurrency(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="h-fit rounded-xl border border-gray-800 bg-[#0D1637]/60 p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Tổng tiền
            </p>
            <p className="mt-1 text-3xl font-black text-[#FFD166]">
              {formatCurrency(bookingInfo.totalAmount)}
            </p>

            {ticketSeats.length > 0 && (
              <div className="mt-6 space-y-4 border-t border-gray-800 pt-5">
                {ticketSeats.map((seat) => {
                  const qrImage = getTicketQrImage(seat.ticketQrCode);

                  return (
                    <div key={seat.ticketId || seat.seatId}>
                      <p className="mb-2 text-xs font-bold text-gray-300">
                        Vé ghế {getSeatLabel(seat)}
                      </p>
                      {qrImage && (
                        <div className="rounded-xl bg-white p-3">
                          <img
                            src={qrImage}
                            alt={`QR vé ghế ${getSeatLabel(seat)}`}
                            className="mx-auto h-[150px] w-[150px]"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/"
            className="rounded-xl bg-gray-800 px-5 py-3 text-center text-xs font-black uppercase tracking-wider text-white transition hover:bg-gray-700"
          >
            Về trang chủ
          </Link>
          {!isPaid && (
            <Link
              to={`/booking/checkout/${bookingInfo.showtimeId}`}
              state={{
                resumeBooking: {
                  bookingId: bookingInfo.bookingId,
                  showtimeId: bookingInfo.showtimeId,
                  movieTitle: bookingInfo.movieTitle,
                  cinemaName: bookingInfo.cinemaName,
                  roomName: bookingInfo.roomName,
                  startTime: bookingInfo.startTime,
                  totalAmount: bookingInfo.totalAmount,
                  status: bookingInfo.status,
                  createdAt: bookingInfo.createdAt,
                },
              }}
              className="rounded-xl bg-[#FFD166] px-5 py-3 text-center text-xs font-black uppercase tracking-wider text-black transition hover:bg-[#FFE7A3]"
            >
              Thanh toán
            </Link>
          )}
          <Link
            to="/my-bookings"
            className={`rounded-xl px-5 py-3 text-center text-xs font-black uppercase tracking-wider transition ${
              isPaid
                ? "bg-[#FFD166] text-black hover:bg-[#FFE7A3]"
                : "bg-gray-800 text-white hover:bg-gray-700"
            }`}
          >
            Vé của tôi
          </Link>
        </div>
      </div>
    </div>
  );
}
