import { formatCountdown } from '../authUtils';

type OtpStepActionsProps = {
  attemptsRemaining: number | null;
  cooldownSeconds: number;
  isResending: boolean;
  onBack: () => void;
  onResend: () => void;
  backLabel: string;
};

// Cụm action dùng chung cho các màn hình OTP: quay lại, gửi lại và hiển thị cooldown.
export const OtpStepActions = ({
  attemptsRemaining,
  cooldownSeconds,
  isResending,
  onBack,
  onResend,
  backLabel,
}: OtpStepActionsProps) => (
  <>
    <div className="flex items-center justify-between gap-3 text-sm">
      <button
        type="button"
        onClick={onBack}
        className="text-gray-400 transition hover:text-white"
      >
        {backLabel}
      </button>
      <button
        type="button"
        onClick={onResend}
        disabled={isResending || cooldownSeconds > 0}
        className="font-semibold text-[#FFD166] transition hover:text-[#FFEBA4] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isResending
          ? 'Đang gửi...'
          : cooldownSeconds > 0
            ? `Gửi lại sau ${formatCountdown(cooldownSeconds)}`
            : 'Gửi lại OTP'}
      </button>
    </div>
    {attemptsRemaining !== null ? (
      <p className="text-right text-xs text-gray-400">
        Còn {attemptsRemaining} lần gửi OTP
      </p>
    ) : null}
  </>
);
