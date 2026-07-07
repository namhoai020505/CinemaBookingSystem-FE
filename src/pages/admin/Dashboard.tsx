import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  FaBuilding,
  FaCalendarAlt,
  FaChartLine,
  FaChartPie,
  FaCoins,
  FaExclamationTriangle,
  FaFilter,
  FaFilm,
  FaMoneyBillWave,
  FaPercent,
  FaReceipt,
  FaRedoAlt,
  FaSyncAlt,
  FaTicketAlt,
  FaTrophy,
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

const formatCompactCurrency = (value: number) =>
  `${new Intl.NumberFormat('vi-VN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value || 0)} đ`;

const formatNumber = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(value || 0);

const formatPercent = (value: number) =>
  `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value || 0)}%`;

const formatDateLabel = (value?: string) => {
  if (!value) {
    return '';
  }

  const timestamp = Date.parse(`${value}T00:00:00`);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return error instanceof Error ? error.message : fallback;
};

const getRangeLabel = (filter: DashboardFilter) => {
  if (filter.fromDate && filter.toDate) {
    return `${formatDateLabel(filter.fromDate)} - ${formatDateLabel(filter.toDate)}`;
  }

  if (filter.fromDate) {
    return `Từ ${formatDateLabel(filter.fromDate)}`;
  }

  if (filter.toDate) {
    return `Đến ${formatDateLabel(filter.toDate)}`;
  }

  return 'Toàn bộ thời gian';
};

const getFilterSummary = (filter: DashboardFilter, cinemas: CinemaResponse[]) => {
  const cinema = cinemas.find((item) => item.cinemaId === filter.cinemaId);
  return `${cinema?.cinemaName || 'Tất cả chi nhánh'} - ${getRangeLabel(filter)}`;
};

const getActiveFilterCount = (filter: DashboardFilter) =>
  Number(Boolean(filter.fromDate)) +
  Number(Boolean(filter.toDate)) +
  Number(Boolean(filter.cinemaId));

const clampPercent = (value: number) => Math.min(100, Math.max(0, value || 0));

type RevenueBar = {
  label: string;
  value: number;
  colorClass: string;
  note: string;
};

type ThemeAwareProps = {
  isLightMode: boolean;
};

type PanelHeaderProps = ThemeAwareProps & {
  icon: ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
};

