import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { bookingService } from "../../services/bookingService";

export default function MyBookings() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyBookings = async () => {
      try {
        const response = await bookingService.getMyBookings();
        if (response && response.success) {
          setBookings(response.data);
        }
      } catch (error) {
        console.error("Lỗi khi lấy danh sách vé:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMyBookings();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#182437] min-h-screen text-white flex items-center justify-center font-bold">
        <p className="animate-pulse text-sm text-[#FFD166] font-mono">Đang tải lịch sử đặt vé...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#182437] min-h-screen text-white font-['Urbanist']">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-black text-[#FFD166] mb-8 border-b border-gray-800 pb-4">Vé của tôi</h1>
        
        {bookings.length === 0 ? (
          <div className="bg-[#111C44] border border-gray-800 rounded-2xl p-10 text-center text-gray-500 italic">
            Bạn chưa có giao dịch đặt vé nào.
          </div>
        ) : (
          <div className="grid gap-6">
            {bookings.map((booking, index) => (
              <div key={booking.id || index} className="bg-[#111C44] border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row gap-6 items-center">
                <div className="flex-1 w-full">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-white mb-1">{booking.movieName}</h2>
                      <p className="text-xs text-gray-400">{booking.cinemaName} - {booking.roomName}</p>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase rounded border border-emerald-500/30">
                      Đã thanh toán
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Suất chiếu</p>
                      <p className="font-bold">{new Date(booking.showtime).toLocaleString('vi-VN')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Mã đặt vé</p>
                      <p className="font-bold text-blue-400">{booking.bookingCode || booking.id}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Ghế</p>
                      <p className="font-bold text-[#FFD166]">{booking.seats?.join(', ')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Tổng tiền</p>
                      <p className="font-bold text-rose-400">{booking.totalAmount?.toLocaleString()} đ</p>
                    </div>
                  </div>
                </div>
                
                <div className="shrink-0 w-full md:w-auto flex flex-col gap-3">
                  <Link 
                    to={`/booking/success/${booking.id}`} 
                    className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-center font-bold text-xs transition-all w-full"
                  >
                    Xem chi tiết
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
