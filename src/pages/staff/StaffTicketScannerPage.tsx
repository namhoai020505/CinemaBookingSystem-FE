/**
 * StaffTicketScannerPage – Entry point cho tính năng Soát Vé của Staff.
 *
 * Auto-detect thiết bị:
 *  • Mobile / Tablet (màn hình < 1024px hoặc có touchscreen)
 *    → MobileTicketScannerPage: Camera toàn màn hình, quét QR, Toast notification
 *  • Desktop (màn hình >= 1024px, không có touch chính)
 *    → TicketScannerPage: UI quầy đầy đủ + SignalR listener tự nhận popup từ Mobile
 */

import { useEffect, useState } from 'react';
import MobileTicketScannerPage from './MobileTicketScannerPage';
import DesktopTicketScannerPage from '../manager/TicketScannerPage';

const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  // Kết hợp 2 signal: kích thước màn hình VÀ khả năng touch
  const isTouchPrimary = window.matchMedia('(pointer: coarse)').matches;
  const isNarrow = window.innerWidth < 1024;
  return isTouchPrimary || isNarrow;
};

const StaffTicketScannerPage = () => {
  const [isMobile, setIsMobile] = useState(isMobileDevice);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const pointerQuery = window.matchMedia('(pointer: coarse)');
    const updateDeviceMode = () => {
      setIsMobile(isMobileDevice());
    };

    window.addEventListener('resize', updateDeviceMode);
    pointerQuery.addEventListener('change', updateDeviceMode);

    return () => {
      window.removeEventListener('resize', updateDeviceMode);
      pointerQuery.removeEventListener('change', updateDeviceMode);
    };
  }, []);

  if (isMobile) {
    return <MobileTicketScannerPage />;
  }

  // TicketScannerPage dùng useOutletContext<ManagerOutletContext> nên cần
  // đảm bảo context được cung cấp từ StaffLayout (outlet context).
  // StaffLayout đã expose { themeMode, isLightMode } giống ManagerLayout.
  return <DesktopTicketScannerPage />;
};

export default StaffTicketScannerPage;