const PanelHeader = ({
  icon,
  eyebrow,
  title,
  description,
  action,
  isLightMode,
}: PanelHeaderProps) => (
  <div
    className={`flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-start sm:justify-between ${
      isLightMode ? 'border-slate-200' : 'border-white/10'
    }`}
  >
    <div className="min-w-0">
      {eyebrow ? (
        <p className={`mb-2 text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {eyebrow}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
            isLightMode ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-slate-200'
          }`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className={`truncate text-base font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
            {title}
          </h2>
          <p className={`mt-1 text-sm leading-6 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {description}
          </p>
        </div>
      </div>
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

type StatCardProps = ThemeAwareProps & {
  label: string;
  value: string;
  meta: string;
  icon: ReactNode;
  accentClass: string;
  loading: boolean;
};

const StatCard = ({
  label,
  value,
  meta,
  icon,
  accentClass,
  loading,
  isLightMode,
}: StatCardProps) => (
  <article
    className={`rounded-lg border p-5 shadow-xl transition ${
      isLightMode
        ? 'border-slate-200 bg-white shadow-slate-200/70'
        : 'border-white/10 bg-[#101826] shadow-black/20'
    }`}
  >
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {label}
        </p>
        {loading ? (
          <div className={`mt-5 h-8 w-32 animate-pulse rounded-md ${isLightMode ? 'bg-slate-200' : 'bg-white/10'}`} />
        ) : (
          <p className={`mt-4 text-2xl font-black leading-tight ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
            {value}
          </p>
        )}
      </div>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white shadow-lg ${accentClass}`}>
        {icon}
      </span>
    </div>
    <p className={`mt-3 min-h-5 text-sm font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
      {meta}
    </p>
  </article>
);

type MetricStripProps = ThemeAwareProps & {
  label: string;
  value: string;
  icon: ReactNode;
};

const MetricStrip = ({ label, value, icon, isLightMode }: MetricStripProps) => (
  <div className={`flex items-center gap-3 border-t py-4 ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${isLightMode ? 'bg-white text-slate-700' : 'bg-white/10 text-slate-200'}`}>
      {icon}
    </span>
    <div className="min-w-0">
      <p className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
        {label}
      </p>
      <p className={`mt-1 truncate text-sm font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
        {value}
      </p>
    </div>
  </div>
);

const RevenueBarChart = ({
  bars,
  isLightMode,
}: {
  bars: RevenueBar[];
  isLightMode: boolean;
}) => {
  const maxValue = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <div className="grid gap-5 p-5">
      {bars.map((bar) => {
        const width = bar.value > 0 ? Math.max(6, (bar.value / maxValue) * 100) : 0;

        return (
          <div key={bar.label} className="grid gap-2">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className={`text-sm font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                  {bar.label}
                </p>
                <p className={`text-xs font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {bar.note}
                </p>
              </div>
              <p className={`shrink-0 text-sm font-black ${isLightMode ? 'text-slate-700' : 'text-slate-200'}`}>
                {formatCurrency(bar.value)}
              </p>
            </div>
            <div
              className={`h-3 overflow-hidden rounded-full ${
                isLightMode ? 'bg-slate-200' : 'bg-white/10'
              }`}
              aria-label={`${bar.label}: ${formatCurrency(bar.value)}`}
              role="img"
            >
              <div
                className={`h-full rounded-full bg-gradient-to-r ${bar.colorClass} transition-all duration-300`}
                style={{ width: `${width}%` }}
              />
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
      ? `conic-gradient(#0891b2 0 ${ticketPercent}%, #f59e0b ${ticketPercent}% 100%)`
      : isLightMode
        ? '#e2e8f0'
        : '#1e293b';

  return (
    <div className="grid gap-6 p-5 md:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[190px_minmax(0,1fr)]">
      <div className="mx-auto grid h-44 w-44 place-items-center rounded-full shadow-xl" style={{ background }} role="img" aria-label={`Vé ${formatPercent(ticketPercent)}, F&B ${formatPercent(fbPercent)}`}>
        <div className={`grid h-24 w-24 place-items-center rounded-full text-center ${isLightMode ? 'bg-white' : 'bg-[#101826]'}`}>
          <div>
            <p className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Tổng
            </p>
            <p className={`mt-1 text-base font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
              {formatCompactCurrency(total)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid content-center gap-4">
        {[
          {
            label: 'Doanh thu vé',
            value: ticketRevenue,
            percent: ticketPercent,
            dotClass: 'bg-cyan-600',
          },
          {
            label: 'Doanh thu F&B',
            value: fbRevenue,
            percent: fbPercent,
            dotClass: 'bg-amber-500',
          },
        ].map((item) => (
          <div key={item.label} className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className={`flex min-w-0 items-center gap-2 text-sm font-bold ${isLightMode ? 'text-slate-700' : 'text-slate-200'}`}>
                <span className={`h-3 w-3 shrink-0 rounded-full ${item.dotClass}`} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className={`text-sm font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                {formatPercent(item.percent)}
              </span>
            </div>
            <p className={`text-xs font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {formatCurrency(item.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

type ProgressRowProps = ThemeAwareProps & {
  title: string;
  subtitle: string;
  value: string;
  progress: number;
  accentClass: string;
  leading?: ReactNode;
};

const ProgressRow = ({
  title,
  subtitle,
  value,
  progress,
  accentClass,
  leading,
  isLightMode,
}: ProgressRowProps) => {
  const width = progress > 0 ? Math.max(5, clampPercent(progress)) : 0;

  return (
    <div className={`grid gap-3 px-5 py-4 transition ${isLightMode ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {leading ? <div className="shrink-0">{leading}</div> : null}
          <div className="min-w-0">
            <p className={`truncate text-sm font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
              {title}
            </p>
            <p className={`mt-1 text-xs font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {subtitle}
            </p>
          </div>
        </div>
        <p className={`shrink-0 text-right text-sm font-black ${isLightMode ? 'text-slate-700' : 'text-slate-200'}`}>
          {value}
        </p>
      </div>
      <div className={`h-2 overflow-hidden rounded-full ${isLightMode ? 'bg-slate-200' : 'bg-white/10'}`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${accentClass} transition-all duration-300`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
};

const EmptyState = ({
  title,
  description,
  icon,
  isLightMode,
}: ThemeAwareProps & {
  title: string;
  description: string;
  icon: ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
    <span className={`grid h-12 w-12 place-items-center rounded-lg ${isLightMode ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-slate-300'}`}>
      {icon}
    </span>
    <p className={`mt-4 text-sm font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
      {title}
    </p>
    <p className={`mt-2 max-w-sm text-sm leading-6 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
      {description}
    </p>
  </div>
);

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

  const panelClass = [
    'rounded-lg border shadow-xl transition-colors',
    isLightMode
      ? 'border-slate-200 bg-white shadow-slate-200/70'
      : 'border-white/10 bg-[#101826] shadow-black/20',
  ].join(' ');
  const inputClass = [
    'h-11 w-full rounded-lg border px-3 text-sm font-bold outline-none transition focus:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-400/70',
    isLightMode
      ? 'border-slate-200 bg-white text-slate-950'
      : 'border-white/10 bg-[#0B1220] text-white',
  ].join(' ');
  const labelClass = `text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`;
  const mutedClass = isLightMode ? 'text-slate-500' : 'text-slate-400';
  const headingClass = isLightMode ? 'text-slate-950' : 'text-white';
  const rowBorderClass = isLightMode ? 'divide-slate-200' : 'divide-white/10';
  const activeFilterCount = getActiveFilterCount(appliedFilter);
  const refundRate =
    overview.grossRevenue > 0 ? (overview.totalRefunds / overview.grossRevenue) * 100 : 0;
  const occupancyWidth = clampPercent(occupancyAndFb.occupancyRate);

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
        colorClass: 'from-cyan-600 to-blue-500',
        note: `${formatNumber(overview.totalSuccessfulBookings)} lượt đặt thành công`,
      },
      {
        label: 'Doanh thu thuần',
        value: overview.netRevenue,
        colorClass: 'from-emerald-600 to-teal-400',
        note: `Sau hoàn tiền ${formatCurrency(overview.totalRefunds)}`,
      },
      {
        label: 'Doanh thu vé',
        value: occupancyAndFb.ticketRevenue,
        colorClass: 'from-sky-600 to-cyan-400',
        note: `${formatNumber(overview.totalTicketsSold)} vé đã bán`,
      },
      {
        label: 'Doanh thu F&B',
        value: occupancyAndFb.fbRevenue,
        colorClass: 'from-amber-500 to-orange-400',
        note: `${formatPercent(occupancyAndFb.fbRevenuePercentage)} trong cơ cấu`,
      },
    ],
    [
      occupancyAndFb.fbRevenue,
      occupancyAndFb.fbRevenuePercentage,
      occupancyAndFb.ticketRevenue,
      overview.grossRevenue,
      overview.netRevenue,
      overview.totalRefunds,
      overview.totalSuccessfulBookings,
      overview.totalTicketsSold,
    ],
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
        'min-h-screen p-4 transition-colors sm:p-6',
        isLightMode ? 'bg-[#F6F8FB] text-slate-950' : 'bg-[#080B12] text-white',
      ].join(' ')}
      style={{
        backgroundImage: isLightMode
          ? 'linear-gradient(135deg, rgba(241,245,249,0.92), rgba(248,250,252,0.98)), repeating-linear-gradient(90deg, rgba(15,23,42,0.035) 0 1px, transparent 1px 72px)'
          : 'linear-gradient(135deg, rgba(8,11,18,0.98), rgba(14,21,35,0.96)), repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 72px)',
      }}
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,430px)] xl:items-start">
          <section className="py-2">
            <p className="text-sm font-black uppercase text-cyan-500">
              Phân tích doanh thu
            </p>
            <h1 className={`mt-3 max-w-3xl text-3xl font-black leading-tight lg:text-4xl ${headingClass}`}>
              Dashboard vận hành doanh thu
            </h1>
            <p className={`mt-4 max-w-3xl text-sm leading-6 ${mutedClass}`}>
              {getFilterSummary(appliedFilter, cinemas)}
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <MetricStrip
                label="Bộ lọc"
                value={activeFilterCount > 0 ? `${activeFilterCount} điều kiện` : 'Toàn hệ thống'}
                icon={<FaFilter />}
                isLightMode={isLightMode}
              />
              <MetricStrip
                label="Lấp đầy"
                value={formatPercent(occupancyAndFb.occupancyRate)}
                icon={<FaPercent />}
                isLightMode={isLightMode}
              />
              <MetricStrip
                label="Trạng thái"
                value={loading ? 'Đang cập nhật' : 'Dữ liệu mới nhất'}
                icon={loading ? <FaSyncAlt className="animate-spin" /> : <FaChartLine />}
                isLightMode={isLightMode}
              />
            </div>
          </section>

          <form onSubmit={handleSubmitFilter} className={`${panelClass} p-4`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className={labelClass}>Bộ lọc báo cáo</p>
                <p className={`mt-1 text-sm font-semibold ${mutedClass}`}>
                  Chọn thời gian và chi nhánh
                </p>
              </div>
              <span className={`grid h-10 w-10 place-items-center rounded-lg ${isLightMode ? 'bg-cyan-50 text-cyan-700' : 'bg-cyan-500/10 text-cyan-200'}`}>
                <FaCalendarAlt />
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <label className="grid gap-2">
                <span className={labelClass}>Từ ngày</span>
                <input
                  type="date"
                  value={draftFilter.fromDate || ''}
                  onChange={(event) =>
                    setDraftFilter((current) => ({
                      ...current,
                      fromDate: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>

              <label className="grid gap-2">
                <span className={labelClass}>Đến ngày</span>
                <input
                  type="date"
                  value={draftFilter.toDate || ''}
                  onChange={(event) =>
                    setDraftFilter((current) => ({
                      ...current,
                      toDate: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>

              <label className="grid gap-2 sm:col-span-2 xl:col-span-1">
                <span className={labelClass}>Chi nhánh</span>
                <select
                  value={draftFilter.cinemaId || ''}
                  onChange={(event) =>
                    setDraftFilter((current) => ({
                      ...current,
                      cinemaId: event.target.value,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="">Tất cả chi nhánh</option>
                  {cinemas.map((cinema) => (
                    <option key={cinema.cinemaId} value={cinema.cinemaId}>
                      {cinema.cinemaName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-black text-white transition hover:bg-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <FaFilter />
                Lọc dữ liệu
              </button>
              <button
                type="button"
                onClick={handleResetFilter}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                  isLightMode
                    ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                }`}
              >
                <FaRedoAlt />
                Đặt lại
              </button>
            </div>
          </form>
        </div>

        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200">
            <FaExclamationTriangle className="mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Tổng doanh thu"
            value={formatCurrency(overview.grossRevenue)}
            meta={`${formatNumber(overview.totalSuccessfulBookings)} lượt đặt thành công`}
            icon={<FaMoneyBillWave />}
            accentClass="from-cyan-600 to-blue-500"
            loading={loading}
            isLightMode={isLightMode}
          />
          <StatCard
            label="Doanh thu thuần"
            value={formatCurrency(overview.netRevenue)}
            meta={`Hoàn tiền ${formatPercent(refundRate)} tổng doanh thu`}
            icon={<FaCoins />}
            accentClass="from-emerald-600 to-teal-400"
            loading={loading}
            isLightMode={isLightMode}
          />
          <StatCard
            label="Vé đã bán"
            value={formatNumber(overview.totalTicketsSold)}
            meta={`${formatPercent(occupancyAndFb.occupancyRate)} công suất ghế`}
            icon={<FaTicketAlt />}
            accentClass="from-sky-600 to-cyan-400"
            loading={loading}
            isLightMode={isLightMode}
          />
          <StatCard
            label="Giá trị đơn TB"
            value={formatCurrency(overview.averageOrderValue)}
            meta="Theo lượt đặt vé thành công"
            icon={<FaReceipt />}
            accentClass="from-amber-500 to-orange-400"
            loading={loading}
            isLightMode={isLightMode}
          />
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <section className={panelClass}>
            <PanelHeader
              eyebrow="Revenue"
              title="Dòng tiền theo nhóm"
              description="So sánh các nguồn doanh thu chính trong bộ lọc hiện tại."
              icon={<FaChartLine />}
              isLightMode={isLightMode}
              action={
                <span className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-black ${
                  isLightMode
                    ? 'border-slate-200 bg-slate-50 text-slate-600'
                    : 'border-white/10 bg-white/5 text-slate-300'
                }`}>
                  {loading ? <FaSyncAlt className="animate-spin" /> : <FaCalendarAlt />}
                  {getRangeLabel(appliedFilter)}
                </span>
              }
            />
            <RevenueBarChart bars={revenueBars} isLightMode={isLightMode} />
          </section>

          <section className={panelClass}>
            <PanelHeader
              eyebrow="Mix"
              title="Cơ cấu doanh thu"
              description="Tỷ lệ giữa vé và F&B để theo dõi sức mua phụ trợ."
              icon={<FaChartPie />}
              isLightMode={isLightMode}
            />
            <RevenuePieChart
              ticketRevenue={occupancyAndFb.ticketRevenue}
              fbRevenue={occupancyAndFb.fbRevenue}
              isLightMode={isLightMode}
            />
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className={panelClass}>
            <PanelHeader
              eyebrow="Top movies"
              title="Xếp hạng phim"
              description="Phim bán vé tốt nhất theo bộ lọc đang áp dụng."
              icon={<FaTrophy />}
              isLightMode={isLightMode}
            />

            {movieRanking.length === 0 ? (
              <EmptyState
                title="Chưa có dữ liệu phim"
                description="Bộ lọc hiện tại chưa phát sinh lượt bán vé."
                icon={<FaFilm />}
                isLightMode={isLightMode}
              />
            ) : (
              <div className={`divide-y ${rowBorderClass}`}>
                {movieRanking.map((movie, index) => (
                  <ProgressRow
                    key={movie.movieId || movie.movieTitle}
                    title={movie.movieTitle}
                    subtitle={formatCurrency(movie.ticketRevenue)}
                    value={`${formatNumber(movie.ticketsSold)} vé`}
                    progress={(movie.ticketsSold / maxTicketsSold) * 100}
                    accentClass="from-cyan-600 to-blue-500"
                    isLightMode={isLightMode}
                    leading={
                      <span className={`grid h-9 w-9 place-items-center rounded-lg text-sm font-black ${
                        index === 0
                          ? 'bg-amber-500 text-white'
                          : isLightMode
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-white/10 text-slate-200'
                      }`}>
                        {index + 1}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <section className={panelClass}>
            <PanelHeader
              eyebrow="F&B"
              title="Hiệu suất F&B"
              description="Doanh thu, số lượng bán và mức đóng góp của từng món."
              icon={<FaUtensils />}
              isLightMode={isLightMode}
            />

            <div className={`grid divide-y border-b sm:grid-cols-3 sm:divide-x sm:divide-y-0 ${rowBorderClass} ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
              {[
                {
                  label: 'Doanh thu F&B',
                  value: formatCurrency(occupancyAndFb.fbRevenue),
                },
                {
                  label: 'Ghế đã bán',
                  value: formatNumber(occupancyAndFb.totalSoldSeats),
                },
                {
                  label: 'Sức chứa',
                  value: formatNumber(occupancyAndFb.totalAvailableSeatsCapacity),
                },
              ].map((item) => (
                <div key={item.label} className="p-5">
                  <p className={labelClass}>{item.label}</p>
                  <p className={`mt-2 text-lg font-black ${headingClass}`}>{item.value}</p>
                </div>
              ))}
            </div>

            {occupancyAndFb.fbItems.length === 0 ? (
              <EmptyState
                title="Chưa có F&B được bán"
                description="Bộ lọc hiện tại chưa ghi nhận doanh thu đồ ăn hoặc thức uống."
                icon={<FaUtensils />}
                isLightMode={isLightMode}
              />
            ) : (
              <div className={`divide-y ${rowBorderClass}`}>
                {occupancyAndFb.fbItems.map((item) => (
                  <ProgressRow
                    key={item.fbItemId || item.itemName}
                    title={item.itemName}
                    subtitle={formatCurrency(item.revenue)}
                    value={formatNumber(item.quantitySold)}
                    progress={(item.quantitySold / maxFbQuantity) * 100}
                    accentClass="from-amber-500 to-orange-400"
                    isLightMode={isLightMode}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <section className={panelClass}>
          <PanelHeader
            eyebrow="Channels"
            title="F&B theo kênh bán"
            description="Theo dõi tỷ trọng F&B từ từng kênh đặt vé."
            icon={<FaBuilding />}
            isLightMode={isLightMode}
            action={
              <span className={`inline-flex min-h-10 items-center rounded-lg border px-3 text-xs font-black ${
                isLightMode
                  ? 'border-slate-200 bg-slate-50 text-slate-600'
                  : 'border-white/10 bg-white/5 text-slate-300'
              }`}>
                Lấp đầy {formatPercent(occupancyAndFb.occupancyRate)}
              </span>
            }
          />

          <div className={`h-2 ${isLightMode ? 'bg-slate-100' : 'bg-white/5'}`}>
            <div
              className="h-full bg-gradient-to-r from-emerald-600 via-cyan-500 to-amber-400 transition-all duration-300"
              style={{ width: `${occupancyWidth}%` }}
            />
          </div>

          {salesChannels.length === 0 ? (
            <EmptyState
              title="Chưa có dữ liệu kênh bán"
              description="Bộ lọc hiện tại chưa phát sinh doanh thu F&B theo kênh."
              icon={<FaReceipt />}
              isLightMode={isLightMode}
            />
          ) : (
            <div className={`divide-y ${rowBorderClass}`}>
              {salesChannels.map((channel) => (
                <div
                  key={channel.channel}
                  className={`grid gap-4 px-5 py-4 transition lg:grid-cols-[minmax(0,1fr)_180px_180px] lg:items-center ${
                    isLightMode ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-black ${headingClass}`}>
                      {channel.channelLabel || channel.channel}
                    </p>
                    <p className={`mt-1 text-xs font-semibold ${mutedClass}`}>
                      {formatNumber(channel.bookingCount)} lượt đặt có F&B
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className={labelClass}>Doanh thu</p>
                    <p className={`mt-1 text-sm font-black ${headingClass}`}>
                      {formatCurrency(channel.totalRevenue)}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className={labelClass}>Tỷ trọng</p>
                      <p className="text-sm font-black text-emerald-500">
                        {formatPercent(channel.percentage)}
                      </p>
                    </div>
                    <div className={`h-2 overflow-hidden rounded-full ${isLightMode ? 'bg-slate-200' : 'bg-white/10'}`}>
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-400"
                        style={{ width: `${channel.percentage > 0 ? Math.max(5, clampPercent(channel.percentage)) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
