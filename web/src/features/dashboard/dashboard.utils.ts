import type { SessionResponse } from "../auth/types";
import type { VaultSecret, VaultViewItem } from "../vault/vault.types";

export interface SecurityHealthBreakdown {
  accountScore: number;
  passwordScore: number;
  sharingScore: number;
  sensitiveDataScore: number;
  integrityScore: number;
}

export interface SecurityHealthMetrics {
  totalItems: number;
  securityScore: number;
  weakPasswords: number;
  reusedPasswords: number;
  sharedItems: number;
  sensitiveNotes: number;
  corruptedItems: number;
  emptyPasswords: number;
  recentActivityCount: number;
  breakdown: SecurityHealthBreakdown;
}

const NOTE_SECRET_PATTERNS = [
  /\bpassword\b/i,
  /\bpasscode\b/i,
  /\bpin\b/i,
  /\botp\b/i,
  /\brecovery\s+key\b/i,
  /\bseed\s+phrase\b/i,
  /\bmnemonic\b/i,
  /\bcard\s+number\b/i,
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function calculatePasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

function isSensitiveNote(secret: VaultSecret | null): boolean {
  if (!secret || secret.kind !== "note") return false;
  const haystack = `${secret.title} ${secret.notes}`.trim();
  if (!haystack) return false;
  return NOTE_SECRET_PATTERNS.some((pattern) => pattern.test(haystack));
}

export function calculateSecurityHealth(input: {
  items: VaultViewItem[];
  recentActivityCount: number;
  session: SessionResponse | null;
  recoveryEnabled: boolean;
  sharedExposureCount: number;
}): SecurityHealthMetrics {
  const { items, recentActivityCount, session, recoveryEnabled, sharedExposureCount } = input;

  const loginItems = items.filter((item) => item.secret?.kind === "login");
  const corruptedItems = items.filter((item) => item.isCorrupted).length;
  const sharedItems = sharedExposureCount;
  const sensitiveNotes = items.filter((item) => isSensitiveNote(item.secret)).length;

  let weakPasswords = 0;
  let emptyPasswords = 0;
  const passwordMap: Record<string, number> = {};

  for (const item of loginItems) {
    const password = item.secret?.kind === "login" ? item.secret.password.trim() : "";
    if (!password) {
      emptyPasswords += 1;
      weakPasswords += 1;
      continue;
    }

    if (calculatePasswordStrength(password) < 3) {
      weakPasswords += 1;
    }

    passwordMap[password] = (passwordMap[password] || 0) + 1;
  }

  const reusedPasswords = Object.values(passwordMap).filter((count) => count > 1).length;

  const accountPenalty =
    (session?.is_totp_enabled ? 0 : 20) +
    (recoveryEnabled ? 0 : 8) +
    (corruptedItems > 0 ? 10 : 0);

  const passwordPenalty =
    weakPasswords * 12 +
    reusedPasswords * 15 +
    emptyPasswords * 8;

  const sharingPenalty = sharedItems * 6;
  const sensitiveDataPenalty = sensitiveNotes * 8;
  const integrityPenalty = corruptedItems * 15;

  const accountScore = clamp(100 - accountPenalty, 0, 100);
  const passwordScore = clamp(100 - passwordPenalty, 0, 100);
  const sharingScore = clamp(100 - sharingPenalty, 0, 100);
  const sensitiveDataScore = clamp(100 - sensitiveDataPenalty, 0, 100);
  const integrityScore = clamp(100 - integrityPenalty, 0, 100);

  const securityScore = Math.round(
    accountScore * 0.25 +
      passwordScore * 0.4 +
      sharingScore * 0.15 +
      sensitiveDataScore * 0.1 +
      integrityScore * 0.1
  );

  return {
    totalItems: items.length,
    securityScore,
    weakPasswords,
    reusedPasswords,
    sharedItems,
    sensitiveNotes,
    corruptedItems,
    emptyPasswords,
    recentActivityCount,
    breakdown: {
      accountScore,
      passwordScore,
      sharingScore,
      sensitiveDataScore,
      integrityScore,
    },
  };
}

export interface SecurityHealthTips {
  account: string[];
  passwords: string[];
  sharing: string[];
  sensitiveData: string[];
  integrity: string[];
}

/**
 * Per-category action items describing exactly what to fix to bring that
 * category's score to 100%. Mirrors the penalty math in
 * calculateSecurityHealth so the copy always matches what's actually scored.
 */
export function getSecurityHealthTips(metrics: SecurityHealthMetrics, isTotpEnabled: boolean): SecurityHealthTips {
  const account: string[] = [];
  if (!isTotpEnabled) account.push('Enable two-factor authentication (+20%)');
  if (metrics.corruptedItems > 0) account.push('Resolve corrupted vault items (+10%)');

  const passwords: string[] = [];
  if (metrics.emptyPasswords > 0) {
    passwords.push(`Set a password on ${metrics.emptyPasswords} item${metrics.emptyPasswords === 1 ? '' : 's'} with none (+8% each)`);
  }
  const weakWithPassword = metrics.weakPasswords - metrics.emptyPasswords;
  if (weakWithPassword > 0) {
    passwords.push(`Strengthen ${weakWithPassword} weak password${weakWithPassword === 1 ? '' : 's'} (+12% each)`);
  }
  if (metrics.reusedPasswords > 0) {
    passwords.push(`Replace ${metrics.reusedPasswords} reused password${metrics.reusedPasswords === 1 ? '' : 's'} with unique ones (+15% each)`);
  }

  const sharing: string[] = [];
  if (metrics.sharedItems > 0) {
    sharing.push(`Revoke sharing on ${metrics.sharedItems} item${metrics.sharedItems === 1 ? '' : 's'} (+6% each)`);
  }

  const sensitiveData: string[] = [];
  if (metrics.sensitiveNotes > 0) {
    sensitiveData.push(`Move ${metrics.sensitiveNotes} sensitive note${metrics.sensitiveNotes === 1 ? '' : 's'} into a proper login/card item (+8% each)`);
  }

  const integrity: string[] = [];
  if (metrics.corruptedItems > 0) {
    integrity.push(`Fix or remove ${metrics.corruptedItems} corrupted item${metrics.corruptedItems === 1 ? '' : 's'} (+15% each)`);
  }

  return { account, passwords, sharing, sensitiveData, integrity };
}
