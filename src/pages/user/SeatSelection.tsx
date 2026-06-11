import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../lib/api"; 

const MAX_SEATS_ALLOWED = 6; 

export default function SeatSelection() {
  const { showtimeId } = useParams();
  const navigate = useNavigate();

  // State quản lý dữ liệu sơ đồ ghế động từ database
  const [seatMap, setSeatMap] = useState<any>(null);
  const [selectedSeats, setSelectedSeats] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState(600); // 10 phút giữ vé (SCRUM-163)
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // =================================================================
  // 🔄 1. GỌI API THỜI GIAN THỰC ĐỂ LẤY SƠ ĐỒ GHẾ THEO SUẤT CHIẾU
  // =================================================================
  useEffect(() => {
    const fetchSeatMap = async () => {
      try {
        setLoading(true);
        
        // 💡 SỬA ĐỔI CHÍ MẠNG: Gỡ bỏ header XML lỗi, gọi API chuẩn chỉ qua instance api của team
        // Instance api.ts đã tự động đính kèm 'Bearer ' + accessToken cho Phú rồi.
        const res: any = await api.get(`/api/seats/showtimes/${showtimeId}/map`);
        
        if (res && res.data) {
          const rawData = res.data;
          
          // Gộp tất cả các mảng ghế từ BE thành một mảng duy nhất cho UI xử lý
          const allSeatsRaw = [
            ...(rawData.availableSeats || []),
            ...(rawData.lockedSeats || []),
            ...(rawData.soldSeats || [])
          ];

          const mappedSeats = allSeatsRaw.map((s: any) => {
            // Map loại ghế theo seatTypeId (ST01: Thường, ST02: VIP, ST03: Sweetbox)
            let type = "NORMAL";
            let price = 80000;
            
            if (s.seatTypeId === "ST02") {
              type = "VIP";
              price = 100000;
            } else if (s.seatTypeId === "ST03") { 
              type = "SWEETBOX";
              price = 180000;
            }

            // Map trạng thái ghế để UI hiển thị đúng màu
            let status = s.seatStatus;
            // Nếu ghế nằm trong danh sách lockedSeats, ép trạng thái về HOLDING
            if (rawData.lockedSeats?.some((locked: any) => locked.seatId === s.seatId)) {
               status = "HOLDING";
            }

            return {
              seatId: s.seatId,
              showtimeSeatId: s.showtimeSeatId,
              row: s.rowLabel,
              column: s.seatNumber,
              seatCode: s.seatCode,
              status: status, // "AVAILABLE", "BOOKED", "HOLDING"
              type: type,
              price: price
            };
          });

          setSeatMap({
            showtimeId: rawData.showtimeId,
            // BE hiện tại chưa trả về movieName và roomName, dùng fallback
            movieName: rawData.movieName || "Đang cập nhật...", 
            roomName: rawData.roomName || "Phòng chiếu",
            seats: mappedSeats
          });
        } else {
          console.error("Lấy sơ đồ ghế thất bại hoặc sai cấu trúc:", res);
        }
      } catch (err: any) {
        console.error("Lỗi kết nối API sơ đồ ghế:", err);
      } finally {
        setLoading(false);
      }
    };

    if (showtimeId) {
      fetchSeatMap();
    }
  }, [showtimeId]);

  // Đồng hồ đếm ngược logic giữ ghế
  useEffect(() => {
    if (timeLeft <= 0) {
      alert("⏳ Đã hết thời gian giữ ghế! Vui lòng chọn lại suất chiếu.");
      navigate("/");
      return;
    }
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, navigate]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // =================================================================
  // 🧠 THUẬT TOÁN ĐA BIÊN: CHỐNG BỎ TRỐNG 1 GHẾ KẸT (BIÊN TƯỜNG THÔNG THOÁNG)
  // =================================================================
  const validateSeatGaps = (currentSelection: any[]) => {
    if (!seatMap || !seatMap.seats) return true;

    const rows = Array.from(new Set(currentSelection.map(s => s.row)));

    for (let row of rows) {
      const allSeatsInRow = seatMap.seats
        .filter((s: any) => s.row === row)
        .sort((a: any, b: any) => a.column - b.column);

      const selectedCols = currentSelection.filter(s => s.row === row).map(s => s.column);

      for (let seat of allSeatsInRow) {
        if (seat.status !== "AVAILABLE" || selectedCols.includes(seat.column)) continue;

        const col = seat.column;
        const leftSeat = allSeatsInRow.find((s: any) => s.column === col - 1);
        const rightSeat = allSeatsInRow.find((s: any) => s.column === col + 1);

        const isLeftBlocked = leftSeat && (leftSeat.status === "BOOKED" || leftSeat.status === "HOLDING" || selectedCols.includes(col - 1));
        const isRightBlocked = rightSeat && (rightSeat.status === "BOOKED" || rightSeat.status === "HOLDING" || selectedCols.includes(col + 1));

        if (leftSeat && rightSeat && isLeftBlocked && isRightBlocked) {
          const bothWereAlreadyBooked = 
            (leftSeat.status === "BOOKED" || leftSeat.status === "HOLDING") && 
            (rightSeat.status === "BOOKED" || rightSeat.status === "HOLDING");

          if (!bothWereAlreadyBooked) {
            return false; 
          }
        }
      }
    }
    return true;
  };

  const handleSelectSeat = (seat: any) => {
    if (seat.status === "BOOKED" || seat.status === "HOLDING") return;

    const isExist = selectedSeats.some((s) => s.seatId === seat.seatId);
    if (isExist) {
      setSelectedSeats(selectedSeats.filter((s) => s.seatId !== seat.seatId));
    } else {
      if (selectedSeats.length >= MAX_SEATS_ALLOWED) {
        alert(`⚠️ Hệ thống chỉ cho phép chọn tối đa ${MAX_SEATS_ALLOWED} ghế trong một giao dịch!`);
        return;
      }
      setSelectedSeats([...selectedSeats, seat]);
    }
  };

  // =================================================================
  // 🚀 2. ACTION TIẾP TỤC: GỌI API KHÓA GHẾ NGẦM ĐỂ GIỮ CHỖ TRÊN DB
  // =================================================================
  const handleProceed = async () => {
    if (!validateSeatGaps(selectedSeats)) {
      alert("⚠️ Không thể đặt ghế! Thao tác đang để lại một ghế trống duy nhất kẹt ở giữa. Vui lòng chọn các ghế nằm sát nhau.");
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('accessToken');

      // CHỈ truyền token qua Authorization header. Backend .NET sẽ tự giải mã JWT để lấy claim Role.
      const config = {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };

      // 💡 ĐÃ FIX: Backend chỉ nhận Object có MỘT `seatId` (dạng string). 
      // Do đó ta sẽ dùng Promise.all để bắn đồng loạt nhiều request lock ghế nếu user chọn nhiều.
      const lockRequests = selectedSeats.map(seat => {
        const payload = {
          showtimeId: showtimeId,
          seatId: seat.seatId 
        };
        return api.post("/api/seats/lock", payload, config);
      });

      // Chờ tất cả request giữ ghế chạy xong
      const responses: any[] = await Promise.all(lockRequests);

      // Check xem toàn bộ kết quả có success = true hay không
      const allSuccess = responses.every(res => res && res.success);

      if (allSuccess) {
        navigate(`/booking/checkout/${showtimeId}`, { state: { selectedSeats, totalAmount, seatMap } });
      } else {
        alert("⚠️ Một trong số các ghế bạn chọn vừa có người nhanh tay giữ trước! Vui lòng tải lại trang.");
      }
    } catch (err: any) {
      console.error("Lỗi khi gọi API khóa giữ ghế:", err);
      const serverMessage = err.response?.data?.message;
      alert(serverMessage || "⚠️ Không thể kết nối hệ thống giữ ghế ngầm. Vui lòng thử lại!");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#182437] min-h-screen text-white flex items-center justify-center font-bold">
        <p className="animate-pulse text-sm text-[#FFD166] font-mono">Đang kết nối API và đồng bộ sơ đồ phòng chiếu...</p>
      </div>
    );
  }

  if (!seatMap || !seatMap.seats) {
    return (
      <div className="bg-[#182437] min-h-screen text-white flex flex-col items-center justify-center font-bold gap-3">
        <p className="text-rose-400 text-sm">❌ Không thể khởi tạo sơ đồ phòng chiếu từ hệ thống.</p>
      </div>
    );
  }

  const totalAmount = selectedSeats.reduce((sum, s) => sum + s.price, 0);
  
  // 🌟 ĐÃ SỬA LỖI BIÊN DỊCH: Ép mảng string[] tường minh cho mốc chữ cái hàng đầu lưới
  const rowsStructure = Array.from<string>(new Set(seatMap.seats.map((s: any) => s.row))).sort();

  const getSeatStyles = (seat: any) => {
    const isChoosing = selectedSeats.some((s) => s.seatId === seat.seatId);
    if (seat.status === "BOOKED") return "bg-gray-800 border-transparent text-gray-600 cursor-not-allowed opacity-30 line-through";
    if (seat.status === "HOLDING") return "bg-amber-600/70 border-amber-400 text-white cursor-not-allowed animate-pulse";
    if (isChoosing) return "bg-emerald-500 border-emerald-400 text-black font-black scale-105 shadow-[0_0_12px_rgba(16,185,129,0.5)]";

    switch (seat.type?.toUpperCase()) {
      case "VIP": return "bg-purple-600/40 border-purple-500 text-purple-200 hover:bg-purple-500";
      case "SWEETBOX": return "bg-rose-600/40 border-rose-500 text-rose-200 hover:bg-rose-500";
      default: return "bg-blue-600/20 border-blue-500 text-blue-200 hover:bg-blue-500";
    }
  };

  return (
    <div className="p-6 bg-[#182437] min-h-screen text-white font-['Urbanist'] flex flex-col items-center select-none">
      <div className="w-full max-w-5xl mb-8 flex justify-between items-end border-b border-white/10 pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#FFD166]">Bước 2: Sơ đồ vị trí ghế</span>
          <h1 className="text-2xl font-black mt-1">{seatMap.movieName || "Đang tải tên phim..."}</h1>
          <p className="text-xs text-gray-400 mt-1">📍 {seatMap.roomName || "Phòng chiếu"} | Mã suất chiếu: {seatMap.showtimeId}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Thời gian giữ ghế</p>
          <div className="text-lg font-mono font-bold text-rose-400 bg-rose-950/40 px-3 py-1 rounded-lg border border-rose-900/50 mt-1">
            ⏱️ {formatTimer(timeLeft)}
          </div>
        </div>
      </div>

      <div className="w-full max-w-5xl bg-[#111C44] border border-gray-800 rounded-3xl p-10 shadow-2xl flex flex-col items-center mb-8 overflow-x-auto class-scroll-custom">
        <div className="w-3/4 mb-16 relative flex flex-col items-center">
          <div className="w-full h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full opacity-60 shadow-[0_4px_20px_rgba(99,102,241,0.4)]"></div>
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.4em] font-black mt-3">MÀN HÌNH CHIẾU PHIM</p>
        </div>

        <div className="flex flex-col gap-4 w-full items-center justify-center">
          {rowsStructure.map((row) => {
            const seatsInRow = seatMap.seats.filter((s: any) => s.row === row).sort((a: any, b: any) => a.column - b.column);
            return (
              <div key={row} className="flex items-center gap-4 justify-center w-full">
                <div className="w-6 text-sm font-black text-white/40 text-center shrink-0">{row}</div>
                
                <div className="flex flex-wrap items-center gap-3 justify-center">
                  {seatsInRow.map((seat: any) => (
                    <button
                      key={seat.seatId}
                      onClick={() => handleSelectSeat(seat)}
                      className={`w-9 h-9 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-center shrink-0 ${getSeatStyles(seat)}`}
                    >
                      {seat.column}
                    </button>
                  ))}
                </div>

                <div className="w-6 text-sm font-black text-white/40 text-center shrink-0">{row}</div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-center gap-6 mt-12 border-t border-white/5 pt-6 w-full text-[11px] text-gray-400 font-bold">
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-blue-600/20 border border-blue-500 block"></span> Thường (80k)</div>
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-purple-600/40 border border-purple-500 block"></span> Ghế VIP (100k)</div>
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-rose-600/40 border border-rose-500 block"></span> Đôi Sweetbox (180k)</div>
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-emerald-500 block"></span> Đang chọn</div>
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-amber-600/70 block border-amber-500"></span> Đang giữ ghế</div>
          <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-gray-800 block opacity-30 line-through"></span> Đã bán</div>
        </div>
      </div>

      <div className="w-full max-w-5xl bg-[#111C44] border border-gray-800 p-5 rounded-2xl shadow-2xl flex justify-between items-center">
        <div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Ghế đã chọn (Tối đa {MAX_SEATS_ALLOWED} vé)</p>
          <div className="flex gap-2 mt-1.5 flex-wrap max-w-[450px]">
            {selectedSeats.length === 0 ? (
              <span className="text-xs text-gray-500 italic">Vui lòng chọn vị trí ngồi...</span>
            ) : (
              selectedSeats.map((s) => (
                <span key={s.seatId} className="px-2.5 py-1 bg-blue-950/60 border border-blue-500/40 text-blue-400 rounded text-xs font-black">
                  {s.row}{s.column}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Tổng tiền</p>
            <p className="text-xl font-black text-[#FFD166] mt-0.5">{totalAmount.toLocaleString()} đ</p>
          </div>
          <button
            disabled={selectedSeats.length === 0 || submitting}
            onClick={handleProceed}
            className={`px-6 py-3 rounded-lg font-black uppercase text-xs tracking-wider transition-all shadow-md ${
              selectedSeats.length > 0 && !submitting
                ? "bg-[#FFD166] hover:bg-[#FFE7A3] text-black hover:scale-[1.02] cursor-pointer" 
                : "bg-gray-800 text-gray-500 cursor-not-allowed"
            }`}
          >
            {submitting ? "Đang giữ..." : "Tiếp tục \u2192"}
          </button>
        </div>
      </div>
    </div>
  );
}