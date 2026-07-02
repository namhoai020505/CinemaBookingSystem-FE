import type { ReactNode } from 'react';
import { FiEye, FiEyeOff, FiLock, FiRefreshCw } from 'react-icons/fi';
import { formatCountdown } from '../authUtils';

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon: ReactNode;
  type?: string;
  inputMode?: 'numeric' | 'text' | 'email' | 'tel';
  maxLength?: number;
  required?: boolean;
};

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  showPassword?: boolean;
  onTogglePassword?: () => void;
  toggleLabel?: string;
  required?: boolean;
};

type OtpFieldProps = {
  value: string;
  onChange: (value: string) => void;
  otpValidSeconds: number | null;
};

type CaptchaFieldProps = {
  captchaText: string;
  captchaInput: string;
  onCaptchaInputChange: (value: string) => void;
  onRefreshCaptcha: () => void;
};

// Field text dùng chung cho email, họ tên, số điện thoại để form auth đồng nhất style.
export const TextField = ({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = 'text',
  inputMode,
  maxLength,
  required = true,
}: TextFieldProps) => (
  <div>
    <label className="mb-1 block text-sm text-gray-300">{label}</label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        {icon}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-600 bg-transparent py-2 pl-10 pr-4 text-sm text-white transition placeholder-gray-500 focus:border-[#FFD166] focus:outline-none"
      />
    </div>
  </div>
);

// Field mật khẩu có thể bật icon mắt nếu truyền onTogglePassword vào.
export const PasswordField = ({
  label,
  value,
  onChange,
  placeholder,
  showPassword,
  onTogglePassword,
  toggleLabel = 'mật khẩu',
  required = true,
}: PasswordFieldProps) => {
  const hasToggle = Boolean(onTogglePassword);

  return (
    <div>
      <label className="mb-1 block text-sm text-gray-300">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <FiLock />
        </span>
        <input
          type={showPassword ? 'text' : 'password'}
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-md border border-gray-600 bg-transparent py-2 pl-10 text-sm text-white transition placeholder-gray-500 focus:border-[#FFD166] focus:outline-none ${
            hasToggle ? 'pr-11' : 'pr-4'
          }`}
        />
        {hasToggle ? (
          <button
            type="button"
            onClick={onTogglePassword}
            aria-label={showPassword ? `Ẩn ${toggleLabel}` : `Hiện ${toggleLabel}`}
            title={showPassword ? `Ẩn ${toggleLabel}` : `Hiện ${toggleLabel}`}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-white focus:outline-none focus-visible:text-[#FFD166]"
          >
            {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
          </button>
        ) : null}
      </div>
    </div>
  );
};

// Field OTP chỉ nhận số, giới hạn 6 ký tự và hiển thị thời gian còn hiệu lực.
export const OtpField = ({ value, onChange, otpValidSeconds }: OtpFieldProps) => (
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
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
        placeholder="Nhập mã OTP 6 số"
        className="w-full rounded-md border border-gray-600 bg-transparent py-2 pl-10 pr-4 text-sm text-white transition placeholder-gray-500 focus:border-[#FFD166] focus:outline-none"
      />
    </div>
    {otpValidSeconds !== null ? (
      <p className={`mt-2 text-xs ${otpValidSeconds > 0 ? 'text-gray-400' : 'text-red-400'}`}>
        {otpValidSeconds > 0
          ? `OTP còn hiệu lực trong ${formatCountdown(otpValidSeconds)}`
          : 'OTP đã hết hạn. Vui lòng gửi lại mã mới.'}
      </p>
    ) : null}
  </div>
);

// Captcha phía FE dùng để chặn submit nhầm/spam nhẹ trước khi gọi API backend.
export const CaptchaField = ({
  captchaText,
  captchaInput,
  onCaptchaInputChange,
  onRefreshCaptcha,
}: CaptchaFieldProps) => (
  <div className="my-2 flex items-center gap-3">
    <div
      className="cursor-not-allowed select-none rounded bg-white px-4 py-1 text-lg font-bold tracking-[0.2em] text-green-700 line-through decoration-gray-400"
      title="Mã xác thực"
    >
      {captchaText}
    </div>

    <button
      type="button"
      onClick={onRefreshCaptcha}
      className="text-gray-400 transition hover:text-white"
      title="Đổi mã khác"
    >
      <FiRefreshCw size={20} />
    </button>

    <input
      type="text"
      required
      value={captchaInput}
      onChange={(event) => onCaptchaInputChange(event.target.value)}
      placeholder="Mã xác thực"
      className="min-w-0 flex-1 rounded-md border border-gray-600 bg-transparent px-3 py-1.5 text-sm text-white focus:border-[#FFD166] focus:outline-none"
    />
  </div>
);
