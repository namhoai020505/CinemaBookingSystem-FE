import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  FaBuilding,
  FaCheckCircle,
  FaClipboard,
  FaExclamationTriangle,
  FaHandshake,
  FaSearch,
  FaSyncAlt,
  FaUniversity,
} from 'react-icons/fa';
import type { ManagerOutletContext } from '../../layouts/manager/ManagerLayout';
import { managerService, type RefundItem } from '../../services/managerService';
import {
  formatCurrency,
  formatDateTime,
  getApiErrorMessage,
  getApiStatus,
  inputClass,
  PageShell,
  panelClass,
  StatePanel,
  StatusBadge,
} from './managerUi';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'all' | 'manual';

const ALL_STATUSES = [
  { value: '', label: 'Tất Cả' },
  { value: 'PENDING', label: 'PENDING (Chờ xử lý)' },
  { value: 'REQUESTED', label: 'REQUESTED (Đã yêu cầu)' },
  { value: 'PROCESSING', label: 'PROCESSING (Đang xử lý)' },
  { value: 'MANUAL_REQUIRED', label: 'MANUAL_REQUIRED (Thủ công)' },
  { value: 'SUCCESS', label: 'SUCCESS (Thành công)' },
  { value: 'FAILED', label: 'FAILED (Thất bại)' }
];

// ─── Main Component ───────────────────────────────────────────────────────────

