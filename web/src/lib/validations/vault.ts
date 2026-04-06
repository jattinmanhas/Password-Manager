import { z } from "zod";

export const vaultUnlockSchema = z.object({
  masterPassword: z.string().min(1, "Vault passphrase is required"),
});

export type VaultUnlockFormData = z.infer<typeof vaultUnlockSchema>;

export const vaultModalSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["personal", "shared"]),
  members: z.string().optional(),
});

export type VaultModalFormData = z.infer<typeof vaultModalSchema>;

// VaultItem discriminated union based on `kind`
const baseVaultItemSchema = z.object({
  title: z.string().min(1, "Title is required"),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  folderId: z.string().optional(),
});

export const loginItemSchema = baseVaultItemSchema.extend({
  kind: z.literal("login"),
  username: z.string().optional(),
  password: z.string().min(1, "Password is required"),
});

export const cardItemSchema = baseVaultItemSchema.extend({
  kind: z.literal("card"),
  cardNumber: z.string().min(15, "Card number is too short").max(20, "Card number is too long"),
  cardType: z.string(),
  expiryDate: z.string().regex(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/, "Expiry must be in MM/YY format"),
  cardholderName: z.string().min(1, "Cardholder name is required"),
});

export const bankItemSchema = baseVaultItemSchema.extend({
  kind: z.literal("bank"),
  bankName: z.string().min(1, "Bank name is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  ifscCode: z.string().min(1, "IFSC/Routing code is required"),
});

export const noteItemSchema = baseVaultItemSchema.extend({
  kind: z.literal("note"),
});

export const vaultItemSchema = z.discriminatedUnion("kind", [
  loginItemSchema,
  cardItemSchema,
  bankItemSchema,
  noteItemSchema,
]);

export type VaultItemFormData = z.infer<typeof vaultItemSchema>;
