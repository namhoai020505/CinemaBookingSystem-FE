import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ManagerOutletContext } from '../../layouts/manager/ManagerLayout';
import { managerService, type CancelShowtimeResponse } from '../../services/managerService';
import type { RoomResponse } from '../../services/roomService';
import type { ShowtimeResponse } from '../../services/showtimeService';
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  getApiErrorMessage,
  inputClass,
  PageShell,
  panelClass,
  StatePanel,
  StatusBadge,
  toDateInputValue,
} from './managerUi';

const statusOptions = ['ALL', 'OPEN', 'CANCELLED', 'COMPLETED', 'PROCESSING_UNSTABLE', 'SUSPENDED'];
const timingOptions = ['ALL', 'UPCOMING', 'PAST'];

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getRangeFromPreset = (preset: string) => {
  const today = new Date();

  if (preset === 'today') {
    const value = toDateInputValue(today);
    return { fromDate: value, toDate: value };
  }

  if (preset === '7d') {
    return {
      fromDate: toDateInputValue(today),
      toDate: toDateInputValue(addDays(today, 6)),
    };
  }

  if (preset === '30d') {
    return {
      fromDate: toDateInputValue(today),
      toDate: toDateInputValue(addDays(today, 29)),
    };
  }

  if (preset === 'month') {
    return {
      fromDate: toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)),
      toDate: toDateInputValue(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    };
  }

  return { fromDate: '', toDate: '' };
};

const canCancelShowtime = (showtime: ShowtimeResponse, nowMs: number) => {
  const status = showtime.status?.toUpperCase();
  return status !== 'CANCELLED'
    && status !== 'COMPLETED'
    && new Date(showtime.startTime).getTime() > nowMs;
};

