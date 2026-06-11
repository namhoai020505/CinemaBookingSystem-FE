import { Link, Navigate } from 'react-router-dom';
import {
  FiClock,
  FiCreditCard,
  FiFilm,
  FiMail,
  FiShield,
  FiUser,
} from 'react-icons/fi';
import { getCurrentUserProfile } from '../../lib/auth';

const roleLabels: Record<string, string> = {
  Admin: 'Quản trị viên',
  Manager: 'Quản lý',
  Staff: 'Nhân viên',
  Customer: 'Thành viên',
};

const formatDateTime = (value: Date | null) => {
  if (!value) {
    return 'Không xác định';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value);
};

export default function Profile() {
  const profile = getCurrentUserProfile();

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  const roleLabel = roleLabels[profile.role] || profile.role || 'Thành viên';
  const displayInitial = (profile.fullName || profile.email || 'G').trim().charAt(0).toUpperCase();

  return (
    <div className="-m-4 min-h-[calc(100vh-220px)] bg-[#182437] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#FFD166]">
            Tài khoản G2Cinema
          </span>
          <h1 className="text-2xl font-extrabold uppercase sm:text-3xl">Thông tin thành viên</h1>
        </div>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-lg border border-white/10 bg-[#0F172A] p-6 shadow-xl shadow-black/20">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFD166] to-[#FFEBA4] text-3xl font-black text-[#0F172A]">
                {displayInitial}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-extrabold">{profile.fullName}</h2>
                <p className="mt-1 flex items-center gap-2 text-sm text-white/70">
                  <FiShield className="shrink-0 text-[#FFD166]" />
                  {roleLabel}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3 text-sm">
              <div className="flex items-start gap-3 rounded-md bg-white/5 p-3">
                <FiMail className="mt-0.5 shrink-0 text-[#FFD166]" />
                <div className="min-w-0">
                  <p className="text-white/50">Email</p>
                  <p className="truncate font-semibold">{profile.email || 'Chưa có email'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md bg-white/5 p-3">
                <FiUser className="mt-0.5 shrink-0 text-[#FFD166]" />
                <div className="min-w-0">
                  <p className="text-white/50">Mã tài khoản</p>
                  <p className="truncate font-semibold">{profile.userId || 'Không xác định'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md bg-white/5 p-3">
                <FiClock className="mt-0.5 shrink-0 text-[#FFD166]" />
                <div className="min-w-0">
                  <p className="text-white/50">Phiên đăng nhập hết hạn</p>
                  <p className="font-semibold">{formatDateTime(profile.expiresAt)}</p>
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-lg border border-white/10 bg-[#0F172A] p-6 shadow-xl shadow-black/20">
              <h2 className="text-lg font-extrabold uppercase">Tổng quan thành viên</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-md bg-white/5 p-4">
                  <p className="flex items-center gap-2 text-sm text-white/60">
                    <FiCreditCard className="text-[#FFD166]" />
                    Hạng thành viên
                  </p>
                  <p className="mt-3 text-xl font-black text-[#FFD166]">Standard</p>
                </div>
                <div className="rounded-md bg-white/5 p-4">
                  <p className="flex items-center gap-2 text-sm text-white/60">
                    <FiFilm className="text-[#FFD166]" />
                    Vé đã đặt
                  </p>
                  <p className="mt-3 text-xl font-black text-white">0</p>
                </div>
                <div className="rounded-md bg-white/5 p-4">
                  <p className="flex items-center gap-2 text-sm text-white/60">
                    <FiShield className="text-[#FFD166]" />
                    Điểm thưởng
                  </p>
                  <p className="mt-3 text-xl font-black text-white">0</p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-[#0F172A] p-6 shadow-xl shadow-black/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-extrabold uppercase">Lịch sử hoạt động</h2>
                  <p className="mt-1 text-sm text-white/60">
                    Các booking và điểm thưởng sẽ hiển thị tại đây khi backend mở API profile.
                  </p>
                </div>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-[#FFD166] to-[#FFEBA4] px-5 py-2.5 text-sm font-extrabold uppercase text-black transition hover:brightness-105"
                >
                  Xem phim đang chiếu
                </Link>
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
