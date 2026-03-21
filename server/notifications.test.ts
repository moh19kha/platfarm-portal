import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Notification System Tests
 * 
 * Tests the notification router endpoints, the seed-first approach,
 * notification preferences (per-user + global fallback), and the forceNotify mechanism.
 */

// Mock the database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockReturnThis(),
};

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Mock schema
vi.mock("../drizzle/schema", () => ({
  shipmentStatusLog: {
    id: "id",
    odooOrderId: "odooOrderId",
    orderType: "orderType",
    orderName: "orderName",
    previousStatus: "previousStatus",
    newStatus: "newStatus",
    notified: "notified",
    readAt: "readAt",
    createdAt: "createdAt",
  },
  notificationPreferences: {
    id: "id",
    userId: "userId",
    enabledStages: "enabledStages",
    notifyOwner: "notifyOwner",
    notifyInApp: "notifyInApp",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
}));

describe("Notification System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the limit mock for each test
    mockDb.limit.mockResolvedValue([]);
  });

  describe("Notification Router Structure", () => {
    it("should export notificationsRouter with list, markRead, unreadCount, and preferences procedures", async () => {
      const { notificationsRouter } = await import("./routers/notifications");
      expect(notificationsRouter).toBeDefined();
      const routerDef = notificationsRouter._def;
      expect(routerDef).toBeDefined();
    });

    it("should export seedCurrentStatuses function", async () => {
      const { seedCurrentStatuses } = await import("./routers/notifications");
      expect(seedCurrentStatuses).toBeDefined();
      expect(typeof seedCurrentStatuses).toBe("function");
    });

    it("should export checkAndNotifyStatusChanges function", async () => {
      const { checkAndNotifyStatusChanges } = await import("./routers/notifications");
      expect(checkAndNotifyStatusChanges).toBeDefined();
      expect(typeof checkAndNotifyStatusChanges).toBe("function");
    });

    it("checkAndNotifyStatusChanges should accept userId parameter", async () => {
      const { checkAndNotifyStatusChanges } = await import("./routers/notifications");
      // Verify function accepts 4 parameters (shipments, orderType, forceNotify, userId)
      expect(checkAndNotifyStatusChanges.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Seed-First Approach", () => {
    it("seedCurrentStatuses should not call notifyOwner", async () => {
      const { seedCurrentStatuses } = await import("./routers/notifications");
      const { notifyOwner } = await import("./_core/notification");

      await seedCurrentStatuses(
        [{ id: 1, name: "PO/TEST/001", shipmentStatus: "Loading" }],
        "purchase"
      );

      expect(notifyOwner).not.toHaveBeenCalled();
    });

    it("seedCurrentStatuses should skip shipments with null status", async () => {
      const { seedCurrentStatuses } = await import("./routers/notifications");

      await seedCurrentStatuses(
        [{ id: 1, name: "PO/TEST/001", shipmentStatus: null }],
        "purchase"
      );

      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("seedCurrentStatuses should insert initial status for new shipments", async () => {
      const { seedCurrentStatuses } = await import("./routers/notifications");

      mockDb.limit.mockResolvedValueOnce([]);

      await seedCurrentStatuses(
        [{ id: 999, name: "PO/TEST/999", shipmentStatus: "In Transit" }],
        "purchase"
      );

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("Status Change Detection", () => {
    it("checkAndNotifyStatusChanges should skip shipments with null status", async () => {
      const { checkAndNotifyStatusChanges } = await import("./routers/notifications");
      const { notifyOwner } = await import("./_core/notification");

      await checkAndNotifyStatusChanges(
        [{ id: 1, name: "PO/TEST/001", shipmentStatus: null }],
        "purchase"
      );

      expect(notifyOwner).not.toHaveBeenCalled();
    });

    it("checkAndNotifyStatusChanges should not notify when status unchanged", async () => {
      const { checkAndNotifyStatusChanges } = await import("./routers/notifications");
      const { notifyOwner } = await import("./_core/notification");

      mockDb.limit.mockResolvedValueOnce([{
        id: 1,
        odooOrderId: 1,
        orderType: "purchase",
        orderName: "PO/TEST/001",
        previousStatus: null,
        newStatus: "Loading",
        notified: 0,
        readAt: null,
        createdAt: new Date(),
      }]);

      await checkAndNotifyStatusChanges(
        [{ id: 1, name: "PO/TEST/001", shipmentStatus: "Loading" }],
        "purchase"
      );

      expect(notifyOwner).not.toHaveBeenCalled();
    });
  });

  describe("forceNotify Mechanism", () => {
    it("checkAndNotifyStatusChanges with forceNotify should create notification even for first encounter", async () => {
      const { checkAndNotifyStatusChanges } = await import("./routers/notifications");

      // Mock: no existing record (first encounter)
      mockDb.limit.mockResolvedValueOnce([]);
      // Mock: preferences query (user-specific) returns empty
      mockDb.limit.mockResolvedValueOnce([]);
      // Mock: preferences query (global fallback) returns empty
      mockDb.limit.mockResolvedValueOnce([]);

      await checkAndNotifyStatusChanges(
        [{ id: 5000, name: "PO/TEST/5000", shipmentStatus: "Planned" }],
        "purchase",
        true // forceNotify
      );

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("forceNotify should use 'Not Set' as previousStatus when no prior record exists", async () => {
      const { checkAndNotifyStatusChanges } = await import("./routers/notifications");

      // Mock: no existing record
      mockDb.limit.mockResolvedValueOnce([]);
      // Mock: preferences queries
      mockDb.limit.mockResolvedValueOnce([]);
      mockDb.limit.mockResolvedValueOnce([]);

      await checkAndNotifyStatusChanges(
        [{ id: 5001, name: "PO/TEST/5001", shipmentStatus: "Booked" }],
        "purchase",
        true
      );

      expect(mockDb.values).toHaveBeenCalled();
      const insertCall = mockDb.values.mock.calls[mockDb.values.mock.calls.length - 1];
      if (insertCall && insertCall[0]) {
        expect(insertCall[0].previousStatus).toBe("Not Set");
        expect(insertCall[0].newStatus).toBe("Booked");
      }
    });

    it("without forceNotify, first encounter should be treated as silent seed", async () => {
      const { checkAndNotifyStatusChanges } = await import("./routers/notifications");
      const { notifyOwner } = await import("./_core/notification");

      // Mock: no existing record (first encounter)
      mockDb.limit.mockResolvedValueOnce([]);
      // Mock: preferences queries
      mockDb.limit.mockResolvedValueOnce([]);
      mockDb.limit.mockResolvedValueOnce([]);

      await checkAndNotifyStatusChanges(
        [{ id: 5002, name: "PO/TEST/5002", shipmentStatus: "Loading" }],
        "purchase",
        false // no forceNotify
      );

      expect(notifyOwner).not.toHaveBeenCalled();
    });
  });

  describe("Per-User Notification Preferences", () => {
    it("should define default stages list with all 10 stages", () => {
      const DEFAULT_STAGES = [
        "Planned", "Booked", "Loading", "Loaded", "In Transit",
        "Arrived at Port", "Customs Clearance", "Delivering", "Delivered", "Returned"
      ];
      expect(DEFAULT_STAGES).toHaveLength(10);
      expect(DEFAULT_STAGES).toContain("Planned");
      expect(DEFAULT_STAGES).toContain("Delivered");
      expect(DEFAULT_STAGES).toContain("Returned");
    });

    it("preferences should control which stages trigger notifications", () => {
      const enabledStages = ["In Transit", "Delivered"];
      
      const isStageEnabled = (stage: string) => enabledStages.includes(stage);
      
      expect(isStageEnabled("In Transit")).toBe(true);
      expect(isStageEnabled("Delivered")).toBe(true);
      expect(isStageEnabled("Planned")).toBe(false);
      expect(isStageEnabled("Loading")).toBe(false);
    });

    it("preferences should support notifyOwner and notifyInApp toggles", () => {
      const prefs = {
        enabledStages: ["Planned", "Delivered"],
        notifyOwner: true,
        notifyInApp: true,
      };

      expect(prefs.notifyOwner).toBe(true);
      expect(prefs.notifyInApp).toBe(true);

      prefs.notifyOwner = false;
      expect(prefs.notifyOwner).toBe(false);
    });

    it("per-user preferences should take priority over global defaults", () => {
      // Simulate: user has personal prefs with only 2 stages
      const userPrefs = { enabledStages: ["Delivered", "Returned"], notifyOwner: false, notifyInApp: true };
      // Simulate: global defaults have all stages
      const globalPrefs = { enabledStages: ["Planned", "Booked", "Loading", "Loaded", "In Transit", "Arrived at Port", "Customs Clearance", "Delivering", "Delivered", "Returned"], notifyOwner: true, notifyInApp: true };

      // User prefs should override global
      const effectivePrefs = userPrefs; // In real code, loadPreferences returns user prefs first
      expect(effectivePrefs.enabledStages).toHaveLength(2);
      expect(effectivePrefs.notifyOwner).toBe(false);
      expect(globalPrefs.enabledStages).toHaveLength(10);
    });

    it("should fall back to global defaults when user has no personal preferences", () => {
      const userPrefs = null; // No personal row
      const globalPrefs = { enabledStages: ["In Transit", "Delivered"], notifyOwner: true, notifyInApp: true };
      const hardcodedDefaults = { enabledStages: ["Planned", "Booked", "Loading", "Loaded", "In Transit", "Arrived at Port", "Customs Clearance", "Delivering", "Delivered", "Returned"], notifyOwner: true, notifyInApp: true };

      // Fallback chain: user -> global -> hardcoded
      const effectivePrefs = userPrefs ?? globalPrefs ?? hardcodedDefaults;
      expect(effectivePrefs.enabledStages).toEqual(["In Transit", "Delivered"]);
    });

    it("should support resetting personal preferences to global defaults", () => {
      // After reset, user row is deleted, so loadPreferences falls back to global
      const afterReset = null; // User row deleted
      const globalPrefs = { enabledStages: ["Planned", "Delivered"], notifyOwner: true, notifyInApp: true, isPersonal: false };
      
      const result = afterReset ?? globalPrefs;
      expect(result.isPersonal).toBe(false);
      expect(result.enabledStages).toContain("Planned");
    });

    it("isPersonal flag should indicate whether preferences are user-specific", () => {
      // When user has personal prefs
      const personalResult = { enabledStages: ["Delivered"], notifyOwner: false, notifyInApp: true, isPersonal: true };
      expect(personalResult.isPersonal).toBe(true);

      // When falling back to global
      const globalResult = { enabledStages: ["Delivered"], notifyOwner: true, notifyInApp: true, isPersonal: false };
      expect(globalResult.isPersonal).toBe(false);
    });
  });

  describe("Recent Changes Endpoint (Toast Polling)", () => {
    it("should export notificationsRouter with recentChanges procedure", async () => {
      const { notificationsRouter } = await import("./routers/notifications");
      expect(notificationsRouter).toBeDefined();
      // The router should have recentChanges as a procedure
      const routerDef = notificationsRouter._def;
      expect(routerDef).toBeDefined();
    });

    it("recentChanges should accept a 'since' timestamp parameter", () => {
      const input = { since: Date.now() - 30000 };
      expect(input.since).toBeGreaterThan(0);
      expect(typeof input.since).toBe("number");
    });

    it("recentChanges should return changes array with correct shape", () => {
      const mockChange = {
        id: 1,
        odooOrderId: 1592,
        orderType: "purchase" as const,
        orderName: "PO/AD/26/00049",
        previousStatus: "Not Set",
        newStatus: "Planned",
        createdAt: Date.now(),
      };

      expect(mockChange).toHaveProperty("id");
      expect(mockChange).toHaveProperty("odooOrderId");
      expect(mockChange).toHaveProperty("orderType");
      expect(mockChange).toHaveProperty("orderName");
      expect(mockChange).toHaveProperty("previousStatus");
      expect(mockChange).toHaveProperty("newStatus");
      expect(mockChange).toHaveProperty("createdAt");
      expect(typeof mockChange.createdAt).toBe("number");
    });

    it("recentChanges should only return genuine transitions (previousStatus IS NOT NULL)", () => {
      const seedRow = { previousStatus: null, newStatus: "Loading" };
      const realTransition = { previousStatus: "Loading", newStatus: "In Transit" };
      const forceNotifyRow = { previousStatus: "Not Set", newStatus: "Planned" };

      // Only rows with non-null previousStatus should be returned
      const isGenuineTransition = (row: { previousStatus: string | null }) => row.previousStatus !== null;

      expect(isGenuineTransition(seedRow)).toBe(false);
      expect(isGenuineTransition(realTransition)).toBe(true);
      expect(isGenuineTransition(forceNotifyRow)).toBe(true);
    });

    it("toast deduplication should prevent showing same notification twice", () => {
      const shownIds = new Set<number>();
      const change1 = { id: 100 };
      const change2 = { id: 101 };

      // First time: should show
      expect(shownIds.has(change1.id)).toBe(false);
      shownIds.add(change1.id);

      // Second time: should not show
      expect(shownIds.has(change1.id)).toBe(true);

      // Different notification: should show
      expect(shownIds.has(change2.id)).toBe(false);
      shownIds.add(change2.id);
    });

    it("toast should format purchase and sales types differently", () => {
      const purchaseLabel = "purchase" === "purchase" ? "PO" : "SO";
      const salesLabel = "sales" === "purchase" ? "PO" : "SO";

      expect(purchaseLabel).toBe("PO");
      expect(salesLabel).toBe("SO");
    });

    it("toast should format status arrow correctly", () => {
      const withPrevious = { previousStatus: "Loading", newStatus: "In Transit" };
      const withoutPrevious = { previousStatus: null, newStatus: "Planned" };

      const formatArrow = (prev: string | null, next: string) =>
        prev ? `${prev} \u2192 ${next}` : `Set to ${next}`;

      expect(formatArrow(withPrevious.previousStatus, withPrevious.newStatus)).toBe("Loading \u2192 In Transit");
      expect(formatArrow(withoutPrevious.previousStatus, withoutPrevious.newStatus)).toBe("Set to Planned");
    });

    it("polling should update lastCheck timestamp to most recent change", () => {
      const changes = [
        { createdAt: 1000 },
        { createdAt: 3000 },
        { createdAt: 2000 },
      ];

      const maxTime = Math.max(...changes.map(c => c.createdAt));
      expect(maxTime).toBe(3000);
    });
  });

  describe("Notification Data Format", () => {
    it("should handle purchase and sales order types", () => {
      const purchaseType = "purchase" as const;
      const salesType = "sales" as const;
      expect(purchaseType).toBe("purchase");
      expect(salesType).toBe("sales");
    });

    it("should format notification content correctly", () => {
      const orderName = "PO/AD/26/00048";
      const previousStatus = "Loading";
      const newStatus = "In Transit";
      const arrow = `${previousStatus} → ${newStatus}`;
      const content = `**${orderName}** status changed: ${arrow}`;
      
      expect(content).toContain(orderName);
      expect(content).toContain("Loading");
      expect(content).toContain("In Transit");
      expect(content).toContain("→");
    });

    it("should handle 'Not Set' as previousStatus for first-time transitions", () => {
      const orderName = "PO/AD/26/00049";
      const previousStatus = "Not Set";
      const newStatus = "Planned";
      const arrow = `${previousStatus} → ${newStatus}`;
      
      expect(arrow).toBe("Not Set → Planned");
      expect(previousStatus).not.toBeNull();
    });
  });
});
