import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB ────────────────────────────────────────────────────────────────
let mockDrafts: any[] = [];
let nextId = 1;

vi.mock("./db", () => ({
  getDb: vi.fn(() => {
    const db = {
      select: () => ({
        from: (_table: any) => ({
          where: (condition: any) => ({
            orderBy: (_order: any) => {
              // list query — filter by userId
              return Promise.resolve(mockDrafts.filter(d => d.userId === 1));
            },
            limit: (_n: number) => {
              // getById query — find by id and userId
              return Promise.resolve(mockDrafts.filter(d => d.userId === 1));
            },
          }),
        }),
      }),
      insert: (_table: any) => ({
        values: (data: any) => {
          const id = nextId++;
          mockDrafts.push({ id, ...data, createdAt: new Date(), updatedAt: new Date() });
          return Promise.resolve([{ insertId: id }]);
        },
      }),
      update: (_table: any) => ({
        set: (data: any) => ({
          where: (_condition: any) => {
            const draft = mockDrafts[0];
            if (draft) Object.assign(draft, data);
            return Promise.resolve();
          },
        }),
      }),
      delete: (_table: any) => ({
        where: (_condition: any) => {
          mockDrafts = mockDrafts.filter(d => d.id !== 999); // simplified
          return Promise.resolve();
        },
      }),
    };
    return db;
  }),
}));

// ─── Context Helper ─────────────────────────────────────────────────────────
function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("Drafts tRPC Router", () => {
  beforeEach(() => {
    mockDrafts = [];
    nextId = 1;
  });

  it("saves a new draft and returns the created id", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.drafts.save({
      wizardType: "purchase",
      currentStep: 2,
      label: "Test Purchase Draft",
      formData: { companyId: 1, lines: [{ productId: 100, qty: 10 }] },
    });

    expect(result.action).toBe("created");
    expect(result.id).toBeGreaterThan(0);
  });

  it("lists drafts for the current user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a draft first
    await caller.drafts.save({
      wizardType: "sales",
      currentStep: 1,
      label: "Sales Draft",
      formData: { customer: "Test" },
    });

    const drafts = await caller.drafts.list();
    expect(drafts.length).toBeGreaterThanOrEqual(1);
  });

  it("validates wizard type enum", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.drafts.save({
        wizardType: "invalid_type" as any,
        currentStep: 1,
        formData: {},
      })
    ).rejects.toThrow();
  });

  it("validates currentStep range (min 1, max 4)", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.drafts.save({
        wizardType: "purchase",
        currentStep: 0,
        formData: {},
      })
    ).rejects.toThrow();

    await expect(
      caller.drafts.save({
        wizardType: "purchase",
        currentStep: 5,
        formData: {},
      })
    ).rejects.toThrow();
  });

  it("accepts all valid wizard types", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    for (const wizardType of ["purchase", "sales", "multi_linked"] as const) {
      const result = await caller.drafts.save({
        wizardType,
        currentStep: 1,
        formData: { test: true },
      });
      expect(result.action).toBe("created");
    }
  });

  it("deletes a draft successfully", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.drafts.delete({ id: 999 });
    expect(result).toEqual({ success: true });
  });

  it("requires authentication for all draft operations", async () => {
    const unauthCtx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(unauthCtx);

    await expect(caller.drafts.list()).rejects.toThrow();
    await expect(caller.drafts.save({
      wizardType: "purchase",
      currentStep: 1,
      formData: {},
    })).rejects.toThrow();
    await expect(caller.drafts.delete({ id: 1 })).rejects.toThrow();
  });
});
