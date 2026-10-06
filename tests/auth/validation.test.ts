import { describe, expect, it } from "vitest";
import { authInputError } from "@/lib/auth/validation";

describe("auth input validation", () => {
  it("requires a strong enough password and matching confirmation", () => {
    expect(
      authInputError(
        { email: "reader@example.com", password: "short", displayName: "Reader", confirmPassword: "short" },
        "signup",
      )?.field,
    ).toBe("password");
    expect(
      authInputError(
        { email: "reader@example.com", password: "long-enough", displayName: "Reader", confirmPassword: "different" },
        "signup",
      )?.field,
    ).toBe("confirmPassword");
    expect(
      authInputError(
        { email: "reader@example.com", password: "long-enough", displayName: "Reader", confirmPassword: "long-enough" },
        "signup",
      ),
    ).toBeNull();
  });

  it("rejects malformed email addresses", () => {
    expect(authInputError({ email: "not-an-email", password: "long-enough" }, "login")?.field).toBe("email");
  });
});
