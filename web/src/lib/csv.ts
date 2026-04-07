/**
 * Minimal, pure-JS CSV parser and serializer.
 * No external dependencies required.
 */

import type { BankSecret, CardSecret, LoginSecret, VaultSecret } from "../features/vault/vault.types";

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseCSVRows(text: string): string[][] {
  const parsedRows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") {
        i++;
      }

      currentRow.push(currentField);
      parsedRows.push(currentRow);
      currentRow = [];
      currentField = "";
      continue;
    }

    currentField += ch;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    parsedRows.push(currentRow);
  }

  return parsedRows.filter((row) => row.some((value) => value.trim() !== ""));
}

function stripBom(value: string): string {
  return value.replace(/^\uFEFF/, "");
}

export function parseCSV(text: string): Record<string, string>[] {
  const parsedRows = parseCSVRows(text);
  if (parsedRows.length < 2) return [];

  const headers = parsedRows[0].map((header, index) => (index === 0 ? stripBom(header) : header).trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < parsedRows.length; i++) {
    const values = parsedRows[i];
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

// ─── Serializer ───────────────────────────────────────────────────────────────

function escapeCSVField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function serializeCSV(
  headers: string[],
  rows: Record<string, string>[]
): string {
  const headerLine = headers.map(escapeCSVField).join(",");
  const bodyLines = rows.map((row) =>
    headers.map((header) => escapeCSVField(row[header] ?? "")).join(",")
  );
  return [headerLine, ...bodyLines].join("\n");
}

// ─── Import Adapters ──────────────────────────────────────────────────────────

export type ImportKind = "generic" | "bitwarden";
export type ParsedImportItem = VaultSecret;

function cleanNotes(value: string | undefined): string {
  return (value ?? "").replace(/\\n/g, "\n").trim();
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildNormalizedRow(row: Record<string, string>): Record<string, string> {
  const normalizedRow: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    normalizedRow[normalizeHeader(key)] = value.trim();
  }
  return normalizedRow;
}

function getField(row: Record<string, string>, ...aliases: string[]): string {
  for (const alias of aliases) {
    const value = row[normalizeHeader(alias)];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return "";
}

function parseTags(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function normalizeCardType(value: string, cardNumber: string): CardSecret["cardType"] {
  const normalized = value.trim().toLowerCase();
  if (normalized === "visa" || normalized === "mastercard" || normalized === "amex") {
    return normalized;
  }

  const digits = cardNumber.replace(/\D/g, "");
  if (/^4/.test(digits)) return "visa";
  if (/^5[1-5]/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  return "other";
}

function normalizeAccountType(value: string): BankSecret["accountType"] {
  const normalized = value.trim().toLowerCase();
  if (normalized === "checking" || normalized === "savings" || normalized === "current") {
    return normalized;
  }
  return "other";
}

function normalizeExplicitKind(value: string): VaultSecret["kind"] | "" {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (["login", "credential", "credentials"].includes(normalized)) return "login";
  if (["card", "paymentcard", "payment", "creditcard", "debitcard"].includes(normalized)) return "card";
  if (["bank", "bankaccount", "account"].includes(normalized)) return "bank";
  if (["note", "securenote", "notes"].includes(normalized)) return "note";
  return "";
}

function inferGenericKind(row: Record<string, string>, tags: string[]): VaultSecret["kind"] | null {
  const explicitKind = normalizeExplicitKind(getField(row, "Type", "Kind", "Item Type"));
  if (explicitKind) return explicitKind;

  if (
    getField(row, "Card Number", "Cardholder Name", "Expiry Date", "Card Type") ||
    tags.some((tag) => ["card", "payment", "credit-card", "debit-card"].includes(tag.toLowerCase()))
  ) {
    return "card";
  }

  if (
    getField(row, "Bank Name", "Account Number", "IFSC Code", "Routing Code", "Routing Number", "Account Type") ||
    tags.some((tag) => ["bank", "banking"].includes(tag.toLowerCase()))
  ) {
    return "bank";
  }

  if (getField(row, "Username", "Email", "Login", "Password", "URL", "URI", "Website")) {
    return "login";
  }

  if (getField(row, "Title", "Name", "Notes", "Comment", "Comments")) {
    return "note";
  }

  return null;
}

function adaptGenericRow(row: Record<string, string>): ParsedImportItem | null {
  const normalizedRow = buildNormalizedRow(row);
  const tags = parseTags(getField(normalizedRow, "Tags", "Tag"));
  const kind = inferGenericKind(normalizedRow, tags);
  if (!kind) return null;

  const title = getField(normalizedRow, "Title", "Name");
  const notes = cleanNotes(getField(normalizedRow, "Notes", "Comment", "Comments"));

  if (kind === "card") {
    const cardNumber = getField(normalizedRow, "Card Number", "Number");
    const cardholderName = getField(normalizedRow, "Cardholder Name", "Cardholder");
    const expiryDate = getField(normalizedRow, "Expiry Date", "Expiration", "Expiry");
    const cardType = normalizeCardType(getField(normalizedRow, "Card Type"), cardNumber);

    if (!title && !cardNumber && !cardholderName && !notes && tags.length === 0) return null;

    return {
      kind: "card",
      title: title || cardholderName || "Payment Card",
      notes,
      tags,
      cardNumber,
      cardholderName,
      expiryDate,
      cardType,
    };
  }

  if (kind === "bank") {
    const bankName = getField(normalizedRow, "Bank Name");
    const accountNumber = getField(normalizedRow, "Account Number");
    const ifscCode = getField(normalizedRow, "IFSC Code", "Routing Code", "Routing Number", "Sort Code");
    const accountType = normalizeAccountType(getField(normalizedRow, "Account Type"));

    if (!title && !bankName && !accountNumber && !ifscCode && !notes && tags.length === 0) return null;

    return {
      kind: "bank",
      title: title || bankName || "Bank Account",
      notes,
      tags,
      bankName,
      accountNumber,
      ifscCode,
      accountType,
    };
  }

  if (kind === "note") {
    if (!title && !notes && tags.length === 0) return null;
    return {
      kind: "note",
      title: title || "Secure Note",
      notes,
      tags,
    };
  }

  const username = getField(normalizedRow, "Username", "Email", "Login");
  const password = getField(normalizedRow, "Password", "Pass");
  const url = getField(normalizedRow, "URL", "URI", "Website");

  if (!title && !username && !password && !url && !notes && tags.length === 0) return null;

  return {
    kind: "login",
    title: title || username || url || "Login",
    username,
    password,
    url,
    notes,
    tags,
  };
}

function adaptBitwardenRow(row: Record<string, string>): ParsedImportItem | null {
  const normalizedRow = buildNormalizedRow(row);
  const type = normalizeExplicitKind(getField(normalizedRow, "type"));
  const title = getField(normalizedRow, "name");
  const notes = cleanNotes(getField(normalizedRow, "notes"));
  const tags = parseTags(getField(normalizedRow, "fields", "tags"));

  if (type === "card") {
    const cardNumber = getField(normalizedRow, "cardnumber");
    const cardholderName = getField(normalizedRow, "cardholdername");
    const expiryMonth = getField(normalizedRow, "cardexpmonth");
    const expiryYear = getField(normalizedRow, "cardexpyear");
    const expiryDate = expiryMonth && expiryYear ? `${expiryMonth.padStart(2, "0")}/${expiryYear.slice(-2)}` : "";
    const cardType = normalizeCardType(getField(normalizedRow, "cardbrand"), cardNumber);

    if (!title && !cardNumber && !cardholderName && !notes) return null;

    return {
      kind: "card",
      title: title || cardholderName || "Payment Card",
      notes,
      tags,
      cardNumber,
      cardholderName,
      expiryDate,
      cardType,
    };
  }

  if (type === "note") {
    if (!title && !notes) return null;
    return {
      kind: "note",
      title: title || "Secure Note",
      notes,
      tags,
    };
  }

  if (type && type !== "login") return null;

  const username = getField(normalizedRow, "loginusername");
  const password = getField(normalizedRow, "loginpassword");
  const url =
    getField(normalizedRow, "loginuri") ||
    getField(normalizedRow, "loginuri1") ||
    getField(normalizedRow, "loginuri2");

  if (!title && !username && !password && !url && !notes) return null;

  return {
    kind: "login",
    title: title || username || url || "Login",
    username,
    password,
    url,
    notes,
    tags,
  };
}

export function parseImportCSV(
  text: string,
  kind: ImportKind
): ParsedImportItem[] {
  const rows = parseCSV(text);
  const adapter = kind === "bitwarden" ? adaptBitwardenRow : adaptGenericRow;
  return rows.flatMap((row) => {
    const item = adapter(row);
    return item ? [item] : [];
  });
}

// ─── Export helpers ───────────────────────────────────────────────────────────

export const EXPORT_HEADERS = [
  "Type",
  "Title",
  "Username",
  "Password",
  "URL",
  "Cardholder Name",
  "Card Number",
  "Expiry Date",
  "Card Type",
  "Bank Name",
  "Account Number",
  "IFSC / Routing Code",
  "Account Type",
  "Notes",
  "Tags",
] as const;

export function createExportRow(secret: VaultSecret): Record<(typeof EXPORT_HEADERS)[number], string> {
  const base = {
    Type: secret.kind,
    Title: secret.title ?? "",
    Username: "",
    Password: "",
    URL: "",
    "Cardholder Name": "",
    "Card Number": "",
    "Expiry Date": "",
    "Card Type": "",
    "Bank Name": "",
    "Account Number": "",
    "IFSC / Routing Code": "",
    "Account Type": "",
    Notes: secret.notes ?? "",
    Tags: (secret.tags ?? []).join(";"),
  } satisfies Record<(typeof EXPORT_HEADERS)[number], string>;

  if (secret.kind === "login") {
    const login = secret as LoginSecret;
    return {
      ...base,
      Username: login.username ?? "",
      Password: login.password ?? "",
      URL: login.url ?? "",
    };
  }

  if (secret.kind === "card") {
    const card = secret as CardSecret;
    return {
      ...base,
      "Cardholder Name": card.cardholderName ?? "",
      "Card Number": card.cardNumber ?? "",
      "Expiry Date": card.expiryDate ?? "",
      "Card Type": card.cardType ?? "",
    };
  }

  if (secret.kind === "bank") {
    const bank = secret as BankSecret;
    return {
      ...base,
      "Bank Name": bank.bankName ?? "",
      "Account Number": bank.accountNumber ?? "",
      "IFSC / Routing Code": bank.ifscCode ?? "",
      "Account Type": bank.accountType ?? "",
    };
  }

  return base;
}

export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ─── Sample CSV Generator ────────────────────────────────────────────────────

export const SAMPLE_GENERIC_CSV = `Type,Title,Username,Password,URL,Cardholder Name,Card Number,Expiry Date,Card Type,Bank Name,Account Number,IFSC / Routing Code,Account Type,Notes,Tags
login,GitHub,john@example.com,SuperSecret123!,https://github.com,,,,,,,,Work account,work
card,HDFC Platinum Card,,,,John Doe,4111-1111-1111-1111,08/29,visa,,,,,Primary travel card,payment;travel
bank,ICICI Salary Account,,,,,,,,ICICI Bank,1234567890,ICIC0001234,savings,Main account,bank;salary
note,Wi-Fi Recovery Codes,,,,,,,,,,,Keep this offline. Rotate after sharing.,backup;note
`;
