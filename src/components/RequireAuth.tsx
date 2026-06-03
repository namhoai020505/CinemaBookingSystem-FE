import { Navigate, Outlet } from 'react-router-dom';

const RequireAuth = () => {
  const token = localStorage.getItem('accessToken');
  const role = localStorage.getItem('role'); 

  // 1. Nếu không có token -> chưa đăng nhập -> đá về trang login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // 2. Nếu là Customer cố tình vào Admin -> đá về trang chủ (http://localhost:5173/)
  // Lưu ý: Kiểm tra cả 2 trường hợp tên role tùy thuộc vào Backend bạn trả về cái nào
  if (role === 'Customer' || role === 'ROLE_CUSTOMER') {
    return <Navigate to="/" replace />;
  }

  // 3. Nếu không phải Admin (mà cũng không phải Customer) -> Cho về Login cho an toàn
  if (role !== 'Admin') {
    alert('Bạn không có quyền truy cập vào trang quản trị!');
    return <Navigate to="/login" replace />;
  }

  // Nếu vượt qua hết các bài test trên (tức là đích thị Admin) -> cho phép vào trang Admin
  return <Outlet />;
};

export default RequireAuth;