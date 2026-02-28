export const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
export const API_BASE = `${API_ORIGIN}/api/v1`;

export class ApiError extends Error {
    constructor(public code: string, message: string) {
        super(message);
        this.name = "ApiError";
    }
}

export async function request<T>(
    method: string,
    endpoint: string,
    body?: unknown
): Promise<T> {
    const headers: HeadersInit = {
        "Content-Type": "application/json",
    };

    const res = await fetch(`${API_BASE}${endpoint}`, {
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
