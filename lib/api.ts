import axios, {
  AxiosError,
  AxiosHeaders,
  InternalAxiosRequestConfig,
} from "axios";
import { router } from "expo-router";

import { API_BASE_URL, API_HOSTS, AUTH_ENDPOINTS, PUBLIC_PATHS } from "./config";
import {
  clearSession,
  getAccessToken,
  getPreferredHost,
  getRefreshToken,
  setPreferredHost,
  setTokens,
} from "./storage";

type RetriableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  /** How many candidate hosts this request has already burned through. */
  _hostsTried?: number;
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  // Kept short so an unreachable host fails over quickly. Photo uploads pass
  // their own longer timeout.
  timeout: 12000,
  headers: { Accept: "application/json" },
});

/** Bare client for refresh calls, so interceptors can't recurse into themselves. */
const plain = axios.create({
  baseURL: API_BASE_URL,
  // Kept short so an unreachable host fails over quickly. Photo uploads pass
  // their own longer timeout.
  timeout: 12000,
  headers: { Accept: "application/json" },
});

const isPublicPath = (url?: string) =>
  !!url && PUBLIC_PATHS.some((path) => url.includes(path));

/* ------------------------------------------------------------------ *
 * Host failover — the school server answers on different subnets
 * ------------------------------------------------------------------ */

let activeHost = API_BASE_URL;

function applyHost(host: string) {
  activeHost = host;
  api.defaults.baseURL = host;
  plain.defaults.baseURL = host;
}

/** Restores the host that last answered, so a dead one isn't retried first. */
const hostReady = (async () => {
  const saved = await getPreferredHost();
  if (saved && API_HOSTS.includes(saved)) applyHost(saved);
})();

export const getActiveHost = () => activeHost;

/** Rotates to the next candidate and remembers it. */
async function switchToNextHost(): Promise<string | null> {
  if (API_HOSTS.length < 2) return null;

  const next = API_HOSTS[(API_HOSTS.indexOf(activeHost) + 1) % API_HOSTS.length];
  applyHost(next);
  await setPreferredHost(next);

  return next;
}

/* ------------------------------------------------------------------ *
 * Request interceptor — attach the access token
 * ------------------------------------------------------------------ */

api.interceptors.request.use(async (config) => {
  // Wait for the remembered host before the first request goes out.
  await hostReady;
  config.baseURL = activeHost;

  const headers = AxiosHeaders.from(config.headers);

  // React Native only appends the multipart boundary when Content-Type is
  // absent. Setting it by hand yields a boundary-less header, Django parses
  // zero parts, and every required field reports as missing.
  //
  // Deleting is not enough: dispatchRequest re-adds a default
  // application/x-www-form-urlencoded for POST *after* this interceptor runs.
  // Assigning `false` both clears it and blocks that default, and axios omits
  // false-valued headers when serialising the request.
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    headers.set("Content-Type", false);
  }

  if (!isPublicPath(config.url)) {
    let token = await getAccessToken();

    // No access token but a refresh is on file: mint one before sending,
    // rather than firing a request that is certain to 401.
    if (!token) token = await refreshAccessToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    } else {
      // Never log the token itself — only whether one was found.
      console.warn(`[api] no access token available for ${config.url}`);
    }
  }

  config.headers = headers;
  return config;
});

/* ------------------------------------------------------------------ *
 * Token refresh — single-flight, so N concurrent 401s cause 1 refresh
 * ------------------------------------------------------------------ */

let refreshInFlight: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refresh = await getRefreshToken();
  if (!refresh) return null;

  try {
    const { data } = await plain.post(AUTH_ENDPOINTS.refresh, { refresh });
    const access: string | undefined = data?.access;
    if (!access) return null;

    // SimpleJWT rotates the refresh token when ROTATE_REFRESH_TOKENS is on —
    // persist the new one or the next refresh fails.
    await setTokens(access, data?.refresh ?? null);
    return access;
  } catch {
    return null;
  }
}

export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/* ------------------------------------------------------------------ *
 * Session expiry — wipe storage and send the teacher back to login
 * ------------------------------------------------------------------ */

let redirecting = false;

export async function forceLogin() {
  if (redirecting) return;
  redirecting = true;

  await clearSession();
  try {
    router.replace("/(auth)");
  } catch {
    // Navigation not mounted yet; the root layout guard will catch it.
  }

  setTimeout(() => {
    redirecting = false;
  }, 1000);
}

/* ------------------------------------------------------------------ *
 * Response interceptor — refresh once, replay, otherwise bounce to login
 * ------------------------------------------------------------------ */

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    // No response at all: log the target so a misconfigured host, an
    // unreachable server and a stalled upload can be told apart.
    if (!error.response) {
      console.warn(
        `[api] no response from ${config?.baseURL ?? ""}${config?.url ?? ""}` +
          ` — code=${error.code ?? "none"} message=${error.message}`,
      );

      // The host is unreachable — fall through to the next candidate and
      // replay, until every host has been tried once for this request.
      if (config) {
        const tried = (config._hostsTried ?? 0) + 1;

        if (tried < API_HOSTS.length) {
          config._hostsTried = tried;

          const next = await switchToNextHost();
          if (next) {
            console.warn(`[api] switching to fallback host ${next}`);
            return api(config);
          }
        }
      }
    }

    if (!config || isPublicPath(config.url)) {
      return Promise.reject(error);
    }

    if (status === 401 && !config._retry) {
      config._retry = true;

      const access = await refreshAccessToken();
      if (access) {
        const headers = AxiosHeaders.from(config.headers);
        headers.set("Authorization", `Bearer ${access}`);
        config.headers = headers;
        return api(config);
      }

      // Refresh token is gone or blacklisted — a real re-login is required.
      await forceLogin();
      return Promise.reject(error);
    }

    if (status === 401 || status === 403) {
      await forceLogin();
    }

    return Promise.reject(error);
  },
);

/** Human-readable message from a DRF error body, for the existing error slots. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;

  if (!error.response) {
    return error.code === "ECONNABORTED"
      ? "Servidor la responde. Verifika koneksaun no koko fila fali."
      : "La konsege konekta ba servidor";
  }

  const data = error.response.data as Record<string, unknown> | string | null;
  if (typeof data === "string" && data.trim()) return data;

  if (data && typeof data === "object") {
    const direct = data.detail ?? data.message ?? data.error;
    if (typeof direct === "string") return direct;

    // DRF returns {field: [msg, ...]} — report every field, not just the
    // first, so a partial payload doesn't hide the rest of the problem.
    const parts = Object.entries(data).map(([field, value]) => {
      const text = Array.isArray(value) ? value.join(" ") : String(value);
      return field === "non_field_errors" ? text : `${field}: ${text}`;
    });

    if (parts.length) return parts.join("\n");
  }

  return fallback;
}
