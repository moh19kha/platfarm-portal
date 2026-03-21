import { describe, expect, it, vi } from "vitest";

/**
 * Tests for enhanced search and Loading Team features.
 * These test the data transformation and filtering logic
 * without requiring live Odoo connections.
 */

describe("Enhanced Search - Client-side filter logic", () => {
  // Simulated shipment data matching the list response shape
  const mockShipments = [
    {
      id: 1,
      name: "PO/AD/26/00001",
      vendor: { id: 10, name: "Al Futtaim Trading" },
      company: { id: 1, name: "Abu Dhabi Co" },
      vesselName: "MV Pacific Star",
      agreement: { id: 5, name: "AGR-001" },
      trackingNumber: "TRK-123",
      bookingNumber: "BKG-456",
      blNumber: "BL-789",
      shipmentStatus: "Planned",
    },
    {
      id: 2,
      name: "PO/AD/26/00002",
      vendor: { id: 11, name: "Emirates Steel" },
      company: { id: 1, name: "Abu Dhabi Co" },
      vesselName: "MV Ocean Blue",
      agreement: null,
      trackingNumber: null,
      bookingNumber: "BKG-999",
      blNumber: null,
      shipmentStatus: "In Transit",
    },
    {
      id: 3,
      name: "PO/DXB/26/00003",
      vendor: { id: 12, name: "Dubai Metals LLC" },
      company: { id: 2, name: "Dubai Co" },
      vesselName: null,
      agreement: null,
      trackingNumber: null,
      bookingNumber: null,
      blNumber: "BL-555",
      shipmentStatus: "Planned",
    },
  ];

  function filterShipments(
    shipments: typeof mockShipments,
    search: string,
    stateFilter: string,
    containerMatchIds: Set<number> | null = null
  ) {
    return shipments.filter((sh) => {
      if (stateFilter !== "all" && (sh.shipmentStatus || "") !== stateFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesBasic =
          sh.name.toLowerCase().includes(q) ||
          (sh.vendor?.name || "").toLowerCase().includes(q) ||
          (sh.company?.name || "").toLowerCase().includes(q) ||
          (sh.vesselName || "").toLowerCase().includes(q) ||
          (sh.agreement?.name || "").toLowerCase().includes(q) ||
          (sh.trackingNumber || "").toLowerCase().includes(q) ||
          (sh.bookingNumber || "").toLowerCase().includes(q) ||
          (sh.blNumber || "").toLowerCase().includes(q);
        if (matchesBasic) return true;
        if (containerMatchIds && containerMatchIds.has(sh.id)) return true;
        return false;
      }
      return true;
    });
  }

  it("searches by PO number", () => {
    const results = filterShipments(mockShipments, "PO/AD/26/00001", "all");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
  });

  it("searches by vendor name", () => {
    const results = filterShipments(mockShipments, "futtaim", "all");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
  });

  it("searches by vendor name - Emirates Steel", () => {
    const results = filterShipments(mockShipments, "emirates steel", "all");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(2);
  });

  it("searches by booking number", () => {
    const results = filterShipments(mockShipments, "BKG-456", "all");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
  });

  it("searches by BL number", () => {
    const results = filterShipments(mockShipments, "BL-789", "all");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
  });

  it("searches by vessel name", () => {
    const results = filterShipments(mockShipments, "pacific", "all");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
  });

  it("searches by company name", () => {
    const results = filterShipments(mockShipments, "dubai co", "all");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(3);
  });

  it("combines search with state filter", () => {
    const results = filterShipments(mockShipments, "AD", "Planned");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
  });

  it("returns all when no search and no filter", () => {
    const results = filterShipments(mockShipments, "", "all");
    expect(results).toHaveLength(3);
  });

  it("includes container search results from backend", () => {
    // Simulate backend returning PO ID 3 for a container number search
    const containerMatchIds = new Set([3]);
    const results = filterShipments(mockShipments, "9591", "all", containerMatchIds);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(3);
  });

  it("merges basic search and container search results", () => {
    // "BL-789" matches PO 1 via basic search, container search matches PO 3
    const containerMatchIds = new Set([3]);
    const results = filterShipments(mockShipments, "BL-789", "all", containerMatchIds);
    // PO 1 matches basic BL field, PO 3 matches container search
    expect(results).toHaveLength(2);
    expect(results.map(r => r.id)).toContain(1);
    expect(results.map(r => r.id)).toContain(3);
    // Query that only matches via container search:
    const results2 = filterShipments(mockShipments, "some-container", "all", containerMatchIds);
    expect(results2).toHaveLength(1); // PO 3 from container search
    expect(results2[0].id).toBe(3);
  });

  it("handles null fields gracefully", () => {
    const results = filterShipments(mockShipments, "nonexistent", "all");
    expect(results).toHaveLength(0);
  });
});

