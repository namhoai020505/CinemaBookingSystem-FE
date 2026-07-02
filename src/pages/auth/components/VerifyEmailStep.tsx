import type { LoginController } from '../useLoginController';
import { OtpField } from './AuthFields';
import { OtpStepActions } from './OtpStepActions';

type VerifyEmailStepProps = {
  controller: LoginController;
};

// Bước xác thực email sau khi đăng ký: nhập OTP và có thể gửi lại mã.
export const VerifyEmailStep = ({ controller }: VerifyEmailStepProps) => (
  <>
    <div className="rounded-md border border-[#FFD166]/40 bg-[#FFD166]/10 px-4 py-3 text-sm text-[#FFEBA4]">
      OTP đã được gửi tới <span className="font-bold">{controller.verificationEmail}</span>.
    </div>

    <OtpField
      value={controller.otp}
      onChange={controller.setOtp}
      otpValidSeconds={controller.otpValidSeconds}
    />

    <OtpStepActions
      attemptsRemaining={controller.otpAttemptsRemaining}
      cooldownSeconds={controller.resendCooldownSeconds}
      isResending={controller.isResending}
      backLabel="Đổi thông tin"
      onResend={controller.handleResendOtp}
      onBack={() => {
        // Quay lại form đăng ký để người dùng chỉnh thông tin rồi yêu cầu OTP mới.
        controller.setRegisterStep('form');
        controller.resetOtpState();
        controller.resetFeedback();
        controller.generateCaptcha();
      }}
    />
  </>
);
