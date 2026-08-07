import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "user_profile";

/** Key used by the pre-API mock login. Cleared so old installs log in again. */
const LEGACY_TOKEN_KEY = "auth_token";

/**
 * Last backend host that answered. Deliberately NOT cleared on logout — which
 * server is reachable is a property of the network, not of the session.
 */
const API_HOST_KEY = "api_host";

export type AuthUser = {
  id?: number | string;
  email?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  [key: string]: unknown;
};

async function read(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) {
      await SecureStore.deleteItemAsync(key);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Keychain/Keystore unavailable — nothing useful to do here.
  }
}

export const getAccessToken = () => read(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => read(REFRESH_TOKEN_KEY);

export async function setTokens(access: string, refresh?: string | null) {
  await write(ACCESS_TOKEN_KEY, access);
  if (refresh) await write(REFRESH_TOKEN_KEY, refresh);
}

export async function getUser(): Promise<AuthUser | null> {
  const raw = await read(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function setUser(user: AuthUser | null) {
  await write(USER_KEY, user ? JSON.stringify(user) : null);
}

export async function saveSession(
  access: string,
  refresh: string,
  user: AuthUser | null,
) {
  await setTokens(access, refresh);
  await setUser(user);
  await write(LEGACY_TOKEN_KEY, null);
}

export const getPreferredHost = () => read(API_HOST_KEY);

export const setPreferredHost = (host: string) => write(API_HOST_KEY, host);

export async function clearSession() {
  await Promise.all([
    write(ACCESS_TOKEN_KEY, null),
    write(REFRESH_TOKEN_KEY, null),
    write(USER_KEY, null),
    write(LEGACY_TOKEN_KEY, null),
  ]);
}
