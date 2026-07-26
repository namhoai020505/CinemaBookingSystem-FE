/**
 * MobileTicketScannerPage – Giao diện soát vé tối ưu cho điện thoại.
 *
 * Luồng:
 *  1. Camera mở toàn màn hình theo kiểu "scanner frame"
 *  2. Nhân viên đưa QR code của vé vào khung
 *  3. Goi POST /api/tickets/scan/preview de gui thong tin ve len Desktop
 *  4. Desktop xac nhan/in ve moi thuc su check-in
 *  5. Sau 2s cooldown → camera tự động mở lại cho lần quét tiếp theo
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { FaBarcode, FaCamera, FaCheckCircle, FaExclamationTriangle, FaKeyboard, FaQrcode, FaSpinner, FaStopCircle, FaTimesCircle } from 'react-icons/fa';
import { managerService } from '../../services/managerService';
import { roomService, type RoomResponse } from '../../services/roomService';
import { getCurrentUserProfile } from '../../lib/auth';

// ── Helpers ──────────────────────────────────────────────────────────────────

const getRooms = async (): Promise<RoomResponse[]> => {
  const rooms = await roomService.getRooms(false);
  return rooms.filter((room) => room.roomStatus !== 'INACTIVE');
};

type CameraStatus = 'idle' | 'starting' | 'scanning' | 'cooldown' | 'denied' | 'unsupported' | 'error';

const SCAN_COOLDOWN_MS = 2000;

// ── Component ─────────────────────────────────────────────────────────────────

export default function MobileTicketScannerPage() {
  const profile = getCurrentUserProfile();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scanHandledRef = useRef(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestsRef = useRef<Set<string>>(new Set());
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const isMountedRef = useRef(true);

  const [rooms, setRooms] = useState<RoomResponse[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [scanLoading, setScanLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // ── Load rooms ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoadingRooms(true);
        const data = await getRooms();
        if (!mounted) return;
        setRooms(data);
        setSelectedRoomId((cur) => cur || data[0]?.roomId || '');
      } catch {
        toast.error('Không tải được danh sách phòng chiếu.', { toastId: 'room-err' });
      } finally {
        if (mounted) setLoadingRooms(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  // ── Camera lifecycle ────────────────────────────────────────────────────────
  const stopCamera = useCallback((nextStatus: CameraStatus = 'idle') => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    scanHandledRef.current = false;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraStatus(nextStatus);
  }, []);

  // Cleanup khi unmount
  useEffect(() => () => {
    isMountedRef.current = false;
    scannerControlsRef.current?.stop();
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    activeRequestsRef.current.clear();
    lastScanRef.current = null;
  }, []);

  const scanTicketCode = useCallback(async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code || !selectedRoomId) return;

    const now = Date.now();
    const lastScan = lastScanRef.current;
    if (lastScan?.code === code && now - lastScan.at < SCAN_COOLDOWN_MS) {
      return;
    }
    if (activeRequestsRef.current.has(code)) {
      return;
    }

    activeRequestsRef.current.add(code);
    lastScanRef.current = { code, at: now };
    setScanLoading(true);

    try {
      await managerService.previewTicket({ qrCode: code, roomId: selectedRoomId });

      toast.success('Đã gửi thông tin vé tới máy tính. Hãy xác nhận trên popup desktop.', {
        position: 'top-center',
        autoClose: 3000,
        style: {
          background: '#052e16',
          border: '1px solid #16a34a',
          color: '#86efac',
          fontWeight: 700,
        },
      });
    } catch (err: unknown) {
      if (lastScanRef.current?.code === code) {
        lastScanRef.current = null;
      }

      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Vé không hợp lệ hoặc không thuộc phòng đang chọn.';

      toast.error(msg, {
        position: 'top-center',
        autoClose: 4000,
        style: {
          background: '#450a0a',
          border: '1px solid #dc2626',
          color: '#fca5a5',
          fontWeight: 700,
        },
      });
    } finally {
      activeRequestsRef.current.delete(code);
      if (isMountedRef.current) {
        setScanLoading(activeRequestsRef.current.size > 0);
      }
    }
  }, [selectedRoomId]);

  const startCamera = useCallback(async function startCameraFn() {
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
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        videoRef.current,
        (result, _err, controlsFromCallback) => {
          const value = result?.getText().trim();
          if (!value || scanHandledRef.current) return;

          // Đánh dấu đã xử lý để tránh double-scan
          scanHandledRef.current = true;
          controlsFromCallback.stop();
          scannerControlsRef.current = null;
          setCameraStatus('cooldown');

          void scanTicketCode(value).finally(() => {
            if (!isMountedRef.current) {
              return;
            }
            cooldownTimerRef.current = setTimeout(() => {
              if (isMountedRef.current) {
                void startCameraFn();
              }
            }, SCAN_COOLDOWN_MS);
          });
        },
      );

      scannerControlsRef.current = controls;
      setCameraStatus('scanning');
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      setCameraStatus(name === 'NotAllowedError' ? 'denied' : 'error');
    }
  }, [stopCamera, scanTicketCode]);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.roomId === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim() || !selectedRoomId) return;
    await scanTicketCode(manualCode);
    setManualCode('');
  };

  // ── Badge texts ─────────────────────────────────────────────────────────────
  const cameraStatusText: Record<CameraStatus, string> = {
    idle: 'Camera chưa bật',
    starting: 'Đang khởi động camera...',
    scanning: 'Đưa mã QR vào khung hình',
    cooldown: 'Đang xử lý...',
    denied: 'Camera bị từ chối quyền truy cập',
    unsupported: 'Trình duyệt không hỗ trợ camera',
    error: 'Không mở được camera',
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#060e1a] font-['Urbanist'] text-white">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-[#0b1526]/90 px-4 backdrop-blur-xl">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-600 text-white shadow-lg">
          <FaQrcode size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black leading-tight">Soát Vé Mobile</div>
          <div className="truncate text-[10px] font-bold text-slate-400">
            {profile?.fullName ?? 'Nhân viên'}
          </div>
        </div>
        {/* Mobile chỉ gửi preview; desktop mới confirm/in vé */}
        <span
          title="Mobile chỉ gửi preview vé lên desktop, chưa check-in vé."
          className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-cyan-300"
        >
          <FaCheckCircle size={8} />
          Preview
        </span>
      </header>

      {/* Room selector */}
      {loadingRooms ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-400">
          <FaSpinner className="animate-spin" /> Đang tải phòng chiếu...
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
          Không có phòng chiếu nào.
        </div>
      ) : (
        <>
          {/* Phòng chiếu selector */}
          <div className="shrink-0 border-b border-white/10 bg-[#0b1526] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <FaBarcode className="text-emerald-400 text-xs shrink-0" />
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
              >
                {rooms.map((room) => (
                  <option key={room.roomId} value={room.roomId} className="bg-slate-900">
                    {room.roomName} – {room.cinemaName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Camera viewfinder */}
          <div className="relative flex-1 overflow-hidden bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              playsInline
            />

            {/* Scanner overlay */}
            {cameraStatus === 'scanning' && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                {/* Dim vùng ngoài khung */}
                <div className="absolute inset-0 bg-black/50" />
                {/* Khung ngắm */}
                <div className="relative z-10 h-56 w-56">
                  {/* 4 góc khung */}
                  {(['tl','tr','bl','br'] as const).map((corner) => (
                    <div
                      key={corner}
                      className={[
                        'absolute h-10 w-10 border-emerald-400',
                        corner === 'tl' ? 'left-0 top-0 border-l-4 border-t-4' : '',
                        corner === 'tr' ? 'right-0 top-0 border-r-4 border-t-4' : '',
                        corner === 'bl' ? 'bottom-0 left-0 border-b-4 border-l-4' : '',
                        corner === 'br' ? 'bottom-0 right-0 border-b-4 border-r-4' : '',
                      ].join(' ')}
                    />
                  ))}
                  {/* Scan line animation */}
                  <div className="absolute left-0 right-0 top-0 h-0.5 animate-[scanline_2s_ease-in-out_infinite] bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" />
                </div>
              </div>
            )}

            {/* Trạng thái camera */}
            {cameraStatus !== 'scanning' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 text-center">
                {cameraStatus === 'starting' || cameraStatus === 'cooldown' ? (
                  <FaSpinner className="animate-spin text-3xl text-emerald-400" />
                ) : cameraStatus === 'denied' ? (
                  <FaTimesCircle className="text-3xl text-rose-400" />
                ) : cameraStatus === 'error' || cameraStatus === 'unsupported' ? (
                  <FaExclamationTriangle className="text-3xl text-amber-400" />
                ) : (
                  <FaCamera className="text-3xl text-slate-500" />
                )}
                <p className="max-w-[18rem] px-4 text-sm font-bold text-slate-300">
                  {cameraStatusText[cameraStatus]}
                </p>
                {(cameraStatus === 'idle' || cameraStatus === 'denied' || cameraStatus === 'error') && (
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-black text-white transition active:scale-95"
                  >
                    <FaCamera />
                    {cameraStatus === 'idle' ? 'Bật camera' : 'Thử lại'}
                  </button>
                )}
              </div>
            )}

            {/* Nút tắt camera */}
            {(cameraStatus === 'scanning' || cameraStatus === 'starting') && (
              <button
                type="button"
                onClick={() => stopCamera('idle')}
                className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-black/60 px-3 py-1.5 text-xs font-black text-rose-300 backdrop-blur-sm transition active:scale-95"
              >
                <FaStopCircle />
                Tắt
              </button>
            )}

            {/* Loading overlay khi đang gọi API */}
            {scanLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur-sm">
                <FaSpinner className="animate-spin text-4xl text-emerald-400" />
                <p className="text-sm font-black text-emerald-300">Đang gửi preview vé...</p>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="shrink-0 border-t border-white/10 bg-[#0b1526]">
            {/* Manual input toggle */}
            <button
              type="button"
              onClick={() => setShowManualInput((v) => !v)}
              className="flex w-full items-center justify-center gap-2 border-b border-white/10 py-3 text-xs font-bold text-slate-400 transition hover:bg-white/5 hover:text-white active:scale-[.98]"
            >
              <FaKeyboard size={11} />
              {showManualInput ? 'Ẩn nhập thủ công' : 'Nhập mã thủ công'}
            </button>

            {showManualInput && (
              <form onSubmit={handleManualSubmit} className="flex gap-2 p-3">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Dán hoặc nhập mã QR..."
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={scanLoading || !manualCode.trim()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white transition disabled:opacity-50 active:scale-95"
                >
                  {scanLoading ? <FaSpinner className="animate-spin" /> : <FaCheckCircle />}
                  Gửi
                </button>
              </form>
            )}

            {/* Room & status info */}
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[11px] font-bold text-slate-500">
                {selectedRoom ? `${selectedRoom.roomName} · ${selectedRoom.cinemaName}` : 'Chọn phòng chiếu'}
              </span>
              <span className="text-[11px] font-bold text-emerald-400">
                {cameraStatus === 'scanning' ? '🟢 Đang quét' : cameraStatus === 'cooldown' ? '🟡 Cooldown' : '⚪ Chờ'}
              </span>
            </div>
          </div>
        </>
      )}

      {/* CSS animation cho scanline */}
      <style>{`
        @keyframes scanline {
          0%   { top: 0; opacity: 1; }
          45%  { top: calc(100% - 2px); opacity: 1; }
          50%  { top: calc(100% - 2px); opacity: 0; }
          55%  { top: 0; opacity: 0; }
          60%  { top: 0; opacity: 1; }
          100% { top: 0; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
