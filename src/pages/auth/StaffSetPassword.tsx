import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiLock, FiMail } from 'react-icons/fi';
import api from '../../lib/api';
import Header from '../../layouts/user/Header';
import Footer from '../../layouts/user/Footer';

type ParsedApiError = {
  message: string;
  errorCode?: string;
};

const resetErrorMessages: Record<string, string> = {
  USER_NOT_FOUND: 'Không tìm thấy tài khoản staff với email này.',
  OTP_NOT_FOUND: 'Không tìm thấy mã invitation.',
  OTP_EXPIRED: 'Mã invitation đã hết hạn. Vui lòng liên hệ admin để gửi lại lời mời.',
  INVALID_OTP: 'Mã invitation không đúng.',
  WEAK_PASSWORD: 'Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số.',
  ACCOUNT_NOT_ACTIVE: 'Tài khoản staff chưa ở trạng thái hoạt động.',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseApiError = (error: unknown): ParsedApiError => {
  if (!isRecord(error)) {
    return { message: 'Đã xảy ra lỗi không xác định.' };
  }

  if (isRecord(error.response)) {
    const data = error.response.data;

    if (isRecord(data)) {
      const errorCode = typeof data.errorCode === 'string' ? data.errorCode : undefined;
      const mappedMessage = errorCode ? resetErrorMessages[errorCode] : undefined;

      if (mappedMessage) {
        return { message: mappedMessage, errorCode };
      }

      if (typeof data.message === 'string' && data.message.trim()) {
        return { message: data.message, errorCode };
      }
    }
  }

  if ('request' in error) {
    return { message: 'Không thể kết nối backend. Hãy kiểm tra API đã chạy chưa.' };
  }

  return { message: 'Đã xảy ra lỗi không xác định.' };
};

export default function StaffSetPassword() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get('email') || '');
  const [otp, setOtp] = useState(() => searchParams.get('otp') || searchParams.get('code') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!/^\d{6}$/.test(otp)) {
      setError('Mã invitation phải gồm đúng 6 chữ số.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post('/api/auth/reset-password', {
        email: email.trim().toLowerCase(),
        otp,
        newPassword,
      });

      setSuccessMessage('Tạo mật khẩu staff thành công. Bạn có thể đăng nhập bằng tài khoản staff.');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setError(parseApiError(err).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#1E293B]">
      <Header />

      <main className="flex min-h-[80vh] items-center justify-center bg-[#1E293B] px-4 py-12">
        <div className="w-full max-w-md rounded-lg border border-gray-700 bg-[#0F172A] p-6 shadow-2xl">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold uppercase text-white">Tạo Mật Khẩu Staff</h1>
            <p className="mt-2 text-sm text-gray-400">Nhập mã invitation đã nhận trong email.</p>
          </div>

          {successMessage ? (
            <div className="mb-4 rounded border border-emerald-400 bg-emerald-400/10 p-3 text-center text-sm text-emerald-300">
              {successMessage}
            </div>
          ) : null}

          {error ? (
            <div className="mb-4 rounded border border-red-500 bg-red-500/10 p-3 text-center text-sm text-red-400">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm text-gray-300">Email</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <FiMail />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="staff@example.com"
                  className="w-full rounded-md border border-gray-600 bg-transparent py-2 pl-10 pr-4 text-sm text-white transition placeholder-gray-500 focus:border-[#FFD166] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-300">Mã Invitation</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <FiLock />
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
                  placeholder="Nhập mã 6 số"
                  className="w-full rounded-md border border-gray-600 bg-transparent py-2 pl-10 pr-4 text-sm text-white transition placeholder-gray-500 focus:border-[#FFD166] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-300">Mật khẩu mới</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <FiLock />
                </span>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Nhập mật khẩu mới"
                  className="w-full rounded-md border border-gray-600 bg-transparent py-2 pl-10 pr-4 text-sm text-white transition placeholder-gray-500 focus:border-[#FFD166] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-300">Xác nhận mật khẩu mới</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <FiLock />
                </span>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full rounded-md border border-gray-600 bg-transparent py-2 pl-10 pr-4 text-sm text-white transition placeholder-gray-500 focus:border-[#FFD166] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`mt-2 w-full rounded-md bg-gradient-to-r from-[#FFD166] to-[#FFEBA4] py-2.5 text-sm font-bold uppercase text-black shadow-lg transition ${
                isSubmitting ? 'cursor-not-allowed opacity-70' : 'hover:opacity-90'
              }`}
            >
              {isSubmitting ? 'Đang tạo mật khẩu...' : 'Tạo Mật Khẩu Staff'}
            </button>

            <Link
              to="/login"
              className="text-center text-sm text-gray-400 transition hover:text-white"
            >
              Quay lại đăng nhập
            </Link>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
