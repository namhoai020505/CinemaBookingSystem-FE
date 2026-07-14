import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FaCalendarAlt, FaChartLine, FaCoins, FaReceipt, FaTicketAlt } from 'react-icons/fa';
import type { ManagerOutletContext } from '../../layouts/manager/ManagerLayout';
import {
  managerService,
} from '../../services/managerService';
import type {
  DashboardFilter,
  DashboardOverview,
  MovieRankingItem,
  OccupancyAndFbBreakdown,
} from '../../services/dashboardService';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  getApiErrorMessage,
  inputClass,
  PageShell,
  panelClass,
  StatePanel,
  StatusBadge,
  toDateInputValue,
} from './managerUi';

const emptyOverview: DashboardOverview = {
  grossRevenue: 0,
  totalRefunds: 0,
  netRevenue: 0,
  averageOrderValue: 0,
  totalTicketsSold: 0,
  totalSuccessfulBookings: 0,
};

const emptyOccupancy: OccupancyAndFbBreakdown = {
  occupancyRate: 0,
  totalSoldSeats: 0,
  totalAvailableSeatsCapacity: 0,
  ticketRevenue: 0,
  fbRevenue: 0,
  fbRevenuePercentage: 0,
  fbItems: [],
};

const getRange = (range: string): DashboardFilter => {
  const today = new Date();
  if (range === 'today') {
    const value = toDateInputValue(today);
    return { fromDate: value, toDate: value };
  }

  if (range === '7d') {
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    return { fromDate: toDateInputValue(start), toDate: toDateInputValue(today) };
  }

  if (range === '30d') {
    const start = new Date(today);
    start.setDate(today.getDate() - 29);
    return { fromDate: toDateInputValue(start), toDate: toDateInputValue(today) };
  }

  if (range === 'month') {
    return {
      fromDate: toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)),
      toDate: toDateInputValue(today),
    };
  }

  return {};
};

