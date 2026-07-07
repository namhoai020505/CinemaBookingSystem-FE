import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  FaChartPie,
  FaCoins,
  FaFilter,
  FaMoneyBillWave,
  FaReceipt,
  FaSyncAlt,
  FaTicketAlt,
  FaUtensils,
} from 'react-icons/fa';
import { useOutletContext } from 'react-router-dom';
import type { AdminOutletContext } from '../../layouts/admin/AdminLayout';
import {
  dashboardService,
  type DashboardFilter,
  type DashboardOverview,
  type MovieRankingItem,
  type OccupancyAndFbBreakdown,
  type SalesChannelBreakdown,
} from '../../services/dashboardService';
import { showtimeService, type CinemaResponse } from '../../services/showtimeService';

const emptyOverview: DashboardOverview = {
  grossRevenue: 0,
  totalRefunds: 0,
  netRevenue: 0,
  averageOrderValue: 0,
  totalTicketsSold: 0,
  totalSuccessfulBookings: 0,
};

const emptyOccupancyAndFb: OccupancyAndFbBreakdown = {
  occupancyRate: 0,
  totalSoldSeats: 0,
  totalAvailableSeatsCapacity: 0,
  ticketRevenue: 0,
  fbRevenue: 0,
  fbRevenuePercentage: 0,
  fbItems: [],
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatNumber = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(value || 0);

const formatPercent = (value: number) =>
  `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value || 0)}%`;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return error instanceof Error ? error.message : fallback;
};

const getFilterSummary = (filter: DashboardFilter, cinemas: CinemaResponse[]) => {
  const cinema = cinemas.find((item) => item.cinemaId === filter.cinemaId);
  const range =
    filter.fromDate && filter.toDate
      ? `Từ ${filter.fromDate} đến ${filter.toDate}`
      : filter.fromDate
        ? `Từ ${filter.fromDate} đến hiện tại`
        : filter.toDate
          ? `Đến ${filter.toDate}`
          : 'Toàn bộ thời gian';

  return `${cinema?.cinemaName || 'Tất cả chi nhánh'} | ${range}`;
};

type RevenueBar = {
  label: string;
  value: number;
  colorClass: string;
};

