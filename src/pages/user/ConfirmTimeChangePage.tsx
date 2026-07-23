import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FaSpinner, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { bookingService } from '../../services/bookingService';

type FlowState = 'LOADING' | 'ACCEPT_SUCCESS' | 'REJECT_SUCCESS' | 'ERROR';

export default function ConfirmTimeChangePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const bookingId = searchParams.get('bookingId') || '';
  const acceptParam = searchParams.get('accept');
  const token = searchParams.get('token') || '';

  const [flowState, setFlowState] = useState<FlowState>('LOADING');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorText, setErrorText] = useState('');

  // ─── Confirm Process ──────────────────────────────────────────────
  const handleConfirmAction = useCallback(async (bId: string, tok: string, isAccept: boolean) => {
    try {
      setFlowState('LOADING');
      const res = await bookingService.confirmTimeChange(bId, isAccept, tok);
      if (res.success) {
        if (res.message && (res.message.startsWith('ALREADY_ACCEPTED:') || res.message.startsWith('ALREADY_REFUNDED:'))) {
          setErrorText(res.message.replace('ALREADY_ACCEPTED:', '').replace('ALREADY_REFUNDED:', '').trim());
          setFlowState('ERROR');
          return;
        }
        if (res.message) setSuccessMessage(res.message);
        setFlowState(isAccept ? 'ACCEPT_SUCCESS' : 'REJECT_SUCCESS');
      } else {
        setErrorText(res.message || 'Không thể xác nhận yêu cầu.');
        setFlowState('ERROR');
      }
    } catch (err: unknown) {
      let msg = 'Đã xảy ra lỗi khi xử lý yêu cầu.';
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      if (axiosErr?.response?.data?.message) {
        msg = axiosErr.response.data.message;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setErrorText(msg);
      setFlowState('ERROR');
    }
  }, []);

  const isMounted = useRef(false);

  useEffect(() => {
    if (isMounted.current) return;
    isMounted.current = true;

    if (!bookingId || !token || acceptParam === null) {
      setFlowState('ERROR');
      setErrorText('Liên kết không hợp lệ. Vui lòng kiểm tra lại email xác nhận từ rạp chiếu.');
      return;
    }

    const isAccept = acceptParam === 'true';
    void handleConfirmAction(bookingId, token, isAccept);
  }, [bookingId, acceptParam, token, handleConfirmAction]);

  // ─── Loading Screen ──────────────────────────────────────────────────────
  if (flowState === 'LOADING') {
    return (
      <div className="min-h-screen bg-[#162338] text-white px-4 py-12 flex flex-col items-center justify-center">
        <FaSpinner className="h-12 w-12 text-[#FFD166] animate-spin mb-4" />
        <h2 className="text-xl font-black">Đang xử lý yêu cầu phản hồi...</h2>
        <p className="text-sm text-slate-400 mt-2">Vui lòng chờ trong giây lát.</p>
      </div>
    );
  }

  // ─── Error Screen ────────────────────────────────────────────────────────
  if (flowState === 'ERROR') {
    return (
      <div className="min-h-screen bg-[#162338] text-white px-4 py-12 flex items-center justify-center">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/20 bg-[#0f1b35] p-8 shadow-2xl text-center">
          <FaExclamationCircle className="h-16 w-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-rose-400 mb-2">Thao Tác Thất Bại</h2>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            {errorText}
          </p>
          <button
            onClick={() => navigate('/my-bookings')}
            className="w-full py-3 rounded-lg bg-slate-700 text-white font-bold uppercase text-sm hover:bg-slate-600 transition active:scale-95"
          >
            Quay về danh sách vé
          </button>
        </div>
      </div>
    );
  }

  // ─── Accept Success Screen ───────────────────────────────────────────────
  if (flowState === 'ACCEPT_SUCCESS') {
    return (
      <div className="min-h-screen bg-[#162338] text-white px-4 py-12 flex items-center justify-center">
        <div className="max-w-md w-full rounded-2xl border border-emerald-500/20 bg-[#0f1b35] p-8 shadow-2xl text-center">
          <FaCheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-emerald-400 mb-2">Xác Nhận Thành Công!</h2>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            Bạn đã đồng ý với thay đổi lịch chiếu từ rạp. Vé của bạn đã được cập nhật sang giờ chiếu mới hợp lệ.
            <br/><br/>
            {successMessage && <span className="text-[#FFD166]">{successMessage}</span>}
          </p>
          <button
            onClick={() => navigate('/my-bookings')}
            className="w-full py-3 rounded-lg bg-[#FFD166] text-black font-black uppercase text-sm hover:bg-[#FFE7A3] transition active:scale-95"
          >
            Xem lịch sử đặt vé
          </button>
        </div>
      </div>
    );
  }

  // ─── Reject Success Screen ───────────────────────────────────────────────
  if (flowState === 'REJECT_SUCCESS') {
    return (
      <div className="min-h-screen bg-[#162338] text-white px-4 py-12 flex items-center justify-center">
        <div className="max-w-md w-full rounded-2xl border border-emerald-500/20 bg-[#0f1b35] p-8 shadow-2xl text-center">
          <FaCheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-emerald-400 mb-2">Yêu Cầu Hoàn Tiền Thành Công</h2>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            Yêu cầu xin hoàn tiền cho mã đặt vé <strong className="text-[#FFD166] font-mono">{bookingId}</strong> đã được gửi tới hệ thống.
            <br/><br/>
            {successMessage ? (
              <span className="text-[#FFD166]">{successMessage}</span>
            ) : (
              <span>Bộ phận Tài vụ sẽ kiểm tra và tiến hành gửi email xác nhận hoàn tiền cho bạn trong thời gian sớm nhất.</span>
            )}
          </p>
          <button
            onClick={() => navigate('/my-bookings')}
            className="w-full py-3 rounded-lg bg-[#FFD166] text-black font-black uppercase text-sm hover:bg-[#FFE7A3] transition active:scale-95"
          >
            Quay về lịch sử đặt vé
          </button>
        </div>
      </div>
    );
  }

  return null;
}
