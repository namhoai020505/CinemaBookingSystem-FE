import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  {
    to: '/admin/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    to: '/admin/movies',
    label: 'Quản lý Phim',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="2" y1="7" x2="7" y2="7" />
        <line x1="2" y1="17" x2="7" y2="17" />
        <line x1="17" y1="17" x2="22" y2="17" />
        <line x1="17" y1="7" x2="22" y2="7" />
      </svg>
    ),
  },
  {
    to: '/admin/users',
    label: 'Quản lý User',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: '/admin/rooms',
    label: 'Quản lý Phòng',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    to: '/admin/showtime',
    label: 'Quản lý Lịch Chiếu',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="4" width="4" height="4" />
        <rect x="16" y="4" width="4" height="4" />
        <rect x="4" y="12" width="4" height="4" />
        <rect x="12" y="12" width="4" height="4" />
        <rect x="16" y="12" width="4" height="4" />
        <rect x="4" y="20" width="4" height="4" />
        <rect x="12" y="20" width="4" height="4" />
        <rect x="16" y="20" width="4" height="4" />
      </svg>
    ),
  },

  {
    to: '/admin/staff',
    label: 'Quản lý Staff',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

const Sidebar = ({ collapsed }: SidebarProps) => {
  const location = useLocation();

  const asideClass = [
    'fixed inset-y-0 left-0 z-40 flex h-dvh shrink-0 flex-col overflow-hidden border-r transition-all duration-200 lg:relative lg:inset-auto lg:h-screen',
    isLightMode
      ? 'border-slate-200 bg-slate-950 shadow-[12px_0_34px_rgba(15,23,42,0.16)]'
      : 'border-white/10 bg-[#08111F] shadow-[12px_0_34px_rgba(0,0,0,0.34)]',
    collapsed
      ? 'w-0 -translate-x-full lg:w-20 lg:translate-x-0'
      : 'w-72 translate-x-0',
  ].join(' ');

  return (
    <aside
      style={{
        width: collapsed ? '68px' : '240px',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 100,
        boxShadow: collapsed ? 'none' : '4px 0 24px rgba(0,0,0,0.25)',
        flexShrink: 0,
      }}
    >
      {/* Logo / Brand */}
      <div
        style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          padding: collapsed ? '0 14px' : '0 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          gap: '12px',
          overflow: 'hidden',
          transition: 'padding 0.3s',
        }}
      >
        {/* Cinema icon */}
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z" />
          </svg>
        </div>

        {!collapsed && (
          <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '15px', letterSpacing: '0.3px' }}>
              CinemaAdmin
            </div>
            <div style={{ color: '#94a3b8', fontSize: '11px' }}>Management Panel</div>
          </div>
        )}


      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Admin navigation">
        {!collapsed && (
          <div
            style={{
              color: '#475569',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              padding: '0 8px 8px',
            }}
          >
            Menu
          </div>
        )}

        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: collapsed ? '10px 14px' : '10px 12px',
                borderRadius: '10px',
                marginBottom: '4px',
                textDecoration: 'none',
                color: isActive ? '#ffffff' : '#94a3b8',
                background: isActive
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(139,92,246,0.2))'
                  : 'transparent',
                border: isActive ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                justifyContent: collapsed ? 'center' : 'flex-start',
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.06)';
                  (e.currentTarget as HTMLAnchorElement).style.color = '#e2e8f0';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                  (e.currentTarget as HTMLAnchorElement).style.color = '#94a3b8';
                }
              }}
            >
              {/* Active left indicator bar */}
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '3px',
                    height: '60%',
                    background: 'linear-gradient(180deg, #6366f1, #8b5cf6)',
                    borderRadius: '0 3px 3px 0',
                  }}
                />
              )}

              <span
                style={{
                  flexShrink: 0,
                  color: isActive ? '#a5b4fc' : 'inherit',
                  display: 'flex',
                }}
              >
                {item.icon}
              </span>

              {!collapsed && (
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 400,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
            <FaChair />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-white">Admin</div>
              <div className="mt-0.5 text-[11px] font-bold text-slate-400">System operator</div>
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                Admin
              </div>
              <div style={{ color: '#64748b', fontSize: '11px', whiteSpace: 'nowrap' }}>Administrator</div>
            </div>
          </div>
        ) : (
          <div
            title="Admin"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '13px',
              fontWeight: 700,
              margin: '0 auto',
            }}
          >
            A
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
