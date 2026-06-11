import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { bookingService } from "../../services/bookingService";

export default function BookingSuccess() {
  const { bookingId } = useParams();
  const [bookingInfo, setBookingInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        if (!bookingId) return;
        const response = await bookingService.getBookingById(bookingId);
        if (response && response.success) {
          setBookingInfo(response.data);
        }
      } catch (error) {
        console.error("Lỗi khi lấy thông tin đơn hàng:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBooking();
  }, [bookingId]);

  if (loading) {
    return (
      <div className="bg-[#182437] min-h-screen text-white flex items-center justify-center font-bold">
        <p className="animate-pulse text-sm text-[#FFD166] font-mono">Đang tải thông tin vé...</p>
      </div>
    );
  }

  if (!bookingInfo) {
    return (
      <div className="bg-[#182437] min-h-screen text-white flex flex-col items-center justify-center font-bold gap-3">
        <p className="text-rose-400 text-sm">❌ Không tìm thấy thông tin đặt vé.</p>
        <Link to="/" className="mt-4 px-4 py-2 bg-blue-600 rounded">Về trang chủ</Link>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#182437] min-h-screen text-white font-['Urbanist'] flex flex-col items-center select-none">
      <div className="w-full max-w-2xl bg-[#111C44] border border-gray-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-black text-emerald-400 mb-2">Đặt vé thành công!</h1>
        <p className="text-gray-400 text-sm mb-8">Cảm ơn bạn đã sử dụng dịch vụ. Mã đơn hàng của bạn là <span className="font-bold text-white">{bookingInfo.bookingCode || bookingId}</span></p>

        <div className="w-full bg-[#0D1637]/40 rounded-xl p-6 border border-gray-800/40 text-left space-y-4">
          <div className="flex justify-between border-b border-gray-800 pb-3">
            <span className="text-gray-400">Tên phim</span>
            <span className="font-bold">{bookingInfo.movieName}</span>
          </div>
          <div className="flex justify-between border-b border-gray-800 pb-3">
            <span className="text-gray-400">Rạp chiếu</span>
            <span className="font-bold text-right">{bookingInfo.cinemaName} <br/><span className="text-xs text-gray-500">{bookingInfo.roomName}</span></span>
          </div>
          <div className="flex justify-between border-b border-gray-800 pb-3">
            <span className="text-gray-400">Thời gian</span>
            <span className="font-bold">{new Date(bookingInfo.showtime).toLocaleString('vi-VN')}</span>
          </div>
          <div className="flex justify-between border-b border-gray-800 pb-3">
            <span className="text-gray-400">Ghế</span>
            <span className="font-bold text-blue-400">{bookingInfo.seats?.join(', ')}</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-gray-400 font-bold">Tổng tiền</span>
            <span className="font-black text-[#FFD166] text-xl">{bookingInfo.totalAmount?.toLocaleString()} đ</span>
          </div>
        </div>

        <div className="flex gap-4 mt-8">
          <Link to="/" className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-bold text-sm transition-all">
            Về trang chủ
          </Link>
          <Link to="/my-bookings" className="px-6 py-3 bg-[#FFD166] hover:bg-[#FFE7A3] text-black rounded-lg font-bold text-sm transition-all shadow-md">
            Xem vé của tôi
          </Link>
        </div>
      </div>
    </div>
  );
}