const RevenueBarChart = ({
  bars,
  isLightMode,
}: {
  bars: RevenueBar[];
  isLightMode: boolean;
}) => {
  const maxValue = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <div className="grid min-h-[280px] grid-cols-4 items-end gap-3 pt-4">
      {bars.map((bar) => {
        const height = Math.max(8, Math.round((bar.value / maxValue) * 100));

        return (
          <div key={bar.label} className="flex h-full min-w-0 flex-col justify-end gap-3">
            <div className="flex min-h-[190px] items-end rounded-md border border-dashed border-white/10 px-2">
              <div
                className={`w-full rounded-t-md bg-gradient-to-t ${bar.colorClass} shadow-lg transition-all`}
                style={{ height: `${height}%` }}
                title={formatCurrency(bar.value)}
              />
            </div>
            <div className="min-h-[56px] text-center">
              <div className={`truncate text-[11px] font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {bar.label}
              </div>
              <div className={`mt-1 text-xs font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                {formatCurrency(bar.value)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const RevenuePieChart = ({
  ticketRevenue,
  fbRevenue,
  isLightMode,
}: {
  ticketRevenue: number;
  fbRevenue: number;
  isLightMode: boolean;
}) => {
  const total = ticketRevenue + fbRevenue;
  const ticketPercent = total > 0 ? (ticketRevenue / total) * 100 : 0;
  const fbPercent = total > 0 ? 100 - ticketPercent : 0;
  const background =
    total > 0
      ? `conic-gradient(#2563eb 0 ${ticketPercent}%, #f59e0b ${ticketPercent}% 100%)`
      : isLightMode
        ? '#e2e8f0'
        : '#1e293b';

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="grid h-52 w-52 place-items-center rounded-full shadow-xl"
        style={{ background }}
      >
        <div className={`grid h-28 w-28 place-items-center rounded-full text-center ${isLightMode ? 'bg-white' : 'bg-[#0A0A0C]'}`}>
          <div>
            <div className={`text-[10px] font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Tổng
            </div>
            <div className={`text-sm font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
              {formatCurrency(total)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid w-full gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-bold">
            <span className="h-3 w-3 rounded-full bg-blue-600" />
            Vé đã bán
          </span>
          <span className="text-sm font-black">{formatPercent(ticketPercent)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-bold">
            <span className="h-3 w-3 rounded-full bg-amber-500" />
            F&B đã bán
          </span>
          <span className="text-sm font-black">{formatPercent(fbPercent)}</span>
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { isLightMode } = useOutletContext<AdminOutletContext>();
  const [draftFilter, setDraftFilter] = useState<DashboardFilter>({});
  const [appliedFilter, setAppliedFilter] = useState<DashboardFilter>({});
  const [cinemas, setCinemas] = useState<CinemaResponse[]>([]);
  const [overview, setOverview] = useState<DashboardOverview>(emptyOverview);
  const [movieRanking, setMovieRanking] = useState<MovieRankingItem[]>([]);
  const [occupancyAndFb, setOccupancyAndFb] =
    useState<OccupancyAndFbBreakdown>(emptyOccupancyAndFb);
  const [salesChannels, setSalesChannels] = useState<SalesChannelBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const cardClass = [
    'rounded-lg border shadow-xl transition-colors',
    isLightMode
      ? 'border-slate-200 bg-white shadow-slate-200/70'
      : 'border-white/10 bg-[#111C44] shadow-black/20',
  ].join(' ');
  const softPanelClass = isLightMode
    ? 'border-slate-200 bg-slate-50'
    : 'border-white/10 bg-white/[0.03]';
  const mutedClass = isLightMode ? 'text-slate-500' : 'text-slate-400';
  const headingClass = isLightMode ? 'text-slate-950' : 'text-white';
  const rowBorderClass = isLightMode ? 'border-slate-200' : 'border-white/10';

  useEffect(() => {
    let isMounted = true;

    const fetchCinemas = async () => {
      try {
        const data = await showtimeService.getCinemas();
        if (isMounted) {
          setCinemas(data);
        }
      } catch (error) {
        console.warn('Không tải được danh sách chi nhánh', error);
      }
    };

    void fetchCinemas();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setErrorMessage('');

        const [overviewData, rankingData, occupancyData, channelData] =
          await Promise.all([
            dashboardService.getOverview(appliedFilter),
            dashboardService.getMovieRanking(appliedFilter),
            dashboardService.getOccupancyAndFb(appliedFilter),
            dashboardService.getSalesChannels(appliedFilter),
          ]);

        if (!isMounted) {
          return;
        }

        setOverview(overviewData ?? emptyOverview);
        setMovieRanking(rankingData ?? []);
        setOccupancyAndFb({
          ...emptyOccupancyAndFb,
          ...(occupancyData ?? {}),
          fbItems: occupancyData?.fbItems ?? [],
        });
        setSalesChannels(channelData ?? []);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            getErrorMessage(error, 'Không tải được dữ liệu thống kê doanh thu.'),
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchDashboard();

    return () => {
      isMounted = false;
    };
  }, [appliedFilter]);

  const revenueBars = useMemo<RevenueBar[]>(
    () => [
      {
        label: 'Tổng doanh thu',
        value: overview.grossRevenue,
        colorClass: 'from-blue-600 to-cyan-400',
      },
      {
        label: 'Doanh thu thuần',
        value: overview.netRevenue,
        colorClass: 'from-emerald-600 to-teal-400',
      },
      {
        label: 'Doanh thu vé',
        value: occupancyAndFb.ticketRevenue,
        colorClass: 'from-indigo-600 to-blue-400',
      },
      {
        label: 'Doanh thu F&B',
        value: occupancyAndFb.fbRevenue,
        colorClass: 'from-amber-500 to-orange-400',
      },
    ],
    [occupancyAndFb.fbRevenue, occupancyAndFb.ticketRevenue, overview.grossRevenue, overview.netRevenue],
  );

  const maxTicketsSold = Math.max(
    ...movieRanking.map((item) => item.ticketsSold),
    1,
  );
  const maxFbQuantity = Math.max(
    ...occupancyAndFb.fbItems.map((item) => item.quantitySold),
    1,
  );

  const handleSubmitFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedFilter({
      fromDate: draftFilter.fromDate || undefined,
      toDate: draftFilter.toDate || undefined,
      cinemaId: draftFilter.cinemaId || undefined,
    });
  };

  const handleResetFilter = () => {
    setDraftFilter({});
    setAppliedFilter({});
  };

  return (
    <div
      className={[
        'min-h-screen p-6 transition-colors',
        isLightMode ? 'bg-slate-100 text-slate-950' : 'bg-[#0A0A0C] text-white',
      ].join(' ')}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-500">
              Phân tích doanh thu
            </div>
            <h1 className={`mt-2 text-3xl font-black leading-tight lg:text-4xl ${headingClass}`}>
              Thống kê doanh thu
            </h1>
            <p className={`mt-3 max-w-3xl text-sm leading-6 ${mutedClass}`}>
              {getFilterSummary(appliedFilter, cinemas)}
            </p>
          </div>

          <form
            onSubmit={handleSubmitFilter}
            className={`grid gap-3 rounded-lg border p-3 shadow-sm md:grid-cols-[160px_160px_220px_auto_auto] ${softPanelClass}`}
          >
            <input
              type="date"
              value={draftFilter.fromDate || ''}
              onChange={(event) =>
                setDraftFilter((current) => ({
                  ...current,
                  fromDate: event.target.value,
                }))
              }
              className={`h-10 rounded-md border px-3 text-sm font-bold outline-none transition focus:border-blue-500 ${
                isLightMode
                  ? 'border-slate-200 bg-white text-slate-950'
                  : 'border-white/10 bg-[#0F172A] text-white'
              }`}
              aria-label="Từ ngày"
            />
            <input
              type="date"
              value={draftFilter.toDate || ''}
              onChange={(event) =>
                setDraftFilter((current) => ({
                  ...current,
                  toDate: event.target.value,
                }))
              }
              className={`h-10 rounded-md border px-3 text-sm font-bold outline-none transition focus:border-blue-500 ${
                isLightMode
                  ? 'border-slate-200 bg-white text-slate-950'
                  : 'border-white/10 bg-[#0F172A] text-white'
              }`}
              aria-label="Đến ngày"
            />
            <select
              value={draftFilter.cinemaId || ''}
              onChange={(event) =>
                setDraftFilter((current) => ({
                  ...current,
                  cinemaId: event.target.value,
                }))
              }
              className={`h-10 rounded-md border px-3 text-sm font-bold outline-none transition focus:border-blue-500 ${
                isLightMode
                  ? 'border-slate-200 bg-white text-slate-950'
                  : 'border-white/10 bg-[#0F172A] text-white'
              }`}
              aria-label="Chi nhánh"
            >
              <option value="">Tất cả chi nhánh</option>
              {cinemas.map((cinema) => (
                <option key={cinema.cinemaId} value={cinema.cinemaId}>
                  {cinema.cinemaName}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-xs font-black uppercase text-white transition hover:bg-blue-500"
            >
              <FaFilter />
              Lọc
            </button>
            <button
              type="button"
              onClick={handleResetFilter}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-xs font-black uppercase transition ${
                isLightMode
                  ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
              }`}
            >
              Xóa
            </button>
          </form>
        </div>

        {errorMessage ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'Tổng doanh thu',
              value: formatCurrency(overview.grossRevenue),
              meta: `${formatNumber(overview.totalSuccessfulBookings)} lượt đặt vé thành công`,
              icon: <FaMoneyBillWave />,
              color: 'from-blue-600 to-cyan-500',
            },
            {
              label: 'Doanh thu thuần',
              value: formatCurrency(overview.netRevenue),
              meta: `Hoàn tiền ${formatCurrency(overview.totalRefunds)}`,
              icon: <FaCoins />,
              color: 'from-emerald-600 to-teal-500',
            },
            {
              label: 'Vé đã bán',
              value: formatNumber(overview.totalTicketsSold),
              meta: `Lấp đầy ${formatPercent(occupancyAndFb.occupancyRate)}`,
              icon: <FaTicketAlt />,
              color: 'from-violet-600 to-blue-600',
            },
            {
              label: 'Giá trị đơn trung bình',
              value: formatCurrency(overview.averageOrderValue),
              meta: 'Tính theo lượt đặt vé thành công',
              icon: <FaReceipt />,
              color: 'from-amber-500 to-orange-500',
            },
          ].map((item) => (
            <article className={`${cardClass} p-5`} key={item.label}>
              <div className="flex items-center justify-between gap-3">
                <div className={`text-[11px] font-black uppercase tracking-[0.12em] ${mutedClass}`}>
                  {item.label}
                </div>
                <div className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br ${item.color} text-white shadow-lg`}>
                  {item.icon}
                </div>
              </div>
              <div className={`mt-5 text-2xl font-black ${headingClass}`}>{item.value}</div>
              <div className={`mt-2 text-xs font-bold ${mutedClass}`}>{item.meta}</div>
            </article>
          ))}
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <section className={`${cardClass} p-5`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className={`text-base font-black ${headingClass}`}>Tổng số tiền</div>
                <div className={`mt-1 text-xs font-semibold ${mutedClass}`}>
                  Tổng doanh thu, doanh thu thuần, doanh thu vé và F&B theo bộ lọc hiện tại.
                </div>
              </div>
              {loading ? <FaSyncAlt className="animate-spin text-blue-500" /> : <FaMoneyBillWave className="text-blue-500" />}
            </div>
            <RevenueBarChart bars={revenueBars} isLightMode={isLightMode} />
          </section>

          <section className={`${cardClass} p-5`}>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className={`text-base font-black ${headingClass}`}>Tỷ trọng doanh thu</div>
                <div className={`mt-1 text-xs font-semibold ${mutedClass}`}>
                  So sánh doanh thu vé đã bán và F&B đã bán.
                </div>
              </div>
              <FaChartPie className="text-amber-500" />
            </div>
            <RevenuePieChart
              ticketRevenue={occupancyAndFb.ticketRevenue}
              fbRevenue={occupancyAndFb.fbRevenue}
              isLightMode={isLightMode}
            />
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className={cardClass}>
            <div className={`flex items-center justify-between gap-4 border-b p-5 ${rowBorderClass}`}>
              <div>
                <div className={`text-base font-black ${headingClass}`}>Xếp hạng phim</div>
                <div className={`mt-1 text-xs font-semibold ${mutedClass}`}>
                  Sắp xếp giảm dần theo số vé đã bán.
                </div>
              </div>
              <FaTicketAlt className="text-blue-500" />
            </div>

            <div className="grid gap-4 p-5">
              {movieRanking.length === 0 ? (
                <div className={`rounded-lg border p-5 text-center text-sm font-bold ${softPanelClass} ${mutedClass}`}>
                  Chưa có dữ liệu phim trong bộ lọc này.
                </div>
              ) : (
                movieRanking.map((movie, index) => {
                  const width = Math.max(8, (movie.ticketsSold / maxTicketsSold) * 100);

                  return (
                    <div key={movie.movieId || movie.movieTitle} className="grid gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className={`truncate text-sm font-black ${headingClass}`}>
                            #{index + 1} {movie.movieTitle}
                          </div>
                          <div className={`mt-1 text-xs font-semibold ${mutedClass}`}>
                            {formatCurrency(movie.ticketRevenue)}
                          </div>
                        </div>
                        <div className="text-right text-sm font-black text-blue-500">
                          {formatNumber(movie.ticketsSold)} vé
                        </div>
                      </div>
                      <div className={`h-3 overflow-hidden rounded-full ${isLightMode ? 'bg-slate-200' : 'bg-white/10'}`}>
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className={cardClass}>
            <div className={`flex items-center justify-between gap-4 border-b p-5 ${rowBorderClass}`}>
              <div>
                <div className={`text-base font-black ${headingClass}`}>F&B đã bán</div>
                <div className={`mt-1 text-xs font-semibold ${mutedClass}`}>
                  Tổng hợp số lượng đã bán theo từng món F&B.
                </div>
              </div>
              <FaUtensils className="text-amber-500" />
            </div>

            <div className="grid gap-4 p-5">
              <div className={`grid gap-3 rounded-lg border p-4 sm:grid-cols-3 ${softPanelClass}`}>
                <div>
                  <div className={`text-[10px] font-black uppercase ${mutedClass}`}>Doanh thu F&B</div>
                  <div className={`mt-1 text-lg font-black ${headingClass}`}>
                    {formatCurrency(occupancyAndFb.fbRevenue)}
                  </div>
                  <div className={`mt-1 text-[11px] font-semibold ${mutedClass}`}>
                    Tổng tiền F&B đã bán
                  </div>
                </div>
                <div>
                  <div className={`text-[10px] font-black uppercase ${mutedClass}`}>Ghế đã bán</div>
                  <div className={`mt-1 text-lg font-black ${headingClass}`}>
                    {formatNumber(occupancyAndFb.totalSoldSeats)}
                  </div>
                  <div className={`mt-1 text-[11px] font-semibold ${mutedClass}`}>
                    Số ghế đã thanh toán
                  </div>
                </div>
                <div>
                  <div className={`text-[10px] font-black uppercase ${mutedClass}`}>Sức chứa ghế</div>
                  <div className={`mt-1 text-lg font-black ${headingClass}`}>
                    {formatNumber(occupancyAndFb.totalAvailableSeatsCapacity)}
                  </div>
                  <div className={`mt-1 text-[11px] font-semibold ${mutedClass}`}>
                    Tổng ghế theo suất chiếu
                  </div>
                </div>
              </div>

              {occupancyAndFb.fbItems.length === 0 ? (
                <div className={`rounded-lg border p-5 text-center text-sm font-bold ${softPanelClass} ${mutedClass}`}>
                  Chưa có F&B nào được bán trong bộ lọc này.
                </div>
              ) : (
                occupancyAndFb.fbItems.map((item) => {
                  const width = Math.max(8, (item.quantitySold / maxFbQuantity) * 100);

                  return (
                    <div key={item.fbItemId || item.itemName} className="grid gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className={`truncate text-sm font-black ${headingClass}`}>
                            {item.itemName}
                          </div>
                          <div className={`mt-1 text-xs font-semibold ${mutedClass}`}>
                            {formatCurrency(item.revenue)}
                          </div>
                        </div>
                        <div className="text-right text-sm font-black text-amber-500">
                          {formatNumber(item.quantitySold)}
                        </div>
                      </div>
                      <div className={`h-3 overflow-hidden rounded-full ${isLightMode ? 'bg-slate-200' : 'bg-white/10'}`}>
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <section className={cardClass}>
          <div className={`flex items-center justify-between gap-4 border-b p-5 ${rowBorderClass}`}>
            <div>
              <div className={`text-base font-black ${headingClass}`}>F&B theo kênh bán</div>
              <div className={`mt-1 text-xs font-semibold ${mutedClass}`}>
                Tổng hợp F&B đã bán online và offline theo kênh đặt vé.
              </div>
            </div>
            <FaReceipt className="text-emerald-500" />
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2">
            {salesChannels.length === 0 ? (
              <div className={`rounded-lg border p-5 text-center text-sm font-bold md:col-span-2 ${softPanelClass} ${mutedClass}`}>
                Chưa có doanh thu F&B theo kênh bán trong bộ lọc này.
              </div>
            ) : (
              salesChannels.map((channel) => (
                <article
                  key={channel.channel}
                  className={`rounded-lg border p-4 ${softPanelClass}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className={`text-sm font-black ${headingClass}`}>
                        {channel.channelLabel || channel.channel}
                      </div>
                      <div className={`mt-1 text-xs font-semibold ${mutedClass}`}>
                        {formatNumber(channel.bookingCount)} lượt đặt có F&B
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-emerald-500">
                        {formatPercent(channel.percentage)}
                      </div>
                      <div className={`mt-1 text-xs font-bold ${mutedClass}`}>
                        {formatCurrency(channel.totalRevenue)}
                      </div>
                    </div>
                  </div>
                  <div className={`mt-4 h-3 overflow-hidden rounded-full ${isLightMode ? 'bg-slate-200' : 'bg-white/10'}`}>
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-400"
                      style={{ width: `${Math.max(4, channel.percentage)}%` }}
                    />
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
