import { useState, type FormEvent } from 'react';
import { toast } from 'react-toastify';
import { staffService, type ApiResponse, type StaffInvitationData } from '../../services/staffService';
import { TEXT } from '../../constants/vi';

type ParsedApiError = {
  message: string;
  errorCode?: string;
};

// Map mã lỗi backend sang thông báo dễ hiểu cho admin khi mời staff.
const staffErrorMessages: Record<string, string> = {
  DUPLICATE_EMAIL: TEXT.STAFF.ERR_DUPLICATE_EMAIL,
  CINEMA_NOT_FOUND: TEXT.STAFF.ERR_CINEMA_NOT_FOUND,
  ROLE_NOT_FOUND: TEXT.STAFF.ERR_ROLE_NOT_FOUND,
  EMAIL_SEND_FAILED: TEXT.STAFF.ERR_EMAIL_SEND_FAILED,
  VALIDATION_ERROR: TEXT.STAFF.ERR_VALIDATION,
};

// Type guard giúp đọc object lỗi từ Axios mà vẫn giữ type-safe.
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

// Chuẩn hóa lỗi từ API create staff thành message để hiển thị và toast.
const parseApiError = (error: unknown): ParsedApiError => {
  if (!isRecord(error)) {
    return { message: TEXT.STAFF.ERR_UNKNOWN_OBJ };
  }

  if (isRecord(error.response)) {
    const data = error.response.data;

    if (isRecord(data)) {
      const errorCode = typeof data.errorCode === 'string' ? data.errorCode : undefined;
      const mappedMessage = errorCode ? staffErrorMessages[errorCode] : undefined;

      if (mappedMessage) {
        return { message: mappedMessage, errorCode };
      }

      if (typeof data.message === 'string' && data.message.trim()) {
        return { message: data.message, errorCode };
      }
    }
  }

  if ('request' in error) {
    return { message: TEXT.STAFF.ERR_CONNECTION };
  }

  return { message: TEXT.STAFF.ERR_UNKNOWN };
};

// Trang admin mời user trở thành staff qua email.
export default function ManageStaff() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [invitation, setInvitation] = useState<StaffInvitationData | null>(null);

  // Link preview để admin có thể kiểm tra trang staff tạo mật khẩu sau khi gửi lời mời.
  const staffSetPasswordPath = invitation?.email
    ? `/staff/set-password?email=${encodeURIComponent(invitation.email)}`
    : '/staff/set-password';

  // Gửi email được nhập lên backend để tạo tài khoản staff và gửi invitation OTP.
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setInvitation(null);
    setIsSubmitting(true);

    try {
      const response: ApiResponse<StaffInvitationData> = await staffService.createStaff({
        email: email.trim().toLowerCase(),
        fullName: fullName.trim() || undefined,
      });

      setInvitation(response.data || { email: email.trim().toLowerCase() });
      toast.success(response.message || TEXT.STAFF.SUCCESS_INVITE);
      setEmail('');
      setFullName('');
    } catch (err: unknown) {
      const apiError = parseApiError(err);
      setError(apiError.message);
      toast.error(apiError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] p-6 text-white font-['Urbanist']">
      <div className="mb-6">
        <h1 className="text-2xl font-bold uppercase tracking-wider">{TEXT.STAFF.TITLE}</h1>
        <p className="mt-1 text-xs text-gray-400">
          {TEXT.STAFF.SUBTITLE}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_1fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-gray-800 bg-[#111C44] p-6 shadow-2xl"
        >
          <div className="mb-5 border-b border-gray-800 pb-4">
            <h2 className="text-lg font-bold uppercase tracking-wide">{TEXT.STAFF.FORM_TITLE}</h2>
          </div>

          {error ? (
            <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">
                {TEXT.STAFF.LABEL_EMAIL} <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={TEXT.STAFF.PLACEHOLDER_EMAIL}
                className="w-full rounded-xl border border-gray-800 bg-[#0F172A] px-4 py-2.5 text-sm text-white outline-none transition focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">
                {TEXT.STAFF.LABEL_NAME}
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder={TEXT.STAFF.PLACEHOLDER_NAME}
                className="w-full rounded-xl border border-gray-800 bg-[#0F172A] px-4 py-2.5 text-sm text-white outline-none transition focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`mt-6 w-full rounded-xl bg-[#4318FF] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition ${
              isSubmitting ? 'cursor-not-allowed opacity-70' : 'hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? TEXT.STAFF.BTN_SUBMITTING : TEXT.STAFF.BTN_SUBMIT}
          </button>
        </form>

        <div className="rounded-2xl border border-gray-800 bg-[#111C44] p-6 shadow-2xl">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">{TEXT.STAFF.STATUS_TITLE}</h2>

          {invitation ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                {TEXT.STAFF.STATUS_SUCCESS} <span className="font-bold">{invitation.email}</span>.
              </div>

              {invitation.expiresAt ? (
                <div className="rounded-xl border border-gray-800 bg-[#0F172A] p-4 text-sm text-gray-300">
                  {TEXT.STAFF.STATUS_OTP_EXPIRE}{' '}
                  <span className="font-semibold text-white">
                    {new Date(invitation.expiresAt).toLocaleString('vi-VN')}
                  </span>
                </div>
              ) : null}

              <div className="rounded-xl border border-gray-800 bg-[#0F172A] p-4">
                <p className="mb-2 text-xs font-semibold uppercase text-gray-400">
                  {TEXT.STAFF.STATUS_LINK_LABEL}
                </p>
                <code className="break-all text-sm text-[#FFD166]">{staffSetPasswordPath}</code>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-800 bg-[#0F172A] p-4 text-sm text-gray-400">
              {TEXT.STAFF.STATUS_EMPTY}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
