import axios from 'axios';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiEdit3,
  FiFilm,
  FiLock,
  FiMail,
  FiMapPin,
  FiPhone,
  FiShield,
  FiUser,
} from 'react-icons/fi';
import { getCurrentUserProfile } from '../../lib/auth';
import {
  customerService,
  type CustomerProfile,
  type UpdateCustomerProfileRequest,
} from '../../services/customerService';

type AuthProfile = NonNullable<ReturnType<typeof getCurrentUserProfile>>;

type ProfileFormState = {
  fullName: string;
  phoneNumber: string;
  address: string;
  avatarUrl: string;
  gender: string;
  dateOfBirth: string;
};

type PasswordFormState = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type EmailFormState = {
  newEmail: string;
  otp: string;
};

type ApiErrorBody = {
  message?: string;
  errorCode?: string | null;
  errors?: Record<string, string[]>;
};

const roleLabels: Record<string, string> = {
  Admin: 'Quản trị viên',
  Manager: 'Quản lý',
  Staff: 'Nhân viên',
  Customer: 'Thành viên',
};

const apiErrorMessages: Record<string, string> = {
  USER_NOT_FOUND: 'Không tìm thấy tài khoản.',
  PROFILE_NOT_FOUND: 'Không tìm thấy hồ sơ khách hàng.',
  INVALID_OLD_PASSWORD: 'Mật khẩu hiện tại không đúng.',
  WEAK_PASSWORD: 'Mật khẩu mới chưa đủ mạnh.',
  DUPLICATE_EMAIL: 'Email này đã được sử dụng.',
  INVALID_OTP: 'Mã OTP không hợp lệ hoặc đã hết hạn.',
  EMAIL_SEND_FAILED: 'Không gửi được email OTP. Vui lòng thử lại sau.',
};

const emptyProfileForm: ProfileFormState = {
  fullName: '',
  phoneNumber: '',
  address: '',
  avatarUrl: '',
  gender: '',
  dateOfBirth: '',
};

