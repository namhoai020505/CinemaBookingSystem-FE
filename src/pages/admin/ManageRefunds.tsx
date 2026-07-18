import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  FaCheckCircle,
  FaClipboard,
  FaCloudUploadAlt,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaHandshake,
  FaImage,
  FaMoneyBillWave,
  FaRedoAlt,
  FaSearch,
  FaSyncAlt,
  FaTimes,
  FaTimesCircle,
  FaUniversity,
  FaUserCheck,
} from 'react-icons/fa';
import { useOutletContext } from 'react-router-dom';
import type { AdminOutletContext } from '../../layouts/admin/AdminLayout';
import {
  adminRefundService,
  type AdminRefundItem,
  type ManualRefundItem,
  type ManualConfirmPayload,
} from '../../services/adminRefundService';

// ─── imgBB upload util ────────────────────────────────────────────────────────

const IMGBB_KEY = import.meta.env.VITE_IMGBB_API_KEY as string | undefined;

async function uploadToImgBB(file: File): Promise<string> {
  if (!IMGBB_KEY) {
    throw new Error('VITE_IMGBB_API_KEY chưa được cấu hình trong file .env');
  }
  const body = new FormData();
  body.append('key', IMGBB_KEY);
  body.append('image', file);

  const res = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body,
  });
  if (!res.ok) {
    throw new Error(`imgBB upload lỗi: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { success: boolean; data?: { url: string } };
  if (!json.success || !json.data?.url) {
    throw new Error('imgBB không trả về URL hợp lệ');
  }
  return json.data.url;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  MANUALREQUIRED: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  SUCCESS: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  FAILED: 'bg-red-500/10 text-red-400 border-red-500/20',
  OPEN: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  INPROGRESS: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  CONFIRMED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const StatusBadge = ({ status }: { status: string }) => {
  const key = status.toUpperCase().replace(/[_\s]/g, '');
  const cls = STATUS_COLORS[key] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
};

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

// ─── File Upload Preview Component ───────────────────────────────────────────

interface FileUploadZoneProps {
  onFileSelected: (file: File, preview: string) => void;
  onClear: () => void;
  preview: string | null;
  uploading: boolean;
}

function FileUploadZone({ onFileSelected, onClear, preview, uploading }: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ hỗ trợ file ảnh (PNG, JPG, WEBP...)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File quá lớn, tối đa 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      onFileSelected(file, e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // Uploaded or selected — show preview
  if (preview) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-[#0A0A14]/60">
        <img
          src={preview}
          alt="Bằng chứng"
          className="max-h-48 w-full object-contain p-2"
        />
        <div className="flex items-center justify-between border-t border-gray-800 bg-emerald-950/20 px-3 py-2">
          {uploading ? (
            <span className="flex items-center gap-2 text-xs text-emerald-400">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-b-2 border-t-2 border-emerald-400" />
              Đang upload lên imgBB...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <FaCheckCircle />
              Ảnh đã được chọn
            </span>
          )}
          <button
            type="button"
            onClick={onClear}
            disabled={uploading}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
          >
            <FaTimesCircle />
            Xóa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 transition ${
        dragging
          ? 'border-blue-400 bg-blue-500/10'
          : 'border-gray-700 bg-[#0A0A14]/40 hover:border-blue-500/50 hover:bg-blue-500/5'
      }`}
    >
      <FaCloudUploadAlt className={`h-8 w-8 ${dragging ? 'text-blue-400' : 'text-gray-500'}`} />
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-300">
          Kéo thả hoặc <span className="text-blue-400 underline">bấm để chọn ảnh</span>
        </p>
        <p className="mt-1 text-[11px] text-gray-500">PNG, JPG, WEBP — tối đa 10MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  item: ManualRefundItem;
  onClose: () => void;
  onConfirmed: () => void;
}

