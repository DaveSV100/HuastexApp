// Passkey (WebAuthn) helpers for the mobile app.
//
// Native requirements (already wired in this sandbox, must exist in prod too):
//  - iOS: Associated Domains entitlement `webcredentials:<RP_ID domain>` and an
//    apple-app-site-association file served from that domain.
//  - Android: assetlinks.json on the domain + the app's signing-cert hash added
//    to the server's WEBAUTHN_ORIGINS as android:apk-key-hash:<base64url>.
import { Passkey } from 'react-native-passkey';
import api from '../api';

export interface PasskeySession {
  token: string;
  token_exp: number;
  role: string;
  name: string;
  email: string;
  branch: string | null;
}

export function isPasskeySupported(): boolean {
  try {
    return Passkey.isSupported();
  } catch {
    return false;
  }
}

// Login. With an email the server offers that account's passkeys; without it
// the OS shows any passkey saved for the domain.
export async function passkeyLogin(email?: string): Promise<PasskeySession> {
  const { data } = await api.post('/auth/passkey/login/options', email ? { email } : {});
  const assertionResponse = await Passkey.get(data.options);
  const { data: result } = await api.post('/auth/passkey/login/verify', {
    challengeKey: data.challengeKey,
    assertionResponse,
  });
  return result;
}

// Adds a passkey to the logged-in account (JWT attached by the api interceptor).
export async function registerPasskey(deviceName?: string) {
  const { data } = await api.post('/auth/passkey/register/options');
  const attestationResponse = await Passkey.create(data.options);
  const { data: result } = await api.post('/auth/passkey/register/verify', {
    challengeKey: data.challengeKey,
    attestationResponse,
    deviceName,
  });
  return result;
}

export function isPasskeyCancelledError(err: unknown): boolean {
  const e = err as { error?: string; message?: string } | undefined;
  const text = `${e?.error ?? ''} ${e?.message ?? ''}`.toLowerCase();
  return text.includes('cancel');
}
