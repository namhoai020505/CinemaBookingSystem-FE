import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEye, FiEyeOff, FiLock, FiMail, FiPhone, FiRefreshCw, FiUser } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import api from '../../lib/api';
import Header from '../../layouts/user/Header';
import Footer from '../../layouts/user/Footer';

type AuthMode = 'login' | 'register' | 'forgot';
type RegisterStep = 'form' | 'verify';
type PasswordResetStep = 'request' | 'reset';

type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data?: T | null;
  errorCode?: string | null;
  errors?: Record<string, string[]> | null;
};

type AuthResponseData = {
  accessToken?: string;
  token?: string;
  refreshToken?: string;
  fullName?: string;
  role?: string;
};

type RegisterResponseData = {
  email?: string;
  expiresAt?: string;
  attemptsRemaining?: number;
};

type ParsedApiError = {
  message: string;
  errorCode?: string;
  retryAfterSeconds?: number;
};

const apiErrorMessages: Record<string, string> = {
  DUPLICATE_EMAIL: 'Email này đã được sử dụng.',
  PENDING_REGISTRATION_EXISTS:
    'Email này đang chờ xác thực. Vui lòng dùng mật khẩu đã đăng ký trước đó để đổi thông tin.',
  EMAIL_NOT_REGISTERED: 'Email này chưa được đăng ký.',
  WEAK_PASSWORD: 'Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số.',
  EMAIL_SEND_FAILED: 'Không gửi được email OTP. Vui lòng kiểm tra cấu hình SMTP backend.',
  USER_NOT_FOUND: 'Không tìm thấy tài khoản với email này.',
  EMAIL_ALREADY_VERIFIED: 'Email này đã được xác thực.',
  OTP_NOT_FOUND: 'Không tìm thấy mã OTP.',
  OTP_EXPIRED: 'Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.',
  INVALID_OTP: 'Mã OTP không đúng.',
  EMAIL_NOT_VERIFIED: 'Email chưa được xác thực. Vui lòng nhập mã OTP đã nhận.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  ACCOUNT_NOT_ACTIVE: 'Tài khoản chưa ở trạng thái hoạt động.',
  OTP_RESEND_COOLDOWN: 'Vui lòng chờ trước khi gửi lại OTP.',
  OTP_SEND_LIMIT_REACHED: 'Bạn đã gửi OTP đủ 5 lần. Vui lòng thử lại sau 2 giờ.',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const createCaptcha = () => Math.floor(10000 + Math.random() * 90000).toString();

const getRetryAfterSeconds = (errors: unknown) => {
  if (!isRecord(errors)) {
    return undefined;
  }

  const retryAfterValues = errors.retryAfterSeconds;
  if (!Array.isArray(retryAfterValues) || typeof retryAfterValues[0] !== 'string') {
    return undefined;
  }

  const retryAfterSeconds = Number.parseInt(retryAfterValues[0], 10);
  return Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined;
};

const getOtpValidSeconds = (expiresAt?: string) => {
  if (!expiresAt) {
    return 60;
  }

  const expiryTime = new Date(expiresAt).getTime();
  if (Number.isNaN(expiryTime)) {
    return 60;
  }

  return Math.max(0, Math.ceil((expiryTime - Date.now()) / 1000));
};

const formatCountdown = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} giờ ${minutes.toString().padStart(2, '0')} phút`;
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const unwrapApiResponse = <T,>(response: unknown): ApiResponse<T> => {
  if (isRecord(response)) {
    if (typeof response.success === 'boolean') {
      return response as ApiResponse<T>;
    }

    if (isRecord(response.data) && typeof response.data.success === 'boolean') {
      return response.data as ApiResponse<T>;
    }
  }

  return {
    success: true,
    message: 'Success',
    data: response as T,
  };
};

const parseApiError = (error: unknown): ParsedApiError => {
  if (!isRecord(error)) {
    return { message: 'Đã xảy ra lỗi không xác định.' };
  }

  if (isRecord(error.response)) {
    const status = typeof error.response.status === 'number' ? error.response.status : undefined;
    const data = error.response.data;

    if (isRecord(data)) {
      const errorCode = typeof data.errorCode === 'string' ? data.errorCode : undefined;
      const retryAfterSeconds = getRetryAfterSeconds(data.errors);
      const mappedMessage = errorCode ? apiErrorMessages[errorCode] : undefined;

      if (mappedMessage) {
        return { message: mappedMessage, errorCode, retryAfterSeconds };
      }

      if (typeof data.message === 'string' && data.message.trim()) {
        return { message: data.message, errorCode, retryAfterSeconds };
      }

      if (isRecord(data.errors)) {
        const firstField = Object.keys(data.errors)[0];
        const firstErrors = firstField ? data.errors[firstField] : undefined;

        if (Array.isArray(firstErrors) && typeof firstErrors[0] === 'string') {
          return { message: firstErrors[0], errorCode, retryAfterSeconds };
        }
      }
    }

    return { message: status ? `Lỗi từ server (${status}).` : 'Lỗi từ server.' };
  }

  if ('request' in error) {
    return {
      message: 'Không thể kết nối đến backend. Hãy kiểm tra backend đã chạy chưa hoặc lỗi CORS.',
    };
  }

  return { message: 'Đã xảy ra lỗi không xác định.' };
};

export default function Login() {
  const navigate = useNavigate();

  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [registerStep, setRegisterStep] = useState<RegisterStep>('form');
  const [passwordResetStep, setPasswordResetStep] = useState<PasswordResetStep>('request');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingPasswordResetEmail, setPendingPasswordResetEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [captchaText, setCaptchaText] = useState(createCaptcha);
  const [captchaInput, setCaptchaInput] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [otpValidSeconds, setOtpValidSeconds] = useState<number | null>(null);
  const [otpAttemptsRemaining, setOtpAttemptsRemaining] = useState<number | null>(null);

  const isLoginMode = authMode === 'login';
  const isRegisterMode = authMode === 'register';
  const isForgotMode = authMode === 'forgot';
  const isVerifyStep = authMode === 'register' && registerStep === 'verify';
  const isResetPasswordStep = authMode === 'forgot' && passwordResetStep === 'reset';
  const verificationEmail = pendingEmail || normalizeEmail(email);
  const passwordResetEmail = pendingPasswordResetEmail || normalizeEmail(email);
  const hasActiveOtpTimer =
    resendCooldownSeconds > 0 || (otpValidSeconds !== null && otpValidSeconds > 0);

  useEffect(() => {
    if (!hasActiveOtpTimer) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCooldownSeconds((current) => Math.max(0, current - 1));
      setOtpValidSeconds((current) =>
        current === null ? null : Math.max(0, current - 1),
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [hasActiveOtpTimer]);

  const generateCaptcha = () => {
    setCaptchaText(createCaptcha());
    setCaptchaInput('');
  };

  const resetFeedback = () => {
    setError('');
    setSuccessMessage('');
  };

  const resetOtpState = () => {
    setOtp('');
    setResendCooldownSeconds(0);
    setOtpValidSeconds(null);
    setOtpAttemptsRemaining(null);
  };

  const startOtpWindow = (data?: RegisterResponseData | null) => {
    const validSeconds = getOtpValidSeconds(data?.expiresAt);
    setOtpValidSeconds(validSeconds);
    setResendCooldownSeconds(data?.attemptsRemaining === 0 ? 2 * 60 * 60 : validSeconds);
    setOtpAttemptsRemaining(data?.attemptsRemaining ?? null);
  };

  const applyOtpApiError = (apiError: ParsedApiError) => {
    setError(apiError.message);

    if (apiError.retryAfterSeconds) {
      setResendCooldownSeconds(apiError.retryAfterSeconds);
    }
  };

  const switchMode = (nextMode: AuthMode) => {
    setAuthMode(nextMode);
    setRegisterStep('form');
    setPasswordResetStep('request');
    setPendingEmail('');
    setPendingPasswordResetEmail('');
    resetOtpState();
    setNewPassword('');
    setShowPassword(false);
    setShowNewPassword(false);
    setConfirmNewPassword('');
    resetFeedback();
    generateCaptcha();
  };

  const validateCaptcha = () => {
    if (captchaInput === captchaText) {
      return true;
    }

    setError('Mã xác thực không đúng. Vui lòng thử lại.');
    generateCaptcha();
    return false;
  };

  const handleLogin = async () => {
    setIsLoading(true);

    try {
      const response = unwrapApiResponse<AuthResponseData>(
        await api.post('/api/auth/login', {
          email: normalizeEmail(email),
          password,
        }),
      );
      const authData = response.data;
      const token = authData?.accessToken || authData?.token;

      if (!token) {
        setError('Đăng nhập thành công nhưng backend không trả về access token.');
        return;
      }

      localStorage.setItem('accessToken', token);
      localStorage.setItem('role', authData?.role || '');
      localStorage.setItem('fullName', authData?.fullName || 'Người dùng');

      if (authData?.refreshToken) {
        localStorage.setItem('refreshToken', authData.refreshToken);
      }

      navigate(authData?.role === 'Admin' ? '/admin/dashboard' : '/');
    } catch (err: unknown) {
      const apiError = parseApiError(err);

      if (apiError.errorCode === 'EMAIL_NOT_VERIFIED') {
        setAuthMode('register');
        setRegisterStep('verify');
        setPendingEmail(normalizeEmail(email));
        resetOtpState();
        setSuccessMessage('Email chưa xác thực. Nhập OTP đã nhận hoặc gửi lại mã mới.');
        return;
      }

      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    const trimmedName = fullName.trim();
    const trimmedPhoneNumber = phoneNumber.trim();

    if (!trimmedName) {
      setError('Vui lòng nhập họ và tên.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsLoading(true);

    try {
      const response = unwrapApiResponse<RegisterResponseData>(
        await api.post('/api/auth/register', {
          email: normalizeEmail(email),
          password,
          fullName: trimmedName,
          phoneNumber: trimmedPhoneNumber || undefined,
        }),
      );
      const registeredEmail = response.data?.email || normalizeEmail(email);

      setPendingEmail(registeredEmail);
      setRegisterStep('verify');
      setOtp('');
      startOtpWindow(response.data);
      setSuccessMessage(response.message || 'Đăng ký thành công. Vui lòng nhập OTP đã gửi tới email.');
      generateCaptcha();
    } catch (err: unknown) {
      applyOtpApiError(parseApiError(err));
      generateCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setError('OTP phải gồm đúng 6 chữ số.');
      return;
    }

    if (otpValidSeconds === 0) {
      setError('Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.');
      return;
    }

    setIsLoading(true);

    try {
      const response = unwrapApiResponse(
        await api.post('/api/auth/verify-email', {
          email: verificationEmail,
          otp,
        }),
      );

      setAuthMode('login');
      setRegisterStep('form');
      setEmail(verificationEmail);
      setPendingEmail('');
      resetOtpState();
      setSuccessMessage(response.message || 'Xác thực email thành công. Bạn có thể đăng nhập.');
      generateCaptcha();
    } catch (err: unknown) {
      const apiError = parseApiError(err);
      if (apiError.errorCode === 'OTP_EXPIRED') {
        setOtpValidSeconds(0);
      }
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldownSeconds > 0) {
      return;
    }

    resetFeedback();
    setIsResending(true);

    try {
      const response = unwrapApiResponse<RegisterResponseData>(
        await api.post('/api/auth/resend-verification-otp', {
          email: verificationEmail,
        }),
      );

      setOtp('');
      startOtpWindow(response.data);
      setSuccessMessage(response.message || 'Đã gửi lại OTP xác thực email.');
    } catch (err: unknown) {
      applyOtpApiError(parseApiError(err));
    } finally {
      setIsResending(false);
    }
  };

  const handleForgotPassword = async () => {
    setIsLoading(true);

    try {
      const response = unwrapApiResponse<RegisterResponseData>(
        await api.post('/api/auth/forgot-password', {
          email: normalizeEmail(email),
        }),
      );
      const resetEmail = response.data?.email || normalizeEmail(email);

      setPendingPasswordResetEmail(resetEmail);
      setPasswordResetStep('reset');
      setOtp('');
      setNewPassword('');
      setConfirmNewPassword('');
      startOtpWindow(response.data);
      setSuccessMessage(response.message || 'OTP đặt lại mật khẩu đã được gửi tới email của bạn.');
      generateCaptcha();
    } catch (err: unknown) {
      applyOtpApiError(parseApiError(err));
      generateCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setError('OTP phải gồm đúng 6 chữ số.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (otpValidSeconds === 0) {
      setError('Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.');
      return;
    }

    setIsLoading(true);

    try {
      const response = unwrapApiResponse(
        await api.post('/api/auth/reset-password', {
          email: passwordResetEmail,
          otp,
          newPassword,
        }),
      );

      setAuthMode('login');
      setPasswordResetStep('request');
      setEmail(passwordResetEmail);
      setPendingPasswordResetEmail('');
      resetOtpState();
      setNewPassword('');
      setConfirmNewPassword('');
      setPassword('');
      setSuccessMessage(response.message || 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập.');
      generateCaptcha();
    } catch (err: unknown) {
      const apiError = parseApiError(err);
      if (apiError.errorCode === 'OTP_EXPIRED') {
        setOtpValidSeconds(0);
      }
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendPasswordResetOtp = async () => {
    if (resendCooldownSeconds > 0) {
      return;
    }

    resetFeedback();
    setIsResending(true);

    try {
      const response = unwrapApiResponse<RegisterResponseData>(
        await api.post('/api/auth/forgot-password', {
          email: passwordResetEmail,
        }),
      );

      setOtp('');
      startOtpWindow(response.data);
      setSuccessMessage(response.message || 'Đã gửi lại OTP đặt lại mật khẩu.');
    } catch (err: unknown) {
      applyOtpApiError(parseApiError(err));
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    if (isVerifyStep) {
      await handleVerifyEmail();
      return;
    }

    if (isResetPasswordStep) {
      await handleResetPassword();
      return;
    }

    if (!validateCaptcha()) {
      return;
    }

    if (isLoginMode) {
      await handleLogin();
      return;
    }

    if (isForgotMode) {
      await handleForgotPassword();
      return;
    }

    await handleRegister();
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#1E293B]">
      <Header />

      <main className="flex min-h-[80vh] items-center justify-center bg-[#1E293B] px-4 py-12">
        <div className="w-full max-w-md">
          <div className="flex overflow-hidden rounded-t-lg border border-gray-700 bg-[#0F172A]">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-3 text-center text-sm font-bold transition ${
                isLoginMode
                  ? 'bg-gradient-to-r from-[#FFD166] to-[#FFEBA4] text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Đăng Nhập
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 py-3 text-center text-sm font-bold transition ${
                isRegisterMode
                  ? 'bg-gradient-to-r from-[#FFD166] to-[#FFEBA4] text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Đăng Ký
            </button>
          </div>

          <div className="rounded-b-lg border-x border-b border-gray-700 bg-transparent p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {successMessage ? (
                <div className="rounded border border-emerald-400 bg-emerald-400/10 p-3 text-center text-sm text-emerald-300">
                  {successMessage}
                </div>
              ) : null}

              {error ? (
                <div className="rounded border border-red-500 bg-red-500/10 p-3 text-center text-sm text-red-400">
                  {error}
                </div>
              ) : null}

              {isVerifyStep ? (
                <>
                  <div className="rounded-md border border-[#FFD166]/40 bg-[#FFD166]/10 px-4 py-3 text-sm text-[#FFEBA4]">
                    OTP đã được gửi tới <span className="font-bold">{verificationEmail}</span>.
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-gray-300">Mã OTP</label>
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
                        placeholder="Nhập mã OTP 6 số"
                        className="w-full rounded-md border border-gray-600 bg-transparent py-2 pl-10 pr-4 text-sm text-white transition placeholder-gray-500 focus:border-[#FFD166] focus:outline-none"
                      />
                    </div>
                    {otpValidSeconds !== null ? (
                      <p
                        className={`mt-2 text-xs ${
                          otpValidSeconds > 0 ? 'text-gray-400' : 'text-red-400'
                        }`}
                      >
                        {otpValidSeconds > 0
                          ? `OTP còn hiệu lực trong ${formatCountdown(otpValidSeconds)}`
                          : 'OTP đã hết hạn. Vui lòng gửi lại mã mới.'}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setRegisterStep('form');
                        resetOtpState();
                        resetFeedback();
                        generateCaptcha();
                      }}
                      className="text-gray-400 transition hover:text-white"
                    >
                      Đổi thông tin
                    </button>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isResending || resendCooldownSeconds > 0}
                      className="font-semibold text-[#FFD166] transition hover:text-[#FFEBA4] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isResending
                        ? 'Đang gửi...'
                        : resendCooldownSeconds > 0
                          ? `Gửi lại sau ${formatCountdown(resendCooldownSeconds)}`
                          : 'Gửi lại OTP'}
                    </button>
                  </div>
                  {otpAttemptsRemaining !== null ? (
                    <p className="text-right text-xs text-gray-400">
                      Còn {otpAttemptsRemaining} lần gửi OTP
                    </p>
                  ) : null}
                </>
              ) : isResetPasswordStep ? (
                <>
                  <div className="rounded-md border border-[#FFD166]/40 bg-[#FFD166]/10 px-4 py-3 text-sm text-[#FFEBA4]">
                    OTP đặt lại mật khẩu đã được gửi tới{' '}
                    <span className="font-bold">{passwordResetEmail}</span>.
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-gray-300">Mã OTP</label>
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
                        placeholder="Nhập mã OTP 6 số"
                        className="w-full rounded-md border border-gray-600 bg-transparent py-2 pl-10 pr-4 text-sm text-white transition placeholder-gray-500 focus:border-[#FFD166] focus:outline-none"
                      />
                    </div>
                    {otpValidSeconds !== null ? (
                      <p
                        className={`mt-2 text-xs ${
                          otpValidSeconds > 0 ? 'text-gray-400' : 'text-red-400'
                        }`}
                      >
                        {otpValidSeconds > 0
                          ? `OTP còn hiệu lực trong ${formatCountdown(otpValidSeconds)}`
                          : 'OTP đã hết hạn. Vui lòng gửi lại mã mới.'}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-gray-300">Mật khẩu mới</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <FiLock />
                      </span>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="Nhập mật khẩu mới"
                        className="w-full rounded-md border border-gray-600 bg-transparent py-2 pl-10 pr-11 text-sm text-white transition placeholder-gray-500 focus:border-[#FFD166] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((current) => !current)}
                        aria-label={showNewPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                        title={showNewPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-white focus:outline-none focus-visible:text-[#FFD166]"
                      >
                        {showNewPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                      </button>
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
                        value={confirmNewPassword}
                        onChange={(event) => setConfirmNewPassword(event.target.value)}
                        placeholder="Nhập lại mật khẩu mới"
                        className="w-full rounded-md border border-gray-600 bg-transparent py-2 pl-10 pr-4 text-sm text-white transition placeholder-gray-500 focus:border-[#FFD166] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordResetStep('request');
                        resetOtpState();
                        setNewPassword('');
                        setShowNewPassword(false);
                        setConfirmNewPassword('');
                        resetFeedback();
                        generateCaptcha();
                      }}
                      className="text-gray-400 transition hover:text-white"
                    >
                      Đổi email
                    </button>
                    <button
                      type="button"
                      onClick={handleResendPasswordResetOtp}
                      disabled={isResending || resendCooldownSeconds > 0}
                      className="font-semibold text-[#FFD166] transition hover:text-[#FFEBA4] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isResending
                        ? 'Đang gửi...'
                        : resendCooldownSeconds > 0
                          ? `Gửi lại sau ${formatCountdown(resendCooldownSeconds)}`
                          : 'Gửi lại OTP'}
                    </button>
                  </div>
                  {otpAttemptsRemaining !== null ? (
                    <p className="text-right text-xs text-gray-400">
                      Còn {otpAttemptsRemaining} lần gửi OTP
                    </p>
                  ) : null}
                </>
              ) : isForgotMode ? (
                <>
                  <div className="rounded-md border border-[#FFD166]/40 bg-[#FFD166]/10 px-4 py-3 text-sm text-[#FFEBA4]">
                    Nhập email tài khoản để nhận OTP đặt lại mật khẩu.
                  </div>

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
                        placeholder="Vui lòng nhập email của bạn"
                        className="w-full rounded-md border border-gray-600 bg-transparent py-2 pl-10 pr-4 text-sm text-white transition placeholder-gray-500 focus:border-[#FFD166] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="my-2 flex items-center gap-3">
                    <div
                      className="cursor-not-allowed select-none rounded bg-white px-4 py-1 text-lg font-bold tracking-[0.2em] text-green-700 line-through decoration-gray-400"
                      title="Mã xác thực"
                    >
                      {captchaText}
                    </div>

                    <button
                      type="button"
                      onClick={generateCaptcha}
                      className="text-gray-400 transition hover:text-white"
                      title="Đổi mã khác"
                    >
                      <FiRefreshCw size={20} />
                    </button>

                    <input
                      type="text"
                      required
                      value={captchaInput}
                      onChange={(event) => setCaptchaInput(event.target.value)}
                      placeholder="Mã xác thực"
                      className="min-w-0 flex-1 rounded-md border border-gray-600 bg-transparent px-3 py-1.5 text-sm text-white focus:border-[#FFD166] focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="text-left text-sm text-gray-400 transition hover:text-white"
                  >
                    Quay lại đăng nhập
                  </button>
                </>
              ) : (
                <>
                  {isRegisterMode ? (
                    <>
                      <div>
                        <label className="mb-1 block text-sm text-gray-300">Họ và Tên</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <FiUser />
                          </span>
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            placeholder="Vui lòng nhập họ tên"
                            className="w-full rounded-md border border-gray-600 bg-transparent py-2 pl-10 pr-4 text-sm text-white transition placeholder-gray-500 focus:border-[#FFD166] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-gray-300">Số điện thoại</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <FiPhone />
                          </span>
                          <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(event) => setPhoneNumber(event.target.value)}
                            placeholder="Không bắt buộc"
                            className="w-full rounded-md border border-gray-600 bg-transparent py-2 pl-10 pr-4 text-sm text-white transition placeholder-gray-500 focus:border-[#FFD166] focus:outline-none"
                          />
                        </div>
                      </div>
                    </>
                  ) : null}

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
                        placeholder="Vui lòng nhập email của bạn"
                        className="w-full rounded-md border border-gray-600 bg-transparent py-2 pl-10 pr-4 text-sm text-white transition placeholder-gray-500 focus:border-[#FFD166] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-gray-300">Mật khẩu</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <FiLock />
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Vui lòng nhập mật khẩu"
                        className="w-full rounded-md border border-gray-600 bg-transparent py-2 pl-10 pr-11 text-sm text-white transition placeholder-gray-500 focus:border-[#FFD166] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-white focus:outline-none focus-visible:text-[#FFD166]"
                      >
                        {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                      </button>
                    </div>
                  </div>

                  {isRegisterMode ? (
                    <div>
                      <label className="mb-1 block text-sm text-gray-300">Xác nhận mật khẩu</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                          <FiLock />
                        </span>
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="Nhập lại mật khẩu"
                          className="w-full rounded-md border border-gray-600 bg-transparent py-2 pl-10 pr-4 text-sm text-white transition placeholder-gray-500 focus:border-[#FFD166] focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="text-sm italic text-gray-400 transition hover:text-white"
                      >
                        Quên Mật Khẩu?
                      </button>
                    </div>
                  )}

                  <div className="my-2 flex items-center gap-3">
                    <div
                      className="cursor-not-allowed select-none rounded bg-white px-4 py-1 text-lg font-bold tracking-[0.2em] text-green-700 line-through decoration-gray-400"
                      title="Mã xác thực"
                    >
                      {captchaText}
                    </div>

                    <button
                      type="button"
                      onClick={generateCaptcha}
                      className="text-gray-400 transition hover:text-white"
                      title="Đổi mã khác"
                    >
                      <FiRefreshCw size={20} />
                    </button>

                    <input
                      type="text"
                      required
                      value={captchaInput}
                      onChange={(event) => setCaptchaInput(event.target.value)}
                      placeholder="Mã xác thực"
                      className="min-w-0 flex-1 rounded-md border border-gray-600 bg-transparent px-3 py-1.5 text-sm text-white focus:border-[#FFD166] focus:outline-none"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={`mt-2 w-full rounded-md bg-gradient-to-r from-[#FFD166] to-[#FFEBA4] py-2.5 text-sm font-bold uppercase text-black shadow-lg transition ${
                  isLoading ? 'cursor-not-allowed opacity-70' : 'hover:opacity-90'
                }`}
              >
                {isLoading
                  ? 'Đang xử lý...'
                  : isVerifyStep
                    ? 'Xác Thực Email'
                    : isResetPasswordStep
                      ? 'Đặt Lại Mật Khẩu'
                      : isForgotMode
                        ? 'Gửi OTP Đặt Lại Mật Khẩu'
                        : isLoginMode
                          ? 'Đăng Nhập Bằng Tài Khoản'
                          : 'Đăng Ký Tài Khoản'}
              </button>

              {!isVerifyStep && !isResetPasswordStep && !isForgotMode ? (
                <button
                  type="button"
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-white py-2.5 text-sm font-bold uppercase text-black shadow transition hover:bg-gray-100"
                >
                  <FcGoogle size={20} />
                  Đăng Nhập Bằng Google
                </button>
              ) : null}
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
