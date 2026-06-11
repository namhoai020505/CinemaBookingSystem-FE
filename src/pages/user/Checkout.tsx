import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { bookingService } from "../../services/bookingService";

// Dữ liệu bắp nước mẫu (F&B)
const MOCK_FNB_ITEMS = [
  { id: "fnb_01", name: "Combo Solo (1 Bắp Lớn + 1 Nước Vừa)", price: 85000, icon: "🍿🥤", desc: "Giết thời gian tuyệt vời cho 1 người" },
  { id: "fnb_02", name: "Combo Couple (1 Bắp Lớn + 2 Nước Vừa)", price: 105000, icon: "🍿🥤🥤", desc: "Lựa chọn hoàn hảo cho cặp đôi" },
  { id: "fnb_03", name: "Bắp Phô Mai Extra", price: 65000, icon: "🧀", desc: "Thơm lừng, béo ngậy" },
];

export default function Checkout() {
  const { showtimeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Lấy dữ liệu vé từ trang Chọn ghế chuyển sang
  const { selectedSeats, totalAmount: seatsTotalAmount, seatMap } = location.state || {};
  
  // State quản lý luồng UI (Bước 1: Bắp nước & Mã giảm, Bước 2: Thanh toán)
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);

  // State quản lý Bắp Nước & Khuyến mãi
  const [fnbCart, setFnbCart] = useState<Record<string, number>>({});
  const [discountCode, setDiscountCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);

  // State phương thức thanh toán
  const [paymentMethod, setPaymentMethod] = useState("VNPAY");

  // Kiểm tra nếu người dùng vào thẳng link mà không có data ghế
  if (!selectedSeats || !seatMap) {
    return (
      <div className="bg-[#182437] min-h-screen text-white flex flex-col items-center justify-center">
        <p className="text-rose-400">Không tìm thấy thông tin đặt vé. Vui lòng quay lại chọn ghế.</p>
        <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-blue-600 rounded">Về trang chủ</button>
      </div>
    );
  }

  // ==========================================
  // TÍNH TOÁN TỔNG TIỀN
  // ==========================================
  const fnbTotalAmount = MOCK_FNB_ITEMS.reduce((sum, item) => sum + (fnbCart[item.id] || 0) * item.price, 0);
  const subTotal = (seatsTotalAmount || 0) + fnbTotalAmount;
  const finalTotalAmount = Math.max(0, subTotal - discountAmount);

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleQuantityChange = (itemId: string, delta: number) => {
    setFnbCart(prev => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [itemId]: next };
    });
  };

  const handleApplyDiscount = () => {
    if (!discountCode.trim()) return;
    // Tạm thời mock logic kiểm tra mã giảm giá
    if (discountCode.toUpperCase() === "G2C50") {
      setDiscountAmount(50000);
      alert("🎉 Áp dụng mã giảm 50.000đ thành công!");
    } else {
      setDiscountAmount(0);
      alert("❌ Mã giảm giá không hợp lệ hoặc đã hết hạn.");
    }
  };

  const handlePayment = async () => {
    try {
      setSubmitting(true);
      // Backend tạm thời chỉ cần thông tin vé, nếu sau này mở rộng F&B thì truyền thêm fnbCart
      const payload = {
        showtimeId: showtimeId as string,
        showtimeSeatIds: selectedSeats.map((s: any) => s.showtimeSeatId),
        paymentMethod: paymentMethod 
      };

      const response = await bookingService.createBooking(payload);
      
      if (response && response.success) {
         navigate(`/booking/success/${response.data.id || response.data.bookingId}`);
      } else {
         alert("Thanh toán thất bại: " + (response?.message || "Lỗi không xác định"));
      }
    } catch (error: any) {
      console.error("Lỗi đặt vé:", error);
      alert("Đã có lỗi xảy ra khi tạo đơn hàng. " + (error.response?.data?.message || ""));
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // UI BƯỚC 1: CHỌN BẮP NƯỚC VÀ MÃ GIẢM GIÁ
  // ==========================================
  if (step === 1) {
    return (
      <div className="p-6 bg-[#182437] min-h-screen text-white font-['Urbanist'] flex flex-col items-center select-none">
        <div className="w-full max-w-4xl flex gap-6 flex-col lg:flex-row">
          
          {/* KHỐI TRÁI: DANH SÁCH BẮP NƯỚC */}
          <div className="flex-1 bg-[#111C44] border border-gray-800 rounded-3xl p-6 md:p-8 shadow-2xl">
            <h2 className="text-xl font-black text-[#FFD166] mb-6 flex items-center gap-2">
              🍿 Chọn Bắp & Nước
            </h2>
            <div className="space-y-4 class-scroll-custom pr-2 max-h-[400px] overflow-y-auto">
              {MOCK_FNB_ITEMS.map(item => {
                const qty = fnbCart[item.id] || 0;
                return (
                  <div key={item.id} className="flex justify-between items-center bg-[#0D1637]/60 border border-gray-800 p-4 rounded-2xl hover:border-gray-600 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center text-2xl shrink-0">
                        {item.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm md:text-base">{item.name}</h3>
                        <p className="text-[10px] text-gray-400 mt-0.5">{item.desc}</p>
                        <p className="text-blue-400 font-black text-sm mt-1">{item.price.toLocaleString()} đ</p>
                      </div>
                    </div>
                    
                    {/* BỘ CHỈNH SỐ LƯỢNG */}
                    <div className="flex items-center gap-3 bg-gray-900 rounded-lg p-1 border border-gray-800 shrink-0">
                      <button onClick={() => handleQuantityChange(item.id, -1)} className="w-7 h-7 flex items-center justify-center bg-gray-800 rounded hover:bg-gray-700 text-white transition font-bold" disabled={qty === 0}>-</button>
                      <span className="w-4 text-center font-bold text-sm">{qty}</span>
                      <button onClick={() => handleQuantityChange(item.id, 1)} className="w-7 h-7 flex items-center justify-center bg-blue-600 rounded hover:bg-blue-500 text-white transition font-bold">+</button>
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* NHẬP MÃ GIẢM GIÁ */}
            <h2 className="text-xl font-black text-[#FFD166] mt-8 mb-4 flex items-center gap-2">
              🎟️ Mã Khuyến Mãi
            </h2>
            <div className="flex gap-3">
              <input 
                type="text" 
                placeholder="Nhập mã giảm giá (VD: G2C50)"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                className="flex-1 bg-[#0D1637]/60 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 uppercase placeholder:normal-case placeholder:text-gray-600"
              />
              <button 
                onClick={handleApplyDiscount}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl text-sm transition shadow-md whitespace-nowrap"
              >
                Áp dụng
              </button>
            </div>
          </div>

          {/* KHỐI PHẢI: BILL TẠM TÍNH */}
          <div className="w-full lg:w-[350px] bg-[#111C44] border border-gray-800 rounded-3xl p-6 md:p-8 shadow-2xl h-fit sticky top-24">
            <h2 className="text-lg font-black text-white mb-5 border-b border-gray-800 pb-4">Tạm tính</h2>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Tiền vé ({selectedSeats.length} ghế)</span>
                <span className="font-bold">{seatsTotalAmount.toLocaleString()} đ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Tiền bắp nước</span>
                <span className="font-bold">{fnbTotalAmount.toLocaleString()} đ</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span className="font-bold">Khuyến mãi</span>
                  <span className="font-bold">- {discountAmount.toLocaleString()} đ</span>
                </div>
              )}
              
              <div className="border-t border-gray-800 pt-4 mt-4">
                <div className="flex justify-between items-end">
                  <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Tổng cộng</span>
                  <span className="font-black text-2xl text-[#FFD166]">{finalTotalAmount.toLocaleString()} đ</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-4 mt-8 rounded-xl font-black uppercase text-xs tracking-wider transition-all bg-[#FFD166] hover:bg-[#FFE7A3] text-black shadow-lg hover:scale-[1.02]"
            >
              Tiếp tục thanh toán &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // UI BƯỚC 2: TÓM TẮT ĐƠN HÀNG VÀ THANH TOÁN
  // ==========================================
  return (
    <div className="p-6 bg-[#182437] min-h-screen text-white font-['Urbanist'] flex flex-col items-center">
      <div className="w-full max-w-4xl flex gap-6 flex-col lg:flex-row-reverse">
        
        {/* KHỐI PHẢI (hiển thị trước trên mobile): PHƯƠNG THỨC THANH TOÁN */}
        <div className="flex-1 bg-[#111C44] border border-gray-800 rounded-3xl p-6 md:p-8 shadow-2xl h-fit">
          <button onClick={() => setStep(1)} className="text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wider mb-6 flex items-center gap-1 transition">
            &larr; Quay lại chọn Bắp Nước
          </button>
          
          <h2 className="text-xl font-black text-[#FFD166] mb-6">💳 Phương thức thanh toán</h2>
          
          <div className="space-y-4">
            <label className={`flex items-center gap-4 p-4 border rounded-2xl cursor-pointer transition-all ${paymentMethod === 'VNPAY' ? 'border-blue-500 bg-blue-900/20' : 'border-gray-800 bg-[#0D1637]/60 hover:border-gray-600'}`}>
              <input type="radio" name="payment" value="VNPAY" checked={paymentMethod === 'VNPAY'} onChange={(e) => setPaymentMethod(e.target.value)} className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 focus:ring-blue-600 focus:ring-2" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg p-1 flex items-center justify-center shrink-0">
                  <img src="https://vnpay.vn/s1/statics.vnpay.vn/2023/6/0oxhzjmxbksr1686814746087.png" alt="VNPAY" className="w-full object-contain" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Cổng thanh toán VNPAY</h3>
                  <p className="text-[10px] text-gray-400">Thanh toán qua thẻ ATM, Internet Banking, QR Code</p>
                </div>
              </div>
            </label>

            <label className={`flex items-center gap-4 p-4 border rounded-2xl cursor-pointer transition-all ${paymentMethod === 'MOMO' ? 'border-blue-500 bg-blue-900/20' : 'border-gray-800 bg-[#0D1637]/60 hover:border-gray-600'}`}>
              <input type="radio" name="payment" value="MOMO" checked={paymentMethod === 'MOMO'} onChange={(e) => setPaymentMethod(e.target.value)} className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 focus:ring-blue-600 focus:ring-2" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#A50064] rounded-lg p-1 flex items-center justify-center shrink-0">
                   <span className="text-white font-black text-[10px]">MoMo</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm">Ví điện tử MoMo</h3>
                  <p className="text-[10px] text-gray-400">Quét mã MoMo để thanh toán</p>
                </div>
              </div>
            </label>
          </div>

          <button
            onClick={handlePayment}
            disabled={submitting}
            className={`w-full py-4 mt-8 rounded-xl font-black uppercase text-sm tracking-wider transition-all shadow-lg flex justify-center items-center gap-2 ${
              submitting ? "bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700" : "bg-emerald-500 hover:bg-emerald-400 text-black hover:scale-[1.02]"
            }`}
          >
            {submitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Đang xử lý thanh toán...
              </>
            ) : "Thanh toán ngay"}
          </button>
          <p className="text-center text-[10px] text-gray-500 mt-4 italic">Bằng việc bấm thanh toán, bạn đồng ý với các điều khoản của G2Cinema.</p>
        </div>

        {/* KHỐI TRÁI: TÓM TẮT ĐƠN HÀNG */}
        <div className="w-full lg:w-[380px] bg-[#111C44] border border-gray-800 rounded-3xl p-6 md:p-8 shadow-2xl h-fit">
          <h2 className="text-lg font-black text-white mb-6 border-b border-gray-800 pb-4">Tóm tắt đơn hàng</h2>
          
          <div className="space-y-5">
            {/* Phim & Rạp */}
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Phim chiếu rạp</p>
              <h3 className="font-black text-lg text-blue-400">{seatMap.movieName}</h3>
              <p className="text-sm font-bold mt-1 text-white">{seatMap.roomName}</p>
            </div>

            {/* Ghế */}
            <div className="bg-[#0D1637]/60 p-4 rounded-xl border border-gray-800">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Ghế đã chọn ({selectedSeats.length})</p>
                  <p className="font-black text-white">
                    {selectedSeats.map((s: any) => `${s.row}${s.column}`).join(', ')}
                  </p>
                </div>
                <p className="font-bold text-sm text-right">{seatsTotalAmount.toLocaleString()} đ</p>
              </div>
            </div>

            {/* Bắp Nước */}
            {fnbTotalAmount > 0 && (
               <div className="bg-[#0D1637]/60 p-4 rounded-xl border border-gray-800">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Bắp nước ăn kèm</p>
                  {MOCK_FNB_ITEMS.map(item => {
                    const qty = fnbCart[item.id] || 0;
                    if (qty === 0) return null;
                    return (
                      <div key={item.id} className="flex justify-between items-center mb-2 last:mb-0">
                        <p className="text-xs text-gray-300"><span className="font-black text-white mr-1">{qty}x</span> {item.name}</p>
                        <p className="font-bold text-xs">{(qty * item.price).toLocaleString()} đ</p>
                      </div>
                    )
                  })}
               </div>
            )}

            {/* TỔNG KẾT MÀN HÌNH CHỐT */}
            <div className="border-t border-gray-800 pt-4 mt-6">
              {discountAmount > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-emerald-400 font-bold">🎟️ Đã áp dụng mã giảm giá</span>
                  <span className="font-bold text-emerald-400">- {discountAmount.toLocaleString()} đ</span>
                </div>
              )}
              <div className="flex justify-between items-end">
                <span className="text-gray-400 font-bold uppercase tracking-wider text-xs">Tổng cần thanh toán</span>
                <span className="font-black text-2xl text-[#FFD166]">{finalTotalAmount.toLocaleString()} đ</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
