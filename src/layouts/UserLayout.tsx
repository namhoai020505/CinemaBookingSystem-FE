import { Outlet, Link, useNavigate } from 'react-router-dom';

export default function UserLayout() {
  const navigate = useNavigate();
  
  // Lấy thông tin từ LocalStorage
  const token = localStorage.getItem('accessToken');
  const fullName = localStorage.getItem('fullName');

  // Hàm xử lý Đăng xuất
  const handleLogout = () => {
    // 1. Xóa toàn bộ thông tin tài khoản khỏi LocalStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('role');
    localStorage.removeItem('fullName');
    
    // 2. Chuyển hướng về trang chủ thay vì trang login
    navigate('/'); 
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* HEADER */}
      <header className="bg-blue-600 text-white shadow-md">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          
          {/* Logo */}
          <Link to="/" className="text-2xl font-bold tracking-wider hover:text-gray-200 transition">
            CINEMA
          </Link>
          
          {/* Khu vực Menu / Tài khoản */}
          <nav>
            {token ? (
              // NẾU ĐÃ ĐĂNG NHẬP: Hiện tên + Nút Đăng xuất
              <div className="flex items-center gap-4">
                <span className="font-medium text-white">
                  Chào, {fullName || 'Khách hàng'}!
                </span>
                <button 
                  onClick={handleLogout}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-red-600 transition duration-200"
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              // NẾU CHƯA ĐĂNG NHẬP: Hiện nút Đăng nhập
              <Link 
                to="/login" 
                className="bg-white text-blue-600 px-5 py-2 rounded-lg font-semibold shadow hover:bg-gray-100 transition duration-200"
              >
                Đăng nhập
              </Link>
            )}
          </nav>

        </div>
      </header>
      
      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 bg-gray-50">
        <Outlet />
      </main>

      {/* FOOTER */}
      <footer className="bg-gray-800 text-white text-center p-4">
        <p>© 2026 Cinema System. All rights reserved.</p>
      </footer>
    </div>
  );
}