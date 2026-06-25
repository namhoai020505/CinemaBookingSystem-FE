import { Link, useNavigate } from 'react-router-dom';
import { logout } from '../../services/authService';

interface TopbarProps {
  sidebarCollapsed: boolean;
  onToggle: () => void;
}

const Topbar = ({ onToggle }: TopbarProps) => {
  const navigate = useNavigate();

  // Lấy tên thật từ localStorage, nếu không có thì để mặc định là 'Quản trị viên'
  const fullName = localStorage.getItem('fullName') || 'Quản trị viên';

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header
      style={{
        height: '64px',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        borderBottom: '1px solid #e2e8f0',
        gap: '12px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Hamburger toggle (visible on all sizes as a secondary trigger) */}
      <button
        onClick={onToggle}
        title="Toggle sidebar"
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
          flexShrink: 0,
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9';
          (e.currentTarget as HTMLButtonElement).style.color = '#6366f1';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Breadcrumb / page title placeholder */}
      <div style={{ flex: 1 }} />

      {/* Right section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Notification bell */}
        <button
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            position: 'relative',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9';
            (e.currentTarget as HTMLButtonElement).style.color = '#6366f1';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#ef4444',
              border: '1.5px solid white',
            }}
          />
        </button>

        {/* Divider */}
        <div style={{ width: '1px', height: '24px', background: '#e2e8f0' }} />

        {/* User info */}
        <Link
          to="/profile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            padding: '4px 8px',
            borderRadius: '8px',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLAnchorElement).style.background = '#f1f5f9';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '13px',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ color: '#1e293b', fontSize: '13px', fontWeight: 600, lineHeight: 1.2 }}>
              {fullName}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '11px' }}>Administrator</div>
          </div>
        </Link>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(239,68,68,0.3)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(239,68,68,0.4)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(239,68,68,0.3)';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Đăng xuất
        </button>
      </div>
    </header>
  );
};

export default Topbar;
