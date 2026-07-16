import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FaCalendarAlt, FaChartLine, FaCoins, FaReceipt, FaTicketAlt } from 'react-icons/fa';
import type { ManagerOutletContext } from '../../layouts/manager/ManagerLayout';
import {
  managerDashboardService,
  type ManagerDashboardFilter,
  type ManagerDashboardResponse,
} from '../../services/managerDashboardService';
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

const emptyDashboard: ManagerDashboardResponse = {
  cinemaId: null,
  cinemaName: '',
  from: '',
  to: '',
  movieId: null,
  grossRevenue: 0,
  refundedAmount: 0,
  pendingRefundAmount: 0,
  manualRefundAmount: 0,
  netRevenue: 0,
  grossTicketsSold: 0,
  refundedTickets: 0,
  netTicketsSold: 0,
  sellableSeatCapacity: 0,
  occupiedSeats: 0,
  occupancyRate: 0,
};

const getRange = (range: string): ManagerDashboardFilter => {
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

const MetricBar = ({
  label,
  value,
  percent,
  isLightMode,
}: {
  label: string;
  value: string;
  percent: number;
  isLightMode: boolean;
}) => (
  <div className="grid gap-2">
    <div className="flex items-center justify-between gap-4">
      <span className={`text-sm font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>{label}</span>
      <span className="text-sm font-black text-emerald-500">{value}</span>
    </div>
    <div className={`h-2 overflow-hidden rounded-full ${isLightMode ? 'bg-slate-200' : 'bg-white/10'}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  </div>
);

const ManagerDashboardPage = () => {
  const { isLightMode } = useOutletContext<ManagerOutletContext>();
  const [rangePreset, setRangePreset] = useState('7d');
  const [draftFilter, setDraftFilter] = useState<ManagerDashboardFilter>(() => getRange('7d'));
  const [appliedFilter, setAppliedFilter] = useState<ManagerDashboardFilter>(() => getRange('7d'));
  const [dashboard, setDashboard] = useState<ManagerDashboardResponse>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        const dashboardData = await managerDashboardService.getDashboard(appliedFilter);

        if (!isMounted) {
          return;
        }

        setDashboard(dashboardData ?? emptyDashboard);
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

  const handlePresetChange = (value: string) => {
    setRangePreset(value);
    const nextFilter = getRange(value);
    setDraftFilter(nextFilter);

    if (value !== 'custom') {
      setAppliedFilter(nextFilter);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRangePreset('custom');
    setAppliedFilter({
      fromDate: draftFilter.fromDate || undefined,
      toDate: draftFilter.toDate || undefined,
    });
  };

  const ticketPercent = dashboard.grossTicketsSold > 0
    ? (dashboard.netTicketsSold / dashboard.grossTicketsSold) * 100
    : 0;
  const seatPercent = dashboard.sellableSeatCapacity > 0
    ? (dashboard.occupiedSeats / dashboard.sellableSeatCapacity) * 100
    : 0;

  return (
    <PageShell
      eyebrow="Manager reporting"
      title="Dashboard rạp của tôi"
      description="Theo dõi doanh thu, vé bán và hiệu suất ghế trong phạm vi rạp backend đã phân quyền cho tài khoản Manager."
      isLightMode={isLightMode}
      action={<StatusBadge status={dashboard.cinemaName || 'Scope by backend'} />}
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
              value={formatCurrency(dashboard.grossRevenue)}
              meta={dashboard.cinemaName || 'Rạp được backend phân quyền'}
              icon={<FaCoins />}
              isLightMode={isLightMode}
            />
            <StatCard
              label="Doanh thu sau refund"
              value={formatCurrency(dashboard.netRevenue)}
              meta={`Refund thành công ${formatCurrency(dashboard.refundedAmount)}`}
              icon={<FaReceipt />}
              isLightMode={isLightMode}
            />
            <StatCard
              label="Vé net đã bán"
              value={formatNumber(dashboard.netTicketsSold)}
              meta={`${formatNumber(dashboard.grossTicketsSold)} vé bán, ${formatNumber(dashboard.refundedTickets)} vé hoàn`}
              icon={<FaTicketAlt />}
              isLightMode={isLightMode}
            />
            <StatCard
              label="Tỷ lệ ghế đã bán"
              value={formatPercent(dashboard.occupancyRate)}
              meta={`${formatNumber(dashboard.occupiedSeats)} / ${formatNumber(dashboard.sellableSeatCapacity)} ghế`}
              icon={<FaChartLine />}
              isLightMode={isLightMode}
            />
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className={`${panelClass(isLightMode)} p-5`}>
              <div className="mb-5">
                <h2 className={`text-base font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>Hiệu suất vé và ghế</h2>
                <p className={`mt-1 text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Dữ liệu được scope theo rạp của tài khoản Manager.
                </p>
              </div>
              <div className="grid gap-5">
                <MetricBar
                  label="Vé còn hiệu lực sau refund"
                  value={`${formatNumber(dashboard.netTicketsSold)} / ${formatNumber(dashboard.grossTicketsSold)} vé`}
                  percent={ticketPercent}
                  isLightMode={isLightMode}
                />
                <MetricBar
                  label="Ghế đã bán trên tổng sức chứa ghế"
                  value={`${formatNumber(dashboard.occupiedSeats)} / ${formatNumber(dashboard.sellableSeatCapacity)} ghế`}
                  percent={seatPercent}
                  isLightMode={isLightMode}
                />
              </div>
            </section>

            <section className={`${panelClass(isLightMode)} p-5`}>
              <h2 className={`text-base font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>Refund theo trạng thái</h2>
              <p className={`mt-1 text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Chỉ refund thành công mới trừ vào doanh thu net.
              </p>
              <div className={`mt-5 divide-y ${isLightMode ? 'divide-slate-200' : 'divide-white/10'}`}>
                {[
                  { label: 'Đã hoàn tiền', value: dashboard.refundedAmount },
                  { label: 'Đang chờ refund', value: dashboard.pendingRefundAmount },
                  { label: 'Cần xử lý thủ công', value: dashboard.manualRefundAmount },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4 py-3">
                    <span className={`text-sm font-bold ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>{item.label}</span>
                    <span className={`text-sm font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>{formatCurrency(item.value)}</span>
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
