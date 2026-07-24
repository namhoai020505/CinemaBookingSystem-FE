import { useEffect } from 'react';
import { getCurrentUserProfile, getAccessToken } from './auth';
import { notificationService } from '../services/notificationService';

const ACTIVE_SESSIONS_KEY = 'g2c_active_sessions_v1';
const HEARTBEAT_INTERVAL_MS = 2000;
const ONLINE_THRESHOLD_MS = 30000; // Extended 30s threshold

export interface ActiveSessionEntry {
  userId: string;
  email?: string;
  role: string;
  lastSeenAt: number;
  tabId: string;
}

const TAB_ID = Math.random().toString(36).substring(2, 9);

export const readActiveSessionsMap = (): Record<string, ActiveSessionEntry> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ACTIVE_SESSIONS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

export const updateMyHeartbeat = () => {
  if (typeof window === 'undefined') return;
  const token = getAccessToken();
  const profile = getCurrentUserProfile();

  const currentMap = readActiveSessionsMap();
  const now = Date.now();

  // Clean old expired entries (> 60s)
  const updatedMap: Record<string, ActiveSessionEntry> = {};
  Object.entries(currentMap).forEach(([uid, entry]) => {
    if (now - entry.lastSeenAt < 60000) {
      updatedMap[uid] = entry;
    }
  });

  if (token && profile) {
    const sessionKey = (profile.userId || profile.email || 'user-active').toLowerCase();
    updatedMap[sessionKey] = {
      userId: profile.userId || sessionKey,
      email: profile.email || '',
      role: profile.role || 'User',
      lastSeenAt: now,
      tabId: TAB_ID,
    };

    // Send heartbeat to Backend API for cross-browser / cross-device online status tracking
    void notificationService.sendHeartbeat().catch(() => {});
  }

  try {
    localStorage.setItem(ACTIVE_SESSIONS_KEY, JSON.stringify(updatedMap));
  } catch {
    // Ignore storage errors
  }
};

export const removeMyHeartbeat = () => {
  if (typeof window === 'undefined') return;
  const profile = getCurrentUserProfile();
  if (!profile) return;

  const currentMap = readActiveSessionsMap();
  const sessionKey = (profile.userId || profile.email || '').toLowerCase();
  if (sessionKey) {
    delete currentMap[sessionKey];
  }

  try {
    localStorage.setItem(ACTIVE_SESSIONS_KEY, JSON.stringify(currentMap));
  } catch {
    // Ignore storage errors
  }
};

export const isUserOnline = (userIdOrEmail: string, optionalEmail?: string, optionalRole?: string): boolean => {
  if (!userIdOrEmail || typeof window === 'undefined') return false;
  const currentMap = readActiveSessionsMap();
  const now = Date.now();

  const q1 = userIdOrEmail.trim().toLowerCase();
  const q2 = (optionalEmail || '').trim().toLowerCase();
  const roleLower = (optionalRole || '').trim().toLowerCase();

  const activeEntries = Object.values(currentMap).filter(
    (entry) => now - entry.lastSeenAt <= ONLINE_THRESHOLD_MS
  );

  if (activeEntries.length === 0) return false;

  return activeEntries.some((entry) => {
    const entryUid = (entry.userId || '').trim().toLowerCase();
    const entryEmail = (entry.email || '').trim().toLowerCase();
    const entryRole = (entry.role || '').trim().toLowerCase();

    // Direct match on ID or email
    if (entryUid && (entryUid === q1 || entryUid === q2)) return true;
    if (entryEmail && (entryEmail === q1 || entryEmail === q2)) return true;

    // Match static staff aliases (e.g. U_STATIC_STAFF, staff@gmail.com, usr-staff-01)
    if (
      (q1.includes('staff') || q2.includes('staff')) &&
      (entryUid.includes('staff') || entryEmail.includes('staff') || entryRole.includes('staff'))
    ) {
      return true;
    }

    // Match static manager aliases (e.g. U_STATIC_MANAGER, huy.manager@g2cinema.vn, usr-mgr-01)
    if (
      (q1.includes('manager') || q2.includes('manager') || q1.includes('mgr') || q2.includes('mgr')) &&
      (entryUid.includes('manager') || entryEmail.includes('manager') || entryRole.includes('manager'))
    ) {
      return true;
    }

    return false;
  });
};

export const useSessionHeartbeat = () => {
  useEffect(() => {
    updateMyHeartbeat();

    const interval = setInterval(() => {
      updateMyHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    const handleUnload = () => {
      removeMyHeartbeat();
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);
};
