/**
 * PMV2 Extension — Background Service Worker
 *
 * Responsibilities:
 * 1. Manage vault lock state via chrome.storage.session (auto-clears on browser close)
 * 2. Auto-lock timer via chrome.alarms
 * 3. Message relay between popup and content scripts
 */

import type {
  FillCredentialsResult,
  PendingLoginCapture,
} from "../shared/types/extension.types";

const ALARM_NAME = "pmv2-auto-lock";
const AUTO_LOCK_MINUTES = 15;
const PENDING_LOGIN_STORAGE_KEY = "pmv2_pending_login";
const PENDING_LOGIN_MAX_AGE_MS = 15 * 60 * 1000;

// ── Message Types ──────────────────────────────────────────────────────────

export interface VaultUnlockedMessage {
  type: "vault-unlocked";
  kekBase64: string;
}

export interface VaultLockMessage {
  type: "vault-lock";
}

export interface VaultStatusRequest {
  type: "vault-status";
}

export interface VaultStatusResponse {
  isUnlocked: boolean;
  kekBase64: string | null;
}

export interface FillCredentialsMessage {
  type: "fill-credentials";
  username: string;
  password: string;
}

export interface CaptureLoginSubmissionMessage {
  type: "capture-login-submission";
  capture: PendingLoginCapture;
}

export interface GetPendingLoginMessage {
  type: "get-pending-login";
}

export interface DismissPendingLoginMessage {
  type: "dismiss-pending-login";
}

export type ExtensionMessage =
  | VaultUnlockedMessage
  | VaultLockMessage
  | VaultStatusRequest
  | FillCredentialsMessage
  | CaptureLoginSubmissionMessage
  | GetPendingLoginMessage
  | DismissPendingLoginMessage;

// ── Handlers ───────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse).catch(() => sendResponse(null));
    return true; // async response
  }
);

async function handleMessage(
  message: ExtensionMessage
): Promise<VaultStatusResponse | FillCredentialsResult | { ok: boolean; pendingLogin?: PendingLoginCapture | null }> {
  switch (message.type) {
    case "vault-unlocked": {
      // Store KEK in session storage (encrypted, clears on browser restart)
      await chrome.storage.session.set({ pmv2_kek: message.kekBase64 });
      // Reset auto-lock timer
      await chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: AUTO_LOCK_MINUTES,
      });
      return { ok: true };
    }

    case "vault-lock": {
      await chrome.storage.session.remove("pmv2_kek");
      await chrome.alarms.clear(ALARM_NAME);
      return { ok: true };
    }

    case "vault-status": {
      const result = await chrome.storage.session.get("pmv2_kek");
      return {
        isUnlocked: !!result.pmv2_kek,
        kekBase64: result.pmv2_kek ?? null,
      };
    }

    case "fill-credentials": {
      // Forward to the active tab's content script
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) {
        return {
          ok: false,
          filledUsername: false,
          filledPassword: false,
          reason: "No active tab was available.",
        };
      }

      try {
        const response = await chrome.tabs.sendMessage(tab.id, message);
        return (
          response ?? {
            ok: false,
            filledUsername: false,
            filledPassword: false,
            reason: "No login fields were detected on this page.",
          }
        );
      } catch {
        return {
          ok: false,
          filledUsername: false,
          filledPassword: false,
          reason: "PMV2 could not access this page.",
        };
      }
    }

    case "capture-login-submission": {
      const capture = normalizePendingLoginCapture(message.capture);
      if (!capture) {
        return { ok: false };
      }

      await chrome.storage.session.set({ [PENDING_LOGIN_STORAGE_KEY]: capture });
      return { ok: true };
    }

    case "get-pending-login": {
      const pendingLogin = await readPendingLoginCapture();
      return { ok: true, pendingLogin };
    }

    case "dismiss-pending-login": {
      await chrome.storage.session.remove(PENDING_LOGIN_STORAGE_KEY);
      return { ok: true, pendingLogin: null };
    }

    default:
      return { ok: false };
  }
}

function normalizePendingLoginCapture(capture: PendingLoginCapture): PendingLoginCapture | null {
  const username = capture.username.trim();
  const password = capture.password.trim();
  const url = capture.url.trim();
  const origin = capture.origin.trim();

  if (!username || !password || !url || !origin) {
    return null;
  }

  try {
    return {
      ...capture,
      title: capture.title.trim() || new URL(url).hostname.replace(/^www\./, ""),
      username,
      password,
      url,
      origin,
      detectedAt: capture.detectedAt,
    };
  } catch {
    return null;
  }
}

async function readPendingLoginCapture(): Promise<PendingLoginCapture | null> {
  const result = await chrome.storage.session.get(PENDING_LOGIN_STORAGE_KEY);
  const pending = result[PENDING_LOGIN_STORAGE_KEY] as PendingLoginCapture | undefined;

  if (!pending) {
    return null;
  }

  const detectedAt = Date.parse(pending.detectedAt);
  if (!Number.isFinite(detectedAt) || Date.now() - detectedAt > PENDING_LOGIN_MAX_AGE_MS) {
    await chrome.storage.session.remove(PENDING_LOGIN_STORAGE_KEY);
    return null;
  }

  return pending;
}

// ── Auto-lock on alarm ─────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await chrome.storage.session.remove("pmv2_kek");
  }
});
