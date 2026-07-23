import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
  FiClock,
  FiCopy,
  FiCreditCard,
  FiGift,
  FiRefreshCw,
  FiShoppingBag,
  FiTag,
} from 'react-icons/fi';
import {
  VOUCHER_WALLET_UPDATED_EVENT,
  isPublicVoucher,
  isVoucherCurrentlyAvailable,
  voucherService,
  type Voucher,
} from '../../services/voucherService';

type VoucherCardMode = 'wallet' | 'public';

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

const getVoucherStatusLabel = (voucher: Voucher) => {
  const now = Date.now();
  const startTime = new Date(voucher.startDate).getTime();
  const endTime = new Date(voucher.endDate).getTime();
  const usedCount = voucher.usedCount ?? 0;

  if (voucher.voucherStatus !== 'ACTIVE') {
    return 'Tạm ngưng';
  }

  if (!Number.isNaN(startTime) && startTime > now) {
    return 'Sắp mở';
  }

  if (!Number.isNaN(endTime) && endTime < now) {
    return 'Hết hạn';
  }

  if (usedCount >= voucher.usageLimit) {
    return 'Hết lượt';
  }

  return 'Có thể dùng';
};

const getPublicVouchers = (vouchers: Voucher[], walletVoucherIds: Set<string>) =>
  vouchers.filter(
    (voucher) =>
      isPublicVoucher(voucher) &&
      isVoucherCurrentlyAvailable(voucher) &&
      !walletVoucherIds.has(voucher.voucherId),
  );

export default function MyVouchers() {
  const [walletVouchers, setWalletVouchers] = useState<Voucher[]>([]);
  const [publicVouchers, setPublicVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingVoucherId, setClaimingVoucherId] = useState('');

  const fetchVouchers = useCallback(async () => {
    try {
      setLoading(true);

      const [walletResult, activeResult] = await Promise.allSettled([
        voucherService.getMyVouchers(),
        voucherService.getActiveVouchers(),
      ]);

      if (walletResult.status === 'rejected') {
        throw walletResult.reason;
      }

      const walletData = walletResult.value.data || [];
      const walletVoucherIds = new Set(
        walletData.map((voucher) => voucher.voucherId),
      );
      const activeData =
        activeResult.status === 'fulfilled' ? activeResult.value.data || [] : [];
      const publicData = getPublicVouchers(activeData, walletVoucherIds);

      setWalletVouchers(walletData);
      setPublicVouchers(publicData);
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

  useEffect(() => {
    const handleWalletUpdated = () => {
      void fetchVouchers();
    };

    window.addEventListener(VOUCHER_WALLET_UPDATED_EVENT, handleWalletUpdated);

    return () => {
      window.removeEventListener(VOUCHER_WALLET_UPDATED_EVENT, handleWalletUpdated);
    };
  }, [fetchVouchers]);

  const handleClaimVoucher = async (voucher: Voucher) => {
    try {
      setClaimingVoucherId(voucher.voucherId);
      const response = await voucherService.claimVoucher(voucher.voucherId);

      if (!response.success) {
        throw new Error(response.message || 'Không thể nhận voucher này.');
      }

      toast.success(`Đã thêm voucher ${voucher.voucherCode} vào ví ưu đãi.`);
      window.dispatchEvent(new Event(VOUCHER_WALLET_UPDATED_EVENT));
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

  const renderVoucherCard = (voucher: Voucher, mode: VoucherCardMode) => {
    const available = isVoucherCurrentlyAvailable(voucher);
    const isClaimable = mode === 'public';
    const isClaiming = claimingVoucherId === voucher.voucherId;
    const statusLabel = getVoucherStatusLabel(voucher);
    const remainingUses = Math.max(voucher.usageLimit - (voucher.usedCount ?? 0), 0);

    return (
      <article
        key={`${mode}-${voucher.voucherId}`}
        className={`overflow-hidden rounded-xl border bg-[#0F172A] shadow-xl shadow-black/20 ${
          available ? 'border-white/10' : 'border-red-400/20 opacity-70'
        }`}
      >
        <div className="border-b border-white/10 p-5">
          <p className="font-mono text-sm font-black text-[#FFD166]">
            {voucher.voucherCode}
          </p>
          <h2 className="mt-2 line-clamp-2 text-lg font-black">
            {voucher.title || 'Ưu đãi G2Cinema'}
          </h2>

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
              <p className="mt-1 font-black">{remainingUses} lượt</p>
            </div>
          </div>

          <div className="rounded-lg bg-white/5 p-3 text-sm">
            <p className="inline-flex items-center gap-1 text-xs font-bold text-white/45">
              <FiCreditCard />
              Trạng thái ví
            </p>
            <p className="mt-1 font-black">
              {isClaimable ? 'Sẵn sàng nhận' : 'Trong ví của tôi'}
            </p>
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

          {isClaimable ? (
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
  };

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
              Chỉ những voucher bạn đã nhận thành công mới nằm trong ví. Các voucher mới đang mở sẽ hiển thị ở mục Voucher mới.
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

        {loading ? (
          <div className="mt-8 rounded-lg border border-white/10 bg-[#0F172A] px-4 py-16 text-center text-sm font-bold text-white/60">
            Đang tải ví ưu đãi...
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            <section>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black uppercase">
                    Ví voucher của tôi
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-white/55">
                    {walletVouchers.length} voucher đã lưu
                  </p>
                </div>
              </div>

              {walletVouchers.length === 0 ? (
                <div className="mt-4 rounded-lg border border-white/10 bg-[#0F172A] px-4 py-14 text-center">
                  <FiGift className="mx-auto text-4xl text-white/35" />
                  <p className="mt-4 text-lg font-black">Chưa có voucher trong ví</p>
                  <p className="mt-2 text-sm font-semibold text-white/55">
                    Khi bạn nhận voucher thành công, voucher sẽ xuất hiện tại đây.
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {walletVouchers.map((voucher) => renderVoucherCard(voucher, 'wallet'))}
                </div>
              )}
            </section>

            <section>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black uppercase">
                    Voucher mới
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-white/55">
                    {publicVouchers.length} voucher mới đang mở
                  </p>
                </div>
              </div>

              {publicVouchers.length === 0 ? (
                <div className="mt-4 rounded-lg border border-white/10 bg-[#0F172A] px-4 py-10 text-center">
                  <FiShoppingBag className="mx-auto text-3xl text-white/35" />
                  <p className="mt-3 text-sm font-black">Không có voucher mới</p>
                  <p className="mt-1 text-xs font-semibold text-white/50">
                    Khi hệ thống mở voucher mới, bạn có thể nhận tại đây.
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {publicVouchers.map((voucher) => renderVoucherCard(voucher, 'public'))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
