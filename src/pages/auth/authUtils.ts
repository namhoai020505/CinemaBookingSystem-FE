import type { ApiResponse, ParsedApiError } from './authTypes';

const apiErrorMessages: Record<string, string> = {
  DUPLICATE_EMAIL: 'Email này đã được sử dụng.',
  PENDING_REGISTRATION_EXISTS:
    'Email này đang chờ xác thực. Vui lòng dùng mật khẩu đã đăng ký trước đó để đổi thông tin.',
  EMAIL_NOT_REGISTERED: 'Email này chưa được đăng ký.',
  WEAK_PASSWORD: 'Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số.',
  EMAIL_SEND_FAILED: 'Không gửi được email OTP. Vui lòng kiểm tra cấu hình SMTP backend.',
  USER_NOT_FOUND: 'Không tìm thấy tài khoản với email này.',
  EMAIL_ALREADY_VERIFIED: 'Email này đã được xác thực.',
  OTP_NOT_FOUND: 'Không tìm thấy mã OTP.',
  OTP_EXPIRED: 'Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.',
  INVALID_OTP: 'Mã OTP không đúng.',
  EMAIL_NOT_VERIFIED: 'Email chưa được xác thực. Vui lòng nhập mã OTP đã nhận.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  ACCOUNT_NOT_ACTIVE: 'Tài khoản chưa ở trạng thái hoạt động.',
  OTP_RESEND_COOLDOWN: 'Vui lòng chờ trước khi gửi lại OTP.',
  OTP_SEND_LIMIT_REACHED: 'Bạn đã gửi OTP đủ 5 lần. Vui lòng thử lại sau 2 giờ.',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const createCaptcha = () => Math.floor(10000 + Math.random() * 90000).toString();

const getRetryAfterSeconds = (errors: unknown) => {
  if (!isRecord(errors)) {
    return undefined;
  }

  const retryAfterValues = errors.retryAfterSeconds;
  if (!Array.isArray(retryAfterValues) || typeof retryAfterValues[0] !== 'string') {
    return undefined;
  }

  const retryAfterSeconds = Number.parseInt(retryAfterValues[0], 10);
  return Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined;
};

export const getOtpValidSeconds = (expiresAt?: string) => {
  if (!expiresAt) {
    return 60;
  }

  const expiryTime = new Date(expiresAt).getTime();
  if (Number.isNaN(expiryTime)) {
    return 60;
  }

  return Math.max(0, Math.ceil((expiryTime - Date.now()) / 1000));
};

export const formatCountdown = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} giờ ${minutes.toString().padStart(2, '0')} phút`;
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const unwrapApiResponse = <T,>(response: unknown): ApiResponse<T> => {
  if (isRecord(response)) {
    if (typeof response.success === 'boolean') {
      return response as ApiResponse<T>;
    }

    if (isRecord(response.data) && typeof response.data.success === 'boolean') {
      return response.data as ApiResponse<T>;
    }
  }

  return {
    success: true,
    message: 'Success',
    data: response as T,
  };
};

export const parseApiError = (error: unknown): ParsedApiError => {
  if (!isRecord(error)) {
    return { message: 'Đã xảy ra lỗi không xác định.' };
  }

  if (isRecord(error.response)) {
    const status = typeof error.response.status === 'number' ? error.response.status : undefined;
    const data = error.response.data;

    if (isRecord(data)) {
      const errorCode = typeof data.errorCode === 'string' ? data.errorCode : undefined;
      const retryAfterSeconds = getRetryAfterSeconds(data.errors);
      const mappedMessage = errorCode ? apiErrorMessages[errorCode] : undefined;

      if (mappedMessage) {
        return { message: mappedMessage, errorCode, retryAfterSeconds };
      }

      if (typeof data.message === 'string' && data.message.trim()) {
        return { message: data.message, errorCode, retryAfterSeconds };
      }

      if (isRecord(data.errors)) {
        const firstField = Object.keys(data.errors)[0];
        const firstErrors = firstField ? data.errors[firstField] : undefined;

        if (Array.isArray(firstErrors) && typeof firstErrors[0] === 'string') {
          return { message: firstErrors[0], errorCode, retryAfterSeconds };
        }
      }
    }

    return { message: status ? `Lỗi từ server (${status}).` : 'Lỗi từ server.' };
  }

  if ('request' in error) {
    return {
      message: 'Không thể kết nối đến backend. Hãy kiểm tra backend đã chạy chưa hoặc lỗi CORS.',
    };
  }

  return { message: 'Đã xảy ra lỗi không xác định.' };
};
