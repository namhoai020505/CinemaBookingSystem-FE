import { useEffect, useMemo, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
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

type ReportSectionId = 'revenue' | 'performance' | 'channels';

type DatePreset = {
  id: string;
  label: string;
  description: string;
  getRange: () => Pick<DashboardFilter, 'fromDate' | 'toDate'>;
};

type RevenueBar = {
  label: string;
  value: number;
  colorClass: string;
  note: string;
};

type ThemeAwareProps = {
  isLightMode: boolean;
};

type DateInputElement = HTMLInputElement & {
  showPicker?: () => void;
};

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

const padDatePart = (value: number) => String(value).padStart(2, '0');

const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

const cloneDate = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, amount: number) => {
  const nextDate = cloneDate(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
};

const getStartOfWeek = (date: Date) => {
  const nextDate = cloneDate(date);
  const mondayOffset = (nextDate.getDay() + 6) % 7;
  nextDate.setDate(nextDate.getDate() - mondayOffset);
  return nextDate;
};

const getDatePresets = (): DatePreset[] => [
  {
    id: 'all',
    label: 'Tất cả',
    description: 'Không giới hạn thời gian',
    getRange: () => ({ fromDate: undefined, toDate: undefined }),
  },
  {
    id: 'today',
    label: 'Hôm nay',
    description: 'Doanh thu trong ngày',
    getRange: () => {
      const today = new Date();
      const value = toDateInputValue(today);
      return { fromDate: value, toDate: value };
    },
  },
  {
    id: 'this-week',
    label: 'Tuần này',
    description: 'Từ thứ 2 đến hôm nay',
    getRange: () => {
      const today = new Date();
      return {
        fromDate: toDateInputValue(getStartOfWeek(today)),
        toDate: toDateInputValue(today),
      };
    },
  },
  {
    id: 'last-week',
    label: 'Tuần trước',
    description: 'Trọn tuần trước',
    getRange: () => {
      const thisWeekStart = getStartOfWeek(new Date());
      const lastWeekStart = addDays(thisWeekStart, -7);
      const lastWeekEnd = addDays(thisWeekStart, -1);
      return {
        fromDate: toDateInputValue(lastWeekStart),
        toDate: toDateInputValue(lastWeekEnd),
      };
    },
  },
  {
    id: 'this-month',
    label: 'Tháng này',
    description: 'Từ đầu tháng đến hôm nay',
    getRange: () => {
      const today = new Date();
      return {
        fromDate: toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)),
        toDate: toDateInputValue(today),
      };
    },
  },
  {
    id: 'last-month',
    label: 'Tháng trước',
    description: 'Trọn tháng trước',
    getRange: () => {
      const today = new Date();
      return {
        fromDate: toDateInputValue(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        toDate: toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    },
  },
  {
    id: 'this-year',
    label: 'Năm nay',
    description: 'Từ đầu năm đến hôm nay',
    getRange: () => {
      const today = new Date();
      return {
        fromDate: toDateInputValue(new Date(today.getFullYear(), 0, 1)),
        toDate: toDateInputValue(today),
      };
    },
  },
  {
    id: 'last-year',
    label: 'Năm trước',
    description: 'Trọn năm trước',
    getRange: () => {
      const today = new Date();
      return {
        fromDate: toDateInputValue(new Date(today.getFullYear() - 1, 0, 1)),
        toDate: toDateInputValue(new Date(today.getFullYear() - 1, 11, 31)),
      };
    },
  },
];

const normalizeFilter = (filter: DashboardFilter): DashboardFilter => ({
  fromDate: filter.fromDate || undefined,
  toDate: filter.toDate || undefined,
  cinemaId: filter.cinemaId || undefined,
});

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

  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
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
    return `Từ ${formatDateLabel(filter.fromDate)} đến ${formatDateLabel(filter.toDate)}`;
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
  return `${cinema?.cinemaName || 'Tất cả chi nhánh'} • ${getRangeLabel(filter)}`;
};

