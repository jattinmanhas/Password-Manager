/**
 * PMV2 Extension — Content Script
 *
 * Detects login forms on the page, captures submitted credentials for save
 * suggestions, and fills credentials on demand from the popup.
 */

import type {
  FillCredentialsResult,
  PendingLoginCapture,
} from "../shared/types/extension.types";

interface FillCredentialsMessage {
  type: "fill-credentials";
  username: string;
  password: string;
}

const USERNAME_AUTOCOMPLETE_HINTS = ["username", "email", "webauthn"];
const PASSWORD_AUTOCOMPLETE_HINTS = ["current-password"];
const NEW_PASSWORD_HINTS = ["new-password", "one-time-code"];
const SUBMIT_BUTTON_PATTERN = /(sign[\s-]?in|log[\s-]?in|continue|next|submit)/i;
const USERNAME_PATTERN = /(user|email|login|identifier|account|member)/i;
const PASSWORD_PATTERN = /(pass|pwd)/i;
const PASSWORD_EXCLUDE_PATTERN = /(new|confirm|repeat|otp|code|search|pin)/i;

// ── Listen for fill requests from popup/background ─────────────────────────

chrome.runtime.onMessage.addListener(
  (message: FillCredentialsMessage, _sender, sendResponse) => {
    if (message.type === "fill-credentials") {
      sendResponse(fillCredentials(message.username, message.password));
    }
  }
);

// ── Save detection ─────────────────────────────────────────────────────────

document.addEventListener(
  "submit",
  (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form) {
      return;
    }

    const capture = captureSubmittedCredentials(form);
    if (!capture) {
      return;
    }

    void chrome.runtime.sendMessage({
      type: "capture-login-submission",
      capture,
    });
  },
  true
);

// ── Form Detection ─────────────────────────────────────────────────────────

function getVisibleInputs(root: ParentNode = document): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>("input")).filter(isEditableVisibleInput);
}

