import {
  FiCreditCard,
  FiFileText,
  FiFilm,
  FiHome,
  FiUser,
} from 'react-icons/fi';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AUTH_SESSION_EVENT, getAccessToken } from '../../lib/auth';

const navItems = [
  {
    label: 'Trang chủ',
    to: '/',
    icon: FiHome,
    match: (pathname: string) => pathname === '/',
  },
  {
    label: 'Vé của tôi',
    to: '/my-bookings',
    icon: FiFileText,
    requiresAuth: true,
    match: (pathname: string) => pathname === '/my-bookings',
  },
  {
    label: 'Phim',
    to: '/movies',
    icon: FiFilm,
    match: (pathname: string) =>
      pathname === '/movies' || pathname.startsWith('/movie/'),
  },
  {
    label: 'Giá vé',
    to: '/ticket-prices',
    icon: FiCreditCard,
    match: (pathname: string) => pathname === '/ticket-prices',
  },
  {
    label: 'Tôi',
    to: '/profile',
    icon: FiUser,
    requiresAuth: true,
    match: (pathname: string) => pathname === '/profile',
  },
];

export default function MobileBottomNav() {
  const { pathname } = useLocation();
  const [, setAuthVersion] = useState(0);
  const isLoggedIn = Boolean(getAccessToken());

  useEffect(() => {
    const handleAuthSessionChange = () => {
      setAuthVersion((current) => current + 1);
    };

    window.addEventListener(AUTH_SESSION_EVENT, handleAuthSessionChange);

    return () => {
      window.removeEventListener(AUTH_SESSION_EVENT, handleAuthSessionChange);
    };
  }, []);

  return (
    <nav
      aria-label="Điều hướng khách hàng"
      className="fixed inset-x-0 bottom-0 z-[55] border-t border-slate-200 bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0F172A]/95 md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.match(pathname);
          const href = item.requiresAuth && !isLoggedIn ? '/login' : item.to;

          return (
            <Link
              key={item.label}
              to={href}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166] ${
                isActive
                  ? 'text-[#E11D48] dark:text-[#FFD166]'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white'
              }`}
            >
              <span
                className={`flex h-7 w-9 items-center justify-center rounded-full border transition-colors ${
                  isActive
                    ? 'border-[#E11D48]/25 bg-[#E11D48]/10 dark:border-[#FFD166]/35 dark:bg-[#FFD166]/15'
                    : 'border-transparent bg-transparent'
                }`}
              >
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
