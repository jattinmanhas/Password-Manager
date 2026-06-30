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

// Credentials are remembered as the user types so that a capture survives the
// page navigation that a login submit triggers. Reading field values only at
// submit time is unreliable: the form often navigates (or clears its fields)
// before the message is delivered, so the save prompt never appears.
let rememberedCredentials: { username: string; password: string } | null = null;

function rememberCredentialsFromPage(): void {
  const passwordField = findBestPasswordField();
  if (!passwordField) {
    return;
  }
  const password = passwordField.value.trim();
  if (!password) {
    return;
  }
  const usernameField = findBestUsernameField(passwordField);
  const username = usernameField?.value.trim() ?? rememberedCredentials?.username ?? "";
  rememberedCredentials = { username, password };
}

document.addEventListener(
  "input",
  (event) => {
    if (event.target instanceof HTMLInputElement) {
      rememberCredentialsFromPage();
    }
  },
  true
);

function dispatchCapture(form: HTMLFormElement | null): void {
  // Prefer a live read of the submitted form; fall back to the credentials we
  // remembered while the user was typing (resilient to field clearing).
  const capture = captureSubmittedCredentials(form) ?? captureFromRemembered();
  if (!capture) {
    return;
  }
  void chrome.runtime.sendMessage({
    type: "capture-login-submission",
    capture,
  });
}

document.addEventListener(
  "submit",
  (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    dispatchCapture(form);
  },
  true
);

// ── Form Detection ─────────────────────────────────────────────────────────

function getVisibleInputs(root: ParentNode = document): HTMLInputElement[] {
  return collectInputsDeep(root).filter(isEditableVisibleInput);
}

// Collects <input> elements including those nested inside open shadow roots,
// which a plain querySelectorAll("input") cannot reach. Many modern sites build
// login forms as web components, so without this the password/username fields
// are invisible to detection and autofill silently does nothing.
function collectInputsDeep(root: ParentNode): HTMLInputElement[] {
  const inputs: HTMLInputElement[] = [];
  for (const el of root.querySelectorAll<HTMLElement>("*")) {
    if (el instanceof HTMLInputElement) {
      inputs.push(el);
    }
    if (el.shadowRoot) {
      inputs.push(...collectInputsDeep(el.shadowRoot));
    }
  }
  return inputs;
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

function captureSubmittedCredentials(form: HTMLFormElement | null): PendingLoginCapture | null {
  if (!form) {
    return null;
  }

  const passwordField = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="password"]'))
    .filter(isEditableVisibleInput)
    .map((input) => ({ input, score: scorePasswordField(input) }))
    .filter((candidate) => candidate.score > -4)
    .sort((left, right) => right.score - left.score)[0]?.input;

  if (!passwordField) {
    return null;
  }

  const usernameField = findBestUsernameField(passwordField, [form]);
  return makeCapture(usernameField?.value.trim() ?? "", passwordField.value.trim());
}

function captureFromRemembered(): PendingLoginCapture | null {
  if (!rememberedCredentials) {
    return null;
  }
  return makeCapture(rememberedCredentials.username, rememberedCredentials.password);
}

function makeCapture(username: string, password: string): PendingLoginCapture | null {
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

    // Snapshot the current field values synchronously, before any handler clears
    // the form or starts navigating. dispatchCapture falls back to this snapshot.
    rememberCredentialsFromPage();
    dispatchCapture(button.closest("form"));
  },
  true
);
