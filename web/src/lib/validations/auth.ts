import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  confirmPassword: z.string().min(1, "Please confirm your password")
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type RegisterFormData = z.infer<typeof registerSchema>;

export const accountRecoverySchema = z.object({
  recoveryKey: z.string().min(1, "Recovery key is required").regex(/^[A-Za-z0-9-]+$/, "Invalid recovery key format"),
});

export type AccountRecoveryFormData = z.infer<typeof accountRecoverySchema>;

export const totpSetupSchema = z.object({
  code: z.string().min(6, "Code must be 6 characters").max(6, "Code must be 6 characters").regex(/^\d+$/, "Code must be numeric"),
});

export type TotpSetupFormData = z.infer<typeof totpSetupSchema>;
