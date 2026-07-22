import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  FiCheckCircle,
  FiClock,
  FiCopy,
  FiCreditCard,
  FiGift,
  FiLock,
  FiRefreshCw,
  FiShoppingBag,
  FiTag,
  FiUsers,
} from 'react-icons/fi';
import { voucherService, type Voucher } from '../../services/voucherService';

type VoucherTab = 'ALL' | 'WALLET' | 'PRIVATE' | 'PUBLIC';
type VoucherSource = 'WALLET' | 'PUBLIC';
type VoucherDisplayItem = {
  voucher: Voucher;
  source: VoucherSource;
};

type ApiErrorLike = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

const formatCurrency = (value?: number | null) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Không xác định';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  const apiError = error as ApiErrorLike;
  return apiError.response?.data?.message || fallback;
};

const getScopeLabel = (voucher: Voucher) => {
  switch ((voucher.applicableScope || '').toUpperCase()) {
    case 'TICKET_ONLY':
      return 'Áp dụng tiền vé';
    case 'FOOD_BEVERAGE_ONLY':
      return 'Áp dụng F&B';
    default:
      return 'Áp dụng toàn đơn';
  }
};

const getDiscountLabel = (voucher: Voucher) => {
  if (voucher.discountType === 'PERCENT') {
    return `${voucher.discountValue}%`;
  }

  return formatCurrency(voucher.discountValue);
};

const getCategoryLabel = (voucher: Voucher) => {
  switch ((voucher.category || '').toUpperCase()) {
    case 'FOOD_BEVERAGE':
      return 'Ưu đãi F&B';
    case 'COMPENSATION':
      return 'Voucher đền bù';
    default:
      return 'Ưu đãi vé';
  }
};

const isCustomerScopedVoucher = (voucher: Voucher) =>
  voucher.isPrivate ||
  (voucher.targetType || '').toUpperCase() === 'SPECIFIC_CUSTOMERS';

const isPublicVoucher = (voucher: Voucher) =>
  !voucher.isPrivate &&
  (voucher.targetType || 'ALL_CUSTOMERS').toUpperCase() !== 'SPECIFIC_CUSTOMERS';

const isVoucherAvailable = (voucher: Voucher) => {
  const now = Date.now();
  return (
    voucher.voucherStatus === 'ACTIVE' &&
    new Date(voucher.startDate).getTime() <= now &&
    new Date(voucher.endDate).getTime() >= now &&
    voucher.usedCount < voucher.usageLimit
  );
};

const getVoucherStatusLabel = (voucher: Voucher) => {
  const now = Date.now();
  const startTime = new Date(voucher.startDate).getTime();
  const endTime = new Date(voucher.endDate).getTime();

  if (voucher.voucherStatus !== 'ACTIVE') {
    return 'Tạm ngừng';
  }

  if (!Number.isNaN(startTime) && startTime > now) {
    return 'Sắp mở';
  }

  if (!Number.isNaN(endTime) && endTime < now) {
    return 'Hết hạn';
  }

  if (voucher.usedCount >= voucher.usageLimit) {
    return 'Hết lượt';
  }

  return 'Có thể dùng';
};

