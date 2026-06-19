/**
 * services/api.ts
 *
 * Central API layer for UIHis / HAPIS.
 *
 * The C# model UIHisLogin requires these fields:
 *   username    — email / username
 *   password    — hex SHA-256 of the real password (see note below)
 *   hiddensalt  — numeric string, ≤ 10 chars  (server-side anti-replay token)
 *   kon         — 2-digit numeric string       (role/context code)
 *   ipadd       — client IP string
 *   attempt     — int, login attempt count
 *   systemId    — device / system identifier string
 *
 * The entire object is AES-CBC encrypted → sent as { encryptedData: string }.
 * The response is also { encryptedData: string } and must be decrypted.
 *
 * PASSWORD NOTE:
 *   The C# regex `^[a-fA-F0-9]*$` tells us the API expects a HEX string —
 *   almost certainly a SHA-256 hash of the real password.
 *   Hash it here before encrypting so the plaintext never leaves the device.
 *   If your Angular app hashes differently, mirror that logic instead.
 */

import CryptoJS from 'crypto-js';
import { decryptData, encryptData } from '../utils/crypto';

// ─── Base URL ────────────────────────────────────────────────────────────────
import { BASE_URL } from '../ipconfig';

console.log('BASE_URL =>', BASE_URL); 
// ─── Types ───────────────────────────────────────────────────────────────────

/** Shape sent to the API (encrypted). Must match C# UIHisLogin exactly. */
export interface LoginPayload {
  username:   string;
  password:   string;   // hex SHA-256
  hiddensalt: string;   // numeric string ≤10 chars
  kon:        string;   // 2-digit numeric string, e.g. "01"
  ipadd:      string;
  attempt:    number;
  systemId:   string;
}


