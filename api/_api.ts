import CryptoJS from 'crypto-js';
import { BASE_URL } from '../ipconfig';
import { decryptData, encryptData } from '../utils/crypto';

export interface LoginPayload {
  username:   string;
  password:   string;
  hiddensalt: string;
  kon:        string;
  ipadd:      string;
  attempt:    number;
  systemId:   string;
}

export interface GetHNLoginData {
  dept_code?:      string;
  scheme_code?:    string;
  level_code?:     string;
  role_code?:      string;
  adh_code?:       string;
  ho_code?:        string;
  Role_Name?:      string;
  state_code?:     string;
  district_code?:  string;
  mandal_code?:    string;
  Panchayat_code?: string;
  reg_code?:       string;
  user_id?:        string;
  user_name?:      string;
  access_page?:    string;
  scheme?:         string;
  JWT?:            string;
  refreshToken?:   string;
  [key: string]: unknown;
}

export type LoginResponse = GetHNLoginData[];

export interface LoginArgs {
  username:  string;
  password:  string;
  kon?:      string;
  attempt?:  number;
  systemId?: string;
}

function hashPassword(password: string, rawSalt: string): string {
  const passwordHash = CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex);
  // rawSalt used directly — NOT sha256(rawSalt)
  return CryptoJS.SHA256(passwordHash + rawSalt).toString(CryptoJS.enc.Hex);
}


function generateSalt(): string {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

export async function loginDepartmentOfficial(args: LoginArgs): Promise<LoginResponse> {
  const rawSalt    = generateSalt();
  const saltHashed = CryptoJS.SHA256(rawSalt).toString(CryptoJS.enc.Hex);

 const payload: LoginPayload = {
  username:   args.username.trim(),
  password:   hashPassword(args.password.trim(), rawSalt),
  hiddensalt: rawSalt,       // ← RAW salt, not sha256(rawSalt)
  kon:        '34',
  ipadd:      '0.0.0.0',
  attempt:    args.attempt ?? 0,
  systemId:   args.systemId ?? 'MOBILE_APP',
};

  if (__DEV__) {
    console.log('=== OUR PAYLOAD ===');
    console.log('rawSalt:    ', rawSalt);
    console.log('saltHashed: ', saltHashed);
    console.log(JSON.stringify(payload, null, 2));
  }

  let response: Response;

  try {
    response = await fetch(`${BASE_URL}/api/UIHis/Login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({ encryptedData: encryptData(payload) }),
    });

    if (__DEV__) {
      console.log('response status:', response.status);
      console.log('response ok:    ', response.ok);
    }

  } catch (networkErr: any) {
    throw new Error('Network request failed — check your connection and try again.');
  }

  if (!response.ok) {
    let errMsg = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      errMsg = errJson?.title ?? errJson?.message ?? errJson?.Message ?? JSON.stringify(errJson) ?? errMsg;
    } catch {
      const text = await response.text();
      errMsg = text || errMsg;
    }
    throw new Error(errMsg);
  }

  try {
    const json = await response.json();
    if (__DEV__) console.log('raw response json:', json);
    return decryptData<LoginResponse>(json.encryptedData);
  } catch (decryptErr: any) {
    throw new Error('Failed to decrypt server response — possible key/IV mismatch.');
  }
}