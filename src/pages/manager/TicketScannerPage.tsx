import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FaBarcode, FaCamera, FaCheckCircle, FaHistory, FaPrint, FaQrcode, FaStopCircle, FaTimesCircle, FaUtensils, FaUser, FaWifi } from 'react-icons/fa';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import type { ManagerOutletContext } from '../../layouts/manager/ManagerLayout';
import { managerService, type ScanTicketResponse } from '../../services/managerService';
import type { RoomResponse } from '../../services/roomService';
import { buildConfirmTicketScanRequest } from '../../services/scanTicketContract';
import { useTicketHub } from '../../hooks/useTicketHub';
import {
  formatDateTime,
  getApiErrorMessage,
  inputClass,
  PageShell,
  panelClass,
  StatePanel,
  StatusBadge,
} from './managerUi';

type ScanHistoryItem = {
  id: string;
  success: boolean;
  message: string;
  scannedAt: string;
  result?: ScanTicketResponse;
};

type CameraStatus = 'idle' | 'starting' | 'scanning' | 'unsupported' | 'denied' | 'error';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);

const TicketScannerPage = () => {
  const { isLightMode } = useOutletContext<ManagerOutletContext>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scanHandledRef = useRef(false);
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [scanLoading, setScanLoading] = useState(false);
  const [roomError, setRoomError] = useState('');
  const [scanError, setScanError] = useState('');
  const [lastScan, setLastScan] = useState<ScanTicketResponse | null>(null);
  const [localTicketModal, setLocalTicketModal] = useState<ScanTicketResponse | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);

  // ── SignalR: nhận vé từ Mobile ──────────────────────────────────────────────
  const { scannedTicket, clearScannedTicket, hubStatus } = useTicketHub();
  const ticketModal = localTicketModal ?? scannedTicket;
  const ticketModalConfirmed = ticketModal?.ticketStatus === 'CHECKED_IN';

  // Khi Mobile quét thành công → Backend → SignalR → hook → mở popup tự động
  const closeTicketModal = useCallback(() => {
    setLocalTicketModal(null);
    setConfirmError('');
    clearScannedTicket();
  }, [clearScannedTicket]);
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let isMounted = true;

    const loadRooms = async () => {
      try {
        setLoadingRooms(true);
        setRoomError('');
        const data = await managerService.getRooms();
        if (!isMounted) {
          return;
        }

        setRooms(data ?? []);
        setSelectedRoomId((current) => current || data?.[0]?.roomId || '');
      } catch (error) {
        if (isMounted) {
          setRoomError(getApiErrorMessage(error, 'Không tải được danh sách phòng.'));
        }
      } finally {
        if (isMounted) {
          setLoadingRooms(false);
        }
      }
    };

    void loadRooms();

    return () => {
      isMounted = false;
    };
  }, []);

  const stopCamera = useCallback((nextStatus: CameraStatus = 'idle') => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    scanHandledRef.current = false;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraStatus(nextStatus);
  }, []);

  const startCamera = async () => {
    setScanError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('unsupported');
      return;
    }

    if (!videoRef.current) {
      setCameraStatus('error');
      return;
    }

    try {
      setCameraStatus('starting');
      stopCamera('starting');
      scanHandledRef.current = false;

      const codeReader = new BrowserQRCodeReader();
      const controls = await codeReader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
          },
          audio: false,
        },
        videoRef.current,
        (result, _error, controlsFromCallback) => {
          const value = result?.getText().trim();

          if (!value || scanHandledRef.current) {
            return;
          }

          controlsFromCallback.stop();
          scannerControlsRef.current = null;
          setCameraStatus('idle');
          scanHandledRef.current = true;
          void scanTicketCode(value);
        },
      );

      scannerControlsRef.current = controls;
      setCameraStatus('scanning');
    } catch (error) {
      const permissionName = error instanceof DOMException ? error.name : '';
      setCameraStatus(permissionName === 'NotAllowedError' ? 'denied' : 'error');
    }
  };

  useEffect(() => () => {
    scannerControlsRef.current?.stop();
  }, []);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.roomId === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );

  const addHistory = (item: Omit<ScanHistoryItem, 'id' | 'scannedAt'>) => {
    setHistory((current) => [
      {
        ...item,
        id: crypto.randomUUID(),
        scannedAt: new Date().toISOString(),
      },
      ...current.slice(0, 7),
    ]);
  };

  const cameraMessage = {
    idle: 'Camera đang tắt. Có thể bật camera hoặc nhập mã thủ công.',
    starting: 'Đang xin quyền camera...',
    scanning: 'Đưa mã QR vào khung hình để tự xác nhận vé.',
    unsupported: 'Trình duyệt hiện tại chưa hỗ trợ quét QR bằng camera. Hãy dùng nhập mã thủ công.',
    denied: 'Camera bị từ chối quyền truy cập. Hãy cấp quyền camera hoặc nhập mã thủ công.',
    error: 'Không mở được camera trên thiết bị này. Hãy dùng nhập mã thủ công.',
  }[cameraStatus];

  async function scanTicketCode(rawQrCode: string) {
    setScanError('');
    setLastScan(null);

    if (!selectedRoomId) {
      setScanError('Vui lòng chọn phòng cần soát vé.');
      return;
    }

    const normalizedQrCode = rawQrCode.trim();
    if (!normalizedQrCode) {
      setScanError('Vui lòng nhập hoặc quét mã QR của vé.');
      return;
    }

    try {
      setScanLoading(true);
      const result = await managerService.previewTicket({
        roomId: selectedRoomId,
        qrCode: normalizedQrCode,
      });
      setLastScan(result);
      setLocalTicketModal(result);
      setQrCode('');
      addHistory({ success: true, message: 'Vé hợp lệ, đang chờ xác nhận', result });
    } catch (error) {
      const message = getApiErrorMessage(error, 'Không kiểm tra được vé. Kiểm tra lại mã hoặc phòng chiếu.');
      setQrCode(normalizedQrCode);
      setScanError(message);
      addHistory({ success: false, message });
    } finally {
      setScanLoading(false);
    }
  }

  const confirmTicket = async (ticket: ScanTicketResponse) => {
    if (confirmLoading || ticketModalConfirmed) {
      return;
    }

    try {
      setConfirmLoading(true);
      setConfirmError('');
      const result = await managerService.confirmTicket(buildConfirmTicketScanRequest(ticket));
      setLastScan(result);
      setLocalTicketModal(result);
      clearScannedTicket();
      addHistory({ success: true, message: 'Vé đã được xác nhận check-in', result });
    } catch (error) {
      const message = getApiErrorMessage(error, 'Không xác nhận được vé. Vui lòng kiểm tra lại trạng thái vé.');
      setConfirmError(message);
      addHistory({ success: false, message });
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await scanTicketCode(qrCode);
  };

  return (
    <PageShell
      eyebrow="Gate operations"
      title="Soát vé tại rạp"
      description="Chọn đúng phòng chiếu rồi quét QR hoặc nhập mã vé thủ công. Backend sẽ xác thực vé có thuộc phòng, suất chiếu và trạng thái hợp lệ hay không."
      isLightMode={isLightMode}
      action={
        <div className="flex items-center gap-2">
          {selectedRoom ? <StatusBadge status={selectedRoom.roomName} /> : null}
          {/* Badge trạng thái kết nối SignalR – nhỏ, không gây mất tập trung */}
          <span
            title={`SignalR: ${hubStatus}`}
            className={[
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors',
              hubStatus === 'connected'
                ? 'bg-emerald-500/15 text-emerald-400'
                : hubStatus === 'connecting' || hubStatus === 'reconnecting'
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-rose-500/15 text-rose-400',
            ].join(' ')}
          >
            <FaWifi className="text-[9px]" />
            {hubStatus === 'connected'
              ? 'Live'
              : hubStatus === 'connecting'
                ? 'Đang kết nối'
                : hubStatus === 'reconnecting'
                  ? 'Reconnecting'
                  : 'Offline'}
          </span>
        </div>
      }
    >
      {loadingRooms ? (
        <StatePanel type="loading" title="Đang tải phòng chiếu" description="Đang lấy danh sách phòng thuộc phạm vi rạp của bạn." isLightMode={isLightMode} />
      ) : roomError ? (
        <StatePanel type="error" title="Không tải được phòng" description={roomError} isLightMode={isLightMode} />
      ) : rooms.length === 0 ? (
        <StatePanel title="Chưa có phòng để soát vé" description="Tài khoản này chưa được backend trả về phòng chiếu nào trong phạm vi rạp." isLightMode={isLightMode} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <form onSubmit={handleSubmit} className={`${panelClass(isLightMode)} p-5`}>
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 text-white">
                <FaQrcode />
              </span>
              <div>
                <h2 className={`text-lg font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>Quét hoặc nhập mã vé</h2>
                <p className={`mt-1 text-sm leading-6 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Dữ liệu check-in sẽ được ghi nhận trực tiếp qua API /api/tickets/scan.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <div className={`rounded-lg border p-3 ${isLightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.03]'}`}>
                <div className="overflow-hidden rounded-lg bg-black">
                  <video
                    ref={videoRef}
                    className="aspect-video w-full object-cover"
                    muted
                    playsInline
                  />
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className={`text-sm font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {cameraMessage}
                  </p>
                  {cameraStatus === 'scanning' || cameraStatus === 'starting' ? (
                    <button
                      type="button"
                      onClick={() => stopCamera('idle')}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 text-xs font-black text-rose-200 transition hover:bg-rose-500/20 cursor-pointer"
                    >
                      <FaStopCircle />
                      Tắt camera
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 text-xs font-black text-cyan-200 transition hover:bg-cyan-500/20 cursor-pointer"
                    >
                      <FaCamera />
                      Bật camera
                    </button>
                  )}
                </div>
              </div>

              <label className="grid gap-2">
                <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Phòng chiếu</span>
                <select value={selectedRoomId} onChange={(event) => setSelectedRoomId(event.target.value)} className={inputClass(isLightMode)}>
                  {rooms.map((room) => (
                    <option key={room.roomId} value={room.roomId}>
                      {room.roomName} - {room.cinemaName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Mã QR / mã vé
                </span>
                <textarea
                  value={qrCode}
                  onChange={(event) => setQrCode(event.target.value)}
                  className={`${inputClass(isLightMode)} min-h-36 resize-y py-3 font-mono`}
                  placeholder="Dán dữ liệu QR hoặc nhập mã vé..."
                  autoFocus
                />
              </label>

              {scanError ? (
                <div className="flex items-start gap-3 rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm font-bold text-rose-200">
                  <FaTimesCircle className="mt-0.5 shrink-0" />
                  <span>{scanError}</span>
                </div>
              ) : null}

              {lastScan ? (
                <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  <div className="flex items-center gap-2 font-black">
                    <FaCheckCircle />
                    Vé hợp lệ
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <p><strong>Phim:</strong> {lastScan.movieTitle}</p>
                    <p><strong>Ghế:</strong> {lastScan.seatCodes.join(', ')}</p>
                    <p><strong>Phòng:</strong> {lastScan.roomName}</p>
                    <p><strong>Giờ chiếu:</strong> {formatDateTime(lastScan.showtimeStartTime)}</p>
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={scanLoading}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                <FaBarcode />
                {scanLoading ? 'Đang soát vé...' : 'Xác nhận soát vé'}
              </button>
            </div>
          </form>

          <section className={`${panelClass(isLightMode)} overflow-hidden`}>
            <div className={`flex items-center gap-3 border-b p-5 ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-cyan-500/10 text-cyan-300">
                <FaHistory />
              </span>
              <div>
                <h2 className={`font-black ${isLightMode ? 'text-slate-950' : 'text-white'}`}>Lịch sử phiên hiện tại</h2>
                <p className={`text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Chỉ lưu tạm trên trình duyệt.</p>
              </div>
            </div>
            {history.length === 0 ? (
              <div className={`p-5 text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Chưa có lượt soát vé trong phiên này.
              </div>
            ) : (
              <div className={`divide-y ${isLightMode ? 'divide-slate-200' : 'divide-white/10'}`}>
                {history.map((item) => (
                  <article key={item.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-sm font-black ${item.success ? 'text-emerald-400' : 'text-rose-300'}`}>
                        {item.success ? 'Thành công' : 'Từ chối'}
                      </span>
                      <span className={`text-xs font-semibold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        {formatDateTime(item.scannedAt)}
                      </span>
                    </div>
                    <p className={`mt-2 text-sm ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                      {item.result ? `${item.result.movieTitle} - ghế ${item.result.seatCodes.join(', ')}` : item.message}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      {ticketModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <section className={`max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl border shadow-2xl ${isLightMode ? 'border-slate-200 bg-white text-slate-950' : 'border-white/10 bg-slate-950 text-white'}`}>
            <div className={`flex items-start justify-between gap-4 border-b p-5 ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <FaCheckCircle />
                </span>
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    {ticketModalConfirmed ? 'Vé đã xác nhận' : 'Vé chờ xác nhận'}
                  </p>
                  <h2 className="mt-1 text-xl font-black">{ticketModal.movieTitle}</h2>
                  <p className={`mt-1 text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {formatDateTime(ticketModal.showtimeStartTime)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeTicketModal}
                className={`grid h-9 w-9 place-items-center rounded-lg border text-sm font-black transition ${isLightMode ? 'border-slate-200 text-slate-500 hover:bg-slate-100' : 'border-white/10 text-slate-300 hover:bg-white/10'}`}
                aria-label="Đóng popup"
              >
                ×
              </button>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              <div className={`rounded-lg border p-4 ${isLightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.03]'}`}>
                <div className="flex items-center gap-2 text-sm font-black uppercase text-cyan-300">
                  <FaUser />
                  Khách hàng
                </div>
                <p className="mt-3 text-lg font-black">{ticketModal.customerName || 'Chưa có thông tin khách'}</p>
                <p className={`mt-1 text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {ticketModal.customerPhone || 'Chưa có số điện thoại'}
                </p>
              </div>

              <div className={`rounded-lg border p-4 ${isLightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.03]'}`}>
                <div className="text-sm font-black uppercase text-cyan-300">Rạp / phòng</div>
                <p className="mt-3 text-base font-black">{ticketModal.cinemaName}</p>
                <p className={`mt-1 text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{ticketModal.roomName}</p>
              </div>

              <div className={`rounded-lg border p-4 ${isLightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.03]'}`}>
                <div className="text-sm font-black uppercase text-cyan-300">Ghế đã đặt</div>
                <p className="mt-3 text-lg font-black">
                  {ticketModal.seatCodes.join(', ')}
                </p>
              </div>

              <div className={`rounded-lg border p-4 ${isLightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.03]'}`}>
                <div className="text-sm font-black uppercase text-cyan-300">Mã đơn</div>
                <p className="mt-3 break-all font-mono text-sm font-black">{ticketModal.bookingId}</p>
              </div>

              <div className={`rounded-lg border p-4 md:col-span-2 ${isLightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.03]'}`}>
                <div className="flex items-center gap-2 text-sm font-black uppercase text-cyan-300">
                  <FaUtensils />
                  F&B của vé
                </div>
                {ticketModal.foodAndBeverageItems.length ? (
                  <div className={`mt-3 divide-y ${isLightMode ? 'divide-slate-200' : 'divide-white/10'}`}>
                    {ticketModal.foodAndBeverageItems.map((item) => (
                      <div key={item.fbItemId} className="flex items-center justify-between gap-4 py-3 text-sm">
                        <div>
                          <p className="font-black">{item.itemName}</p>
                          <p className={isLightMode ? 'text-slate-500' : 'text-slate-400'}>Số lượng: {item.quantity}</p>
                        </div>
                        <p className="font-black">{formatCurrency(item.subtotal)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`mt-3 text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Vé này không có F&B.</p>
                )}
              </div>
            </div>

            {confirmError ? (
              <div className={`mx-5 mb-5 flex items-start gap-3 rounded-lg border p-4 text-sm font-bold ${isLightMode ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-rose-400/30 bg-rose-500/10 text-rose-200'}`}>
                <FaTimesCircle className="mt-0.5 shrink-0" />
                <span>{confirmError}</span>
              </div>
            ) : null}

            <div className={`flex justify-end gap-3 border-t p-5 ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
              {ticketModalConfirmed ? (
                <button
                  type="button"
                  onClick={closeTicketModal}
                  className={`inline-flex h-11 items-center justify-center rounded-lg border px-5 text-sm font-black transition ${isLightMode ? 'border-slate-200 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-slate-200 hover:bg-white/10'}`}
                >
                  Đóng
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void confirmTicket(ticketModal)}
                disabled={confirmLoading || ticketModalConfirmed}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FaPrint />
                {ticketModalConfirmed ? 'Đã xác nhận' : confirmLoading ? 'Đang xác nhận...' : 'In vé / xác nhận'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </PageShell>
  );
};

export default TicketScannerPage;
