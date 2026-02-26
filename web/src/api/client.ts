import type {
  ErrorResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  StatusResponse,
  TOTPEnableResponse,
  TOTPSetupResponse,
} from "./types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8080";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const text = await response.text();

  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }

  if (!response.ok) {
    const fallbackMessage = response.statusText || "request failed";
    if (parsed && typeof parsed === "object" && "error" in parsed && "message" in parsed) {
      const err = parsed as ErrorResponse;
      throw new ApiError(response.status, err.error, err.message);
    }
    throw new ApiError(response.status, "request_failed", fallbackMessage);
  }

  return parsed as T;
}

export async function registerUser(input: RegisterRequest): Promise<RegisterResponse> {
  return request<RegisterResponse>("/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function login(input: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>("/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function logout(token: string): Promise<StatusResponse> {
  return request<StatusResponse>("/v1/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function setupTOTP(token: string): Promise<TOTPSetupResponse> {
  return request<TOTPSetupResponse>("/v1/auth/totp/setup", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function enableTOTP(token: string, code: string): Promise<TOTPEnableResponse> {
  return request<TOTPEnableResponse>("/v1/auth/totp/enable", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });
}

export async function verifyTOTP(token: string, code: string): Promise<StatusResponse> {
  return request<StatusResponse>("/v1/auth/totp/verify", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });
}
