import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaBars, FaBuilding, FaMoon, FaPowerOff, FaSun } from 'react-icons/fa';
import { getCurrentUserProfile } from '../../lib/auth';
import { logout } from '../../services/authService';
import { managerService } from '../../services/managerService';

type ManagerTopbarProps = {
  sidebarCollapsed: boolean;
  isLightMode: boolean;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
};

const routeTitles: Record<string, { title: string; subtitle: string }> = {
  '/manager/dashboard': {
    title: 'Dashboard Quản Lý Rạp',
    subtitle: 'Doanh thu, vé bán và hiệu suất rạp đang phụ trách.',
  },
  '/manager/showtimes': {
    title: 'Lịch Chiếu & Suất Chiếu',
    subtitle: 'Theo dõi suất chiếu, trạng thái và xử lý hủy suất.',
  },
  '/manager/refunds': {
    title: 'Quản Lý Hoàn Tiền',
    subtitle: 'Theo dõi hoàn tiền phát sinh từ nghiệp vụ rạp.',
  },
  '/manager/ticket-scanner': {
    title: 'Soát Vé Điện Tử',
    subtitle: 'Soát vé bằng QR hoặc nhập mã thủ công tại rạp.',
  },
  '/manager/fb-items': {
    title: 'Quản Lý F&B Của Rạp',
    subtitle: 'Theo dõi món đang bán và cập nhật tồn kho bắp nước tại chi nhánh.',
  },
  '/manager/vouchers': {
    title: 'Voucher & Mã Giảm Giá',
    subtitle: 'Quản lý mã giảm giá và chương trình khuyến mãi rạp.',
  },
  '/manager/notifications': {
    title: 'Thông Báo Vận Hành',
    subtitle: 'Gửi và theo dõi thông báo nội bộ rạp chiếu.',
  },
  '/manager/staff': {
    title: 'Phân Công Ca Trực Nhân Viên',
    subtitle: 'Quản lý danh sách và phân ca làm việc cho staff.',
  },
  '/manager/staff-shifts': {
    title: 'Phân Công Ca Trực Nhân Viên',
    subtitle: 'Quản lý danh sách và phân ca làm việc cho staff.',
  },
  '/manager/my-cinema': {
    title: 'Rạp & Phòng Chiếu',
    subtitle: 'Thông tin rạp và các phòng đang thuộc phạm vi quản lý.',
  },
};

const ManagerTopbar = ({
  sidebarCollapsed,
  isLightMode,
  onToggleSidebar,
  onToggleTheme,
}: ManagerTopbarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = getCurrentUserProfile();
  const page = routeTitles[location.pathname] ?? routeTitles['/manager/dashboard'];
  const [cinemaBranchName, setCinemaBranchName] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    managerService
      .getRooms()
      .then((rooms) => {
        if (isMounted && rooms && rooms.length > 0 && rooms[0].cinemaName) {
          setCinemaBranchName(rooms[0].cinemaName);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const iconButtonClass = [
    'grid h-10 w-10 shrink-0 place-items-center rounded-lg border transition',
    isLightMode
      ? 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
      : 'border-white/10 bg-white/5 text-slate-300 hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-white',
  ].join(' ');

  return (
    <header
      className={[
        'sticky top-0 z-30 flex h-[72px] shrink-0 items-center gap-4 border-b px-5 backdrop-blur-xl transition-colors',
        isLightMode
          ? 'border-slate-200 bg-white/90 text-slate-950'
          : 'border-white/10 bg-[#0B1220]/90 text-white',
      ].join(' ')}
    >
      <button
        onClick={onToggleSidebar}
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
        <div
          className={[
            'hidden min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-black md:inline-flex',
            isLightMode
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
          ].join(' ')}
        >
          <FaBuilding />
          {cinemaBranchName || 'Chi nhánh rạp'}
        </div>

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
            'hidden min-h-10 items-center gap-2 rounded-lg border px-2 py-1 no-underline transition lg:flex',
            isLightMode
              ? 'border-slate-200 bg-white text-slate-950 hover:border-emerald-200'
              : 'border-white/10 bg-white/5 text-white hover:border-emerald-400/40',
          ].join(' ')}
          title="Hồ sơ"
        >
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 text-xs font-black text-white">
            {(profile?.fullName || 'M').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="max-w-32 truncate text-xs font-black">{profile?.fullName || 'Manager'}</div>
            <div className={`text-[10px] font-bold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {profile?.role || 'MANAGER'}
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

export default ManagerTopbar;
