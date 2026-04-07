/**
 * Structured API error code → user-friendly message mapping.
 * The backend returns structured error codes in every error response.
 * Use `getErrorMessage(err)` to convert any caught error into a
 * human-readable string suitable for toasts / UI display.
 */

const ERROR_MESSAGES: Record<string, string> = {
  // Auth
  invalid_json: "The request was malformed. Please try again.",
  invalid_credentials: "Invalid email or password.",
  email_taken: "This email is already registered.",
  weak_password: "Password does not meet the security requirements.",
  unauthorized: "Your session has expired. Please log in again.",

  // MFA
  mfa_required: "Multi-factor authentication is required.",
  invalid_mfa: "Invalid authentication code. Please try again.",
  invalid_mfa_input: "Provide either a TOTP code or a recovery code, not both.",
  mfa_rate_limited: "Too many failed attempts. Please wait and try again.",
  totp_not_initialized: "TOTP has not been set up yet. Complete setup first.",
  totp_not_enabled: "TOTP is not enabled on this account.",

  // Recovery
  invalid_recovery_key: "The recovery key is incorrect.",
  recovery_not_setup: "Account recovery has not been configured.",
  recovery_cooldown: "A recovery was attempted too recently. Please wait.",
  invalid_recovery_token: "The recovery link has expired. Start over.",

  // Vault
  invalid_vault_payload: "The vault data is corrupted or in an unexpected format.",
  not_found: "The requested item could not be found.",
  empty_items: "No items were provided.",
  too_many_items: "Too many items in a single request (max 500).",

  // Generic
  internal_error: "Something went wrong on our end. Please try again later.",
};

/**
 * Extract a user-friendly error message from any caught value.
 *
 * Priority:
 * 1. If it's an ApiError with a known code, return the mapped message.
 * 2. If it's an ApiError with an unknown code, return its `.message`.
 * 3. If it's a plain Error, return its `.message`.
 * 4. Fallback to a generic string.
 */
export function getErrorMessage(err: unknown, fallback = "An unexpected error occurred."): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: string }).code;
    if (ERROR_MESSAGES[code]) {
      return ERROR_MESSAGES[code];
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

export { ERROR_MESSAGES };
