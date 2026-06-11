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

export const GoogleLoginButton = () => (
  <button
    type="button"
    className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-white py-2.5 text-sm font-bold uppercase text-black shadow transition hover:bg-gray-100"
  >
    <FcGoogle size={20} />
    Đăng Nhập Bằng Google
  </button>
);
