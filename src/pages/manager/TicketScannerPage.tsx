import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FaBarcode, FaCamera, FaCheckCircle, FaHistory, FaPrint, FaQrcode, FaStopCircle, FaTimesCircle, FaUtensils, FaUser } from 'react-icons/fa';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import type { ManagerOutletContext } from '../../layouts/manager/ManagerLayout';
import { managerService, type ScanTicketResponse } from '../../services/managerService';
import { compensationService } from '../../services/compensationService';
import type { RoomResponse } from '../../services/roomService';
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
  const [ticketModal, setTicketModal] = useState<ScanTicketResponse | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);

  const [activeMode, setActiveMode] = useState<'SCAN_TICKET' | 'REDEEM_COMBO'>('SCAN_TICKET');
  const activeModeRef = useRef(activeMode);
  useEffect(() => {
    activeModeRef.current = activeMode;
  }, [activeMode]);

  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState('');
  const [redeemError, setRedeemError] = useState('');

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
          if (activeModeRef.current === 'SCAN_TICKET') {
            void scanTicketCode(value);
          } else {
            void redeemComboCode(value);
          }
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
      const result = await managerService.scanTicket({
        roomId: selectedRoomId,
        qrCode: normalizedQrCode,
      });
      setLastScan(result);
      setTicketModal(result);
      setQrCode('');
      addHistory({ success: true, message: 'Vé hợp lệ', result });
    } catch (error) {
      const message = getApiErrorMessage(error, 'Không soát được vé. Kiểm tra lại mã hoặc phòng chiếu.');
      setQrCode(normalizedQrCode);
      setScanError(message);
      addHistory({ success: false, message });
    } finally {
      setScanLoading(false);
    }
  }

  const redeemComboCode = async (code: string) => {
    if (!code.trim()) {
      setRedeemError('Vui lòng nhập hoặc quét mã combo.');
      return;
    }
    try {
      setRedeemLoading(true);
      setRedeemError('');
      setRedeemSuccess('');
      const response = await compensationService.redeemCompensationCombo(code.trim());
      if (response.success) {
        setRedeemSuccess(response.message || `Đổi combo ${code} thành công!`);
        setQrCode('');
        addHistory({ success: true, message: `[COMBO] Đổi thành công mã ${code}` });
      } else {
        setRedeemError(response.message || 'Đổi combo thất bại.');
        addHistory({ success: false, message: `[COMBO] Đổi thất bại mã ${code}` });
      }
    } catch (error) {
      const msg = getApiErrorMessage(error, 'Lỗi hệ thống khi đổi combo.');
      setRedeemError(msg);
      addHistory({ success: false, message: `[COMBO] Lỗi: ${msg}` });
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (activeMode === 'SCAN_TICKET') {
      await scanTicketCode(qrCode);
    } else {
      await redeemComboCode(qrCode);
    }
  };

  return (
    <PageShell
      eyebrow="Gate operations"
      title="Soát vé tại rạp"
      description="Chọn đúng phòng chiếu rồi quét QR hoặc nhập mã vé thủ công. Backend sẽ xác thực vé có thuộc phòng, suất chiếu và trạng thái hợp lệ hay không."
      isLightMode={isLightMode}
      action={selectedRoom ? <StatusBadge status={selectedRoom.roomName} /> : undefined}
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

            {/* Tab Chọn Chế Độ: Soát Vé hoặc Đổi Combo */}
            <div className="mt-5 flex border-b border-gray-800 gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setActiveMode('SCAN_TICKET');
                  setScanError('');
                  setRedeemError('');
                  setRedeemSuccess('');
                }}
                className={`pb-2.5 px-4 font-bold text-xs uppercase border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeMode === 'SCAN_TICKET'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-500 hover:text-white'
                }`}
              >
                <FaBarcode size={12} />
                Soát vé xem phim
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMode('REDEEM_COMBO');
                  setScanError('');
                  setRedeemError('');
                  setRedeemSuccess('');
                }}
                className={`pb-2.5 px-4 font-bold text-xs uppercase border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeMode === 'REDEEM_COMBO'
                    ? 'border-yellow-500 text-yellow-400'
                    : 'border-transparent text-gray-500 hover:text-white'
                }`}
              >
                <FaUtensils size={12} />
                Đổi combo bồi thường
              </button>
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

              {activeMode === 'SCAN_TICKET' && (
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
              )}

              <label className="grid gap-2">
                <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {activeMode === 'SCAN_TICKET' ? 'Mã QR / mã vé' : 'Mã bắp nước bồi hoàn'}
                </span>
                <textarea
                  value={qrCode}
                  onChange={(event) => setQrCode(event.target.value)}
                  className={`${inputClass(isLightMode)} min-h-36 resize-y py-3 font-mono`}
                  placeholder={activeMode === 'SCAN_TICKET' ? "Dán dữ liệu QR hoặc nhập mã vé..." : "Dán dữ liệu QR hoặc nhập mã combo bồi thường..."}
                  autoFocus
                />
              </label>

              {redeemSuccess && (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-200">
                  <FaCheckCircle className="mt-0.5 shrink-0 text-emerald-400" />
                  <span>{redeemSuccess}</span>
                </div>
              )}

              {(scanError || redeemError) ? (
                <div className="flex items-start gap-3 rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm font-bold text-rose-200">
                  <FaTimesCircle className="mt-0.5 shrink-0" />
                  <span>{scanError || redeemError}</span>
                </div>
              ) : null}

              {activeMode === 'SCAN_TICKET' && lastScan ? (
                <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  <div className="flex items-center gap-2 font-black">
                    <FaCheckCircle />
                    Vé hợp lệ
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <p><strong>Phim:</strong> {lastScan.movieTitle}</p>
                    <p><strong>Ghế:</strong> {lastScan.seatCode}</p>
                    <p><strong>Phòng:</strong> {lastScan.roomName}</p>
                    <p><strong>Giờ chiếu:</strong> {formatDateTime(lastScan.showtimeStartTime)}</p>
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={activeMode === 'SCAN_TICKET' ? scanLoading : redeemLoading}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                <FaBarcode />
                {activeMode === 'SCAN_TICKET'
                  ? (scanLoading ? 'Đang soát vé...' : 'Xác nhận soát vé')
                  : (redeemLoading ? 'Đang đổi combo...' : 'Xác nhận đổi combo')}
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
                      {item.result ? `${item.result.movieTitle} - ghế ${item.result.seatCode}` : item.message}
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
                  <p className="text-xs font-black uppercase tracking-wider text-emerald-400">Vé đã xác nhận</p>
                  <h2 className="mt-1 text-xl font-black">{ticketModal.movieTitle}</h2>
                  <p className={`mt-1 text-sm ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {formatDateTime(ticketModal.showtimeStartTime)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTicketModal(null)}
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
                <p className="mt-3 text-lg font-black">{ticketModal.customerName || 'Khách vãng lai'}</p>
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
                  {(ticketModal.seatCodes?.length ? ticketModal.seatCodes : [ticketModal.seatCode]).join(', ')}
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
                {ticketModal.foodAndBeverageItems?.length ? (
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

            <div className={`flex justify-end border-t p-5 ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
              <button
                type="button"
                onClick={() => setTicketModal(null)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-500"
              >
                <FaPrint />
                In vé
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </PageShell>
  );
};

export default TicketScannerPage;
