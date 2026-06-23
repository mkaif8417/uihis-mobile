/**
 * utils/authStorage.ts
 *
 * Wraps expo-secure-store for persisting the department-official auth
 * session (JWT + profile fields) on-device, encrypted by the OS keystore
 * (Keychain on iOS, Keystore on Android).
 *
 * On web, SecureStore has no native backing — falls back to localStorage.
 * NOTE: localStorage is NOT encrypted and is readable by any script on the
 * page (XSS risk). Acceptable for dev/testing; revisit before shipping
 * sensitive tokens to web in production (e.g. httpOnly cookies instead).
 *
 * Do NOT pass the JWT through route params or React state alone — params
 * show up in navigation history/deep-link state and aren't encrypted.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'dept_official_session';

export interface DeptSession {
  jwt:         string;
  refreshToken?: string;
  username:    string;
  deptCode?:   string;
  roleCode?:   string;
  accessPage?: string;
}

// ── Platform-aware storage primitives ────────────────────────────────────
async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return await SecureStore.getItemAsync(key);
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

// ── Public API (unchanged signatures) ────────────────────────────────────
export async function saveSession(session: DeptSession): Promise<void> {
  await setItem(KEY, JSON.stringify(session));
}

export async function getSession(): Promise<DeptSession | null> {
  const raw = await getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DeptSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await removeItem(KEY);
}