import { useState, type FormEvent } from 'react';
import { toast } from 'react-toastify';
import { staffService, type ApiResponse, type StaffInvitationData } from '../../services/staffService';

type ParsedApiError = {
  message: string;
  errorCode?: string;
};

const staffErrorMessages: Record<string, string> = {
  DUPLICATE_EMAIL: 'Email này đã tồn tại trong hệ thống.',
  CINEMA_NOT_FOUND: 'Chưa có rạp trong hệ thống. Vui lòng seed dữ liệu rạp trước.',
  ROLE_NOT_FOUND: 'Chưa có role Staff trong hệ thống.',
  EMAIL_SEND_FAILED: 'Không gửi được email mời staff. Vui lòng kiểm tra SMTP backend.',
  VALIDATION_ERROR: 'Email hoặc tên nhân viên chưa hợp lệ.',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseApiError = (error: unknown): ParsedApiError => {
  if (!isRecord(error)) {
    return { message: 'Đã xảy ra lỗi không xác định.' };
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
    return { message: 'Không thể kết nối backend. Hãy kiểm tra API đã chạy chưa.' };
  }

  return { message: 'Đã xảy ra lỗi không xác định.' };
};

export default function ManageStaff() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [invitation, setInvitation] = useState<StaffInvitationData | null>(null);

  const staffSetPasswordPath = invitation?.email
    ? `/staff/set-password?email=${encodeURIComponent(invitation.email)}`
    : '/staff/set-password';

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
      toast.success(response.message || 'Đã gửi email mời staff.');
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
        <h1 className="text-2xl font-bold uppercase tracking-wider">Quản Lý Staff</h1>
        <p className="mt-1 text-xs text-gray-400">
          Tạo tài khoản staff và gửi OTP đặt mật khẩu tới email nhân viên.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_1fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-gray-800 bg-[#111C44] p-6 shadow-2xl"
        >
          <div className="mb-5 border-b border-gray-800 pb-4">
            <h2 className="text-lg font-bold uppercase tracking-wide">Mời Staff Mới</h2>
          </div>

          {error ? (
            <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">
                Email Staff <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="staff@example.com"
                className="w-full rounded-xl border border-gray-800 bg-[#0F172A] px-4 py-2.5 text-sm text-white outline-none transition focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-gray-400">
                Họ Tên
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Không bắt buộc"
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
            {isSubmitting ? 'Đang gửi lời mời...' : 'Gửi Lời Mời Staff'}
          </button>
        </form>

        <div className="rounded-2xl border border-gray-800 bg-[#111C44] p-6 shadow-2xl">
          <h2 className="mb-4 text-lg font-bold uppercase tracking-wide">Trạng Thái</h2>

          {invitation ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                Đã tạo tài khoản staff cho <span className="font-bold">{invitation.email}</span>.
              </div>

              {invitation.expiresAt ? (
                <div className="rounded-xl border border-gray-800 bg-[#0F172A] p-4 text-sm text-gray-300">
                  OTP hết hạn lúc{' '}
                  <span className="font-semibold text-white">
                    {new Date(invitation.expiresAt).toLocaleString('vi-VN')}
                  </span>
                </div>
              ) : null}

              <div className="rounded-xl border border-gray-800 bg-[#0F172A] p-4">
                <p className="mb-2 text-xs font-semibold uppercase text-gray-400">
                  Trang đặt mật khẩu
                </p>
                <a
                  href={staffSetPasswordPath}
                  className="break-all text-sm font-semibold text-[#FFD166] transition hover:text-[#FFEBA4]"
                >
                  {staffSetPasswordPath}
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-800 bg-[#0F172A] p-5 text-sm text-gray-400">
              Sau khi gửi lời mời thành công, thông tin invitation sẽ hiển thị tại đây.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
