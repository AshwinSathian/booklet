import { z } from "zod";

// OWASP baseline: length over composition rules. Upper bound guards against
// feeding pathologically large input into argon2 hashing.
export const PasswordSchema = z.string().min(8, "Password must be at least 8 characters").max(256);

export const EmailSchema = z.string().trim().toLowerCase().email().max(254);

export const SignupSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(256),
});

export const ClaimSchema = z.object({
  token: z.string().min(1),
  password: PasswordSchema,
});

export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1).max(128),
  password: PasswordSchema,
});