const SummaryCard = ({
  label,
  value,
  meta,
  isLightMode,
}: {
  label: string;
  value: string;
  meta: string;
  isLightMode: boolean;
}) => (
  <article className={`${panelClass(isLightMode)} p-4`}>
    <p className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
      {label}
    </p>
    <p className={`mt-3 text-2xl font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
      {value}
    </p>
    <p className={`mt-1 text-sm font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
      {meta}
    </p>
  </article>
);

const ManagerShowtimesPage = () => {
  const { isLightMode } = useOutletContext<ManagerOutletContext>();
  const [showtimes, setShowtimes] = useState<ShowtimeResponse[]>([]);
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [rangePreset, setRangePreset] = useState('7d');
  const [fromDate, setFromDate] = useState(() => getRangeFromPreset('7d').fromDate);
  const [toDate, setToDate] = useState(() => getRangeFromPreset('7d').toDate);
  const [movieQuery, setMovieQuery] = useState('');
  const [roomId, setRoomId] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [timing, setTiming] = useState('ALL');
  const [sortMode, setSortMode] = useState('START_ASC');
  const [cancelTarget, setCancelTarget] = useState<ShowtimeResponse | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [compensationVoucher, setCompensationVoucher] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelResult, setCancelResult] = useState<CancelShowtimeResponse | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const [roomData, showtimeData] = await Promise.all([
        managerService.getRooms(),
        managerService.getShowtimes(),
      ]);
      setRooms(roomData ?? []);
      setShowtimes(showtimeData ?? []);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không tải được danh sách suất chiếu.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        const [roomData, showtimeData] = await Promise.all([
          managerService.getRooms(),
          managerService.getShowtimes(),
        ]);

        if (!isMounted) {
          return;
        }

        setRooms(roomData ?? []);
        setShowtimes(showtimeData ?? []);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getApiErrorMessage(error, 'Không tải được danh sách suất chiếu.'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const scopedRoomIds = useMemo(() => new Set(rooms.map((room) => room.roomId)), [rooms]);

  const filteredShowtimes = useMemo(() => {
    const normalizedMovieQuery = movieQuery.trim().toLowerCase();
    const startBoundary = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const endBoundary = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

    return showtimes
      .filter((showtime) => scopedRoomIds.size === 0 || scopedRoomIds.has(showtime.roomId))
      .filter((showtime) => {
        const startTime = new Date(showtime.startTime).getTime();

        if (startBoundary !== null && startTime < startBoundary) {
          return false;
        }

        if (endBoundary !== null && startTime > endBoundary) {
          return false;
        }

        if (timing === 'UPCOMING' && startTime <= nowMs) {
          return false;
        }

        if (timing === 'PAST' && startTime > nowMs) {
          return false;
        }

        if (roomId !== 'ALL' && showtime.roomId !== roomId) {
          return false;
        }

        if (status !== 'ALL' && showtime.status?.toUpperCase() !== status) {
          return false;
        }

        if (normalizedMovieQuery && !showtime.movieTitle.toLowerCase().includes(normalizedMovieQuery)) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        const leftTime = new Date(left.startTime).getTime();
        const rightTime = new Date(right.startTime).getTime();
        return sortMode === 'START_DESC' ? rightTime - leftTime : leftTime - rightTime;
      });
  }, [fromDate, movieQuery, nowMs, roomId, scopedRoomIds, showtimes, sortMode, status, timing, toDate]);

  const summary = useMemo(() => {
    const upcoming = filteredShowtimes.filter((item) => new Date(item.startTime).getTime() > nowMs).length;
    const cancelled = filteredShowtimes.filter((item) => item.status?.toUpperCase() === 'CANCELLED').length;
    const cancellable = filteredShowtimes.filter((item) => canCancelShowtime(item, nowMs)).length;

    return {
      total: filteredShowtimes.length,
      upcoming,
      cancelled,
      cancellable,
    };
  }, [filteredShowtimes, nowMs]);

  const handlePresetChange = (value: string) => {
    setRangePreset(value);
    const range = getRangeFromPreset(value);
    setFromDate(range.fromDate);
    setToDate(range.toDate);

    if (value === 'all') {
      setTiming('ALL');
    }
  };

  const handleManualDateChange = (setter: (value: string) => void, value: string) => {
    setRangePreset('custom');
    setter(value);
  };

  const resetFilters = () => {
    const range = getRangeFromPreset('7d');
    setRangePreset('7d');
    setFromDate(range.fromDate);
    setToDate(range.toDate);
    setMovieQuery('');
    setRoomId('ALL');
    setStatus('ALL');
    setTiming('ALL');
    setSortMode('START_ASC');
  };

  const openCancelModal = (showtime: ShowtimeResponse) => {
    setCancelTarget(showtime);
    setCancelReason('');
    setCancelError('');
    setCancelResult(null);
  };

  const closeCancelModal = () => {
    if (cancelLoading) {
      return;
    }

    setCancelTarget(null);
    setCancelReason('');
    setCompensationVoucher('');
    setCancelError('');
    setCancelResult(null);
  };

  const handleCancelShowtime = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cancelTarget) {
      return;
    }

    if (!cancelReason.trim()) {
      setCancelError('Vui lòng nhập lý do hủy suất chiếu.');
      return;
    }

    try {
      setCancelLoading(true);
      setCancelError('');
      const result = await managerService.cancelShowtime(cancelTarget.showtimeId, cancelReason.trim());
      setCancelResult(result);
      await loadData();
    } catch (error) {
      setCancelError(getApiErrorMessage(error, 'Không hủy được suất chiếu.'));
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <PageShell
      eyebrow="Showtime operations"
      title="Quản lý suất chiếu"
      description="Manager chỉ theo dõi suất chiếu thuộc rạp của mình và hủy suất chiếu khi cần sinh dữ liệu refund. Các thao tác sửa lịch, sửa phòng hoặc sửa ghế vẫn thuộc luồng Admin."
      isLightMode={isLightMode}
      action={<StatusBadge status={`${formatNumber(summary.total)} suất`} />}
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Trong bộ lọc"
          value={formatNumber(summary.total)}
          meta="Tổng suất chiếu đang hiển thị"
          isLightMode={isLightMode}
        />
        <SummaryCard
          label="Sắp chiếu"
          value={formatNumber(summary.upcoming)}
          meta="Suất chiếu sau thời điểm hiện tại"
          isLightMode={isLightMode}
        />
        <SummaryCard
          label="Có thể hủy"
          value={formatNumber(summary.cancellable)}
          meta="Chưa bắt đầu và chưa hoàn tất/hủy"
          isLightMode={isLightMode}
        />
        <SummaryCard
          label="Đã hủy"
          value={formatNumber(summary.cancelled)}
          meta="Suất đã chuyển trạng thái CANCELLED"
          isLightMode={isLightMode}
        />
      </section>

      <section className={`${panelClass(isLightMode)} p-4`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
          <label className="grid min-w-0 gap-2">
          <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Khoảng nhanh</span>
          <select
            value={rangePreset}
            onChange={(event) => handlePresetChange(event.target.value)}
            className={inputClass(isLightMode)}
          >
            <option value="all">Tất cả</option>
            <option value="today">Hôm nay</option>
            <option value="7d">7 ngày tới</option>
            <option value="30d">30 ngày tới</option>
            <option value="month">Tháng này</option>
            <option value="custom">Tùy chỉnh</option>
          </select>
        </label>

        <label className="grid min-w-0 gap-2">
          <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Từ ngày</span>
          <input
            type="date"
            value={fromDate}
            onChange={(event) => handleManualDateChange(setFromDate, event.target.value)}
            className={inputClass(isLightMode)}
          />
        </label>

        <label className="grid min-w-0 gap-2">
          <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Đến ngày</span>
          <input
            type="date"
            value={toDate}
            onChange={(event) => handleManualDateChange(setToDate, event.target.value)}
            className={inputClass(isLightMode)}
          />
        </label>

        <label className="grid min-w-0 gap-2">
          <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Phim</span>
          <input
            value={movieQuery}
            onChange={(event) => setMovieQuery(event.target.value)}
            placeholder="Tìm theo tên phim"
            className={inputClass(isLightMode)}
          />
        </label>

        <label className="grid min-w-0 gap-2">
          <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Phòng</span>
          <select value={roomId} onChange={(event) => setRoomId(event.target.value)} className={inputClass(isLightMode)}>
            <option value="ALL">Tất cả phòng</option>
            {rooms.map((room) => (
              <option key={room.roomId} value={room.roomId}>
                {room.roomName}
              </option>
            ))}
          </select>
        </label>

        <label className="grid min-w-0 gap-2">
          <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Trạng thái</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass(isLightMode)}>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'ALL' ? 'Tất cả' : option}
              </option>
            ))}
          </select>
        </label>

        <label className="grid min-w-0 gap-2">
          <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Thời gian</span>
          <select value={timing} onChange={(event) => setTiming(event.target.value)} className={inputClass(isLightMode)}>
            {timingOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'ALL' ? 'Tất cả' : option === 'UPCOMING' ? 'Sắp chiếu' : 'Đã qua giờ'}
              </option>
            ))}
          </select>
        </label>

        <label className="grid min-w-0 gap-2">
          <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Sắp xếp</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value)} className={inputClass(isLightMode)}>
            <option value="START_ASC">Gần nhất trước</option>
            <option value="START_DESC">Xa nhất trước</option>
          </select>
        </label>

        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
          type="button"
          onClick={() => void loadData()}
          className="inline-flex h-11 w-full items-center justify-center whitespace-nowrap rounded-lg bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-500 sm:w-auto"
        >
          Làm mới
        </button>

          <button
          type="button"
          onClick={resetFilters}
          className={`inline-flex h-11 w-full items-center justify-center whitespace-nowrap rounded-lg border px-4 text-sm font-black transition sm:w-auto ${
            isLightMode
              ? 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-700'
              : 'border-white/10 bg-white/5 text-white hover:border-emerald-400/40'
          }`}
        >
          Đặt lại
          </button>
        </div>
      </section>

      {loading ? (
        <StatePanel type="loading" title="Đang tải suất chiếu" description="Đang lấy dữ liệu theo phạm vi rạp của bạn." isLightMode={isLightMode} />
      ) : errorMessage ? (
        <StatePanel type="error" title="Không tải được suất chiếu" description={errorMessage} isLightMode={isLightMode} />
      ) : filteredShowtimes.length === 0 ? (
        <StatePanel title="Không có suất chiếu phù hợp" description="Thử đổi khoảng ngày, phòng, phim, trạng thái hoặc bộ lọc thời gian để xem dữ liệu khác." isLightMode={isLightMode} />
      ) : (
        <section className={panelClass(isLightMode)}>
          <div className={`hidden border-b px-5 py-4 text-xs font-black uppercase ${isLightMode ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-400'} xl:grid xl:grid-cols-[minmax(220px,1.4fr)_minmax(120px,0.8fr)_minmax(150px,0.9fr)_minmax(110px,0.7fr)_minmax(130px,0.7fr)_minmax(120px,0.6fr)]`}>
            <span>Phim</span>
            <span>Phòng</span>
            <span>Thời gian</span>
            <span>Giá</span>
            <span>Trạng thái</span>
            <span className="text-right">Thao tác</span>
          </div>
          <div className={`divide-y ${isLightMode ? 'divide-slate-200' : 'divide-white/10'}`}>
            {filteredShowtimes.map((showtime) => (
              <article
                key={showtime.showtimeId}
                className={`grid gap-3 px-5 py-4 text-sm xl:grid-cols-[minmax(220px,1.4fr)_minmax(120px,0.8fr)_minmax(150px,0.9fr)_minmax(110px,0.7fr)_minmax(130px,0.7fr)_minmax(120px,0.6fr)] xl:items-center ${
                  isLightMode ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="min-w-0">
                  <p className={`truncate font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>{showtime.movieTitle}</p>
                  <p className={`mt-1 text-xs font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {formatNumber(showtime.showtimeSeatCount)} ghế theo suất
                  </p>
                </div>
                <div className="min-w-0">
                  <span className={`block text-xs font-black uppercase xl:hidden ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Phòng</span>
                  <span className="block truncate">{showtime.roomName}</span>
                </div>
                <div className="min-w-0">
                  <span className={`block text-xs font-black uppercase xl:hidden ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Thời gian</span>
                  <span className="block truncate">{formatDateTime(showtime.startTime)}</span>
                </div>
                <div>
                  <span className={`block text-xs font-black uppercase xl:hidden ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Giá</span>
                  <span className="block">{formatCurrency(showtime.basePrice)}</span>
                </div>
                <div>
                  <span className={`mb-1 block text-xs font-black uppercase xl:hidden ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Trạng thái</span>
                  <StatusBadge status={showtime.status} />
                </div>
                <div className="xl:text-right">
                  {canCancelShowtime(showtime, nowMs) ? (
                    <button
                      type="button"
                      onClick={() => openCancelModal(showtime)}
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 text-xs font-black text-rose-200 transition hover:bg-rose-500/20"
                    >
                      Hủy suất
                    </button>
                  ) : (
                    <span className={`text-xs font-bold ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>Không khả dụng</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {cancelTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <form
            onSubmit={handleCancelShowtime}
            className={`${panelClass(isLightMode)} w-full max-w-2xl overflow-hidden`}
          >
            <div className={`border-b p-5 ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
              <div className="flex items-start gap-3">
                <div>
                  <h2 className={`text-lg font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>Xác nhận hủy suất chiếu</h2>
                  <p className={`mt-1 text-sm leading-6 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Hủy suất có thể ảnh hưởng booking đã thanh toán và tạo dữ liệu refund.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-5">
              <div className={`rounded-lg border p-4 ${isLightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.03]'}`}>
                <p className={`font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>{cancelTarget.movieTitle}</p>
                <p className={`mt-2 text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {cancelTarget.roomName} - {formatDateTime(cancelTarget.startTime)}
                </p>
              </div>

              <label className="grid min-w-0 gap-2">
                <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Lý do hủy</span>
                <textarea
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  className={`${inputClass(isLightMode)} min-h-24 resize-y py-3`}
                  placeholder="Ví dụ: Sự cố phòng chiếu, bảo trì đột xuất..."
                />
              </label>

              <label className="grid min-w-0 gap-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Voucher bồi thường sự cố (Không bắt buộc)
                  </span>
                </div>
                <input
                  type="text"
                  value={compensationVoucher}
                  onChange={(event) => setCompensationVoucher(event.target.value)}
                  className={inputClass(isLightMode)}
                  placeholder="Nhập mã voucher đền bù tùy chỉnh (VD: COMP-100, VOUCHER-BOITHUONG-50K)..."
                />
                <p className={`text-[11px] ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Voucher bồi thường sẽ được phát hành tự động cho khách hàng đã mua vé khi hủy suất chiếu.
                </p>
              </label>

              {cancelError ? <p className="text-sm font-bold text-rose-300">{cancelError}</p> : null}

              {cancelResult ? (
                <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  <p className="font-black">Đã hủy suất thành công</p>
                  <p className="mt-2">
                    Refund tạo mới: {formatNumber(cancelResult.refundsCreated)} - Tổng tiền refund: {formatCurrency(cancelResult.totalRefundAmount)}
                  </p>
                  <p className="mt-1">
                    Booking sang refund pending: {formatNumber(cancelResult.paidBookingsMovedToRefundPending)} - Booking chưa thanh toán bị hủy: {formatNumber(cancelResult.unpaidBookingsCancelled)}
                  </p>
                </div>
              ) : null}
            </div>

            <div className={`flex justify-end gap-3 border-t p-5 ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
              <button
                type="button"
                onClick={closeCancelModal}
                className={`h-11 rounded-lg border px-4 text-sm font-black ${isLightMode ? 'border-slate-200 text-slate-700' : 'border-white/10 text-white'}`}
              >
                Đóng
              </button>
              {!cancelResult ? (
                <button
                  type="submit"
                  disabled={cancelLoading}
                  className="h-11 rounded-lg bg-rose-600 px-4 text-sm font-black text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancelLoading ? 'Đang hủy...' : 'Xác nhận hủy suất'}
                </button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </PageShell>
  );
};

export default ManagerShowtimesPage;
