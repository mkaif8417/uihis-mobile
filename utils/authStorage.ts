/**
 * utils/authStorage.ts
 *
 * Wraps expo-secure-store for persisting the department-official auth
 * session (JWT + profile fields) on-device, encrypted by the OS keystore
 * (Keychain on iOS, Keystore on Android).
 *
 * Do NOT pass the JWT through route params or React state alone — params
 * show up in navigation history/deep-link state and aren't encrypted.
 */
import * as SecureStore from 'expo-secure-store';

const KEY = 'dept_official_session';

export interface DeptSession {
  jwt:         string;
  refreshToken?: string;
  username:    string;
  deptCode?:   string;
  roleCode?:   string;
  accessPage?: string;
}

export async function saveSession(session: DeptSession): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

export async function getSession(): Promise<DeptSession | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DeptSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}