const getActiveFilterCount = (filter: DashboardFilter) =>
  Number(Boolean(filter.fromDate)) +
  Number(Boolean(filter.toDate)) +
  Number(Boolean(filter.cinemaId));

const clampPercent = (value: number) => Math.min(100, Math.max(0, value || 0));

const openNativeDatePicker = (event: MouseEvent<HTMLInputElement>) => {
  const input = event.currentTarget as DateInputElement;
  input.focus();

  try {
    input.showPicker?.();
  } catch {
    // Browser fallback: focusing the native date input still keeps keyboard access intact.
  }
};

const PanelHeader = ({
  icon,
  eyebrow,
  title,
  description,
  action,
  isLightMode,
}: ThemeAwareProps & {
  icon: ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) => (
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
      <div className="flex items-start gap-3">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${
            isLightMode ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-slate-200'
          }`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className={`text-base font-black leading-6 ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
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

const StatCard = ({
  label,
  value,
  meta,
  icon,
  accentClass,
  loading,
  isLightMode,
}: ThemeAwareProps & {
  label: string;
  value: string;
  meta: string;
  icon: ReactNode;
  accentClass: string;
  loading: boolean;
}) => (
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

const MetricStrip = ({
  label,
  value,
  icon,
  isLightMode,
}: ThemeAwareProps & {
  label: string;
  value: string;
  icon: ReactNode;
}) => (
  <div
    className={`flex min-h-[72px] items-center gap-3 rounded-lg border px-3 py-3 shadow-sm ${
      isLightMode
        ? 'border-slate-200 bg-white shadow-slate-200/70'
        : 'border-white/10 bg-white/[0.04] shadow-black/20'
    }`}
  >
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${isLightMode ? 'bg-white text-slate-700' : 'bg-white/10 text-slate-200'}`}>
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

const RevenueColumnChart = ({
  bars,
  isLightMode,
}: ThemeAwareProps & {
  bars: RevenueBar[];
}) => {
  const maxValue = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
      {bars.map((bar) => {
        const height = bar.value > 0 ? Math.max(8, Math.round((bar.value / maxValue) * 100)) : 0;

        return (
          <div key={bar.label} className="flex min-h-[285px] min-w-0 flex-col justify-end gap-3">
            <div
              className={`flex min-h-[165px] flex-1 items-end rounded-lg border border-dashed p-2 ${
                isLightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.03]'
              }`}
              aria-label={`${bar.label}: ${formatCurrency(bar.value)}`}
              role="img"
            >
              <div
                className={`w-full rounded-t-md bg-gradient-to-t ${bar.colorClass} shadow-lg transition-all duration-300`}
                style={{ height: `${height}%` }}
                title={formatCurrency(bar.value)}
              />
            </div>
            <div className="min-h-[86px]">
              <p className={`text-sm font-black leading-5 ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                {bar.label}
              </p>
              <p className={`mt-1 text-sm font-black ${isLightMode ? 'text-slate-700' : 'text-slate-200'}`}>
                {formatCurrency(bar.value)}
              </p>
              <p className={`mt-1 text-xs font-semibold leading-5 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {bar.note}
              </p>
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
}: ThemeAwareProps & {
  ticketRevenue: number;
  fbRevenue: number;
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
      <div
        className="mx-auto grid h-44 w-44 place-items-center rounded-full shadow-xl"
        style={{ background }}
        role="img"
        aria-label={`Doanh thu vé ${formatPercent(ticketPercent)}, doanh thu F&B ${formatPercent(fbPercent)}`}
      >
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

const ProgressRow = ({
  title,
  subtitle,
  value,
  progress,
  accentClass,
  leading,
  isLightMode,
}: ThemeAwareProps & {
  title: string;
  subtitle: string;
  value: string;
  progress: number;
  accentClass: string;
  leading?: ReactNode;
}) => {
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
  const [activeSection, setActiveSection] = useState<ReportSectionId>('revenue');
  const [cinemas, setCinemas] = useState<CinemaResponse[]>([]);
  const [overview, setOverview] = useState<DashboardOverview>(emptyOverview);
  const [movieRanking, setMovieRanking] = useState<MovieRankingItem[]>([]);
  const [occupancyAndFb, setOccupancyAndFb] =
    useState<OccupancyAndFbBreakdown>(emptyOccupancyAndFb);
  const [salesChannels, setSalesChannels] = useState<SalesChannelBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const datePresets = useMemo(() => getDatePresets(), []);
  const activeDraftPreset = datePresets.find((preset) => {
    const range = preset.getRange();
    return (
      (range.fromDate || '') === (draftFilter.fromDate || '') &&
      (range.toDate || '') === (draftFilter.toDate || '')
    );
  });
  const activeFilterCount = getActiveFilterCount(appliedFilter);
  const refundRate =
    overview.grossRevenue > 0 ? (overview.totalRefunds / overview.grossRevenue) * 100 : 0;
  const panelClass = [
    'rounded-lg border shadow-xl transition-colors',
    isLightMode
      ? 'border-slate-200 bg-white shadow-slate-200/70'
      : 'border-white/10 bg-[#101826] shadow-black/20',
  ].join(' ');
  const inputClass = [
    'h-11 w-full cursor-pointer rounded-lg border px-3 text-sm font-bold outline-none transition focus:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-400/70',
    isLightMode
      ? 'border-slate-200 bg-white text-slate-950'
      : 'border-white/10 bg-[#0B1220] text-white',
  ].join(' ');
  const labelClass = `text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`;
  const mutedClass = isLightMode ? 'text-slate-500' : 'text-slate-400';
  const headingClass = isLightMode ? 'text-slate-950' : 'text-white';
  const rowBorderClass = isLightMode ? 'divide-slate-200' : 'divide-white/10';

  const reportSections: Array<{
    id: ReportSectionId;
    label: string;
    description: string;
    icon: ReactNode;
  }> = [
    {
      id: 'revenue',
      label: 'Dòng tiền & cơ cấu',
      description: 'Doanh thu theo nhóm và tỷ trọng',
      icon: <FaChartPie />,
    },
    {
      id: 'performance',
      label: 'Phim & F&B',
      description: 'Xếp hạng phim, hiệu suất F&B',
      icon: <FaTrophy />,
    },
    {
      id: 'channels',
      label: 'Kênh bán F&B',
      description: 'Online, offline và tỷ trọng',
      icon: <FaBuilding />,
    },
  ];

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

  const applyFilter = (filter: DashboardFilter) => {
    const nextFilter = normalizeFilter(filter);
    setDraftFilter(nextFilter);
    setAppliedFilter(nextFilter);
  };

  const handleSubmitFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applyFilter(draftFilter);
  };

  const handleDatePreset = (preset: DatePreset) => {
    applyFilter({
      ...draftFilter,
      ...preset.getRange(),
    });
  };

  const handleResetFilter = () => {
    setDraftFilter({});
    setAppliedFilter({});
  };

  return (
    <div
      className={[
        'min-h-full p-4 transition-colors sm:p-6',
        isLightMode ? 'bg-[#F6F8FB] text-slate-950' : 'bg-[#080B12] text-white',
      ].join(' ')}
      style={{
        backgroundImage: isLightMode
          ? 'linear-gradient(135deg, rgba(241,245,249,0.92), rgba(248,250,252,0.98)), repeating-linear-gradient(90deg, rgba(15,23,42,0.035) 0 1px, transparent 1px 72px)'
          : 'linear-gradient(135deg, rgba(8,11,18,0.98), rgba(14,21,35,0.96)), repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 72px)',
      }}
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5">
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(560px,720px)] xl:items-end">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase text-cyan-500">
              Phân tích doanh thu
            </p>
            <h1 className={`mt-3 max-w-3xl text-3xl font-black leading-tight lg:text-4xl ${headingClass}`}>
              Dashboard vận hành doanh thu
            </h1>
            <p className={`mt-4 max-w-3xl text-sm leading-6 ${mutedClass}`}>
              {getFilterSummary(appliedFilter, cinemas)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricStrip
              label="Bộ lọc"
              value={activeFilterCount > 0 ? `${activeFilterCount} điều kiện` : 'Toàn hệ thống'}
              icon={<FaFilter />}
              isLightMode={isLightMode}
            />
            <MetricStrip
              label="Tỷ lệ ghế đã bán"
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
            meta={`${formatNumber(overview.totalSuccessfulBookings)} lượt đặt vé thành công`}
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
            meta={`${formatPercent(occupancyAndFb.occupancyRate)} ghế đã bán / tổng sức chứa ghế`}
            icon={<FaTicketAlt />}
            accentClass="from-sky-600 to-cyan-400"
            loading={loading}
            isLightMode={isLightMode}
          />
          <StatCard
            label="Giá trị đơn trung bình"
            value={formatCurrency(overview.averageOrderValue)}
            meta="Tính theo lượt đặt vé thành công"
            icon={<FaReceipt />}
            accentClass="from-amber-500 to-orange-400"
            loading={loading}
            isLightMode={isLightMode}
          />
        </section>

        <section
          className={`sticky top-0 z-20 rounded-lg border p-3 shadow-xl backdrop-blur-xl ${
            isLightMode
              ? 'border-slate-200 bg-white/90 shadow-slate-200/70'
              : 'border-white/10 bg-[#0B1220]/90 shadow-black/30'
          }`}
        >
          <div className="mb-3 flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className={labelClass}>Bộ lọc báo cáo</p>
              <p className={`mt-1 text-sm font-semibold ${mutedClass}`}>
                Chọn nhanh theo mốc thời gian hoặc bấm vào ô ngày để mở lịch.
              </p>
            </div>
            <p className={`text-sm font-black ${headingClass}`}>
              {getRangeLabel(appliedFilter)}
            </p>
          </div>

          <form
            onSubmit={handleSubmitFilter}
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(150px,180px)_minmax(150px,180px)_minmax(190px,220px)_minmax(210px,1fr)_auto_auto]"
          >
              <label className="grid gap-2">
                <span className={labelClass}>Từ ngày</span>
                <input
                  type="date"
                  value={draftFilter.fromDate || ''}
                  max={draftFilter.toDate || undefined}
                  onClick={openNativeDatePicker}
                  onChange={(event) =>
                    setDraftFilter((current) => ({
                      ...current,
                      fromDate: event.target.value,
                    }))
                  }
                  className={inputClass}
                  aria-label="Từ ngày"
                />
              </label>

              <label className="grid gap-2">
                <span className={labelClass}>Đến ngày</span>
                <input
                  type="date"
                  value={draftFilter.toDate || ''}
                  min={draftFilter.fromDate || undefined}
                  onClick={openNativeDatePicker}
                  onChange={(event) =>
                    setDraftFilter((current) => ({
                      ...current,
                      toDate: event.target.value,
                    }))
                  }
                  className={inputClass}
                  aria-label="Đến ngày"
                />
              </label>

              <label className="grid gap-2">
                <span className={labelClass}>Khoảng thời gian</span>
                <select
                  value={activeDraftPreset?.id ?? 'custom'}
                  onChange={(event) => {
                    const selectedPreset = datePresets.find(
                      (preset) => preset.id === event.target.value,
                    );

                    if (selectedPreset) {
                      handleDatePreset(selectedPreset);
                    }
                  }}
                  className={inputClass}
                  aria-label="Khoảng thời gian nhanh"
                >
                  <option value="custom">Tùy chỉnh</option>
                  {datePresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
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
                  aria-label="Chi nhánh"
                >
                  <option value="">Tất cả chi nhánh</option>
                  {cinemas.map((cinema) => (
                    <option key={cinema.cinemaId} value={cinema.cinemaId}>
                      {cinema.cinemaName}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-black text-white transition hover:bg-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <FaFilter />
                Áp dụng
              </button>

              <button
                type="button"
                onClick={handleResetFilter}
                className={`mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                  isLightMode
                    ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                }`}
              >
                <FaRedoAlt />
                Đặt lại
              </button>
          </form>

          <nav
            className={`mt-3 grid gap-2 border-t pt-3 lg:grid-cols-3 ${
              isLightMode ? 'border-slate-200' : 'border-white/10'
            }`}
            aria-label="Điều hướng nhóm báo cáo"
            role="tablist"
          >
            {reportSections.map((section) => {
              const active = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                    active
                      ? 'border-cyan-500 bg-cyan-600 text-white shadow-lg shadow-cyan-600/20'
                      : isLightMode
                        ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                  }`}
                  aria-selected={active}
                  role="tab"
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                      active
                        ? 'bg-white/20 text-white'
                        : isLightMode
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {section.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black">{section.label}</span>
                    <span className={`mt-0.5 block truncate text-xs font-semibold ${active ? 'text-cyan-50' : mutedClass}`}>
                      {section.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </section>

        {activeSection === 'revenue' ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]" role="tabpanel">
            <section className={panelClass}>
              <PanelHeader
                eyebrow="Revenue"
                title="Dòng tiền theo nhóm"
                description="Biểu đồ cột dọc so sánh tổng doanh thu, doanh thu thuần, vé và F&B."
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
              <RevenueColumnChart bars={revenueBars} isLightMode={isLightMode} />
            </section>

            <section className={panelClass}>
              <PanelHeader
                eyebrow="Mix"
                title="Cơ cấu doanh thu"
                description="Tỷ lệ giữa vé đã bán và F&B đã bán trong bộ lọc hiện tại."
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
        ) : null}

        {activeSection === 'performance' ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" role="tabpanel">
            <section className={panelClass}>
              <PanelHeader
                eyebrow="Top movies"
                title="Xếp hạng phim"
                description="Phim bán vé tốt nhất, sắp xếp giảm dần theo số vé đã bán."
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
                description="Doanh thu, số lượng bán và mức đóng góp của từng món F&B."
                icon={<FaUtensils />}
                isLightMode={isLightMode}
              />

              <div className={`grid divide-y border-b sm:grid-cols-3 sm:divide-x sm:divide-y-0 ${rowBorderClass} ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
                {[
                  {
                    label: 'Doanh thu F&B',
                    value: formatCurrency(occupancyAndFb.fbRevenue),
                    note: 'Tổng tiền F&B đã bán',
                  },
                  {
                    label: 'Ghế đã bán',
                    value: formatNumber(occupancyAndFb.totalSoldSeats),
                    note: 'Số ghế đã thanh toán',
                  },
                  {
                    label: 'Sức chứa ghế',
                    value: formatNumber(occupancyAndFb.totalAvailableSeatsCapacity),
                    note: 'Tổng ghế theo suất chiếu',
                  },
                ].map((item) => (
                  <div key={item.label} className="p-5">
                    <p className={labelClass}>{item.label}</p>
                    <p className={`mt-2 text-lg font-black ${headingClass}`}>{item.value}</p>
                    <p className={`mt-1 text-xs font-semibold ${mutedClass}`}>{item.note}</p>
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
                      value={`${formatNumber(item.quantitySold)} món`}
                      progress={(item.quantitySold / maxFbQuantity) * 100}
                      accentClass="from-amber-500 to-orange-400"
                      isLightMode={isLightMode}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}

        {activeSection === 'channels' ? (
          <section className={panelClass} role="tabpanel">
            <PanelHeader
              eyebrow="Channels"
              title="F&B theo kênh bán"
              description="Theo dõi tỷ trọng F&B từ từng kênh đặt vé online và offline."
              icon={<FaBuilding />}
              isLightMode={isLightMode}
            />

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
        ) : null}
      </div>
    </div>
  );
}
