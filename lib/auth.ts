import { api, backgroundPost } from "./api";
import { AUTH_ENDPOINTS } from "./config";
import { clearFeed } from "./feed";
import { cancelReminders } from "./notifications";
import {
  AuthUser,
  clearSession,
  getAccessToken,
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
 * Signs the teacher out.
 *
 * The session is cleared locally **first**, so the UI can navigate at once,
 * and the server-side blacklist (`POST /api/auth/logout/`, 205) is fired
 * afterwards without being awaited.
 *
 * Awaiting that call is what made logout feel broken: it runs through the
 * normal client, so an unreachable host costs a 12s timeout, then failover
 * replays it against the next candidate for another 12s — up to ~24s of
 * staring at the profile screen before anything happened. Nothing about
 * being logged out on this device depends on that response.
 */
export async function logout(): Promise<void> {
  const [access, refresh] = await Promise.all([
    getAccessToken(),
    getRefreshToken(),
  ]);

  // Local state goes first — this is what "logged out" means on the device.
  await clearSession();

  // A signed-out phone should stop reminding anyone to punch, and must not
  // leave one teacher's punch history visible to the next person to log in.
  cancelReminders().catch(() => {});
  clearFeed().catch(() => {});

  if (refresh) {
    // Bare client: no interceptor could re-authenticate this anyway, since
    // the tokens it would need are already gone.
    backgroundPost(AUTH_ENDPOINTS.logout, { refresh }, access).catch(() => {
      // Offline, expired, or already blacklisted — the refresh token stays
      // valid server-side until it expires. Acceptable: it is unreachable
      // from this device now.
    });
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

/**
 * The teacher's name. `naran_kompletu` is what the API actually sends; the
 * other keys are tolerated only so an older payload still renders. Falling
 * through to the e-mail is a last resort, not a normal outcome.
 */
export function displayName(user: AuthUser | null, fallback = ""): string {
  if (!user) return fallback;

  const composed = [user.first_name, user.last_name]
    .filter((part): part is string => typeof part === "string" && !!part.trim())
    .join(" ")
    .trim();

  const candidate =
    (typeof user.naran_kompletu === "string" && user.naran_kompletu) ||
    (typeof user.full_name === "string" && user.full_name) ||
    (typeof user.name === "string" && user.name) ||
    composed ||
    (typeof user.email === "string" && user.email) ||
    "";

  return candidate || fallback;
}

/** Staff number as printed on the paper sheet — not the database primary key. */
export const staffNumber = (user: AuthUser | null, fallback = "-") =>
  userField(user, ["numeru_id"], fallback);

/** "Professór" / "Administradór" — the label, never the stored role value. */
export const roleLabel = (user: AuthUser | null, fallback = "") =>
  userField(user, ["role_display"], fallback);

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