function ConfirmModal({ item, onClose, onConfirmed }: ConfirmModalProps) {
  const [txCode, setTxCode] = useState('');
  const [note, setNote] = useState('');

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Overall submission
  const [submitting, setSubmitting] = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Auto-upload when file is selected
  const handleFileSelected = async (file: File, preview: string) => {
    setSelectedFile(file);
    setPreviewUrl(preview);
    setUploadedUrl(null);
    setUploadError('');

    try {
      setUploading(true);
      const url = await uploadToImgBB(file);
      setUploadedUrl(url);
      toast.success('Upload ảnh thành công!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload ảnh thất bại';
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadedUrl(null);
    setUploadError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!txCode.trim()) {
      toast.error('Vui lòng nhập mã giao dịch ngân hàng');
      return;
    }
    if (!uploadedUrl) {
      if (uploading) {
        toast.info('Vui lòng chờ ảnh upload xong...');
      } else {
        toast.error('Vui lòng upload ảnh bằng chứng chuyển tiền');
      }
      return;
    }

    const payload: ManualConfirmPayload = {
      bankTransactionCode: txCode.trim(),
      transferredAmount: item.refundAmount,
      proofUrl: uploadedUrl,
      note: note.trim() || undefined,
    };

    try {
      setSubmitting(true);
      const res = await adminRefundService.confirmManualRefund(item.refundId, payload);
      if ((res as Record<string, unknown>)?.success === false) {
        toast.error(((res as Record<string, unknown>)?.message as string) ?? 'Xác nhận hoàn tiền thất bại');
      } else {
        toast.success('Đã xác nhận hoàn tiền! Email thông báo sẽ được gửi đến khách hàng.');
        onConfirmed();
      }
    } catch (err: unknown) {
      const message =
        ((err as { response?: { data?: { message?: string } } })?.response?.data?.message) ??
        'Lỗi khi xác nhận hoàn tiền';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const isReady = !!uploadedUrl && !uploading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-800 bg-[#111C44] shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-800 bg-blue-950/30 px-6 py-4">
          <div className="flex items-center gap-2">
            <FaHandshake className="text-emerald-400" />
            <h2 className="font-black uppercase tracking-wide text-white">Xác Nhận Đã Chuyển Tiền</h2>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 transition hover:text-white">
            <FaTimes />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Info Summary */}
          <div className="border-b border-gray-800 bg-[#0D1637]/60 px-6 py-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500">Phim</p>
                <p className="mt-0.5 font-semibold text-white">{item.movieTitle}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500">Rạp</p>
                <p className="mt-0.5 font-semibold text-white">{item.cinemaName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500">Số Tiền Hoàn</p>
                <p className="mt-0.5 text-xl font-black text-emerald-400">
                  {formatCurrency(item.refundAmount)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500">Ngân Hàng</p>
                <p className="mt-0.5 font-semibold text-white">
                  {item.bankName} <span className="text-gray-400">({item.bankCode})</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500">Số Tài Khoản</p>
                <p className="mt-0.5 font-mono font-black text-blue-300">{item.accountNumber}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-500">Tên Chủ TK</p>
                <p className="mt-0.5 font-semibold uppercase text-white">{item.accountHolderName}</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form id="confirm-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-5 px-6 py-5">
            {/* Transaction Code */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-gray-400">
                Mã Giao Dịch Ngân Hàng <span className="text-red-400">*</span>
              </label>
              <input
                ref={firstInputRef}
                type="text"
                required
                placeholder="VD: MBBANK20240716123456"
                value={txCode}
                onChange={(e) => setTxCode(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-gray-700 bg-[#0F172A] px-4 py-2.5 font-mono text-sm uppercase text-white outline-none placeholder:normal-case placeholder:text-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
              <p className="mt-1 text-[10px] text-gray-600">Mã này phải duy nhất, không được dùng lại cho giao dịch khác.</p>
            </div>

            {/* Transferred Amount — locked */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-gray-400">
                Số Tiền Đã Chuyển
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-gray-700 bg-[#0F172A]/60 px-4 py-2.5">
                <span className="flex-1 font-mono text-sm font-black text-emerald-400">
                  {formatCurrency(item.refundAmount)}
                </span>
                <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gray-500">
                  Cố định
                </span>
              </div>
              <p className="mt-1 text-[10px] text-gray-600">
                Backend yêu cầu số tiền phải khớp chính xác — không thể thay đổi.
              </p>
            </div>

            {/* File Upload */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-gray-400">
                <FaImage />
                Ảnh Bằng Chứng Chuyển Tiền <span className="text-red-400">*</span>
              </label>

              <FileUploadZone
                onFileSelected={(file, preview) => void handleFileSelected(file, preview)}
                onClear={handleClearFile}
                preview={previewUrl}
                uploading={uploading}
              />

              {/* Upload error */}
              {uploadError && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
                  <FaExclamationTriangle />
                  {uploadError}
                </div>
              )}

              {/* Success with URL preview */}
              {uploadedUrl && !uploadError && (
                <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <FaCheckCircle />
                    Đã upload thành công
                  </span>
                  <a
                    href={uploadedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                  >
                    <FaExternalLinkAlt className="text-[10px]" />
                    Xem ảnh
                  </a>
                </div>
              )}

              {!IMGBB_KEY && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">
                  <FaExclamationTriangle className="mt-0.5 shrink-0" />
                  <span>
                    <strong>VITE_IMGBB_API_KEY</strong> chưa được cấu hình trong file <code>.env</code>.
                    Lấy key miễn phí tại{' '}
                    <a
                      href="https://api.imgbb.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      api.imgbb.com
                    </a>
                  </span>
                </div>
              )}
            </div>

            {/* Note */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-gray-400">
                Ghi Chú Nội Bộ <span className="text-gray-600">(tùy chọn)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Ghi chú thêm nếu cần..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full resize-none rounded-xl border border-gray-700 bg-[#0F172A] px-4 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between border-t border-gray-800 bg-[#0D1637]/40 px-6 py-4">
          {/* Status indicator */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {uploading && (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-b-2 border-t-2 border-blue-400" />
                <span>Đang upload ảnh...</span>
              </>
            )}
            {isReady && !submitting && (
              <>
                <FaCheckCircle className="text-emerald-400" />
                <span className="text-emerald-400">Sẵn sàng xác nhận</span>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-gray-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="confirm-form"
              disabled={submitting || uploading || !isReady}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-900/30 hover:brightness-110 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-b-2 border-t-2 border-white" />
                  Đang xác nhận...
                </>
              ) : (
                <>
                  <FaCheckCircle />
                  Xác Nhận Đã Chuyển Tiền
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManageRefunds() {
  const { isLightMode } = useOutletContext<AdminOutletContext>();

  const [tab, setTab] = useState<Tab>('all');

  // All Refunds
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [allRefunds, setAllRefunds] = useState<AdminRefundItem[]>([]);
  const [allLoading, setAllLoading] = useState(true);
  const [allError, setAllError] = useState('');

  // Manual Queue
  const [manualList, setManualList] = useState<ManualRefundItem[]>([]);
  const [manualLoading, setManualLoading] = useState(true);
  const [manualError, setManualError] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [confirmingItem, setConfirmingItem] = useState<ManualRefundItem | null>(null);

  // ── Fetchers ────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      setAllLoading(true);
      setAllError('');
      const data = await adminRefundService.getAdminRefunds(statusFilter, 1, 50);
      setAllRefunds(data.items ?? []);
    } catch (err: unknown) {
      setAllError(
        ((err as { response?: { data?: { message?: string } } })?.response?.data?.message) ??
          'Không tải được danh sách hoàn tiền',
      );
    } finally {
      setAllLoading(false);
    }
  }, [statusFilter]);

  const fetchManual = useCallback(async () => {
    try {
      setManualLoading(true);
      setManualError('');
      const data = await adminRefundService.getManualRefunds();
      setManualList(data);
    } catch (err: unknown) {
      setManualError(
        ((err as { response?: { data?: { message?: string } } })?.response?.data?.message) ??
          'Không tải được manual refund queue',
      );
    } finally {
      setManualLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);
  useEffect(() => { if (tab === 'manual') void fetchManual(); }, [tab, fetchManual]);

  // ── Assign ──────────────────────────────────────────────────────────────────
  const handleAssign = async (refundId: string) => {
    try {
      setAssigningId(refundId);
      const res = await adminRefundService.assignManualRefund(refundId);
      if ((res as Record<string, unknown>)?.success === false) {
        toast.error(((res as Record<string, unknown>)?.message as string) ?? 'Không thể nhận refund này');
      } else {
        toast.success('Đã nhận refund. Hãy thực hiện chuyển tiền thực tế rồi bấm Confirm.');
        await fetchManual();
      }
    } catch (err: unknown) {
      toast.error(
        ((err as { response?: { data?: { message?: string } } })?.response?.data?.message) ??
          'Lỗi khi assign refund',
      );
    } finally {
      setAssigningId(null);
    }
  };

  // ── Auto Confirm ────────────────────────────────────────────────────────────
  const handleAutoConfirm = async (bookingId: string) => {
    if (!window.confirm('Xác nhận hoàn tiền tự động cho booking này?')) return;
    try {
      const res = await adminRefundService.confirmAutoRefund(bookingId);
      if ((res as Record<string, unknown>)?.success === false) {
        toast.error(((res as Record<string, unknown>)?.message as string) ?? 'Xác nhận thất bại');
      } else {
        toast.success('Đã xác nhận hoàn tiền tự động');
        await fetchAll();
      }
    } catch (err: unknown) {
      toast.error(
        ((err as { response?: { data?: { message?: string } } })?.response?.data?.message) ?? 'Lỗi khi xác nhận',
      );
    }
  };

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filteredAll = allRefunds.filter((r) => {
    const q = search.toLowerCase();
    return (
      !q ||
      r.bookingId?.toLowerCase().includes(q) ||
      r.movieName?.toLowerCase().includes(q) ||
      r.customerName?.toLowerCase().includes(q) ||
      r.customerEmail?.toLowerCase().includes(q)
    );
  });

  // ── UI Classes ──────────────────────────────────────────────────────────────
  const bg = isLightMode ? 'bg-slate-100 text-slate-950' : 'bg-[#07090F] text-white';
  const panel = isLightMode
    ? 'rounded-2xl border border-slate-200 bg-white shadow'
    : 'rounded-2xl border border-gray-800 bg-[#111C44] shadow-2xl';

  const input = isLightMode
    ? 'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-400 w-full transition'
    : 'rounded-xl border border-gray-700 bg-[#0F172A] px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500 w-full transition';

  const openCount = manualList.filter((m) => m.processStatus?.toUpperCase().replace(/[_\s]/g, '') === 'OPEN').length;
  const inProgressCount = manualList.filter((m) => m.processStatus?.toUpperCase().replace(/[_\s]/g, '') === 'INPROGRESS').length;

  return (
    <div className={`min-h-screen p-6 font-['Urbanist'] ${bg}`}>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/30">
            <FaMoneyBillWave />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Quản Lý Hoàn Tiền</h1>
            <p className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-gray-400'}`}>
              Xem danh sách và xử lý các yêu cầu hoàn tiền — tự động và thủ công
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={`mb-6 flex w-fit gap-1 rounded-xl border p-1 ${isLightMode ? 'border-slate-200 bg-slate-100' : 'border-gray-800 bg-[#0D1637]/50'}`}>
        {([
          { id: 'all' as Tab, label: 'Tất Cả Refund', icon: <FaClipboard /> },
          {
            id: 'manual' as Tab,
            label: `Xử Lý Thủ Công${inProgressCount > 0 ? ` (${inProgressCount})` : openCount > 0 ? ` (${openCount})` : ''}`,
            icon: <FaHandshake />,
          },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition ${
              tab === t.id
                ? 'bg-blue-600 text-white shadow'
                : isLightMode
                ? 'text-slate-500 hover:text-slate-900'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: All Refunds ─────────────────────────────────────────────────── */}
      {tab === 'all' && (
        <>
          <div className={`${panel} mb-6 grid gap-4 p-4 md:grid-cols-[200px_1fr_auto]`}>
            <label className="grid gap-1.5">
              <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Trạng Thái</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={input}>
                {ALL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Tìm Kiếm</span>
              <div className="relative">
                <FaSearch className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs ${isLightMode ? 'text-slate-400' : 'text-gray-500'}`} />
                <input
                  type="text"
                  placeholder="Booking ID, phim, email khách..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={input + ' pl-9'}
                />
              </div>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void fetchAll()}
                className="flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-500 transition"
              >
                <FaSyncAlt />
                Làm Mới
              </button>
            </div>
          </div>

          <div className={panel}>
            {allLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <span className={`h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 ${isLightMode ? 'border-blue-500' : 'border-blue-400'}`} />
                <p className={isLightMode ? 'text-slate-500' : 'text-gray-400'}>Đang tải...</p>
              </div>
            ) : allError ? (
              <div className="flex flex-col items-center gap-2 py-16 text-red-400">
                <FaExclamationTriangle className="h-8 w-8 opacity-60" />
                <p>{allError}</p>
              </div>
            ) : filteredAll.length === 0 ? (
              <div className={`flex flex-col items-center gap-2 py-16 ${isLightMode ? 'text-slate-400' : 'text-gray-500'}`}>
                <FaMoneyBillWave className="h-10 w-10 opacity-30" />
                <p>Không có refund phù hợp</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className={`border-b text-[11px] font-black uppercase tracking-wide ${isLightMode ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-gray-800 bg-blue-950/20 text-slate-400'}`}>
                      <th className="p-4">Booking / Phim</th>
                      <th className="p-4">Khách Hàng</th>
                      <th className="p-4 text-right">Số Tiền</th>
                      <th className="p-4 text-center">Refund</th>
                      <th className="p-4 text-center">Booking</th>
                      <th className="p-4">Yêu Cầu</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isLightMode ? 'divide-slate-100' : 'divide-gray-800/60'}`}>
                    {filteredAll.map((r) => (
                      <tr key={r.refundId || r.bookingId} className={`transition ${isLightMode ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`}>
                        <td className="p-4">
                          <p className={`font-mono text-xs font-bold ${isLightMode ? 'text-blue-700' : 'text-blue-400'}`}>{r.bookingId}</p>
                          <p className={`font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{r.movieName}</p>
                          <p className={`text-[11px] ${isLightMode ? 'text-slate-400' : 'text-gray-500'}`}>{r.roomName}</p>
                        </td>
                        <td className="p-4">
                          <p className={`font-semibold ${isLightMode ? 'text-slate-800' : 'text-gray-200'}`}>{r.customerName ?? '—'}</p>
                          <p className={`text-[11px] ${isLightMode ? 'text-slate-400' : 'text-gray-500'}`}>{r.customerEmail ?? ''}</p>
                          <p className={`text-[11px] ${isLightMode ? 'text-slate-400' : 'text-gray-500'}`}>{r.customerPhone ?? ''}</p>
                        </td>
                        <td className="p-4 text-right font-black text-emerald-500">{formatCurrency(r.totalAmount)}</td>
                        <td className="p-4 text-center"><StatusBadge status={r.refundStatus} /></td>
                        <td className="p-4 text-center"><StatusBadge status={r.bookingStatus} /></td>
                        <td className={`p-4 text-xs ${isLightMode ? 'text-slate-500' : 'text-gray-400'}`}>{formatDate(r.requestedAt)}</td>
                        <td className="p-4 text-center">
                          {r.refundStatus === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => void handleAutoConfirm(r.bookingId)}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                                isLightMode
                                  ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                  : 'border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                              }`}
                            >
                              <FaRedoAlt className="text-[10px]" />
                              Confirm
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Tab: Manual Queue ────────────────────────────────────────────────── */}
      {tab === 'manual' && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className={`text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Mỗi thẻ là một yêu cầu hoàn tiền thủ công. Hãy{' '}
              <strong className={isLightMode ? 'text-slate-800' : 'text-white'}>Nhận</strong> rồi{' '}
              <strong className={isLightMode ? 'text-slate-800' : 'text-white'}>upload ảnh bằng chứng</strong> sau khi chuyển tiền thực tế.
            </p>
            <button
              type="button"
              onClick={() => void fetchManual()}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition ${
                isLightMode
                  ? 'border-slate-300 text-slate-600 hover:border-blue-400'
                  : 'border-gray-700 text-gray-300 hover:border-blue-500 hover:text-white'
              }`}
            >
              <FaSyncAlt />
              Làm Mới
            </button>
          </div>

          {manualLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <span className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-blue-500" />
              <p className={isLightMode ? 'text-slate-500' : 'text-gray-400'}>Đang tải manual queue...</p>
            </div>
          ) : manualError ? (
            <div className={`${panel} flex flex-col items-center gap-2 py-16 text-red-400`}>
              <FaExclamationTriangle className="h-8 w-8 opacity-60" />
              <p>{manualError}</p>
            </div>
          ) : manualList.length === 0 ? (
            <div className={`${panel} flex flex-col items-center gap-3 py-20`}>
              <FaCheckCircle className="h-12 w-12 text-emerald-500 opacity-40" />
              <p className={`font-bold ${isLightMode ? 'text-slate-600' : 'text-gray-300'}`}>
                Không có refund nào cần xử lý thủ công
              </p>
              <p className={`text-xs ${isLightMode ? 'text-slate-400' : 'text-gray-500'}`}>
                Mọi yêu cầu đã được xử lý hoặc chưa có yêu cầu mới.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {manualList.map((item) => {
                const ps = item.processStatus?.toUpperCase().replace(/[_\s]/g, '');
                const isOpen = ps === 'OPEN';
                const isInProgress = ps === 'INPROGRESS';
                const isConfirmed = ps === 'CONFIRMED';

                return (
                  <div key={item.refundId} className={`${panel} flex flex-col overflow-hidden`}>
                    {/* Card Header */}
                    <div className={`flex items-start justify-between border-b px-4 py-3 ${isLightMode ? 'border-slate-200 bg-slate-50' : 'border-gray-800 bg-blue-950/20'}`}>
                      <div className="min-w-0 flex-1">
                        <p className={`font-mono text-xs font-bold ${isLightMode ? 'text-blue-700' : 'text-blue-400'}`}>{item.bookingId}</p>
                        <p className={`truncate font-black ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{item.movieTitle}</p>
                        <p className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-gray-400'}`}>{item.cinemaName}</p>
                      </div>
                      <div className="ml-2 shrink-0">
                        <StatusBadge status={item.processStatus} />
                      </div>
                    </div>

                    {/* Body */}
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      {/* Amount */}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${isLightMode ? 'text-slate-500' : 'text-gray-400'}`}>Số Tiền Hoàn</span>
                        <span className={`text-lg font-black ${isLightMode ? 'text-emerald-700' : 'text-emerald-400'}`}>
                          {formatCurrency(item.refundAmount)}
                        </span>
                      </div>

                      {/* Bank Info */}
                      <div className={`rounded-xl border p-3 ${isLightMode ? 'border-slate-200 bg-slate-50' : 'border-gray-800 bg-[#0A0A14]/60'}`}>
                        <div className={`mb-2 flex items-center gap-1 text-[10px] font-black uppercase ${isLightMode ? 'text-slate-400' : 'text-gray-500'}`}>
                          <FaUniversity />
                          Thông Tin Ngân Hàng
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className={isLightMode ? 'text-slate-400' : 'text-gray-500'}>Ngân hàng</p>
                            <p className={`font-bold ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{item.bankName || item.bankCode}</p>
                          </div>
                          <div>
                            <p className={isLightMode ? 'text-slate-400' : 'text-gray-500'}>Số TK</p>
                            <p className={`font-mono font-black ${isLightMode ? 'text-blue-700' : 'text-blue-300'}`}>{item.accountNumber}</p>
                          </div>
                          <div className="col-span-2">
                            <p className={isLightMode ? 'text-slate-400' : 'text-gray-500'}>Chủ Tài Khoản</p>
                            <p className={`font-bold uppercase ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{item.accountHolderName}</p>
                          </div>
                        </div>
                      </div>

                      {/* Dates */}
                      <div className={`text-xs ${isLightMode ? 'text-slate-400' : 'text-gray-500'}`}>
                        Yêu cầu: {formatDate(item.requestedAt)}
                      </div>

                      {/* Assigned */}
                      {item.assignedToUserId && (
                        <div className={`flex items-center gap-1.5 text-xs ${isLightMode ? 'text-indigo-600' : 'text-indigo-400'}`}>
                          <FaUserCheck />
                          <span className="truncate font-semibold">
                            Đang xử lý: {item.assignedToUserId.slice(0, 16)}...
                          </span>
                        </div>
                      )}

                      {/* Confirmed info */}
                      {isConfirmed && (
                        <div className={`rounded-lg border px-3 py-2 text-xs ${isLightMode ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'}`}>
                          <p className="font-bold">✓ Đã xác nhận thành công</p>
                          {item.bankTransactionCode && (
                            <p className="mt-0.5">Mã GD: <span className="font-mono">{item.bankTransactionCode}</span></p>
                          )}
                          {item.proofUrl && (
                            <a href={item.proofUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-blue-500 hover:text-blue-400">
                              <FaExternalLinkAlt className="text-[9px]" />
                              Xem ảnh bằng chứng
                            </a>
                          )}
                          {item.confirmedAt && (
                            <p className="mt-0.5 opacity-70">Lúc: {formatDate(item.confirmedAt)}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {!isConfirmed && (
                      <div className={`border-t px-4 py-3 ${isLightMode ? 'border-slate-200' : 'border-gray-800'}`}>
                        {isOpen && (
                          <button
                            type="button"
                            disabled={assigningId === item.refundId}
                            onClick={() => void handleAssign(item.refundId)}
                            className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-black uppercase text-white transition hover:bg-blue-500 active:scale-95 disabled:opacity-60"
                          >
                            {assigningId === item.refundId
                              ? 'Đang nhận...'
                              : '📋 Nhận Xử Lý (Assign)'}
                          </button>
                        )}
                        {isInProgress && (
                          <button
                            type="button"
                            onClick={() => setConfirmingItem(item)}
                            className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-2.5 text-xs font-black uppercase text-white shadow-lg shadow-emerald-900/20 transition hover:brightness-110 active:scale-95"
                          >
                            <FaCloudUploadAlt className="mr-1.5 inline" />
                            Upload Bằng Chứng & Xác Nhận
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Confirm Modal */}
      {confirmingItem && (
        <ConfirmModal
          item={confirmingItem}
          onClose={() => setConfirmingItem(null)}
          onConfirmed={() => {
            setConfirmingItem(null);
            void fetchManual();
          }}
        />
      )}
    </div>
  );
}