export default function MyVouchers() {
  const [walletVouchers, setWalletVouchers] = useState<Voucher[]>([]);
  const [publicVouchers, setPublicVouchers] = useState<Voucher[]>([]);
  const [activeTab, setActiveTab] = useState<VoucherTab>('ALL');
  const [loading, setLoading] = useState(true);
  const [claimingVoucherId, setClaimingVoucherId] = useState('');

  const fetchVouchers = useCallback(async () => {
    try {
      setLoading(true);
      const [walletResponse, publicResponse] = await Promise.all([
        voucherService.getMyVouchers(),
        voucherService.getActiveVouchers(),
      ]);

      setWalletVouchers(walletResponse.data || []);
      setPublicVouchers(publicResponse.data || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không tải được ví ưu đãi.'));
      setWalletVouchers([]);
      setPublicVouchers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchVouchers();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchVouchers]);

  const walletVoucherIds = useMemo(
    () => new Set(walletVouchers.map((voucher) => voucher.voucherId)),
    [walletVouchers],
  );

  const visibleVouchers = useMemo(() => {
    const walletItems: VoucherDisplayItem[] = walletVouchers.map((voucher) => ({
      voucher,
      source: 'WALLET',
    }));
    const publicItems = publicVouchers
      .filter((voucher) => isPublicVoucher(voucher) && !walletVoucherIds.has(voucher.voucherId))
      .map((voucher): VoucherDisplayItem => ({ voucher, source: 'PUBLIC' }));
    const allItems = [...walletItems, ...publicItems];

    if (activeTab === 'WALLET') {
      return walletItems;
    }

    if (activeTab === 'PRIVATE') {
      return walletItems.filter((item) => item.voucher.isPrivate);
    }

    if (activeTab === 'PUBLIC') {
      return publicItems;
    }

    return allItems;
  }, [activeTab, publicVouchers, walletVoucherIds, walletVouchers]);

  const availablePublicCount = publicVouchers.filter(
    (voucher) => isPublicVoucher(voucher) && !walletVoucherIds.has(voucher.voucherId),
  ).length;
  const allVoucherCount = walletVouchers.length + availablePublicCount;

  const handleClaimVoucher = async (voucher: Voucher) => {
    try {
      setClaimingVoucherId(voucher.voucherId);
      const response = await voucherService.claimVoucher(voucher.voucherId);

      if (!response.success) {
        throw new Error(response.message || 'Không thể nhận voucher này.');
      }

      toast.success(`Đã thêm voucher ${voucher.voucherCode} vào ví ưu đãi.`);
      await fetchVouchers();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể nhận voucher này.'));
    } finally {
      setClaimingVoucherId('');
    }
  };

  const handleCopyVoucherCode = async (voucherCode: string) => {
    try {
      await navigator.clipboard.writeText(voucherCode);
      toast.success(`Đã sao chép mã ${voucherCode}.`);
    } catch {
      toast.warn('Trình duyệt không cho phép sao chép tự động. Bạn có thể bôi đen mã voucher để copy thủ công.');
    }
  };

  const tabs: Array<{ value: VoucherTab; label: string; count: number }> = [
    { value: 'ALL', label: 'Tất cả', count: allVoucherCount },
    { value: 'WALLET', label: 'Ví của tôi', count: walletVouchers.length },
    {
      value: 'PRIVATE',
      label: 'Riêng cho tôi',
      count: walletVouchers.filter((voucher) => voucher.isPrivate).length,
    },
    {
      value: 'PUBLIC',
      label: 'Công khai',
      count: availablePublicCount,
    },
  ];

  return (
    <div className="min-h-[calc(100vh-220px)] bg-[#182437] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs font-black uppercase tracking-[0.18em] text-[#FFD166]">
              Ví ưu đãi
            </span>
            <h1 className="mt-2 text-2xl font-black uppercase sm:text-3xl">
              Voucher của tôi
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-white/60">
              Ví chỉ hiển thị voucher công khai đang mở và voucher riêng đã được hệ thống gán cho tài khoản của bạn.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void fetchVouchers()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-black text-white transition hover:bg-white/10"
          >
            <FiRefreshCw />
            Làm mới
          </button>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const isActive = tab.value === activeTab;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black transition ${
                  isActive
                    ? 'border-[#FFD166] bg-[#FFD166] text-[#111827]'
                    : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="mt-8 rounded-lg border border-white/10 bg-[#0F172A] px-4 py-16 text-center text-sm font-bold text-white/60">
            Đang tải ví ưu đãi...
          </div>
        ) : visibleVouchers.length === 0 ? (
          <div className="mt-8 rounded-lg border border-white/10 bg-[#0F172A] px-4 py-16 text-center">
            <FiGift className="mx-auto text-4xl text-white/35" />
            <p className="mt-4 text-lg font-black">Chưa có voucher phù hợp</p>
            <p className="mt-2 text-sm font-semibold text-white/55">
              Khi hệ thống tặng voucher mới, voucher sẽ xuất hiện tại đây.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleVouchers.map(({ voucher, source }) => {
              const available = isVoucherAvailable(voucher);
              const isClaiming = claimingVoucherId === voucher.voucherId;
              const statusLabel = getVoucherStatusLabel(voucher);
              const ownershipLabel =
                source === 'WALLET'
                  ? 'Trong ví của tôi'
                  : 'Có thể nhận';

              return (
                <article
                  key={`${source}-${voucher.voucherId}`}
                  className={`overflow-hidden rounded-xl border bg-[#0F172A] shadow-xl shadow-black/20 ${
                    available ? 'border-white/10' : 'border-red-400/20 opacity-70'
                  }`}
                >
                  <div className="border-b border-white/10 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-black text-[#FFD166]">
                          {voucher.voucherCode}
                        </p>
                        <h2 className="mt-2 line-clamp-2 text-lg font-black">
                          {voucher.title || 'Ưu đãi G2Cinema'}
                        </h2>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black ${
                          isCustomerScopedVoucher(voucher)
                            ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
                            : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                        }`}
                      >
                        {isCustomerScopedVoucher(voucher) ? <FiLock /> : <FiCheckCircle />}
                        {isCustomerScopedVoucher(voucher) ? 'Riêng cho tôi' : 'Công khai'}
                      </span>
                    </div>

                    <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-white/60">
                      {voucher.description || 'Voucher áp dụng theo điều kiện của chương trình.'}
                    </p>
                  </div>

                  <div className="space-y-4 p-5">
                    <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-wide">
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-400/25 bg-blue-400/10 px-2.5 py-1 text-blue-200">
                        <FiGift />
                        {getCategoryLabel(voucher)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${
                          available
                            ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
                            : 'border-red-400/25 bg-red-400/10 text-red-200'
                        }`}
                      >
                        <FiClock />
                        {statusLabel}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-white/5 p-3">
                      <span className="inline-flex items-center gap-2 text-sm font-bold text-white/60">
                        <FiTag className="text-[#FFD166]" />
                        Mức giảm
                      </span>
                      <span className="text-xl font-black text-[#FFD166]">
                        {getDiscountLabel(voucher)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-white/5 p-3">
                        <p className="text-xs font-bold text-white/45">Phạm vi</p>
                        <p className="mt-1 font-black">{getScopeLabel(voucher)}</p>
                        {voucher.specificFbItemIds ? (
                          <p className="mt-1 text-[10px] font-semibold text-white/45">
                            F&B được chọn
                          </p>
                        ) : null}
                      </div>
                      <div className="rounded-lg bg-white/5 p-3">
                        <p className="text-xs font-bold text-white/45">Đơn tối thiểu</p>
                        <p className="mt-1 font-black">
                          {voucher.minOrderAmount ? formatCurrency(voucher.minOrderAmount) : 'Không có'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-white/5 p-3">
                        <p className="text-xs font-bold text-white/45">Giảm tối đa</p>
                        <p className="mt-1 font-black">
                          {voucher.discountType === 'PERCENT'
                            ? voucher.maxDiscountAmount
                              ? formatCurrency(voucher.maxDiscountAmount)
                              : 'Không giới hạn'
                            : 'Bằng mức giảm'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white/5 p-3">
                        <p className="text-xs font-bold text-white/45">Lượt còn lại</p>
                        <p className="mt-1 font-black">
                          {Math.max(voucher.usageLimit - voucher.usedCount, 0)} lượt
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-white/5 p-3">
                        <p className="inline-flex items-center gap-1 text-xs font-bold text-white/45">
                          <FiUsers />
                          Nhóm áp dụng
                        </p>
                        <p className="mt-1 font-black">
                          {isCustomerScopedVoucher(voucher) ? 'Tài khoản của bạn' : 'Mọi khách hàng'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white/5 p-3">
                        <p className="inline-flex items-center gap-1 text-xs font-bold text-white/45">
                          <FiCreditCard />
                          Trạng thái ví
                        </p>
                        <p className="mt-1 font-black">{ownershipLabel}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-bold text-white/55">
                      <span>Hạn dùng</span>
                      <span>
                        {formatDate(voucher.startDate)} - {formatDate(voucher.endDate)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleCopyVoucherCode(voucher.voucherCode)}
                      className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-xs font-black uppercase text-white transition hover:bg-white/10"
                    >
                      <FiCopy />
                      Sao chép mã
                    </button>

                    {source === 'PUBLIC' ? (
                      <button
                        type="button"
                        disabled={!available || isClaiming}
                        onClick={() => void handleClaimVoucher(voucher)}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#FFD166] to-[#FFEBA4] px-4 text-sm font-black uppercase text-[#111827] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <FiShoppingBag />
                        {isClaiming ? 'Đang nhận...' : 'Nhận vào ví'}
                      </button>
                    ) : (
                      <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-center text-xs font-black text-emerald-200">
                        Đã nằm trong ví ưu đãi của bạn
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
