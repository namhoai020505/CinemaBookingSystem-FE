import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaUniversity,
  FaArrowRight,
  FaLock,
  FaSpinner,
  FaTicketAlt,
  FaInfoCircle,
} from 'react-icons/fa';
import {
  customerRefundService,
  type BankResponse,
  type RefundClaimResponse,
} from '../../services/customerRefundService';
import { toast } from 'react-toastify';

export default function RefundClaimPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('t');
  const navigate = useNavigate();

  // Loading & Error States for Resolution
  const [resolving, setResolving] = useState(false);
  const [claimInfo, setClaimInfo] = useState<RefundClaimResponse | null>(null);
  const [errorText, setErrorText] = useState('');

  // Dropdown bank list
  const [banks, setBanks] = useState<BankResponse[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);

  // Form states for saving bank details
  const [selectedBank, setSelectedBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [saving, setSaving] = useState(false);

  // Flow State
  // 'RESOLVING' | 'FILL_INFO' | 'REVIEW' | 'SUCCESS' | 'ERROR'
  const [flowState, setFlowState] = useState<'RESOLVING' | 'FILL_INFO' | 'REVIEW' | 'SUCCESS' | 'ERROR'>('RESOLVING');

  // Submit claim state
  const [submitting, setSubmitting] = useState(false);

  // Form states for requesting a new link
  const [requestingLink, setRequestingLink] = useState(false);
  const [reqBookingId, setReqBookingId] = useState(searchParams.get('bookingId') || '');
  const [reqTicketId, setReqTicketId] = useState('');
  const [reqReason, setReqReason] = useState('Suất chiếu bị hủy, tôi chưa nhận được tiền hoàn.');

  // ─── Fetch Bank list ─────────────────────────────────────────────────────────
  const fetchBanks = useCallback(async () => {
    try {
      setBanksLoading(true);
      const data = await customerRefundService.getBanks();
      setBanks(data);
    } catch (err: unknown) {
      console.error('Lỗi khi tải danh sách ngân hàng:', err);
    } finally {
      setBanksLoading(false);
    }
  }, []);

  // ─── Resolve Token ──────────────────────────────────────────────────────────
  const resolveToken = useCallback(async (tokenVal: string) => {
    try {
      setResolving(true);
      setErrorText('');
      setFlowState('RESOLVING');
      const data = await customerRefundService.resolveClaim(tokenVal);
      setClaimInfo(data);

      // Pre-fill if already saved draft
      setSelectedBank(data.bankCode || '');
      setAccountHolderName(data.accountHolderName || '');
      // Note: maskedAccountNumber is only for display, we cannot pre-fill accountNumber since it is encrypted and masked.

      if (data.claimStatus === 'MANUAL_REQUIRED' || data.claimStatus === 'COMPLETED') {
        setFlowState('SUCCESS');
      } else {
        setFlowState('FILL_INFO');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không xác thực được liên kết hoàn tiền này.';
      setErrorText(msg);
      setFlowState('ERROR');
    } finally {
      setResolving(false);
    }
  }, []);

  useEffect(() => {
    void fetchBanks();
    if (token) {
      void resolveToken(token);
    } else {
      setFlowState('ERROR');
      setErrorText('Bạn chưa cung cấp token hoàn tiền. Vui lòng kiểm tra email hoặc yêu cầu cấp lại link mới.');
    }
  }, [token, fetchBanks, resolveToken]);

  // ─── Save Draft ─────────────────────────────────────────────────────────────
  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimInfo) return;

    if (!selectedBank) {
      toast.error('Vui lòng chọn ngân hàng');
      return;
    }

    const accPattern = /^[0-9]{6,20}$/;
    if (!accPattern.test(accountNumber)) {
      toast.error('Số tài khoản phải gồm 6 - 20 chữ số.');
      return;
    }

    if (accountHolderName.trim().length < 2 || accountHolderName.trim().length > 255) {
      toast.error('Tên chủ tài khoản phải từ 2 - 255 ký tự.');
      return;
    }

    try {
      setSaving(true);
      const updated = await customerRefundService.saveBankAccount(claimInfo.refundClaimId, {
        bankCode: selectedBank,
        accountNumber: accountNumber.trim(),
        accountHolderName: accountHolderName.trim().toUpperCase(),
      });
      setClaimInfo(updated);
      toast.success('Đã lưu thông tin tài khoản ngân hàng nháp.');
      setFlowState('REVIEW');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lưu thông tin thất bại.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ─── Submit Claim ───────────────────────────────────────────────────────────
  const handleSubmitClaim = async () => {
    if (!claimInfo) return;
    try {
      setSubmitting(true);
      const final = await customerRefundService.submitClaim(claimInfo.refundClaimId);
      setClaimInfo(final);
      toast.success('Yêu cầu hoàn tiền đã gửi thành công!');
      setFlowState('SUCCESS');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gửi yêu cầu hoàn tiền thất bại.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Request New Link ────────────────────────────────────────────────────────
  const handleRequestNewLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqBookingId.trim()) {
      toast.error('Vui lòng nhập Mã Đặt Vé');
      return;
    }
    if (reqReason.trim().length < 5) {
      toast.error('Lý do yêu cầu phải có ít nhất 5 ký tự.');
      return;
    }

    try {
      setRequestingLink(true);
      await customerRefundService.requestNewLink({
        bookingId: reqBookingId.trim(),
        reason: reqReason.trim(),
        ticketId: reqTicketId.trim() || undefined,
      });
      toast.success('Yêu cầu thành công! Một đường link hoàn tiền mới đã được gửi vào email của bạn.');
      setReqBookingId('');
      setReqTicketId('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gửi yêu cầu thất bại.';
      toast.error(msg);
    } finally {
      setRequestingLink(false);
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('vi-VN') + ' đ';
  };

  const formatDateTime = (val?: string | null) => {
    if (!val) return '';
    return new Date(val).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  };

  // ─── Render States ──────────────────────────────────────────────────────────

  // RESOLVING (Checking token)
  if (flowState === 'RESOLVING') {
    return (
      <div className="min-h-screen bg-[#162338] flex flex-col items-center justify-center text-white px-4 py-8">
        <FaSpinner className="h-10 w-10 text-[#FFD166] animate-spin mb-4" />
        <h2 className="text-xl font-black">Đang xác thực liên kết hoàn tiền...</h2>
        <p className="text-sm text-slate-400 mt-2">Vui lòng chờ trong giây lát.</p>
      </div>
    );
  }

  // SUCCESS (Claimed or just submitted successfully)
  if (flowState === 'SUCCESS' && claimInfo) {
    return (
      <div className="min-h-screen bg-[#162338] text-white px-4 py-12 flex items-center justify-center">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#0f1b35] p-8 shadow-2xl text-center">
          <FaCheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-black mb-2">Đăng Ký Thành Công!</h2>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            Yêu cầu hoàn tiền cho đặt vé <strong className="text-blue-300 font-mono">{claimInfo.bookingId}</strong> đã được gửi tới bộ phận Tài vụ. Admin sẽ kiểm tra và thực hiện chuyển khoản thủ công cho bạn.
          </p>

          <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02] text-left text-sm mb-6 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Số tiền:</span>
              <span className="font-black text-emerald-400">{formatCurrency(claimInfo.refundAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Ngân hàng:</span>
              <span className="font-bold text-white">{claimInfo.bankName || claimInfo.bankCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Số tài khoản:</span>
              <span className="font-mono text-white">{claimInfo.maskedAccountNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Chủ tài khoản:</span>
              <span className="font-bold text-white uppercase">{claimInfo.accountHolderName}</span>
            </div>
            {claimInfo.submittedAt && (
              <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-white/5">
                <span>Gửi lúc:</span>
                <span>{formatDateTime(claimInfo.submittedAt)}</span>
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/my-bookings')}
            className="w-full py-3 rounded-lg bg-[#FFD166] text-black font-black uppercase text-sm hover:bg-[#FFE7A3] transition active:scale-95"
          >
            Quay về lịch sử vé
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#162338] text-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Title Header */}
        <section className="border-b border-white/10 pb-6 mb-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FFD166]">
            Khách hàng
          </p>
          <h1 className="text-3xl font-black leading-tight mt-1">
            Yêu Cầu Hoàn Tiền Vé
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Điền tài khoản ngân hàng của bạn để chúng tôi thực hiện hoàn tiền sau sự cố lịch chiếu hoặc hủy vé.
          </p>
        </section>

        {/* ─── STATE: ERROR / REQUEST NEW LINK ─── */}
        {flowState === 'ERROR' && (
          <div className="space-y-6">
            <div className="flex gap-3 rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 text-sm font-semibold text-rose-100">
              <FaExclamationTriangle className="mt-1 shrink-0 h-5 w-5 text-rose-400" />
              <div>
                <p className="font-black text-base text-rose-300">Không tìm thấy yêu cầu hoàn tiền hợp lệ</p>
                <p className="mt-1 text-slate-300 font-normal leading-relaxed">{errorText}</p>
              </div>
            </div>

            {/* Reissue request card */}
            <div className="rounded-xl border border-white/10 bg-[#0f1b35] p-6 shadow-xl">
              <h3 className="text-lg font-black mb-3">Yêu Cầu Gửi Lại Link Hoàn Tiền</h3>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Nhập Mã Đặt Vé của bạn. Nếu hệ thống ghi nhận vé đủ điều kiện hoàn tiền và chưa khai báo ngân hàng, chúng tôi sẽ gửi lại email chứa đường link mới hiệu lực trong 5 phút.
              </p>

              <form onSubmit={handleRequestNewLink} className="space-y-4">
                <div className="grid gap-1.5">
                  <label className="text-xs font-black uppercase text-slate-400">Mã Đặt Vé (Booking ID) *</label>
                  <input
                    type="text"
                    required
                    placeholder="BKG_XXXXXXXXXXXX"
                    value={reqBookingId}
                    onChange={(e) => setReqBookingId(e.target.value)}
                    className="w-full bg-[#17264a] border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#FFD166] text-sm font-mono font-bold"
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-xs font-black uppercase text-slate-400">Mã Vé (Ticket ID - Không bắt buộc)</label>
                  <input
                    type="text"
                    placeholder="TCK_XXXXXXXXXXXX"
                    value={reqTicketId}
                    onChange={(e) => setReqTicketId(e.target.value)}
                    className="w-full bg-[#17264a] border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#FFD166] text-sm font-mono"
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-xs font-black uppercase text-slate-400">Lý do yêu cầu *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="VD: Link cũ hết hạn, tôi cần link mới để điền tài khoản."
                    value={reqReason}
                    onChange={(e) => setReqReason(e.target.value)}
                    className="w-full bg-[#17264a] border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#FFD166] text-sm leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={requestingLink}
                  className="w-full py-3 rounded-lg bg-[#FFD166] text-black font-black uppercase text-sm hover:bg-[#FFE7A3] transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                >
                  {requestingLink ? (
                    <>
                      <FaSpinner className="animate-spin text-lg" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <span>Yêu cầu gửi Email hoàn tiền</span>
                      <FaArrowRight />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── STATE: FILL INFORMATION ─── */}
        {flowState === 'FILL_INFO' && claimInfo && (
          <div className="space-y-6">
            {/* Booking Refund summary */}
            <div className="rounded-xl border border-white/10 bg-[#0f1b35] p-5 shadow-lg">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#FFD166] mb-3">
                <FaTicketAlt />
                Thông tin hoàn tiền
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
                <div>
                  <h3 className="text-xl font-black">{claimInfo.movieTitle}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {claimInfo.cinemaName} | Phòng: {claimInfo.showtimeStartTime ? 'Đang cập nhật' : '—'}
                  </p>
                  <p className="text-xs text-slate-500 font-mono mt-1">Mã đặt vé: {claimInfo.bookingId}</p>
                </div>
                <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-left sm:text-right shrink-0">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">Số tiền được hoàn</p>
                  <p className="mt-1 text-2xl font-black text-emerald-400">{formatCurrency(claimInfo.refundAmount)}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-amber-300 bg-amber-950/20 border border-amber-500/20 rounded-lg p-3">
                <FaInfoCircle className="shrink-0" />
                <span>Liên kết điền thông tin này sẽ hết hạn lúc: <strong className="font-bold">{formatDateTime(claimInfo.expiresAt)}</strong></span>
              </div>
            </div>

            {/* Bank Form Card */}
            <div className="rounded-xl border border-white/10 bg-[#0f1b35] p-6 shadow-xl">
              <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                <FaUniversity className="text-[#FFD166]" />
                Nhập Tài Khoản Nhận Tiền
              </h3>

              <form onSubmit={handleSaveBank} className="space-y-5">
                <div className="grid gap-1.5">
                  <label className="text-xs font-black uppercase text-slate-400">Ngân hàng thụ hưởng *</label>
                  <select
                    required
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="w-full bg-[#17264a] border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#FFD166] text-sm"
                  >
                    <option value="">-- Chọn ngân hàng --</option>
                    {banksLoading ? (
                      <option disabled>Đang tải danh sách ngân hàng...</option>
                    ) : (
                      banks.map((b) => (
                        <option key={b.bankCode} value={b.bankCode}>
                          {b.shortName} - {b.fullName}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-xs font-black uppercase text-slate-400">Số tài khoản *</label>
                  <input
                    type="text"
                    required
                    pattern="[0-9]{6,20}"
                    placeholder="Nhập số tài khoản ngân hàng"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full bg-[#17264a] border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#FFD166] text-sm font-mono"
                  />
                  <p className="text-[10px] text-slate-500">Chỉ điền các chữ số, độ dài từ 6 đến 20 số.</p>
                </div>

                <div className="grid gap-1.5">
                  <label className="text-xs font-black uppercase text-slate-400">Tên chủ tài khoản (Viết không dấu) *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: NGUYEN VAN A"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value.toUpperCase())}
                    className="w-full bg-[#17264a] border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#FFD166] text-sm uppercase font-bold"
                  />
                  <p className="text-[10px] text-slate-500">Tên ghi trên thẻ ngân hàng, vui lòng viết HOA không dấu.</p>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 rounded-lg bg-[#FFD166] text-black font-black uppercase text-sm hover:bg-[#FFE7A3] transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <FaSpinner className="animate-spin text-lg" />
                      Đang kiểm tra và lưu...
                    </>
                  ) : (
                    <>
                      <span>Lưu & Kiểm tra thông tin</span>
                      <FaArrowRight />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── STATE: REVIEW (Review masked bank and Confirm Submit) ─── */}
        {flowState === 'REVIEW' && claimInfo && (
          <div className="space-y-6">
            <div className="rounded-xl border border-white/10 bg-[#0f1b35] p-6 shadow-xl">
              <div className="text-center mb-6">
                <FaLock className="h-10 w-10 text-amber-400 mx-auto mb-2" />
                <h3 className="text-xl font-black">Xác Nhận Thông Tin Thụ Hưởng</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  Vì lý do bảo mật, tài khoản ngân hàng của bạn đã được mã hóa ở máy chủ. Hãy xem lại thông tin che giấu dưới đây trước khi gửi yêu cầu.
                </p>
              </div>

              <div className="border border-white/10 rounded-xl p-5 bg-white/[0.02] text-sm space-y-4 mb-6">
                <div className="flex justify-between items-center pb-3 border-b border-white/5">
                  <span className="text-slate-400">Số tiền nhận:</span>
                  <span className="font-black text-lg text-emerald-400">{formatCurrency(claimInfo.refundAmount)}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Ngân hàng thụ hưởng:</span>
                  <span className="font-bold text-white">{claimInfo.bankName || claimInfo.bankCode}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Số tài khoản:</span>
                  <span className="font-mono text-white tracking-widest">{claimInfo.maskedAccountNumber}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">Chủ tài khoản:</span>
                  <span className="font-bold text-white uppercase">{claimInfo.accountHolderName}</span>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setFlowState('FILL_INFO')}
                  className="flex-1 py-3 rounded-lg border border-white/15 text-slate-300 font-bold uppercase text-sm hover:bg-white/5 transition"
                >
                  Sửa lại
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmitClaim()}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-black uppercase text-sm hover:brightness-110 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <FaSpinner className="animate-spin text-lg" />
                      Đang gửi...
                    </>
                  ) : (
                    <>
                      <span>Xác nhận & Gửi</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
