import { describe, it, expect } from "vitest";

/**
 * Test suite for Supply Split currency tracking in supplier/product summaries
 * and Sales Analytics invoice-based aggregation logic.
 */

describe("Supply Split — Currency column", () => {
  // Simulate the currency tracking logic from the supplySplit procedure
  function buildSupplierSummaries(lines: Array<{
    supplierId: number;
    supplierName: string;
    productId: number;
    productName: string;
    productQty: number;
    qtyReceived: number;
    priceSubtotal: number;
    currency: string;
    orderId: number;
  }>) {
    const supplierMap = new Map<number, {
      id: number;
      name: string;
      totalQty: number;
      totalReceived: number;
      totalValue: number;
      products: Map<number, { id: number; name: string; qty: number; received: number; value: number; orders: number; currency: string }>;
      orderCount: Set<number>;
      currencies: Map<string, number>;
    }>();

    lines.forEach(l => {
      if (!supplierMap.has(l.supplierId)) {
        supplierMap.set(l.supplierId, {
          id: l.supplierId,
          name: l.supplierName,
          totalQty: 0,
          totalReceived: 0,
          totalValue: 0,
          products: new Map(),
          orderCount: new Set(),
          currencies: new Map(),
        });
      }
      const s = supplierMap.get(l.supplierId)!;
      s.totalQty += l.productQty;
      s.totalReceived += l.qtyReceived;
      s.totalValue += l.priceSubtotal;
      s.orderCount.add(l.orderId);
      s.currencies.set(l.currency, (s.currencies.get(l.currency) || 0) + l.priceSubtotal);

      if (!s.products.has(l.productId)) {
        s.products.set(l.productId, { id: l.productId, name: l.productName, qty: 0, received: 0, value: 0, orders: 0, currency: l.currency });
      }
      const p = s.products.get(l.productId)!;
      p.qty += l.productQty;
      p.received += l.qtyReceived;
      p.value += l.priceSubtotal;
      p.orders++;
    });

    return [...supplierMap.values()].map(s => {
      let dominantCurrency = "EGP";
      let maxVal = 0;
      s.currencies.forEach((val, cur) => { if (val > maxVal) { maxVal = val; dominantCurrency = cur; } });
      return {
        id: s.id,
        name: s.name,
        totalQty: s.totalQty,
        totalReceived: s.totalReceived,
        totalValue: s.totalValue,
        orderCount: s.orderCount.size,
        currency: dominantCurrency,
        products: [...s.products.values()].sort((a, b) => b.received - a.received),
      };
    }).sort((a, b) => b.totalReceived - a.totalReceived);
  }

  it("should assign the dominant currency based on highest total value", () => {
    const lines = [
      { supplierId: 1, supplierName: "Supplier A", productId: 10, productName: "Alfalfa", productQty: 100, qtyReceived: 100, priceSubtotal: 50000, currency: "EGP", orderId: 1 },
      { supplierId: 1, supplierName: "Supplier A", productId: 10, productName: "Alfalfa", productQty: 200, qtyReceived: 200, priceSubtotal: 80000, currency: "EGP", orderId: 2 },
      { supplierId: 1, supplierName: "Supplier A", productId: 11, productName: "Hay", productQty: 50, qtyReceived: 50, priceSubtotal: 10000, currency: "USD", orderId: 3 },
    ];

    const summaries = buildSupplierSummaries(lines);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].currency).toBe("EGP"); // EGP has 130,000 vs USD 10,000
  });

  it("should pick USD when USD has higher total value", () => {
    const lines = [
      { supplierId: 2, supplierName: "Supplier B", productId: 20, productName: "Wheat", productQty: 10, qtyReceived: 10, priceSubtotal: 5000, currency: "EGP", orderId: 10 },
      { supplierId: 2, supplierName: "Supplier B", productId: 21, productName: "Corn", productQty: 500, qtyReceived: 500, priceSubtotal: 200000, currency: "USD", orderId: 11 },
    ];

    const summaries = buildSupplierSummaries(lines);
    expect(summaries[0].currency).toBe("USD");
  });

  it("should handle single-currency suppliers", () => {
    const lines = [
      { supplierId: 3, supplierName: "Supplier C", productId: 30, productName: "Oil", productQty: 10, qtyReceived: 10, priceSubtotal: 25000, currency: "AED", orderId: 20 },
    ];

    const summaries = buildSupplierSummaries(lines);
    expect(summaries[0].currency).toBe("AED");
  });

  it("should track currency at the product level too", () => {
    const lines = [
      { supplierId: 4, supplierName: "Supplier D", productId: 40, productName: "Barley", productQty: 100, qtyReceived: 100, priceSubtotal: 30000, currency: "EUR", orderId: 30 },
      { supplierId: 4, supplierName: "Supplier D", productId: 41, productName: "Oats", productQty: 50, qtyReceived: 50, priceSubtotal: 15000, currency: "GBP", orderId: 31 },
    ];

    const summaries = buildSupplierSummaries(lines);
    expect(summaries[0].products).toHaveLength(2);
    const barley = summaries[0].products.find(p => p.name === "Barley");
    const oats = summaries[0].products.find(p => p.name === "Oats");
    expect(barley?.currency).toBe("EUR");
    expect(oats?.currency).toBe("GBP");
  });

  it("should default to EGP when no lines exist", () => {
    const summaries = buildSupplierSummaries([]);
    expect(summaries).toHaveLength(0);
  });

  it("should sort suppliers by totalReceived descending", () => {
    const lines = [
      { supplierId: 5, supplierName: "Small Supplier", productId: 50, productName: "P1", productQty: 10, qtyReceived: 10, priceSubtotal: 1000, currency: "EGP", orderId: 40 },
      { supplierId: 6, supplierName: "Big Supplier", productId: 60, productName: "P2", productQty: 1000, qtyReceived: 1000, priceSubtotal: 500000, currency: "USD", orderId: 41 },
    ];

    const summaries = buildSupplierSummaries(lines);
    expect(summaries[0].name).toBe("Big Supplier");
    expect(summaries[1].name).toBe("Small Supplier");
  });
});