const StatCard = ({
  label,
  value,
  meta,
  icon,
  isLightMode,
}: {
  label: string;
  value: string;
  meta: string;
  icon: ReactNode;
  isLightMode: boolean;
}) => (
  <article className={`${panelClass(isLightMode)} p-5`}>
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {label}
        </p>
        <p className={`mt-4 text-2xl font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
          {value}
        </p>
        <p className={`mt-2 text-sm font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {meta}
        </p>
      </div>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-lg">
        {icon}
      </span>
    </div>
  </article>
);

const ManagerDashboardPage = () => {
  const { isLightMode } = useOutletContext<ManagerOutletContext>();
  const [rangePreset, setRangePreset] = useState('7d');
  const [draftFilter, setDraftFilter] = useState<DashboardFilter>(() => getRange('7d'));
  const [appliedFilter, setAppliedFilter] = useState<DashboardFilter>(() => getRange('7d'));
  const [overview, setOverview] = useState<DashboardOverview>(emptyOverview);
  const [occupancy, setOccupancy] = useState<OccupancyAndFbBreakdown>(emptyOccupancy);
  const [ranking, setRanking] = useState<MovieRankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        const [overviewData, occupancyData, rankingData] = await Promise.all([
          managerService.getDashboardOverview(appliedFilter),
          managerService.getOccupancyAndFb(appliedFilter),
          managerService.getMovieRanking(appliedFilter),
        ]);

        if (!isMounted) {
          return;
        }

        setOverview(overviewData ?? emptyOverview);
        setOccupancy({ ...emptyOccupancy, ...(occupancyData ?? {}) });
        setRanking(rankingData ?? []);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getApiErrorMessage(error, 'Không tải được dashboard của rạp.'));
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

  const maxTickets = Math.max(...ranking.map((movie) => movie.ticketsSold), 1);
  const revenueMix = useMemo(() => {
    const total = occupancy.ticketRevenue + occupancy.fbRevenue;
    const ticketPercent = total > 0 ? (occupancy.ticketRevenue / total) * 100 : 0;
    const fbPercent = total > 0 ? 100 - ticketPercent : 0;
    return { ticketPercent, fbPercent };
  }, [occupancy.fbRevenue, occupancy.ticketRevenue]);

  const handlePresetChange = (value: string) => {
    setRangePreset(value);
    const nextFilter = getRange(value);
    setDraftFilter(nextFilter);
    setAppliedFilter(nextFilter);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRangePreset('custom');
    setAppliedFilter({
      fromDate: draftFilter.fromDate || undefined,
      toDate: draftFilter.toDate || undefined,
    });
  };

  return (
    <PageShell
      eyebrow="Manager reporting"
      title="Dashboard rạp của tôi"
      description="Theo dõi doanh thu, vé bán và hiệu suất ghế trong phạm vi rạp backend đã phân quyền cho tài khoản Manager."
      isLightMode={isLightMode}
      action={<StatusBadge status="Scope by backend" />}
    >
      <form
        onSubmit={handleSubmit}
        className={`${panelClass(isLightMode)} grid gap-3 p-4 md:grid-cols-[190px_180px_180px_auto] md:items-end`}
      >
        <label className="grid gap-2">
          <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Khoảng nhanh</span>
          <select
            value={rangePreset}
            onChange={(event) => handlePresetChange(event.target.value)}
            className={inputClass(isLightMode)}
          >
            <option value="today">Hôm nay</option>
            <option value="7d">7 ngày</option>
            <option value="30d">30 ngày</option>
            <option value="month">Tháng này</option>
            <option value="custom">Tùy chỉnh</option>
          </select>
        </label>
        <label className="grid gap-2">
          <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Từ ngày</span>
          <input
            type="date"
            value={draftFilter.fromDate || ''}
            onChange={(event) => setDraftFilter((current) => ({ ...current, fromDate: event.target.value }))}
            className={inputClass(isLightMode)}
          />
        </label>
        <label className="grid gap-2">
          <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Đến ngày</span>
          <input
            type="date"
            value={draftFilter.toDate || ''}
            onChange={(event) => setDraftFilter((current) => ({ ...current, toDate: event.target.value }))}
            className={inputClass(isLightMode)}
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-500"
        >
          <FaCalendarAlt />
          Áp dụng
        </button>
      </form>

      {loading ? (
        <StatePanel
          type="loading"
          title="Đang tải dashboard"
          description="Hệ thống đang lấy doanh thu và dữ liệu vé trong phạm vi rạp của bạn."
          isLightMode={isLightMode}
        />
      ) : errorMessage ? (
        <StatePanel type="error" title="Không tải được dashboard" description={errorMessage} isLightMode={isLightMode} />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Tổng doanh thu"
              value={formatCurrency(overview.grossRevenue)}
              meta={`${formatNumber(overview.totalSuccessfulBookings)} booking thành công`}
              icon={<FaCoins />}
              isLightMode={isLightMode}
            />
            <StatCard
              label="Doanh thu sau refund"
              value={formatCurrency(overview.netRevenue)}
              meta={`Refund ${formatCurrency(overview.totalRefunds)}`}
              icon={<FaReceipt />}
              isLightMode={isLightMode}
            />
            <StatCard
              label="Vé đã bán"
              value={formatNumber(overview.totalTicketsSold)}
              meta={`${formatPercent(occupancy.occupancyRate)} ghế đã bán / sức chứa`}
              icon={<FaTicketAlt />}
              isLightMode={isLightMode}
            />
            <StatCard
              label="Doanh thu F&B"
              value={formatCurrency(occupancy.fbRevenue)}
              meta={`${formatPercent(occupancy.fbRevenuePercentage)} trong cơ cấu`}
              icon={<FaChartLine />}
              isLightMode={isLightMode}
            />
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className={`${panelClass(isLightMode)} p-5`}>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className={`text-base font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>Top phim trong rạp</h2>
                  <p className={`mt-1 text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Sắp xếp theo số vé bán ra.</p>
                </div>
              </div>
              {ranking.length === 0 ? (
                <StatePanel
                  title="Chưa có dữ liệu phim"
                  description="Không có vé bán trong bộ lọc hiện tại."
                  isLightMode={isLightMode}
                />
              ) : (
                <div className="grid gap-4">
                  {ranking.map((movie, index) => (
                    <div key={movie.movieId || movie.movieTitle} className="grid gap-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                            #{index + 1} {movie.movieTitle}
                          </p>
                          <p className={`mt-1 text-xs font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {formatCurrency(movie.ticketRevenue)}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-black text-emerald-500">
                          {formatNumber(movie.ticketsSold)} vé
                        </p>
                      </div>
                      <div className={`h-2 overflow-hidden rounded-full ${isLightMode ? 'bg-slate-200' : 'bg-white/10'}`}>
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                          style={{ width: `${Math.max(5, (movie.ticketsSold / maxTickets) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={`${panelClass(isLightMode)} p-5`}>
              <h2 className={`text-base font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>Cơ cấu doanh thu</h2>
              <p className={`mt-1 text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Vé và F&B trong bộ lọc hiện tại.</p>
              <div className="mt-6 grid gap-4">
                {[
                  { label: 'Vé', value: occupancy.ticketRevenue, percent: revenueMix.ticketPercent, color: 'bg-cyan-500' },
                  { label: 'F&B', value: occupancy.fbRevenue, percent: revenueMix.fbPercent, color: 'bg-amber-500' },
                ].map((item) => (
                  <div key={item.label} className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-bold">
                        <span className={`h-3 w-3 rounded-full ${item.color}`} />
                        {item.label}
                      </span>
                      <span className="text-sm font-black">{formatPercent(item.percent)}</span>
                    </div>
                    <p className={`text-xs font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{formatCurrency(item.value)}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </PageShell>
  );
};

export default ManagerDashboardPage;
