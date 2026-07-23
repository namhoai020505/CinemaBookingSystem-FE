import { Link, useLocation } from 'react-router-dom';
import {
  FaChair,
  FaChartLine,
  FaComments,
  FaFilm,
  FaMoneyBillWave,
  FaRegBuilding,
  FaShieldAlt,
  FaTicketAlt,
  FaUsersCog,
} from 'react-icons/fa';

interface SidebarProps {
  collapsed: boolean;
  isLightMode: boolean;
}

const navItems = [
  {
    to: '/admin/dashboard',
    label: 'Dashboard',
    description: 'Tổng quan vận hành',
    icon: <FaChartLine />,
  },
  {
    to: '/admin/movies',
    label: 'Phim',
    description: 'Catalog & trailer',
    icon: <FaFilm />,
  },
  {
    to: '/admin/rooms',
    label: 'Phòng chiếu',
    description: 'Room & seat map',
    icon: <FaRegBuilding />,
  },
  {
    to: '/admin/showtime',
    label: 'Lịch chiếu',
    description: 'Timeline scheduling',
    icon: <FaTicketAlt />,
  },
  {
    to: '/admin/review',
    label: 'Review',
    description: 'Kiểm duyệt nội dung',
    icon: <FaComments />,
  },
  {
    to: '/admin/vouchers',
    label: 'Vouchers',
    description: 'Quản lý mã giảm giá',
    icon: <FaTicketAlt />,
  },
  {
    to: '/admin/refunds',
    label: 'Hoàn Tiền',
    description: 'Xử lý manual refund',
    icon: <FaMoneyBillWave />,
  },
  {
    to: '/admin/banners',
    label: 'Banners',
    description: 'Quản lý ảnh banner Carousel',
    icon: <FaFilm />,
  },
  {
    to: '/admin/staff',
    label: 'Staff',
    description: 'Tài khoản nội bộ',
    icon: <FaUsersCog />,
  },
] as const;

const Sidebar = ({ collapsed, isLightMode }: SidebarProps) => {
  const location = useLocation();

  const asideClass = [
    'fixed inset-y-0 left-0 z-40 flex h-dvh shrink-0 flex-col overflow-hidden border-r transition-all duration-200 lg:relative lg:inset-auto lg:h-screen',
    isLightMode
      ? 'border-slate-200 bg-white shadow-[12px_0_34px_rgba(15,23,42,0.08)]'
      : 'border-white/10 bg-[#08111F] shadow-[12px_0_34px_rgba(0,0,0,0.34)]',
    collapsed
      ? 'w-0 -translate-x-full lg:w-20 lg:translate-x-0'
      : 'w-72 translate-x-0',
  ].join(' ');

  return (
    <aside className={asideClass}>
      <div className={`flex min-h-[72px] items-center gap-3 border-b px-5 ${
        isLightMode ? 'border-slate-200' : 'border-white/10'
      }`}>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 via-blue-600 to-slate-950 text-white shadow-lg shadow-blue-900/30">
          <FaShieldAlt />
        </div>

        {!collapsed && (
          <div className="min-w-0">
            <div className={`truncate text-[15px] font-black leading-tight ${
              isLightMode ? 'text-slate-900' : 'text-white'
            }`}>
              Cinema Console
            </div>
            <div className={`mt-1 text-[10px] font-black uppercase tracking-[0.16em] ${
              isLightMode ? 'text-slate-500' : 'text-slate-400'
            }`}>
              Control System
            </div>
          </div>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Admin navigation">
        {!collapsed && (
          <div className={`px-2 pb-3 text-[10px] font-black uppercase tracking-[0.16em] ${
            isLightMode ? 'text-slate-400' : 'text-slate-500'
          }`}>
            Modules
          </div>
        )}

        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to);

          return (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : item.description}
              className={[
                'mb-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold no-underline transition-all duration-150',
                collapsed ? 'justify-center' : 'justify-start',
                isActive
                  ? isLightMode
                    ? 'bg-blue-50 text-blue-600 shadow-[inset_3px_0_0_#2563eb]'
                    : 'bg-gradient-to-r from-blue-600/30 to-cyan-500/10 text-white shadow-[inset_3px_0_0_#38bdf8]'
                  : isLightMode
                    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    : 'text-slate-400 hover:bg-white/10 hover:text-white',
              ].join(' ')}
            >
              <span className="inline-flex shrink-0 text-base">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={`shrink-0 border-t p-3 ${
        isLightMode ? 'border-slate-200' : 'border-white/10'
      }`}>
        <div className={`flex items-center gap-3 rounded-lg border p-2.5 ${
          isLightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.04]'
        }`}>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
            <FaChair />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className={`truncate text-sm font-black ${
                isLightMode ? 'text-slate-900' : 'text-white'
              }`}>Admin</div>
              <div className={`mt-0.5 text-[11px] font-bold ${
                isLightMode ? 'text-slate-500' : 'text-slate-400'
              }`}>
                System operator
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
