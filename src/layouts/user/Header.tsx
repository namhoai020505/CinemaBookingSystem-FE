import { Link, useNavigate } from 'react-router-dom';
import { FiChevronDown } from 'react-icons/fi'; // Icon mũi tên chỉ xuống
import logo from '../../assets/logo.png'; 

export default function Header() {
  const navigate = useNavigate();
  const token = localStorage.getItem('accessToken');
  const fullName = localStorage.getItem('fullName');

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('role');
    localStorage.removeItem('fullName');
    navigate('/'); 
  };

  return (
    <header className="w-full sticky top-0 z-50 shadow-lg">
      
      {/* TẦNG 1: TOPBAR (Màu nền #0F172A) */}
      <div className="bg-[#0F172A] text-gray-300 py-1.5">
        <div className="container mx-auto px-4 flex justify-end text-[13px]">
          {token ? (
            <div className="flex items-center gap-3">
              <span>Chào, {fullName || 'Thành viên'}</span>
              <span className="text-gray-600">|</span>
              <button onClick={handleLogout} className="hover:text-white transition font-medium">
                Đăng xuất
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 font-medium">
              <Link to="/login" className="hover:text-white transition">Đăng nhập</Link>
              <span className="text-gray-600">|</span>
              <Link to="/login" className="hover:text-white transition">Đăng ký</Link>
            </div>
          )}
        </div>
      </div>

      {/* TẦNG 2: MAIN MENU (Màu nền #1E293B, viền dưới #474747) */}
      <div className="bg-[#1E293B] border-b border-[#474747] py-3">
        <div className="container mx-auto px-4 flex justify-between items-center">
          
          {/* CỤM BÊN TRÁI: Logo + Dropdown Chọn Rạp */}
          <div className="flex items-center gap-6">
            
            {/* LOGO */}
            <Link to="/" className="flex items-center">
              {/* Xóa dấu comment dòng dưới để dùng ảnh thật của bạn */}
              <img src={logo} alt="G2C Logo" className="h-10 object-contain" />
            </Link>

            {/* DROPDOWN CHỌN RẠP (Bo tròn giống ảnh) */}
            <button className="hidden sm:flex items-center gap-2 border border-white text-white rounded-full px-4 py-1.5 hover:bg-white/10 transition text-sm">
              <span>Beta Thái Nguyên</span>
              <FiChevronDown size={18} />
            </button>
          </div>

          {/* CỤM BÊN PHẢI: Các link điều hướng */}
          <nav className="hidden lg:flex items-center gap-7 font-bold text-white text-sm tracking-wide">
            <Link to="/" className="hover:text-[#FFD166] transition">GIÁ VÉ</Link>
            <Link to="/" className="hover:text-[#FFD166] transition">PHIM</Link>
            <Link to="/" className="hover:text-[#FFD166] transition">RẠP</Link>
            <Link to="/" className="hover:text-[#FFD166] transition">LỊCH CHIẾU THEO RẠP</Link>
            <Link to="/" className="hover:text-[#FFD166] transition">THÀNH VIÊN</Link>
          </nav>

        </div>
      </div>
    </header>
  );
}