/** Decrypted login response shape (adjust to whatever your API actually returns). */
export interface LoginResponse {
  success?:      boolean;
  Success?:      boolean;
  status?:       string;
  Status?:       string;
  message?:      string;
  Message?:      string;
  errorMessage?: string;
  ErrorMessage?: string;
  userName?:     string;
  UserName?:     string;
  token?:        string;
  [key: string]: unknown;   // allow extra fields without TS errors
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Hash password to hex SHA-256.
 * Mirror whatever your Angular project does before sending the password.
 */
function hashPassword(password: string, rawSalt: string): string {
  // Angular: sha256(password)
  const passwordHash = CryptoJS.SHA256(password)
    .toString(CryptoJS.enc.Hex);

  // Angular: sha256(hiddensalt)
  const saltHash = CryptoJS.SHA256(rawSalt)
    .toString(CryptoJS.enc.Hex);

  // Angular:
  // var shacd = sha256(password) + sha256(hiddensalt);
  // var shacd1 = sha256(shacd);
  const finalHash = CryptoJS.SHA256(passwordHash + saltHash)
    .toString(CryptoJS.enc.Hex);

  return finalHash;
}
/**
 * Generic encrypted POST helper.
 * Encrypts `body`, POSTs to `endpoint`, decrypts and returns the response.
 */
// async function encryptedPost<TBody, TResponse>(
//   endpoint: string,
//   body: TBody,
// ): Promise<TResponse> {
//   console.log('Sending payload =>', JSON.stringify(body)); 
//   const encryptedData = encryptData(body);

//   const response = await fetch(`${BASE_URL}${endpoint}`, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       Accept:         'application/json',
//     },
//     body: JSON.stringify({ encryptedData }),
//   });

//   if (!response.ok) {
//     // Try to read a JSON error body; fall back to status text
//     let errMsg = `HTTP ${response.status}`;
//     try {
//       const errJson = await response.json();
//       errMsg = errJson?.message ?? errJson?.Message ?? errMsg;
//     } catch {
//       errMsg = (await response.text()) || errMsg;
//     }
//     throw new Error(errMsg);
//   }

//   const json = await response.json();

//   // Some endpoints may return plain JSON on success instead of encrypted payload
//   if (!json?.encryptedData) {
//     return json as TResponse;
//   }

//   return decryptData<TResponse>(json.encryptedData);
// }

// ─── Auth API ─────────────────────────────────────────────────────────────────
async function encryptedPost<TBody, TResponse>(
  endpoint: string,
  body: TBody,
): Promise<TResponse> {
  console.log('Sending payload =>', JSON.stringify(body));

  const encryptedData = encryptData(body);

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  // ===== DEBUG =====
  if (!response.ok) {
    const text = await response.text();

    console.log('====================================');
    console.log('STATUS       :', response.status);
    console.log('STATUS TEXT  :', response.statusText);
    console.log('RAW RESPONSE :', text);
    console.log('====================================');

    throw new Error(text || `HTTP ${response.status}`);
  }

  const json = await response.json();

  console.log('SUCCESS RESPONSE:', json);

  if (!json?.encryptedData) {
    return json as TResponse;
  }

  const decrypted = decryptData<TResponse>(json.encryptedData);

  console.log('DECRYPTED RESPONSE:', decrypted);

  return decrypted;
}
export interface LoginArgs {
  username:  string;
  password:  string;   // plaintext — will be hashed here
  kon?:      string;   // role code; default '01'
  attempt?:  number;
  systemId?: string;
}

/**
 * POST /api/UIHis/Login
 *
 * Builds the full UIHisLogin payload, encrypts it, sends it,
 * decrypts the response, and returns the LoginResponse.
 *
 * Throws an Error with a human-readable message on failure.
 */
// TEMP DEBUG — remove before production
export async function loginDepartmentOfficial(args: LoginArgs): Promise<LoginResponse> {
//   const rawSalt = String(Date.now()).slice(-10);

// const payload: LoginPayload = {
//   username:   args.username.trim(),
//   password:   hashPassword(args.password.trim(), rawSalt),
//   hiddensalt: CryptoJS.SHA256(rawSalt).toString(CryptoJS.enc.Hex), // ← hashed
//   kon:        '34',//args.kon ?? 
//   ipadd:      '0.0.0.0',
//   attempt:    args.attempt ?? 1,
//   systemId:   args.systemId ?? 'MOBILE_APP',
// };

// const rawSalt = String(Date.now()).slice(-10);
const rawSalt = Math.floor(100000 + Math.random() * 900000).toString();
const payload: LoginPayload = {
  username: args.username.trim(),
  password: hashPassword(args.password.trim(), rawSalt),
hiddensalt: rawSalt,
  kon: '34',
  ipadd: '0.0.0.0',
  attempt: 1,
  systemId: 'MOBILE_APP',
};
console.log('rawSalt:', rawSalt);

console.log(
  'passwordHash:',
  CryptoJS.SHA256(args.password.trim()).toString(CryptoJS.enc.Hex)
);

console.log(
  'saltHash:',
  CryptoJS.SHA256(rawSalt).toString(CryptoJS.enc.Hex)
);

console.log(
  'finalPassword:',
  hashPassword(args.password.trim(), rawSalt)
);

console.log('payload:', JSON.stringify(payload, null, 2));
  // ADD HERE
  console.log("rawSalt =", rawSalt);
  console.log("hiddensalt =", payload.hiddensalt);

  // ── DEBUG START ──────────────────────────────────────────────────
  const key = process.env.EXPO_PUBLIC_SECRET_KEY ?? '';
  const iv  = process.env.EXPO_PUBLIC_SECRET_IV  ?? '';
  // console.log('[DEBUG] KEY length:', key.length, '| IV length:', iv.length);
  // console.log('[DEBUG] KEY:', key);   // remove after confirming
  console.log('[DEBUG] payload (plain):', JSON.stringify(payload, null, 2));

  // Test round-trip
  const { encryptData, decryptData } = require('../utils/crypto');
  const encrypted = encryptData(payload);
  console.log('[DEBUG] encrypted sample (first 60):', encrypted.slice(0, 60));
  try {
    const roundTrip = decryptData(encrypted);
    console.log('[DEBUG] round-trip OK:', JSON.stringify(roundTrip));
  } catch (e) {
    console.error('[DEBUG] round-trip FAILED:', e);
  }
  // ── DEBUG END ────────────────────────────────────────────────────

  return encryptedPost<LoginPayload, LoginResponse>('/api/UIHis/checkcredentials', payload);
}