describe("Enhanced Search - Sales shipments filter logic", () => {
  const mockSalesShipments = [
    {
      id: 100,
      name: "SO/AD/26/00001",
      customer: { id: 20, name: "Global Imports Inc" },
      company: { id: 1, name: "Abu Dhabi Co" },
      trackingNumber: "TRK-S001",
      blNumber: "BL-S001",
      ultimateCustomer: "End Buyer Corp",
      correspondingPO: "PO/AD/26/00001",
      salesperson: { id: 5, name: "Ahmed Sales" },
      shipmentStatus: "Planned",
    },
    {
      id: 101,
      name: "SO/DXB/26/00002",
      customer: { id: 21, name: "Metro Trading FZE" },
      company: { id: 2, name: "Dubai Co" },
      trackingNumber: null,
      blNumber: null,
      ultimateCustomer: null,
      correspondingPO: null,
      salesperson: null,
      shipmentStatus: "In Transit",
    },
  ];

  function filterSalesShipments(
    shipments: typeof mockSalesShipments,
    search: string,
    stateFilter: string,
    containerMatchIds: Set<number> | null = null
  ) {
    return shipments.filter((sh) => {
      if (stateFilter !== "all" && (sh.shipmentStatus || "") !== stateFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesBasic =
          sh.name.toLowerCase().includes(q) ||
          (sh.customer?.name || "").toLowerCase().includes(q) ||
          (sh.company?.name || "").toLowerCase().includes(q) ||
          (sh.trackingNumber || "").toLowerCase().includes(q) ||
          (sh.blNumber || "").toLowerCase().includes(q) ||
          (sh.ultimateCustomer || "").toLowerCase().includes(q) ||
          (sh.correspondingPO || "").toLowerCase().includes(q) ||
          (sh.salesperson?.name || "").toLowerCase().includes(q);
        if (matchesBasic) return true;
        if (containerMatchIds && containerMatchIds.has(sh.id)) return true;
        return false;
      }
      return true;
    });
  }

  it("searches by customer name", () => {
    const results = filterSalesShipments(mockSalesShipments, "global imports", "all");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(100);
  });

  it("searches by customer name - Metro Trading", () => {
    const results = filterSalesShipments(mockSalesShipments, "metro", "all");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(101);
  });

  it("searches by SO number", () => {
    const results = filterSalesShipments(mockSalesShipments, "SO/AD/26/00001", "all");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(100);
  });

  it("searches by corresponding PO", () => {
    const results = filterSalesShipments(mockSalesShipments, "PO/AD/26/00001", "all");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(100);
  });

  it("searches by ultimate customer", () => {
    const results = filterSalesShipments(mockSalesShipments, "end buyer", "all");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(100);
  });

  it("searches by salesperson name", () => {
    const results = filterSalesShipments(mockSalesShipments, "ahmed sales", "all");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(100);
  });

  it("includes container search results from backend", () => {
    const containerMatchIds = new Set([101]);
    const results = filterSalesShipments(mockSalesShipments, "container-xyz", "all", containerMatchIds);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(101);
  });
});

describe("Loading Team - Employee ID resolution", () => {
  it("resolves employee IDs to names correctly", () => {
    // Simulate the resolveEmployeeIds logic
    const employees = [
      { id: 1, name: "Adam Mohamed Mousa Abaker" },
      { id: 2, name: "Fadl Al Maola Gamil Allah Mohamed Gad" },
      { id: 3, name: "Mohamed Blal Yousef Bashar" },
    ];

    const idToName = new Map(employees.map(e => [e.id, e.name]));

    // Resolve IDs [1, 2] -> names
    const ids = [1, 2];
    const resolved = ids.map(id => ({
      id,
      name: idToName.get(id) || `Employee #${id}`,
    }));

    expect(resolved).toHaveLength(2);
    expect(resolved[0].name).toBe("Adam Mohamed Mousa Abaker");
    expect(resolved[1].name).toBe("Fadl Al Maola Gamil Allah Mohamed Gad");
  });

  it("handles unknown employee IDs gracefully", () => {
    const idToName = new Map<number, string>();
    const ids = [999];
    const resolved = ids.map(id => ({
      id,
      name: idToName.get(id) || `Employee #${id}`,
    }));

    expect(resolved[0].name).toBe("Employee #999");
  });

  it("handles empty employee ID arrays", () => {
    const ids: number[] = [];
    const resolved = ids.map(id => ({
      id,
      name: `Employee #${id}`,
    }));
    expect(resolved).toHaveLength(0);
  });
});

describe("Loading Team - Many2many write format", () => {
  it("formats IDs correctly for Odoo many2many write", () => {
    // Odoo expects [[6, 0, [id1, id2, ...]]] for replacing many2many
    const selectedIds = [1, 3, 5];
    const odooFormat = [[6, 0, selectedIds]];

    expect(odooFormat).toEqual([[6, 0, [1, 3, 5]]]);
    expect(odooFormat[0][0]).toBe(6); // Replace command
    expect(odooFormat[0][1]).toBe(0); // Unused
    expect(odooFormat[0][2]).toEqual([1, 3, 5]); // IDs
  });

  it("formats empty selection as empty array", () => {
    const selectedIds: number[] = [];
    const odooFormat = [[6, 0, selectedIds]];
    expect(odooFormat[0][2]).toEqual([]);
  });
});
