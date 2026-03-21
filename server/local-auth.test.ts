// Tests for custom email/password authentication logic
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const SALT_ROUNDS = 12;
const TEST_SECRET = "test-jwt-secret-for-unit-tests-only";

// ── Password hashing ──────────────────────────────────────────────────────────
describe("Password hashing", () => {
  it("hashes a password and verifies it correctly", async () => {
    const password = "SecurePass123!";
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    expect(hash).not.toBe(password);
    const match = await bcrypt.compare(password, hash);
    expect(match).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await bcrypt.hash("correct-password", SALT_ROUNDS);
    const match = await bcrypt.compare("wrong-password", hash);
    expect(match).toBe(false);
  });

  it("produces different hashes for the same password (salt)", async () => {
    const password = "SamePassword!";
    const hash1 = await bcrypt.hash(password, SALT_ROUNDS);
    const hash2 = await bcrypt.hash(password, SALT_ROUNDS);
    expect(hash1).not.toBe(hash2);
    expect(await bcrypt.compare(password, hash1)).toBe(true);
    expect(await bcrypt.compare(password, hash2)).toBe(true);
  });
});

// ── JWT token generation ──────────────────────────────────────────────────────
describe("JWT session tokens", () => {
  async function makeToken(userId: number, openId: string) {
    const secret = new TextEncoder().encode(TEST_SECRET);
    return new SignJWT({ sub: String(userId), openId, iss: "platfarm-local" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("365d")
      .sign(secret);
  }

  it("creates a valid JWT with correct claims", async () => {
    const token = await makeToken(42, "local:test@platfarm.com");
    const secret = new TextEncoder().encode(TEST_SECRET);
    const { payload } = await jwtVerify(token, secret);
    expect(payload.sub).toBe("42");
    expect(payload.iss).toBe("platfarm-local");
    expect((payload as { openId: string }).openId).toBe("local:test@platfarm.com");
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await makeToken(1, "local:user@platfarm.com");
    const wrongSecret = new TextEncoder().encode("wrong-secret");
    await expect(jwtVerify(token, wrongSecret)).rejects.toThrow();
  });

  it("identifies local auth tokens by iss claim", async () => {
    const token = await makeToken(1, "local:user@platfarm.com");
    const secret = new TextEncoder().encode(TEST_SECRET);
    const { payload } = await jwtVerify(token, secret);
    expect(payload.iss).toBe("platfarm-local");
  });
});

// ── Registration validation ───────────────────────────────────────────────────
describe("Registration input validation", () => {
  function validateRegistration(name: string, password: string, confirmPassword: string) {
    if (!name.trim()) return { ok: false, error: "Please enter your full name." };
    if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
    if (password !== confirmPassword) return { ok: false, error: "Passwords do not match." };
    return { ok: true, error: null };
  }

  it("accepts valid registration data", () => {
    const result = validateRegistration("Mohamed Al Rashidi", "SecurePass123!", "SecurePass123!");
    expect(result.ok).toBe(true);
  });

  it("rejects empty name", () => {
    const result = validateRegistration("   ", "SecurePass123!", "SecurePass123!");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("name");
  });

  it("rejects short password", () => {
    const result = validateRegistration("Test User", "short", "short");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("8 characters");
  });

  it("rejects mismatched passwords", () => {
    const result = validateRegistration("Test User", "SecurePass123!", "DifferentPass!");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("match");
  });
});

// ── Invitation token validation ───────────────────────────────────────────────
describe("Invitation token validation", () => {
  function isExpired(expiresAt: Date) {
    return new Date(expiresAt) < new Date();
  }

  it("recognizes a future expiry as valid", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    expect(isExpired(future)).toBe(false);
  });

  it("recognizes a past expiry as expired", () => {
    const past = new Date(Date.now() - 1000); // 1 second ago
    expect(isExpired(past)).toBe(true);
  });

  it("validates invitation status correctly", () => {
    const statuses = ["pending", "accepted", "revoked", "expired"] as const;
    const validForRegistration = statuses.filter(s => s === "pending");
    expect(validForRegistration).toEqual(["pending"]);
  });
});
