/**
 * useTicketHub – Hook quản lý kết nối SignalR cho tính năng Soát Vé Đa Thiết Bị.
 *
 * Dùng cho Desktop: Kết nối tới /hubs/ticket, lắng nghe sự kiện
 * "ReceiveScannedTicket" mà Backend gửi sau khi Mobile quét vé thành công.
 *
 * Cách dùng:
 *   const { scannedTicket, clearScannedTicket, hubStatus } = useTicketHub();
 *   useEffect(() => { if (scannedTicket) setTicketModal(scannedTicket); }, [scannedTicket]);
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { getAccessToken } from '../lib/auth';
import type { ScanTicketResponse } from '../services/managerService';

export type HubStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export type UseTicketHubReturn = {
  /** Dữ liệu vé vừa được quét từ Mobile (null nếu chưa có). */
  scannedTicket: ScanTicketResponse | null;
  /** Xóa dữ liệu vé sau khi đã xử lý (đóng popup). */
  clearScannedTicket: () => void;
  /** Trạng thái kết nối SignalR hiện tại. */
  hubStatus: HubStatus;
};

const HUB_URL = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5070'}/hubs/ticket`;

export function useTicketHub(): UseTicketHubReturn {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(false);
  const [scannedTicket, setScannedTicket] = useState<ScanTicketResponse | null>(null);
  const [hubStatus, setHubStatus] = useState<HubStatus>('disconnected');

  const clearScannedTicket = useCallback(() => {
    setScannedTicket(null);
  }, []);

  useEffect(() => {
    // Tránh tạo nhiều connection khi StrictMode re-mount
    if (connectionRef.current) return;

    let disposed = false;
    isMountedRef.current = true;
    const setStatusSafely = (status: HubStatus) => {
      if (!disposed && isMountedRef.current) {
        setHubStatus(status);
      }
    };

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        // Truyền JWT token qua query string vì WebSocket không hỗ trợ
        // Authorization header. Backend (Program.cs) đã cấu hình OnMessageReceived
        // để đọc token từ ?access_token=...
        accessTokenFactory: () => getAccessToken() ?? '',
        // Ưu tiên WebSocket, fallback sang Server-Sent Events / Long Polling
        transport:
          signalR.HttpTransportType.WebSockets |
          signalR.HttpTransportType.ServerSentEvents |
          signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect({
        // Tự reconnect sau 0s, 2s, 5s, 10s nếu mất kết nối
        nextRetryDelayInMilliseconds: (context: signalR.RetryContext) => {
          const delays = [0, 2000, 5000, 10000];
          return delays[context.previousRetryCount] ?? 15000;
        },
      })
      .configureLogging(
        import.meta.env.DEV ? signalR.LogLevel.Information : signalR.LogLevel.Warning,
      )
      .build();

    connectionRef.current = connection;

    // ── Đăng ký listener ────────────────────────────────────────────────────
    // Sự kiện này được Backend gửi sau khi Mobile quét vé thành công.
    // Tên phải khớp chính xác với SendAsync("ReceiveScannedTicket", ...) ở BE.
    connection.on('ReceiveScannedTicket', (ticketData: ScanTicketResponse) => {
      if (!disposed && isMountedRef.current) {
        setScannedTicket(ticketData);
      }
    });

    // ── Theo dõi trạng thái kết nối ─────────────────────────────────────────
    connection.onreconnecting(() => setStatusSafely('reconnecting'));
    connection.onreconnected(() => setStatusSafely('connected'));
    connection.onclose(() => setStatusSafely('disconnected'));

    // ── Khởi động kết nối ───────────────────────────────────────────────────
    const startConnection = async () => {
      if (disposed) {
        return;
      }

      try {
        setStatusSafely('connecting');
        await connection.start();
        setStatusSafely('connected');
      } catch {
        if (disposed) {
          return;
        }

        setStatusSafely('error');
        retryTimerRef.current = setTimeout(() => void startConnection(), 8000);
      }
    };

    void startConnection();

    // ── Cleanup khi component unmount ────────────────────────────────────────
    return () => {
      disposed = true;
      isMountedRef.current = false;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      connection.off('ReceiveScannedTicket');
      connectionRef.current = null;
      void connection.stop().catch(() => undefined);
    };
  }, []);

  return { scannedTicket, clearScannedTicket, hubStatus };
}
