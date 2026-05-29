import { Navigate, Outlet } from 'react-router-dom';

const RequireAuth = () => {
  const token = localStorage.getItem('accessToken');
  const role = localStorage.getItem('role');

  // 1. Nếu không có token -> đá về trang login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // 2. Nếu có token nhưng ROLE không phải Admin -> không cho vào (đá về login hoặc trang từ chối)
  // Lưu ý: Chữ 'Admin' phải khớp chính xác với chuỗi trả về trong Database của bạn (vd: 'Admin' hoặc 'admin')
  if (role !== 'Admin') {
    alert('Bạn không có quyền truy cập vào trang quản trị!');
    return <Navigate to="/login" replace />;
  }

  // Nếu thỏa mãn cả 2 điều kiện -> cho phép vào trang Admin
  return <Outlet />;
};

export default RequireAuth;