function isEditableVisibleInput(input: HTMLInputElement): boolean {
  if (input.disabled || input.readOnly) {
    return false;
  }

  const type = (input.getAttribute("type") || "text").toLowerCase();
  if (["hidden", "submit", "button", "image", "reset", "file"].includes(type)) {
    return false;
  }

  const style = window.getComputedStyle(input);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }

  const rect = input.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getFieldHint(input: HTMLInputElement): string {
  const label = getLabelText(input);
  const autocomplete = input.autocomplete || "";
  return [
    input.name,
    input.id,
    input.placeholder,
    input.getAttribute("aria-label"),
    input.getAttribute("aria-labelledby"),
    autocomplete,
    label,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getLabelText(input: HTMLInputElement): string {
  const explicitLabel = input.id
    ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`)?.textContent
    : "";
  const wrappingLabel = input.closest("label")?.textContent ?? "";
  return `${explicitLabel ?? ""} ${wrappingLabel}`.trim();
}

function scorePasswordField(input: HTMLInputElement): number {
  const type = (input.getAttribute("type") || "").toLowerCase();
  if (type !== "password") {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;
  const autocomplete = input.autocomplete.toLowerCase();
  const hint = getFieldHint(input);

  if (PASSWORD_AUTOCOMPLETE_HINTS.includes(autocomplete)) {
    score += 14;
  }
  if (NEW_PASSWORD_HINTS.includes(autocomplete)) {
    score -= 14;
  }
  if (PASSWORD_PATTERN.test(hint)) {
    score += 8;
  }
  if (PASSWORD_EXCLUDE_PATTERN.test(hint)) {
    score -= 12;
  }
  if (document.activeElement === input) {
    score += 6;
  }
  if (input.form) {
    score += 2;
  }

  return score;
}

function scoreUsernameField(input: HTMLInputElement, passwordField: HTMLInputElement | null): number {
  const type = (input.getAttribute("type") || "text").toLowerCase();
  if (!["text", "email", "tel", ""].includes(type)) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;
  const autocomplete = input.autocomplete.toLowerCase();
  const hint = getFieldHint(input);

  if (USERNAME_AUTOCOMPLETE_HINTS.includes(autocomplete)) {
    score += 12;
  }
  if (type === "email") {
    score += 8;
  }
  if (USERNAME_PATTERN.test(hint)) {
    score += 10;
  }
  if (/search|otp|code|captcha/.test(hint)) {
    score -= 10;
  }
  if (passwordField?.form && input.form === passwordField.form) {
    score += 8;
  } else if (passwordField?.form) {
    score -= 8;
  }
  if (passwordField && compareDocumentPosition(input, passwordField) < 0) {
    score += 3;
  }
  if (document.activeElement === input) {
    score += 4;
  }

  return score;
}

function compareDocumentPosition(left: HTMLElement, right: HTMLElement): number {
  const position = left.compareDocumentPosition(right);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
    return -1;
  }
  if (position & Node.DOCUMENT_POSITION_PRECEDING) {
    return 1;
  }
  return 0;
}

function findBestPasswordField(): HTMLInputElement | null {
  const passwordFields = getVisibleInputs().filter(
    (input) => (input.getAttribute("type") || "").toLowerCase() === "password"
  );

  const ranked = passwordFields
    .map((input) => ({ input, score: scorePasswordField(input) }))
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.input ?? null;
}

function findBestUsernameField(
  passwordField: HTMLInputElement | null,
  roots: ParentNode[] = passwordField?.form ? [passwordField.form, document] : [document]
): HTMLInputElement | null {

  const seen = new Set<HTMLInputElement>();
  const candidates: HTMLInputElement[] = [];
  for (const root of roots) {
    for (const input of getVisibleInputs(root)) {
      if (seen.has(input)) {
        continue;
      }
      seen.add(input);
      candidates.push(input);
    }
  }

  const ranked = candidates
    .filter((input) => input !== passwordField)
    .map((input) => ({ input, score: scoreUsernameField(input, passwordField) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.input ?? null;
}

// ── Fill Logic ─────────────────────────────────────────────────────────────

function setNativeValue(element: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillCredentials(username: string, password: string): FillCredentialsResult {
  const passwordField = findBestPasswordField();
  const usernameField = findBestUsernameField(passwordField);

  let filledUsername = false;
  let filledPassword = false;

  if (usernameField && username) {
    usernameField.focus();
    setNativeValue(usernameField, username);
    filledUsername = true;
  }

  if (passwordField && password) {
    passwordField.focus();
    setNativeValue(passwordField, password);
    passwordField.dispatchEvent(new Event("blur", { bubbles: true }));
    filledPassword = true;
  }

  if (!filledUsername && !filledPassword) {
    return {
      ok: false,
      filledUsername,
      filledPassword,
      reason: "No compatible login fields were detected on this page.",
    };
  }

  return { ok: true, filledUsername, filledPassword };
}

// ── Save Capture Helpers ───────────────────────────────────────────────────

function captureSubmittedCredentials(form: HTMLFormElement): PendingLoginCapture | null {
  const passwordField = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="password"]'))
    .filter(isEditableVisibleInput)
    .map((input) => ({ input, score: scorePasswordField(input) }))
    .filter((candidate) => candidate.score > -4)
    .sort((left, right) => right.score - left.score)[0]?.input;

  if (!passwordField) {
    return null;
  }

  const usernameField = findBestUsernameField(passwordField, [form]);
  const password = passwordField.value.trim();
  const username = usernameField?.value.trim() ?? "";

  if (!username || !password) {
    return null;
  }

  const title = document.title.trim() || window.location.hostname.replace(/^www\./, "");
  return {
    id: `${window.location.origin}|${username}|${Date.now()}`,
    title,
    url: window.location.href,
    origin: window.location.origin,
    username,
    password,
    detectedAt: new Date().toISOString(),
  };
}

// Some sites submit via button handlers before the form submit event fires.
document.addEventListener(
  "click",
  (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const button = target?.closest("button, input[type='submit']");
    if (!button) {
      return;
    }

    const buttonText =
      button instanceof HTMLInputElement ? button.value : button.textContent ?? "";
    if (!SUBMIT_BUTTON_PATTERN.test(buttonText)) {
      return;
    }

    const form = button.closest("form");
    if (!form) {
      return;
    }

    window.setTimeout(() => {
      const capture = captureSubmittedCredentials(form);
      if (!capture) {
        return;
      }

      void chrome.runtime.sendMessage({
        type: "capture-login-submission",
        capture,
      });
    }, 0);
  },
  true
);
