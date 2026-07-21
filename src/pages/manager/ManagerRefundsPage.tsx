import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FaSyncAlt } from 'react-icons/fa';
import type { ManagerOutletContext } from '../../layouts/manager/ManagerLayout';
import { managerService, type RefundItem } from '../../services/managerService';
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  getApiErrorMessage,
  getApiStatus,
  inputClass,
  PageShell,
  panelClass,
  StatePanel,
  StatusBadge,
} from './managerUi';

const refundStatuses = ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'MANUAL_REQUIRED'];

const ManagerRefundsPage = () => {
  const { isLightMode } = useOutletContext<ManagerOutletContext>();
  const [status, setStatus] = useState('PENDING');
  const [refunds, setRefunds] = useState<RefundItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isForbidden, setIsForbidden] = useState(false);

  const loadRefunds = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      setIsForbidden(false);
      const data = await managerService.getRefunds(status, 1, 30);
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
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialRefunds = async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        setIsForbidden(false);
        const data = await managerService.getRefunds(status, 1, 30);

        if (!isMounted) {
          return;
        }

        setRefunds(data.items ?? []);
        setTotalCount(data.totalCount ?? data.items?.length ?? 0);
      } catch (error) {
        if (isMounted) {
          setIsForbidden(getApiStatus(error) === 403);
          setErrorMessage(getApiErrorMessage(error, 'Không tải được danh sách hoàn tiền.'));
          setRefunds([]);
          setTotalCount(0);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadInitialRefunds();

    return () => {
      isMounted = false;
    };
  }, [status]);

  return (
    <PageShell
      eyebrow="Refund operations"
      title="Theo dõi hoàn tiền"
          description="Theo dõi các refund phát sinh từ nghiệp vụ hủy suất chiếu trong phạm vi rạp backend đã gắn cho tài khoản Manager."
      isLightMode={isLightMode}
      action={<StatusBadge status={`${formatNumber(totalCount)} records`} />}
    >
      <section className={`${panelClass(isLightMode)} grid gap-3 p-4 md:grid-cols-[240px_auto] md:items-end`}>
        <label className="grid gap-2">
          <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Trạng thái refund
          </span>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass(isLightMode)}>
            {refundStatuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void loadRefunds()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-500 md:w-fit"
        >
          <FaSyncAlt />
          Làm mới
        </button>
      </section>

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
      ) : refunds.length === 0 ? (
        <StatePanel
          title="Không có refund phù hợp"
          description="Không có dữ liệu hoàn tiền trong trạng thái đang chọn."
          isLightMode={isLightMode}
        />
      ) : (
        <section className={panelClass(isLightMode)}>
          <div className={`grid border-b px-5 py-4 text-xs font-black uppercase ${isLightMode ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-400'} lg:grid-cols-[minmax(0,1.3fr)_160px_150px_170px_150px]`}>
            <span>Booking / phim</span>
            <span>Số tiền</span>
            <span>Trạng thái</span>
            <span>Workflow</span>
            <span>Ngày yêu cầu</span>
          </div>
          <div className={`divide-y ${isLightMode ? 'divide-slate-200' : 'divide-white/10'}`}>
            {refunds.map((refund) => (
              <article
                key={refund.refundId || refund.bookingId}
                className={`grid gap-3 px-5 py-4 text-sm lg:grid-cols-[minmax(0,1.3fr)_160px_150px_170px_150px] lg:items-center ${
                  isLightMode ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="min-w-0">
                  <p className={`truncate font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
                    {refund.bookingId}
                  </p>
                  <p className={`mt-1 truncate text-xs font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {refund.movieTitle}
                  </p>
                </div>
                <span className="font-black">{formatCurrency(refund.refundAmount)}</span>
                <StatusBadge status={refund.refundStatus} />
                <StatusBadge status={refund.workflowStatus || refund.bookingStatus} />
                <span>{formatDateTime(refund.requestedAt)}</span>
              </article>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
};

export default ManagerRefundsPage;
