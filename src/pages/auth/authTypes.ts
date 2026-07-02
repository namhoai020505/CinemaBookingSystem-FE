// Chế độ chính của màn auth: đăng nhập, đăng ký, hoặc quên mật khẩu.
export type AuthMode = 'login' | 'register' | 'forgot';

// Bước trong flow đăng ký: nhập form hoặc xác thực OTP.
export type RegisterStep = 'form' | 'verify';

// Bước trong flow quên mật khẩu: yêu cầu OTP hoặc đặt mật khẩu mới.
export type PasswordResetStep = 'request' | 'reset';

// ApiResponse chuẩn mà backend thường trả về.
export type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data?: T | null;
  errorCode?: string | null;
  errors?: Record<string, string[]> | null;
};

// Dữ liệu nhận được sau login/register Google: token, refresh token và user info.
export type AuthResponseData = {
  accessToken?: string;
  token?: string;
  refreshToken?: string;
  fullName?: string;
  role?: string;
};

// Dữ liệu nhận được sau register/resend OTP/forgot password.
export type RegisterResponseData = {
  email?: string;
  expiresAt?: string;
  attemptsRemaining?: number;
};

// Format lỗi đã parse để UI hiển thị message rõ ràng và xử lý cooldown OTP.
export type ParsedApiError = {
  message: string;
  errorCode?: string;
  retryAfterSeconds?: number;
};
