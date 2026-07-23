/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from 'react';
import { FaExclamationTriangle, FaInfoCircle, FaSpinner } from 'react-icons/fa';

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value || 0);

export const formatNumber = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(value || 0);

export const formatPercent = (value: number) =>
  `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value || 0)}%`;

export const formatDateTime = (value?: string) => {
  if (!value) {
    return '-';
  }

  const clean = value.replace(/(?:z|[+-]\d{2}:\d{2})$/i, "");
  const [datePart, timePart = ""] = clean.includes("T")
    ? clean.split("T")
    : clean.split(" ");
  const [year, month, date] = datePart ? datePart.split("-") : [];
  const shortTime = timePart ? timePart.substring(0, 5) : "";

  if (year && month && date && shortTime) {
    return `${shortTime} ${date}/${month}/${year}`;
  }

  const d = new Date(clean);
  if (Number.isNaN(d.getTime())) {
    return value;
  }

  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const toDateInputValue = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = error as {
      response?: {
        status?: number;
        data?: { message?: string; errorCode?: string };
      };
    };

    if (response.response?.status === 401) {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }

    if (response.response?.status === 403) {
      if (response.response.data?.errorCode === 'STAFF_PROFILE_SCOPE_NOT_FOUND') {
        return 'Tài khoản Manager/Staff chưa có hồ sơ nhân sự ACTIVE gắn với rạp. Vui lòng tạo hoặc cập nhật STAFF_PROFILE cho tài khoản này.';
      }

      if (response.response.data?.errorCode === 'CINEMA_SCOPE_FORBIDDEN') {
        return 'Dữ liệu này không thuộc rạp đang được gắn với tài khoản Manager/Staff.';
      }

      return 'Bạn không có quyền thao tác với dữ liệu của rạp này.';
    }

    if (response.response?.status === 404) {
      return 'Không tìm thấy dữ liệu hoặc dữ liệu không thuộc rạp của bạn.';
    }

    return response.response?.data?.message || fallback;
  }

  return error instanceof Error ? error.message : fallback;
};

export const getApiStatus = (error: unknown) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = error as { response?: { status?: number } };
    return response.response?.status;
  }

  return undefined;
};

export const PageShell = ({
  eyebrow,
  title,
  description,
  isLightMode,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  isLightMode: boolean;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <div
    className={[
      'min-h-full p-4 transition-colors sm:p-6',
      isLightMode ? 'bg-[#F6F8FB] text-slate-950' : 'bg-[#07111E] text-white',
    ].join(' ')}
    style={{
      backgroundImage: isLightMode
        ? 'linear-gradient(135deg, rgba(241,245,249,0.92), rgba(248,250,252,0.98)), repeating-linear-gradient(90deg, rgba(15,23,42,0.035) 0 1px, transparent 1px 72px)'
        : 'linear-gradient(135deg, rgba(7,17,30,0.98), rgba(11,18,32,0.96)), repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 72px)',
    }}
  >
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase text-emerald-500">{eyebrow}</p>
          <h1 className={`mt-3 text-3xl font-black leading-tight lg:text-4xl ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
            {title}
          </h1>
          <p className={`mt-3 max-w-3xl text-sm leading-6 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {description}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {children}
    </div>
  </div>
);

export const panelClass = (isLightMode: boolean) =>
  [
    'rounded-lg border shadow-xl transition-colors',
    isLightMode
      ? 'border-slate-200 bg-white shadow-slate-200/70'
      : 'border-white/10 bg-[#101826] shadow-black/20',
  ].join(' ');

export const inputClass = (isLightMode: boolean) =>
  [
    'h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-bold outline-none transition focus:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400/70',
    isLightMode
      ? 'border-slate-200 bg-white text-slate-950'
      : 'border-white/10 bg-[#0B1220] text-white',
  ].join(' ');

export const StatusBadge = ({ status }: { status: string }) => {
  const normalized = status?.toUpperCase() || 'UNKNOWN';
  const className =
    normalized === 'OPEN' || normalized === 'SUCCESS' || normalized === 'PAID'
      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
      : normalized === 'CANCELLED' || normalized === 'FAILED' || normalized === 'REFUNDED'
        ? 'border-rose-400/30 bg-rose-500/10 text-rose-300'
        : normalized === 'COMPLETED'
          ? 'border-slate-400/30 bg-slate-500/10 text-slate-300'
          : normalized === 'PROCESSING' || normalized === 'PROCESSING_UNSTABLE' || normalized === 'PENDING'
            ? 'border-amber-400/30 bg-amber-500/10 text-amber-300'
            : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-300';

  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-3 text-xs font-black uppercase ${className}`}>
      {normalized}
    </span>
  );
};

export const StatePanel = ({
  type = 'empty',
  title,
  description,
  isLightMode,
}: {
  type?: 'loading' | 'empty' | 'error';
  title: string;
  description: string;
  isLightMode: boolean;
}) => {
  const icon =
    type === 'loading' ? (
      <FaSpinner className="animate-spin" />
    ) : type === 'error' ? (
      <FaExclamationTriangle />
    ) : (
      <FaInfoCircle />
    );

  return (
    <div className={`${panelClass(isLightMode)} flex flex-col items-center justify-center px-5 py-12 text-center`}>
      <span
        className={[
          'grid h-12 w-12 place-items-center rounded-lg',
          type === 'error'
            ? 'bg-rose-500/10 text-rose-300'
            : isLightMode
              ? 'bg-slate-100 text-slate-500'
              : 'bg-white/10 text-slate-300',
        ].join(' ')}
      >
        {icon}
      </span>
      <p className={`mt-4 text-sm font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>
        {title}
      </p>
      <p className={`mt-2 max-w-md text-sm leading-6 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
        {description}
      </p>
    </div>
  );
};
