import { GoogleLogin } from '@react-oauth/google';
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

/**
 * GoogleLoginButton renders a custom-styled button that triggers the Google
 * One-Tap / popup flow from @react-oauth/google. The hidden <GoogleLogin>
 * component provides the real Google OAuth button; our visible button clicks
 * its inner <div> to open the popup programmatically.
 *
 * `credential` returned by onSuccess is a signed Google ID Token (JWT) —
 * exactly what the backend expects in POST /api/auth/google-login { idToken }.
 */
export const GoogleLoginButton = ({ onSuccess, isLoading = false }: GoogleLoginButtonProps) => {
  return (
    <div className={`relative mt-2 w-full ${isLoading ? 'pointer-events-none opacity-50' : ''}`}>
      {/* Custom styled button matching AuthSubmitButton style exactly */}
      <button
        type="button"
        className="w-full flex items-center justify-center gap-2.5 rounded-md bg-white py-2.5 text-sm font-bold uppercase text-black shadow-lg hover:bg-slate-100 transition duration-200"
      >
        <svg className="h-4.5 w-4.5 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#EA4335"
            d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.33 0 3.324 2.69 1.405 6.618l3.86 3.147z"
          />
          <path
            fill="#4285F4"
            d="M23.49 12.273c0-.818-.073-1.609-.209-2.373H12v4.5h6.49a5.539 5.539 0 0 1-2.4 3.636l3.773 2.923c2.21-2.036 3.627-5.036 3.627-8.686z"
          />
          <path
            fill="#FBBC05"
            d="M5.266 14.235 1.405 17.38c1.92 3.927 5.926 6.62 10.595 6.62 3.127 0 5.927-1.036 7.91-2.827l-3.773-2.923a5.539 5.539 0 0 1-8.136-4.015z"
          />
          <path
            fill="#34A853"
            d="M12 4.909c2.39 0 4.19.982 5.09 1.836l3.5-3.5C18.39 1.155 15.427 0 12 0 7.33 0 3.324 2.69 1.405 6.618l3.86 3.147C6.186 6.84 8.845 4.91 12 4.909z"
          />
        </svg>
        Đăng Nhập Bằng Google
      </button>

      {/* Invisible overlay containing the actual GoogleLogin button */}
      <div className="absolute inset-0 opacity-[0.01] overflow-hidden cursor-pointer flex justify-center">
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
          theme="outline"
          size="large"
          shape="rectangular"
          width="400"
        />
      </div>
    </div>
  );
};


