import type { Role } from "@/lib/types";

export function homePathForRole(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "WORKER":
      return "/worker";
    default:
      return "/";
  }
}

export function authErrorMessage(code: string | null): string | null {
  switch (code) {
    case "EmailNotVerified":
      return "Google could not verify that email. Sign in with your password first, then link Google from your account.";
    case "CredentialsSignin":
      return "Invalid email or password.";
    default:
      return code ? "Sign-in failed. Please try again." : null;
  }
}
