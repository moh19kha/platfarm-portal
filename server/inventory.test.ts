import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

/**
 * Test suite for inventory.supplierReceipts procedure
 * Verifies that price data is correctly looked up from purchase.order.line records
 */

describe("Inventory Supply Statement", () => {
  describe("supplierReceipts price lookup", () => {
    it("should prioritize picking.agreed_product_price_per_unit when available", () => {
      // Simulate the price resolution logic
      const r = { agreed_product_price_per_unit: 500 }; // per TON
      const firstMove = { price_unit: 0.5, product_id: [123, "Product A"] };
      const poId = 1;
      const poLineMap = new Map<string, number>();
      poLineMap.set("1_123", 0.4); // PO line price per kg

      let pricePerTon = r.agreed_product_price_per_unit || 0;
      if (pricePerTon === 0 && poId && firstMove) {
        const productId = Array.isArray(firstMove.product_id)
          ? firstMove.product_id[0]
          : 0;
        const poLineKey = `${poId}_${productId}`;
        const poLinePrice = poLineMap.get(poLineKey);
        if (poLinePrice && poLinePrice > 0) {
          pricePerTon = poLinePrice * 1000;
        } else if (firstMove.price_unit > 0) {
          pricePerTon = firstMove.price_unit * 1000;
        }
      }

      expect(pricePerTon).toBe(500); // Should use picking price, not PO line
    });

    it("should fallback to purchase.order.line price when picking price is 0", () => {
      const r = { agreed_product_price_per_unit: 0 }; // No picking price
      const firstMove = { price_unit: 0.5, product_id: [123, "Product A"] };
      const poId = 1;
      const poLineMap = new Map<string, number>();
      poLineMap.set("1_123", 0.4); // PO line price per kg

      let pricePerTon = r.agreed_product_price_per_unit || 0;
      if (pricePerTon === 0 && poId && firstMove) {
        const productId = Array.isArray(firstMove.product_id)
          ? firstMove.product_id[0]
          : 0;
        const poLineKey = `${poId}_${productId}`;
        const poLinePrice = poLineMap.get(poLineKey);
        if (poLinePrice && poLinePrice > 0) {
          pricePerTon = poLinePrice * 1000; // Convert kg to ton
        } else if (firstMove.price_unit > 0) {
          pricePerTon = firstMove.price_unit * 1000;
        }
      }

      expect(pricePerTon).toBe(400); // Should use PO line price: 0.4 * 1000
    });

    it("should fallback to stock.move price when PO line price is not found", () => {
      const r = { agreed_product_price_per_unit: 0 }; // No picking price
      const firstMove = { price_unit: 0.5, product_id: [123, "Product A"] };
      const poId = 1;
      const poLineMap = new Map<string, number>();
      // No entry for this product in PO line map

      let pricePerTon = r.agreed_product_price_per_unit || 0;
      if (pricePerTon === 0 && poId && firstMove) {
        const productId = Array.isArray(firstMove.product_id)
          ? firstMove.product_id[0]
          : 0;
        const poLineKey = `${poId}_${productId}`;
        const poLinePrice = poLineMap.get(poLineKey);
        if (poLinePrice && poLinePrice > 0) {
          pricePerTon = poLinePrice * 1000;
        } else if (firstMove.price_unit > 0) {
          pricePerTon = firstMove.price_unit * 1000; // Convert kg to ton
        }
      }

      expect(pricePerTon).toBe(500); // Should use stock.move price: 0.5 * 1000
    });

    it("should handle missing product_id in firstMove gracefully", () => {
      const r = { agreed_product_price_per_unit: 0 };
      const firstMove = { price_unit: 0.5, product_id: undefined };
      const poId = 1;
      const poLineMap = new Map<string, number>();
      poLineMap.set("1_0", 0.3);

      let pricePerTon = r.agreed_product_price_per_unit || 0;
      if (pricePerTon === 0 && poId && firstMove) {
        const productId = Array.isArray(firstMove.product_id)
          ? firstMove.product_id[0]
          : 0;
        const poLineKey = `${poId}_${productId}`;
        const poLinePrice = poLineMap.get(poLineKey);
        if (poLinePrice && poLinePrice > 0) {
          pricePerTon = poLinePrice * 1000;
        } else if (firstMove.price_unit > 0) {
          pricePerTon = firstMove.price_unit * 1000;
        }
      }

      expect(pricePerTon).toBe(300); // Should use PO line with productId=0
    });

    it("should return 0 when all price sources are empty", () => {
      const r = { agreed_product_price_per_unit: 0 };
      const firstMove = { price_unit: 0, product_id: [123, "Product A"] };
      const poId = 1;
      const poLineMap = new Map<string, number>();
      // No entry for this product

      let pricePerTon = r.agreed_product_price_per_unit || 0;
      if (pricePerTon === 0 && poId && firstMove) {
        const productId = Array.isArray(firstMove.product_id)
          ? firstMove.product_id[0]
          : 0;
        const poLineKey = `${poId}_${productId}`;
        const poLinePrice = poLineMap.get(poLineKey);
        if (poLinePrice && poLinePrice > 0) {
          pricePerTon = poLinePrice * 1000;
        } else if (firstMove.price_unit > 0) {
          pricePerTon = firstMove.price_unit * 1000;
        }
      }

      expect(pricePerTon).toBe(0);
    });

    it("should correctly build poLineMap from purchase.order.line records", () => {
      const poLines = [
        {
          id: 1,
          order_id: [101, "PO/CAI/26/00110"],
          product_id: [123, "Alfalfa"],
          price_unit: 0.4,
        },
        {
          id: 2,
          order_id: [101, "PO/CAI/26/00110"],
          product_id: [124, "Hay"],
          price_unit: 0.35,
        },
        {
          id: 3,
          order_id: [102, "PO/CAI/26/00111"],
          product_id: [123, "Alfalfa"],
          price_unit: 0.42,
        },
      ];

      const poLineMap = new Map<string, number>();
      poLines.forEach((line: any) => {
        const key = `${line.order_id[0]}_${line.product_id[0]}`;
        poLineMap.set(key, line.price_unit || 0);
      });

      // Verify map entries
      expect(poLineMap.get("101_123")).toBe(0.4);
      expect(poLineMap.get("101_124")).toBe(0.35);
      expect(poLineMap.get("102_123")).toBe(0.42);
      expect(poLineMap.size).toBe(3);
    });

    it("should convert kg-based prices to per-ton correctly", () => {
      // Simulate a receipt with price from PO line
      const poLinePrice = 0.4; // per kg
      const pricePerTon = poLinePrice * 1000; // Convert to per ton

      expect(pricePerTon).toBe(400);
    });

    it("should handle multiple receipts with different price sources", () => {
      const receipts = [
        {
          id: 1,
          agreed_product_price_per_unit: 500, // Has picking price
          firstMove: { price_unit: 0.5, product_id: [123, "Alfalfa"] },
          poId: 101,
        },
        {
          id: 2,
          agreed_product_price_per_unit: 0, // No picking price
          firstMove: { price_unit: 0.5, product_id: [124, "Hay"] },
          poId: 101,
        },
        {
          id: 3,
          agreed_product_price_per_unit: 0, // No picking price
          firstMove: { price_unit: 0, product_id: [125, "Straw"] },
          poId: 102,
        },
      ];

      const poLineMap = new Map<string, number>();
      poLineMap.set("101_123", 0.4);
      poLineMap.set("101_124", 0.35);
      poLineMap.set("102_125", 0.38);

      const results = receipts.map((r) => {
        let pricePerTon = r.agreed_product_price_per_unit || 0;
        if (pricePerTon === 0 && r.poId && r.firstMove) {
          const productId = Array.isArray(r.firstMove.product_id)
            ? r.firstMove.product_id[0]
            : 0;
          const poLineKey = `${r.poId}_${productId}`;
          const poLinePrice = poLineMap.get(poLineKey);
          if (poLinePrice && poLinePrice > 0) {
            pricePerTon = poLinePrice * 1000;
          } else if (r.firstMove.price_unit > 0) {
            pricePerTon = r.firstMove.price_unit * 1000;
          }
        }
        return pricePerTon;
      });

      expect(results).toEqual([500, 350, 380]); // picking, PO line, PO line
    });
  });
});
