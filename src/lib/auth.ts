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

type AuthSession = {
  accessToken: string | null;
  refreshToken: string | null;
  fullName: string | null;
};

export type AuthSessionInput = {
  accessToken: string;
  refreshToken?: string | null;
  fullName?: string | null;
};

export const AUTH_SESSION_EVENT = 'g2c-auth-session-changed';

const LEGACY_TOKEN_KEYS = ['role'];

const authSession: AuthSession = {
  accessToken: null,
  refreshToken: null,
  fullName:
    typeof window === 'undefined' ? null : localStorage.getItem('fullName'),
};

const removeLegacyStoredTokens = () => {
  if (typeof window === 'undefined') {
    return;
  }

  for (const key of LEGACY_TOKEN_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
};

const notifyAuthSessionChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
  }
};

const decodeBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(paddedBase64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
};

removeLegacyStoredTokens();

export const setAuthSession = ({
  accessToken,
  refreshToken = null,
  fullName = null,
}: AuthSessionInput) => {
  authSession.accessToken = accessToken;
  authSession.refreshToken = refreshToken;
  localStorage.setItem('accessToken', accessToken);

  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  }

  authSession.fullName = fullName || 'Người dùng';

  removeLegacyStoredTokens();
  localStorage.setItem('fullName', authSession.fullName);
  notifyAuthSessionChanged();
};

export const getAccessToken = () =>
  authSession.accessToken || localStorage.getItem('accessToken');

export const getRefreshToken = () =>
  authSession.refreshToken || localStorage.getItem('refreshToken');

export const getAuthFullName = () =>
  authSession.fullName || localStorage.getItem('fullName') || 'Thành viên';

export const clearAuthSession = () => {
  authSession.accessToken = null;
  authSession.refreshToken = null;
  authSession.fullName = null;

  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  removeLegacyStoredTokens();
  localStorage.removeItem('fullName');
  notifyAuthSessionChanged();
};

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

export const isAccessTokenExpired = (token: string | null = getAccessToken()) => {
  const payload = getJwtPayload(token);

  if (!payload?.exp) {
    return true;
  }

  return payload.exp * 1000 <= Date.now();
};

export const normalizeRole = (role: string | null | undefined) =>
  role?.replace(/^ROLE_/i, '').trim().toLowerCase() ?? null;

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

export const isAdminRole = (role: string | null | undefined) => normalizeRole(role) === 'admin';

export const isManagerRole = (role: string | null | undefined) => normalizeRole(role) === 'manager';

export const isStaffRole = (role: string | null | undefined) => normalizeRole(role) === 'staff';

export const isCustomerRole = (role: string | null | undefined) => normalizeRole(role) === 'customer';

export const getPostLoginRedirect = (role: string | null | undefined) => {
  if (isAdminRole(role)) {
    return '/admin/dashboard';
  }

  if (isManagerRole(role)) {
    return '/manager/dashboard';
  }

  if (isStaffRole(role)) {
    return '/staff/ticket-scanner';
  }

  return '/';
};

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

export const getCurrentUserProfile = (token: string | null = getAccessToken()) => {
  const payload = getJwtPayload(token);

  if (!token || !payload) {
    return null;
  }

  return {
    userId: getStringClaim(payload, userIdClaimKeys),
    email: getStringClaim(payload, emailClaimKeys),
    fullName: getAuthFullName(),
    role: getRoleFromAccessToken(token) || '',
    expiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
  };
};
