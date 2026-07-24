import { useEffect } from 'react';
import { getCurrentUserProfile, getAccessToken } from './auth';

const ACTIVE_SESSIONS_KEY = 'g2c_active_sessions_v1';
const HEARTBEAT_INTERVAL_MS = 3000;
const ONLINE_THRESHOLD_MS = 10000;

export interface ActiveSessionEntry {
  userId: string;
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
  if (!token || !profile || !profile.userId) return;

  const currentMap = readActiveSessionsMap();
  const now = Date.now();

  const updatedMap: Record<string, ActiveSessionEntry> = {};
  Object.entries(currentMap).forEach(([uid, entry]) => {
    if (now - entry.lastSeenAt < 30000) {
      updatedMap[uid] = entry;
    }
  });

  updatedMap[profile.userId] = {
    userId: profile.userId,
    role: profile.role || 'User',
    lastSeenAt: now,
    tabId: TAB_ID,
  };

  try {
    localStorage.setItem(ACTIVE_SESSIONS_KEY, JSON.stringify(updatedMap));
  } catch {
    // Ignore storage errors
  }
};

export const removeMyHeartbeat = () => {
  if (typeof window === 'undefined') return;
  const profile = getCurrentUserProfile();
  if (!profile || !profile.userId) return;

  const currentMap = readActiveSessionsMap();
  delete currentMap[profile.userId];

  try {
    localStorage.setItem(ACTIVE_SESSIONS_KEY, JSON.stringify(currentMap));
  } catch {
    // Ignore storage errors
  }
};

export const isUserOnline = (userId: string): boolean => {
  if (!userId || typeof window === 'undefined') return false;
  const currentMap = readActiveSessionsMap();
  const entry = currentMap[userId];
  if (!entry) return false;
  return Date.now() - entry.lastSeenAt <= ONLINE_THRESHOLD_MS;
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
