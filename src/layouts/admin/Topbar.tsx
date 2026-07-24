import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaBars, FaMoon, FaPowerOff, FaSun } from 'react-icons/fa';
import NotificationCenter from '../../components/NotificationCenter';
import { logout } from '../../services/authService';

interface TopbarProps {
  sidebarCollapsed: boolean;
  isLightMode: boolean;
  onToggle: () => void;
  onToggleTheme: () => void;
}

const routeTitles: Record<string, { title: string; subtitle: string }> = {
  '/admin/dashboard': {
    title: 'Dashboard',
    subtitle: 'Theo dõi nhanh tình trạng vận hành hệ thống rạp.',
  },
  '/admin/movies': {
    title: 'Quản lý phim',
    subtitle: 'Điều phối catalog phim, trailer và thời lượng chiếu.',
  },
  '/admin/rooms': {
    title: 'Quản lý phòng chiếu',
    subtitle: 'Kiểm soát phòng, sức chứa và sơ đồ ghế.',
  },
  '/admin/showtime': {
    title: 'Quản lý lịch chiếu',
    subtitle: 'Sắp xếp suất chiếu theo rạp, phòng và khung giờ.',
  },
  '/admin/reviews': {
    title: 'Kiểm duyệt review',
    subtitle: 'Xử lý đánh giá đang chờ và nội dung cần chú ý.',
  },
  '/admin/staff': {
    title: 'Quản lý staff',
    subtitle: 'Tạo lời mời và quản trị tài khoản nội bộ.',
  },
};

const getRouteTitle = (pathname: string) => {
  if (pathname.includes('/rooms/') && pathname.includes('/seats')) {
    return {
      title: 'Sơ đồ ghế',
      subtitle: 'Cấu hình seat map, loại ghế và trạng thái sử dụng.',
    };
  }

  return routeTitles[pathname] ?? {
    title: 'Admin console',
    subtitle: 'Cinema Booking System operations.',
  };
};

const Topbar = ({
  sidebarCollapsed,
  isLightMode,
  onToggle,
  onToggleTheme,
}: TopbarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const fullName = localStorage.getItem('fullName') || 'Quản trị viên';
  const page = getRouteTitle(location.pathname);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const iconButtonClass = [
    'grid h-10 w-10 shrink-0 place-items-center rounded-lg border transition',
    isLightMode
      ? 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600'
      : 'border-white/10 bg-white/5 text-slate-300 hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-white',
  ].join(' ');

  return (
    <header
      className={[
        'sticky top-0 z-30 flex h-[72px] shrink-0 items-center gap-4 border-b px-6 backdrop-blur-xl transition-colors',
        isLightMode
          ? 'border-slate-200 bg-white/90 text-slate-950'
          : 'border-white/10 bg-[#0B1220]/90 text-white',
      ].join(' ')}
    >
      <button
        onClick={onToggle}
        className={iconButtonClass}
        title={sidebarCollapsed ? 'Mở sidebar' : 'Thu gọn sidebar'}
        type="button"
      >
        <FaBars />
      </button>

      <div className="min-w-0">
        <strong className="block truncate text-base font-black">{page.title}</strong>
        <span
          className={`mt-0.5 hidden truncate text-xs font-semibold sm:block ${
            isLightMode ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          {page.subtitle}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <NotificationCenter isLightMode={isLightMode} buttonClassName={iconButtonClass} />

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isLightMode ? 'Chuyển sang dark mode' : 'Chuyển sang light mode'}
          title={isLightMode ? 'Dark mode' : 'Light mode'}
          className={[
            'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-black uppercase tracking-wide transition',
            isLightMode
              ? 'border-slate-200 bg-slate-950 text-white hover:bg-slate-800'
              : 'border-amber-300/30 bg-amber-300/10 text-amber-200 hover:bg-amber-300/20',
          ].join(' ')}
        >
          {isLightMode ? <FaMoon /> : <FaSun />}
          <span className="hidden sm:inline">{isLightMode ? 'Dark' : 'Light'}</span>
        </button>

        <Link
          to="/profile"
          className={[
            'hidden min-h-10 items-center gap-2 rounded-lg border px-2 py-1 no-underline transition md:flex',
            isLightMode
              ? 'border-slate-200 bg-white text-slate-950 hover:border-blue-200'
              : 'border-white/10 bg-white/5 text-white hover:border-blue-400/40',
          ].join(' ')}
          title="Hồ sơ"
        >
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-black text-white">
            {fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="max-w-32 truncate text-xs font-black">{fullName}</div>
            <div className={`text-[10px] font-bold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Administrator
            </div>
          </div>
        </Link>

        <button
          onClick={handleLogout}
          className={[
            'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-black transition',
            isLightMode
              ? 'border-red-100 bg-red-50 text-red-700 hover:border-red-600 hover:bg-red-600 hover:text-white'
              : 'border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-600 hover:text-white',
          ].join(' ')}
          type="button"
        >
          <FaPowerOff />
          <span className="hidden sm:inline">Đăng xuất</span>
        </button>
      </div>
    </header>
  );
};

export default Topbar;
