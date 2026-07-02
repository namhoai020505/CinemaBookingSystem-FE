/**
 * e2e/helpers/auth.ts
 * ───────────────────
 * Real login helpers — call the live API, store JWT in localStorage.
 * No mocking. Use these instead of manually injecting fake tokens.
 */

import type { Page } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:5070';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  role: string;
  fullName: string;
}

/**
 * POST /api/auth/login with real credentials.
 * Stores accessToken + profile fields in localStorage so the React app
 * reads them on the next navigation exactly as a real browser session would.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string,
): Promise<AuthTokens> {
  const response = await page.request.post(`${API_BASE}/api/auth/login`, {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Login failed for ${email}: HTTP ${response.status()} — ${body}`);
  }

  const body = await response.json() as {
    success: boolean;
    data?: {
      accessToken?: string;
      refreshToken?: string;
      userId?: string;
      email?: string;
      role?: string;
      fullName?: string;
    };
  };

  if (!body.success || !body.data?.accessToken) {
    throw new Error(`Login API returned success=false for ${email}: ${JSON.stringify(body)}`);
  }

  const tokens: AuthTokens = {
    accessToken: body.data.accessToken!,
    refreshToken: body.data.refreshToken ?? '',
    userId: body.data.userId ?? '',
    email: body.data.email ?? email,
    role: body.data.role ?? '',
    fullName: body.data.fullName ?? '',
  };

  // Inject into localStorage so React app sees an authenticated session
  await page.evaluate((t) => {
    localStorage.setItem('accessToken', t.accessToken);
    localStorage.setItem('refreshToken', t.refreshToken);
    localStorage.setItem('userId', t.userId);
    localStorage.setItem('email', t.email);
    localStorage.setItem('role', t.role);
    localStorage.setItem('fullName', t.fullName);
  }, tokens);

  return tokens;
}

/** Login with the seed admin account from .env.test */
export async function loginAsAdmin(page: Page): Promise<AuthTokens> {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set in .env.test');
  }
  return loginAs(page, email, password);
}

/** Login with the seed customer account from .env.test */
export async function loginAsCustomer(page: Page): Promise<AuthTokens> {
  const email = process.env.TEST_CUSTOMER_EMAIL;
  const password = process.env.TEST_CUSTOMER_PASSWORD;
  if (!email || !password) {
    throw new Error('TEST_CUSTOMER_EMAIL / TEST_CUSTOMER_PASSWORD not set in .env.test');
  }
  return loginAs(page, email, password);
}

/** Clear all auth state from localStorage */
export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    ['accessToken', 'refreshToken', 'userId', 'email', 'role', 'fullName'].forEach(
      (k) => localStorage.removeItem(k),
    );
  });
}
