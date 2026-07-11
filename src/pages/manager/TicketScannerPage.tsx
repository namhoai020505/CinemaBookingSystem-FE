import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FaBarcode, FaCamera, FaCheckCircle, FaHistory, FaQrcode, FaStopCircle, FaTimesCircle } from 'react-icons/fa';
import type { ManagerOutletContext } from '../../layouts/manager/ManagerLayout';
import { managerService, type ScanTicketResponse } from '../../services/managerService';
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

type BrowserBarcodeDetector = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

type BrowserBarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BrowserBarcodeDetector;

type WindowWithBarcodeDetector = Window & {
  BarcodeDetector?: BrowserBarcodeDetectorConstructor;
};

type CameraStatus = 'idle' | 'starting' | 'scanning' | 'unsupported' | 'denied' | 'error';

const TicketScannerPage = () => {
  const { isLightMode } = useOutletContext<ManagerOutletContext>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BrowserBarcodeDetector | null>(null);
  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [scanLoading, setScanLoading] = useState(false);
  const [roomError, setRoomError] = useState('');
  const [scanError, setScanError] = useState('');
  const [lastScan, setLastScan] = useState<ScanTicketResponse | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);

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
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraStatus(nextStatus);
  }, []);

  const startCamera = async () => {
    setScanError('');
    const BarcodeDetector = (window as WindowWithBarcodeDetector).BarcodeDetector;

    if (!BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('unsupported');
      return;
    }

    try {
      setCameraStatus('starting');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      streamRef.current = stream;
      detectorRef.current = new BarcodeDetector({ formats: ['qr_code'] });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraStatus('scanning');
    } catch (error) {
      const permissionName = error instanceof DOMException ? error.name : '';
      setCameraStatus(permissionName === 'NotAllowedError' ? 'denied' : 'error');
    }
  };

  useEffect(() => {
    if (cameraStatus !== 'scanning') {
      return;
    }

    let frameId = 0;
    let isActive = true;

    const scanFrame = async () => {
      if (!isActive) {
        return;
      }

      const detector = detectorRef.current;
      const video = videoRef.current;

      if (detector && video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !scanLoading) {
        try {
          const [barcode] = await detector.detect(video);
          const value = barcode?.rawValue?.trim();

          if (value) {
            setQrCode(value);
            stopCamera('idle');
            return;
          }
        } catch {
          // Some browsers throw while the video frame is warming up; keep scanning.
        }
      }

      frameId = window.requestAnimationFrame(scanFrame);
    };

    frameId = window.requestAnimationFrame(scanFrame);

    return () => {
      isActive = false;
      window.cancelAnimationFrame(frameId);
    };
  }, [cameraStatus, scanLoading, stopCamera]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
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
    scanning: 'Đưa mã QR vào khung hình để tự điền mã vé.',
    unsupported: 'Trình duyệt hiện tại chưa hỗ trợ quét QR bằng camera. Hãy dùng nhập mã thủ công.',
    denied: 'Camera bị từ chối quyền truy cập. Hãy cấp quyền camera hoặc nhập mã thủ công.',
    error: 'Không mở được camera trên thiết bị này. Hãy dùng nhập mã thủ công.',
  }[cameraStatus];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setScanError('');
    setLastScan(null);

    if (!selectedRoomId) {
      setScanError('Vui lòng chọn phòng cần soát vé.');
      return;
    }

    if (!qrCode.trim()) {
      setScanError('Vui lòng nhập hoặc quét mã QR của vé.');
      return;
    }

    try {
      setScanLoading(true);
      const result = await managerService.scanTicket({
        roomId: selectedRoomId,
        qrCode: qrCode.trim(),
      });
      setLastScan(result);
      setQrCode('');
      addHistory({ success: true, message: 'Vé hợp lệ', result });
    } catch (error) {
      const message = getApiErrorMessage(error, 'Không soát được vé. Kiểm tra lại mã hoặc phòng chiếu.');
      setScanError(message);
      addHistory({ success: false, message });
    } finally {
      setScanLoading(false);
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
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 text-xs font-black text-rose-200 transition hover:bg-rose-500/20"
                    >
                      <FaStopCircle />
                      Tắt camera
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 text-xs font-black text-cyan-200 transition hover:bg-cyan-500/20"
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
                <span className={`text-xs font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Mã QR / mã vé</span>
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
                    <p><strong>Ghế:</strong> {lastScan.seatCode}</p>
                    <p><strong>Phòng:</strong> {lastScan.roomName}</p>
                    <p><strong>Giờ chiếu:</strong> {formatDateTime(lastScan.showtimeStartTime)}</p>
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={scanLoading}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
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
                      {item.result ? `${item.result.movieTitle} - ghế ${item.result.seatCode}` : item.message}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
};

export default TicketScannerPage;