const emptyPasswordForm: PasswordFormState = {
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const emptyEmailForm: EmailFormState = {
  newEmail: '',
  otp: '',
};

// Format datetime cho các mốc như token hết hạn hoặc OTP đổi email hết hạn.
const formatDateTime = (value: Date | string | null | undefined) => {
  if (!value) {
    return 'Không xác định';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Không xác định';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

// Chuyển date từ API về yyyy-MM-dd để input type="date" hiển thị đúng.
const normalizeDateInput = (value: string | null | undefined) => {
  if (!value) {
    return '';
  }

  return value.slice(0, 10);
};

// Lấy message đầu tiên từ object validation errors của ASP.NET.
const getValidationMessage = (errors?: Record<string, string[]>) => {
  if (!errors) {
    return '';
  }

  return Object.values(errors)
    .flat()
    .filter(Boolean)
    .join(' ');
};

// Chuẩn hóa lỗi API thành message cho từng form profile/password/email.
const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const body = error.response?.data;
    const validationMessage = getValidationMessage(body?.errors);

    if (body?.errorCode && apiErrorMessages[body.errorCode]) {
      return apiErrorMessages[body.errorCode];
    }

    return validationMessage || body?.message || error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

// Nếu API profile lỗi/chưa có dữ liệu, dùng thông tin trong JWT để vẫn hiển thị được header.
const createFallbackProfile = (authProfile: AuthProfile): CustomerProfile => ({
  userId: authProfile.userId,
  customerProfileId: '',
  email: authProfile.email,
  fullName: authProfile.fullName,
  phoneNumber: null,
  address: null,
  avatarUrl: null,
  gender: null,
  dateOfBirth: null,
  memberLevel: 'Standard',
  rewardPoints: 0,
  status: 'Active',
  emailVerified: false,
});

// Map profile backend sang state form chỉnh sửa thông tin cá nhân.
const toProfileForm = (profile: CustomerProfile): ProfileFormState => ({
  fullName: profile.fullName || '',
  phoneNumber: profile.phoneNumber || '',
  address: profile.address || '',
  avatarUrl: profile.avatarUrl || '',
  gender: profile.gender || '',
  dateOfBirth: normalizeDateInput(profile.dateOfBirth),
});

// Component nhỏ hiển thị thông báo thành công/lỗi cho từng khối form.
const StatusMessage = ({
  message,
  type,
}: {
  message: string;
  type: 'success' | 'error';
}) => {
  if (!message) {
    return null;
  }

  const Icon = type === 'success' ? FiCheckCircle : FiAlertCircle;
  const className =
    type === 'success'
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
      : 'border-red-400/30 bg-red-400/10 text-red-100';

  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${className}`}>
      <Icon className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
};

// Trang thông tin tài khoản: xem/sửa profile, đổi mật khẩu và đổi email bằng OTP.
export default function Profile() {
  const authProfile = useMemo(() => getCurrentUserProfile(), []);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(emptyProfileForm);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(emptyPasswordForm);
  const [emailForm, setEmailForm] = useState<EmailFormState>(emptyEmailForm);
  const [pendingEmail, setPendingEmail] = useState('');
  const [emailOtpExpiresAt, setEmailOtpExpiresAt] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isRequestingEmailOtp, setIsRequestingEmailOtp] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);

  // Tải profile từ backend, fallback sang JWT nếu API chưa có dữ liệu đầy đủ.
  const loadProfile = useCallback(
    async (silent = false) => {
      if (!authProfile) {
        return;
      }

      if (!silent) {
        setIsProfileLoading(true);
      }

      setProfileError('');

      try {
        const response = await customerService.getProfile();

        if (!response.success || !response.data) {
          throw new Error(response.message || 'Không tải được thông tin tài khoản.');
        }

        setProfile(response.data);
        setProfileForm(toProfileForm(response.data));

        if (response.data.fullName) {
          localStorage.setItem('fullName', response.data.fullName);
        }
      } catch (error) {
        setProfileError(getErrorMessage(error, 'Không tải được thông tin tài khoản.'));
        setProfile(createFallbackProfile(authProfile));
      } finally {
        if (!silent) {
          setIsProfileLoading(false);
        }
      }
    },
    [authProfile]
  );

  // Load profile sau khi component mount.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadProfile();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadProfile]);

  if (!authProfile) {
    return <Navigate to="/login" replace />;
  }

  const displayProfile = profile ?? createFallbackProfile(authProfile);
  const roleLabel = roleLabels[authProfile.role] || authProfile.role || 'Thành viên';
  const displayName = displayProfile.fullName || authProfile.fullName || 'Thành viên';
  const displayEmail = displayProfile.email || authProfile.email || 'Chưa có email';
  const displayInitial = (displayName || displayEmail || 'G').trim().charAt(0).toUpperCase();

  // Cập nhật từng field của form thông tin cá nhân.
  const updateProfileForm = (field: keyof ProfileFormState, value: string) => {
    setProfileForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  // Cập nhật từng field của form đổi mật khẩu.
  const updatePasswordForm = (field: keyof PasswordFormState, value: string) => {
    setPasswordForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  // Cập nhật từng field của form đổi email.
  const updateEmailForm = (field: keyof EmailFormState, value: string) => {
    setEmailForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  // Gửi PUT /api/customer/profile để cập nhật thông tin cá nhân.
  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    const fullName = profileForm.fullName.trim();
    if (!fullName) {
      setProfileError('Vui lòng nhập họ tên.');
      return;
    }

    const request: UpdateCustomerProfileRequest = {
      fullName,
      phoneNumber: profileForm.phoneNumber.trim() || undefined,
      address: profileForm.address.trim() || undefined,
      avatarUrl: profileForm.avatarUrl.trim() || undefined,
      gender: profileForm.gender || undefined,
      dateOfBirth: profileForm.dateOfBirth || undefined,
    };

    setIsSavingProfile(true);

    try {
      const response = await customerService.updateProfile(request);

      if (!response.success) {
        throw new Error(response.message || 'Cập nhật hồ sơ thất bại.');
      }

      const nextProfile = response.data ?? {
        ...displayProfile,
        ...request,
      };

      setProfile(nextProfile);
      setProfileForm(toProfileForm(nextProfile));
      localStorage.setItem('fullName', nextProfile.fullName || fullName);
      setProfileSuccess('Đã cập nhật thông tin tài khoản.');
    } catch (error) {
      setProfileError(getErrorMessage(error, 'Cập nhật hồ sơ thất bại.'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Gửi POST /customer/change-password sau khi validate mật khẩu xác nhận.
  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordForm.oldPassword || !passwordForm.newPassword) {
      setPasswordError('Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Xác nhận mật khẩu mới chưa khớp.');
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await customerService.changePassword(
        passwordForm.oldPassword,
        passwordForm.newPassword
      );

      if (!response.success) {
        throw new Error(response.message || 'Đổi mật khẩu thất bại.');
      }

      setPasswordForm(emptyPasswordForm);
      setPasswordSuccess('Đã đổi mật khẩu thành công.');
    } catch (error) {
      setPasswordError(getErrorMessage(error, 'Đổi mật khẩu thất bại.'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Gửi OTP đổi email tới email mới.
  const handleRequestEmailOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailError('');
    setEmailSuccess('');

    const newEmail = emailForm.newEmail.trim();
    if (!newEmail) {
      setEmailError('Vui lòng nhập email mới.');
      return;
    }

    setIsRequestingEmailOtp(true);

    try {
      const response = await customerService.requestEmailChange(newEmail);

      if (!response.success) {
        throw new Error(response.message || 'Không gửi được OTP đổi email.');
      }

      setPendingEmail(newEmail);
      setEmailOtpExpiresAt(response.data?.expiresAt || '');
      setEmailForm((current) => ({
        ...current,
        otp: '',
      }));
      setEmailSuccess('OTP đã được gửi tới email mới.');
    } catch (error) {
      setEmailError(getErrorMessage(error, 'Không gửi được OTP đổi email.'));
    } finally {
      setIsRequestingEmailOtp(false);
    }
  };

  // Xác thực OTP đổi email rồi reload profile mới.
  const handleVerifyEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailError('');
    setEmailSuccess('');

    const otp = emailForm.otp.trim();
    if (!pendingEmail || !otp) {
      setEmailError('Vui lòng nhập mã OTP.');
      return;
    }

    setIsVerifyingEmail(true);

    try {
      const response = await customerService.verifyEmailChange(pendingEmail, otp);

      if (!response.success) {
        throw new Error(response.message || 'Xác thực email thất bại.');
      }

      setEmailForm(emptyEmailForm);
      setPendingEmail('');
      setEmailOtpExpiresAt('');
      setEmailSuccess('Đã đổi email thành công.');
      await loadProfile(true);
    } catch (error) {
      setEmailError(getErrorMessage(error, 'Xác thực email thất bại.'));
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-220px)] bg-[#182437] px-4 py-10 text-white sm:px-6">
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
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#FFD166] to-[#FFEBA4] text-3xl font-black text-[#0F172A]">
                {displayProfile.avatarUrl ? (
                  <img
                    src={displayProfile.avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  displayInitial
                )}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-extrabold">{displayName}</h2>
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
                  <p className="truncate font-semibold">{displayEmail}</p>
                  <p className="mt-1 text-xs text-white/45">
                    {displayProfile.emailVerified ? 'Đã xác thực' : 'Chưa xác thực'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md bg-white/5 p-3">
                <FiPhone className="mt-0.5 shrink-0 text-[#FFD166]" />
                <div className="min-w-0">
                  <p className="text-white/50">Số điện thoại</p>
                  <p className="truncate font-semibold">
                    {displayProfile.phoneNumber || 'Chưa cập nhật'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md bg-white/5 p-3">
                <FiUser className="mt-0.5 shrink-0 text-[#FFD166]" />
                <div className="min-w-0">
                  <p className="text-white/50">Mã tài khoản</p>
                  <p className="truncate font-semibold">
                    {displayProfile.userId || 'Không xác định'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md bg-white/5 p-3">
                <FiClock className="mt-0.5 shrink-0 text-[#FFD166]" />
                <div className="min-w-0">
                  <p className="text-white/50">Phiên đăng nhập hết hạn</p>
                  <p className="font-semibold">{formatDateTime(authProfile.expiresAt)}</p>
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
                  <p className="mt-3 text-xl font-black text-[#FFD166]">
                    {displayProfile.memberLevel || 'Standard'}
                  </p>
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
                  <p className="mt-3 text-xl font-black text-white">
                    {displayProfile.rewardPoints ?? 0}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-[#0F172A] p-6 shadow-xl shadow-black/20">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-extrabold uppercase">
                    <FiEdit3 className="text-[#FFD166]" />
                    Cập nhật hồ sơ
                  </h2>
                  <p className="mt-1 text-sm text-white/60">
                    Thông tin này được lấy từ API profile của tài khoản đang đăng nhập.
                  </p>
                </div>
                {isProfileLoading ? (
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
                    Đang tải
                  </span>
                ) : null}
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <StatusMessage message={profileError} type="error" />
                <StatusMessage message={profileSuccess} type="success" />

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-semibold text-white/70">
                    Họ tên
                    <input
                      value={profileForm.fullName}
                      onChange={(event) => updateProfileForm('fullName', event.target.value)}
                      className="w-full rounded-md border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition focus:border-[#FFD166]"
                      placeholder="Nhập họ tên"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-semibold text-white/70">
                    Số điện thoại
                    <input
                      value={profileForm.phoneNumber}
                      onChange={(event) => updateProfileForm('phoneNumber', event.target.value)}
                      className="w-full rounded-md border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition focus:border-[#FFD166]"
                      placeholder="Nhập số điện thoại"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-semibold text-white/70">
                    Giới tính
                    <select
                      value={profileForm.gender}
                      onChange={(event) => updateProfileForm('gender', event.target.value)}
                      className="w-full rounded-md border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition focus:border-[#FFD166]"
                    >
                      <option value="">Chưa chọn</option>
                      <option value="Male">Nam</option>
                      <option value="Female">Nữ</option>
                      <option value="Other">Khác</option>
                    </select>
                  </label>

                  <label className="space-y-2 text-sm font-semibold text-white/70">
                    Ngày sinh
                    <input
                      type="date"
                      value={profileForm.dateOfBirth}
                      onChange={(event) => updateProfileForm('dateOfBirth', event.target.value)}
                      className="w-full rounded-md border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition focus:border-[#FFD166]"
                    />
                  </label>
                </div>

                <label className="space-y-2 text-sm font-semibold text-white/70">
                  Địa chỉ
                  <div className="relative">
                    <FiMapPin className="pointer-events-none absolute left-4 top-3.5 text-white/35" />
                    <input
                      value={profileForm.address}
                      onChange={(event) => updateProfileForm('address', event.target.value)}
                      className="w-full rounded-md border border-white/10 bg-[#111827] px-11 py-3 text-white outline-none transition focus:border-[#FFD166]"
                      placeholder="Nhập địa chỉ"
                    />
                  </div>
                </label>

                <label className="space-y-2 text-sm font-semibold text-white/70">
                  Avatar URL
                  <input
                    value={profileForm.avatarUrl}
                    onChange={(event) => updateProfileForm('avatarUrl', event.target.value)}
                    className="w-full rounded-md border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition focus:border-[#FFD166]"
                    placeholder="https://..."
                  />
                </label>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="rounded-md bg-gradient-to-r from-[#FFD166] to-[#FFEBA4] px-6 py-3 text-sm font-extrabold uppercase text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingProfile ? 'Đang lưu...' : 'Lưu thông tin'}
                  </button>
                </div>
              </form>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <form
                onSubmit={handlePasswordSubmit}
                className="rounded-lg border border-white/10 bg-[#0F172A] p-6 shadow-xl shadow-black/20"
              >
                <h2 className="flex items-center gap-2 text-lg font-extrabold uppercase">
                  <FiLock className="text-[#FFD166]" />
                  Đổi mật khẩu
                </h2>
                <div className="mt-5 space-y-4">
                  <StatusMessage message={passwordError} type="error" />
                  <StatusMessage message={passwordSuccess} type="success" />

                  <label className="space-y-2 text-sm font-semibold text-white/70">
                    Mật khẩu hiện tại
                    <input
                      type="password"
                      value={passwordForm.oldPassword}
                      onChange={(event) => updatePasswordForm('oldPassword', event.target.value)}
                      className="w-full rounded-md border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition focus:border-[#FFD166]"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-semibold text-white/70">
                    Mật khẩu mới
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(event) => updatePasswordForm('newPassword', event.target.value)}
                      className="w-full rounded-md border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition focus:border-[#FFD166]"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-semibold text-white/70">
                    Xác nhận mật khẩu mới
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(event) =>
                        updatePasswordForm('confirmPassword', event.target.value)
                      }
                      className="w-full rounded-md border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition focus:border-[#FFD166]"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="w-full rounded-md bg-gradient-to-r from-[#FFD166] to-[#FFEBA4] px-6 py-3 text-sm font-extrabold uppercase text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isChangingPassword ? 'Đang đổi...' : 'Đổi mật khẩu'}
                  </button>
                </div>
              </form>

              <div className="rounded-lg border border-white/10 bg-[#0F172A] p-6 shadow-xl shadow-black/20">
                <h2 className="flex items-center gap-2 text-lg font-extrabold uppercase">
                  <FiMail className="text-[#FFD166]" />
                  Đổi email
                </h2>

                <form onSubmit={handleRequestEmailOtp} className="mt-5 space-y-4">
                  <StatusMessage message={emailError} type="error" />
                  <StatusMessage message={emailSuccess} type="success" />

                  <label className="space-y-2 text-sm font-semibold text-white/70">
                    Email mới
                    <input
                      type="email"
                      value={emailForm.newEmail}
                      onChange={(event) => updateEmailForm('newEmail', event.target.value)}
                      className="w-full rounded-md border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition focus:border-[#FFD166]"
                      placeholder="email-moi@example.com"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={isRequestingEmailOtp}
                    className="w-full rounded-md border border-[#FFD166] px-6 py-3 text-sm font-extrabold uppercase text-[#FFD166] transition hover:bg-[#FFD166] hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRequestingEmailOtp ? 'Đang gửi...' : 'Gửi OTP đổi email'}
                  </button>
                </form>

                {pendingEmail ? (
                  <form onSubmit={handleVerifyEmail} className="mt-5 space-y-4 border-t border-white/10 pt-5">
                    <div className="rounded-md bg-white/5 p-3 text-sm text-white/70">
                      OTP đã gửi tới <span className="font-bold text-white">{pendingEmail}</span>
                      {emailOtpExpiresAt ? (
                        <span>. Hết hạn lúc {formatDateTime(emailOtpExpiresAt)}.</span>
                      ) : null}
                    </div>

                    <label className="space-y-2 text-sm font-semibold text-white/70">
                      Mã OTP
                      <input
                        value={emailForm.otp}
                        onChange={(event) => updateEmailForm('otp', event.target.value)}
                        className="w-full rounded-md border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition focus:border-[#FFD166]"
                        placeholder="Nhập OTP"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={isVerifyingEmail}
                      className="w-full rounded-md bg-gradient-to-r from-[#FFD166] to-[#FFEBA4] px-6 py-3 text-sm font-extrabold uppercase text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isVerifyingEmail ? 'Đang xác thực...' : 'Xác nhận đổi email'}
                    </button>
                  </form>
                ) : null}
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-[#0F172A] p-6 shadow-xl shadow-black/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-extrabold uppercase">Lịch sử hoạt động</h2>
                  <p className="mt-1 text-sm text-white/60">
                    Booking sẽ hiển thị tại đây khi nối tiếp API lịch sử vé.
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
