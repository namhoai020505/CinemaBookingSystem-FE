import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaSpinner, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { bookingService } from '../../services/bookingService';
import { customerRefundService } from '../../services/customerRefundService';
import type { BankResponse } from '../../services/customerRefundService';
import axiosInstance from '../../lib/api';

type FlowState = 'LOADING' | 'ACCEPT_SUCCESS' | 'REJECT_FORM' | 'REJECT_SUCCESS' | 'ERROR';

export default function ConfirmTimeChangePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const bookingId = searchParams.get('bookingId') || '';
  const acceptParam = searchParams.get('accept');
  const token = searchParams.get('token') || '';

  const [flowState, setFlowState] = useState<FlowState>('LOADING');
  const [errorText, setErrorText] = useState('');

  // Reject form states
  const [banks, setBanks] = useState<BankResponse[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [selectedBank, setSelectedBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Success summary info
  const [successBankName, setSuccessBankName] = useState('');
  const [successAccountNumber, setSuccessAccountNumber] = useState('');
  const [successHolderName, setSuccessHolderName] = useState('');

  // ─── Fetch Active Banks ──────────────────────────────────────────────────
  const fetchBanks = useCallback(async () => {
    try {
      setBanksLoading(true);
      const list = await customerRefundService.getBanks();
      setBanks(list);
    } catch (err) {
      console.error('Lỗi khi tải danh sách ngân hàng:', err);
    } finally {
      setBanksLoading(false);
    }
  }, []);

  // ─── Confirm/Accept Process ──────────────────────────────────────────────
  const handleConfirmAccept = useCallback(async (bId: string, tok: string) => {
    try {
      setFlowState('LOADING');
      const res = await bookingService.confirmTimeChange(bId, true, tok);
      if (res.success) {
        setFlowState('ACCEPT_SUCCESS');
      } else {
        setErrorText(res.message || 'Không thể xác nhận đổi giờ chiếu.');
        setFlowState('ERROR');
      }
    } catch (err: unknown) {
      let msg = 'Đã xảy ra lỗi khi xác nhận đổi giờ chiếu.';
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

  useEffect(() => {
    if (!bookingId || !token || acceptParam === null) {
      setFlowState('ERROR');
      setErrorText('Liên kết không hợp lệ. Vui lòng kiểm tra lại email xác nhận từ rạp chiếu.');
      return;
    }

    const isAccept = acceptParam === 'true';
    if (isAccept) {
      void handleConfirmAccept(bookingId, token);
    } else {
      // Rejection: require bank account info first
      setFlowState('REJECT_FORM');
      void fetchBanks();
    }
  }, [bookingId, acceptParam, token, handleConfirmAccept, fetchBanks]);

  // ─── Submit Rejection & Refund Request ────────────────────────────────────
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBank) {
      toast.error('Vui lòng chọn ngân hàng');
      return;
    }
    if (!accountNumber.trim()) {
      toast.error('Vui lòng nhập số tài khoản');
      return;
    }
    if (!accountHolderName.trim()) {
      toast.error('Vui lòng nhập tên chủ tài khoản');
      return;
    }

    try {
      setSubmitting(true);

      // Use axiosInstance to POST direct to Backend endpoint
      // We will perform a direct axios call since we created this custom endpoint
      // Let's call the POST directly via api or modify bookingService to support POST.
      // Since bookingService has no custom post implementation yet, we can do it inline:
      const payload = {
        accept: false,
        token: token,
        bankCode: selectedBank,
        accountNumber: accountNumber.trim(),
        accountHolderName: accountHolderName.trim()
      };

      // Axios call using axiosInstance
      const resData = await axiosInstance.post(`/api/bookings/${bookingId}/confirm-time-change`, payload) as { success: boolean; message?: string };

      if (resData.success) {
        const matchedBank = banks.find(b => b.bankCode === selectedBank);
        setSuccessBankName(matchedBank ? matchedBank.shortName : selectedBank);
        setSuccessAccountNumber(accountNumber.trim());
        setSuccessHolderName(accountHolderName.trim().toUpperCase());
        setFlowState('REJECT_SUCCESS');
        toast.success('Gửi yêu cầu hoàn tiền thành công!');
      } else {
        toast.error(resData.message || 'Gửi yêu cầu thất bại.');
      }
    } catch (err: unknown) {
      let msg = 'Gửi yêu cầu hoàn tiền thất bại.';
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      if (axiosErr?.response?.data?.message) {
        msg = axiosErr.response.data.message;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

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
            Bạn đã đồng ý với thay đổi lịch chiếu từ rạp. Vé của bạn đã được cập nhật sang giờ chiếu mới hợp lệ. Vui lòng kiểm tra lịch chiếu mới trong trang lịch sử đặt vé.
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
            Yêu cầu từ chối đổi giờ và xin hoàn tiền cho mã đặt vé <strong className="text-[#FFD166] font-mono">{bookingId}</strong> đã được gửi tới hệ thống. Bộ phận Tài vụ sẽ kiểm tra và chuyển khoản hoàn tiền thủ công cho bạn.
          </p>

          <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02] text-left text-sm mb-6 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Ngân hàng:</span>
              <span className="font-bold text-white">{successBankName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Số tài khoản:</span>
              <span className="font-mono text-white font-bold">{successAccountNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Chủ tài khoản:</span>
              <span className="font-bold text-white uppercase">{successHolderName}</span>
            </div>
          </div>

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

  // ─── Reject Form Screen ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#162338] text-white px-4 py-12 flex items-center justify-center">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#0f1b35] p-8 shadow-2xl">
        <h2 className="text-2xl font-black text-center mb-2">Hủy Vé & Yêu Cầu Hoàn Tiền</h2>
        <p className="text-sm text-slate-400 text-center leading-relaxed mb-6">
          Bạn đang yêu cầu hủy vé cho đơn hàng <strong className="text-blue-300 font-mono">{bookingId}</strong> do thay đổi lịch chiếu từ rạp. Vui lòng điền thông tin tài khoản ngân hàng để nhận hoàn tiền.
        </p>

        <form onSubmit={handleRejectSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Chọn Ngân Hàng
            </label>
            {banksLoading ? (
              <div className="flex items-center space-x-2 py-3">
                <FaSpinner className="animate-spin text-[#FFD166]" />
                <span className="text-xs text-slate-400">Đang tải danh sách ngân hàng...</span>
              </div>
            ) : (
              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                className="w-full rounded-lg bg-[#0e1726] border border-white/10 p-3 text-white focus:outline-none focus:border-[#FFD166] text-sm"
              >
                <option value="">-- Chọn ngân hàng --</option>
                {banks.map((b) => (
                  <option key={b.bankCode} value={b.bankCode}>
                    {b.shortName} - {b.fullName}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Số Tài Khoản
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\s+/g, ''))}
              placeholder="Nhập số tài khoản"
              className="w-full rounded-lg bg-white/5 border border-white/10 p-3 text-white focus:outline-none focus:border-[#FFD166] text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Tên Chủ Tài Khoản
            </label>
            <input
              type="text"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              placeholder="Ví dụ: NGUYEN VAN A"
              className="w-full rounded-lg bg-white/5 border border-white/10 p-3 text-white focus:outline-none focus:border-[#FFD166] text-sm uppercase"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg bg-rose-500 text-white font-black uppercase text-sm hover:bg-rose-600 transition active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {submitting && <FaSpinner className="animate-spin" />}
            <span>Xác nhận hủy &amp; yêu cầu hoàn tiền</span>
          </button>
        </form>
      </div>
    </div>
  );
}
