import { NavLink } from 'react-router-dom';
import {
  FaBarcode,
  FaBuilding,
  FaCalendarAlt,
  FaChartLine,
  FaDoorOpen,
  FaMoneyCheckAlt,
  FaShieldAlt,
  FaTicketAlt,
} from 'react-icons/fa';

type ManagerSidebarProps = {
  collapsed: boolean;
  isLightMode: boolean;
};

const navItems = [
  {
    to: '/manager/dashboard',
    label: 'Dashboard',
    description: 'Doanh thu và vé trong rạp',
    icon: <FaChartLine />,
  },
  {
    to: '/manager/showtimes',
    label: 'Showtimes',
    description: 'Suất chiếu và hủy suất',
    icon: <FaCalendarAlt />,
  },
  {
    to: '/manager/refunds',
    label: 'Refunds',
    description: 'Theo dõi hoàn tiền',
    icon: <FaMoneyCheckAlt />,
  },
  {
    to: '/manager/ticket-scanner',
    label: 'Ticket Scanner',
    description: 'Soát vé tại rạp',
    icon: <FaBarcode />,
  },
  {
    to: '/manager/vouchers',
    label: 'Vouchers',
    description: 'Quản lý mã giảm giá của rạp',
    icon: <FaTicketAlt />,
  },
  {
    to: '/manager/banners',
    label: 'Banners',
    description: 'Quản lý banner Carousel của rạp',
    icon: <FaDoorOpen />,
  },
  {
    to: '/manager/my-cinema',
    label: 'My Cinema',
    description: 'Rạp và phòng của tôi',
    icon: <FaBuilding />,
  },
] as const;

const ManagerSidebar = ({ collapsed, isLightMode }: ManagerSidebarProps) => {
  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-40 flex h-dvh shrink-0 flex-col overflow-hidden border-r transition-all duration-200 lg:relative lg:inset-auto lg:h-screen',
        isLightMode
          ? 'border-slate-200 bg-white shadow-[12px_0_34px_rgba(15,23,42,0.08)]'
          : 'border-white/10 bg-[#07111E] shadow-[12px_0_34px_rgba(0,0,0,0.34)]',
        collapsed
          ? 'w-0 -translate-x-full lg:w-20 lg:translate-x-0'
          : 'w-72 translate-x-0',
      ].join(' ')}
    >
      <div className={`flex min-h-[72px] items-center gap-3 border-b px-5 ${
        isLightMode ? 'border-slate-200' : 'border-white/10'
      }`}>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 via-cyan-500 to-blue-700 text-white shadow-lg shadow-cyan-900/30">
          <FaShieldAlt />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className={`truncate text-[15px] font-black leading-tight ${
              isLightMode ? 'text-slate-900' : 'text-white'
            }`}>
              Manager Console
            </div>
            <div className={`mt-1 text-[10px] font-black uppercase tracking-[0.16em] ${
              isLightMode ? 'text-slate-500' : 'text-cyan-200/70'
            }`}>
              Rạp của tôi
            </div>
          </div>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Manager navigation">
        {!collapsed && (
          <div className={`px-2 pb-3 text-[10px] font-black uppercase tracking-[0.16em] ${
            isLightMode ? 'text-slate-400' : 'text-slate-500'
          }`}>
            Vận hành
          </div>
        )}

        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={collapsed ? item.label : item.description}
            className={({ isActive }) =>
              [
                'mb-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold no-underline transition-all duration-150',
                collapsed ? 'justify-center' : 'justify-start',
                isActive
                  ? isLightMode
                    ? 'bg-emerald-50 text-emerald-600 shadow-[inset_3px_0_0_#10b981]'
                    : 'bg-gradient-to-r from-emerald-500/25 to-cyan-500/10 text-white shadow-[inset_3px_0_0_#34d399]'
                  : isLightMode
                    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    : 'text-slate-400 hover:bg-white/10 hover:text-white',
              ].join(' ')
            }
          >
            <span className="inline-flex shrink-0 text-base">{item.icon}</span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate">{item.label}</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={`shrink-0 border-t p-3 ${
        isLightMode ? 'border-slate-200' : 'border-white/10'
      }`}>
        <div className={`flex items-center gap-3 rounded-lg border p-2.5 ${
          isLightMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.04]'
        }`}>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 text-white">
            <FaDoorOpen />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className={`truncate text-sm font-black ${
                isLightMode ? 'text-slate-900' : 'text-white'
              }`}>Manager</div>
              <div className={`mt-0.5 text-[11px] font-bold ${
                isLightMode ? 'text-slate-500' : 'text-slate-400'
              }`}>
                Cinema operations
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default ManagerSidebar;
