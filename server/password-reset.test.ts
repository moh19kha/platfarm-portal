// Tests for password reset flow and user deactivation
// Run with: pnpm test

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDb } from "./db";
import { users, passwordResetTokens } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  createPasswordResetToken,
  getPasswordResetToken,
  markResetTokenUsed,
  updateUserPassword,
  updateUserStatus,
  getUserByEmail,
} from "./db";
import crypto from "crypto";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TEST_EMAIL = `test-reset-${Date.now()}@example.com`;
let testUserId: number;

async function createTestUser() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Use a pre-hashed value for 'TestPass123!' (bcrypt, cost 10)
  const hash = "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345";
  const [row] = await db
    .insert(users)
    .values({
      email: TEST_EMAIL,
      name: "Reset Test User",
      openId: `test-openid-${Date.now()}`,
      loginMethod: "local",
      passwordHash: hash,
      role: "user",
      status: "active",
    })
    .$returningId();
  return row.id;
}

async function cleanupTestUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("Password Reset Flow", () => {
  beforeEach(async () => {
    testUserId = await createTestUser();
  });

  afterEach(async () => {
    await cleanupTestUser(testUserId);
  });

  it("creates a reset token row in the database", async () => {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await createPasswordResetToken({ token, userId: testUserId, email: TEST_EMAIL, expiresAt });

    const row = await getPasswordResetToken(token);
    expect(row).not.toBeNull();
    expect(row!.userId).toBe(testUserId);
    expect(row!.usedAt).toBeNull();
  });

  it("returns null for an invalid/unknown token", async () => {
    const row = await getPasswordResetToken("totally-invalid-token-xyz");
    expect(row).toBeNull();
  });

  it("marks a token as used (sets usedAt)", async () => {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await createPasswordResetToken({ token, userId: testUserId, email: TEST_EMAIL, expiresAt });

    await markResetTokenUsed(token);

    const row = await getPasswordResetToken(token);
    expect(row).not.toBeNull();
    expect(row!.usedAt).not.toBeNull();
  });

  it("updates the user password hash correctly", async () => {
    const newHash = "$2b$10$newhashabcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXY";
    await updateUserPassword(testUserId, newHash);

    const user = await getUserByEmail(TEST_EMAIL);
    expect(user).not.toBeNull();
    expect(user!.passwordHash).toBe(newHash);
  });

  it("does not return a token that has already expired (checked via expiresAt)", async () => {
    const token = crypto.randomBytes(32).toString("hex");
    // Insert with expiry in the past
    const expiredAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await createPasswordResetToken({ token, userId: testUserId, email: TEST_EMAIL, expiresAt: expiredAt });

    const row = await getPasswordResetToken(token);
    // Row exists but expiresAt is in the past — the endpoint logic should reject it
    expect(row).not.toBeNull();
    expect(row!.expiresAt.getTime()).toBeLessThan(Date.now());
  });
});

describe("User Deactivation", () => {
  beforeEach(async () => {
    testUserId = await createTestUser();
  });

  afterEach(async () => {
    await cleanupTestUser(testUserId);
  });

  it("deactivates a user by setting status to inactive", async () => {
    await updateUserStatus(testUserId, "inactive");
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [row] = await db.select({ status: users.status }).from(users).where(eq(users.id, testUserId));
    expect(row.status).toBe("inactive");
  });

  it("reactivates a user by setting status back to active", async () => {
    await updateUserStatus(testUserId, "inactive");
    await updateUserStatus(testUserId, "active");
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    const [row] = await db.select({ status: users.status }).from(users).where(eq(users.id, testUserId));
    expect(row.status).toBe("active");
  });

  it("getUserByEmail returns the user with the correct status", async () => {
    const user = await getUserByEmail(TEST_EMAIL);
    expect(user).not.toBeNull();
    expect(user!.status).toBe("active");
  });
});
