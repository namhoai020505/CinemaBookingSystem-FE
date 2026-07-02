import { FiMail } from 'react-icons/fi';
import type { LoginController } from '../useLoginController';
import { CaptchaField, TextField } from './AuthFields';

type ForgotPasswordStepProps = {
  controller: LoginController;
};

// Bước đầu của quên mật khẩu: nhập email đã đăng ký để backend gửi OTP reset.
export const ForgotPasswordStep = ({ controller }: ForgotPasswordStepProps) => (
  <>
    <div className="rounded-md border border-[#FFD166]/40 bg-[#FFD166]/10 px-4 py-3 text-sm text-[#FFEBA4]">
      Nhập email tài khoản để nhận OTP đặt lại mật khẩu.
    </div>

    <TextField
      label="Email"
      type="email"
      value={controller.email}
      onChange={controller.setEmail}
      placeholder="Vui lòng nhập email của bạn"
      icon={<FiMail />}
    />

    <CaptchaField
      captchaText={controller.captchaText}
      captchaInput={controller.captchaInput}
      onCaptchaInputChange={controller.setCaptchaInput}
      onRefreshCaptcha={controller.generateCaptcha}
    />

    <button
      type="button"
      onClick={() => controller.switchMode('login')}
      className="text-left text-sm text-gray-400 transition hover:text-white"
    >
      Quay lại đăng nhập
    </button>
  </>
);
