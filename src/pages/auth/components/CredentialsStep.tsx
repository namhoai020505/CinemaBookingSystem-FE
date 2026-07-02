import { FiMail, FiPhone, FiUser } from 'react-icons/fi';
import type { LoginController } from '../useLoginController';
import { CaptchaField, PasswordField, TextField } from './AuthFields';

type CredentialsStepProps = {
  controller: LoginController;
};

// Bước nhập thông tin chính cho cả đăng nhập và đăng ký.
// Component chỉ render UI, còn validate/call API nằm trong useLoginController.
export const CredentialsStep = ({ controller }: CredentialsStepProps) => (
  <>
    {controller.isRegisterMode ? (
      <>
        {/* Hai field này chỉ xuất hiện khi người dùng đăng ký tài khoản mới. */}
        <TextField
          label="Họ và Tên"
          value={controller.fullName}
          onChange={controller.setFullName}
          placeholder="Vui lòng nhập họ tên"
          icon={<FiUser />}
        />

        <TextField
          label="Số điện thoại"
          type="tel"
          value={controller.phoneNumber}
          onChange={controller.setPhoneNumber}
          placeholder="Không bắt buộc"
          icon={<FiPhone />}
          required={false}
        />
      </>
    ) : null}

    <TextField
      label="Email"
      type="email"
      value={controller.email}
      onChange={controller.setEmail}
      placeholder="Vui lòng nhập email của bạn"
      icon={<FiMail />}
    />

    <PasswordField
      label="Mật khẩu"
      value={controller.password}
      onChange={controller.setPassword}
      placeholder="Vui lòng nhập mật khẩu"
      showPassword={controller.showPassword}
      onTogglePassword={() => controller.setShowPassword((current) => !current)}
    />

    {controller.isRegisterMode ? (
      <PasswordField
        label="Xác nhận mật khẩu"
        value={controller.confirmPassword}
        onChange={controller.setConfirmPassword}
        placeholder="Nhập lại mật khẩu"
      />
    ) : (
      <div className="text-right">
        {/* Chuyển sang flow quên mật khẩu nhưng vẫn giữ cùng màn hình auth. */}
        <button
          type="button"
          onClick={() => controller.switchMode('forgot')}
          className="text-sm italic text-gray-400 transition hover:text-white"
        >
          Quên Mật Khẩu?
        </button>
      </div>
    )}

    <CaptchaField
      captchaText={controller.captchaText}
      captchaInput={controller.captchaInput}
      onCaptchaInputChange={controller.setCaptchaInput}
      onRefreshCaptcha={controller.generateCaptcha}
    />
  </>
);