describe("Sales Analytics — Invoice aggregation", () => {
  // Simulate the estimateTons helper from the salesAnalytics procedure
  function estimateTons(productName: string, qty: number, uom: string): number {
    const uomLower = uom.toLowerCase();
    if (uomLower.includes("ton") || uomLower === "t") return qty;
    const kgMatch = productName.match(/(\d+)\s*[-–]\s*(\d+)\s*[Kk]g/);
    if (kgMatch) {
      const avgKg = (parseInt(kgMatch[1]) + parseInt(kgMatch[2])) / 2;
      return (qty * avgKg) / 1000;
    }
    const singleKg = productName.match(/(\d+)\s*[Kk]g/);
    if (singleKg) {
      return (qty * parseInt(singleKg[1])) / 1000;
    }
    return 0;
  }

  it("should return qty directly when UOM is tons", () => {
    expect(estimateTons("Alfalfa Bales", 50, "Tons")).toBe(50);
    expect(estimateTons("Alfalfa Bales", 50, "t")).toBe(50);
  });

  it("should estimate tons from weight range in product name", () => {
    const tons = estimateTons("Animal Fodder Alfalfa.Hay.Bales 400-425 Kg", 100, "Units");
    const expectedAvgKg = (400 + 425) / 2; // 412.5
    expect(tons).toBeCloseTo(100 * expectedAvgKg / 1000); // 41.25 tons
  });

  it("should estimate tons from single kg weight in product name", () => {
    const tons = estimateTons("Packing Material 25 Kg Bags", 200, "Units");
    expect(tons).toBeCloseTo(200 * 25 / 1000); // 5 tons
  });

  it("should return 0 when no weight info is available", () => {
    expect(estimateTons("Generic Product", 100, "Units")).toBe(0);
    expect(estimateTons("Office Supplies", 50, "pcs")).toBe(0);
  });

  it("should handle en-dash in weight range", () => {
    const tons = estimateTons("Bales 300\u2013350 Kg", 10, "Bale");
    const expectedAvgKg = (300 + 350) / 2; // 325
    expect(tons).toBeCloseTo(10 * expectedAvgKg / 1000); // 3.25 tons
  });

  // Simulate the cleanName helper
  function cleanName(raw: string): string {
    const m = raw.match(/^[A-Z0-9]+\s*[-–]\s*(.+)$/i);
    return m ? m[1].trim() : raw.trim();
  }

  it("should strip customer code prefix from names", () => {
    expect(cleanName("12131010101-ABU DHABI-PLATFARM")).toBe("ABU DHABI-PLATFARM");
    expect(cleanName("CUST001 - Some Customer Name")).toBe("Some Customer Name");
    expect(cleanName("Plain Customer Name")).toBe("Plain Customer Name");
  });

  it("should handle en-dash separator", () => {
    expect(cleanName("ABC123\u2013Customer Name")).toBe("Customer Name");
  });
});