const ManagerRefundsPage = () => {
  const { isLightMode } = useOutletContext<ManagerOutletContext>();

  const [tab, setTab] = useState<Tab>('all');

  // ── All Refunds state ───────────────────────────────────────────────────────
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [refunds, setRefunds] = useState<RefundItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isForbidden, setIsForbidden] = useState(false);

  // ── Manual tab state ────────────────────────────────────────────────────────
  const [manualList, setManualList] = useState<RefundItem[]>([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState('');

  // ── Fetch helpers ───────────────────────────────────────────────────────────
  const loadRefunds = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      setIsForbidden(false);
      const data = await managerService.getRefunds(status, 1, 50);
      setRefunds(data.items ?? []);
      setTotalCount(data.totalCount ?? data.items?.length ?? 0);
    } catch (error) {
      setIsForbidden(getApiStatus(error) === 403);
      setErrorMessage(getApiErrorMessage(error, 'Không tải được danh sách hoàn tiền.'));
      setRefunds([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [status]);

  const loadManualRefunds = useCallback(async () => {
    try {
      setManualLoading(true);
      setManualError('');
      const data = await managerService.getRefunds('MANUAL_REQUIRED', 1, 50);
      setManualList(data.items ?? []);
    } catch (error) {
      setManualError(getApiErrorMessage(error, 'Không tải được danh sách manual refund.'));
      setManualList([]);
    } finally {
      setManualLoading(false);
    }
  }, []);

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    void loadRefunds();
  }, [loadRefunds]);

  useEffect(() => {
    if (tab === 'manual') {
      void loadManualRefunds();
    }
  }, [tab, loadManualRefunds]);

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = refunds.filter((r) => {
    const q = search.toLowerCase();
    return !q || r.bookingId?.toLowerCase().includes(q) || r.movieTitle?.toLowerCase().includes(q);
  });

  // ── Classes ─────────────────────────────────────────────────────────────────
  const tabActive = isLightMode
    ? 'bg-blue-600 text-white shadow'
    : 'bg-blue-600 text-white shadow';
  const tabInactive = isLightMode
    ? 'text-slate-600 hover:text-slate-900'
    : 'text-slate-400 hover:text-white';

  return (
    <PageShell
      eyebrow="Refund operations"
      title="Theo Dõi Hoàn Tiền"
      description="Theo dõi các refund phát sinh từ nghiệp vụ hủy suất chiếu trong phạm vi rạp backend đã gắn cho tài khoản Manager."
      isLightMode={isLightMode}
      action={
        <StatusBadge status={`${totalCount} records`} />
      }
    >
      {/* Tabs */}
      <div className={`mb-2 flex w-fit gap-1 rounded-xl border p-1 ${isLightMode ? 'border-slate-200 bg-slate-200/60' : 'border-gray-800 bg-[#0D1637]/60'}`}>
        {([
          { id: 'all' as Tab, label: 'Tất Cả', icon: <FaClipboard /> },
          { id: 'manual' as Tab, label: 'Manual Refund', icon: <FaHandshake /> },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${tab === t.id ? tabActive : tabInactive}`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: All Refunds ────────────────────────────────────────────────── */}
      {tab === 'all' && (
        <>
          {/* Filters */}
          <section className={`${panelClass(isLightMode)} grid gap-3 p-4 md:grid-cols-[200px_1fr_auto] md:items-end`}>
            <label className="grid gap-2">
              <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Trạng Thái
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={inputClass(isLightMode)}
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Tìm Kiếm
              </span>
              <div className="relative">
                <FaSearch
                  className={`absolute left-3 top-1/2 -translate-y-1/2 ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}
                />
                <input
                  type="text"
                  placeholder="Booking ID hoặc tên phim..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`${inputClass(isLightMode)} pl-9`}
                />
              </div>
            </label>

            <button
              type="button"
              onClick={() => void loadRefunds()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-500"
            >
              <FaSyncAlt />
              Làm Mới
            </button>
          </section>

          {/* Table */}
          {loading ? (
            <StatePanel
              type="loading"
              title="Đang tải refund"
              description="Đang lấy danh sách hoàn tiền theo trạng thái đã chọn."
              isLightMode={isLightMode}
            />
          ) : isForbidden ? (
            <StatePanel type="error" title="Không có quyền xem refund" description={errorMessage} isLightMode={isLightMode} />
          ) : errorMessage ? (
            <StatePanel type="error" title="Không tải được refund" description={errorMessage} isLightMode={isLightMode} />
          ) : filtered.length === 0 ? (
            <StatePanel
              title="Không có refund phù hợp"
              description="Không có dữ liệu hoàn tiền trong trạng thái đang chọn."
              isLightMode={isLightMode}
            />
          ) : (
            <section className={panelClass(isLightMode)}>
              {/* Header row */}
              <div
                className={`grid border-b px-5 py-4 text-xs font-black uppercase ${
                  isLightMode ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-400'
                } lg:grid-cols-[minmax(0,1.5fr)_140px_140px_160px_160px_130px]`}
              >
                <span>Booking / Phim</span>
                <span className="text-right">Số Tiền</span>
                <span className="text-center">Refund Status</span>
                <span className="text-center">Workflow</span>
                <span className="text-center">Claim Status</span>
                <span>Ngày Yêu Cầu</span>
              </div>

              {/* Rows */}
              <div className={`divide-y ${isLightMode ? 'divide-slate-200' : 'divide-white/10'}`}>
                {filtered.map((refund) => (
                  <article
                    key={refund.refundId || refund.bookingId}
                    className={`grid gap-3 px-5 py-4 text-sm transition lg:grid-cols-[minmax(0,1.5fr)_140px_140px_160px_160px_130px] lg:items-center ${
                      isLightMode ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`truncate font-mono text-xs font-bold ${isLightMode ? 'text-blue-700' : 'text-blue-400'}`}>
                        {refund.bookingId}
                      </p>
                      <p className={`truncate font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                        {refund.movieTitle}
                      </p>
                      {refund.cinemaName && (
                        <p className={`mt-0.5 flex items-center gap-1 text-xs ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          <FaBuilding className="text-[10px]" />
                          {refund.cinemaName}
                        </p>
                      )}
                    </div>
                    <span className={`text-right font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                      {formatCurrency(refund.refundAmount)}
                    </span>
                    <div className="flex justify-center">
                      <StatusBadge status={refund.refundStatus} />
                    </div>
                    <div className="flex justify-center">
                      <StatusBadge status={refund.workflowStatus ?? refund.bookingStatus} />
                    </div>
                    <div className="flex justify-center">
                      {refund.claimStatus ? (
                        <StatusBadge status={refund.claimStatus} />
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </div>
                    <span className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {formatDateTime(refund.requestedAt)}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Tab: Manual Refund (read-only) ───────────────────────────────────── */}
      {tab === 'manual' && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className={`text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Theo dõi các refund cần xử lý thủ công. Liên hệ Admin để tiến hành xác nhận chuyển tiền.
            </p>
            <button
              type="button"
              onClick={() => void loadManualRefunds()}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition ${
                isLightMode
                  ? 'border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600'
                  : 'border-gray-700 text-gray-300 hover:border-blue-500 hover:text-white'
              }`}
            >
              <FaSyncAlt />
              Làm Mới
            </button>
          </div>

          {manualLoading ? (
            <StatePanel
              type="loading"
              title="Đang tải manual refund"
              description="Đang lấy danh sách hoàn tiền thủ công..."
              isLightMode={isLightMode}
            />
          ) : manualError ? (
            <StatePanel type="error" title="Lỗi tải dữ liệu" description={manualError} isLightMode={isLightMode} />
          ) : manualList.length === 0 ? (
            <div className={`${panelClass(isLightMode)} flex flex-col items-center justify-center gap-3 py-16`}>
              <FaCheckCircle className={`h-12 w-12 ${isLightMode ? 'text-emerald-600' : 'text-emerald-500'} opacity-40`} />
              <p className={`font-bold ${isLightMode ? 'text-slate-600' : 'text-gray-300'}`}>
                Không có refund thủ công đang chờ
              </p>
              <p className={`text-xs ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Tất cả refund đã được xử lý hoặc chưa có yêu cầu mới.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {manualList.map((item) => (
                <div key={item.refundId} className={`${panelClass(isLightMode)} flex flex-col gap-0 overflow-hidden`}>
                  {/* Card Header */}
                  <div
                    className={`flex items-start justify-between border-b px-4 py-3 ${
                      isLightMode ? 'border-slate-200 bg-slate-50' : 'border-gray-800 bg-[#0D1637]/60'
                    }`}
                  >
                    <div>
                      <p className={`font-mono text-xs font-bold ${isLightMode ? 'text-blue-700' : 'text-blue-400'}`}>
                        {item.bookingId}
                      </p>
                      <p className={`font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>
                        {item.movieTitle}
                      </p>
                    </div>
                    <StatusBadge status={item.refundStatus} />
                  </div>

                  {/* Body */}
                  <div className="flex flex-col gap-3 p-4">
                    {/* Amount */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-gray-400'}`}>Số Tiền Hoàn</span>
                      <span className={`text-lg font-black ${isLightMode ? 'text-emerald-700' : 'text-emerald-400'}`}>
                        {formatCurrency(item.refundAmount)}
                      </span>
                    </div>

                    {/* Bank info */}
                    {item.bankCode && (
                      <div
                        className={`rounded-xl border p-3 ${
                          isLightMode ? 'border-slate-200 bg-slate-50' : 'border-gray-800 bg-[#0A0A14]/60'
                        }`}
                      >
                        <div className={`mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          <FaUniversity />
                          Ngân Hàng Nhận
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className={isLightMode ? 'text-slate-400' : 'text-gray-500'}>Ngân hàng</p>
                            <p className={`font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{item.bankCode}</p>
                          </div>
                          {item.maskedAccountNumber && (
                            <div>
                              <p className={isLightMode ? 'text-slate-400' : 'text-gray-500'}>Số TK (ẩn)</p>
                              <p className={`font-mono font-bold ${isLightMode ? 'text-blue-700' : 'text-blue-300'}`}>
                                {item.maskedAccountNumber}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Cinema */}
                    {item.cinemaName && (
                      <div className={`flex items-center gap-1.5 text-xs ${isLightMode ? 'text-slate-500' : 'text-gray-400'}`}>
                        <FaBuilding />
                        {item.cinemaName}
                      </div>
                    )}

                    {/* Date */}
                    <div className={`text-xs ${isLightMode ? 'text-slate-400' : 'text-gray-500'}`}>
                      Yêu cầu lúc: {formatDateTime(item.requestedAt)}
                    </div>

                    {/* Read-only note */}
                    <div
                      className={`rounded-lg border px-3 py-2 text-xs ${
                        isLightMode
                          ? 'border-orange-200 bg-orange-50 text-orange-700'
                          : 'border-orange-500/20 bg-orange-500/5 text-orange-400'
                      }`}
                    >
                      <FaExclamationTriangle className="mr-1 inline text-[10px]" />
                      Admin đang xử lý. Bạn không thể thao tác ở đây.
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </PageShell>
  );
};

export default ManagerRefundsPage;
