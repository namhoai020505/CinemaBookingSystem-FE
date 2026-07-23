import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaCheckCircle, FaExclamationTriangle, FaSpinner, FaArrowRight } from "react-icons/fa";
import { paymentService } from "../../services/paymentService";
import { removeCheckoutAttempt } from "../../services/checkoutAttempt";

// DTO types for payment sessions stored in local storage
type PaymentSession = {
  showtimeId: string;
  userKey: string;
  booking: {
    bookingId: string;
    movieTitle?: string;
    cinemaName?: string;
    roomName?: string;
    startTime?: string | null;
    totalAmount: number;
    status: string;
  };
  payment: {
    paymentId: string;
    amount: number;
    transactionCode: string;
  };
  expiresAt: string;
};

// Scan local storage to find the payment session matching our transaction code (vnp_TxnRef)
const findPaymentSessionByTxnRef = (txnRef: string) => {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("g2c-payment:")) {
      try {
        const rawValue = localStorage.getItem(key);
        if (rawValue) {
          const parsed = JSON.parse(rawValue) as PaymentSession;
          if (parsed.payment?.transactionCode === txnRef) {
            return { session: parsed, storageKey: key };
          }
        }
      } catch (e) {
        console.warn("Lỗi đọc session thanh toán", e);
      }
    }
  }
  return null;
};

// Map VNPay response codes to user friendly Vietnamese descriptions
const getVnpayErrorDescription = (code: string) => {
  switch (code) {
    case "24":
      return "Giao dịch không thành công do bạn đã hủy thanh toán.";
    case "09":
      return "Thẻ hoặc tài khoản của bạn chưa đăng ký dịch vụ Internet Banking.";
    case "10":
      return "Xác thực thông tin thẻ hoặc tài khoản không đúng quá 3 lần.";
    case "11":
      return "Đã hết thời gian chờ thực hiện thanh toán trên cổng VNPay.";
    case "12":
      return "Thẻ hoặc tài khoản của bạn đã bị khóa hoặc tạm ngưng hoạt động.";
    case "51":
      return "Tài khoản của bạn không đủ số dư để thực hiện giao dịch.";
    case "75":
      return "Ngân hàng thanh toán đang trong thời gian bảo trì hệ thống.";
    default:
      return `Lỗi thanh toán không xác định từ VNPay (Mã lỗi: ${code}).`;
  }
};

export default function VnpayReturn() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const verifyPayment = async () => {
      const searchParams = new URLSearchParams(location.search);
      const params: Record<string, string> = {};
      searchParams.forEach((val, key) => {
        params[key] = val;
      });

      const txnRef = params["vnp_TxnRef"];
      const responseCode = params["vnp_ResponseCode"];

      if (!txnRef) {
        if (active) {
          setStatus("error");
          setErrorMessage("Không tìm thấy thông tin mã giao dịch trong phản hồi VNPay.");
        }
        return;
      }

      // 1. Tìm thông tin session thanh toán trong local storage
      const matched = findPaymentSessionByTxnRef(txnRef);

      // 2. Gọi API Backend để kiểm tra chữ ký chữ và lấy thông tin trạng thái chính thức
      try {
        const result = await paymentService.verifyVnpayReturn(location.search);

        if (!active) return;

        if (result.success && result.data.responseCode === "00") {
          // Thanh toán thành công!
          setStatus("success");

          // Xóa session thanh toán tạm để tránh lặp lại
          if (matched) {
            localStorage.removeItem(matched.storageKey);
            removeCheckoutAttempt(matched.session.showtimeId, matched.session.userKey);
          }

          // Điều hướng ngay sang màn hình Booking thành công
          const bookingId = matched?.session.booking.bookingId || result.data.transactionCode;
          setTimeout(() => {
            navigate(`/booking/success/${bookingId}`, { replace: true });
          }, 1500);
        } else {
          // Thanh toán thất bại hoặc bị hủy bỏ
          setStatus("error");
          const code = result.data?.responseCode || responseCode || "UNKNOWN";
          setErrorMessage(getVnpayErrorDescription(code));

          // Xóa session thanh toán vì vé đã bị hủy bên BE (hoặc sẽ bị hủy bởi IPN)
          if (matched) {
            localStorage.removeItem(matched.storageKey);
            removeCheckoutAttempt(matched.session.showtimeId, matched.session.userKey);
          }
        }
      } catch (error: any) {
        if (!active) return;
        console.error("Xác minh VNPay thất bại:", error);
        setStatus("error");
        setErrorMessage(
          error.response?.data?.message ||
            "Đã xảy ra lỗi kết nối với máy chủ khi xác thực chữ ký VNPay."
        );
      }
    };

    void verifyPayment();

    return () => {
      active = false;
    };
  }, [location.search, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#182437] px-4 py-8 text-white">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#111C44] p-8 shadow-2xl text-center">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <FaSpinner className="h-12 w-12 animate-spin text-[#FFD166]" />
            <h1 className="text-xl font-black uppercase tracking-wider text-slate-100">
              Đang xác thực thanh toán
            </h1>
            <p className="text-xs text-slate-400">
              Chúng tôi đang kết nối với cổng VNPay để kiểm tra trạng thái giao dịch của bạn. Vui lòng không đóng trình duyệt.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <FaCheckCircle className="h-16 w-16 text-emerald-400" />
            <h1 className="text-xl font-black uppercase tracking-wider text-emerald-300">
              Thanh toán thành công!
            </h1>
            <p className="text-xs text-slate-400">
              Giao dịch đã được xác nhận. Hệ thống đang tạo mã QR vé cho bạn...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-5 py-2">
            <div className="rounded-full bg-rose-500/10 p-4 text-rose-400">
              <FaExclamationTriangle className="h-12 w-12" />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-wider text-rose-300">
                Thanh toán không thành công
              </h1>
              <p className="mt-3 text-xs leading-relaxed text-slate-300">
                {errorMessage}
              </p>
            </div>
            <div className="mt-4 w-full border-t border-white/10 pt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => navigate("/", { replace: true })}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#FFD166] px-5 py-3 text-xs font-black uppercase text-black transition hover:bg-[#FFE7A3]"
              >
                Về trang chủ
                <FaArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
