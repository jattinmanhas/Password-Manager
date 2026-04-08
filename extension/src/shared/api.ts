/**
 * API client for the extension.
 * Uses chrome.storage.local for the configurable backend URL.
 * Falls back to http://localhost:8080 if not configured.
 */

const DEFAULT_API_ORIGIN = "http://localhost:8080";
const DEFAULT_SESSION_COOKIE_NAME = "pmv2_session";

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** Get the configured backend URL from chrome.storage.local */
export async function getApiOrigin(): Promise<string> {
  try {
    const result = await chrome.storage.local.get("pmv2_api_origin");
    const origin = result.pmv2_api_origin;
    if (typeof origin === "string" && origin.trim().length > 0) {
      return origin.replace(/\/$/, "");
    }
  } catch {
    // chrome.storage not available (e.g. content script context)
  }
  return DEFAULT_API_ORIGIN;
}

/** Save the backend URL to chrome.storage.local */
export async function setApiOrigin(origin: string): Promise<void> {
  await chrome.storage.local.set({ pmv2_api_origin: origin.replace(/\/$/, "") });
}

async function getSessionToken(origin: string): Promise<string | null> {
  if (!chrome.cookies?.get) {
    return null;
  }

  try {
    const cookie = await chrome.cookies.get({
      url: origin,
      name: DEFAULT_SESSION_COOKIE_NAME,
    });
    return cookie?.value?.trim() || null;
  } catch {
    return null;
  }
}

export async function request<T>(
  method: string,
  endpoint: string,
  body?: unknown,
): Promise<T> {
  const origin = await getApiOrigin();
  const base = `${origin}/api/v1`;
  const sessionToken = await getSessionToken(origin);

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  const res = await fetch(`${base}${endpoint}`, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let errRes: { error: string; message: string };
    try {
      errRes = await res.json();
    } catch {
      throw new Error(`HTTP ${res.status}`);
    }
    throw new ApiError(errRes.error, errRes.message);
  }

  return res.json() as Promise<T>;
}
