import { api } from "./api";
import { AUTH_ENDPOINTS } from "./config";
import {
  AuthUser,
  clearSession,
  getRefreshToken,
  getUser,
  saveSession,
  setUser,
} from "./storage";

export type LoginResponse = {
  access: string;
  refresh: string;
  user: AuthUser;
};

/** POST /api/auth/login/ — persists access, refresh and the user profile. */
export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>(AUTH_ENDPOINTS.login, {
    email,
    password,
  });

  await saveSession(data.access, data.refresh, data.user ?? null);
  return data;
}

/**
 * POST /api/auth/logout/ — blacklists the refresh token (205).
 * The local session is cleared even if the call fails, so the teacher is
 * never stuck logged in on a dead token.
 */
export async function logout(): Promise<void> {
  const refresh = await getRefreshToken();

  try {
    if (refresh) {
      await api.post(AUTH_ENDPOINTS.logout, { refresh });
    }
  } catch {
    // Already expired or offline — local cleanup below is what matters.
  } finally {
    await clearSession();
  }
}

/** POST /api/auth/verify/ — true while the token is still valid. */
export async function verifyToken(token: string): Promise<boolean> {
  try {
    await api.post(AUTH_ENDPOINTS.verify, { token });
    return true;
  } catch {
    return false;
  }
}

/** GET /api/auth/me/ — fetches and caches the profile. */
export async function fetchMe(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>(AUTH_ENDPOINTS.me);

  // Field names drive every profile row; log the keys (not the values) so an
  // unmapped field is obvious instead of silently rendering "-".
  console.log(`[auth] /me/ keys: ${Object.keys(data ?? {}).join(", ")}`);

  await setUser(data);
  return data;
}

/**
 * PATCH /api/auth/me/ — replaces the profile photo.
 *
 * Content-Type is left unset on purpose: the request interceptor suppresses it
 * so React Native attaches the multipart boundary, and it attaches the Bearer
 * token. Both are required for the file to arrive.
 */
export async function updateProfilePhoto(photoUri: string): Promise<AuthUser> {
  const formData = new FormData();

  formData.append("foto", {
    uri: photoUri,
    name: "perfil.jpg",
    type: "image/jpeg",
  } as any);

  const { data } = await api.patch<AuthUser>(AUTH_ENDPOINTS.me, formData, {
    transformRequest: (value) => value,
    timeout: 60000,
  });

  await setUser(data);
  return data;
}

/** Absolute URL of the profile photo, whatever key the serializer uses. */
export function photoUrl(user: AuthUser | null): string | null {
  if (!user) return null;

  for (const key of ["foto", "photo", "avatar", "imajen"]) {
    const value = user[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return null;
}

/** Cached profile, for instant paint before /me/ resolves. */
export const getCachedUser = getUser;

/** Best display name available, whatever shape the serializer returns. */
export function displayName(user: AuthUser | null, fallback = ""): string {
  if (!user) return fallback;

  const composed = [user.first_name, user.last_name]
    .filter((part): part is string => typeof part === "string" && !!part.trim())
    .join(" ")
    .trim();

  const candidate =
    (typeof user.full_name === "string" && user.full_name) ||
    (typeof user.name === "string" && user.name) ||
    composed ||
    (typeof user.email === "string" && user.email) ||
    "";

  return candidate || fallback;
}

/** Reads a string field from the profile under any of the given keys. */
export function userField(
  user: AuthUser | null,
  keys: string[],
  fallback = "",
): string {
  if (!user) return fallback;

  for (const key of keys) {
    const value = user[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
    if (value && typeof value === "object") {
      const nested = (value as Record<string, unknown>).name;
      if (typeof nested === "string" && nested.trim()) return nested;
    }
  }

  return fallback;
}
