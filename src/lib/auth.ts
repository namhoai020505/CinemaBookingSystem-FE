const roleClaimKeys = [
  'role',
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
];

const emailClaimKeys = [
  'email',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
];

const userIdClaimKeys = [
  'userId',
  'sub',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
];

type JwtPayload = {
  exp?: number;
  role?: string | string[];
  [key: string]: unknown;
};

// Chuyển phần payload base64url của JWT thành chuỗi JSON có thể parse.
const decodeBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(paddedBase64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
};

// Lấy access token hiện tại từ localStorage.
export const getAccessToken = () => localStorage.getItem('accessToken');

// Lấy refresh token để gọi API refresh hoặc logout.
export const getRefreshToken = () => localStorage.getItem('refreshToken');

// Xóa toàn bộ thông tin phiên đăng nhập ở FE.
export const clearAuthSession = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('role');
  localStorage.removeItem('fullName');
};

// Decode JWT và trả payload; nếu token sai định dạng thì trả null.
export const getJwtPayload = (token: string | null = getAccessToken()): JwtPayload | null => {
  if (!token) {
    return null;
  }

  const [, payload] = token.split('.');
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(payload)) as JwtPayload;
  } catch {
    return null;
  }
};

// Kiểm tra access token đã hết hạn chưa để FE tránh dùng token cũ.
export const isAccessTokenExpired = (token: string | null = getAccessToken()) => {
  const payload = getJwtPayload(token);

  if (!payload?.exp) {
    return true;
  }

  return payload.exp * 1000 <= Date.now();
};

// Chuẩn hóa role từ nhiều format khác nhau về chữ thường: ADMIN/ROLE_ADMIN -> admin.
export const normalizeRole = (role: string | null | undefined) =>
  role?.replace(/^ROLE_/i, '').trim().toLowerCase() ?? null;

// Đọc role trực tiếp từ JWT đã ký, không tin role bị sửa trong localStorage.
export const getRoleFromAccessToken = (token: string | null = getAccessToken()) => {
  const payload = getJwtPayload(token);

  if (!payload) {
    return null;
  }

  for (const key of roleClaimKeys) {
    const roleValue = payload[key];
    if (typeof roleValue === 'string' && roleValue.trim()) {
      return roleValue;
    }

    if (Array.isArray(roleValue)) {
      const firstRole = roleValue.find((item) => typeof item === 'string' && item.trim());
      if (typeof firstRole === 'string') {
        return firstRole;
      }
    }
  }

  return null;
};

// Helper dùng khi route cần biết user có phải admin hay không.
export const isAdminRole = (role: string | null | undefined) => normalizeRole(role) === 'admin';

// Helper dùng khi route cần biết user có phải customer hay không.
export const isCustomerRole = (role: string | null | undefined) => normalizeRole(role) === 'customer';

// Lấy claim dạng string theo nhiều key khác nhau vì backend có thể dùng claim chuẩn .NET.
const getStringClaim = (payload: JwtPayload | null, keys: string[]) => {
  if (!payload) {
    return '';
  }

  for (const key of keys) {
    const claimValue = payload[key];
    if (typeof claimValue === 'string' && claimValue.trim()) {
      return claimValue;
    }
  }

  return '';
};

// Gom thông tin user hiện tại từ JWT/localStorage để các UI profile/header dùng chung.
export const getCurrentUserProfile = (token: string | null = getAccessToken()) => {
  const payload = getJwtPayload(token);

  if (!token || !payload) {
    return null;
  }

  return {
    userId: getStringClaim(payload, userIdClaimKeys),
    email: getStringClaim(payload, emailClaimKeys),
    fullName: localStorage.getItem('fullName') || 'Thành viên',
    role: getRoleFromAccessToken(token) || '',
    expiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
  };
};
