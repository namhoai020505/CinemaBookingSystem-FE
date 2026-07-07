import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { getRoleFromAccessToken, isAdminRole } from '../../lib/auth';
import type { AuthMode, AuthResponseData, PasswordResetStep, RegisterResponseData, RegisterStep } from './authTypes';
import {
  createCaptcha,
  getOtpValidSeconds,
  normalizeEmail,
  parseApiError,
  unwrapApiResponse,
} from './authUtils';

export const useLoginController = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [authMode, setAuthMode] = useState<AuthMode>(() => {
    // Giá trị khởi tạo lần đầu dựa vào state của navigation
    const state = location.state as { mode?: string } | null;
    return state?.mode === 'register' ? 'register' : 'login';
  });
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

  // Theo dõi location.state để xử lý navigate đến /login cùng route (không remount)
  // Ví dụ: click "Đăng ký" từ header → {mode:'register'}, click "Đăng nhập" → {mode:'login'}
  useEffect(() => {
    const state = location.state as { mode?: string } | null;
    if (state?.mode === 'register') {
      setAuthMode('register');
    } else if (state?.mode === 'login') {
      setAuthMode('login');
    }
    // Nếu không có state, giữ nguyên mode hiện tại (user định tần có thể tự switch tab)
  }, [location.state]);

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

  const applyOtpApiError = (apiError: ReturnType<typeof parseApiError>) => {
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
      localStorage.removeItem('role');
      localStorage.setItem('fullName', authData?.fullName || 'Người dùng');

      if (authData?.refreshToken) {
        localStorage.setItem('refreshToken', authData.refreshToken);
      }

      navigate(isAdminRole(getRoleFromAccessToken(token)) ? '/admin/dashboard' : '/');
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

  const handleGoogleLogin = async (idToken: string) => {
    resetFeedback();
    setIsLoading(true);

    try {
      const response = unwrapApiResponse<AuthResponseData>(
        await api.post('/api/auth/google-login', { idToken }),
      );
      const authData = response.data;
      const token = authData?.accessToken || authData?.token;

      if (!token) {
        setError('Đăng nhập Google thành công nhưng backend không trả về access token.');
        return;
      }

      localStorage.setItem('accessToken', token);
      localStorage.removeItem('role');
      localStorage.setItem('fullName', authData?.fullName || 'Người dùng');

      if (authData?.refreshToken) {
        localStorage.setItem('refreshToken', authData.refreshToken);
      }

      navigate(isAdminRole(getRoleFromAccessToken(token)) ? '/admin/dashboard' : '/');
    } catch (err: unknown) {
      setError(parseApiError(err).message);
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

  return {
    authMode,
    captchaInput,
    captchaText,
    confirmNewPassword,
    confirmPassword,
    email,
    error,
    fullName,
    isForgotMode,
    isLoading,
    isLoginMode,
    isRegisterMode,
    isResending,
    isResetPasswordStep,
    isVerifyStep,
    newPassword,
    otp,
    otpAttemptsRemaining,
    otpValidSeconds,
    password,
    passwordResetEmail,
    phoneNumber,
    resendCooldownSeconds,
    showNewPassword,
    showPassword,
    successMessage,
    verificationEmail,
    generateCaptcha,
    handleGoogleLogin,
    handleResendOtp,
    handleResendPasswordResetOtp,
    handleSubmit,
    resetFeedback,
    resetOtpState,
    setAuthMode,
    setCaptchaInput,
    setConfirmNewPassword,
    setConfirmPassword,
    setEmail,
    setFullName,
    setNewPassword,
    setOtp,
    setPassword,
    setPasswordResetStep,
    setPhoneNumber,
    setRegisterStep,
    setShowNewPassword,
    setShowPassword,
    switchMode,
  };
};

export type LoginController = ReturnType<typeof useLoginController>;
