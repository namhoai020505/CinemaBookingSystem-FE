import { GoogleLogin } from '@react-oauth/google';
import { useRef } from 'react';
import { FcGoogle } from 'react-icons/fc';
import type { AuthMode } from '../authTypes';

type AuthTabsProps = {
  authMode: AuthMode;
  onSwitchMode: (mode: AuthMode) => void;
};

type AuthFeedbackProps = {
  successMessage: string;
  error: string;
};

type AuthSubmitButtonProps = {
  isLoading: boolean;
  isVerifyStep: boolean;
  isResetPasswordStep: boolean;
  isForgotMode: boolean;
  isLoginMode: boolean;
};

type GoogleLoginButtonProps = {
  onSuccess: (idToken: string) => void;
  isLoading?: boolean;
};

// Hiển thị tab Đăng nhập / Đăng ký và báo mode được chọn về controller.
export const AuthTabs = ({ authMode, onSwitchMode }: AuthTabsProps) => (
  <div className="flex overflow-hidden rounded-t-lg border border-gray-700 bg-[#0F172A]">
    <button
      type="button"
      onClick={() => onSwitchMode('login')}
      className={`flex-1 py-3 text-center text-sm font-bold transition ${
        authMode === 'login'
          ? 'bg-gradient-to-r from-[#FFD166] to-[#FFEBA4] text-black'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      Đăng Nhập
    </button>
    <button
      type="button"
      onClick={() => onSwitchMode('register')}
      className={`flex-1 py-3 text-center text-sm font-bold transition ${
        authMode === 'register'
          ? 'bg-gradient-to-r from-[#FFD166] to-[#FFEBA4] text-black'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      Đăng Ký
    </button>
  </div>
);

// Gom thông báo thành công và lỗi để form auth chỉ cần truyền message vào một chỗ.
export const AuthFeedback = ({ successMessage, error }: AuthFeedbackProps) => (
  <>
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
  </>
);

// Nút submit dùng chung cho login, đăng ký, xác thực OTP và đặt lại mật khẩu.
export const AuthSubmitButton = ({
  isLoading,
  isVerifyStep,
  isResetPasswordStep,
  isForgotMode,
  isLoginMode,
}: AuthSubmitButtonProps) => (
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
);

// Nút Google hiển thị theo style của app nhưng vẫn gọi GoogleLogin thật để lấy ID token.
export const GoogleLoginButton = ({ onSuccess, isLoading = false }: GoogleLoginButtonProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Click vào nút Google ẩn để mở popup OAuth mà không phá layout custom.
  const triggerGoogleLogin = () => {
    const btn = containerRef.current?.querySelector('div[role="button"]') as HTMLElement | null;
    btn?.click();
  };

  return (
    <div className="mt-2">
      {/* Nút Google thật được ẩn đi, chỉ dùng để kích hoạt popup OAuth chính thức. */}
      <div
        ref={containerRef}
        style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', opacity: 0 }}
        aria-hidden="true"
      >
        <GoogleLogin
          onSuccess={(credentialResponse) => {
            if (credentialResponse.credential) {
              onSuccess(credentialResponse.credential);
            }
          }}
          onError={() => {
            console.error('Google login failed or was cancelled');
          }}
          useOneTap={false}
        />
      </div>

      {/* Nút người dùng nhìn thấy, giữ giao diện đồng nhất với các nút auth còn lại. */}
      <button
        type="button"
        disabled={isLoading}
        onClick={triggerGoogleLogin}
        className={`flex w-full items-center justify-center gap-2 rounded-md bg-white py-2.5 text-sm font-bold uppercase text-black shadow transition ${
          isLoading ? 'cursor-not-allowed opacity-70' : 'hover:bg-gray-100'
        }`}
      >
        <FcGoogle size={20} />
        {isLoading ? 'Đang xử lý...' : 'Đăng Nhập Bằng Google'}
      </button>
    </div>
  );
};
