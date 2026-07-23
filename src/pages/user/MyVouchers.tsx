import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiGift, FiAlertOctagon, FiClock, FiCheckCircle, FiCopy, FiInfo } from 'react-icons/fi';
import { voucherService, type Voucher } from '../../services/voucherService';
import { compensationService, type Compensation } from '../../services/compensationService';

type TabType = 'EVENT' | 'COMPENSATION';

export default function MyVouchers() {
  const [activeTab, setActiveTab] = useState<TabType>('EVENT');
  const [myVouchers, setMyVouchers] = useState<Voucher[]>([]);
  const [exploreVouchers, setExploreVouchers] = useState<Voucher[]>([]);
  const [compensations, setCompensations] = useState<Compensation[]>([]);
  const [loading, setLoading] = useState(false);

  const loadEventVouchers = async () => {
    try {
      setLoading(true);
      const [walletRes, activeRes] = await Promise.all([
        voucherService.getMyVouchers(),
        voucherService.getActiveVouchers(),
      ]);

      if (walletRes.success) {
        setMyVouchers(walletRes.data || []);
      }
      if (activeRes.success) {
        setExploreVouchers(activeRes.data || []);
      }
    } catch (error) {
      console.error('Error loading event vouchers:', error);
      toast.error('Không tải được danh sách voucher sự kiện.');
    } finally {
      setLoading(false);
    }
  };

  const loadCompensations = async () => {
    try {
      setLoading(true);
      const res = await compensationService.getCustomerCompensations();
      if (res.success) {
        setCompensations(res.data || []);
      }
    } catch (error) {
      console.error('Error loading compensations:', error);
      toast.error('Không tải được danh sách quyền lợi sự cố.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'EVENT') {
      void loadEventVouchers();
    } else {
      void loadCompensations();
    }
  }, [activeTab]);

  const handleClaimVoucher = async (voucherId: string) => {
    try {
      const res = await voucherService.claimVoucher(voucherId);
      if (res.success) {
        toast.success('Nhận voucher thành công!');
        void loadEventVouchers();
      } else {
        toast.error(res.message || 'Không nhận được voucher.');
      }
    } catch (error) {
      console.error('Error claiming voucher:', error);
      toast.error('Lỗi hệ thống khi nhận voucher.');
    }
  };

  const handleCopyCode = (code: string) => {
    void navigator.clipboard.writeText(code);
    toast.success(`Đã sao chép mã: ${code}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Title */}
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-[#FFD166]/10 text-[#FFD166] p-3 rounded-2xl border border-[#FFD166]/20">
            <FiGift size={28} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
              Ví ưu đãi của tôi
            </h1>
            <p className="text-gray-400 text-xs md:text-sm mt-1">
              Quản lý và sử dụng các voucher khuyến mãi cùng quyền lợi bồi hoàn của bạn
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-gray-800 mb-8 gap-2">
          <button
            onClick={() => setActiveTab('EVENT')}
            className={`pb-4 px-6 font-bold text-sm uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'EVENT'
                ? 'border-[#FFD166] text-[#FFD166]'
                : 'border-transparent text-gray-500 hover:text-white'
            }`}
          >
            <FiGift size={16} />
            Voucher Sự Kiện
          </button>
          <button
            onClick={() => setActiveTab('COMPENSATION')}
            className={`pb-4 px-6 font-bold text-sm uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'COMPENSATION'
                ? 'border-[#FFD166] text-[#FFD166]'
                : 'border-transparent text-gray-500 hover:text-white'
            }`}
          >
            <FiAlertOctagon size={16} />
            Quyền Lợi Sự Cố
          </button>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-[#FFD166] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-400 text-sm">Đang tải dữ liệu...</p>
          </div>
        ) : activeTab === 'EVENT' ? (
          <div className="flex flex-col gap-10">
            {/* Owned Vouchers */}
            <div>
              <h2 className="text-lg font-bold uppercase tracking-wider text-gray-300 mb-4 flex items-center gap-2">
                <FiCheckCircle className="text-emerald-500" />
                Voucher Đang Sở Hữu ({myVouchers.length})
              </h2>

              {myVouchers.length === 0 ? (
                <div className="bg-[#111C44]/40 border border-gray-800 rounded-2xl p-8 text-center text-gray-500 text-sm">
                  Bạn chưa sở hữu voucher nào. Hãy chọn nhận thêm ở phần Khám phá ưu đãi bên dưới nhé!
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  {myVouchers.map((voucher) => (
                    <div
                      key={voucher.voucherId}
                      className="relative bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-gray-800 rounded-2xl overflow-hidden shadow-lg p-5 flex flex-col justify-between hover:border-gray-700 transition"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <div className="bg-[#FFD166]/10 text-[#FFD166] text-[11px] font-black tracking-wider uppercase px-2.5 py-1 rounded-md border border-[#FFD166]/20 inline-block mb-3">
                            Giảm {voucher.discountType === 'PERCENT' ? `${voucher.discountValue}%` : formatCurrency(voucher.discountValue)}
                          </div>
                          <h3 className="font-extrabold text-base text-white line-clamp-1">{voucher.title || 'Ưu đãi đặt vé'}</h3>
                          <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{voucher.description || 'Không có mô tả'}</p>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <button
                            onClick={() => handleCopyCode(voucher.voucherCode)}
                            className="bg-[#FFD166] text-black p-2 rounded-xl hover:brightness-105 active:scale-95 transition"
                            title="Copy mã voucher"
                          >
                            <FiCopy size={16} />
                          </button>
                          <span className="text-[10px] font-bold text-gray-500 mt-2 tracking-wider">{voucher.voucherCode}</span>
                        </div>
                      </div>

                      <div className="border-t border-gray-800/80 pt-4 mt-4 flex items-center justify-between text-[11px] text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <FiClock /> Hạn dùng: {formatDate(voucher.endDate)}
                        </span>
                        {voucher.minOrderAmount ? (
                          <span>Đơn từ {formatCurrency(voucher.minOrderAmount)}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Explore/Claimable Vouchers */}
            <div>
              <h2 className="text-lg font-bold uppercase tracking-wider text-gray-300 mb-4 flex items-center gap-2">
                <FiGift className="text-[#FFD166]" />
                Khám Phá Ưu Đãi
              </h2>

              {exploreVouchers.filter((ev) => !myVouchers.some((mv) => mv.voucherId === ev.voucherId)).length === 0 ? (
                <div className="bg-[#111C44]/40 border border-gray-800 rounded-2xl p-8 text-center text-gray-500 text-sm">
                  Hiện không có thêm ưu đãi nào mới để nhận. Quay lại sau nhé!
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  {exploreVouchers
                    .filter((ev) => !myVouchers.some((mv) => mv.voucherId === ev.voucherId))
                    .map((voucher) => (
                      <div
                        key={voucher.voucherId}
                        className="bg-[#111C44]/30 border border-gray-800/80 rounded-2xl p-5 flex justify-between items-center hover:border-gray-700/80 transition"
                      >
                        <div className="flex-1 pr-4">
                          <span className="text-[11px] font-extrabold text-[#FFD166] uppercase bg-[#FFD166]/10 px-2 py-0.5 rounded border border-[#FFD166]/20">
                            KM MỚI
                          </span>
                          <h3 className="font-extrabold text-sm text-white mt-2">{voucher.title || voucher.voucherCode}</h3>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-1">{voucher.description}</p>
                          <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
                            <FiClock /> Hạn chót nhận: {formatDate(voucher.endDate)}
                          </p>
                        </div>
                        <button
                          onClick={() => void handleClaimVoucher(voucher.voucherId)}
                          className="bg-gradient-to-r from-[#FFD166] to-[#FFEBA4] text-black font-extrabold px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition hover:brightness-105 active:scale-95 shrink-0"
                        >
                          Nhận ngay
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Incident Compensations Tab */
          <div>
            <div className="bg-[#FFD166]/10 border border-[#FFD166]/20 rounded-2xl p-4 mb-6 text-xs md:text-sm text-gray-300 flex gap-3 items-start">
              <FiInfo className="text-[#FFD166] shrink-0 mt-0.5" size={18} />
              <div>
                <span className="font-bold text-[#FFD166] block mb-1">Chính Sách Bồi Hoàn Sự Cố Rạp</span>
                Quyền lợi được tự động phát khi rạp bắt buộc phải hủy lịch chiếu của suất vé bạn đã mua. Vé bồi hoàn sử dụng được cho mọi phim, mọi rạp, bao gồm cả ghế VIP, phòng IMAX/4DX trong vòng 180 ngày. Voucher bắp nước được đổi trực tiếp tại quầy bắp nước của rạp.
              </div>
            </div>

            {compensations.length === 0 ? (
              <div className="bg-[#111C44]/40 border border-gray-800 rounded-2xl p-12 text-center text-gray-500 text-sm">
                Tuyệt vời! Bạn không có bất kỳ quyền lợi sự cố/bồi thường nào đang chờ sử dụng.
              </div>
            ) : (
              <div className="grid gap-8">
                {compensations.map((comp) => (
                  <div
                    key={comp.compensationId}
                    className="bg-[#111C44]/30 border border-gray-800 rounded-3xl p-6 flex flex-col gap-6"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-800/80 pb-5">
                      <div>
                        <span className="text-[11px] font-black text-[#FFD166] uppercase bg-[#FFD166]/10 border border-[#FFD166]/20 px-2.5 py-1 rounded-md">
                          Mã Bồi Thường #{comp.compensationId}
                        </span>
                        <div className="text-xs text-gray-400 mt-2.5">
                          Nguồn Booking gốc: <span className="font-mono text-gray-300">#{comp.sourceBookingId}</span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:items-end gap-1">
                        <span
                          className={`text-xs font-black px-2.5 py-0.5 rounded-full inline-block ${
                            comp.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'bg-gray-800 text-gray-500'
                          }`}
                        >
                          {comp.status === 'ACTIVE' ? 'ĐANG HOẠT ĐỘNG' : comp.status === 'USED' ? 'ĐÃ SỬ DỤNG' : 'HẾT HẠN'}
                        </span>
                        <span className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
                          <FiClock /> Hạn dùng: {formatDate(comp.expiresAt)}
                        </span>
                      </div>
                    </div>

                    {/* Tickets and Combos details */}
                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Ticket section */}
                      <div className="bg-[#0B0F19] border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
                        <h3 className="font-extrabold text-sm uppercase tracking-wider text-blue-400 border-b border-gray-850 pb-2">
                          Vé bồi hoàn ({comp.tickets.length} vé)
                        </h3>
                        <div className="flex flex-col gap-2">
                          {comp.tickets.map((t) => (
                            <div
                              key={t.compensationTicketId}
                              className="flex justify-between items-center bg-[#111C44]/40 border border-gray-800/50 p-3 rounded-xl"
                            >
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-bold text-gray-300">Vé xem phim bất kỳ</span>
                                <span className="text-[10px] font-mono text-gray-500">Mã: {t.voucherCode}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                    t.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-800 text-gray-500'
                                  }`}
                                >
                                  {t.status === 'ACTIVE' ? 'Chưa dùng' : 'Đã dùng'}
                                </span>
                                {t.status === 'ACTIVE' && (
                                  <button
                                    onClick={() => handleCopyCode(t.voucherCode)}
                                    className="text-gray-400 hover:text-white p-1"
                                    title="Copy mã vé bồi hoàn"
                                  >
                                    <FiCopy size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Combo section */}
                      <div className="bg-[#0B0F19] border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
                        <h3 className="font-extrabold text-sm uppercase tracking-wider text-yellow-500 border-b border-gray-850 pb-2">
                          Quầy bắp nước (1 combo)
                        </h3>
                        {comp.combo ? (
                          <div className="flex items-center gap-4 bg-[#111C44]/40 border border-gray-800/50 p-3 rounded-xl">
                            {/* QR Code */}
                            {comp.combo.status === 'ACTIVE' ? (
                              <div className="bg-white p-1 rounded-lg shrink-0 w-[72px] h-[72px] flex items-center justify-center">
                                <img
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(comp.combo.voucherCode)}`}
                                  alt="Combo QR"
                                  className="w-16 h-16 object-contain"
                                />
                              </div>
                            ) : (
                              <div className="w-[72px] h-[72px] bg-gray-800 rounded-lg flex items-center justify-center shrink-0">
                                <FiAlertOctagon size={24} className="text-gray-600" />
                              </div>
                            )}

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-bold text-white block truncate">{comp.combo.displayName}</span>
                              <span className="text-[10px] text-gray-400 mt-1 block">
                                Trạng thái:{' '}
                                <span
                                  className={`ml-1 font-bold ${
                                    comp.combo.status === 'ACTIVE' ? 'text-emerald-500' : 'text-gray-500'
                                  }`}
                                >
                                  {comp.combo.status === 'ACTIVE' ? 'Chưa đổi' : 'Đã đổi'}
                                </span>
                              </span>
                              <div className="flex items-center gap-1.5 mt-2">
                                <span className="text-[10px] font-mono text-gray-500 bg-[#0B0F19] px-2 py-0.5 rounded border border-gray-800">
                                  {comp.combo.voucherCode}
                                </span>
                                {comp.combo.status === 'ACTIVE' && (
                                  <button
                                    onClick={() => handleCopyCode(comp.combo!.voucherCode)}
                                    className="text-gray-400 hover:text-white p-1"
                                    title="Copy mã combo"
                                  >
                                    <FiCopy size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-500 text-xs py-4 text-center">
                            Không nhận được combo bắp nước đi kèm bồi hoàn này
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
