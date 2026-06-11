export type AuthMode = 'login' | 'register' | 'forgot';

export type RegisterStep = 'form' | 'verify';

export type PasswordResetStep = 'request' | 'reset';

export type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data?: T | null;
  errorCode?: string | null;
  errors?: Record<string, string[]> | null;
};

export type AuthResponseData = {
  accessToken?: string;
  token?: string;
  refreshToken?: string;
  fullName?: string;
  role?: string;
};

export type RegisterResponseData = {
  email?: string;
  expiresAt?: string;
  attemptsRemaining?: number;
};

export type ParsedApiError = {
  message: string;
  errorCode?: string;
  retryAfterSeconds?: number;
};
