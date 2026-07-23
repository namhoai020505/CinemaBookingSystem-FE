import { FaFacebookF } from 'react-icons/fa';
import { FiChevronRight, FiMail, FiMapPin, FiPhone } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import logo from '../../assets/logo.png';

const policyLinks = [
  'Tuyển dụng',
  'Giới thiệu',
  'Liên hệ',
  'Điều khoản sử dụng',
  'Chính sách bảo mật',
  'Hướng dẫn đặt vé online',
];

const cinemaLinks = [
  'G2Cinema Hà Nội',
  'G2Cinema TP HCM',
  'G2Cinema Thái Nguyên',
  'G2Cinema Thanh Hóa',
  'G2Cinema Biên Hòa',
  'G2Cinema Quận 1',
];

const quickLinks = [
  { label: 'Phim đang chiếu', to: '/movies' },
  { label: 'Lịch chiếu theo rạp', to: '/cinema-schedule' },
  { label: 'Giá vé', to: '/ticket-prices' },
  { label: 'Cụm rạp', to: '/cinemas' },
];

const facebookLinks = [
  'https://www.facebook.com/nam.hoai.711250/',
  'https://www.facebook.com/Nina11122005',
  'https://www.facebook.com/nguyen.ang.phu.929399',
  'https://www.facebook.com/dung.shun.nguyen',
  'https://www.facebook.com/lupin3r',
];

export default function Footer() {
  return (
    <footer className="g2c-footer relative z-20 isolate border-t border-slate-200 bg-white text-sm text-slate-700 dark:border-white/10 dark:bg-black dark:text-slate-300">
      <div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1.6fr_1fr]">
          <section className="space-y-5">
            <Link to="/" className="inline-flex items-center gap-3">
              <img src={logo} alt="G2Cinema" className="h-11 object-contain" />
              <span className="sr-only">G2Cinema</span>
            </Link>

            <p className="max-w-sm leading-6 text-slate-400">
              G2Cinema mang đến trải nghiệm đặt vé nhanh, chọn ghế trực quan và
              cập nhật lịch chiếu theo từng cụm rạp.
            </p>

            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FFD166]">
                Hỗ trợ khách hàng
              </p>
              <div className="mt-3 space-y-2 text-slate-300">
                <p className="flex items-center gap-2">
                  <FiPhone className="text-[#FFD166]" aria-hidden="true" />
                  <strong className="text-white">1900 1234</strong>
                </p>
                <p className="flex items-center gap-2">
                  <FiMail className="text-[#FFD166]" aria-hidden="true" />
                  cskh@cinema.vn
                </p>
                <p className="flex items-start gap-2">
                  <FiMapPin className="mt-0.5 text-[#FFD166]" aria-hidden="true" />
                  Các cụm rạp G2Cinema trên toàn quốc
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-8 sm:grid-cols-3">
            <div>
              <h4 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-white">
                Chính sách
              </h4>
              <ul className="space-y-2.5">
                {policyLinks.map((item) => (
                  <li key={item}>
                    <button
                      type="button"
                      className="group inline-flex items-center gap-1.5 text-left text-slate-400 transition hover:text-white"
                    >
                      <FiChevronRight
                        className="text-[#FFD166] transition group-hover:translate-x-0.5"
                        size={14}
                        aria-hidden="true"
                      />
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-white">
                Cụm rạp
              </h4>
              <ul className="space-y-2.5">
                {cinemaLinks.map((item) => (
                  <li key={item}>
                    <Link
                      to="/cinemas"
                      className="group inline-flex items-center gap-1.5 text-slate-400 transition hover:text-white"
                    >
                      <FiChevronRight
                        className="text-[#FFD166] transition group-hover:translate-x-0.5"
                        size={14}
                        aria-hidden="true"
                      />
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-white">
                Truy cập nhanh
              </h4>
              <ul className="space-y-2.5">
                {quickLinks.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="group inline-flex items-center gap-1.5 text-slate-400 transition hover:text-white"
                    >
                      <FiChevronRight
                        className="text-[#FFD166] transition group-hover:translate-x-0.5"
                        size={14}
                        aria-hidden="true"
                      />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="space-y-5">
            <div>
              <h4 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-white">
                Kết nối với chúng tôi
              </h4>
              <p className="leading-6 text-slate-400">
                Theo dõi nhóm phát triển G2Cinema để cập nhật lịch chiếu, ưu đãi
                và các thông báo mới.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {facebookLinks.map((href, index) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Facebook thành viên ${index + 1}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#1877F2]/35 bg-[#1877F2]/15 text-[#8EC5FF] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:border-[#1877F2] hover:bg-[#1877F2] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD166]"
                >
                  <FaFacebookF size={18} aria-hidden="true" />
                </a>
              ))}
            </div>

            <div className="rounded-lg border border-[#FFD166]/25 bg-[#FFD166]/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FFD166]">
                G2Cinema
              </p>
              <p className="mt-2 leading-6 text-slate-300">
                Đặt vé, chọn ghế, thanh toán và nhận mã QR trong một luồng duy
                nhất.
              </p>
            </div>
          </section>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 G2Cinema. All rights reserved.</p>
          <p>Online movie ticket booking system.</p>
        </div>
      </div>
    </footer>
  );
}
