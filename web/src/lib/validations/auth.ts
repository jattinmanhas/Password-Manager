import { z } from "zod";

// Master-password strength rules. These are now enforced entirely on the
// client, because the server only ever receives the derived auth verifier and
// can no longer inspect the password itself. Mirrors the previous server-side
// policy: min 8 chars with upper, lower, number, and special characters.
export const masterPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[A-Z]/, "Must include an uppercase letter")
  .regex(/[a-z]/, "Must include a lowercase letter")
  .regex(/[0-9]/, "Must include a number")
  .regex(/[^A-Za-z0-9]/, "Must include a special character");

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().optional(),
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  password: masterPasswordSchema,
  confirmPassword: z.string().min(1, "Please confirm your password")
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type RegisterFormData = z.infer<typeof registerSchema>;

export const totpSetupSchema = z.object({
  code: z.string().min(6, "Code must be 6 characters").max(6, "Code must be 6 characters").regex(/^\d+$/, "Code must be numeric"),
});

export type TotpSetupFormData = z.infer<typeof totpSetupSchema>;
