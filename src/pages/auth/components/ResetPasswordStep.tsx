import type { LoginController } from '../useLoginController';
import { OtpField, PasswordField } from './AuthFields';
import { OtpStepActions } from './OtpStepActions';

type ResetPasswordStepProps = {
  controller: LoginController;
};

// Bước đặt lại mật khẩu: xác nhận OTP reset và nhập mật khẩu mới.
export const ResetPasswordStep = ({ controller }: ResetPasswordStepProps) => (
  <>
    <div className="rounded-md border border-[#FFD166]/40 bg-[#FFD166]/10 px-4 py-3 text-sm text-[#FFEBA4]">
      OTP đặt lại mật khẩu đã được gửi tới{' '}
      <span className="font-bold">{controller.passwordResetEmail}</span>.
    </div>

    <OtpField
      value={controller.otp}
      onChange={controller.setOtp}
      otpValidSeconds={controller.otpValidSeconds}
    />

    <PasswordField
      label="Mật khẩu mới"
      value={controller.newPassword}
      onChange={controller.setNewPassword}
      placeholder="Nhập mật khẩu mới"
      showPassword={controller.showNewPassword}
      onTogglePassword={() => controller.setShowNewPassword((current) => !current)}
      toggleLabel="mật khẩu mới"
    />

    <PasswordField
      label="Xác nhận mật khẩu mới"
      value={controller.confirmNewPassword}
      onChange={controller.setConfirmNewPassword}
      placeholder="Nhập lại mật khẩu mới"
    />

    <OtpStepActions
      attemptsRemaining={controller.otpAttemptsRemaining}
      cooldownSeconds={controller.resendCooldownSeconds}
      isResending={controller.isResending}
      backLabel="Đổi email"
      onResend={controller.handleResendPasswordResetOtp}
      onBack={() => {
        // Quay lại bước nhập email, đồng thời xóa OTP/mật khẩu cũ khỏi form.
        controller.setPasswordResetStep('request');
        controller.resetOtpState();
        controller.setNewPassword('');
        controller.setShowNewPassword(false);
        controller.setConfirmNewPassword('');
        controller.resetFeedback();
        controller.generateCaptcha();
      }}
    />
  </>
);
