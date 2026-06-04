import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export const useIdleTimeout = (timeoutMinutes: number = 10) => {
  const navigate = useNavigate();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const role = localStorage.getItem('role');

    // === ĐIỀU KIỆN LỌC ROLE ===
    // Nếu chưa đăng nhập HOẶC tài khoản KHÔNG PHẢI là Customer -> Thoát sớm, không bật bộ đếm
    if (!token || (role !== 'Customer' && role !== 'ROLE_CUSTOMER')) {
      return;
    }

    const handleLogout = () => {
      // Xóa sạch dữ liệu trong localStorage của Customer
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('role');
      localStorage.removeItem('fullName');

      // Đẩy về trang chủ và làm mới trạng thái header
      navigate('/');
      window.location.reload();
    };

    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // Thiết lập bộ đếm 10 phút
      timeoutRef.current = setTimeout(handleLogout, timeoutMinutes * 60 * 1000);
    };

    // Các sự kiện tương tác của người dùng
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    // Kích hoạt bộ đếm lần đầu
    resetTimer();

    // Lắng nghe hành vi người dùng để reset thời gian
    events.forEach((event) => window.addEventListener(event, resetTimer));

    // Hủy lắng nghe khi unmount
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [navigate, timeoutMinutes]);
};
