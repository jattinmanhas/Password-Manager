export interface FillCredentialsResult {
  ok: boolean;
  filledUsername: boolean;
  filledPassword: boolean;
  reason?: string;
}

export interface PendingLoginCapture {
  id: string;
  title: string;
  url: string;
  origin: string;
  username: string;
  password: string;
  detectedAt: string;
}
