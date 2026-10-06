export type AuthInputError = { field?: "email" | "password" | "displayName" | "confirmPassword"; message: string };

export function authInputError(
  input: { email?: unknown; password?: unknown; displayName?: unknown; confirmPassword?: unknown },
  mode: "login" | "signup",
): AuthInputError | null {
  const email = typeof input.email === "string" ? input.email.trim() : "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return { field: "email", message: "Enter a valid email address." };

  const password = typeof input.password === "string" ? input.password : "";
  if (password.length < 8) return { field: "password", message: "Use at least 8 characters." };
  if (mode === "signup") {
    const displayName = typeof input.displayName === "string" ? input.displayName.trim() : "";
    if (!displayName || displayName.length > 40)
      return { field: "displayName", message: "Enter a display name up to 40 characters." };
    if (input.confirmPassword !== password) return { field: "confirmPassword", message: "Passwords do not match." };
  }
  return null;
}
